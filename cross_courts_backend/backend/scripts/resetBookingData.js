/**
 * Clears booking and schedule-template rows. Preserves:
 *   users, sports, arenas, courts, custom_message, arena_operators.
 * Tables emptied: bookings, custom_slots, court_schedule, default_slots, arena_holidays (if present).
 * After this, slot times come only from what you configure in Booking Settings (or new default_slots).
 *
 * Usage: node scripts/resetBookingData.js
 */
const { db } = require("../config/db");
const { hasTable } = require("../utils/schema");

async function run() {
  const conn = await db.getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    await conn.query("TRUNCATE TABLE bookings");
    await conn.query("TRUNCATE TABLE custom_slots");
    await conn.query("TRUNCATE TABLE court_schedule");
    await conn.query("TRUNCATE TABLE default_slots");
    if (await hasTable(db, "arena_holidays")) {
      await conn.query("TRUNCATE TABLE arena_holidays");
    }
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log(
      "OK: Truncated bookings, custom_slots, court_schedule, default_slots" +
        ((await hasTable(db, "arena_holidays")) ? ", arena_holidays" : "") +
        ". Users, sports, and courts unchanged. Re-apply slot patterns in Booking Settings.",
    );
  } catch (err) {
    console.error("Reset failed:", err.message || err);
    process.exitCode = 1;
  } finally {
    conn.release();
    await db.end();
  }
}

run();
