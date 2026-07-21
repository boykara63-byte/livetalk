require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const { pool } = require("./db");

const allowedOrigin = process.env.FRONTEND_URL || "*";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const JWT_SECRET = process.env.JWT_SECRET;

if (!ADMIN_PASSWORD_HASH) {
  console.warn("[Admin] ADMIN_PASSWORD_HASH is not set. Admin login will not work.");
}
if (!JWT_SECRET) {
  console.warn("[Admin] JWT_SECRET is not set. Admin login will not work.");
}

const app = express();
app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ["GET", "POST"],
  },
});

const queue = [];
const activePairs = new Map();
const activePairDevices = new Map();
const deviceSockets = new Map();

function getOnlineCount() {
  try {
    const sockets = io.sockets?.sockets;
    if (!sockets) {
      console.warn("[OnlineCount] io.sockets.sockets not available");
      return 0;
    }
    let count = 0;
    for (const s of sockets.values()) {
      if (s.connected) count++;
    }
    console.log("[OnlineCount] count:", count, "socket map size:", sockets.size);
    return count;
  } catch (err) {
    console.error("[OnlineCount] error:", err.message);
    return 0;
  }
}

function calculateAge(birthDate) {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

async function tryMatch() {
  console.log(`[Match] tryMatch called, queue size: ${queue.length}`);
  while (queue.length >= 2) {
    const first = queue.shift();
    const second = queue.shift();

    if (!first.connected || !second.connected) {
      console.log(`[Match] skipped disconnected pair: first.connected=${first.connected}, second.connected=${second.connected}`);
      if (first.connected) queue.unshift(first);
      if (second.connected) queue.unshift(second);
      continue;
    }

    activePairs.set(first.id, second.id);
    activePairs.set(second.id, first.id);
    activePairDevices.set(first.id, second.data.deviceId);
    activePairDevices.set(second.id, first.data.deviceId);

    let firstCountry = null;
    let secondCountry = null;
    let firstNickname = null;
    let secondNickname = null;
    try {
      const { rows: firstRows } = await pool.query(
        `SELECT country, nickname FROM users WHERE device_id = $1`,
        [first.data.deviceId]
      );
      const { rows: secondRows } = await pool.query(
        `SELECT country, nickname FROM users WHERE device_id = $1`,
        [second.data.deviceId]
      );
      firstCountry = firstRows[0]?.country || null;
      secondCountry = secondRows[0]?.country || null;
      firstNickname = firstRows[0]?.nickname || null;
      secondNickname = secondRows[0]?.nickname || null;
    } catch (err) {
      console.error('[Match] error fetching user info:', err.message);
    }

    console.log(`[Match] paired ${first.id} <-> ${second.id}`);

    first.emit("matched", {
      partnerId: second.id,
      partnerDeviceId: second.data.deviceId,
      partnerCountry: secondCountry,
      partnerNickname: secondNickname,
      initiator: true,
    });
    second.emit("matched", {
      partnerId: first.id,
      partnerDeviceId: first.data.deviceId,
      partnerCountry: firstCountry,
      partnerNickname: firstNickname,
      initiator: false,
    });
  }
  console.log(`[Match] tryMatch end, queue size: ${queue.length}`);
}

function leavePair(socket, notifyPartner = true) {
  const partnerId = activePairs.get(socket.id);
  if (partnerId) {
    activePairs.delete(socket.id);
    activePairs.delete(partnerId);
    activePairDevices.delete(socket.id);
    activePairDevices.delete(partnerId);

    if (notifyPartner) {
      const partner = io.sockets.sockets.get(partnerId);
      if (partner) {
        partner.emit("partner-left");
      }
    }
  }
}

function removeFromQueue(socket) {
  const index = queue.indexOf(socket);
  if (index !== -1) {
    queue.splice(index, 1);
  }
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de tentatives. Réessayez plus tard." },
});

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Token manquant." });
  }

  const token = authHeader.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== "admin") {
      return res.status(403).json({ error: "Accès refusé." });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    console.error("[Admin] JWT verification failed:", err.message);
    return res.status(401).json({ error: "Token invalide ou expiré." });
  }
}

app.post("/api/verify-age", async (req, res) => {
  const { deviceId, birthDate, country, nickname } = req.body;
  if (!deviceId || !birthDate) {
    return res.status(400).json({ error: "L'identifiant et la date de naissance sont requis." });
  }

  const birth = new Date(birthDate);
  if (isNaN(birth.getTime())) {
    return res.status(400).json({ error: "Date de naissance invalide." });
  }

  const age = calculateAge(birth);

  const safeNickname = nickname && typeof nickname === "string" ? nickname.trim().slice(0, 30) : null;

  if (age < 18) {
    try {
      await pool.query(
        `INSERT INTO users (device_id, birth_date, age_verified, country, nickname)
         VALUES ($1, $2, FALSE, $3, $4)
         ON CONFLICT (device_id) DO UPDATE SET birth_date = $2, age_verified = FALSE, country = COALESCE($3, users.country), nickname = COALESCE($4, users.nickname)`,
        [deviceId, birthDate, country || null, safeNickname]
      );
    } catch (err) {
      console.error("verify-age insert error:", err.message);
      return res.status(500).json({ error: "Service temporairement indisponible. R\u00e9essaie dans quelques instants." });
    }
    return res.status(403).json({ error: "Vous devez avoir 18 ans ou plus pour utiliser ce service." });
  }

  try {
    await pool.query(
      `INSERT INTO users (device_id, birth_date, age_verified, country, nickname)
       VALUES ($1, $2, TRUE, $3, $4)
       ON CONFLICT (device_id) DO UPDATE SET birth_date = $2, age_verified = TRUE, country = COALESCE($3, users.country), nickname = COALESCE($4, users.nickname)`,
      [deviceId, birthDate, country || null, safeNickname]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("verify-age error:", err.message);
    return res.status(500).json({ error: "Service temporairement indisponible. R\u00e9essaie dans quelques instants." });
  }
});

app.post("/api/report", async (req, res) => {
  const { reporterDeviceId, reportedDeviceId, reason } = req.body;
  if (!reporterDeviceId || !reportedDeviceId) {
    return res.status(400).json({ error: "reporterDeviceId and reportedDeviceId are required" });
  }

  try {
    await pool.query(
      `INSERT INTO reports (reporter_device_id, reported_device_id, reason)
       VALUES ($1, $2, $3)`,
      [reporterDeviceId, reportedDeviceId, reason || null]
    );

    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM reports
       WHERE reported_device_id = $1
         AND created_at >= NOW() - INTERVAL '24 hours'`,
      [reportedDeviceId]
    );

    const reportCount = parseInt(rows[0].count, 10);
    if (reportCount > 3) {
      await pool.query(
        `UPDATE users SET is_banned = TRUE, ban_reason = 'Trop de signalements'
         WHERE device_id = $1`,
        [reportedDeviceId]
      );
    }

    return res.json({ success: true, reportCount });
  } catch (err) {
    console.error("report error:", err.message);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/api/admin/login", loginLimiter, async (req, res) => {
  const { password } = req.body;

  if (!ADMIN_PASSWORD_HASH || !JWT_SECRET) {
    return res.status(500).json({ error: "Configuration admin incomplète." });
  }

  if (!password) {
    return res.status(400).json({ error: "Mot de passe requis." });
  }

  try {
    const match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (!match) {
      return res.status(401).json({ error: "Mot de passe incorrect." });
    }

    const token = jwt.sign({ role: "admin" }, JWT_SECRET, { expiresIn: "24h" });
    return res.json({ token });
  } catch (err) {
    console.error("[Admin] login error:", err.message);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

async function safeCount(sql, label, params = []) {
  try {
    const { rows } = await pool.query(sql, params);
    console.log(`[Admin] ${label} raw:`, rows);
    return parseInt(rows[0]?.count || 0, 10);
  } catch (err) {
    console.error(`[Admin] ${label} query failed:`, err.message);
    return 0;
  }
}

async function safeQuery(sql, label, params = []) {
  try {
    const { rows } = await pool.query(sql, params);
    console.log(`[Admin] ${label} raw:`, rows);
    return rows;
  } catch (err) {
    console.error(`[Admin] ${label} query failed:`, err.message);
    return [];
  }
}

app.get("/api/admin/stats", requireAdmin, async (req, res) => {
  console.log("[Admin] /api/admin/stats called by admin");

  const totalUsers = await safeCount(`SELECT COUNT(*) FROM users`, "totalUsers");
  const verifiedUsers = await safeCount(`SELECT COUNT(*) FROM users WHERE age_verified = TRUE`, "verifiedUsers");
  const bannedUsers = await safeCount(`SELECT COUNT(*) FROM users WHERE is_banned = TRUE`, "bannedUsers");
  const totalReports = await safeCount(`SELECT COUNT(*) FROM reports`, "totalReports");
  const reportsLast24h = await safeCount(
    `SELECT COUNT(*) FROM reports WHERE created_at > NOW() - INTERVAL '24 hours'`,
    "reportsLast24h"
  );
  const usersByCountryRows = await safeQuery(
    `SELECT country, COUNT(*) AS count
     FROM users
     GROUP BY country
     ORDER BY count DESC`,
    "usersByCountry"
  );
  const signupsRows = await safeQuery(
    `SELECT DATE(created_at) AS date, COUNT(*) AS count
     FROM users
     WHERE created_at >= NOW() - INTERVAL '7 days'
     GROUP BY DATE(created_at)
     ORDER BY date ASC`,
    "signupsLast7Days"
  );

  const onlineNow = getOnlineCount();
  console.log("[Admin] onlineNow:", onlineNow);

  const payload = {
    totalUsers,
    onlineNow,
    verifiedUsers,
    bannedUsers,
    totalReports,
    reportsLast24h,
    usersByCountry: usersByCountryRows.map((r) => ({
      country: r.country || "Inconnu",
      count: parseInt(r.count, 10),
    })),
    signupsLast7Days: signupsRows.map((r) => ({
      date: r.date && typeof r.date === "object" ? r.date.toISOString().slice(0, 10) : r.date,
      count: parseInt(r.count, 10),
    })),
  };
  console.log("[Admin] /api/admin/stats payload:", payload);
  return res.json(payload);
});

app.get("/api/admin/reports", requireAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = (page - 1) * limit;

  try {
    const { rows } = await pool.query(
      `SELECT r.id, r.reporter_device_id, r.reported_device_id, r.reason, r.created_at,
              u.is_banned AS reported_is_banned
       FROM reports r
       LEFT JOIN users u ON u.device_id = r.reported_device_id
       ORDER BY r.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const { rows: countRows } = await pool.query(`SELECT COUNT(*) FROM reports`);
    const total = parseInt(countRows[0].count, 10);

    return res.json({
      reports: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[Admin] reports error:", err.message);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/api/admin/users", requireAdmin, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const offset = (page - 1) * limit;
  const { search, country, is_banned } = req.query;

  const conditions = [];
  const params = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`device_id ILIKE $${params.length}`);
  }
  if (country) {
    params.push(country);
    conditions.push(`country = $${params.length}`);
  }
  if (is_banned === "true" || is_banned === "false") {
    params.push(is_banned === "true");
    conditions.push(`is_banned = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countParams = params;

  try {
    const { rows } = await pool.query(
      `SELECT id, device_id, birth_date, age_verified, country, nickname, is_banned, ban_reason, created_at
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) FROM users ${whereClause}`,
      countParams
    );
    const total = parseInt(countRows[0].count, 10);

    return res.json({
      users: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    console.error("[Admin] users error:", err.message);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/api/admin/ban", requireAdmin, async (req, res) => {
  const { deviceId, reason } = req.body;
  if (!deviceId) {
    return res.status(400).json({ error: "deviceId requis." });
  }

  try {
    await pool.query(
      `UPDATE users SET is_banned = TRUE, ban_reason = $2 WHERE device_id = $1`,
      [deviceId, reason || "Banni depuis l'admin"]
    );

    const socketId = deviceSockets.get(deviceId);
    if (socketId) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        removeFromQueue(socket);
        leavePair(socket);
        socket.emit("join-error", { reason: "banned", message: "Vous avez été banni." });
        socket.disconnect(true);
        console.log(`[Admin] banned and disconnected socket ${socketId}`);
      }
      deviceSockets.delete(deviceId);
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("[Admin] ban error:", err.message);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/api/admin/unban", requireAdmin, async (req, res) => {
  const { deviceId } = req.body;
  if (!deviceId) {
    return res.status(400).json({ error: "deviceId requis." });
  }

  try {
    await pool.query(
      `UPDATE users SET is_banned = FALSE, ban_reason = NULL WHERE device_id = $1`,
      [deviceId]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("[Admin] unban error:", err.message);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

io.on("connection", (socket) => {
  console.log("[Socket] connection", socket.id);
  const count = getOnlineCount();
  console.log("[Socket] online-count emit:", count);
  socket.emit("online-count", count);
  socket.broadcast.emit("online-count", count);

  socket.on("join-queue", async ({ deviceId }) => {
    console.log(`[Queue] join-queue from ${socket.id}, deviceId=${deviceId}`);
    if (!deviceId) {
      console.log(`[Auth] join-error for ${socket.id}: missing deviceId`);
      socket.emit("join-error", { reason: "not-verified", message: "Identifiant manquant." });
      return;
    }

    try {
      const { rows } = await pool.query(
        `SELECT age_verified, is_banned FROM users WHERE device_id = $1`,
        [deviceId]
      );

      if (rows.length === 0 || !rows[0].age_verified) {
        console.log(`[Auth] join-error for ${socket.id}: age not verified in DB`);
        socket.emit("join-error", { reason: "not-verified", message: "Vérification d'âge requise." });
        return;
      }

      if (rows[0].is_banned) {
        console.log(`[Auth] join-error for ${socket.id}: user is banned`);
        socket.emit("join-error", { reason: "banned", message: "Vous avez été banni." });
        return;
      }

      socket.data.deviceId = deviceId;
      deviceSockets.set(deviceId, socket.id);
      removeFromQueue(socket);
      leavePair(socket);
      queue.push(socket);
      console.log(`[Queue] queue size after push: ${queue.length}`);
      tryMatch();
    } catch (err) {
      console.error("[Queue] join-queue error:", err.message);
      socket.emit("join-error", { reason: "server", message: "Erreur serveur." });
    }
  });

  socket.on("next", () => {
    console.log(`[Queue] next from ${socket.id}`);
    leavePair(socket);
    removeFromQueue(socket);
    queue.push(socket);
    console.log(`[Queue] queue size after next: ${queue.length}`);
    tryMatch();
  });

  socket.on("leave-queue", () => {
    console.log(`[Queue] leave-queue from ${socket.id}`);
    removeFromQueue(socket);
    leavePair(socket, false);
    console.log(`[Queue] queue size after leave: ${queue.length}`);
  });

  socket.on("chat-message", (message) => {
    const partnerId = activePairs.get(socket.id);
    if (partnerId) {
      const partner = io.sockets.sockets.get(partnerId);
      if (partner) {
        partner.emit("chat-message", message);
      }
    }
  });

  socket.on("webrtc-offer", ({ offer }) => {
    const partnerId = activePairs.get(socket.id);
    if (partnerId) {
      const partner = io.sockets.sockets.get(partnerId);
      if (partner) {
        partner.emit("webrtc-offer", { offer, from: socket.id });
      }
    }
  });

  socket.on("webrtc-answer", ({ answer }) => {
    const partnerId = activePairs.get(socket.id);
    if (partnerId) {
      const partner = io.sockets.sockets.get(partnerId);
      if (partner) {
        partner.emit("webrtc-answer", { answer });
      }
    }
  });

  socket.on("webrtc-ice-candidate", ({ candidate }) => {
    const partnerId = activePairs.get(socket.id);
    if (partnerId) {
      const partner = io.sockets.sockets.get(partnerId);
      if (partner) {
        partner.emit("webrtc-ice-candidate", { candidate });
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] disconnect ${socket.id}`);
    removeFromQueue(socket);
    leavePair(socket);
    if (socket.data.deviceId) {
      const current = deviceSockets.get(socket.data.deviceId);
      if (current === socket.id) {
        deviceSockets.delete(socket.data.deviceId);
      }
    }
    process.nextTick(() => {
      const count = getOnlineCount();
      console.log("[Socket] online-count emit after disconnect:", count);
      io.emit("online-count", count);
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
