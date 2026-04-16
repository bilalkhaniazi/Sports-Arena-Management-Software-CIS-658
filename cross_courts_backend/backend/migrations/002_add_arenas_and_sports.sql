CREATE TABLE `sports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `slug` varchar(120) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `arenas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `slug` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `city` varchar(120) DEFAULT NULL,
  `status` enum('draft','active','inactive') NOT NULL DEFAULT 'active',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE `arena_operators` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `arena_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `arena_user_unique` (`arena_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

ALTER TABLE `courts`
ADD COLUMN `arena_id` int(11) DEFAULT NULL AFTER `cat_id`,
ADD COLUMN `sport_id` int(11) DEFAULT NULL AFTER `arena_id`;

ALTER TABLE `bookings`
ADD COLUMN `arena_id` int(11) DEFAULT NULL AFTER `court_id`,
ADD COLUMN `sport_id` int(11) DEFAULT NULL AFTER `arena_id`;

INSERT INTO `sports` (`name`, `slug`) VALUES
('Cricket', 'cricket'),
('Soccer', 'soccer'),
('Padel', 'padel'),
('Basketball', 'basketball');

INSERT INTO `arenas` (`name`, `slug`, `description`, `city`, `status`) VALUES
('Cross Courts Brooklyn', 'cross-courts-brooklyn', 'Primary USA mock arena created during the arena-aware rollout.', 'Brooklyn, NY', 'active');

UPDATE `courts`
SET
  `arena_id` = 1,
  `sport_id` = CASE
    WHEN LOWER(`name`) LIKE '%cricket%' THEN 1
    WHEN LOWER(`name`) LIKE '%football%' THEN 2
    WHEN LOWER(`name`) LIKE '%soccer%' THEN 2
    WHEN LOWER(`name`) LIKE '%padel%' THEN 3
    WHEN LOWER(`name`) LIKE '%tennis%' THEN 3
    WHEN LOWER(`name`) LIKE '%basketball%' THEN 4
    ELSE NULL
  END
WHERE `arena_id` IS NULL OR `sport_id` IS NULL;

UPDATE `bookings` b
JOIN `courts` c ON c.id = b.court_id
SET
  b.`arena_id` = c.`arena_id`,
  b.`sport_id` = c.`sport_id`
WHERE b.`arena_id` IS NULL OR b.`sport_id` IS NULL;
