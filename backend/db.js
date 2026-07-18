const { Pool } = require("pg");
require("dotenv").config();

const isNeon = String(process.env.DATABASE_URL || "").includes("neon.tech");
const isProduction = process.env.NODE_ENV === "production";

const poolConfig = {
  connectionString: process.env.DATABASE_URL,
};

if (isNeon || isProduction) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

module.exports = { pool };
