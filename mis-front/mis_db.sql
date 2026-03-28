-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Mar 28, 2026 at 05:29 AM
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
-- Database: `mis_db`
--

-- --------------------------------------------------------

--
-- Table structure for table `apartments`
--

CREATE TABLE `apartments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `apartment_code` varchar(255) NOT NULL,
  `total_price` decimal(15,2) NOT NULL DEFAULT 0.00,
  `usage_type` varchar(255) NOT NULL,
  `block_number` varchar(255) DEFAULT NULL,
  `unit_number` varchar(255) NOT NULL,
  `floor_number` varchar(255) DEFAULT NULL,
  `bedrooms` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `halls` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `bathrooms` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `kitchens` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `balcony` tinyint(1) NOT NULL DEFAULT 0,
  `area_sqm` decimal(10,2) DEFAULT NULL,
  `apartment_shape` varchar(255) DEFAULT NULL,
  `corridor` varchar(255) DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'available',
  `qr_code` varchar(255) DEFAULT NULL,
  `additional_info` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `apartments`
--

INSERT INTO `apartments` (`id`, `uuid`, `apartment_code`, `total_price`, `usage_type`, `block_number`, `unit_number`, `floor_number`, `bedrooms`, `halls`, `bathrooms`, `kitchens`, `balcony`, `area_sqm`, `apartment_shape`, `corridor`, `status`, `qr_code`, `additional_info`, `created_at`, `updated_at`, `deleted_at`) VALUES
(10, 'c4e6ae0e-a035-475e-b3f8-8e548ffa7204', 'A-100', 0.00, 'residential', 'G', '303', '1/K', 4, 4, 3, 4, 0, 93.00, 'L-shape', 'North wing', 'sold', 'QR-4999', 'dfsdfsd', '2026-03-03 01:55:37', '2026-03-03 01:59:46', NULL),
(11, '9ef38e2b-c46c-4828-9645-48f94585a4e8', 'B-4777', 0.00, 'residential', 'B', '40', '1/H', 4, 4, 4, 4, 0, 94.00, 'L-shap', 'north win', 'sold', 'QR-488', 'this is some description', '2026-03-03 03:45:32', '2026-03-07 00:18:07', NULL),
(12, '0248c0ba-569c-43b4-9c6f-afd08022db5d', 'J-3323', 0.00, 'residential', 'J', '400', '1/H', 4, 5, 5, 4, 0, 59.00, 'L-shap', 'North Wing', 'handed_over', 'QR-200', 'This is soem description', '2026-03-03 05:19:44', '2026-03-03 05:28:46', NULL),
(13, 'eb8ce0f5-d1cd-4d89-ae38-38281308d353', 'HY_58888', 0.00, 'residential', 'G', '404', '4004', 3, 3, 3, 3, 0, 42.00, 'L-shap', 'North Wing', 'handed_over', 'QR-3232', 'This is some description', '2026-03-03 05:48:38', '2026-03-03 06:07:51', NULL),
(14, 'c74282b6-dffe-4d54-8bf5-92e5d309b18a', 'KJ377', 0.00, 'residential', 'K', '404', '1/L', 4, 4, 4, 4, 0, 42.00, 'L-shape', 'North Wing', 'handed_over', 'QR-399', 'This is some description', '2026-03-03 05:50:22', '2026-03-03 06:07:37', NULL),
(15, 'c9414b0a-63c6-4efb-9f2a-2f237a4f8f08', 'KL-327', 0.00, 'residential', 'T', '40', '1/H', 4, 5, 5, 5, 0, 78.00, 'L-shap', 'North win', 'sold', 'QR-300', 'This is some descirption', '2026-03-03 06:23:01', '2026-03-04 05:40:07', NULL),
(16, '56cedc9d-51e7-4dcc-9270-311e689b4c87', 'JLE_3232323', 0.00, 'residential', 'h', '101', '3/J', 3, 3, 4, 4, 0, 4.00, 'L-shap', 'North wing', 'sold', 'QR-388', 'thi si', '2026-03-03 06:32:09', '2026-03-03 07:13:23', NULL),
(17, 'cdcffab5-abd7-47cd-a975-c14b6e947248', 'JTO-40', 0.00, 'residential', 'H', '303', '1/K', 4, 4, 4, 4, 0, 44.00, 'L-shape', 'North Wing', 'sold', 'QR-3000', 'This some descripton', '2026-03-04 02:26:21', '2026-03-04 03:01:14', NULL),
(18, '0f09dc6a-c0e7-4fd6-8920-096d2a405b1b', 'KJ3232', 0.00, 'residential', 'J', '4040', '1/J', 4, 4, 4, 4, 0, 43.00, 'L-shap', 'North Wing', 'sold', 'QR-10', 'df', '2026-03-04 05:42:02', '2026-03-04 05:52:27', NULL),
(19, '69952b98-5fa2-438b-9714-23a7e5b8e3a1', 'YUT-300', 0.00, 'residential', 'H', '4004', '1/K', 3, 4, 4, 4, 0, 94.00, 'L-shape', 'North WIng', 'sold', 'QR-000', 'This is some description', '2026-03-07 00:05:14', '2026-03-07 00:57:12', NULL),
(20, '5a677259-a2f8-4ace-ae03-a87f03f3af41', 'GH32300324', 0.00, 'residential', 'H', '434', '42', 3, 4, 4, 4, 0, 44.00, 'sfsd', 'fsdf', 'rented', 'dsf', 'ddsdfhfsfds', '2026-03-07 01:13:06', '2026-03-08 04:33:28', NULL),
(21, 'c51d55b5-6eee-4fdd-902b-dbf889b99408', 'KJ-23423', 0.00, 'residential', 'J', '30', '1/J', 3, 3, 3, 4, 0, 43.00, 'L-shap', 'North-wing', 'available', 'QR-324234', 'sdfsfsd', '2026-03-07 02:42:57', '2026-03-08 05:48:33', NULL),
(22, '643ff98c-4f28-4ce0-97df-33e89ede7853', 'GHFSD', 0.00, 'residential', 'fsd', 'dsfsdf', 'fdsf', 2, 3, 3, 3, 0, 242.00, 'sdfsd', 'fdsf', 'available', 'fdsfsdfd', 'sdf', '2026-03-07 05:13:06', '2026-03-17 06:32:55', '2026-03-17 06:32:55'),
(23, 'e320d3ff-918d-42f1-b4a4-6b933260d47b', 'HT-32432', 0.00, 'residential', 'J', '50', '1/6', 3, 4, 4, 4, 0, 43.00, 'L-shape', 'North Wing', 'rented', 'QR-232323', 'This is some description', '2026-03-08 02:35:06', '2026-03-08 04:31:43', NULL),
(24, 'f5a70d76-1dd9-4e99-aff8-f2a58a481731', 'HG323', 0.00, 'residential', 'h;', '303', '30', 2, 4, 4, 4, 0, 42.00, 'L-shap', 'Norht wing', 'rented', 'QR-300', 'This is some description', '2026-03-08 03:50:09', '2026-03-08 04:05:11', NULL),
(25, '9938db19-0d24-4fb4-8d9a-b5112d4cde4a', 'GHFHGH1', 0.00, 'residential', 'sdf', '32', '23', 4, 4, 2, 30, 0, 3.00, 'dsf', 'dsfsdf', 'available', 'sdfsdf', NULL, '2026-03-10 06:39:56', '2026-03-10 06:39:56', NULL),
(26, '70b9080c-bde8-4b72-9bc4-26b1291e8b82', 'JUG-999', 0.00, 'residential', 'H', '303', '1/5', 17, 14, 11, 5, 0, 93.00, 'L-shap', 'North Wing', 'sold', 'QR-3030', NULL, '2026-03-18 02:20:38', '2026-03-18 04:58:24', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `apartment_rentals`
--

CREATE TABLE `apartment_rentals` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `rental_id` varchar(255) NOT NULL,
  `apartment_id` bigint(20) UNSIGNED NOT NULL,
  `tenant_id` bigint(20) UNSIGNED NOT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `contract_start` date NOT NULL,
  `contract_end` date DEFAULT NULL,
  `monthly_rent` decimal(14,2) NOT NULL DEFAULT 0.00,
  `advance_months` int(10) UNSIGNED NOT NULL DEFAULT 3,
  `advance_required_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `advance_paid_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `advance_remaining_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `total_paid_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `advance_status` varchar(255) NOT NULL DEFAULT 'pending',
  `next_due_date` date DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'draft',
  `key_handover_status` varchar(255) NOT NULL DEFAULT 'not_handed_over',
  `key_handover_at` timestamp NULL DEFAULT NULL,
  `key_handover_by` bigint(20) UNSIGNED DEFAULT NULL,
  `key_returned_at` timestamp NULL DEFAULT NULL,
  `key_returned_by` bigint(20) UNSIGNED DEFAULT NULL,
  `termination_reason` text DEFAULT NULL,
  `terminated_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `apartment_rentals`
--

INSERT INTO `apartment_rentals` (`id`, `uuid`, `rental_id`, `apartment_id`, `tenant_id`, `created_by`, `contract_start`, `contract_end`, `monthly_rent`, `advance_months`, `advance_required_amount`, `advance_paid_amount`, `advance_remaining_amount`, `total_paid_amount`, `advance_status`, `next_due_date`, `status`, `key_handover_status`, `key_handover_at`, `key_handover_by`, `key_returned_at`, `key_returned_by`, `termination_reason`, `terminated_at`, `created_at`, `updated_at`) VALUES
(17, '4d6f8112-84c9-4fe8-8e2a-f194534052ef', 'RNT-000001', 22, 18, 1, '2026-03-08', NULL, 500.00, 4, 2000.00, 2000.00, 0.00, 4000.00, 'completed', '2026-11-08', 'completed', 'not_handed_over', NULL, NULL, NULL, NULL, NULL, '2026-03-08 05:32:57', '2026-03-08 05:28:17', '2026-03-08 05:32:57'),
(19, 'd14a0546-1f0e-4f66-bffd-52e0226b8b92', 'RNT-000018', 22, 21, 1, '2026-03-08', '2026-10-31', 1000.00, 2, 2000.00, 2000.00, 0.00, 3000.00, 'completed', '2026-06-08', 'completed', 'not_handed_over', NULL, NULL, NULL, NULL, NULL, '2026-03-08 06:10:24', '2026-03-08 05:49:27', '2026-03-08 06:10:24');

-- --------------------------------------------------------

--
-- Table structure for table `apartment_sales`
--

CREATE TABLE `apartment_sales` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `sale_id` varchar(30) DEFAULT NULL,
  `apartment_id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `sale_date` date NOT NULL,
  `total_price` decimal(15,2) NOT NULL,
  `discount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `net_price` decimal(15,2) DEFAULT NULL,
  `actual_net_revenue` decimal(15,2) NOT NULL DEFAULT 0.00,
  `payment_type` enum('full','installment') NOT NULL,
  `frequency_type` varchar(255) DEFAULT NULL,
  `interval_count` int(10) UNSIGNED NOT NULL DEFAULT 1,
  `installment_count` int(10) UNSIGNED DEFAULT NULL,
  `first_due_date` date DEFAULT NULL,
  `custom_dates` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`custom_dates`)),
  `schedule_locked` tinyint(1) NOT NULL DEFAULT 0,
  `schedule_locked_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `deed_status` varchar(30) NOT NULL DEFAULT 'not_issued',
  `deed_issued_at` timestamp NULL DEFAULT NULL,
  `deed_issued_by` bigint(20) UNSIGNED DEFAULT NULL,
  `key_handover_status` varchar(30) NOT NULL DEFAULT 'not_handed_over',
  `key_handover_at` timestamp NULL DEFAULT NULL,
  `key_handover_by` bigint(20) UNSIGNED DEFAULT NULL,
  `possession_start_date` date DEFAULT NULL,
  `vacated_at` date DEFAULT NULL,
  `key_returned_at` timestamp NULL DEFAULT NULL,
  `key_returned_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `apartment_sales`
--

INSERT INTO `apartment_sales` (`id`, `uuid`, `sale_id`, `apartment_id`, `customer_id`, `sale_date`, `total_price`, `discount`, `net_price`, `actual_net_revenue`, `payment_type`, `frequency_type`, `interval_count`, `installment_count`, `first_due_date`, `custom_dates`, `schedule_locked`, `schedule_locked_at`, `approved_at`, `status`, `deed_status`, `deed_issued_at`, `deed_issued_by`, `key_handover_status`, `key_handover_at`, `key_handover_by`, `possession_start_date`, `vacated_at`, `key_returned_at`, `key_returned_by`, `created_at`, `updated_at`, `deleted_at`, `user_id`) VALUES
(20, 'd19107a4-873b-4f3b-aa85-aa04e092763d', 'SAL-000020', 10, 9, '2026-03-03', 5000.00, 0.00, 5000.00, 4200.00, 'installment', 'quarterly', 1, 2, '2026-03-03', '[]', 0, NULL, NULL, 'completed', 'issued', '2026-03-03 03:04:20', 1, 'not_handed_over', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-03 01:59:46', '2026-03-03 03:04:20', NULL, 2),
(21, '552f2d7a-6557-4c85-b533-6821286b8f82', 'SAL-000021', 11, 10, '2026-03-03', 1000.00, 0.00, 1000.00, 840.00, 'installment', 'monthly', 1, 2, '2026-03-03', '[]', 0, NULL, NULL, 'completed', 'issued', '2026-03-07 00:18:07', 1, 'not_handed_over', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-03 03:47:07', '2026-03-07 00:18:07', NULL, 1),
(22, '531b041c-3652-45d3-b987-c34eb9153e4d', 'SAL-000022', 12, 11, '2026-03-03', 2000.00, 0.00, 2000.00, 1980.00, 'installment', 'monthly', 1, 2, '2026-03-03', '[]', 0, NULL, NULL, 'completed', 'not_issued', NULL, NULL, 'handed_over', '2026-03-03 05:28:46', 2, '2026-03-03', NULL, NULL, NULL, '2026-03-03 05:21:29', '2026-03-03 05:34:06', NULL, 2),
(23, 'a6d8b446-492f-4571-83f8-d4fa22a6a3a6', 'SAL-000023', 13, 12, '2026-03-03', 3000.00, 0.00, 3000.00, 2970.00, 'installment', 'monthly', 1, 2, '2026-03-03', '[]', 0, NULL, NULL, 'completed', 'not_issued', NULL, NULL, 'handed_over', '2026-03-03 06:07:51', 1, '2026-03-03', NULL, NULL, NULL, '2026-03-03 05:51:36', '2026-03-03 06:07:51', NULL, 2),
(24, 'f49d0af3-ee37-4da7-bdcd-dd0973051c8e', 'SAL-000024', 14, 13, '2026-03-03', 4000.00, 0.00, 4000.00, 3960.00, 'installment', 'monthly', 1, 1, '2026-03-03', '[]', 0, NULL, NULL, 'completed', 'not_issued', NULL, NULL, 'handed_over', '2026-03-03 06:07:37', 1, '2026-03-03', NULL, NULL, NULL, '2026-03-03 06:06:14', '2026-03-03 06:07:37', NULL, 1),
(25, '83ee1474-7fad-41e7-a1bd-6d5b061be469', 'SAL-000025', 15, 14, '2026-03-03', 5000.00, 0.00, 5000.00, 3283.33, 'installment', 'monthly', 1, 3, '2026-03-03', '[]', 0, NULL, NULL, 'defaulted', 'not_issued', NULL, NULL, 'returned', '2026-03-03 06:28:25', 1, '2026-03-03', '2026-03-03', '2026-03-03 06:34:16', 1, '2026-03-03 06:23:37', '2026-03-03 06:34:16', NULL, 1),
(26, 'c8588204-821e-4f86-ad30-2b9f4a55599b', 'SAL-000026', 16, 14, '2026-03-03', 3000.00, 0.00, 3000.00, 1970.00, 'installment', 'monthly', 1, 3, '2026-03-03', '[]', 0, NULL, NULL, 'terminated', 'not_issued', NULL, NULL, 'returned', '2026-03-03 06:40:15', 1, '2026-03-03', '2026-03-03', '2026-03-03 06:45:13', 1, '2026-03-03 06:36:15', '2026-03-03 06:45:13', NULL, 1),
(27, '4a143194-c729-470b-b895-6bbc5aef4224', 'SAL-000027', 15, 13, '2026-03-03', 5000.00, 0.00, 5000.00, 3283.33, 'installment', 'monthly', 1, 3, '2026-03-03', '[]', 0, NULL, NULL, 'terminated', 'not_issued', NULL, NULL, 'not_handed_over', NULL, NULL, NULL, '2026-03-04', NULL, NULL, '2026-03-03 06:52:25', '2026-03-04 00:49:03', NULL, 1),
(28, '004845e5-f4f6-4c0f-bd8f-957441b6d887', 'SAL-000028', 16, 14, '2026-03-03', 3000.00, 0.00, 3000.00, 2520.00, 'installment', 'monthly', 1, 3, '2026-03-03', '[]', 0, NULL, NULL, 'completed', 'issued', '2026-03-03 07:13:23', 1, 'handed_over', '2026-03-03 07:07:40', 1, '2026-03-03', NULL, NULL, NULL, '2026-03-03 07:06:04', '2026-03-03 07:13:23', NULL, 1),
(29, '57c63d0a-1805-4df9-b726-a35996888aa7', 'SAL-000029', 15, 15, '2026-03-04', 3000.00, 0.00, 3000.00, 970.00, 'installment', 'monthly', 1, 3, '2026-03-04', '[]', 0, NULL, NULL, 'defaulted', 'not_issued', NULL, NULL, 'returned', '2026-03-04 00:53:01', 1, '2026-03-04', '2026-03-04', '2026-03-04 00:58:08', 1, '2026-03-04 00:50:19', '2026-03-04 02:34:34', NULL, 1),
(30, '7b66080c-465f-411d-a047-daf0074f3670', 'SAL-000030', 17, 16, '2026-03-04', 3000.00, 0.00, 3000.00, 2520.00, 'installment', 'monthly', 1, 3, '2026-03-04', '[]', 0, NULL, NULL, 'completed', 'issued', '2026-03-04 03:01:14', 1, 'handed_over', '2026-03-04 02:39:24', 1, '2026-03-04', NULL, NULL, NULL, '2026-03-04 02:27:02', '2026-03-04 03:01:14', NULL, 1),
(31, '7a2d3b4d-6299-4422-8549-472a75dd9775', 'SAL-000031', 15, 9, '2026-03-04', 3000.00, 0.00, 3000.00, 2520.00, 'installment', 'monthly', 1, 3, '2026-03-04', '[]', 0, NULL, NULL, 'completed', 'issued', '2026-03-04 05:40:07', 1, 'handed_over', '2026-03-04 05:29:38', 1, '2026-03-04', NULL, NULL, NULL, '2026-03-04 05:01:32', '2026-03-04 05:40:07', NULL, 1),
(32, '2f5683ed-a19a-43d9-b58b-f357b672ef35', 'SAL-000032', 18, 15, '2026-03-04', 4000.00, 0.00, 4000.00, 3360.00, 'installment', 'monthly', 1, 4, '2026-03-04', '[]', 0, NULL, NULL, 'completed', 'issued', '2026-03-04 05:52:27', 1, 'not_handed_over', NULL, NULL, NULL, NULL, NULL, NULL, '2026-03-04 05:44:06', '2026-03-04 05:52:27', NULL, 2),
(35, '5301de91-a262-43ae-806f-1516d374ddaf', 'SAL-000035', 21, 22, '2026-03-07', 3000.00, 0.00, 3000.00, 0.00, 'installment', 'monthly', 1, 3, '2026-03-07', '[]', 0, NULL, NULL, 'terminated', 'not_issued', NULL, NULL, 'not_handed_over', NULL, NULL, NULL, '2026-03-08', NULL, NULL, '2026-03-07 02:45:13', '2026-03-08 06:12:44', NULL, 1),
(36, 'b2e7e63b-5c88-4a70-952b-36bbebd4f262', 'SAL-000036', 22, 21, '2026-03-07', 3000.00, 0.00, 3000.00, 1970.00, 'installment', 'monthly', 1, 3, '2026-03-07', '[]', 0, NULL, NULL, 'terminated', 'not_issued', NULL, NULL, 'not_handed_over', NULL, NULL, NULL, '2026-03-08', NULL, NULL, '2026-03-07 05:13:58', '2026-03-08 06:12:51', NULL, 1),
(37, 'fdcd9b8f-b2f6-4553-89fd-f1d6861233fb', 'SAL-000037', 26, 25, '2026-03-18', 3000.00, 0.00, 3000.00, 2520.00, 'installment', 'monthly', 1, 3, '2026-03-19', '[]', 0, NULL, NULL, 'completed', 'issued', '2026-03-18 04:58:24', 1, 'handed_over', '2026-03-18 04:30:37', 1, '2026-03-18', NULL, NULL, NULL, '2026-03-18 02:24:59', '2026-03-18 04:58:24', NULL, 12);

-- --------------------------------------------------------

--
-- Table structure for table `apartment_sale_financials`
--

CREATE TABLE `apartment_sale_financials` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `apartment_sale_id` bigint(20) UNSIGNED NOT NULL,
  `accounts_status` varchar(100) NOT NULL DEFAULT 'open',
  `municipality_share_15` decimal(15,2) NOT NULL DEFAULT 0.00,
  `delivered_to_municipality` decimal(15,2) NOT NULL DEFAULT 0.00,
  `remaining_municipality` decimal(15,2) NOT NULL DEFAULT 0.00,
  `company_share_85` decimal(15,2) NOT NULL DEFAULT 0.00,
  `delivered_to_company` decimal(15,2) NOT NULL DEFAULT 0.00,
  `rahnama_fee_1` decimal(15,2) NOT NULL DEFAULT 0.00,
  `customer_debt` decimal(15,2) NOT NULL DEFAULT 0.00,
  `discount_or_contractor_deduction` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `apartment_sale_financials`
--

INSERT INTO `apartment_sale_financials` (`id`, `uuid`, `apartment_sale_id`, `accounts_status`, `municipality_share_15`, `delivered_to_municipality`, `remaining_municipality`, `company_share_85`, `delivered_to_company`, `rahnama_fee_1`, `customer_debt`, `discount_or_contractor_deduction`, `created_at`, `updated_at`) VALUES
(12, 'd19107a4-873b-4f3b-aa85-aa04e092763d', 20, 'open', 750.00, 750.00, 0.00, 4250.00, 0.00, 50.00, 0.00, 0.00, '2026-03-03 01:59:46', '2026-03-03 02:53:08'),
(13, '552f2d7a-6557-4c85-b533-6821286b8f82', 21, 'open', 150.00, 150.00, 0.00, 850.00, 0.00, 10.00, 0.00, 0.00, '2026-03-03 03:47:07', '2026-03-03 04:10:18'),
(14, '531b041c-3652-45d3-b987-c34eb9153e4d', 22, 'open', 300.00, 0.00, 300.00, 1700.00, 0.00, 20.00, 0.00, 0.00, '2026-03-03 05:21:29', '2026-03-03 05:34:06'),
(15, 'a6d8b446-492f-4571-83f8-d4fa22a6a3a6', 23, 'open', 450.00, 0.00, 450.00, 2550.00, 0.00, 30.00, 0.00, 0.00, '2026-03-03 05:51:36', '2026-03-03 05:55:59'),
(16, 'f49d0af3-ee37-4da7-bdcd-dd0973051c8e', 24, 'open', 600.00, 0.00, 600.00, 3400.00, 0.00, 40.00, 0.00, 0.00, '2026-03-03 06:06:14', '2026-03-03 06:07:01'),
(17, '83ee1474-7fad-41e7-a1bd-6d5b061be469', 25, 'open', 750.00, 0.00, 750.00, 4250.00, 0.00, 50.00, 1666.67, 0.00, '2026-03-03 06:23:37', '2026-03-03 06:28:06'),
(18, 'c8588204-821e-4f86-ad30-2b9f4a55599b', 26, 'open', 450.00, 0.00, 450.00, 2550.00, 0.00, 30.00, 1000.00, 0.00, '2026-03-03 06:36:15', '2026-03-03 06:38:29'),
(19, '4a143194-c729-470b-b895-6bbc5aef4224', 27, 'open', 750.00, 0.00, 750.00, 4250.00, 0.00, 50.00, 1666.67, 0.00, '2026-03-03 06:52:25', '2026-03-03 06:59:57'),
(20, '004845e5-f4f6-4c0f-bd8f-957441b6d887', 28, 'open', 450.00, 450.00, 0.00, 2550.00, 0.00, 30.00, 0.00, 0.00, '2026-03-03 07:06:04', '2026-03-03 07:12:27'),
(21, '57c63d0a-1805-4df9-b726-a35996888aa7', 29, 'open', 450.00, 0.00, 450.00, 2550.00, 0.00, 30.00, 2000.00, 0.00, '2026-03-04 00:50:19', '2026-03-04 00:52:30'),
(22, '7b66080c-465f-411d-a047-daf0074f3670', 30, 'open', 450.00, 450.00, 0.00, 2550.00, 0.00, 30.00, 0.00, 0.00, '2026-03-04 02:27:02', '2026-03-04 02:58:25'),
(23, '7a2d3b4d-6299-4422-8549-472a75dd9775', 31, 'open', 450.00, 450.00, 0.00, 2550.00, 0.00, 30.00, 0.00, 0.00, '2026-03-04 05:01:33', '2026-03-04 05:12:04'),
(24, '2f5683ed-a19a-43d9-b58b-f357b672ef35', 32, 'open', 600.00, 600.00, 0.00, 3400.00, 0.00, 40.00, 0.00, 0.00, '2026-03-04 05:44:06', '2026-03-04 05:48:03'),
(27, '5301de91-a262-43ae-806f-1516d374ddaf', 35, 'open', 450.00, 0.00, 450.00, 2550.00, 0.00, 30.00, 3000.00, 0.00, '2026-03-07 02:45:14', '2026-03-07 02:45:14'),
(28, 'b2e7e63b-5c88-4a70-952b-36bbebd4f262', 36, 'open', 450.00, 0.00, 450.00, 2550.00, 0.00, 30.00, 1000.00, 0.00, '2026-03-07 05:13:58', '2026-03-08 00:14:14'),
(29, 'fdcd9b8f-b2f6-4553-89fd-f1d6861233fb', 37, 'open', 450.00, 450.00, 0.00, 2550.00, 0.00, 30.00, 0.00, 0.00, '2026-03-18 02:25:02', '2026-03-18 04:37:42');

-- --------------------------------------------------------

--
-- Table structure for table `apartment_sale_possession_logs`
--

CREATE TABLE `apartment_sale_possession_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `apartment_sale_id` bigint(20) UNSIGNED NOT NULL,
  `action` varchar(30) NOT NULL,
  `action_date` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `note` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `apartment_sale_possession_logs`
--

INSERT INTO `apartment_sale_possession_logs` (`id`, `uuid`, `apartment_sale_id`, `action`, `action_date`, `user_id`, `note`, `created_at`, `updated_at`) VALUES
(1, '8573b417-4375-4033-8734-0ab0b4fc3f96', 22, 'key_handover', '2026-03-03 05:28:46', 2, 'Key handed over after payment eligibility check.', '2026-03-03 05:28:46', '2026-03-03 05:28:46'),
(2, 'f12a015f-d5e7-42af-8dd3-ca5d29d6e463', 24, 'key_handover', '2026-03-03 06:07:37', 1, 'Key handed over after payment eligibility check.', '2026-03-03 06:07:37', '2026-03-03 06:07:37'),
(3, '04adf799-b82c-4ea1-8eef-721c2da5eb32', 23, 'key_handover', '2026-03-03 06:07:51', 1, 'Key handed over after payment eligibility check.', '2026-03-03 06:07:51', '2026-03-03 06:07:51'),
(4, '706209c8-1c34-4755-884a-7add14035e30', 25, 'key_handover', '2026-03-03 06:28:25', 1, 'Key handed over after payment eligibility check.', '2026-03-03 06:28:25', '2026-03-03 06:28:25'),
(5, 'a47c0955-fb1c-417c-8c1d-7c9e2518b9c5', 25, 'terminated', '2026-03-03 06:34:16', 1, 'customer due', '2026-03-03 06:34:16', '2026-03-03 06:34:16'),
(6, '7ac1f3ed-b989-4d8d-a7fb-34d68fa6750a', 25, 'key_return', '2026-03-03 06:34:16', 1, 'Key returned during sale termination/default.', '2026-03-03 06:34:16', '2026-03-03 06:34:16'),
(7, 'dbe01319-cf5a-4e24-87e7-672a426ff6f8', 26, 'key_handover', '2026-03-03 06:40:15', 1, 'Key handed over after payment eligibility check.', '2026-03-03 06:40:15', '2026-03-03 06:40:15'),
(8, 'e1c05401-8fd3-4c94-80e3-c6257ea8e464', 26, 'terminated', '2026-03-03 06:45:13', 1, 'teacher higher', '2026-03-03 06:45:13', '2026-03-03 06:45:13'),
(9, '651164cc-5aeb-40e4-924c-e8f18d47c47f', 26, 'key_return', '2026-03-03 06:45:13', 1, 'Key returned during sale termination/default.', '2026-03-03 06:45:13', '2026-03-03 06:45:13'),
(10, '993d63ff-32e7-492e-8688-fe3e5cf89c00', 28, 'key_handover', '2026-03-03 07:07:40', 1, 'Key handed over after payment eligibility check.', '2026-03-03 07:07:40', '2026-03-03 07:07:40'),
(11, '61c5cebc-bf1d-434f-82e3-3a4d15c66fef', 27, 'terminated', '2026-03-04 00:49:07', 1, 'custome due date is not payment', '2026-03-04 00:49:07', '2026-03-04 00:49:07'),
(12, '9b478705-beab-4e78-bf50-57843766531f', 29, 'key_handover', '2026-03-04 00:53:01', 1, 'Key handed over after payment eligibility check.', '2026-03-04 00:53:01', '2026-03-04 00:53:01'),
(13, 'da45ce5b-ebf6-4965-863c-43b7a3630bda', 29, 'terminated', '2026-03-04 00:58:08', 1, 'customer do noy observe the rules and regulation', '2026-03-04 00:58:08', '2026-03-04 00:58:08'),
(14, 'c33b1971-bfd4-4f2e-bd2b-756ca3dd86ae', 29, 'key_return', '2026-03-04 00:58:08', 1, 'Key returned during sale termination/default.', '2026-03-04 00:58:08', '2026-03-04 00:58:08'),
(15, 'ca4d7ec6-a336-4624-924f-0d84fc48d49f', 30, 'key_handover', '2026-03-04 02:39:24', 1, 'Key handed over after payment eligibility check.', '2026-03-04 02:39:24', '2026-03-04 02:39:24'),
(16, '0a9eb230-881f-4fe6-927a-9bd811253508', 31, 'key_handover', '2026-03-04 05:29:38', 1, 'Key handed over after payment eligibility check.', '2026-03-04 05:29:38', '2026-03-04 05:29:38'),
(18, 'fd31f62e-fd88-442b-a8a6-82d63c9db73d', 35, 'terminated', '2026-03-08 06:12:44', 1, 'gh', '2026-03-08 06:12:44', '2026-03-08 06:12:44'),
(19, '2ed33308-730d-42c8-a5e6-cd9ede85df33', 36, 'terminated', '2026-03-08 06:12:51', 1, 'sdf', '2026-03-08 06:12:51', '2026-03-08 06:12:51'),
(20, 'dcecfdde-b38e-4a67-8e86-c0477e781b95', 37, 'key_handover', '2026-03-18 04:30:37', 1, 'Key handed over after payment eligibility check.', '2026-03-18 04:30:37', '2026-03-18 04:30:37');

-- --------------------------------------------------------

--
-- Table structure for table `apartment_sale_terminations`
--

CREATE TABLE `apartment_sale_terminations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `apartment_sale_id` bigint(20) UNSIGNED NOT NULL,
  `reason` text DEFAULT NULL,
  `termination_charge` decimal(15,2) NOT NULL DEFAULT 0.00,
  `refund_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `remaining_debt_after_termination` decimal(15,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `apartment_sale_terminations`
--

INSERT INTO `apartment_sale_terminations` (`id`, `apartment_sale_id`, `reason`, `termination_charge`, `refund_amount`, `remaining_debt_after_termination`, `created_at`, `updated_at`) VALUES
(1, 25, 'customer due', 50000.00, 0.00, 5000.00, '2026-03-03 06:23:37', '2026-03-03 06:34:16'),
(2, 26, 'teacher higher', 3000.00, 0.00, 3000.00, '2026-03-03 06:36:15', '2026-03-03 06:45:13'),
(3, 27, 'custome due date is not payment', 200.00, 0.00, 1866.67, '2026-03-03 06:52:25', '2026-03-04 00:49:03'),
(4, 29, 'customer do noy observe the rules and regulation', 200.00, 0.00, 2200.00, '2026-03-04 00:50:19', '2026-03-04 00:58:08'),
(5, 35, 'gh', 0.00, 0.00, 3000.00, '2026-03-08 06:12:44', '2026-03-08 06:12:44'),
(6, 36, 'sdf', 0.00, 0.00, 1000.00, '2026-03-08 06:12:51', '2026-03-08 06:12:51');

-- --------------------------------------------------------

--
-- Table structure for table `approvals`
--

CREATE TABLE `approvals` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `module` varchar(255) NOT NULL,
  `reference_id` bigint(20) UNSIGNED NOT NULL,
  `requested_by` bigint(20) UNSIGNED NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'pending',
  `resolved_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `approval_logs`
--

CREATE TABLE `approval_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `approval_id` bigint(20) UNSIGNED NOT NULL,
  `approved_by` bigint(20) UNSIGNED NOT NULL,
  `action` varchar(255) NOT NULL,
  `remarks` text DEFAULT NULL,
  `action_date` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `asset_assignments`
--

CREATE TABLE `asset_assignments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `asset_id` bigint(20) UNSIGNED NOT NULL,
  `asset_request_id` bigint(20) UNSIGNED DEFAULT NULL,
  `project_id` bigint(20) UNSIGNED DEFAULT NULL,
  `employee_id` bigint(20) UNSIGNED DEFAULT NULL,
  `assigned_date` date NOT NULL,
  `return_date` date DEFAULT NULL,
  `status` varchar(40) NOT NULL DEFAULT 'active',
  `condition_on_issue` varchar(255) DEFAULT NULL,
  `condition_on_return` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `asset_requests`
--

CREATE TABLE `asset_requests` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `request_no` varchar(255) NOT NULL,
  `project_id` bigint(20) UNSIGNED DEFAULT NULL,
  `requested_by_employee_id` bigint(20) UNSIGNED NOT NULL,
  `requested_asset_id` bigint(20) UNSIGNED DEFAULT NULL,
  `asset_type` varchar(50) DEFAULT NULL,
  `status` varchar(40) NOT NULL DEFAULT 'pending',
  `reason` text DEFAULT NULL,
  `approved_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `allocated_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `allocated_at` timestamp NULL DEFAULT NULL,
  `allocation_receipt_no` varchar(255) DEFAULT NULL,
  `requested_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cache`
--

CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cache_locks`
--

CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `company_assets`
--

CREATE TABLE `company_assets` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `asset_code` varchar(255) NOT NULL,
  `asset_name` varchar(255) NOT NULL,
  `asset_type` varchar(50) NOT NULL,
  `supplier_id` bigint(20) UNSIGNED DEFAULT NULL,
  `serial_no` varchar(100) DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'available',
  `current_employee_id` bigint(20) UNSIGNED DEFAULT NULL,
  `current_project_id` bigint(20) UNSIGNED DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `company_assets`
--

INSERT INTO `company_assets` (`id`, `uuid`, `asset_code`, `asset_name`, `asset_type`, `supplier_id`, `serial_no`, `status`, `current_employee_id`, `current_project_id`, `notes`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, '1bef1177-e2cf-40a0-ab59-9acbc915bd4b', 'GH23', 'Laptop', 'IT', 1, 'GH3223', 'available', 5, 1, 'dfsfsdfsdf', '2026-03-24 06:49:39', '2026-03-24 06:49:39', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `crm_messages`
--

CREATE TABLE `crm_messages` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `installment_id` bigint(20) UNSIGNED DEFAULT NULL,
  `channel` varchar(20) NOT NULL,
  `message_type` varchar(120) NOT NULL,
  `sent_at` datetime DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'queued',
  `error_message` varchar(500) DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `crm_messages`
--

INSERT INTO `crm_messages` (`id`, `customer_id`, `installment_id`, `channel`, `message_type`, `sent_at`, `status`, `error_message`, `metadata`, `created_at`, `updated_at`) VALUES
(25, 22, NULL, 'email', 'installment_due', '2026-03-07 09:58:38', 'sent', NULL, NULL, '2026-03-07 05:28:38', '2026-03-07 05:28:38'),
(26, 22, 72, 'email', 'installment_due_reminder', '2026-03-07 10:02:59', 'sent', NULL, '{\"sale_uuid\":\"5301de91-a262-43ae-806f-1516d374ddaf\",\"sale_id\":\"SAL-000035\",\"installment_uuid\":\"a492ed04-ca58-4817-94d2-7861a524c1c3\",\"installment_no\":1,\"due_date\":\"2026-03-07\",\"days_left\":0,\"remaining_amount\":1000}', '2026-03-07 05:32:59', '2026-03-07 05:32:59'),
(27, 22, 72, 'sms', 'installment_due_reminder', '2026-03-07 10:03:00', 'sent', NULL, '{\"sale_uuid\":\"5301de91-a262-43ae-806f-1516d374ddaf\",\"sale_id\":\"SAL-000035\",\"installment_uuid\":\"a492ed04-ca58-4817-94d2-7861a524c1c3\",\"installment_no\":1,\"due_date\":\"2026-03-07\",\"days_left\":0,\"remaining_amount\":1000}', '2026-03-07 05:33:00', '2026-03-07 05:33:00'),
(28, 21, 75, 'email', 'installment_due_reminder', '2026-03-07 10:03:01', 'sent', NULL, '{\"sale_uuid\":\"b2e7e63b-5c88-4a70-952b-36bbebd4f262\",\"sale_id\":\"SAL-000036\",\"installment_uuid\":\"4249de00-b6ae-48ea-86f7-1f48fa7b39ab\",\"installment_no\":1,\"due_date\":\"2026-03-07\",\"days_left\":0,\"remaining_amount\":1000}', '2026-03-07 05:33:01', '2026-03-07 05:33:01'),
(29, 21, 75, 'sms', 'installment_due_reminder', '2026-03-07 10:03:02', 'sent', NULL, '{\"sale_uuid\":\"b2e7e63b-5c88-4a70-952b-36bbebd4f262\",\"sale_id\":\"SAL-000036\",\"installment_uuid\":\"4249de00-b6ae-48ea-86f7-1f48fa7b39ab\",\"installment_no\":1,\"due_date\":\"2026-03-07\",\"days_left\":0,\"remaining_amount\":1000}', '2026-03-07 05:33:02', '2026-03-07 05:33:02'),
(30, 22, NULL, 'sms', 'installment_due', '2026-03-07 10:20:49', 'sent', NULL, NULL, '2026-03-07 05:50:49', '2026-03-07 05:50:49'),
(31, 21, NULL, 'sms', 'installment_due', '2026-03-07 10:22:01', 'sent', NULL, NULL, '2026-03-07 05:52:01', '2026-03-07 05:52:01'),
(32, 21, NULL, 'email', 'installment_due', '2026-03-08 04:28:38', 'sent', NULL, NULL, '2026-03-07 23:58:38', '2026-03-07 23:58:38'),
(33, 22, NULL, 'email', 'installment_due', '2026-03-08 04:29:02', 'sent', NULL, NULL, '2026-03-07 23:59:02', '2026-03-07 23:59:02');

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `fname` varchar(255) DEFAULT NULL,
  `gname` varchar(255) DEFAULT NULL,
  `phone` varchar(255) NOT NULL,
  `phone1` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `status` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `uuid`, `name`, `fname`, `gname`, `phone`, `phone1`, `email`, `address`, `status`, `created_at`, `updated_at`, `deleted_at`) VALUES
(9, 'e8b3e9cd-37a6-4fda-9723-0c94a3ea3c09', 'Ahmad', 'sfdf', 'dsfsd', '33232', '32332', 'ahmad@gmail.com', 'sdfsdfsdfsdfsdf', 'Active', '2026-03-03 01:54:53', '2026-03-03 01:54:53', NULL),
(10, '40043aab-5d29-4e57-94af-4b8d13b6a83c', 'karim', 'kairm', 'karim', '32323', '2432', 'karim@gmail.com', 'dfsdfsdfd', 'Active', '2026-03-03 03:44:51', '2026-03-03 03:44:51', NULL),
(11, '2b66937b-776d-4839-8d61-9c1438ed52b9', 'Tahir', 'khan', 'khan', '32323423423423', '757732323', 'tahir@gmail.com', 'fdfsdf', 'Active', '2026-03-03 05:20:07', '2026-03-03 05:20:07', NULL),
(12, '4d37df40-b370-453f-beaf-c2b0fd716383', 'wahid', 'wahid', 'wahidullah', '47474747437474734743', '43400000', 'wahidullah@gmail.com', 'this is some description', 'Active', '2026-03-03 05:49:34', '2026-03-03 05:49:34', NULL),
(13, 'f931546c-3715-4f54-8e00-2d5fa0c48b08', 'wasim', 'wasim', 'wasime', '3993232', '32323423423423', 'wasim@gmail.com', 'this is', 'Active', '2026-03-03 05:50:48', '2026-03-03 05:50:48', NULL),
(14, '66d2c56a-7f82-49c9-974e-ccef3c513900', 'example', 'ex', 'e', '123123131312', '123', 'example@gmail.com', 'this is problimer', 'Active', '2026-03-03 06:22:09', '2026-03-03 06:22:09', NULL),
(15, '0cab184b-87f0-41c1-a6fe-f0b1f24d663b', 'example2', 'ex', 'ex', '332221', '33032323232', 'example2@gmail.com', 'sddfd', 'Active', '2026-03-03 06:32:35', '2026-03-03 06:32:35', NULL),
(16, '56a1d03c-4270-4cd3-b273-05156aab45be', 'example3', 'e', 'e', '322232323242342423423423423', '24232434664564', 'example3@gmail.com', 'this is some description', 'Active', '2026-03-04 02:25:34', '2026-03-04 02:25:34', NULL),
(17, 'a507e74b-dfea-4242-a49b-6ba32b44df9a', 'example4', '3232', 'emapl', '32323423423u3283', '212312312312', 'example4@gmail.com', 'this is some description', 'Active', '2026-03-04 06:35:51', '2026-03-04 06:35:51', NULL),
(18, 'e9156aa9-c623-4e9d-a39a-d55ca9d0f7c4', 'example5', 'example5', 'example5', '323232322323', '323232342312', 'example5@gmail.com', 'This is some description', 'Active', '2026-03-07 00:04:05', '2026-03-07 00:04:05', NULL),
(19, '5e4390c8-2490-4dc6-91e0-270cdefa85ee', 'examle6', 'exmaple', 'eaml', '322322323030020', '1230122312', 'example6@gmail.com', NULL, 'Active', '2026-03-07 01:51:29', '2026-03-07 01:51:29', NULL),
(20, 'a607c2ec-2a22-4fe1-81ac-5d40d79db4ed', 'example7', 'example', 'ef', '212312309013', '32399311', 'example7@gmail.com', NULL, 'Active', '2026-03-07 02:13:40', '2026-03-07 02:13:40', NULL),
(21, '9461f2b3-dd8d-49f1-82c0-1060e10aad58', 'Hellal', 'Jan', 'Jan', '+93780994787', '+93780994787', 'hellal@gmail.com', 'sdfsdfsdf', 'Active', '2026-03-07 02:16:29', '2026-03-07 05:13:06', NULL),
(22, 'b962f762-4196-4f0e-8fa5-0efdc67a2c27', 'yaftomict', 'yaftom', 'yafotmt', '+93 79 583 7253', '+93 79 583 7253', 'yaftomict@gmail.com', 'This is description', 'Active', '2026-03-07 02:42:21', '2026-03-07 02:42:21', NULL),
(23, '60ef4390-ece7-434e-8c65-e485ed7b4646', 'example8', 'exmaple', 'example', '332323131231', '12312399323212312312313', 'example8@gmail.com', 'this is some d escrpiton', 'Active', '2026-03-08 02:34:29', '2026-03-08 02:34:29', NULL),
(24, '25f4c34b-931a-49a6-a1a5-1e12054c80bb', 'Romal', 'Khan', 'Akabar', '+93789647997', '+93789647997', 'romalakbari93@gmail.com', 'sdfsd', 'Active', '2026-03-09 06:19:05', '2026-03-09 06:19:05', NULL),
(25, '410697a8-f3ab-4a8e-801a-78184b2b0199', 'customer', NULL, NULL, '2323232', '32423423423', 'customer@gmail.com', 'This is some descriptoin', 'Active', '2026-03-18 02:19:41', '2026-03-18 02:19:41', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `documents`
--

CREATE TABLE `documents` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `module` varchar(50) NOT NULL,
  `document_type` varchar(60) DEFAULT NULL,
  `reference_id` bigint(20) UNSIGNED NOT NULL,
  `file_path` varchar(1024) NOT NULL,
  `expiry_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `documents`
--

INSERT INTO `documents` (`id`, `module`, `document_type`, `reference_id`, `file_path`, `expiry_date`, `created_at`) VALUES
(7, 'customer', NULL, 23, 'documents/customers/1DfgC18rD7RVGRrVqJGGqDqGwUXGD2jqNjYLqSd9.jpg', NULL, '2026-03-09 05:54:30'),
(8, 'customer', NULL, 24, 'documents/customers/qmE3uwuw9RNxovsokQq6SVDK8qrPag16jchsEPme.jpg', NULL, '2026-03-09 06:19:05'),
(12, 'customer', 'customer_deed_document', 9, 'documents/customer/deed_templatejpg_20260309_111002.jpeg', NULL, '2026-03-09 06:40:02'),
(14, 'customer', 'customer_image', 9, 'documents/customers/geuMopLrnA1di0CVwBelNm05aqOlerrjgPayG8LD.png', NULL, '2026-03-09 06:53:28'),
(17, 'customer', 'customer_image', 24, 'documents/customers/2tsODeMoYHY8u1uQeTm7PKKXLsHhM66E4euQmMHe.png', NULL, '2026-03-10 00:32:47');

-- --------------------------------------------------------

--
-- Table structure for table `employees`
--

CREATE TABLE `employees` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `first_name` varchar(255) DEFAULT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `job_title` varchar(255) DEFAULT NULL,
  `salary_type` varchar(255) DEFAULT NULL,
  `base_salary` varchar(255) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `hire_date` datetime NOT NULL DEFAULT current_timestamp(),
  `status` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `employees`
--

INSERT INTO `employees` (`id`, `uuid`, `first_name`, `last_name`, `job_title`, `salary_type`, `base_salary`, `address`, `email`, `phone`, `hire_date`, `status`, `created_at`, `updated_at`, `deleted_at`) VALUES
(5, 'e32bc0f9-6de1-4f2c-b75c-265f67df6c78', 'Ahmad', 'Khan', 'Manager', 'monthly', '20000', 'Kabul', 'ahmad@example.com', '0700000001', '2026-03-16 07:20:21', 'active', '2026-03-16 02:50:21', '2026-03-16 02:50:21', NULL),
(6, '7d0e3dbf-875f-4e6b-804e-4973a7fc37d7', 'Ali', 'Ahmadi', 'Accountant', 'monthly', '15000', 'Herat', 'ali@example.com', '0700000002', '2026-03-16 07:20:21', 'active', '2026-03-16 02:50:21', '2026-03-16 02:50:21', NULL),
(8, 'ce23dbf7-3a20-435b-b278-3beed58aa683', 'Mahmood', 'khann', 'Marketer', 'fixed', '3000', 'kabul,afghanistan', 'mahmod@gmail.com', NULL, '2026-03-16 14:53:20', 'active', '2026-03-16 05:53:20', '2026-03-16 05:53:20', NULL),
(9, 'b9d097db-53f5-4452-a985-40edbb200784', 'wali', 'khans', 'Fire Fighter', 'fixed', '4000', 'kabul,afghanistan', 'wali@gmail.com', NULL, '2026-03-16 14:57:09', 'active', '2026-03-16 05:57:09', '2026-03-18 06:21:39', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `failed_jobs`
--

CREATE TABLE `failed_jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `installments`
--

CREATE TABLE `installments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `apartment_sale_id` bigint(20) UNSIGNED NOT NULL,
  `installment_no` int(11) NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `due_date` date NOT NULL,
  `paid_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `paid_date` date DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `installments`
--

INSERT INTO `installments` (`id`, `uuid`, `apartment_sale_id`, `installment_no`, `amount`, `due_date`, `paid_amount`, `paid_date`, `status`, `created_at`, `updated_at`) VALUES
(32, 'ec784d88-369e-4d5a-89c7-223d31ebd4d2', 20, 1, 2500.00, '2026-03-03', 2500.00, '2026-03-03', 'paid', '2026-03-03 01:59:46', '2026-03-03 02:53:05'),
(33, 'bcc790ac-fba0-4958-85ba-1701ce39264a', 20, 2, 2500.00, '2026-06-03', 2500.00, '2026-03-03', 'paid', '2026-03-03 01:59:46', '2026-03-03 02:53:08'),
(34, 'b7e1e83d-28f1-43b7-bc86-f2cf388e7aa4', 21, 1, 500.00, '2026-03-03', 500.00, '2026-03-03', 'paid', '2026-03-03 03:47:07', '2026-03-03 04:10:14'),
(35, '7c2371e7-a6e3-4e0d-9613-13ed2331183f', 21, 2, 500.00, '2026-04-03', 500.00, '2026-03-03', 'paid', '2026-03-03 03:47:07', '2026-03-03 04:10:18'),
(36, 'ec7c3015-2739-47cf-bdc2-c40f0a1eb093', 22, 1, 1000.00, '2026-03-03', 1000.00, '2026-03-03', 'paid', '2026-03-03 05:21:29', '2026-03-03 05:24:56'),
(37, '0fb922e9-cd5a-47f2-ba80-027fedbc9c83', 22, 2, 1000.00, '2026-04-03', 1000.00, '2026-03-03', 'paid', '2026-03-03 05:21:29', '2026-03-03 05:34:06'),
(38, '7640afa6-75ac-42e1-8512-29f6b7e5b253', 23, 1, 1500.00, '2026-03-03', 1500.00, '2026-03-03', 'paid', '2026-03-03 05:51:36', '2026-03-03 05:55:59'),
(39, 'dad84a63-169a-4dfd-a5b8-4f8ae6c9cca9', 23, 2, 1500.00, '2026-04-03', 1500.00, '2026-03-03', 'paid', '2026-03-03 05:51:36', '2026-03-03 05:52:54'),
(40, '5ff33e3c-0bd6-4744-bc46-ead78f4ef679', 24, 1, 4000.00, '2026-03-03', 4000.00, '2026-03-03', 'paid', '2026-03-03 06:06:14', '2026-03-03 06:07:01'),
(41, '907e273d-7f46-419b-ae3f-f731685bf836', 25, 1, 1666.67, '2026-03-03', 1666.67, '2026-03-03', 'paid', '2026-03-03 06:23:37', '2026-03-03 06:28:06'),
(42, '0489a49d-7e1c-4c33-af72-c76ccb2e6484', 25, 2, 1666.67, '2026-04-03', 0.00, NULL, 'cancelled', '2026-03-03 06:23:37', '2026-03-03 06:34:16'),
(43, 'f2bb1034-68db-4e67-a060-0074b563177b', 25, 3, 1666.66, '2026-05-03', 1666.66, '2026-03-03', 'paid', '2026-03-03 06:23:37', '2026-03-03 06:24:10'),
(44, '2a34178c-b42e-483d-9484-647e86131b2a', 26, 1, 1000.00, '2026-03-03', 1000.00, '2026-03-03', 'paid', '2026-03-03 06:36:15', '2026-03-03 06:38:29'),
(45, '1340bb47-9bc6-4a6e-a750-657a28cb7cdc', 26, 2, 1000.00, '2026-04-03', 0.00, NULL, 'cancelled', '2026-03-03 06:36:15', '2026-03-03 06:45:13'),
(46, '3ca55611-0767-4aaf-bce7-2eafbec0375e', 26, 3, 1000.00, '2026-05-03', 1000.00, '2026-03-03', 'paid', '2026-03-03 06:36:15', '2026-03-03 06:37:02'),
(47, '235021ea-9965-45c2-906f-d5018b29be19', 27, 1, 1666.67, '2026-03-03', 0.00, NULL, 'cancelled', '2026-03-03 06:52:25', '2026-03-04 00:49:04'),
(48, '389c3c04-7cc2-439d-8266-990224456b66', 27, 2, 1666.67, '2026-04-03', 1666.67, '2026-03-03', 'paid', '2026-03-03 06:52:25', '2026-03-03 06:59:57'),
(49, 'bceb3f0b-7ace-4e7b-9fb3-73c33eb83bc1', 27, 3, 1666.66, '2026-05-03', 1666.66, '2026-03-03', 'paid', '2026-03-03 06:52:25', '2026-03-03 06:53:13'),
(50, '06decfb7-a2af-49c9-ae3c-c5f489d2e986', 28, 1, 1000.00, '2026-03-03', 1000.00, '2026-03-03', 'paid', '2026-03-03 07:06:04', '2026-03-03 07:08:15'),
(51, 'bb5ccb86-b418-445c-a8c9-342a26843335', 28, 2, 1000.00, '2026-04-03', 1000.00, '2026-03-03', 'paid', '2026-03-03 07:06:04', '2026-03-03 07:07:21'),
(52, '616eebbf-23ea-4182-99b2-a0d127ea9f60', 28, 3, 1000.00, '2026-05-03', 1000.00, '2026-03-03', 'paid', '2026-03-03 07:06:04', '2026-03-03 07:08:03'),
(53, '476d23c7-b7c4-4def-9a44-ac04c6832db2', 29, 1, 1000.00, '2026-03-04', 1000.00, '2026-03-04', 'paid', '2026-03-04 00:50:19', '2026-03-04 00:52:30'),
(54, '2b99f23c-6010-4f00-a08f-2e2ae2139a9e', 29, 2, 1000.00, '2026-04-04', 0.00, NULL, 'cancelled', '2026-03-04 00:50:19', '2026-03-04 00:58:08'),
(55, '2e261958-e560-4609-8190-71c9c7188801', 29, 3, 1000.00, '2026-05-04', 0.00, NULL, 'cancelled', '2026-03-04 00:50:19', '2026-03-04 00:58:08'),
(56, '7d6e0faf-2db9-4217-b383-f858c7e8c24d', 30, 1, 1000.00, '2026-03-04', 1000.00, '2026-03-04', 'paid', '2026-03-04 02:27:02', '2026-03-04 02:42:14'),
(57, '2c4cb3b1-6bb1-49fe-93b6-4babf1ba944c', 30, 2, 1000.00, '2026-04-04', 1000.00, '2026-03-04', 'paid', '2026-03-04 02:27:02', '2026-03-04 02:58:25'),
(58, 'be945f50-3e00-4dc3-9818-0fe77f2fad6a', 30, 3, 1000.00, '2026-05-04', 1000.00, '2026-03-04', 'paid', '2026-03-04 02:27:02', '2026-03-04 02:37:01'),
(59, '97def600-a490-4b4f-b1d9-af82c6f1266f', 31, 1, 1000.00, '2026-03-04', 1000.00, '2026-03-04', 'paid', '2026-03-04 05:01:32', '2026-03-04 05:06:34'),
(60, '078daf76-502a-4b24-a933-10a75d8c6749', 31, 2, 1000.00, '2026-04-04', 1000.00, '2026-03-04', 'paid', '2026-03-04 05:01:32', '2026-03-04 05:11:10'),
(61, '1e2eb8b9-3109-4ccf-8045-201b3fdcadd2', 31, 3, 1000.00, '2026-05-04', 1000.00, '2026-03-04', 'paid', '2026-03-04 05:01:32', '2026-03-04 05:11:03'),
(62, 'c40b2d5a-52af-43ce-b7df-49a975c775b0', 32, 1, 1000.00, '2026-03-04', 1000.00, '2026-03-04', 'paid', '2026-03-04 05:44:06', '2026-03-04 05:44:56'),
(63, '22729a40-6bf1-4858-9830-cc764fdac93d', 32, 2, 1000.00, '2026-04-04', 1000.00, '2026-03-04', 'paid', '2026-03-04 05:44:06', '2026-03-04 05:45:08'),
(64, '4c9deec3-6b9a-46e1-850d-259a9e3a8553', 32, 3, 1000.00, '2026-05-04', 1000.00, '2026-03-04', 'paid', '2026-03-04 05:44:06', '2026-03-04 05:45:04'),
(65, 'bcdbdbda-f5b1-4934-867e-e3aaa15de47e', 32, 4, 1000.00, '2026-06-04', 1000.00, '2026-03-04', 'paid', '2026-03-04 05:44:06', '2026-03-04 05:45:00'),
(72, 'a492ed04-ca58-4817-94d2-7861a524c1c3', 35, 1, 1000.00, '2026-03-07', 0.00, NULL, 'cancelled', '2026-03-07 02:45:13', '2026-03-08 06:12:44'),
(73, 'dccb0beb-0d39-45d5-a05f-1f230a5c0a2f', 35, 2, 1000.00, '2026-04-07', 0.00, NULL, 'cancelled', '2026-03-07 02:45:13', '2026-03-08 06:12:44'),
(74, 'c762b52e-ad36-4249-95b8-bcf3b5935694', 35, 3, 1000.00, '2026-05-07', 0.00, NULL, 'cancelled', '2026-03-07 02:45:13', '2026-03-08 06:12:44'),
(75, '4249de00-b6ae-48ea-86f7-1f48fa7b39ab', 36, 1, 1000.00, '2026-03-07', 0.00, NULL, 'cancelled', '2026-03-07 05:13:58', '2026-03-08 06:12:51'),
(76, '5ea7edbd-02e5-46b0-9220-2055354fe8c3', 36, 2, 1000.00, '2026-04-07', 1000.00, '2026-03-08', 'paid', '2026-03-07 05:13:58', '2026-03-08 00:14:14'),
(77, '8750dde9-b682-430b-9902-736b9a9c5fe9', 36, 3, 1000.00, '2026-05-07', 1000.00, '2026-03-08', 'paid', '2026-03-07 05:13:58', '2026-03-08 00:14:07'),
(81, '5a352a51-e0d8-4b4a-a605-bfe028752374', 37, 1, 1000.00, '2026-03-19', 1000.00, '2026-03-19', 'paid', '2026-03-18 02:25:35', '2026-03-18 03:13:29'),
(82, 'ed27ba6b-20ea-464f-ad88-b727b8c3237b', 37, 2, 1000.00, '2026-04-19', 1000.00, '2026-04-18', 'paid', '2026-03-18 02:25:35', '2026-03-18 03:21:43'),
(83, '0783907c-1fe3-46b4-935c-f0933ec8c0d3', 37, 3, 1000.00, '2026-05-19', 1000.00, '2026-05-19', 'paid', '2026-03-18 02:25:35', '2026-03-18 03:42:46');

-- --------------------------------------------------------

--
-- Table structure for table `installment_payments`
--

CREATE TABLE `installment_payments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `installment_id` bigint(20) UNSIGNED NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `payment_date` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `payment_method` varchar(30) NOT NULL DEFAULT 'cash',
  `reference_no` varchar(100) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `received_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `installment_payments`
--

INSERT INTO `installment_payments` (`id`, `uuid`, `installment_id`, `amount`, `payment_date`, `payment_method`, `reference_no`, `notes`, `received_by`, `created_at`, `updated_at`) VALUES
(1, 'b2739f6a-d4c9-4efd-88c3-7fb298d2e5e6', 36, 1000.00, '2026-03-02 19:30:00', 'cash', NULL, NULL, 2, '2026-03-03 05:24:56', '2026-03-03 05:24:56'),
(2, '851f4b06-74bb-41a9-887f-27e8ed0736a4', 37, 1000.00, '2026-03-02 19:30:00', 'cash', NULL, NULL, 2, '2026-03-03 05:34:06', '2026-03-03 05:34:06'),
(3, 'bd3e4f3e-f1d4-4e71-944a-f44e25659873', 39, 1500.00, '2026-03-02 19:30:00', 'cash', NULL, NULL, 2, '2026-03-03 05:52:54', '2026-03-03 05:52:54'),
(4, 'a93268f8-27a5-4b61-b49f-8c44284fb578', 38, 1500.00, '2026-03-02 19:30:00', 'cash', NULL, NULL, 1, '2026-03-03 05:55:59', '2026-03-03 05:55:59'),
(5, 'ec261ca2-c6b3-4621-bec6-312b3a1319b9', 40, 4000.00, '2026-03-02 19:30:00', 'cash', NULL, NULL, 1, '2026-03-03 06:07:01', '2026-03-03 06:07:01'),
(6, '672cca1e-9deb-44a9-ae7c-06959df2c5a7', 43, 1666.66, '2026-03-02 19:30:00', 'cash', NULL, NULL, 1, '2026-03-03 06:24:10', '2026-03-03 06:24:10'),
(7, 'b19d66c3-d10c-4718-b19b-04a1350aadbf', 41, 1666.67, '2026-03-02 19:30:00', 'cash', NULL, NULL, 1, '2026-03-03 06:28:06', '2026-03-03 06:28:06'),
(8, '56da745e-f714-49f1-b1a2-c7fa774505ec', 46, 1000.00, '2026-03-02 19:30:00', 'cash', NULL, NULL, 1, '2026-03-03 06:37:02', '2026-03-03 06:37:02'),
(9, '542c6c0b-fc8a-47a8-bbc9-3b4bc7a7f678', 44, 1000.00, '2026-03-02 19:30:00', 'cash', NULL, NULL, 1, '2026-03-03 06:38:29', '2026-03-03 06:38:29'),
(10, '044eb487-2ecf-4420-b622-55552484b5d3', 49, 1666.66, '2026-03-02 19:30:00', 'cash', NULL, NULL, 1, '2026-03-03 06:53:13', '2026-03-03 06:53:13'),
(11, '29863fa5-83df-47d3-996b-3bb370000e2e', 48, 1666.67, '2026-03-02 19:30:00', 'cash', NULL, NULL, 1, '2026-03-03 06:59:57', '2026-03-03 06:59:57'),
(12, 'a1671183-6f2a-4c51-8fc1-f556b28bed61', 51, 1000.00, '2026-03-02 19:30:00', 'cash', NULL, NULL, 1, '2026-03-03 07:07:21', '2026-03-03 07:07:21'),
(13, 'e317278f-e820-4ffc-b3d5-07e719952da7', 52, 1000.00, '2026-03-02 19:30:00', 'cash', NULL, NULL, 1, '2026-03-03 07:08:03', '2026-03-03 07:08:03'),
(14, '13c0af40-a222-454a-bc8f-f90113443d46', 50, 1000.00, '2026-03-02 19:30:00', 'cash', NULL, NULL, 1, '2026-03-03 07:08:15', '2026-03-03 07:08:15'),
(15, '1f72541e-295a-4ee8-9a79-67fcf6729a35', 53, 1000.00, '2026-03-03 19:30:00', 'cash', NULL, NULL, 1, '2026-03-04 00:52:30', '2026-03-04 00:52:30'),
(16, '61cb0c39-d5b0-4e4a-a570-7d557cea3e0e', 58, 1000.00, '2026-03-03 19:30:00', 'cash', NULL, NULL, 1, '2026-03-04 02:37:01', '2026-03-04 02:37:01'),
(17, 'cef18b06-e599-4971-b037-df2b39b2cda0', 56, 1000.00, '2026-03-03 19:30:00', 'cash', NULL, NULL, 1, '2026-03-04 02:42:14', '2026-03-04 02:42:14'),
(18, 'b26addf0-c164-41d2-87ca-8259187d5141', 57, 1000.00, '2026-03-03 19:30:00', 'cash', NULL, NULL, 1, '2026-03-04 02:58:25', '2026-03-04 02:58:25'),
(19, '763b362f-e015-43b1-9cd5-fb6d4866ec12', 59, 1000.00, '2026-03-03 19:30:00', 'cash', NULL, NULL, 1, '2026-03-04 05:06:34', '2026-03-04 05:06:34'),
(20, '18f7c4a4-7838-4636-8183-fbfbaae43b1d', 61, 1000.00, '2026-03-03 19:30:00', 'cash', NULL, NULL, 1, '2026-03-04 05:11:03', '2026-03-04 05:11:03'),
(21, '08bddb0a-9f74-4625-bf78-359abca6c921', 60, 1000.00, '2026-03-03 19:30:00', 'cash', NULL, NULL, 1, '2026-03-04 05:11:10', '2026-03-04 05:11:10'),
(22, '0879b08d-47d0-465d-b176-ee781ed1c22e', 62, 1000.00, '2026-03-03 19:30:00', 'cash', NULL, NULL, 2, '2026-03-04 05:44:56', '2026-03-04 05:44:56'),
(23, '1608ac71-f151-4b3c-a377-503f99b1ece9', 65, 1000.00, '2026-03-03 19:30:00', 'cash', NULL, NULL, 2, '2026-03-04 05:45:00', '2026-03-04 05:45:00'),
(24, 'ab1b4b1d-dff0-45e0-adaf-f68c8101eb6f', 64, 1000.00, '2026-03-03 19:30:00', 'cash', NULL, NULL, 2, '2026-03-04 05:45:04', '2026-03-04 05:45:04'),
(25, '0c3b00c4-3ab3-4acc-9098-15813ec127e5', 63, 1000.00, '2026-03-03 19:30:00', 'cash', NULL, NULL, 2, '2026-03-04 05:45:08', '2026-03-04 05:45:08'),
(31, '9758132f-2663-4a1e-b34d-0fd53f2ea21b', 77, 1000.00, '2026-03-07 19:30:00', 'cash', NULL, NULL, 1, '2026-03-08 00:14:09', '2026-03-08 00:14:09'),
(32, '40df278e-e6fc-4053-8270-991d01204718', 76, 1000.00, '2026-03-07 19:30:00', 'cash', NULL, NULL, 1, '2026-03-08 00:14:14', '2026-03-08 00:14:14'),
(33, 'c4bbe500-1593-4855-b9e4-3040b1e323c1', 81, 1000.00, '2026-03-18 19:30:00', 'cash', NULL, NULL, 17, '2026-03-18 03:13:31', '2026-03-18 03:13:31'),
(34, '02928988-a9b9-4523-b00a-1758a4454284', 82, 1000.00, '2026-04-17 19:30:00', 'cash', NULL, NULL, 17, '2026-03-18 03:21:43', '2026-03-18 03:21:43');

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

CREATE TABLE `jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) UNSIGNED NOT NULL,
  `reserved_at` int(10) UNSIGNED DEFAULT NULL,
  `available_at` int(10) UNSIGNED NOT NULL,
  `created_at` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `job_batches`
--

CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `materials`
--

CREATE TABLE `materials` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `material_type` varchar(100) DEFAULT NULL,
  `unit` varchar(50) NOT NULL,
  `quantity` decimal(14,2) NOT NULL DEFAULT 0.00,
  `supplier_id` bigint(20) UNSIGNED DEFAULT NULL,
  `batch_no` varchar(100) DEFAULT NULL,
  `serial_no` varchar(100) DEFAULT NULL,
  `expiry_date` date DEFAULT NULL,
  `min_stock_level` decimal(14,2) NOT NULL DEFAULT 0.00,
  `status` varchar(30) NOT NULL DEFAULT 'active',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `materials`
--

INSERT INTO `materials` (`id`, `uuid`, `name`, `material_type`, `unit`, `quantity`, `supplier_id`, `batch_no`, `serial_no`, `expiry_date`, `min_stock_level`, `status`, `notes`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, '2ea4e05a-4a10-4fcd-89f4-dba9df294941', 'Cemente ghazal', 'cement', 'pcs', 2950.00, 1, 'GHgdf', 'Gh322423', '2026-01-01', 30.00, 'active', 'sdfsdff', '2026-03-24 06:47:40', '2026-03-24 06:53:24', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `material_requests`
--

CREATE TABLE `material_requests` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `request_no` varchar(255) NOT NULL,
  `project_id` bigint(20) UNSIGNED DEFAULT NULL,
  `warehouse_id` bigint(20) UNSIGNED NOT NULL,
  `requested_by_employee_id` bigint(20) UNSIGNED NOT NULL,
  `status` varchar(40) NOT NULL DEFAULT 'pending',
  `approved_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `issued_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `issued_at` timestamp NULL DEFAULT NULL,
  `issue_receipt_no` varchar(255) DEFAULT NULL,
  `requested_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `material_requests`
--

INSERT INTO `material_requests` (`id`, `uuid`, `request_no`, `project_id`, `warehouse_id`, `requested_by_employee_id`, `status`, `approved_by_user_id`, `approved_at`, `issued_by_user_id`, `issued_at`, `issue_receipt_no`, `requested_at`, `notes`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, '86ef4f7a-6095-4d61-b6ed-6a001e7bcb9f', 'MR-000001', 1, 1, 9, 'issued', 1, '2026-03-24 06:53:17', 1, '2026-03-23 19:30:00', 'MIR-000001', '2026-03-24 06:53:10', NULL, '2026-03-24 06:53:10', '2026-03-24 06:53:26', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `material_request_items`
--

CREATE TABLE `material_request_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `material_request_id` bigint(20) UNSIGNED NOT NULL,
  `material_id` bigint(20) UNSIGNED NOT NULL,
  `quantity_requested` decimal(14,2) NOT NULL,
  `quantity_approved` decimal(14,2) NOT NULL DEFAULT 0.00,
  `quantity_issued` decimal(14,2) NOT NULL DEFAULT 0.00,
  `unit` varchar(100) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `material_request_items`
--

INSERT INTO `material_request_items` (`id`, `uuid`, `material_request_id`, `material_id`, `quantity_requested`, `quantity_approved`, `quantity_issued`, `unit`, `notes`, `created_at`, `updated_at`) VALUES
(1, 'a89c23be-374a-4f32-834b-58bd8ed3639d', 1, 1, 50.00, 50.00, 50.00, 'pcs', 'dfdf', '2026-03-24 06:53:10', '2026-03-24 06:53:24');

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int(10) UNSIGNED NOT NULL,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(17, '0001_01_01_000000_create_users_table', 1),
(18, '0001_01_01_000001_create_cache_table', 1),
(19, '0001_01_01_000002_create_jobs_table', 1),
(20, '2026_02_12_073751_create_permission_tables', 1),
(21, '2026_02_12_073752_create_personal_access_tokens_table', 1),
(22, '2026_02_12_074109_add_business_fields_to_users_table', 1),
(23, '2026_02_12_101850_create_approvals_table', 1),
(24, '2026_02_12_101851_create_approval_logs_table', 1),
(25, '2026_02_12_101851_create_sync_inbox_table', 1),
(26, '2026_02_19_095719_create_apartments_table', 1),
(27, '2026_02_19_095804_create_customers_table', 1),
(28, '2026_02_19_095823_create_apartment_sales_table', 1),
(29, '2026_02_19_095829_create_installments_table', 1),
(30, '2026_02_23_105214_add_uuid_to_roles_table', 1),
(31, '2026_02_24_080000_add_soft_deletes_to_customers_and_roles', 1),
(32, '2026_02_25_055505_add_deleted_at_to_users_table', 1),
(33, '2026_02_28_102402_add_deleted_at_to_apartments_table', 2),
(34, '2026_03_01_071927_add_deleted_at_to_apartment_sales_table', 3),
(35, '2026_03_02_120000_add_total_price_to_apartments_table', 4),
(36, '2026_03_02_120100_add_schedule_fields_to_apartment_sales_table', 4),
(37, '2026_03_02_130000_add_sale_id_to_apartment_sales_table', 5),
(38, '2026_03_02_140500_create_apartment_sale_financials_table', 6),
(39, '2026_03_02_141000_create_municipality_payment_letters_table', 7),
(40, '2026_03_02_141100_create_municipality_receipts_table', 7),
(41, '2026_03_02_141200_add_deed_fields_to_apartment_sales_table', 8),
(42, '2026_03_03_054310_add_user_id_to_apartment-sale', 9),
(43, '2026_03_03_180000_add_possession_and_termination_fields_to_apartment_sales_table', 10),
(44, '2026_03_03_180100_create_installment_payments_and_apartment_sale_possession_logs_tables', 10),
(45, '2026_03_03_190500_alter_installments_status_to_varchar', 11),
(46, '2026_03_04_120500_create_apartment_sale_terminations_table', 12),
(47, '2026_03_04_130000_drop_termination_fields_from_apartment_sales_table', 13),
(48, '2026_03_04_140000_add_actual_net_revenue_to_apartment_sales_table', 14),
(49, '2026_03_04_150000_recalculate_actual_net_revenue_to_use_delivered_municipality', 15),
(50, '2026_03_04_160000_create_notifications_table', 16),
(51, '2026_03_07_120000_create_documents_table', 17),
(52, '2026_03_07_130000_create_crm_messages_table', 18),
(53, '2026_03_07_140000_add_installment_fields_to_crm_messages_table', 19),
(54, '2026_03_08_090000_create_apartment_rentals_table', 20),
(55, '2026_03_08_090100_create_rental_payments_table', 20),
(56, '2026_03_08_090200_create_rental_payment_receipts_table', 20),
(57, '2026_03_08_100000_add_total_paid_amount_to_apartment_rentals_table', 21),
(58, '2026_03_08_140000_drop_unused_columns_from_apartment_rentals_table', 22),
(59, '2026_03_08_150000_add_billing_and_finance_columns_to_rental_payments_table', 23),
(60, '2026_03_09_210000_add_document_type_to_documents_table', 24),
(61, '2026_03_10_120000_create_system_settings_table', 25),
(62, '2026_03_14_080341_employee-table-migration', 26),
(63, '2026_03_16_071707_add_deleted_at_to_employees_table', 27),
(64, '2026_03_24_090000_create_salary_advances_table', 28),
(65, '2026_03_24_090100_create_salary_payments_table', 28),
(66, '2026_03_24_075620_create-vendors', 29),
(67, '2026_03_24_110000_create_vendors_table', 29),
(68, '2026_03_24_110100_create_warehouses_table', 29),
(69, '2026_03_24_110200_create_materials_table', 29),
(70, '2026_03_24_110300_create_company_assets_table', 29),
(71, '2026_03_24_130000_create_material_requests_table', 30),
(72, '2026_03_24_130100_create_material_request_items_table', 30),
(73, '2026_03_24_130200_create_asset_requests_table', 30),
(74, '2026_03_24_130300_create_asset_assignments_table', 30),
(75, '2026_03_24_150000_create_projects_table', 31),
(76, '2026_03_24_150100_create_stock_movements_table', 31);

-- --------------------------------------------------------

--
-- Table structure for table `model_has_permissions`
--

CREATE TABLE `model_has_permissions` (
  `permission_id` bigint(20) UNSIGNED NOT NULL,
  `model_type` varchar(255) NOT NULL,
  `model_id` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `model_has_roles`
--

CREATE TABLE `model_has_roles` (
  `role_id` bigint(20) UNSIGNED NOT NULL,
  `model_type` varchar(255) NOT NULL,
  `model_id` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `model_has_roles`
--

INSERT INTO `model_has_roles` (`role_id`, `model_type`, `model_id`) VALUES
(1, 'App\\Models\\User', 1),
(2, 'App\\Models\\User', 13),
(3, 'App\\Models\\User', 12),
(4, 'App\\Models\\User', 16),
(4, 'App\\Models\\User', 17);

-- --------------------------------------------------------

--
-- Table structure for table `municipality_payment_letters`
--

CREATE TABLE `municipality_payment_letters` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `apartment_sale_id` bigint(20) UNSIGNED NOT NULL,
  `letter_no` varchar(50) NOT NULL,
  `issued_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `municipality_share_amount` decimal(15,2) NOT NULL DEFAULT 0.00,
  `remaining_municipality` decimal(15,2) NOT NULL DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `municipality_payment_letters`
--

INSERT INTO `municipality_payment_letters` (`id`, `uuid`, `apartment_sale_id`, `letter_no`, `issued_at`, `municipality_share_amount`, `remaining_municipality`, `notes`, `created_at`, `updated_at`) VALUES
(7, '3c264fec-7036-4da1-bafb-0ba90c254431', 20, 'MUN-SAL-000020', '2026-03-03 06:36:12', 750.00, 0.00, NULL, '2026-03-03 01:59:46', '2026-03-03 02:06:12'),
(8, '43bb0c1d-1884-44a4-a610-03e66b515a8b', 21, 'MUN-SAL-000021', '2026-03-03 08:39:13', 150.00, 0.00, NULL, '2026-03-03 03:47:07', '2026-03-03 04:09:13'),
(9, '8cd01e00-70b3-469b-9055-c8c198c5392b', 22, 'MUN-SAL-000022', '2026-03-03 05:21:29', 300.00, 300.00, NULL, '2026-03-03 05:21:29', '2026-03-03 05:21:29'),
(10, '63045667-5c5b-4435-9a31-31324b089e36', 23, 'MUN-SAL-000023', '2026-03-03 05:51:36', 450.00, 450.00, NULL, '2026-03-03 05:51:36', '2026-03-03 05:51:36'),
(11, '682e5b60-77ef-4cef-8406-a10dded610e9', 24, 'MUN-SAL-000024', '2026-03-03 06:06:14', 600.00, 600.00, NULL, '2026-03-03 06:06:14', '2026-03-03 06:06:14'),
(12, '20fc5632-a107-435e-af96-1d48833be258', 25, 'MUN-SAL-000025', '2026-03-03 06:23:37', 750.00, 750.00, NULL, '2026-03-03 06:23:37', '2026-03-03 06:23:37'),
(13, '0e1a2b1b-2cdb-41a8-9d39-71fd4a53eace', 26, 'MUN-SAL-000026', '2026-03-03 06:36:15', 450.00, 450.00, NULL, '2026-03-03 06:36:15', '2026-03-03 06:36:15'),
(14, '3f4f2e77-5797-4d90-9ed9-1920279239ca', 27, 'MUN-SAL-000027', '2026-03-03 06:52:25', 750.00, 750.00, NULL, '2026-03-03 06:52:25', '2026-03-03 06:52:25'),
(15, 'ee7454db-5123-4bfb-8076-c55dc2d7f800', 28, 'MUN-SAL-000028', '2026-03-03 11:42:27', 450.00, 0.00, NULL, '2026-03-03 07:06:04', '2026-03-03 07:12:27'),
(16, 'ca6a575b-dd7c-43ca-9242-ccdf679fd949', 29, 'MUN-SAL-000029', '2026-03-04 00:50:19', 450.00, 450.00, NULL, '2026-03-04 00:50:19', '2026-03-04 00:50:19'),
(17, '0b0da306-97e4-4b66-ae70-16493ac38702', 30, 'MUN-SAL-000030', '2026-03-04 07:11:30', 450.00, 0.00, NULL, '2026-03-04 02:27:02', '2026-03-04 02:41:30'),
(18, 'ca908bf4-9b72-444b-a08c-dbfb2cfba03f', 31, 'MUN-SAL-000031', '2026-03-04 09:42:04', 450.00, 0.00, NULL, '2026-03-04 05:01:33', '2026-03-04 05:12:04'),
(19, '9851203a-4212-4ece-a87b-ba6504bf436b', 32, 'MUN-SAL-000032', '2026-03-04 10:18:03', 600.00, 0.00, NULL, '2026-03-04 05:44:06', '2026-03-04 05:48:03'),
(22, 'b4f31ba2-fe7a-4e24-a3c6-430ed5e9e12b', 35, 'MUN-SAL-000035', '2026-03-07 02:45:14', 450.00, 450.00, NULL, '2026-03-07 02:45:14', '2026-03-07 02:45:14'),
(23, '7b236ac1-cf28-4707-b4b7-0a370c89cff2', 36, 'MUN-SAL-000036', '2026-03-07 05:13:58', 450.00, 450.00, NULL, '2026-03-07 05:13:58', '2026-03-07 05:13:58'),
(24, '6d971527-25db-4c79-9c30-637b1a46ed6b', 37, 'MUN-SAL-000037', '2026-03-18 09:07:42', 450.00, 0.00, NULL, '2026-03-18 02:25:02', '2026-03-18 04:37:42');

-- --------------------------------------------------------

--
-- Table structure for table `municipality_receipts`
--

CREATE TABLE `municipality_receipts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `apartment_sale_id` bigint(20) UNSIGNED NOT NULL,
  `receipt_no` varchar(50) NOT NULL,
  `payment_date` date NOT NULL,
  `amount` decimal(15,2) NOT NULL,
  `payment_method` varchar(30) NOT NULL DEFAULT 'cash',
  `notes` text DEFAULT NULL,
  `received_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `municipality_receipts`
--

INSERT INTO `municipality_receipts` (`id`, `uuid`, `apartment_sale_id`, `receipt_no`, `payment_date`, `amount`, `payment_method`, `notes`, `received_by`, `created_at`, `updated_at`) VALUES
(5, 'e98e90f8-9881-4055-8118-148d902b08ad', 20, 'MRC-SAL-000020-001', '2026-03-03', 750.00, 'cash', 'receivbed', 2, '2026-03-03 02:06:12', '2026-03-03 02:06:12'),
(6, 'bae1ceb6-df09-476e-89c4-c3db18688862', 21, 'MRC-SAL-000021-001', '2026-03-03', 50.00, 'cash', 'received', 1, '2026-03-03 04:02:02', '2026-03-03 04:02:02'),
(7, '95b08371-847f-4a52-a629-f1eb48225f9b', 21, 'MRC-SAL-000021-002', '2026-03-03', 50.00, 'cash', 'received', 2, '2026-03-03 04:08:16', '2026-03-03 04:08:16'),
(8, 'bc01b3ab-1c31-4e85-a6cb-0c94f4ae62f7', 21, 'MRC-SAL-000021-003', '2026-03-03', 50.00, 'cash', 'received', 2, '2026-03-03 04:09:13', '2026-03-03 04:09:13'),
(9, 'd6ae86a2-bb1d-4528-a018-42e1918c36bc', 28, 'MRC-SAL-000028-001', '2026-03-03', 50.00, 'cash', 'received', 2, '2026-03-03 07:12:01', '2026-03-03 07:12:01'),
(10, 'f9c4b761-0b6e-4d56-a808-2342f98e50a8', 28, 'MRC-SAL-000028-002', '2026-03-03', 400.00, 'cash', NULL, 2, '2026-03-03 07:12:27', '2026-03-03 07:12:27'),
(11, '101304b0-e225-41a3-bc19-a7524f667388', 30, 'MRC-SAL-000030-001', '2026-03-04', 50.00, 'cash', NULL, 1, '2026-03-04 02:40:04', '2026-03-04 02:40:04'),
(12, '67517c7b-a924-43b4-a0ab-4428fc4009ff', 30, 'MRC-SAL-000030-002', '2026-03-04', 400.00, 'cash', NULL, 1, '2026-03-04 02:41:30', '2026-03-04 02:41:30'),
(13, '0f9a4fb2-5cf4-44a7-96dd-13012a58b543', 31, 'MRC-SAL-000031-001', '2026-03-04', 450.00, 'cash', NULL, 1, '2026-03-04 05:12:04', '2026-03-04 05:12:04'),
(14, 'c1a3e7f3-e8f3-484a-849d-954f6aa6258d', 32, 'MRC-SAL-000032-001', '2026-03-04', 600.00, 'cash', NULL, 2, '2026-03-04 05:48:03', '2026-03-04 05:48:03'),
(16, '279b51a1-b94f-49bd-8de6-deb542b3e6d9', 37, 'MRC-SAL-000037-001', '2026-03-18', 450.00, 'cash', NULL, 1, '2026-03-18 04:37:42', '2026-03-18 04:37:42');

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` char(36) NOT NULL,
  `type` varchar(255) NOT NULL,
  `notifiable_type` varchar(255) NOT NULL,
  `notifiable_id` bigint(20) UNSIGNED NOT NULL,
  `data` text NOT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `type`, `notifiable_type`, `notifiable_id`, `data`, `read_at`, `created_at`, `updated_at`) VALUES
('0f15d9f6-d037-4fe9-9b76-f349a04007e0', 'App\\Notifications\\RentalBillCreatedFinanceNotification', 'App\\Models\\User', 3, '{\"category\":\"rental_bill_created_finance\",\"title\":\"New Rental Bill: RBL-000028\",\"message\":\"A customer rental bill was generated and is waiting for finance approval.\",\"rental_uuid\":\"eb481cd6-ecbf-42f1-a7a2-a50d477dac9f\",\"rental_id\":\"RNT-000001\",\"bill_uuid\":\"0dc1e405-abf9-4a14-9390-cf3867fd9ae4\",\"bill_no\":\"RBL-000028\",\"tenant_id\":23,\"tenant_name\":\"example8\",\"apartment_id\":21,\"apartment_label\":\"KJ-23423 - Unit 30\",\"payment_type\":\"monthly\",\"amount_due\":500,\"due_date\":\"2026-09-08\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"created_at\":\"2026-03-08T09:55:16.825406Z\"}', NULL, '2026-03-08 05:25:16', '2026-03-08 05:25:16'),
('289c9238-48fd-4b83-8d2a-96ebcc65a42e', 'App\\Notifications\\RentalBillCreatedFinanceNotification', 'App\\Models\\User', 3, '{\"category\":\"rental_bill_created_finance\",\"title\":\"New Rental Bill: RBL-000033\",\"message\":\"A customer rental bill was generated and is waiting for finance approval.\",\"rental_uuid\":\"4d6f8112-84c9-4fe8-8e2a-f194534052ef\",\"rental_id\":\"RNT-000001\",\"bill_uuid\":\"65dcdcfa-5bd4-4c7d-8778-0c587484c946\",\"bill_no\":\"RBL-000033\",\"tenant_id\":18,\"tenant_name\":\"example5\",\"apartment_id\":22,\"apartment_label\":\"GHFSD - Unit dsfsdf\",\"payment_type\":\"monthly\",\"amount_due\":500,\"due_date\":\"2026-09-08\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"created_at\":\"2026-03-08T10:02:02.007603Z\"}', NULL, '2026-03-08 05:32:02', '2026-03-08 05:32:02'),
('3a3a54a4-40f1-40f5-b3ab-faaa7c1614f5', 'App\\Notifications\\RentalBillCreatedFinanceNotification', 'App\\Models\\User', 3, '{\"category\":\"rental_bill_created_finance\",\"title\":\"New Rental Bill: RBL-000031\",\"message\":\"A customer rental bill was generated and is waiting for finance approval.\",\"rental_uuid\":\"4d6f8112-84c9-4fe8-8e2a-f194534052ef\",\"rental_id\":\"RNT-000001\",\"bill_uuid\":\"83bdc355-789f-4d10-abc6-66bf11e07eaa\",\"bill_no\":\"RBL-000031\",\"tenant_id\":18,\"tenant_name\":\"example5\",\"apartment_id\":22,\"apartment_label\":\"GHFSD - Unit dsfsdf\",\"payment_type\":\"monthly\",\"amount_due\":500,\"due_date\":\"2026-07-08\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"created_at\":\"2026-03-08T10:00:16.014148Z\"}', NULL, '2026-03-08 05:30:16', '2026-03-08 05:30:16'),
('59ae1cab-1408-46f0-833e-041286a4374b', 'App\\Notifications\\RentalBillCreatedFinanceNotification', 'App\\Models\\User', 3, '{\"category\":\"rental_bill_created_finance\",\"title\":\"New Rental Bill: RBL-000038\",\"message\":\"A customer rental bill was generated and is waiting for finance approval.\",\"rental_uuid\":\"d14a0546-1f0e-4f66-bffd-52e0226b8b92\",\"rental_id\":\"RNT-000018\",\"bill_uuid\":\"4c19d079-3a8a-42a3-8d5d-d95f1a4a0518\",\"bill_no\":\"RBL-000038\",\"tenant_id\":21,\"tenant_name\":\"Hellal\",\"apartment_id\":22,\"apartment_label\":\"GHFSD - Unit dsfsdf\",\"payment_type\":\"monthly\",\"amount_due\":1000,\"due_date\":\"2026-06-08\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"created_at\":\"2026-03-08T10:32:53.408177Z\"}', NULL, '2026-03-08 06:02:53', '2026-03-08 06:02:53'),
('5b698232-cabc-4eb4-9935-22528758cf4f', 'App\\Notifications\\RentalBillCreatedFinanceNotification', 'App\\Models\\User', 3, '{\"category\":\"rental_bill_created_finance\",\"title\":\"New Rental Bill: RBL-000036\",\"message\":\"A customer rental bill was generated and is waiting for finance approval.\",\"rental_uuid\":\"d14a0546-1f0e-4f66-bffd-52e0226b8b92\",\"rental_id\":\"RNT-000018\",\"bill_uuid\":\"4ec21a70-e312-4e96-b314-02a424b7d82d\",\"bill_no\":\"RBL-000036\",\"tenant_id\":21,\"tenant_name\":\"Hellal\",\"apartment_id\":22,\"apartment_label\":\"GHFSD - Unit dsfsdf\",\"payment_type\":\"advance\",\"amount_due\":1000,\"due_date\":\"2026-03-08\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"created_at\":\"2026-03-08T10:20:11.148134Z\"}', NULL, '2026-03-08 05:50:11', '2026-03-08 05:50:11'),
('92714012-4b80-4c4c-bfd2-9f63a866ba4e', 'App\\Notifications\\RentalBillCreatedFinanceNotification', 'App\\Models\\User', 3, '{\"category\":\"rental_bill_created_finance\",\"title\":\"New Rental Bill: RBL-000034\",\"message\":\"A customer rental bill was generated and is waiting for finance approval.\",\"rental_uuid\":\"4d6f8112-84c9-4fe8-8e2a-f194534052ef\",\"rental_id\":\"RNT-000001\",\"bill_uuid\":\"28af790f-32f6-4e2c-a81f-63708d6a84d4\",\"bill_no\":\"RBL-000034\",\"tenant_id\":18,\"tenant_name\":\"example5\",\"apartment_id\":22,\"apartment_label\":\"GHFSD - Unit dsfsdf\",\"payment_type\":\"monthly\",\"amount_due\":500,\"due_date\":\"2026-10-08\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"created_at\":\"2026-03-08T10:02:31.105608Z\"}', NULL, '2026-03-08 05:32:31', '2026-03-08 05:32:31'),
('9a0ec643-7870-4b52-b834-1a9d5ffc8f83', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 3, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000035\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"5301de91-a262-43ae-806f-1516d374ddaf\",\"sale_id\":\"SAL-000035\",\"customer_id\":22,\"customer_name\":\"yaftomict\",\"apartment_id\":21,\"apartment_label\":\"KJ-23423 - Unit 30\",\"net_price\":3000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/5301de91-a262-43ae-806f-1516d374ddaf\\/financial\",\"created_at\":\"2026-03-07T07:15:25.870071Z\"}', NULL, '2026-03-07 02:45:25', '2026-03-07 02:45:25'),
('9eace26f-a0aa-4090-849a-b5dae22aaf39', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 3, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000033\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"bd380758-1d71-490b-954a-3a3c8e95407f\",\"sale_id\":\"SAL-000033\",\"customer_id\":18,\"customer_name\":\"example5\",\"apartment_id\":19,\"apartment_label\":\"YUT-300 - Unit 4004\",\"net_price\":4000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/bd380758-1d71-490b-954a-3a3c8e95407f\\/financial\",\"created_at\":\"2026-03-07T04:58:25.964775Z\"}', '2026-03-07 00:31:55', '2026-03-07 00:28:25', '2026-03-07 00:31:55'),
('a5120f29-f124-4878-9416-1b16ef0fa530', 'App\\Notifications\\RentalBillCreatedFinanceNotification', 'App\\Models\\User', 3, '{\"category\":\"rental_bill_created_finance\",\"title\":\"New Rental Bill: RBL-000030\",\"message\":\"A customer rental bill was generated and is waiting for finance approval.\",\"rental_uuid\":\"4d6f8112-84c9-4fe8-8e2a-f194534052ef\",\"rental_id\":\"RNT-000001\",\"bill_uuid\":\"a0dbc677-7601-451e-81ac-54f79cd3671f\",\"bill_no\":\"RBL-000030\",\"tenant_id\":18,\"tenant_name\":\"example5\",\"apartment_id\":22,\"apartment_label\":\"GHFSD - Unit dsfsdf\",\"payment_type\":\"advance\",\"amount_due\":500,\"due_date\":\"2026-03-08\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"created_at\":\"2026-03-08T09:58:58.087028Z\"}', NULL, '2026-03-08 05:28:58', '2026-03-08 05:28:58'),
('bd78f903-ef9c-46dc-95bf-fbcc0d595517', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 3, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000036\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"b2e7e63b-5c88-4a70-952b-36bbebd4f262\",\"sale_id\":\"SAL-000036\",\"customer_id\":21,\"customer_name\":\"Hellal\",\"apartment_id\":22,\"apartment_label\":\"GHFSD - Unit dsfsdf\",\"net_price\":3000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/b2e7e63b-5c88-4a70-952b-36bbebd4f262\\/financial\",\"created_at\":\"2026-03-07T09:44:15.042164Z\"}', NULL, '2026-03-07 05:14:15', '2026-03-07 05:14:15'),
('c4d08937-4640-441d-83e2-ceeae682404a', 'App\\Notifications\\RentalBillCreatedFinanceNotification', 'App\\Models\\User', 3, '{\"category\":\"rental_bill_created_finance\",\"title\":\"New Rental Bill: RBL-000027\",\"message\":\"A customer rental bill was generated and is waiting for finance approval.\",\"rental_uuid\":\"eb481cd6-ecbf-42f1-a7a2-a50d477dac9f\",\"rental_id\":\"RNT-000001\",\"bill_uuid\":\"051d2a9f-ac2e-414d-95b0-c65597640b14\",\"bill_no\":\"RBL-000027\",\"tenant_id\":23,\"tenant_name\":\"example8\",\"apartment_id\":21,\"apartment_label\":\"KJ-23423 - Unit 30\",\"payment_type\":\"monthly\",\"amount_due\":500,\"due_date\":\"2026-08-08\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"created_at\":\"2026-03-08T09:51:51.512702Z\"}', NULL, '2026-03-08 05:21:51', '2026-03-08 05:21:51'),
('c9f7910b-ca39-4d5a-a324-db8b9f9d8afb', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 3, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000034\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"d16a9c4d-321f-404e-99eb-d694b7aa11c6\",\"sale_id\":\"SAL-000034\",\"customer_id\":17,\"customer_name\":\"example4\",\"apartment_id\":20,\"apartment_label\":\"GH32300324 - Unit 434\",\"net_price\":3000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/d16a9c4d-321f-404e-99eb-d694b7aa11c6\\/financial\",\"created_at\":\"2026-03-07T05:44:04.277230Z\"}', NULL, '2026-03-07 01:14:04', '2026-03-07 01:14:04'),
('d3d8b667-12f5-46ea-a409-3d6c645d208e', 'App\\Notifications\\RentalBillCreatedFinanceNotification', 'App\\Models\\User', 3, '{\"category\":\"rental_bill_created_finance\",\"title\":\"New Rental Bill: RBL-000037\",\"message\":\"A customer rental bill was generated and is waiting for finance approval.\",\"rental_uuid\":\"d14a0546-1f0e-4f66-bffd-52e0226b8b92\",\"rental_id\":\"RNT-000018\",\"bill_uuid\":\"151cad5e-f099-4015-af8f-fcbe813d2e18\",\"bill_no\":\"RBL-000037\",\"tenant_id\":21,\"tenant_name\":\"Hellal\",\"apartment_id\":22,\"apartment_label\":\"GHFSD - Unit dsfsdf\",\"payment_type\":\"monthly\",\"amount_due\":1000,\"due_date\":\"2026-05-08\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"created_at\":\"2026-03-08T10:21:21.285948Z\"}', NULL, '2026-03-08 05:51:21', '2026-03-08 05:51:21'),
('e224a440-5ae7-4848-9c20-9ddac3fd4dc5', 'App\\Notifications\\RentalBillCreatedFinanceNotification', 'App\\Models\\User', 3, '{\"category\":\"rental_bill_created_finance\",\"title\":\"New Rental Bill: RBL-000032\",\"message\":\"A customer rental bill was generated and is waiting for finance approval.\",\"rental_uuid\":\"4d6f8112-84c9-4fe8-8e2a-f194534052ef\",\"rental_id\":\"RNT-000001\",\"bill_uuid\":\"73e1a15b-651a-433e-8f9e-0ca40d4c73f0\",\"bill_no\":\"RBL-000032\",\"tenant_id\":18,\"tenant_name\":\"example5\",\"apartment_id\":22,\"apartment_label\":\"GHFSD - Unit dsfsdf\",\"payment_type\":\"monthly\",\"amount_due\":500,\"due_date\":\"2026-08-08\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"created_at\":\"2026-03-08T10:01:14.140587Z\"}', NULL, '2026-03-08 05:31:14', '2026-03-08 05:31:14'),
('ed818796-760b-424d-8c90-0d1e2ac2355e', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 16, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000037\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"fdcd9b8f-b2f6-4553-89fd-f1d6861233fb\",\"sale_id\":\"SAL-000037\",\"customer_id\":25,\"customer_name\":\"customer\",\"apartment_id\":26,\"apartment_label\":\"JUG-999 - Unit 303\",\"net_price\":3000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/fdcd9b8f-b2f6-4553-89fd-f1d6861233fb\\/financial\",\"created_at\":\"2026-03-18T06:55:27.707957Z\"}', NULL, '2026-03-18 02:25:27', '2026-03-18 02:25:27');

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

CREATE TABLE `permissions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `guard_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `permissions`
--

INSERT INTO `permissions` (`id`, `name`, `guard_name`, `created_at`, `updated_at`) VALUES
(1, 'apartments.view', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(2, 'apartments.create', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(3, 'apartments.update', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(4, 'customers.view', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(5, 'customers.create', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(6, 'customers.update', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(7, 'sales.create', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(8, 'sales.approve', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(9, 'sales.cancel', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(10, 'installments.pay', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(11, 'municipality.view', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(12, 'municipality.record_receipt', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(13, 'municipality.approve', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(14, 'inventory.request', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(15, 'inventory.approve', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(16, 'inventory.issue', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(17, 'vendors.manage', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(18, 'contracts.manage', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(19, 'payments.approve', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(20, 'payroll.view', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(21, 'payroll.pay', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(22, 'payroll.advance', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(23, 'payroll.approve', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(24, 'reports.view', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36'),
(25, 'users.view', 'web', '2026-03-03 01:41:53', '2026-03-03 01:41:53'),
(26, 'users.create', 'web', '2026-03-03 01:41:53', '2026-03-03 01:41:53'),
(27, 'users.update', 'web', '2026-03-03 01:41:53', '2026-03-03 01:41:53'),
(28, 'roles.view', 'web', '2026-03-03 01:41:53', '2026-03-03 01:41:53'),
(29, 'roles.create', 'web', '2026-03-03 01:41:53', '2026-03-03 01:41:53'),
(30, 'roles.update', 'web', '2026-03-03 01:41:53', '2026-03-03 01:41:53'),
(31, 'employees.view', 'web', '2026-03-03 01:41:53', '2026-03-03 01:41:53'),
(32, 'employees.create', 'web', '2026-03-03 01:41:53', '2026-03-03 01:41:53'),
(34, 'employees.update\r\n', 'web', '2026-03-03 01:41:53', '2026-03-03 01:41:53');

-- --------------------------------------------------------

--
-- Table structure for table `personal_access_tokens`
--

CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) UNSIGNED NOT NULL,
  `name` text NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `personal_access_tokens`
--

INSERT INTO `personal_access_tokens` (`id`, `tokenable_type`, `tokenable_id`, `name`, `token`, `abilities`, `last_used_at`, `expires_at`, `created_at`, `updated_at`) VALUES
(97, 'App\\Models\\User', 4, 'web', '5bb2267aaf20fc010cb8dee5a7c80d97b0c5729c26b0092957ca9f1a4a7ed964', '[\"*\"]', '2026-03-07 01:18:24', NULL, '2026-03-07 01:13:40', '2026-03-07 01:18:24'),
(102, 'App\\Models\\User', 2, 'web', '485018ecd265d2817bffb75a1b5e864af367ee28b3714be5f2fd5719368b5039', '[\"*\"]', '2026-03-07 01:25:14', NULL, '2026-03-07 01:25:10', '2026-03-07 01:25:14'),
(320, 'App\\Models\\User', 3, 'web', '0f9fd8fc251ff1e2fdfc3b1638cd67ec8afefa0424d9c0278f473627de1b2b8e', '[\"*\"]', '2026-03-14 03:02:00', NULL, '2026-03-14 02:58:43', '2026-03-14 03:02:00'),
(347, 'App\\Models\\User', 13, 'web', '7b7b889b54c6f2159320a2f1be59f54762c4f9e6ded354211cd996a34879dc5b', '[\"*\"]', '2026-03-18 02:22:48', NULL, '2026-03-18 02:18:13', '2026-03-18 02:22:48'),
(359, 'App\\Models\\User', 17, 'web', '13d3d2cb8282681dcf2cef01ae56c0ff0174da3760cc1a1387e915970f83deab', '[\"*\"]', '2026-03-18 07:04:00', NULL, '2026-03-18 03:41:09', '2026-03-18 07:04:00'),
(360, 'App\\Models\\User', 12, 'web', 'aa5ffa31ece23de9e3636d7d27c76e53a93606e0923fee0999012d4aad4f6ef4', '[\"*\"]', '2026-03-18 03:58:28', NULL, '2026-03-18 03:43:38', '2026-03-18 03:58:28'),
(368, 'App\\Models\\User', 1, 'web', 'a1c1635bb36d27fee370d561be6efc84bbf6ec46207b1492a80ca47d8d46cc53', '[\"*\"]', '2026-03-27 23:59:05', NULL, '2026-03-24 05:00:57', '2026-03-27 23:59:05');

-- --------------------------------------------------------

--
-- Table structure for table `projects`
--

CREATE TABLE `projects` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'planned',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `projects`
--

INSERT INTO `projects` (`id`, `uuid`, `name`, `location`, `status`, `start_date`, `end_date`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, '32cc31bc-b81e-4256-9700-d309435bdc0b', 'New Apartment', 'Kabul', 'planned', '2026-03-02', '2027-03-02', '2026-03-24 06:39:20', '2026-03-24 06:39:20', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `rental_payments`
--

CREATE TABLE `rental_payments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `bill_no` varchar(255) DEFAULT NULL,
  `bill_generated_at` timestamp NULL DEFAULT NULL,
  `rental_id` bigint(20) UNSIGNED NOT NULL,
  `period_month` varchar(255) DEFAULT NULL,
  `due_date` date DEFAULT NULL,
  `payment_type` varchar(255) NOT NULL DEFAULT 'monthly',
  `amount_due` decimal(14,2) NOT NULL DEFAULT 0.00,
  `amount_paid` decimal(14,2) NOT NULL DEFAULT 0.00,
  `remaining_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `paid_date` timestamp NULL DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'pending',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `rental_payments`
--

INSERT INTO `rental_payments` (`id`, `uuid`, `bill_no`, `bill_generated_at`, `rental_id`, `period_month`, `due_date`, `payment_type`, `amount_due`, `amount_paid`, `remaining_amount`, `paid_date`, `status`, `notes`, `created_at`, `updated_at`, `approved_by`, `approved_at`) VALUES
(29, '6ab68d98-e7ec-4b23-ac9b-6da1b3f64308', NULL, NULL, 17, NULL, '2026-03-08', 'advance', 1500.00, 1500.00, 0.00, '2026-03-08 05:28:17', 'paid', NULL, '2026-03-08 05:28:17', '2026-03-08 05:28:17', NULL, NULL),
(30, 'a0dbc677-7601-451e-81ac-54f79cd3671f', 'RBL-000030', '2026-03-08 05:28:53', 17, '2026-03', '2026-03-08', 'advance', 500.00, 500.00, 0.00, '2026-03-07 19:30:00', 'paid', NULL, '2026-03-08 05:28:53', '2026-03-08 05:29:20', 1, '2026-03-08 05:29:20'),
(31, '83bdc355-789f-4d10-abc6-66bf11e07eaa', 'RBL-000031', '2026-03-08 05:30:12', 17, '2026-07', '2026-07-08', 'monthly', 500.00, 500.00, 0.00, '2026-03-07 19:30:00', 'paid', NULL, '2026-03-08 05:30:12', '2026-03-08 05:30:50', 1, '2026-03-08 05:30:50'),
(32, '73e1a15b-651a-433e-8f9e-0ca40d4c73f0', 'RBL-000032', '2026-03-08 05:31:09', 17, '2026-08', '2026-08-08', 'monthly', 500.00, 500.00, 0.00, '2026-03-07 19:30:00', 'paid', NULL, '2026-03-08 05:31:09', '2026-03-08 05:31:45', 1, '2026-03-08 05:31:45'),
(33, '65dcdcfa-5bd4-4c7d-8778-0c587484c946', 'RBL-000033', '2026-03-08 05:31:58', 17, '2026-09', '2026-09-08', 'monthly', 500.00, 500.00, 0.00, '2026-03-07 19:30:00', 'paid', NULL, '2026-03-08 05:31:58', '2026-03-08 05:32:14', 1, '2026-03-08 05:32:14'),
(34, '28af790f-32f6-4e2c-a81f-63708d6a84d4', 'RBL-000034', '2026-03-08 05:32:27', 17, '2026-10', '2026-10-08', 'monthly', 500.00, 500.00, 0.00, '2026-03-07 19:30:00', 'paid', NULL, '2026-03-08 05:32:27', '2026-03-08 05:32:44', 1, '2026-03-08 05:32:44'),
(35, 'b5eeca0c-0364-4702-a645-8c123f49f2dc', NULL, NULL, 19, NULL, '2026-03-08', 'advance', 1000.00, 1000.00, 0.00, '2026-03-08 05:49:27', 'paid', NULL, '2026-03-08 05:49:27', '2026-03-08 05:49:27', NULL, NULL),
(36, '4ec21a70-e312-4e96-b314-02a424b7d82d', 'RBL-000036', '2026-03-08 05:50:07', 19, '2026-03', '2026-03-08', 'advance', 1000.00, 1000.00, 0.00, '2026-03-07 19:30:00', 'paid', NULL, '2026-03-08 05:50:07', '2026-03-08 05:50:36', 1, '2026-03-08 05:50:36'),
(37, '151cad5e-f099-4015-af8f-fcbe813d2e18', 'RBL-000037', '2026-03-08 05:51:13', 19, '2026-05', '2026-05-08', 'monthly', 1000.00, 1000.00, 0.00, '2026-03-07 19:30:00', 'paid', NULL, '2026-03-08 05:51:13', '2026-03-08 05:51:40', 1, '2026-03-08 05:51:40'),
(38, '4c19d079-3a8a-42a3-8d5d-d95f1a4a0518', 'RBL-000038', '2026-03-08 06:02:31', 19, '2026-06', '2026-06-08', 'monthly', 1000.00, 0.00, 1000.00, NULL, 'pending', NULL, '2026-03-08 06:02:31', '2026-03-08 06:02:31', NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `rental_payment_receipts`
--

CREATE TABLE `rental_payment_receipts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `rental_payment_id` bigint(20) UNSIGNED DEFAULT NULL,
  `rental_id` bigint(20) UNSIGNED NOT NULL,
  `tenant_id` bigint(20) UNSIGNED DEFAULT NULL,
  `receipt_no` varchar(255) NOT NULL,
  `payment_date` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `amount` decimal(14,2) NOT NULL,
  `payment_method` varchar(255) NOT NULL DEFAULT 'cash',
  `reference_no` varchar(255) DEFAULT NULL,
  `received_by` bigint(20) UNSIGNED DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `rental_payment_receipts`
--

INSERT INTO `rental_payment_receipts` (`id`, `uuid`, `rental_payment_id`, `rental_id`, `tenant_id`, `receipt_no`, `payment_date`, `amount`, `payment_method`, `reference_no`, `received_by`, `notes`, `created_at`, `updated_at`) VALUES
(27, 'f8c271a9-53b5-4a6d-b842-cea8ce1adb50', 29, 17, 18, 'RRC-000001', '2026-03-08 05:28:17', 1500.00, 'cash', NULL, 1, NULL, '2026-03-08 05:28:17', '2026-03-08 05:28:17'),
(28, 'e023e444-a34e-4a73-9fd7-25ce2991e925', 30, 17, 18, 'RRC-000028', '2026-03-07 19:30:00', 500.00, 'cash', NULL, 1, NULL, '2026-03-08 05:29:20', '2026-03-08 05:29:20'),
(29, 'd136786d-1446-44fd-86c9-9bef0712e18a', 31, 17, 18, 'RRC-000029', '2026-03-07 19:30:00', 500.00, 'cash', NULL, 1, NULL, '2026-03-08 05:30:50', '2026-03-08 05:30:50'),
(30, 'f5601738-9846-4d94-9dc9-cc5fc19afcd0', 32, 17, 18, 'RRC-000030', '2026-03-07 19:30:00', 500.00, 'cash', NULL, 1, NULL, '2026-03-08 05:31:45', '2026-03-08 05:31:45'),
(31, '7a831be9-b9ce-4b4d-a3ef-b5ddf4fcbe2b', 33, 17, 18, 'RRC-000031', '2026-03-07 19:30:00', 500.00, 'cash', NULL, 1, NULL, '2026-03-08 05:32:14', '2026-03-08 05:32:14'),
(32, '8c4c23fa-6ae7-4ebb-a9bc-9472194c1cd5', 34, 17, 18, 'RRC-000032', '2026-03-07 19:30:00', 500.00, 'cash', NULL, 1, NULL, '2026-03-08 05:32:44', '2026-03-08 05:32:44'),
(33, 'd741c940-c07d-44a4-b2b7-25eb95de777e', 35, 19, 21, 'RRC-000033', '2026-03-08 05:49:27', 1000.00, 'cash', NULL, 1, NULL, '2026-03-08 05:49:27', '2026-03-08 05:49:27'),
(34, '87ebecf2-e894-40ae-aa6a-19bc2320aae7', 36, 19, 21, 'RRC-000034', '2026-03-07 19:30:00', 1000.00, 'cash', NULL, 1, NULL, '2026-03-08 05:50:36', '2026-03-08 05:50:36'),
(35, '493cc73d-9dff-4c47-8eff-12b7e48bcc1c', 37, 19, 21, 'RRC-000035', '2026-03-07 19:30:00', 1000.00, 'cash', NULL, 1, NULL, '2026-03-08 05:51:40', '2026-03-08 05:51:40');

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `uuid` char(36) NOT NULL,
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `guard_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`uuid`, `id`, `name`, `guard_name`, `created_at`, `updated_at`, `deleted_at`) VALUES
('4b18db9c-ef11-49d4-b6b7-8308ff06094f', 1, 'Admin', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36', NULL),
('ad279ada-3611-4326-afd7-b3a4a1c3184f', 2, 'ApartmentManager', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36', NULL),
('6e7e2ac3-b78b-4ac0-850e-2f4f0a2251e9', 3, 'SalesOfficer', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36', NULL),
('c89ce0dc-6489-48a6-bea9-8e487fd2af59', 4, 'Accountant', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36', NULL),
('83505bea-f6e6-44d5-a0d5-dff109d901f3', 5, 'ProjectManager', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36', NULL),
('6fb88323-9a24-44f6-8399-364e78e3c15b', 6, 'Storekeeper', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36', NULL),
('dc814f65-7272-4c86-bd3a-89cece8a72bc', 7, 'ProcurementOfficer', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36', NULL),
('589c935d-f12c-4801-8a53-3ad6703c743c', 8, 'Auditor', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `role_has_permissions`
--

CREATE TABLE `role_has_permissions` (
  `permission_id` bigint(20) UNSIGNED NOT NULL,
  `role_id` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `role_has_permissions`
--

INSERT INTO `role_has_permissions` (`permission_id`, `role_id`) VALUES
(1, 1),
(1, 2),
(2, 1),
(2, 2),
(3, 1),
(3, 2),
(4, 1),
(4, 2),
(5, 1),
(5, 2),
(6, 1),
(6, 2),
(7, 1),
(7, 3),
(8, 1),
(9, 1),
(9, 3),
(10, 1),
(10, 4),
(11, 1),
(12, 1),
(13, 1),
(14, 1),
(15, 1),
(16, 1),
(17, 1),
(18, 1),
(18, 2),
(19, 1),
(20, 1),
(21, 1),
(22, 1),
(23, 1),
(24, 1),
(31, 1),
(32, 1),
(34, 1);

-- --------------------------------------------------------

--
-- Table structure for table `salary_advances`
--

CREATE TABLE `salary_advances` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `employee_id` bigint(20) UNSIGNED NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `salary_advances`
--

INSERT INTO `salary_advances` (`id`, `uuid`, `employee_id`, `amount`, `user_id`, `reason`, `status`, `deleted_at`, `created_at`, `updated_at`) VALUES
(1, '68ad4c78-8d63-47ea-93ba-54c8998d65c5', 5, 33.00, 1, 'dsf', 'approved', NULL, '2026-03-24 02:26:00', '2026-03-24 02:26:00');

-- --------------------------------------------------------

--
-- Table structure for table `salary_payments`
--

CREATE TABLE `salary_payments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `employee_id` bigint(20) UNSIGNED NOT NULL,
  `period` varchar(100) NOT NULL,
  `gross_salary` decimal(14,2) NOT NULL,
  `advance_deducted` decimal(14,2) NOT NULL DEFAULT 0.00,
  `net_salary` decimal(14,2) NOT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'draft',
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `salary_payments`
--

INSERT INTO `salary_payments` (`id`, `uuid`, `employee_id`, `period`, `gross_salary`, `advance_deducted`, `net_salary`, `status`, `user_id`, `paid_at`, `deleted_at`, `created_at`, `updated_at`) VALUES
(1, 'b466a03c-faed-4748-b576-a0f7d216c4ec', 5, '2026-03', 20000.00, 0.00, 20000.00, 'paid', NULL, '2026-03-24 00:00:00', NULL, '2026-03-24 02:24:52', '2026-03-24 02:25:04'),
(2, 'a7182bb3-655b-4d54-a658-9d1313fb8532', 6, '2026-03', 15000.00, 0.00, 15000.00, 'paid', NULL, '2026-03-24 00:00:00', NULL, '2026-03-24 02:33:00', '2026-03-24 02:33:00');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sessions`
--

INSERT INTO `sessions` (`id`, `user_id`, `ip_address`, `user_agent`, `payload`, `last_activity`) VALUES
('34v8cLdPv6xRoRXWiMTBlDqjYRZOP388HvCkX86u', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', 'YTozOntzOjY6Il90b2tlbiI7czo0MDoiVUZUYWlFa2E3eW9wOFRubkRpWmpVRVBGOEhGeVNrYzZYUnVwdjY4RCI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly9sb2NhbGhvc3Q6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==', 1773820416);

-- --------------------------------------------------------

--
-- Table structure for table `stock_movements`
--

CREATE TABLE `stock_movements` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `material_id` bigint(20) UNSIGNED NOT NULL,
  `warehouse_id` bigint(20) UNSIGNED NOT NULL,
  `project_id` bigint(20) UNSIGNED DEFAULT NULL,
  `employee_id` bigint(20) UNSIGNED DEFAULT NULL,
  `material_request_item_id` bigint(20) UNSIGNED DEFAULT NULL,
  `quantity` decimal(12,2) NOT NULL,
  `movement_type` varchar(50) NOT NULL,
  `reference_type` varchar(50) DEFAULT NULL,
  `reference_no` varchar(100) DEFAULT NULL,
  `approved_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `issued_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `movement_date` datetime NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `stock_movements`
--

INSERT INTO `stock_movements` (`id`, `uuid`, `material_id`, `warehouse_id`, `project_id`, `employee_id`, `material_request_item_id`, `quantity`, `movement_type`, `reference_type`, `reference_no`, `approved_by_user_id`, `issued_by_user_id`, `movement_date`, `notes`, `created_at`, `updated_at`) VALUES
(1, '6a7fc809-d51b-4424-9c0c-b7e662744d6e', 1, 1, 1, 9, 1, 50.00, 'OUT', 'request_issue', 'MIR-000001', 1, 1, '2026-03-24 00:00:00', NULL, '2026-03-24 06:53:26', '2026-03-24 06:53:26');

-- --------------------------------------------------------

--
-- Table structure for table `sync_inbox`
--

CREATE TABLE `sync_inbox` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `idempotency_key` varchar(255) NOT NULL,
  `entity` varchar(255) NOT NULL,
  `entity_uuid` varchar(255) NOT NULL,
  `action` varchar(255) NOT NULL,
  `processed_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `sync_inbox`
--

INSERT INTO `sync_inbox` (`id`, `user_id`, `idempotency_key`, `entity`, `entity_uuid`, `action`, `processed_at`, `created_at`, `updated_at`) VALUES
(1, 1, '80cd06c1-093a-48ac-aa3a-13eefab6103d', 'apartments', '9579b2fd-28ae-4f21-a05e-f579075d9d6b', 'update', '2026-03-01 01:28:54', '2026-03-01 01:28:54', '2026-03-01 01:28:54'),
(2, 1, '9ff06ad9-4b5e-4ae4-902f-0e259810568e', 'apartments', '9579b2fd-28ae-4f21-a05e-f579075d9d6b', 'update', '2026-03-01 01:29:14', '2026-03-01 01:29:14', '2026-03-01 01:29:14'),
(3, 1, '3d4152b5-ef50-43f3-98a3-b41b9a0e09f0', 'apartments', 'c839f49b-5724-4d43-bfdc-699efa18c63d', 'create', '2026-03-01 01:37:19', '2026-03-01 01:37:19', '2026-03-01 01:37:19'),
(4, 1, '44285d79-972a-49d8-8bea-d5584ee4d9ac', 'apartments', 'dc86e9eb-373f-40d9-becf-32b4c59620c4', 'delete', '2026-03-01 01:37:37', '2026-03-01 01:37:37', '2026-03-01 01:37:37'),
(5, 1, '55f6440b-fe68-40e8-8143-b84cc3eb8046', 'apartments', '9579b2fd-28ae-4f21-a05e-f579075d9d6b', 'update', '2026-03-01 01:39:10', '2026-03-01 01:39:10', '2026-03-01 01:39:10'),
(6, 1, 'f9f850bc-b5d9-47b8-b822-4fdabb6e9fa3', 'apartments', '9579b2fd-28ae-4f21-a05e-f579075d9d6b', 'update', '2026-03-01 01:39:26', '2026-03-01 01:39:26', '2026-03-01 01:39:26'),
(7, 1, '2ec8ffb7-05a1-4b44-b104-b027da90ef84', 'apartments', '9579b2fd-28ae-4f21-a05e-f579075d9d6b', 'update', '2026-03-01 01:40:41', '2026-03-01 01:40:41', '2026-03-01 01:40:41'),
(8, 1, '5f2e16cd-5893-479a-a355-6af7324ee30e', 'customers', 'a9c47272-b4bb-44df-8c68-7b595b6685bd', 'delete', '2026-03-01 02:43:56', '2026-03-01 02:43:56', '2026-03-01 02:43:56'),
(9, 1, '65c1704c-4b98-4cc4-b68b-ec3774296e06', 'apartment_sales', 'c2d48aa2-2a47-4d5d-9e2a-e19348d6ae1b', 'delete', '2026-03-02 01:36:09', '2026-03-02 01:36:09', '2026-03-02 01:36:09'),
(10, 1, '7315179f-8157-453a-86bc-949eaf304311', 'apartment_sales', '970583bb-dcbf-4f60-a6a3-52818b28a5e7', 'delete', '2026-03-02 04:00:45', '2026-03-02 04:00:45', '2026-03-02 04:00:45'),
(11, 1, '84fc51f7-aa24-4949-848d-3d73d1837cc0', 'apartment_sales', '10cfb8cb-7636-4b54-8fd0-92bea3e2975d', 'update', '2026-03-02 04:58:16', '2026-03-02 04:58:16', '2026-03-02 04:58:16'),
(12, 1, '08948d77-754a-48d0-a6bc-0402facff967', 'apartment_sale_financials', '10cfb8cb-7636-4b54-8fd0-92bea3e2975d', 'update', '2026-03-02 05:23:07', '2026-03-02 05:23:07', '2026-03-02 05:23:07'),
(13, 1, '5ab00b0a-0a6f-4e6a-9d4a-405d6fc1867b', 'apartment_sale_financials', '10cfb8cb-7636-4b54-8fd0-92bea3e2975d', 'update', '2026-03-02 05:23:08', '2026-03-02 05:23:08', '2026-03-02 05:23:08'),
(14, 1, '219e4336-475e-470c-899b-3b37bac5c3db', 'apartment_sales', '10cfb8cb-7636-4b54-8fd0-92bea3e2975d', 'delete', '2026-03-02 05:36:10', '2026-03-02 05:36:10', '2026-03-02 05:36:10'),
(15, 1, '11edce46-2413-4198-9973-cabfa43871e7', 'apartment_sale_financials', 'd3835ecc-7780-49bc-ac70-84c5bcbd797e', 'update', '2026-03-02 06:07:43', '2026-03-02 06:07:43', '2026-03-02 06:07:43'),
(16, 1, '9965fdde-247d-4f6d-9409-676463f0828b', 'apartment_sale_financials', 'd3835ecc-7780-49bc-ac70-84c5bcbd797e', 'update', '2026-03-02 06:07:51', '2026-03-02 06:07:51', '2026-03-02 06:07:51'),
(17, 1, '841d0c6d-afb1-4903-a277-08e5b1f46cc8', 'apartment_sale_financials', 'd3835ecc-7780-49bc-ac70-84c5bcbd797e', 'update', '2026-03-02 06:08:01', '2026-03-02 06:08:01', '2026-03-02 06:08:01'),
(18, 1, '8e1bade6-dfc8-44be-bf47-4f930266e47a', 'apartment_sale_financials', '1de41a88-14fa-4fb4-8381-229f09ad8891', 'update', '2026-03-02 06:19:41', '2026-03-02 06:19:41', '2026-03-02 06:19:41'),
(19, 1, '48c06cbb-2d8b-41e3-9b4f-cbb645c51fca', 'apartment_sale_financials', 'a81708bb-930c-4268-91ad-056742cc0b81', 'update', '2026-03-02 07:11:56', '2026-03-02 07:11:56', '2026-03-02 07:11:56'),
(20, 1, 'c0f70426-0672-4499-9190-8a6b283459b0', 'apartments', '4badc192-c17b-4f75-8fbc-762233d54c41', 'create', '2026-03-03 00:40:14', '2026-03-03 00:40:14', '2026-03-03 00:40:14'),
(21, 1, 'f00ea061-edec-475a-91a1-2bb0319b8470', 'roles', 'ad279ada-3611-4326-afd7-b3a4a1c3184f', 'update', '2026-03-03 00:55:23', '2026-03-03 00:55:23', '2026-03-03 00:55:23'),
(22, 2, 'c2f01fe1-9095-4f61-8925-9d35de017c20', 'apartment_sale_financials', '92f0c956-7663-4d90-b166-868f78a959b6', 'update', '2026-03-03 01:47:48', '2026-03-03 01:47:48', '2026-03-03 01:47:48'),
(23, 2, '4df4a22c-aa9d-4f30-9289-89190acddcbb', 'apartment_sale_financials', '92f0c956-7663-4d90-b166-868f78a959b6', 'update', '2026-03-03 01:48:07', '2026-03-03 01:48:07', '2026-03-03 01:48:07'),
(24, 2, '5b455c5c-1898-423e-b343-fd544ab283a2', 'apartment_sale_financials', 'd19107a4-873b-4f3b-aa85-aa04e092763d', 'update', '2026-03-03 02:17:33', '2026-03-03 02:17:33', '2026-03-03 02:17:33'),
(25, 2, 'c091f8ac-6264-4f34-a524-75447024e7fd', 'roles', 'c89ce0dc-6489-48a6-bea9-8e487fd2af59', 'update', '2026-03-07 00:12:19', '2026-03-07 00:12:19', '2026-03-07 00:12:19'),
(26, 2, '0bf2b422-8f7c-4397-a268-b3782998f764', 'roles', 'ad279ada-3611-4326-afd7-b3a4a1c3184f', 'update', '2026-03-07 00:14:22', '2026-03-07 00:14:22', '2026-03-07 00:14:22'),
(27, 1, 'b1ae922f-1361-4b4c-aabd-228d7af92c8e', 'roles', '6e7e2ac3-b78b-4ac0-850e-2f4f0a2251e9', 'update', '2026-03-07 00:26:36', '2026-03-07 00:26:36', '2026-03-07 00:26:36'),
(28, 1, 'a692d529-a44c-4181-9f3d-079295d2eecc', 'roles', 'c89ce0dc-6489-48a6-bea9-8e487fd2af59', 'update', '2026-03-07 00:33:09', '2026-03-07 00:33:09', '2026-03-07 00:33:09'),
(29, 3, '511dda3a-a892-4a03-a05a-129bcadb6e5e', 'installments', '2695f8a5-bcb6-479b-90d4-201452def795', 'update', '2026-03-07 00:53:29', '2026-03-07 00:53:29', '2026-03-07 00:53:29'),
(30, 1, 'b012691f-23a6-42a7-92d0-1c533435d80b', 'customers', 'e9156aa9-c623-4e9d-a39a-d55ca9d0f7c4', 'update', '2026-03-07 01:34:26', '2026-03-07 01:34:26', '2026-03-07 01:34:26'),
(31, 1, '563406b8-0dd7-435d-8f81-c28434122bb6', 'customers', 'e9156aa9-c623-4e9d-a39a-d55ca9d0f7c4', 'update', '2026-03-07 01:49:29', '2026-03-07 01:49:29', '2026-03-07 01:49:29'),
(32, 1, 'a0d4a90f-78c9-4c55-8912-9aac2795c80c', 'customers', '5e4390c8-2490-4dc6-91e0-270cdefa85ee', 'create', '2026-03-07 01:51:29', '2026-03-07 01:51:29', '2026-03-07 01:51:29'),
(33, 1, '2a3035fb-743f-476a-b4dc-21aa708b8f38', 'customers', 'a607c2ec-2a22-4fe1-81ac-5d40d79db4ed', 'create', '2026-03-07 02:13:40', '2026-03-07 02:13:40', '2026-03-07 02:13:40'),
(34, 1, '4b250d11-6b6b-4c35-a262-23c55bceb261', 'customers', '9461f2b3-dd8d-49f1-82c0-1060e10aad58', 'create', '2026-03-07 02:16:29', '2026-03-07 02:16:29', '2026-03-07 02:16:29'),
(35, 1, '60da68bb-20fe-431f-88cb-fe1ec496f8b7', 'customers', '51da86d1-9efc-4745-b64c-d9bda2f6c5d8', 'create', '2026-03-07 05:13:06', '2026-03-07 05:13:06', '2026-03-07 05:13:06'),
(36, 1, 'f3fe0e89-9705-4c1b-9c30-8279eb4bc698', 'apartments', '643ff98c-4f28-4ce0-97df-33e89ede7853', 'create', '2026-03-07 05:13:06', '2026-03-07 05:13:06', '2026-03-07 05:13:06'),
(37, 1, '2e6cd5b2-0e58-4cfe-acae-1548f14f828e', 'apartments', 'e320d3ff-918d-42f1-b4a4-6b933260d47b', 'update', '2026-03-08 04:25:11', '2026-03-08 04:25:11', '2026-03-08 04:25:11'),
(38, 1, 'd4a69cc3-4620-46ef-9977-230dac8bfaa2', 'apartments', '5a677259-a2f8-4ace-ae03-a87f03f3af41', 'update', '2026-03-08 04:32:20', '2026-03-08 04:32:20', '2026-03-08 04:32:20'),
(39, 1, '1cc2f206-4cae-49ff-befd-282f643dfcc7', 'apartments', '643ff98c-4f28-4ce0-97df-33e89ede7853', 'update', '2026-03-08 04:36:34', '2026-03-08 04:36:34', '2026-03-08 04:36:34'),
(40, 1, '27a3f44a-a5ae-4174-8c3e-a52bab85c33c', 'apartments', 'c51d55b5-6eee-4fdd-902b-dbf889b99408', 'update', '2026-03-08 04:53:38', '2026-03-08 04:53:38', '2026-03-08 04:53:38'),
(41, 1, '0077bacc-5317-42e8-ac2d-e120e9ae6887', 'apartments', '643ff98c-4f28-4ce0-97df-33e89ede7853', 'update', '2026-03-08 05:27:36', '2026-03-08 05:27:36', '2026-03-08 05:27:36'),
(42, 1, '59030d3b-c975-4501-a0dd-29cad6edf36a', 'customers', '60ef4390-ece7-434e-8c65-e485ed7b4646', 'update', '2026-03-09 05:54:27', '2026-03-09 05:54:27', '2026-03-09 05:54:27'),
(43, 1, 'ff554f45-b0ae-42bf-b026-f48d39e941b4', 'customers', '25f4c34b-931a-49a6-a1a5-1e12054c80bb', 'update', '2026-03-09 06:30:29', '2026-03-09 06:30:29', '2026-03-09 06:30:29'),
(44, 1, '9e0a9861-c0ad-4109-a677-f6c4c054af07', 'customers', '25f4c34b-931a-49a6-a1a5-1e12054c80bb', 'update', '2026-03-09 06:35:52', '2026-03-09 06:35:52', '2026-03-09 06:35:52'),
(45, 1, '4776a712-163f-44ba-9fe8-2f89d030968e', 'customers', '25f4c34b-931a-49a6-a1a5-1e12054c80bb', 'update', '2026-03-09 06:39:12', '2026-03-09 06:39:12', '2026-03-09 06:39:12'),
(46, 1, 'cca984e4-798f-45b4-9267-475b4f1e1d26', 'customers', '25f4c34b-931a-49a6-a1a5-1e12054c80bb', 'update', '2026-03-09 06:48:12', '2026-03-09 06:48:12', '2026-03-09 06:48:12'),
(47, 1, 'ed16bf67-af50-498d-bd16-96094b669e1c', 'customers', 'e8b3e9cd-37a6-4fda-9723-0c94a3ea3c09', 'update', '2026-03-09 06:53:28', '2026-03-09 06:53:28', '2026-03-09 06:53:28'),
(48, 1, 'df17658c-faeb-49a1-bcc7-c9bce4e8cb90', 'customers', '25f4c34b-931a-49a6-a1a5-1e12054c80bb', 'update', '2026-03-10 00:26:31', '2026-03-10 00:26:31', '2026-03-10 00:26:31'),
(49, 1, '483c7fdc-798d-4ddf-836a-3e339274a897', 'customers', '25f4c34b-931a-49a6-a1a5-1e12054c80bb', 'update', '2026-03-10 00:29:32', '2026-03-10 00:29:32', '2026-03-10 00:29:32'),
(50, 1, '8643f254-d394-44ee-87f3-e3b58d948849', 'customers', '25f4c34b-931a-49a6-a1a5-1e12054c80bb', 'update', '2026-03-10 00:32:47', '2026-03-10 00:32:47', '2026-03-10 00:32:47'),
(51, 1, 'c79584cc-b792-403c-939f-c3640647dfbd', 'users', '8b2c3c8e-6d55-4f25-8c20-bd610ad9c8dd', 'create', '2026-03-11 02:23:36', '2026-03-11 02:23:36', '2026-03-11 02:23:36'),
(52, 1, '81bb7b8d-7442-4b42-a7a9-7cd0971fd555', 'users', '8b2c3c8e-6d55-4f25-8c20-bd610ad9c8dd', 'delete', '2026-03-11 04:28:33', '2026-03-11 04:28:33', '2026-03-11 04:28:33'),
(53, 1, 'febb7955-b66e-47b7-9652-ec473c91cbbc', 'users', 'e66b5f50-904c-4f03-8c2e-a447c0745427', 'create', '2026-03-11 04:28:34', '2026-03-11 04:28:34', '2026-03-11 04:28:34'),
(54, 1, '015132ee-9221-48bc-9914-408deee18291', 'users', 'ad418d44-7451-40ea-aa49-8c0be534730f', 'create', '2026-03-11 04:34:12', '2026-03-11 04:34:12', '2026-03-11 04:34:12'),
(55, 1, '547aa34a-ed8c-462f-86f8-3f1bbe8ddd2a', 'users', 'e66b5f50-904c-4f03-8c2e-a447c0745427', 'delete', '2026-03-11 04:34:14', '2026-03-11 04:34:14', '2026-03-11 04:34:14'),
(56, 1, '14fa12c5-41fb-474a-889c-a97b76d3e7e4', 'users', '5af1f3dc-8e6c-449d-b3cc-53da45479951', 'delete', '2026-03-11 04:52:35', '2026-03-11 04:52:35', '2026-03-11 04:52:35'),
(57, 1, '1e875ee8-79a5-4eee-954c-da1344dee1f4', 'users', 'ad418d44-7451-40ea-aa49-8c0be534730f', 'delete', '2026-03-11 05:04:18', '2026-03-11 05:04:18', '2026-03-11 05:04:18'),
(58, 1, '61646b59-3aa0-43e1-9a21-e82bf7fd4e46', 'users', '9153e110-68aa-4ede-8d3a-3187f3519729', 'delete', '2026-03-11 05:28:00', '2026-03-11 05:28:00', '2026-03-11 05:28:00'),
(59, 1, '2dbad34b-3a64-42e3-a26c-9a0bb6dbac44', 'users', '29beb29b-294a-4a0d-81bf-a00306052faf', 'create', '2026-03-12 02:31:36', '2026-03-12 02:31:36', '2026-03-12 02:31:36'),
(60, 1, '9b3dd9d7-1c0d-442b-96f1-a74984ddf9b8', 'users', '6a557969-3dfe-4fa3-b0f9-151f297f2a14', 'create', '2026-03-12 03:22:13', '2026-03-12 03:22:13', '2026-03-12 03:22:13'),
(61, 1, 'a448991e-b1cc-43b6-9db1-fdafab0abd94', 'users', '05e34671-a205-4eb9-93c1-f572183d519b', 'create', '2026-03-12 04:19:53', '2026-03-12 04:19:53', '2026-03-12 04:19:53'),
(62, 1, '4b9e035d-e77b-4f67-af2c-c562ab382dc4', 'users', '05e34671-a205-4eb9-93c1-f572183d519b', 'delete', '2026-03-12 04:20:38', '2026-03-12 04:20:38', '2026-03-12 04:20:38'),
(63, 1, '51fa63a0-6e77-45f7-befc-ea5b429e605a', 'users', '6a557969-3dfe-4fa3-b0f9-151f297f2a14', 'delete', '2026-03-12 04:21:18', '2026-03-12 04:21:18', '2026-03-12 04:21:18'),
(64, 1, '48a6c415-399f-4a8f-8721-255cb55c8585', 'users', '29beb29b-294a-4a0d-81bf-a00306052faf', 'delete', '2026-03-12 04:21:28', '2026-03-12 04:21:28', '2026-03-12 04:21:28'),
(65, 1, '0731980b-e992-41a5-af50-31b2f312883a', 'users', '095e0058-35c5-4bbc-9745-8ca805c9b525', 'create', '2026-03-14 03:14:38', '2026-03-14 03:14:38', '2026-03-14 03:14:38'),
(66, 1, 'dd2b5d6e-592c-44fc-af51-1d3223960da1', 'users', 'faf2c756-de04-4e8d-a145-adba997e3e9c', 'create', '2026-03-14 03:17:24', '2026-03-14 03:17:24', '2026-03-14 03:17:24'),
(67, 1, '825e5a0e-bb40-4c4c-8fcd-eb51e8118b04', 'users', 'a569bb5e-fd90-4f92-a562-c9c7e1bb5398', 'create', '2026-03-17 01:29:45', '2026-03-17 01:29:45', '2026-03-17 01:29:45'),
(68, 1, 'cfe1455f-ff4a-4a24-a2b2-f876deb8b885', 'users', 'ad821e3b-2a90-4213-86b0-3b28c5eb6924', 'delete', '2026-03-17 05:43:33', '2026-03-17 05:43:33', '2026-03-17 05:43:33'),
(69, 1, '4b4c85a8-9732-4efb-823d-c202add59fe8', 'users', '095e0058-35c5-4bbc-9745-8ca805c9b525', 'delete', '2026-03-17 05:47:34', '2026-03-17 05:47:34', '2026-03-17 05:47:34'),
(70, 1, '3495ea3f-3e0e-4f89-9536-34eed3ac1293', 'users', '767cc225-6f07-43bd-9045-889be61becfb', 'create', '2026-03-17 05:48:34', '2026-03-17 05:48:34', '2026-03-17 05:48:34'),
(71, 1, '79f058aa-b0ba-4072-b166-e9de23586c92', 'users', 'e4a8ce8d-cc87-4eb4-af69-2251e5731575', 'create', '2026-03-17 05:48:42', '2026-03-17 05:48:42', '2026-03-17 05:48:42'),
(72, 1, '39e3c05b-8795-40de-80ea-8d0c8b801f98', 'apartments', '643ff98c-4f28-4ce0-97df-33e89ede7853', 'delete', '2026-03-17 06:32:55', '2026-03-17 06:32:55', '2026-03-17 06:32:55'),
(73, 1, 'e9469c7b-2cc9-4c69-bf51-b7a952fcdbb1', 'users', 'e4a8ce8d-cc87-4eb4-af69-2251e5731575', 'delete', '2026-03-17 06:50:06', '2026-03-17 06:50:06', '2026-03-17 06:50:06'),
(74, 1, '50e21d8d-ca1b-45ed-9e20-f8a151e234b3', 'users', '767cc225-6f07-43bd-9045-889be61becfb', 'delete', '2026-03-17 06:50:11', '2026-03-17 06:50:11', '2026-03-17 06:50:11'),
(75, 12, 'df1200f3-2ad4-43a4-854b-a5a9def6b874', 'apartment_sales', 'fdcd9b8f-b2f6-4553-89fd-f1d6861233fb', 'create', '2026-03-18 02:25:35', '2026-03-18 02:25:35', '2026-03-18 02:25:35'),
(76, 17, '550040b3-626d-4c0f-b6b4-d543d9067ecd', 'installments', '0783907c-1fe3-46b4-935c-f0933ec8c0d3', 'update', '2026-03-18 03:42:46', '2026-03-18 03:42:46', '2026-03-18 03:42:46'),
(77, 1, 'f79b811e-f109-4505-bf6a-4363cffd9756', 'salary_payments', 'b466a03c-faed-4748-b576-a0f7d216c4ec', 'update', '2026-03-24 02:25:04', '2026-03-24 02:25:04', '2026-03-24 02:25:04'),
(78, 1, 'ef21eda4-48f7-4fcb-b15e-a705255897d3', 'salary_payments', 'a7182bb3-655b-4d54-a658-9d1313fb8532', 'create', '2026-03-24 02:33:00', '2026-03-24 02:33:00', '2026-03-24 02:33:00');

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

CREATE TABLE `system_settings` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `key` varchar(255) NOT NULL,
  `value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`value`)),
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `system_settings`
--

INSERT INTO `system_settings` (`id`, `key`, `value`, `updated_by`, `created_at`, `updated_at`) VALUES
(1, 'offline_policy', '{\"system_offline_until\":null,\"unsynced_delete_at\":null,\"unsynced_retention_days\":365,\"module_retention_days\":{\"customers\":365,\"apartments\":365,\"apartment_sales\":365,\"apartment_sale_financials\":365,\"installments\":365,\"roles\":365,\"users\":365,\"rentals\":365,\"rental_payments\":365,\"salary_advances\":365,\"salary_payments\":365}}', 1, '2026-03-10 02:14:48', '2026-03-24 02:40:31');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `last_login_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `uuid`, `full_name`, `name`, `email`, `phone`, `email_verified_at`, `password`, `status`, `remember_token`, `created_at`, `updated_at`, `last_login_at`, `deleted_at`) VALUES
(1, '290225db-0f79-49dd-9bb2-8e4fea19eb65', NULL, 'System Admin', 'yaftomict@gmail.com', '000000000', NULL, '$2y$12$qQrL31Z3kh5UXlaa0zLtnO5DoTGwi93OaL4mA1Wv9bx6sm92kV6ju', 'active', NULL, '2026-02-28 02:40:37', '2026-03-24 05:00:57', '2026-03-24 05:00:57', NULL),
(2, '5af1f3dc-8e6c-449d-b3cc-53da45479951', 'Ahmad', 'Ahmad', 'ahmad@gmail.com', NULL, NULL, '$2y$12$HVLmREPL76Bhk3bRRDw.ZOnc0TeLtSOiDXDsN2JD8ZBkhv8WgMZJ2', 'active', NULL, '2026-03-03 00:53:18', '2026-03-11 04:52:35', '2026-03-07 01:25:10', '2026-03-23 07:06:40'),
(3, 'ad821e3b-2a90-4213-86b0-3b28c5eb6924', 'tahir', 'tahir', 'tahir@gmail.com', NULL, NULL, '$2y$12$qQrL31Z3kh5UXlaa0zLtnO5DoTGwi93OaL4mA1Wv9bx6sm92kV6ju', 'active', NULL, '2026-03-07 00:11:52', '2026-03-17 05:43:33', '2026-03-14 02:58:43', '2026-03-17 05:43:33'),
(12, 'faf2c756-de04-4e8d-a145-adba997e3e9c', 'shams', 'shams', 'shams@gmail.com', NULL, NULL, '$2y$12$iQN0xDA5s2I//t.BzC6fbOrwG16H1shhRJEZfWTKTYms/4JfIsjei', 'active', NULL, '2026-03-14 03:17:24', '2026-03-18 03:43:38', '2026-03-18 03:43:38', NULL),
(13, 'a569bb5e-fd90-4f92-a562-c9c7e1bb5398', 'wazir', 'wazir', 'wazir@gmail.com', NULL, NULL, '$2y$12$3sJ82Jpk7pMw2Y7Wtk2Nw.5CBTFKQsBBE8nfh/dO.DCbfvUMVWt/i', 'active', NULL, '2026-03-17 01:29:45', '2026-03-18 02:18:13', '2026-03-18 02:18:13', NULL),
(17, '548663d5-8770-4617-b458-72e17e31f364', 'example', 'example', 'example@gmail.com', NULL, NULL, '$2y$12$mo/pPHymcIpfE1QUrh8LvulUPuyS.CbJSGA2LnfJV2V7urTnMWIKG', 'active', NULL, '2026-03-18 03:10:12', '2026-03-18 03:41:09', '2026-03-18 03:41:09', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `vendors`
--

CREATE TABLE `vendors` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `phone` varchar(50) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `vendors`
--

INSERT INTO `vendors` (`id`, `uuid`, `name`, `phone`, `email`, `address`, `status`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'c71d6336-3bec-40a8-8caa-a1c1d34f0822', 'ALpha', '1123', 'alpha@gmail.com', 'ssdf', 'active', '2026-03-24 06:46:44', '2026-03-24 06:46:44', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `warehouses`
--

CREATE TABLE `warehouses` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `warehouses`
--

INSERT INTO `warehouses` (`id`, `uuid`, `name`, `location`, `status`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, '11387a1e-50a3-4c84-bbeb-64879997b4ca', 'Darl-Aman', 'kabul', 'active', '2026-03-24 05:58:51', '2026-03-24 05:58:51', NULL);

--
-- Indexes for dumped tables
--

--
-- Indexes for table `apartments`
--
ALTER TABLE `apartments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `apartments_uuid_unique` (`uuid`),
  ADD UNIQUE KEY `apartments_apartment_code_unique` (`apartment_code`);

--
-- Indexes for table `apartment_rentals`
--
ALTER TABLE `apartment_rentals`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `apartment_rentals_uuid_unique` (`uuid`),
  ADD UNIQUE KEY `apartment_rentals_rental_id_unique` (`rental_id`),
  ADD KEY `apartment_rentals_created_by_foreign` (`created_by`),
  ADD KEY `apartment_rentals_key_handover_by_foreign` (`key_handover_by`),
  ADD KEY `apartment_rentals_key_returned_by_foreign` (`key_returned_by`),
  ADD KEY `apartment_rentals_apartment_id_status_index` (`apartment_id`,`status`),
  ADD KEY `apartment_rentals_tenant_id_status_index` (`tenant_id`,`status`),
  ADD KEY `apartment_rentals_status_next_due_date_index` (`status`,`next_due_date`);

--
-- Indexes for table `apartment_sales`
--
ALTER TABLE `apartment_sales`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `apartment_sales_uuid_unique` (`uuid`),
  ADD UNIQUE KEY `apartment_sales_sale_id_unique` (`sale_id`),
  ADD KEY `apartment_sales_apartment_id_foreign` (`apartment_id`),
  ADD KEY `apartment_sales_customer_id_foreign` (`customer_id`),
  ADD KEY `apartment_sales_deed_issued_by_foreign` (`deed_issued_by`),
  ADD KEY `apartment_sales_user_id_foreign` (`user_id`),
  ADD KEY `apartment_sales_key_handover_by_foreign` (`key_handover_by`),
  ADD KEY `apartment_sales_key_returned_by_foreign` (`key_returned_by`);

--
-- Indexes for table `apartment_sale_financials`
--
ALTER TABLE `apartment_sale_financials`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `apartment_sale_financials_uuid_unique` (`uuid`),
  ADD UNIQUE KEY `apartment_sale_financials_apartment_sale_id_unique` (`apartment_sale_id`);

--
-- Indexes for table `apartment_sale_possession_logs`
--
ALTER TABLE `apartment_sale_possession_logs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `apartment_sale_possession_logs_uuid_unique` (`uuid`),
  ADD KEY `apartment_sale_possession_logs_apartment_sale_id_foreign` (`apartment_sale_id`),
  ADD KEY `apartment_sale_possession_logs_user_id_foreign` (`user_id`);

--
-- Indexes for table `apartment_sale_terminations`
--
ALTER TABLE `apartment_sale_terminations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `apartment_sale_terminations_apartment_sale_id_unique` (`apartment_sale_id`);

--
-- Indexes for table `approvals`
--
ALTER TABLE `approvals`
  ADD PRIMARY KEY (`id`),
  ADD KEY `approvals_module_reference_id_index` (`module`,`reference_id`),
  ADD KEY `approvals_requested_by_foreign` (`requested_by`);

--
-- Indexes for table `approval_logs`
--
ALTER TABLE `approval_logs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `approval_logs_approval_id_foreign` (`approval_id`),
  ADD KEY `approval_logs_approved_by_foreign` (`approved_by`);

--
-- Indexes for table `asset_assignments`
--
ALTER TABLE `asset_assignments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `asset_assignments_uuid_unique` (`uuid`),
  ADD KEY `asset_assignments_asset_request_id_foreign` (`asset_request_id`),
  ADD KEY `asset_assignments_employee_id_foreign` (`employee_id`),
  ADD KEY `asset_assignments_asset_id_status_index` (`asset_id`,`status`);

--
-- Indexes for table `asset_requests`
--
ALTER TABLE `asset_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `asset_requests_uuid_unique` (`uuid`),
  ADD UNIQUE KEY `asset_requests_request_no_unique` (`request_no`),
  ADD KEY `asset_requests_requested_by_employee_id_foreign` (`requested_by_employee_id`),
  ADD KEY `asset_requests_requested_asset_id_foreign` (`requested_asset_id`),
  ADD KEY `asset_requests_approved_by_user_id_foreign` (`approved_by_user_id`),
  ADD KEY `asset_requests_allocated_by_user_id_foreign` (`allocated_by_user_id`),
  ADD KEY `asset_requests_status_updated_at_index` (`status`,`updated_at`);

--
-- Indexes for table `cache`
--
ALTER TABLE `cache`
  ADD PRIMARY KEY (`key`);

--
-- Indexes for table `cache_locks`
--
ALTER TABLE `cache_locks`
  ADD PRIMARY KEY (`key`);

--
-- Indexes for table `company_assets`
--
ALTER TABLE `company_assets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `company_assets_uuid_unique` (`uuid`),
  ADD UNIQUE KEY `company_assets_asset_code_unique` (`asset_code`),
  ADD KEY `company_assets_supplier_id_foreign` (`supplier_id`),
  ADD KEY `company_assets_current_employee_id_foreign` (`current_employee_id`);

--
-- Indexes for table `crm_messages`
--
ALTER TABLE `crm_messages`
  ADD PRIMARY KEY (`id`),
  ADD KEY `crm_messages_customer_id_channel_status_index` (`customer_id`,`channel`,`status`),
  ADD KEY `crm_msg_installment_channel_created_idx` (`installment_id`,`channel`,`created_at`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `customers_uuid_unique` (`uuid`),
  ADD KEY `customers_phone_index` (`phone`),
  ADD KEY `customers_deleted_at_index` (`deleted_at`);

--
-- Indexes for table `documents`
--
ALTER TABLE `documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `documents_module_reference_idx` (`module`,`reference_id`),
  ADD KEY `documents_module_type_idx` (`module`,`document_type`);

--
-- Indexes for table `employees`
--
ALTER TABLE `employees`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `employees_uuid_unique` (`uuid`);

--
-- Indexes for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`);

--
-- Indexes for table `installments`
--
ALTER TABLE `installments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `installments_uuid_unique` (`uuid`),
  ADD KEY `installments_apartment_sale_id_foreign` (`apartment_sale_id`);

--
-- Indexes for table `installment_payments`
--
ALTER TABLE `installment_payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `installment_payments_uuid_unique` (`uuid`),
  ADD KEY `installment_payments_installment_id_foreign` (`installment_id`),
  ADD KEY `installment_payments_received_by_foreign` (`received_by`);

--
-- Indexes for table `jobs`
--
ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `jobs_queue_index` (`queue`);

--
-- Indexes for table `job_batches`
--
ALTER TABLE `job_batches`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `materials`
--
ALTER TABLE `materials`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `materials_uuid_unique` (`uuid`),
  ADD KEY `materials_supplier_id_foreign` (`supplier_id`);

--
-- Indexes for table `material_requests`
--
ALTER TABLE `material_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `material_requests_uuid_unique` (`uuid`),
  ADD UNIQUE KEY `material_requests_request_no_unique` (`request_no`),
  ADD KEY `material_requests_warehouse_id_foreign` (`warehouse_id`),
  ADD KEY `material_requests_requested_by_employee_id_foreign` (`requested_by_employee_id`),
  ADD KEY `material_requests_approved_by_user_id_foreign` (`approved_by_user_id`),
  ADD KEY `material_requests_issued_by_user_id_foreign` (`issued_by_user_id`),
  ADD KEY `material_requests_status_updated_at_index` (`status`,`updated_at`);

--
-- Indexes for table `material_request_items`
--
ALTER TABLE `material_request_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `material_request_items_uuid_unique` (`uuid`),
  ADD KEY `material_request_items_material_request_id_foreign` (`material_request_id`),
  ADD KEY `material_request_items_material_id_foreign` (`material_id`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `model_has_permissions`
--
ALTER TABLE `model_has_permissions`
  ADD PRIMARY KEY (`permission_id`,`model_id`,`model_type`),
  ADD KEY `model_has_permissions_model_id_model_type_index` (`model_id`,`model_type`);

--
-- Indexes for table `model_has_roles`
--
ALTER TABLE `model_has_roles`
  ADD PRIMARY KEY (`role_id`,`model_id`,`model_type`),
  ADD KEY `model_has_roles_model_id_model_type_index` (`model_id`,`model_type`);

--
-- Indexes for table `municipality_payment_letters`
--
ALTER TABLE `municipality_payment_letters`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `municipality_payment_letters_uuid_unique` (`uuid`),
  ADD UNIQUE KEY `municipality_payment_letters_apartment_sale_id_unique` (`apartment_sale_id`),
  ADD UNIQUE KEY `municipality_payment_letters_letter_no_unique` (`letter_no`);

--
-- Indexes for table `municipality_receipts`
--
ALTER TABLE `municipality_receipts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `municipality_receipts_uuid_unique` (`uuid`),
  ADD UNIQUE KEY `municipality_receipts_receipt_no_unique` (`receipt_no`),
  ADD KEY `municipality_receipts_apartment_sale_id_foreign` (`apartment_sale_id`),
  ADD KEY `municipality_receipts_received_by_foreign` (`received_by`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `notifications_notifiable_type_notifiable_id_index` (`notifiable_type`,`notifiable_id`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`email`);

--
-- Indexes for table `permissions`
--
ALTER TABLE `permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `permissions_name_guard_name_unique` (`name`,`guard_name`);

--
-- Indexes for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  ADD KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  ADD KEY `personal_access_tokens_expires_at_index` (`expires_at`);

--
-- Indexes for table `projects`
--
ALTER TABLE `projects`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `projects_uuid_unique` (`uuid`),
  ADD KEY `projects_status_updated_at_index` (`status`,`updated_at`);

--
-- Indexes for table `rental_payments`
--
ALTER TABLE `rental_payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `rental_payments_uuid_unique` (`uuid`),
  ADD UNIQUE KEY `rental_payments_bill_no_unique` (`bill_no`),
  ADD KEY `rental_payments_rental_id_status_index` (`rental_id`,`status`),
  ADD KEY `rental_payments_rental_id_due_date_index` (`rental_id`,`due_date`),
  ADD KEY `rental_payments_payment_type_status_index` (`payment_type`,`status`),
  ADD KEY `rental_payments_period_month_index` (`period_month`),
  ADD KEY `rental_payments_bill_generated_at_index` (`bill_generated_at`),
  ADD KEY `rental_payments_approved_by_approved_at_index` (`approved_by`,`approved_at`);

--
-- Indexes for table `rental_payment_receipts`
--
ALTER TABLE `rental_payment_receipts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `rental_payment_receipts_uuid_unique` (`uuid`),
  ADD UNIQUE KEY `rental_payment_receipts_receipt_no_unique` (`receipt_no`),
  ADD KEY `rental_payment_receipts_tenant_id_foreign` (`tenant_id`),
  ADD KEY `rental_payment_receipts_received_by_foreign` (`received_by`),
  ADD KEY `rental_payment_receipts_rental_id_payment_date_index` (`rental_id`,`payment_date`),
  ADD KEY `rental_payment_receipts_rental_payment_id_index` (`rental_payment_id`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `roles_name_guard_name_unique` (`name`,`guard_name`),
  ADD UNIQUE KEY `roles_uuid_unique` (`uuid`),
  ADD KEY `roles_deleted_at_index` (`deleted_at`);

--
-- Indexes for table `role_has_permissions`
--
ALTER TABLE `role_has_permissions`
  ADD PRIMARY KEY (`permission_id`,`role_id`),
  ADD KEY `role_has_permissions_role_id_foreign` (`role_id`);

--
-- Indexes for table `salary_advances`
--
ALTER TABLE `salary_advances`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `salary_advances_uuid_unique` (`uuid`),
  ADD KEY `salary_advances_user_id_foreign` (`user_id`),
  ADD KEY `salary_advances_employee_id_status_index` (`employee_id`,`status`),
  ADD KEY `salary_advances_updated_at_index` (`updated_at`);

--
-- Indexes for table `salary_payments`
--
ALTER TABLE `salary_payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `salary_payments_uuid_unique` (`uuid`),
  ADD KEY `salary_payments_user_id_foreign` (`user_id`),
  ADD KEY `salary_payments_employee_id_status_index` (`employee_id`,`status`),
  ADD KEY `salary_payments_period_index` (`period`),
  ADD KEY `salary_payments_updated_at_index` (`updated_at`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sessions_user_id_index` (`user_id`),
  ADD KEY `sessions_last_activity_index` (`last_activity`);

--
-- Indexes for table `stock_movements`
--
ALTER TABLE `stock_movements`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `stock_movements_uuid_unique` (`uuid`),
  ADD KEY `stock_movements_material_id_movement_date_index` (`material_id`,`movement_date`),
  ADD KEY `stock_movements_warehouse_id_movement_date_index` (`warehouse_id`,`movement_date`),
  ADD KEY `stock_movements_project_id_movement_date_index` (`project_id`,`movement_date`),
  ADD KEY `stock_movements_movement_type_movement_date_index` (`movement_type`,`movement_date`);

--
-- Indexes for table `sync_inbox`
--
ALTER TABLE `sync_inbox`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `sync_inbox_idempotency_key_unique` (`idempotency_key`),
  ADD KEY `sync_inbox_user_id_foreign` (`user_id`),
  ADD KEY `sync_inbox_entity_entity_uuid_index` (`entity`,`entity_uuid`);

--
-- Indexes for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `system_settings_key_unique` (`key`),
  ADD KEY `system_settings_updated_by_foreign` (`updated_by`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_email_unique` (`email`),
  ADD UNIQUE KEY `users_uuid_unique` (`uuid`),
  ADD KEY `users_deleted_at_index` (`deleted_at`);

--
-- Indexes for table `vendors`
--
ALTER TABLE `vendors`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `vendors_uuid_unique` (`uuid`);

--
-- Indexes for table `warehouses`
--
ALTER TABLE `warehouses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `warehouses_uuid_unique` (`uuid`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `apartments`
--
ALTER TABLE `apartments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT for table `apartment_rentals`
--
ALTER TABLE `apartment_rentals`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=20;

--
-- AUTO_INCREMENT for table `apartment_sales`
--
ALTER TABLE `apartment_sales`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=38;

--
-- AUTO_INCREMENT for table `apartment_sale_financials`
--
ALTER TABLE `apartment_sale_financials`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT for table `apartment_sale_possession_logs`
--
ALTER TABLE `apartment_sale_possession_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=21;

--
-- AUTO_INCREMENT for table `apartment_sale_terminations`
--
ALTER TABLE `apartment_sale_terminations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `approvals`
--
ALTER TABLE `approvals`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `approval_logs`
--
ALTER TABLE `approval_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `asset_assignments`
--
ALTER TABLE `asset_assignments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `asset_requests`
--
ALTER TABLE `asset_requests`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `company_assets`
--
ALTER TABLE `company_assets`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `crm_messages`
--
ALTER TABLE `crm_messages`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=34;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=26;

--
-- AUTO_INCREMENT for table `documents`
--
ALTER TABLE `documents`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `employees`
--
ALTER TABLE `employees`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `installments`
--
ALTER TABLE `installments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=84;

--
-- AUTO_INCREMENT for table `installment_payments`
--
ALTER TABLE `installment_payments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT for table `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `materials`
--
ALTER TABLE `materials`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `material_requests`
--
ALTER TABLE `material_requests`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `material_request_items`
--
ALTER TABLE `material_request_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=77;

--
-- AUTO_INCREMENT for table `municipality_payment_letters`
--
ALTER TABLE `municipality_payment_letters`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `municipality_receipts`
--
ALTER TABLE `municipality_receipts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `permissions`
--
ALTER TABLE `permissions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=35;

--
-- AUTO_INCREMENT for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=369;

--
-- AUTO_INCREMENT for table `projects`
--
ALTER TABLE `projects`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `rental_payments`
--
ALTER TABLE `rental_payments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=39;

--
-- AUTO_INCREMENT for table `rental_payment_receipts`
--
ALTER TABLE `rental_payment_receipts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=36;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `salary_advances`
--
ALTER TABLE `salary_advances`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `salary_payments`
--
ALTER TABLE `salary_payments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `stock_movements`
--
ALTER TABLE `stock_movements`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `sync_inbox`
--
ALTER TABLE `sync_inbox`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=79;

--
-- AUTO_INCREMENT for table `system_settings`
--
ALTER TABLE `system_settings`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `vendors`
--
ALTER TABLE `vendors`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `warehouses`
--
ALTER TABLE `warehouses`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `apartment_rentals`
--
ALTER TABLE `apartment_rentals`
  ADD CONSTRAINT `apartment_rentals_apartment_id_foreign` FOREIGN KEY (`apartment_id`) REFERENCES `apartments` (`id`),
  ADD CONSTRAINT `apartment_rentals_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `apartment_rentals_key_handover_by_foreign` FOREIGN KEY (`key_handover_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `apartment_rentals_key_returned_by_foreign` FOREIGN KEY (`key_returned_by`) REFERENCES `users` (`id`),
  ADD CONSTRAINT `apartment_rentals_tenant_id_foreign` FOREIGN KEY (`tenant_id`) REFERENCES `customers` (`id`);

--
-- Constraints for table `apartment_sales`
--
ALTER TABLE `apartment_sales`
  ADD CONSTRAINT `apartment_sales_apartment_id_foreign` FOREIGN KEY (`apartment_id`) REFERENCES `apartments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `apartment_sales_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `apartment_sales_deed_issued_by_foreign` FOREIGN KEY (`deed_issued_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `apartment_sales_key_handover_by_foreign` FOREIGN KEY (`key_handover_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `apartment_sales_key_returned_by_foreign` FOREIGN KEY (`key_returned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `apartment_sales_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `apartment_sale_financials`
--
ALTER TABLE `apartment_sale_financials`
  ADD CONSTRAINT `apartment_sale_financials_apartment_sale_id_foreign` FOREIGN KEY (`apartment_sale_id`) REFERENCES `apartment_sales` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `apartment_sale_possession_logs`
--
ALTER TABLE `apartment_sale_possession_logs`
  ADD CONSTRAINT `apartment_sale_possession_logs_apartment_sale_id_foreign` FOREIGN KEY (`apartment_sale_id`) REFERENCES `apartment_sales` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `apartment_sale_possession_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `apartment_sale_terminations`
--
ALTER TABLE `apartment_sale_terminations`
  ADD CONSTRAINT `apartment_sale_terminations_apartment_sale_id_foreign` FOREIGN KEY (`apartment_sale_id`) REFERENCES `apartment_sales` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `approvals`
--
ALTER TABLE `approvals`
  ADD CONSTRAINT `approvals_requested_by_foreign` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `approval_logs`
--
ALTER TABLE `approval_logs`
  ADD CONSTRAINT `approval_logs_approval_id_foreign` FOREIGN KEY (`approval_id`) REFERENCES `approvals` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `approval_logs_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`);

--
-- Constraints for table `asset_assignments`
--
ALTER TABLE `asset_assignments`
  ADD CONSTRAINT `asset_assignments_asset_id_foreign` FOREIGN KEY (`asset_id`) REFERENCES `company_assets` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `asset_assignments_asset_request_id_foreign` FOREIGN KEY (`asset_request_id`) REFERENCES `asset_requests` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `asset_assignments_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `asset_requests`
--
ALTER TABLE `asset_requests`
  ADD CONSTRAINT `asset_requests_allocated_by_user_id_foreign` FOREIGN KEY (`allocated_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `asset_requests_approved_by_user_id_foreign` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `asset_requests_requested_asset_id_foreign` FOREIGN KEY (`requested_asset_id`) REFERENCES `company_assets` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `asset_requests_requested_by_employee_id_foreign` FOREIGN KEY (`requested_by_employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `company_assets`
--
ALTER TABLE `company_assets`
  ADD CONSTRAINT `company_assets_current_employee_id_foreign` FOREIGN KEY (`current_employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `company_assets_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `crm_messages`
--
ALTER TABLE `crm_messages`
  ADD CONSTRAINT `crm_messages_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `installments`
--
ALTER TABLE `installments`
  ADD CONSTRAINT `installments_apartment_sale_id_foreign` FOREIGN KEY (`apartment_sale_id`) REFERENCES `apartment_sales` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `installment_payments`
--
ALTER TABLE `installment_payments`
  ADD CONSTRAINT `installment_payments_installment_id_foreign` FOREIGN KEY (`installment_id`) REFERENCES `installments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `installment_payments_received_by_foreign` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `materials`
--
ALTER TABLE `materials`
  ADD CONSTRAINT `materials_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `material_requests`
--
ALTER TABLE `material_requests`
  ADD CONSTRAINT `material_requests_approved_by_user_id_foreign` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `material_requests_issued_by_user_id_foreign` FOREIGN KEY (`issued_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `material_requests_requested_by_employee_id_foreign` FOREIGN KEY (`requested_by_employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `material_requests_warehouse_id_foreign` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `material_request_items`
--
ALTER TABLE `material_request_items`
  ADD CONSTRAINT `material_request_items_material_id_foreign` FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `material_request_items_material_request_id_foreign` FOREIGN KEY (`material_request_id`) REFERENCES `material_requests` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `model_has_permissions`
--
ALTER TABLE `model_has_permissions`
  ADD CONSTRAINT `model_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `model_has_roles`
--
ALTER TABLE `model_has_roles`
  ADD CONSTRAINT `model_has_roles_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `municipality_payment_letters`
--
ALTER TABLE `municipality_payment_letters`
  ADD CONSTRAINT `municipality_payment_letters_apartment_sale_id_foreign` FOREIGN KEY (`apartment_sale_id`) REFERENCES `apartment_sales` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `municipality_receipts`
--
ALTER TABLE `municipality_receipts`
  ADD CONSTRAINT `municipality_receipts_apartment_sale_id_foreign` FOREIGN KEY (`apartment_sale_id`) REFERENCES `apartment_sales` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `municipality_receipts_received_by_foreign` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `rental_payments`
--
ALTER TABLE `rental_payments`
  ADD CONSTRAINT `rental_payments_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `rental_payments_rental_id_foreign` FOREIGN KEY (`rental_id`) REFERENCES `apartment_rentals` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `rental_payment_receipts`
--
ALTER TABLE `rental_payment_receipts`
  ADD CONSTRAINT `rental_payment_receipts_received_by_foreign` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `rental_payment_receipts_rental_id_foreign` FOREIGN KEY (`rental_id`) REFERENCES `apartment_rentals` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `rental_payment_receipts_rental_payment_id_foreign` FOREIGN KEY (`rental_payment_id`) REFERENCES `rental_payments` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `rental_payment_receipts_tenant_id_foreign` FOREIGN KEY (`tenant_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `role_has_permissions`
--
ALTER TABLE `role_has_permissions`
  ADD CONSTRAINT `role_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `role_has_permissions_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `salary_advances`
--
ALTER TABLE `salary_advances`
  ADD CONSTRAINT `salary_advances_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`),
  ADD CONSTRAINT `salary_advances_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `salary_payments`
--
ALTER TABLE `salary_payments`
  ADD CONSTRAINT `salary_payments_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`),
  ADD CONSTRAINT `salary_payments_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `sync_inbox`
--
ALTER TABLE `sync_inbox`
  ADD CONSTRAINT `sync_inbox_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`);

--
-- Constraints for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD CONSTRAINT `system_settings_updated_by_foreign` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
