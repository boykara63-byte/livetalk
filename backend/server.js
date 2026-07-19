require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { pool } = require("./db");

const allowedOrigin = process.env.FRONTEND_URL || "*";

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

function calculateAge(birthDate) {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

function tryMatch() {
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

    console.log(`[Match] paired ${first.id} <-> ${second.id}`);

    first.emit("matched", {
      partnerId: second.id,
      partnerDeviceId: second.data.deviceId,
      initiator: true,
    });
    second.emit("matched", {
      partnerId: first.id,
      partnerDeviceId: first.data.deviceId,
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

app.post("/api/verify-age", async (req, res) => {
  const { deviceId, birthDate } = req.body;
  if (!deviceId || !birthDate) {
    return res.status(400).json({ error: "deviceId and birthDate are required" });
  }

  const birth = new Date(birthDate);
  const age = calculateAge(birth);

  if (age < 18) {
    try {
      await pool.query(
        `INSERT INTO users (device_id, birth_date, age_verified)
         VALUES ($1, $2, FALSE)
         ON CONFLICT (device_id) DO UPDATE SET birth_date = $2, age_verified = FALSE`,
        [deviceId, birthDate]
      );
    } catch (err) {
      console.error("verify-age insert error:", err.message);
    }
    return res.status(403).json({ error: "Vous devez avoir 18 ans ou plus pour utiliser ce service." });
  }

  try {
    await pool.query(
      `INSERT INTO users (device_id, birth_date, age_verified)
       VALUES ($1, $2, TRUE)
       ON CONFLICT (device_id) DO UPDATE SET birth_date = $2, age_verified = TRUE`,
      [deviceId, birthDate]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("verify-age error:", err.message);
    return res.status(500).json({ error: "Erreur serveur" });
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

io.on("connection", (socket) => {
  console.log("[Socket] connection", socket.id);
  const count = io.sockets.sockets.size;
  console.log("[Socket] online-count emit:", count);
  io.emit("online-count", count);

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
    process.nextTick(() => {
      const count = io.sockets.sockets.size;
      console.log("[Socket] online-count emit after disconnect:", count);
      io.emit("online-count", count);
    });
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
