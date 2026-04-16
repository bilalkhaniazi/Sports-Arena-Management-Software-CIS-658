const mysql = require("mysql2/promise");
const env = require("./env");
const {
  ensureBookingsPaymentColumns,
  ensureCourtAddOnsTable,
  ensureCancellationRequestsTable,
} = require("./ensureSchema");

const db = mysql.createPool(env.db);

const testConnection = async () => {
  try {
    const connection = await db.getConnection();
    console.log("Connected to MySQL");
    connection.release();
    await ensureBookingsPaymentColumns(db);
    await ensureCourtAddOnsTable(db);
    await ensureCancellationRequestsTable(db);
  } catch (error) {
    const detail =
      error && typeof error === "object" && "message" in error
        ? String(error.message)
        : String(error);
    console.error("Error connecting to MySQL:", detail || "check DB_HOST, credentials, and that MySQL is running");
  }
};

module.exports = {
  db,
  testConnection,
};
