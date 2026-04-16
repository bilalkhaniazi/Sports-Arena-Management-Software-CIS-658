-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jun 25, 2025 at 04:33 PM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `crosscourts`
--

-- --------------------------------------------------------

--
-- Table structure for table `bookings`
--

CREATE TABLE `bookings` (
  `id` int(11) NOT NULL,
  `court_id` int(11) NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(50) NOT NULL,
  `email` varchar(255) NOT NULL,
  `online_price` decimal(10,2) NOT NULL,
  `cash_price` decimal(10,2) NOT NULL,
  `add_on` varchar(255) DEFAULT NULL,
  `add_on_price` decimal(10,2) DEFAULT NULL,
  `booking_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `bookings`
--

INSERT INTO `bookings` (`id`, `court_id`, `start_time`, `end_time`, `name`, `phone`, `email`, `online_price`, `cash_price`, `add_on`, `add_on_price`, `booking_date`, `created_at`) VALUES
(1, 1, '10:00:00', '11:00:00', 'Alex Carter', '9175550101', 'alex.carter@example.com', 120.00, 0.00, 'Equipment Rental', 15.00, '2025-06-14', '2025-06-12 14:37:05'),
(2, 2, '12:00:00', '13:00:00', 'Morgan Lee', '6465550142', 'morgan.lee@example.com', 0.00, 95.00, 'Training Cones', 10.00, '2025-06-14', '2025-06-12 14:37:05'),
(3, 3, '15:00:00', '16:00:00', 'Jordan Rivera', '7185550188', 'jordan.rivera@example.com', 110.00, 25.00, 'Lights Upgrade', 20.00, '2025-06-15', '2025-06-12 14:37:05');

-- --------------------------------------------------------

--
-- Table structure for table `courts`
--

CREATE TABLE `courts` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `cat_id` int(11) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT 0.00,
  `cash_price` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `courts`
--

INSERT INTO `courts` (`id`, `name`, `cat_id`, `price`, `cash_price`, `created_at`) VALUES
(1, 'Brooklyn Cricket Field', 1, 120.00, 135.00, '2025-06-12 14:33:23'),
(2, 'Hudson Cricket Turf', 1, 110.00, 125.00, '2025-06-12 14:33:23'),
(3, 'Queens Soccer Pitch', 2, 95.00, 110.00, '2025-06-12 14:33:23'),
(4, 'Manhattan Padel Court', 3, 85.00, 95.00, '2025-06-12 14:33:23'),
(5, 'Prospect Park Basketball Court', 4, 70.00, 80.00, '2025-06-12 14:33:23');

-- --------------------------------------------------------

--
-- Table structure for table `court_schedule`
--

CREATE TABLE `court_schedule` (
  `id` int(11) NOT NULL,
  `court_id` int(11) NOT NULL,
  `slot_date` date NOT NULL,
  `default_slot` tinyint(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `court_schedule`
--

INSERT INTO `court_schedule` (`id`, `court_id`, `slot_date`, `default_slot`) VALUES
(1, 1, '2025-06-14', 1),
(2, 2, '2025-06-14', 0),
(3, 3, '2025-06-15', 1),
(4, 4, '2025-06-15', 0),
(5, 5, '2025-06-16', 1),
(6, 1, '2025-06-12', 0);

-- --------------------------------------------------------

--
-- Table structure for table `custom_message`
--

CREATE TABLE `custom_message` (
  `id` int(11) NOT NULL,
  `message` text NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `custom_message`
--

INSERT INTO `custom_message` (`id`, `message`) VALUES
(1, 'Your Cross Courts USA booking is confirmed. We look forward to seeing you on court.');

-- --------------------------------------------------------

--
-- Table structure for table `custom_slots`
--

CREATE TABLE `custom_slots` (
  `id` int(11) NOT NULL,
  `court_id` int(11) NOT NULL,
  `slot_date` date NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `modified` varchar(10) DEFAULT 'Yes'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `custom_slots`
--

INSERT INTO `custom_slots` (`id`, `court_id`, `slot_date`, `start_time`, `end_time`, `modified`) VALUES
(1, 1, '2025-06-14', '08:00:00', '09:00:00', 'Yes'),
(2, 1, '2025-06-14', '09:00:00', '10:00:00', 'Yes'),
(3, 2, '2025-06-15', '10:00:00', '11:00:00', 'Yes'),
(4, 3, '2025-06-15', '11:00:00', '12:00:00', 'Yes'),
(5, 4, '2025-06-16', '14:00:00', '15:00:00', 'Yes'),
(6, 1, '2025-06-12', '08:00:12', '09:00:00', 'Yes'),
(7, 1, '2025-06-12', '09:00:00', '10:00:00', 'Yes');

-- --------------------------------------------------------

--
-- Table structure for table `default_slots`
--

CREATE TABLE `default_slots` (
  `id` int(11) NOT NULL,
  `court_id` int(11) NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `default_slots`
--

INSERT INTO `default_slots` (`id`, `court_id`, `start_time`, `end_time`) VALUES
(1, 1, '08:00:00', '09:00:00'),
(2, 1, '09:00:00', '10:00:00'),
(3, 2, '10:00:00', '11:00:00'),
(4, 3, '11:00:00', '12:00:00'),
(5, 4, '14:00:00', '15:00:00');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `title` varchar(100) DEFAULT NULL,
  `role` enum('admin','operator','customer') NOT NULL DEFAULT 'customer',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `password`, `title`, `role`, `created_at`) VALUES
(1, 'Admin User', 'admin@crosscourtsusa.com', '$2a$12$B8gruAU16Uj8FQd9TSo/7.0ukiFEi6VUE8u0Qlwe9j/EPhgWOmmGi', 'Admin', 'admin', '2025-06-12 14:31:07');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `bookings`
--
ALTER TABLE `bookings`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `courts`
--
ALTER TABLE `courts`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `court_schedule`
--
ALTER TABLE `court_schedule`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `court_id` (`court_id`,`slot_date`);

--
-- Indexes for table `custom_message`
--
ALTER TABLE `custom_message`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `custom_slots`
--
ALTER TABLE `custom_slots`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `default_slots`
--
ALTER TABLE `default_slots`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `email` (`email`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `bookings`
--
ALTER TABLE `bookings`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `courts`
--
ALTER TABLE `courts`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `court_schedule`
--
ALTER TABLE `court_schedule`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `custom_message`
--
ALTER TABLE `custom_message`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `custom_slots`
--
ALTER TABLE `custom_slots`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `default_slots`
--
ALTER TABLE `default_slots`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
