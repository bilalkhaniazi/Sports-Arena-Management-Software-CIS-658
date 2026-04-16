-- Sets Password123! for USA demo accounts (bcrypt cost 12).
-- Run this if you already applied 003 with the old unknown hash.
UPDATE `users`
SET `password` = '$2a$12$jLANJbQBHS9lS/r8Ik4raO9l3Qf54H6CDU01LNxRErfnaTSsk4Z46'
WHERE `email` IN (
  'admin@crosscourtsusa.com',
  'operator@crosscourtsusa.com',
  'customer@crosscourtsusa.com'
);
