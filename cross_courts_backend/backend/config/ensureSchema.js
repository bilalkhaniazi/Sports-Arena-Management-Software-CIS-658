/**
 * Idempotent schema patches applied after DB connects (dev-friendly).
 */
const ensureBookingsPaymentColumns = async (db) => {
  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS c FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'bookings'
         AND column_name = 'payment_method'`,
    );
    if (rows[0]?.c > 0) return;

    console.log("Applying bookings.payment_method / bookings.total_price …");
    await db.query(
      "ALTER TABLE `bookings` ADD COLUMN `payment_method` VARCHAR(16) NULL DEFAULT NULL AFTER `add_on_price`",
    );
    await db.query(
      "ALTER TABLE `bookings` ADD COLUMN `total_price` DECIMAL(10,2) NULL DEFAULT NULL AFTER `payment_method`",
    );
    await db.query(
      `UPDATE bookings SET
         payment_method = 'online',
         total_price = COALESCE(online_price, 0) + COALESCE(IFNULL(add_on_price, 0), 0)
       WHERE total_price IS NULL`,
    );
    console.log("Bookings payment columns are ready.");
  } catch (e) {
    console.error("ensureBookingsPaymentColumns:", e.message || e);
  }
};

const ensureCourtAddOnsTable = async (db) => {
  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'court_add_ons'`,
    );
    if (rows[0]?.c > 0) return;

    console.log("Creating court_add_ons …");
    await db.query(`
      CREATE TABLE \`court_add_ons\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`court_id\` int(11) NOT NULL,
        \`label\` varchar(255) NOT NULL,
        \`price\` decimal(10,2) NOT NULL DEFAULT 0.00,
        \`sort_order\` int(11) NOT NULL DEFAULT 0,
        \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        PRIMARY KEY (\`id\`),
        KEY \`idx_court_add_ons_court\` (\`court_id\`),
        CONSTRAINT \`fk_court_add_ons_court\` FOREIGN KEY (\`court_id\`) REFERENCES \`courts\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    console.log("court_add_ons is ready.");
  } catch (e) {
    console.error("ensureCourtAddOnsTable:", e.message || e);
  }
};

const ensureCancellationRequestsTable = async (db) => {
  try {
    const [rows] = await db.query(
      `SELECT COUNT(*) AS c FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_name = 'cancellation_requests'`,
    );
    if (rows[0]?.c > 0) return;

    console.log("Creating cancellation_requests …");
    await db.query(`
      CREATE TABLE \`cancellation_requests\` (
        \`id\` int(11) NOT NULL AUTO_INCREMENT,
        \`booking_id\` int(11) NOT NULL,
        \`arena_id\` int(11) DEFAULT NULL,
        \`customer_email\` varchar(255) NOT NULL,
        \`customer_name\` varchar(255) DEFAULT NULL,
        \`court_name\` varchar(255) DEFAULT NULL,
        \`arena_name\` varchar(255) DEFAULT NULL,
        \`booking_date\` date DEFAULT NULL,
        \`start_time\` time DEFAULT NULL,
        \`end_time\` time DEFAULT NULL,
        \`customer_note\` text DEFAULT NULL,
        \`status\` enum('pending','approved','denied') NOT NULL DEFAULT 'pending',
        \`operator_note\` text DEFAULT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
        \`resolved_at\` timestamp NULL DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_cr_booking\` (\`booking_id\`),
        KEY \`idx_cr_status_arena\` (\`status\`,\`arena_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
    `);
    console.log("cancellation_requests is ready.");
  } catch (e) {
    console.error("ensureCancellationRequestsTable:", e.message || e);
  }
};

module.exports = {
  ensureBookingsPaymentColumns,
  ensureCourtAddOnsTable,
  ensureCancellationRequestsTable,
};
