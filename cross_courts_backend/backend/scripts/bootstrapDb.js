/**
 * Creates DB if needed, imports base schema from repo root crosscourts.sql,
 * then applies arena migrations when missing.
 *
 * Usage (from backend folder): npm run db:bootstrap
 * Optional: npm run db:bootstrap -- --usa-seed   (wipes booking/user seed data; use fresh dev DB only)
 */
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const rootSql = path.join(__dirname, "..", "..", "..", "crosscourts.sql");
const migrationsDir = path.join(__dirname, "..", "migrations");

async function tableExists(conn, schema, name) {
  const [rows] = await conn.query(
    "SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ? LIMIT 1",
    [schema, name],
  );
  return rows.length > 0;
}

async function columnExists(conn, schema, table, column) {
  const [rows] = await conn.query(
    "SELECT 1 FROM information_schema.columns WHERE table_schema = ? AND table_name = ? AND column_name = ? LIMIT 1",
    [schema, table, column],
  );
  return rows.length > 0;
}

async function main() {
  const host = process.env.DB_HOST || "127.0.0.1";
  const user = process.env.DB_USER || "root";
  const password =
    process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : "";
  const dbName = process.env.DB_NAME || "crosscourts";
  const usaSeed = process.argv.includes("--usa-seed");

  const conn = await mysql.createConnection({
    host,
    user,
    password,
    multipleStatements: true,
  });

  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await conn.query(`USE \`${dbName}\``);
  console.log(`Using database "${dbName}" on ${host} as ${user}`);

  const hasUsers = await tableExists(conn, dbName, "users");
  if (!hasUsers) {
    if (!fs.existsSync(rootSql)) {
      throw new Error(`Missing ${rootSql}. Expected crosscourts.sql at Cross Courts project root.`);
    }
    console.log("Importing crosscourts.sql (base tables)...");
    const dump = fs.readFileSync(rootSql, "utf8");
    await conn.query(dump);
    console.log("Base import done.");
  } else {
    console.log("Tables already present; skipping crosscourts.sql import.");
  }

  const hasRole = await columnExists(conn, dbName, "users", "role");
  if (!hasRole) {
    console.log("Applying 001_add_users_role.sql ...");
    const sql = fs.readFileSync(
      path.join(migrationsDir, "001_add_users_role.sql"),
      "utf8",
    );
    await conn.query(sql);
  } else {
    console.log("users.role already exists; skipping 001.");
  }

  const hasArenas = await tableExists(conn, dbName, "arenas");
  if (!hasArenas) {
    console.log("Applying 002_add_arenas_and_sports.sql ...");
    const sql = fs.readFileSync(
      path.join(migrationsDir, "002_add_arenas_and_sports.sql"),
      "utf8",
    );
    await conn.query(sql);
  } else {
    console.log("arenas table exists; skipping 002.");
  }

  if (usaSeed) {
    console.log("Applying 003 USA seed (destructive)...");
    const sql = fs.readFileSync(
      path.join(migrationsDir, "003_seed_usa_mock_data.sql"),
      "utf8",
    );
    await conn.query(sql);
    console.log("Applying 004 demo passwords...");
    const p4 = fs.readFileSync(
      path.join(migrationsDir, "004_reset_demo_passwords.sql"),
      "utf8",
    );
    await conn.query(p4);
  }

  await conn.end();
  console.log("Bootstrap finished. Restart the API: node server.js");
  if (!usaSeed) {
    console.log(
      'Tip: for fresh demo logins (Password123!), run: npm run db:bootstrap -- --usa-seed',
    );
  }
}

main().catch((err) => {
  console.error(err.message || err);
  if (err.code === "ECONNREFUSED") {
    console.error(
      "\nMySQL is not accepting connections. Start MySQL (e.g. XAMPP/WAMP) or set DB_HOST to your host (see .env).",
    );
  }
  process.exit(1);
});
