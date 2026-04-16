/**
 * Turns mysql2 / Node errors into a safe, actionable message for API clients.
 */
function formatApiError(err) {
  if (!err) {
    return "Unknown error (no details). Check the API terminal for stack traces.";
  }
  if (typeof err === "string") return err;

  const msg = err.message || err.sqlMessage;
  if (msg && String(msg).trim()) return String(msg);

  switch (err.code) {
    case "ECONNREFUSED":
      return "Cannot connect to MySQL. Start the database server and check DB_HOST and port in .env.";
    case "ER_ACCESS_DENIED_ERROR":
      return "MySQL access denied. Check DB_USER and DB_PASSWORD in .env.";
    case "ER_BAD_DB_ERROR":
      return "Database does not exist. Create it and run migrations (DB_NAME in .env).";
    case "ENOTFOUND":
      return "Cannot resolve database host. Check DB_HOST in .env.";
    case "ETIMEDOUT":
      return "Database connection timed out. Check DB_HOST, firewall, and that MySQL accepts TCP connections.";
    case "EPIPE":
    case "ECONNRESET":
      return "Database connection was reset. Check that MySQL is stable and max_connections is sufficient.";
    default:
      if (err.code) return `Database or network error (${err.code}).`;
  }

  if (typeof err.errno === "number") {
    return `Database or network error (errno ${err.errno}).`;
  }

  console.error("[formatApiError] Unhandled error shape:", err);

  return (
    "Server error while talking to the database or processing the request. " +
    "Open the terminal where `node server.js` is running and read the stack trace. " +
    "Typical fix: start MySQL, create the database in .env (DB_NAME), and run backend/migrations SQL files."
  );
}

module.exports = { formatApiError };
