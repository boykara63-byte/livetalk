const fs = require("fs");
const path = require("path");
const { pool } = require("./db");

const migrationsDir = path.join(__dirname, "migrations");

async function runMigrations() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`Applying migration: ${file}`);
    try {
      await pool.query(sql);
      console.log(`Applied ${file}`);
    } catch (err) {
      console.error(`Migration failed for ${file}:`, err.message);
      process.exit(1);
    }
  }

  await pool.end();
  console.log("All migrations applied successfully");
}

runMigrations().catch((err) => {
  console.error("Migration runner failed:", err.message);
  process.exit(1);
});
