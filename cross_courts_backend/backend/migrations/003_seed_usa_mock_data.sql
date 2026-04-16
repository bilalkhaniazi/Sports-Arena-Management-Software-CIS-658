ALTER TABLE `courts`
ADD COLUMN IF NOT EXISTS `arena_id` int(11) DEFAULT NULL AFTER `cat_id`,
ADD COLUMN IF NOT EXISTS `sport_id` int(11) DEFAULT NULL AFTER `arena_id`,
ADD COLUMN IF NOT EXISTS `price` decimal(10,2) DEFAULT 0.00 AFTER `sport_id`,
ADD COLUMN IF NOT EXISTS `cash_price` decimal(10,2) DEFAULT 0.00 AFTER `price`;

DELETE FROM `bookings`;
DELETE FROM `courts`;
DELETE FROM `custom_message`;
DELETE FROM `users`;
DELETE FROM `arenas`;
DELETE FROM `sports`;

INSERT INTO `sports` (`id`, `name`, `slug`) VALUES
(1, 'Cricket', 'cricket'),
(2, 'Soccer', 'soccer'),
(3, 'Padel', 'padel'),
(4, 'Basketball', 'basketball');

INSERT INTO `arenas` (`id`, `name`, `slug`, `description`, `city`, `status`) VALUES
(1, 'Cross Courts Brooklyn', 'cross-courts-brooklyn', 'Flagship USA mock arena for customer and operator flows.', 'Brooklyn, NY', 'active'),
(2, 'Cross Courts Austin', 'cross-courts-austin', 'Secondary USA mock arena for multi-location demos.', 'Austin, TX', 'active');

INSERT INTO `courts` (`id`, `name`, `cat_id`, `arena_id`, `sport_id`, `price`, `cash_price`, `created_at`) VALUES
(1, 'Brooklyn Cricket Field', 1, 1, 1, 120.00, 135.00, NOW()),
(2, 'Hudson Cricket Turf', 1, 1, 1, 110.00, 125.00, NOW()),
(3, 'Queens Soccer Pitch', 2, 1, 2, 95.00, 110.00, NOW()),
(4, 'Manhattan Padel Court', 3, 1, 3, 85.00, 95.00, NOW()),
(5, 'Prospect Park Basketball Court', 4, 2, 4, 70.00, 80.00, NOW());

INSERT INTO `bookings` (`id`, `court_id`, `arena_id`, `sport_id`, `start_time`, `end_time`, `name`, `phone`, `email`, `online_price`, `cash_price`, `add_on`, `add_on_price`, `booking_date`, `created_at`) VALUES
(1, 1, 1, 1, '10:00:00', '11:00:00', 'Alex Carter', '9175550101', 'alex.carter@example.com', 120.00, 0.00, 'Equipment Rental', 15.00, '2025-06-14', NOW()),
(2, 3, 1, 2, '12:00:00', '13:00:00', 'Morgan Lee', '6465550142', 'morgan.lee@example.com', 95.00, 0.00, 'Training Cones', 10.00, '2025-06-14', NOW()),
(3, 5, 2, 4, '15:00:00', '16:00:00', 'Jordan Rivera', '7185550188', 'jordan.rivera@example.com', 70.00, 15.00, 'Lights Upgrade', 20.00, '2025-06-15', NOW());

INSERT INTO `custom_message` (`id`, `message`) VALUES
(1, 'Your Cross Courts USA booking is confirmed. We look forward to seeing you on court.');

-- Demo password for all seeded users below: Password123!
INSERT INTO `users` (`id`, `name`, `email`, `password`, `title`, `role`, `created_at`) VALUES
(1, 'Admin User', 'admin@crosscourtsusa.com', '$2a$12$jLANJbQBHS9lS/r8Ik4raO9l3Qf54H6CDU01LNxRErfnaTSsk4Z46', 'Admin', 'admin', NOW()),
(2, 'Operator User', 'operator@crosscourtsusa.com', '$2a$12$jLANJbQBHS9lS/r8Ik4raO9l3Qf54H6CDU01LNxRErfnaTSsk4Z46', 'Operator', 'operator', NOW()),
(3, 'Customer User', 'customer@crosscourtsusa.com', '$2a$12$jLANJbQBHS9lS/r8Ik4raO9l3Qf54H6CDU01LNxRErfnaTSsk4Z46', 'Customer', 'customer', NOW());
