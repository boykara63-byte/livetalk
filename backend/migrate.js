const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

const file = process.argv[2] || path.join(__dirname, "migrations", "001_init.sql");
const sql = fs.readFileSync(file, "utf8");

pool.query(sql)
  .then(() => {
    console.log("Migration applied successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Migration failed:", err.message);
    process.exit(1);
  });
