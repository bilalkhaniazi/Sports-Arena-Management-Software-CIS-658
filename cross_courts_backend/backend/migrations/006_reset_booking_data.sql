-- One-time / manual: wipe booking-related rows. Keeps users, sports, arenas, courts, default_slots.
-- Prefer: npm run db:reset-bookings (from backend/), which skips arena_holidays if the table is missing.

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `bookings`;
TRUNCATE TABLE `custom_slots`;
TRUNCATE TABLE `court_schedule`;
-- If migration 005 was applied:
-- TRUNCATE TABLE `arena_holidays`;
SET FOREIGN_KEY_CHECKS = 1;
