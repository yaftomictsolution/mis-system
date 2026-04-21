-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 21, 2026 at 08:53 AM
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
-- Table structure for table `accounts`
--

CREATE TABLE `accounts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `name` varchar(255) NOT NULL,
  `account_type` varchar(50) NOT NULL DEFAULT 'office',
  `bank_name` varchar(255) DEFAULT NULL,
  `account_number` varchar(100) DEFAULT NULL,
  `currency` varchar(10) NOT NULL DEFAULT 'USD',
  `opening_balance` decimal(14,2) NOT NULL DEFAULT 0.00,
  `current_balance` decimal(14,2) NOT NULL DEFAULT 0.00,
  `status` varchar(50) NOT NULL DEFAULT 'active',
  `notes` text DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `account_transactions`
--

CREATE TABLE `account_transactions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `account_id` bigint(20) UNSIGNED NOT NULL,
  `direction` varchar(10) NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `currency_code` varchar(10) NOT NULL DEFAULT 'USD',
  `exchange_rate_snapshot` decimal(16,6) DEFAULT NULL,
  `amount_usd` decimal(14,2) DEFAULT NULL,
  `module` varchar(100) DEFAULT NULL,
  `reference_type` varchar(100) DEFAULT NULL,
  `reference_uuid` char(36) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `transaction_date` datetime NOT NULL,
  `created_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'posted',
  `reversal_of_id` bigint(20) UNSIGNED DEFAULT NULL,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `north_boundary` varchar(255) DEFAULT NULL,
  `south_boundary` varchar(255) DEFAULT NULL,
  `east_boundary` varchar(255) DEFAULT NULL,
  `west_boundary` varchar(255) DEFAULT NULL,
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

INSERT INTO `apartments` (`id`, `uuid`, `apartment_code`, `total_price`, `usage_type`, `block_number`, `unit_number`, `floor_number`, `bedrooms`, `halls`, `bathrooms`, `kitchens`, `balcony`, `area_sqm`, `apartment_shape`, `corridor`, `north_boundary`, `south_boundary`, `east_boundary`, `west_boundary`, `status`, `qr_code`, `additional_info`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, '6c2021a7-173a-4375-8b84-d4c9eadb335d', 'G-20', 0.00, 'residential', 'G', '30', '1/G', 1, 2, 1, 1, 0, 434.00, 'L-shape', '34', '32', '32', '32', '32', 'available', 'QR-3232', NULL, '2026-04-19 02:02:44', '2026-04-19 02:02:44', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `apartment_qr_access_tokens`
--

CREATE TABLE `apartment_qr_access_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `apartment_id` bigint(20) UNSIGNED NOT NULL,
  `token` varchar(100) NOT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'active',
  `expires_at` timestamp NULL DEFAULT NULL,
  `last_scanned_at` timestamp NULL DEFAULT NULL,
  `created_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `apartment_qr_access_tokens`
--

INSERT INTO `apartment_qr_access_tokens` (`id`, `uuid`, `apartment_id`, `token`, `status`, `expires_at`, `last_scanned_at`, `created_by_user_id`, `created_at`, `updated_at`) VALUES
(1, '6e88d013-7d66-47cd-a92c-ec121bdd9349', 1, 'H6NFo3YHIIfoX2vKRcMmOeTpuZZ1VuWn9CPNgNTG0BctPKt616ryOL1Fxyxm1Q5D', 'active', NULL, NULL, 30, '2026-04-19 02:02:45', '2026-04-19 02:02:45');

-- --------------------------------------------------------

--
-- Table structure for table `apartment_qr_scan_logs`
--

CREATE TABLE `apartment_qr_scan_logs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `apartment_qr_access_token_id` bigint(20) UNSIGNED DEFAULT NULL,
  `apartment_id` bigint(20) UNSIGNED DEFAULT NULL,
  `apartment_sale_id` bigint(20) UNSIGNED DEFAULT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `scan_result` varchar(30) NOT NULL,
  `access_scope` varchar(30) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `scanned_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
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
  `quantity_assigned` decimal(14,2) NOT NULL DEFAULT 1.00,
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
  `requested_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `requested_by_employee_id` bigint(20) UNSIGNED DEFAULT NULL,
  `requested_asset_id` bigint(20) UNSIGNED DEFAULT NULL,
  `asset_type` varchar(50) DEFAULT NULL,
  `quantity_requested` decimal(14,2) NOT NULL DEFAULT 1.00,
  `quantity_allocated` decimal(14,2) NOT NULL DEFAULT 0.00,
  `status` varchar(40) NOT NULL DEFAULT 'pending',
  `reason` text DEFAULT NULL,
  `approved_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `rejected_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
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
  `quantity` decimal(14,2) NOT NULL DEFAULT 0.00,
  `allocated_quantity` decimal(14,2) NOT NULL DEFAULT 0.00,
  `maintenance_quantity` decimal(14,2) NOT NULL DEFAULT 0.00,
  `damaged_quantity` decimal(14,2) NOT NULL DEFAULT 0.00,
  `retired_quantity` decimal(14,2) NOT NULL DEFAULT 0.00,
  `supplier_id` bigint(20) UNSIGNED DEFAULT NULL,
  `serial_no` varchar(100) DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'available',
  `current_employee_id` bigint(20) UNSIGNED DEFAULT NULL,
  `current_project_id` bigint(20) UNSIGNED DEFAULT NULL,
  `current_warehouse_id` bigint(20) UNSIGNED DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `job_title` varchar(255) DEFAULT NULL,
  `tazkira_number` varchar(255) DEFAULT NULL,
  `phone` varchar(255) NOT NULL,
  `phone1` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `current_area` varchar(255) DEFAULT NULL,
  `current_district` varchar(255) DEFAULT NULL,
  `current_province` varchar(255) DEFAULT NULL,
  `original_area` varchar(255) DEFAULT NULL,
  `original_district` varchar(255) DEFAULT NULL,
  `original_province` varchar(255) DEFAULT NULL,
  `representative_name` varchar(255) DEFAULT NULL,
  `representative_fname` varchar(255) DEFAULT NULL,
  `representative_gname` varchar(255) DEFAULT NULL,
  `representative_job_title` varchar(255) DEFAULT NULL,
  `representative_relationship` varchar(255) DEFAULT NULL,
  `representative_phone` varchar(255) DEFAULT NULL,
  `representative_tazkira_number` varchar(255) DEFAULT NULL,
  `representative_current_area` varchar(255) DEFAULT NULL,
  `representative_current_district` varchar(255) DEFAULT NULL,
  `representative_current_province` varchar(255) DEFAULT NULL,
  `representative_original_area` varchar(255) DEFAULT NULL,
  `representative_original_district` varchar(255) DEFAULT NULL,
  `representative_original_province` varchar(255) DEFAULT NULL,
  `status` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `uuid`, `name`, `fname`, `gname`, `job_title`, `tazkira_number`, `phone`, `phone1`, `email`, `address`, `current_area`, `current_district`, `current_province`, `original_area`, `original_district`, `original_province`, `representative_name`, `representative_fname`, `representative_gname`, `representative_job_title`, `representative_relationship`, `representative_phone`, `representative_tazkira_number`, `representative_current_area`, `representative_current_district`, `representative_current_province`, `representative_original_area`, `representative_original_district`, `representative_original_province`, `status`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, '667f061c-56df-444a-976a-1295e228a60f', 'Ahmad', 'Khn', 'Abkari', 'Software Developer', 'GH32', '+93789647994', '+9312121', 'ahmad@gmail.com', NULL, 'kabul', '2', 'kabul', 'parwan', '3', '3', 'wahidullah', 'karim khan', 'khan', 'Engineer', 'dsffdfdf', '32323232', 'gh32323', '2', '2', 'kabul', 'dfd', 'sdfsd', 'dsf', 'Active', '2026-04-19 02:08:55', '2026-04-19 02:08:55', NULL);

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
(1, 'customer', 'customer_image', 1, 'documents/customers/jwsYVWdomCxvBQjjuVjJkVG2xTb2LRuSusKO7nRu.png', NULL, '2026-04-19 02:08:56');

-- --------------------------------------------------------

--
-- Table structure for table `document_types`
--

CREATE TABLE `document_types` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `module` varchar(40) NOT NULL,
  `code` varchar(80) NOT NULL,
  `label` varchar(120) NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `salary_currency_code` varchar(10) NOT NULL DEFAULT 'USD',
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

INSERT INTO `employees` (`id`, `uuid`, `first_name`, `last_name`, `job_title`, `salary_type`, `base_salary`, `salary_currency_code`, `address`, `email`, `phone`, `hire_date`, `status`, `created_at`, `updated_at`, `deleted_at`) VALUES
(1, 'f894a494-dda0-423e-83a9-51ba8953ecff', 'ahmad', 'kabirr', 'engineer', 'fixed', '1000', 'USD', 'kabul,afghanistan', 'ahmad@gmail.com', '93789643', '2026-04-20 00:00:00', 'active', '2026-04-20 03:04:17', '2026-04-20 03:04:17', NULL);

-- --------------------------------------------------------

--
-- Table structure for table `employee_salary_histories`
--

CREATE TABLE `employee_salary_histories` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `employee_id` bigint(20) UNSIGNED NOT NULL,
  `previous_salary` decimal(14,2) DEFAULT NULL,
  `previous_salary_currency_code` varchar(10) DEFAULT NULL,
  `new_salary` decimal(14,2) DEFAULT NULL,
  `new_salary_currency_code` varchar(10) DEFAULT NULL,
  `effective_from` date DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `changed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `source` varchar(50) NOT NULL DEFAULT 'manual',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `employee_salary_histories`
--

INSERT INTO `employee_salary_histories` (`id`, `uuid`, `employee_id`, `previous_salary`, `previous_salary_currency_code`, `new_salary`, `new_salary_currency_code`, `effective_from`, `reason`, `changed_by`, `source`, `created_at`, `updated_at`) VALUES
(1, '93cede5b-4d07-4c0d-a7db-ffb618e26e90', 1, NULL, NULL, 1000.00, 'USD', '2026-04-20', 'Initial salary recorded', 1, 'initial', '2026-04-20 03:04:18', '2026-04-20 03:04:18');

-- --------------------------------------------------------

--
-- Table structure for table `exchange_rates`
--

CREATE TABLE `exchange_rates` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `base_currency` varchar(10) NOT NULL DEFAULT 'USD',
  `quote_currency` varchar(10) NOT NULL DEFAULT 'AFN',
  `rate` decimal(16,6) NOT NULL,
  `source` varchar(20) NOT NULL DEFAULT 'manual',
  `effective_date` date NOT NULL,
  `approved_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `notes` text DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `account_id` bigint(20) UNSIGNED DEFAULT NULL,
  `account_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `payment_currency_code` varchar(10) DEFAULT NULL,
  `exchange_rate_snapshot` decimal(12,6) DEFAULT NULL,
  `account_amount` decimal(15,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `reference_unit_price` decimal(14,2) DEFAULT NULL,
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
  `requested_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `requested_by_employee_id` bigint(20) UNSIGNED DEFAULT NULL,
  `status` varchar(40) NOT NULL DEFAULT 'pending',
  `approved_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `rejected_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `issued_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `issued_at` timestamp NULL DEFAULT NULL,
  `issue_receipt_no` varchar(255) DEFAULT NULL,
  `requested_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `quantity_returned` decimal(14,2) NOT NULL DEFAULT 0.00,
  `unit` varchar(100) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
(1, '2026_04_05_100000_create_accounts_table', 1),
(2, '2026_04_05_100100_create_account_transactions_table', 2),
(3, '2026_04_05_100200_create_employee_salary_histories_table', 3),
(4, '2026_04_05_100300_add_tax_and_account_fields_to_salary_payments_table', 4),
(5, '2026_04_05_100400_sync_accounts_permissions_catalog', 5),
(6, '2026_04_05_110000_add_tax_percentage_to_salary_payments_table', 6),
(7, '2026_04_05_120000_add_balance_fields_to_salary_advances_table', 7),
(8, '2026_04_05_120100_create_salary_advance_deductions_table', 8),
(9, '2026_04_05_130000_create_exchange_rates_table', 9),
(10, '2026_04_05_130100_add_currency_snapshot_fields_to_account_transactions_and_salary_payments', 10),
(11, '2026_04_05_130200_sync_exchange_rates_permissions_catalog', 11),
(12, '2026_04_06_090000_add_salary_currency_to_employees_and_histories', 12),
(13, '2026_04_06_090100_add_currency_to_salary_advances', 13),
(14, '2026_04_06_090200_add_salary_currency_snapshots_to_salary_payments', 14),
(15, '2026_04_06_120000_add_account_posting_fields_to_receipt_tables', 15),
(16, '2026_04_08_100000_create_document_types_table', 16),
(17, '2026_04_08_140000_add_deed_profile_fields_to_customers_table', 17),
(18, '2026_04_12_090000_add_boundary_fields_to_apartments_table', 18),
(19, '2026_04_12_130000_seed_account_types_in_document_types_table', 19),
(20, '2026_04_13_090000_add_customer_portal_support_to_users_table', 20),
(21, '2026_04_13_090100_create_apartment_qr_access_tokens_table', 20),
(22, '2026_04_13_090200_create_apartment_qr_scan_logs_table', 20),
(23, '2026_04_14_000100_add_inventory_workflow_fields', 21),
(24, '2026_04_14_000200_align_asset_request_workflow_with_admin_approval', 22),
(25, '2026_04_15_090000_make_asset_request_employee_nullable', 23),
(26, '2026_04_15_130000_add_quantity_returned_to_material_request_items_table', 24),
(27, '2026_04_15_101000_seed_company_asset_types_in_document_types_table', 25),
(28, '2026_04_16_061417_add_approval_fields_to_apartment_rentals_table', 26);

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
(1, 'App\\Models\\User', 25),
(1, 'App\\Models\\User', 31),
(2, 'App\\Models\\User', 2),
(2, 'App\\Models\\User', 29),
(2, 'App\\Models\\User', 30),
(3, 'App\\Models\\User', 12),
(3, 'App\\Models\\User', 18),
(4, 'App\\Models\\User', 16),
(4, 'App\\Models\\User', 19),
(4, 'App\\Models\\User', 23),
(4, 'App\\Models\\User', 28),
(5, 'App\\Models\\User', 24),
(5, 'App\\Models\\User', 26),
(6, 'App\\Models\\User', 27),
(9, 'App\\Models\\User', 22);

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
  `account_id` bigint(20) UNSIGNED DEFAULT NULL,
  `account_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `payment_currency_code` varchar(10) DEFAULT NULL,
  `exchange_rate_snapshot` decimal(12,6) DEFAULT NULL,
  `account_amount` decimal(15,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
('00690bf0-5cb1-4a01-885a-bc9f807e9232', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 19, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000003\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"cf92d000-5c02-47af-b67d-0f6d29e43aa8\",\"sale_id\":\"SAL-000003\",\"customer_id\":1,\"customer_name\":\"Ahmad\",\"apartment_id\":3,\"apartment_label\":\"GH-323234 - Unit 300\",\"net_price\":3000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/cf92d000-5c02-47af-b67d-0f6d29e43aa8\\/financial\",\"created_at\":\"2026-04-02T09:16:47.510733Z\"}', NULL, '2026-04-02 04:46:47', '2026-04-02 04:46:47'),
('01c191b3-f85f-4c0a-9432-412c0dc94043', 'App\\Notifications\\RentalApprovalRequiredNotification', 'App\\Models\\User', 25, '{\"category\":\"rental_approval_required\",\"title\":\"Rental Approval Required: RNT-000007\",\"message\":\"A new apartment rental was created and is waiting for admin approval.\",\"rental_uuid\":\"6d9e19bc-7648-42b8-8025-ca231c5aebcb\",\"rental_id\":\"RNT-000007\",\"tenant_id\":2,\"tenant_name\":\"Mahmod\",\"apartment_id\":16,\"apartment_label\":\"HJ232 - Unit 030\",\"monthly_rent\":20,\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/rentals?tab=pending-approval\",\"requested_at\":\"2026-04-18T05:47:32.007109Z\"}', NULL, '2026-04-18 01:17:32', '2026-04-18 01:17:32'),
('04980751-f494-44f9-9f7d-1066b9842bfd', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 26, '{\"category\":\"material_request_issued\",\"title\":\"Material Request Issued: MR-000009\",\"message\":\"Material request issued by Workflow Storekeeper.\",\"module\":\"material_requests\",\"request_uuid\":\"dfe2e1e5-463d-4d9f-85a7-edcac1a45158\",\"request_no\":\"MR-000009\",\"project_name\":\"Project Contraction\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"issued\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests?queue=issued\",\"created_at\":\"2026-04-15T09:50:40.000000Z\"}', NULL, '2026-04-15 05:25:31', '2026-04-15 05:25:31'),
('059d959d-9f7f-41e1-884d-f0fe7addfc90', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"asset_request_approval_required\",\"title\":\"Asset Request Approval Required: AR-000002\",\"message\":\"A new asset request is waiting for admin approval.\",\"module\":\"asset_requests\",\"request_uuid\":\"ac3c0fdb-951d-474b-9794-05c880244e8a\",\"request_no\":\"AR-000002\",\"project_name\":\"New Project21\",\"requested_by_name\":\"Workflow Project Manager\",\"requested_for_name\":\"Karim khan\",\"requested_asset_name\":\"Office Desk\",\"requested_asset_code\":\"OFFICE-0001\",\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/asset-requests\",\"created_at\":\"2026-04-15T05:34:31.000000Z\"}', NULL, '2026-04-15 01:04:31', '2026-04-15 01:04:31'),
('094d8df5-e3e1-4f21-a811-f1f874f15ea5', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 19, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000027\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"6da354b1-0872-48b5-8995-355a86d16dc7\",\"sale_id\":\"SAL-000027\",\"customer_id\":1,\"customer_name\":\"\\u0633\\u06cc\\u062f \\u0627\\u0646\\u0648\\u0631 \\u062e\\u0627\\u0646\",\"apartment_id\":11,\"apartment_label\":\"BHR-212 - Unit GH\",\"net_price\":3000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/6da354b1-0872-48b5-8995-355a86d16dc7\\/financial\",\"created_at\":\"2026-04-13T10:12:25.734512Z\"}', NULL, '2026-04-13 05:42:25', '2026-04-13 05:42:25'),
('10af4036-9257-450c-a950-2db70c1cdba7', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"asset_request_approval_required\",\"title\":\"Asset Request Approval Required: AR-000003\",\"message\":\"A new asset request is waiting for admin approval.\",\"module\":\"asset_requests\",\"request_uuid\":\"54b4e80a-4459-4292-91b1-bde6df28c965\",\"request_no\":\"AR-000003\",\"project_name\":\"Project Contraction\",\"requested_by_name\":\"Workflow Project Manager\",\"requested_for_name\":\"Karim khan\",\"requested_asset_name\":\"\\u0644\\u067e\\u062a\\u0627\\u0628\",\"requested_asset_code\":\"GH434\",\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/asset-requests\",\"created_at\":\"2026-04-15T05:50:29.000000Z\"}', NULL, '2026-04-15 01:20:29', '2026-04-15 01:20:29'),
('111094df-73dd-4533-a616-5d03719f787d', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 26, '{\"category\":\"material_request_approved\",\"title\":\"Material Request Approved: MR-000008\",\"message\":\"Material request approved by Workflow Admin.\",\"module\":\"material_requests\",\"request_uuid\":\"c97d3744-2b28-4c13-8fa3-aad5ee36b5f3\",\"request_no\":\"MR-000008\",\"project_name\":\"New Project21\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"approved\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-15T09:32:46.000000Z\"}', NULL, '2026-04-15 05:09:15', '2026-04-15 05:09:15'),
('1431b50e-5474-4dce-9a4f-7cb0cf4622a5', 'App\\Notifications\\RentalApprovedNotification', 'App\\Models\\User', 29, '{\"category\":\"rental_approved\",\"title\":\"Rental Approved: RNT-000006\",\"message\":\"Your apartment rental was approved by System Admin. Finance can now process the payment.\",\"rental_uuid\":\"99b74ce9-3f52-4dbc-b73c-22e079cfbf6b\",\"rental_id\":\"RNT-000006\",\"tenant_id\":2,\"tenant_name\":\"Mahmod\",\"apartment_id\":15,\"apartment_label\":\"ALPH-400 - Unit 43\",\"monthly_rent\":50,\"approved_by_user_id\":1,\"approved_by_name\":\"System Admin\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"approved_at\":\"2026-04-18T05:23:22.000000Z\"}', '2026-04-18 01:15:21', '2026-04-18 00:53:22', '2026-04-18 01:15:21'),
('14974418-3222-4b87-951b-005f28ffeb69', 'App\\Notifications\\RentalBillCreatedFinanceNotification', 'App\\Models\\User', 25, '{\"category\":\"rental_bill_created_finance\",\"title\":\"Rental Bill Ready: RBL-000010\",\"message\":\"A customer rental bill was approved by System Admin and is ready for finance processing.\",\"rental_uuid\":\"99b74ce9-3f52-4dbc-b73c-22e079cfbf6b\",\"rental_id\":\"RNT-000006\",\"bill_uuid\":\"df1b7334-b213-42ae-97db-10a8deb9dce8\",\"bill_no\":\"RBL-000010\",\"tenant_id\":2,\"tenant_name\":\"Mahmod\",\"apartment_id\":15,\"apartment_label\":\"ALPH-400 - Unit 43\",\"payment_type\":\"advance\",\"amount_due\":150,\"due_date\":\"2026-04-18\",\"approved_by_user_id\":1,\"approved_by_name\":\"System Admin\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"created_at\":\"2026-04-18T05:23:27.730625Z\"}', NULL, '2026-04-18 00:53:27', '2026-04-18 00:53:27'),
('19e57e28-b1e9-4ed5-a9dd-3a88c79b56c1', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 27, '{\"category\":\"material_request_approval_required\",\"title\":\"Material Request Approval Required: MR-000009\",\"message\":\"A new material request is waiting for admin approval.\",\"module\":\"material_requests\",\"request_uuid\":\"dfe2e1e5-463d-4d9f-85a7-edcac1a45158\",\"request_no\":\"MR-000009\",\"project_name\":\"Project Contraction\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-15T09:50:40.000000Z\"}', NULL, '2026-04-15 05:20:40', '2026-04-15 05:20:40'),
('1ccd28ad-8a0e-4e75-821b-710e479bfd77', 'App\\Notifications\\RentalApprovalRequiredNotification', 'App\\Models\\User', 25, '{\"category\":\"rental_approval_required\",\"title\":\"Rental Approval Required: RNT-000005\",\"message\":\"A new apartment rental was created and is waiting for admin approval.\",\"rental_uuid\":\"ceb35bbf-0b36-42dd-9046-951fec43f169\",\"rental_id\":\"RNT-000005\",\"tenant_id\":1,\"tenant_name\":\"\\u0633\\u06cc\\u062f \\u0627\\u0646\\u0648\\u0631 \\u062e\\u0627\\u0646\",\"apartment_id\":14,\"apartment_label\":\"GH32234 - Unit 323\",\"monthly_rent\":10,\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/rentals?tab=pending-approval\",\"requested_at\":\"2026-04-16T09:33:43.323120Z\"}', NULL, '2026-04-16 05:03:43', '2026-04-16 05:03:43'),
('2f6bfb45-8c3e-4815-8f98-0f3dceaca5b2', 'App\\Notifications\\RentalBillCreatedFinanceNotification', 'App\\Models\\User', 25, '{\"category\":\"rental_bill_created_finance\",\"title\":\"New Rental Bill: RBL-000004\",\"message\":\"A customer rental bill was generated and is waiting for finance approval.\",\"rental_uuid\":\"3bb9be92-2948-4ecc-b565-2b013da30bfa\",\"rental_id\":\"RNT-000001\",\"bill_uuid\":\"0575f6d8-56b9-4e47-b142-b2462e58bba1\",\"bill_no\":\"RBL-000004\",\"tenant_id\":1,\"tenant_name\":\"\\u0633\\u06cc\\u062f \\u0627\\u0646\\u0648\\u0631 \\u062e\\u0627\\u0646\",\"apartment_id\":1,\"apartment_label\":\"GH23423423 - Unit GH323\",\"payment_type\":\"advance\",\"amount_due\":11000,\"due_date\":\"2026-04-15\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"created_at\":\"2026-04-15T10:12:52.707901Z\"}', '2026-04-15 06:08:32', '2026-04-15 05:42:52', '2026-04-15 06:08:32'),
('3380d8d3-185d-4ab4-b05f-20fee8b15486', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"asset_request_approved\",\"title\":\"Asset Request Approved: AR-000003\",\"message\":\"Asset request approved by System Admin.\",\"module\":\"asset_requests\",\"request_uuid\":\"54b4e80a-4459-4292-91b1-bde6df28c965\",\"request_no\":\"AR-000003\",\"project_name\":\"Project Contraction\",\"requested_by_name\":\"Workflow Project Manager\",\"requested_for_name\":\"Karim khan\",\"requested_asset_name\":\"\\u0644\\u067e\\u062a\\u0627\\u0628\",\"requested_asset_code\":\"GH434\",\"status\":\"approved\",\"action_url\":\"http:\\/\\/localhost:3000\\/asset-requests\",\"created_at\":\"2026-04-15T05:50:29.000000Z\"}', NULL, '2026-04-15 01:22:14', '2026-04-15 01:22:14'),
('3390e1cf-b027-4d17-82f6-6d94c9b5b207', 'App\\Notifications\\RentalBillCreatedFinanceNotification', 'App\\Models\\User', 25, '{\"category\":\"rental_bill_created_finance\",\"title\":\"New Rental Bill: RBL-000006\",\"message\":\"A customer rental bill was generated and is waiting for finance approval.\",\"rental_uuid\":\"beca0fce-efc1-4451-89ce-9bd90ef4f105\",\"rental_id\":\"RNT-000001\",\"bill_uuid\":\"e0006a3c-23cf-4e1b-9fbc-9247866e8914\",\"bill_no\":\"RBL-000006\",\"tenant_id\":2,\"tenant_name\":\"Mahmod\",\"apartment_id\":7,\"apartment_label\":\"BBB-000 - Unit 404\",\"payment_type\":\"monthly\",\"amount_due\":100,\"due_date\":\"2026-07-15\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"created_at\":\"2026-04-15T11:28:14.802119Z\"}', NULL, '2026-04-15 06:58:14', '2026-04-15 06:58:14'),
('35c50840-47ca-4705-accd-1d5d2cd37e9b', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 19, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000026\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"cc68e2ef-03dc-4929-8839-b0819ace7b0a\",\"sale_id\":\"SAL-000026\",\"customer_id\":1,\"customer_name\":\"\\u0633\\u06cc\\u062f \\u0627\\u0646\\u0648\\u0631 \\u062e\\u0627\\u0646\",\"apartment_id\":10,\"apartment_label\":\"J-3434 - Unit 303\",\"net_price\":100,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/cc68e2ef-03dc-4929-8839-b0819ace7b0a\\/financial\",\"created_at\":\"2026-04-12T08:45:28.020852Z\"}', NULL, '2026-04-12 04:15:28', '2026-04-12 04:15:28'),
('40671223-4bf8-4290-8c68-73adeaab3f0a', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 27, '{\"category\":\"material_request_approved\",\"title\":\"Material Request Approved: MR-000009\",\"message\":\"Material request approved by Workflow Admin.\",\"module\":\"material_requests\",\"request_uuid\":\"dfe2e1e5-463d-4d9f-85a7-edcac1a45158\",\"request_no\":\"MR-000009\",\"project_name\":\"Project Contraction\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"approved\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-15T09:50:40.000000Z\"}', '2026-04-15 05:21:50', '2026-04-15 05:21:37', '2026-04-15 05:21:50'),
('41f3fed9-dfd5-4d2b-82a2-43a151300151', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 19, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000011\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"01b97c5f-1f3d-48e1-97e0-dd01a0ef41d3\",\"sale_id\":\"SAL-000011\",\"customer_id\":2,\"customer_name\":\"Mahmod\",\"apartment_id\":7,\"apartment_label\":\"BBB-000 - Unit 404\",\"net_price\":500,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/01b97c5f-1f3d-48e1-97e0-dd01a0ef41d3\\/financial\",\"created_at\":\"2026-04-07T05:42:34.942600Z\"}', NULL, '2026-04-07 01:12:34', '2026-04-07 01:12:34'),
('42f27f87-3905-4b9d-8362-ae6ade0079bf', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"material_request_approval_required\",\"title\":\"Material Request Approval Required: MR-000008\",\"message\":\"A new material request is waiting for admin approval.\",\"module\":\"material_requests\",\"request_uuid\":\"c97d3744-2b28-4c13-8fa3-aad5ee36b5f3\",\"request_no\":\"MR-000008\",\"project_name\":\"New Project21\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-15T09:32:46.000000Z\"}', '2026-04-15 05:07:32', '2026-04-15 05:02:46', '2026-04-15 05:07:32'),
('45e2c340-8569-416a-9342-da78d0e880c8', 'App\\Notifications\\RentalApprovalRequiredNotification', 'App\\Models\\User', 25, '{\"category\":\"rental_approval_required\",\"title\":\"Rental Approval Required: RNT-000004\",\"message\":\"A new apartment rental was created and is waiting for admin approval.\",\"rental_uuid\":\"19c9e4ed-2a9b-46dd-a8b6-3806523fe53f\",\"rental_id\":\"RNT-000004\",\"tenant_id\":1,\"tenant_name\":\"\\u0633\\u06cc\\u062f \\u0627\\u0646\\u0648\\u0631 \\u062e\\u0627\\u0646\",\"apartment_id\":13,\"apartment_label\":\"HT-30 - Unit 4040\",\"monthly_rent\":50,\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/rentals?tab=pending-approval\",\"requested_at\":\"2026-04-16T09:17:02.733774Z\"}', NULL, '2026-04-16 04:47:02', '2026-04-16 04:47:02'),
('4bc79edd-653f-4833-ba58-f5dc9e30d10d', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 19, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000020\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"957813de-90e5-4742-9dcb-545171559d34\",\"sale_id\":\"SAL-000020\",\"customer_id\":1,\"customer_name\":\"Ahmad\",\"apartment_id\":2,\"apartment_label\":\"HJ54545 - Unit 4949\",\"net_price\":100,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/957813de-90e5-4742-9dcb-545171559d34\\/financial\",\"created_at\":\"2026-04-07T10:45:32.205520Z\"}', NULL, '2026-04-07 06:15:32', '2026-04-07 06:15:32'),
('4bca0be5-81d4-42d7-a97b-7fc81e2b89e0', 'App\\Notifications\\SaleApprovedNotification', 'App\\Models\\User', 18, '{\"category\":\"sale_approved\",\"title\":\"Sale Approved: SAL-000017\",\"message\":\"Your apartment sale was approved by System Admin. You can continue the next workflow.\",\"sale_uuid\":\"df91756c-0f9a-4c2c-b7b5-aee483504c69\",\"sale_id\":\"SAL-000017\",\"customer_id\":1,\"customer_name\":\"Ahmad\",\"apartment_id\":9,\"apartment_label\":\"TYU-3000 - Unit 505\",\"net_price\":40000,\"approved_by_user_id\":1,\"approved_by_name\":\"System Admin\",\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/df91756c-0f9a-4c2c-b7b5-aee483504c69\\/financial\",\"approved_at\":\"2026-04-07T09:32:49.000000Z\"}', NULL, '2026-04-07 05:02:55', '2026-04-07 05:02:55'),
('4e3d6862-2eb4-4b35-95cc-8037ccaf3f36', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"material_request_approved\",\"title\":\"Material Request Approved: MR-000005\",\"message\":\"Material request approved by System Admin.\",\"module\":\"material_requests\",\"request_uuid\":\"3e6d4e04-f52f-4e81-a2fb-f3196db6c18e\",\"request_no\":\"MR-000005\",\"project_name\":\"Project Contraction\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"approved\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-14T10:26:56.000000Z\"}', NULL, '2026-04-14 05:58:27', '2026-04-14 05:58:27'),
('504a8523-9e9f-4cd1-a24f-4cc392a9b747', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 19, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000008\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"c46b24bd-483f-402b-b3fe-d7b17aada74b\",\"sale_id\":\"SAL-000008\",\"customer_id\":2,\"customer_name\":\"Mahmod\",\"apartment_id\":8,\"apartment_label\":\"HHHHH-300 - Unit 404\",\"net_price\":9000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/c46b24bd-483f-402b-b3fe-d7b17aada74b\\/financial\",\"created_at\":\"2026-04-07T05:09:50.253746Z\"}', NULL, '2026-04-07 00:39:50', '2026-04-07 00:39:50'),
('537920c2-af8a-4afe-945e-3643e03070b8', 'App\\Notifications\\RentalBillApprovalRequiredNotification', 'App\\Models\\User', 25, '{\"category\":\"rental_bill_approval_required\",\"title\":\"Rental Bill Approval Required: RBL-000012\",\"message\":\"A rental bill was generated and is waiting for admin approval before payment processing.\",\"rental_uuid\":\"6d9e19bc-7648-42b8-8025-ca231c5aebcb\",\"rental_id\":\"RNT-000007\",\"bill_uuid\":\"6d0feeec-3c10-413a-86ca-f67182ceb6ae\",\"bill_no\":\"RBL-000012\",\"tenant_id\":2,\"tenant_name\":\"Mahmod\",\"apartment_id\":16,\"apartment_label\":\"HJ232 - Unit 030\",\"payment_type\":\"monthly\",\"amount_due\":20,\"due_date\":\"2026-07-18\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"requested_at\":\"2026-04-18T06:00:38.536338Z\"}', NULL, '2026-04-18 01:30:38', '2026-04-18 01:30:38'),
('54d38909-d14d-478d-ac41-a8393e2f43e1', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"purchase_request_paid\",\"title\":\"Purchase Request Paid: PR-000003\",\"message\":\"Purchase payment processed by Workflow Accountant. Warehouse can now receive items.\",\"module\":\"purchase_requests\",\"request_uuid\":\"d006ab57-72ca-43d7-867f-db209627fd9e\",\"request_no\":\"PR-000003\",\"request_type\":\"asset\",\"project_name\":null,\"warehouse_name\":\"Kabul Warehouse\",\"vendor_name\":\"\\u0634\\u0631\\u06a9\\u062a \\u062a\\u0648\\u0644\\u06cc\\u062f\",\"requested_by_name\":\"Workflow Storekeeper\",\"status\":\"paid\",\"action_url\":\"http:\\/\\/localhost:3000\\/purchase-requests\",\"created_at\":\"2026-04-15T05:16:27.000000Z\"}', NULL, '2026-04-15 00:48:23', '2026-04-15 00:48:23'),
('559e6b78-d54b-4bce-b6ae-c8b3a471dbf4', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"material_request_approved\",\"title\":\"Material Request Approved: MR-000008\",\"message\":\"Material request approved by Workflow Admin.\",\"module\":\"material_requests\",\"request_uuid\":\"c97d3744-2b28-4c13-8fa3-aad5ee36b5f3\",\"request_no\":\"MR-000008\",\"project_name\":\"New Project21\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"approved\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-15T09:32:46.000000Z\"}', NULL, '2026-04-15 05:09:15', '2026-04-15 05:09:15'),
('563be78e-87a2-47c8-b99d-fbd279bd0888', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 19, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000010\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"1bce3d0f-6c2d-42b7-a482-f34bd5719cfb\",\"sale_id\":\"SAL-000010\",\"customer_id\":1,\"customer_name\":\"Ahmad\",\"apartment_id\":8,\"apartment_label\":\"HHHHH-300 - Unit 404\",\"net_price\":14000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/1bce3d0f-6c2d-42b7-a482-f34bd5719cfb\\/financial\",\"created_at\":\"2026-04-07T05:41:22.473642Z\"}', NULL, '2026-04-07 01:11:22', '2026-04-07 01:11:22'),
('6177c553-7e36-4642-ac61-9ea2fa26560c', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 18, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000027\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"6da354b1-0872-48b5-8995-355a86d16dc7\",\"sale_id\":\"SAL-000027\",\"customer_id\":1,\"customer_name\":\"\\u0633\\u06cc\\u062f \\u0627\\u0646\\u0648\\u0631 \\u062e\\u0627\\u0646\",\"apartment_id\":11,\"apartment_label\":\"BHR-212 - Unit GH\",\"net_price\":3000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/6da354b1-0872-48b5-8995-355a86d16dc7\\/financial\",\"created_at\":\"2026-04-13T10:12:24.121406Z\"}', NULL, '2026-04-13 05:42:24', '2026-04-13 05:42:24'),
('61cd04ff-48f4-4519-ad33-1f932283348b', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"material_request_approved\",\"title\":\"Material Request Approved: MR-000003\",\"message\":\"Material request approved by System Admin.\",\"module\":\"material_requests\",\"request_uuid\":\"b859fb0b-33ba-4965-84bf-36a5502989cd\",\"request_no\":\"MR-000003\",\"project_name\":\"New Project21\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"approved\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-14T10:07:45.000000Z\"}', NULL, '2026-04-14 05:41:17', '2026-04-14 05:41:17'),
('6f946201-d519-44a3-bdcf-819dd53a3f71', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 19, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000006\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"592527ee-2722-408a-aa2d-3b41e7d2d967\",\"sale_id\":\"SAL-000006\",\"customer_id\":2,\"customer_name\":\"Mahmod\",\"apartment_id\":6,\"apartment_label\":\"HGT232 - Unit 443\",\"net_price\":3000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/592527ee-2722-408a-aa2d-3b41e7d2d967\\/financial\",\"created_at\":\"2026-04-07T04:28:41.954579Z\"}', NULL, '2026-04-06 23:58:41', '2026-04-06 23:58:41'),
('731eb465-b0c4-4754-92df-614427898d16', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 19, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000007\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"2cfc2137-8dd8-4fed-b491-eea18af7ffb7\",\"sale_id\":\"SAL-000007\",\"customer_id\":2,\"customer_name\":\"Mahmod\",\"apartment_id\":7,\"apartment_label\":\"BBB-000 - Unit 404\",\"net_price\":4000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/2cfc2137-8dd8-4fed-b491-eea18af7ffb7\\/financial\",\"created_at\":\"2026-04-07T04:56:28.170544Z\"}', NULL, '2026-04-07 00:26:28', '2026-04-07 00:26:28'),
('746563a6-4adb-454e-8e1e-30303e6c919f', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 18, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000026\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"cc68e2ef-03dc-4929-8839-b0819ace7b0a\",\"sale_id\":\"SAL-000026\",\"customer_id\":1,\"customer_name\":\"\\u0633\\u06cc\\u062f \\u0627\\u0646\\u0648\\u0631 \\u062e\\u0627\\u0646\",\"apartment_id\":10,\"apartment_label\":\"J-3434 - Unit 303\",\"net_price\":100,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/cc68e2ef-03dc-4929-8839-b0819ace7b0a\\/financial\",\"created_at\":\"2026-04-12T08:45:26.964972Z\"}', NULL, '2026-04-12 04:15:26', '2026-04-12 04:15:26'),
('75478495-b272-4a9f-8a8d-109c33d043f2', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"material_request_approval_required\",\"title\":\"Material Request Approval Required: MR-000003\",\"message\":\"A new material request is waiting for admin approval.\",\"module\":\"material_requests\",\"request_uuid\":\"b859fb0b-33ba-4965-84bf-36a5502989cd\",\"request_no\":\"MR-000003\",\"project_name\":\"New Project21\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-14T10:07:45.000000Z\"}', NULL, '2026-04-14 05:37:46', '2026-04-14 05:37:46'),
('7e57a860-c51c-4118-ae98-01b8404eb185', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"material_request_approved\",\"title\":\"Material Request Approved: MR-000009\",\"message\":\"Material request approved by Workflow Admin.\",\"module\":\"material_requests\",\"request_uuid\":\"dfe2e1e5-463d-4d9f-85a7-edcac1a45158\",\"request_no\":\"MR-000009\",\"project_name\":\"Project Contraction\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"approved\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-15T09:50:40.000000Z\"}', '2026-04-15 06:08:38', '2026-04-15 05:21:37', '2026-04-15 06:08:38'),
('80ab51be-7b25-4c4e-9fd0-44d863a0c3f4', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 18, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000017\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"df91756c-0f9a-4c2c-b7b5-aee483504c69\",\"sale_id\":\"SAL-000017\",\"customer_id\":1,\"customer_name\":\"Ahmad\",\"apartment_id\":9,\"apartment_label\":\"TYU-3000 - Unit 505\",\"net_price\":40000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/df91756c-0f9a-4c2c-b7b5-aee483504c69\\/financial\",\"created_at\":\"2026-04-07T09:32:52.581925Z\"}', NULL, '2026-04-07 05:02:52', '2026-04-07 05:02:52'),
('8828c5ee-7781-47eb-8e89-fe5cbfcdbcce', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"material_request_approval_required\",\"title\":\"Material Request Approval Required: MR-000009\",\"message\":\"A new material request is waiting for admin approval.\",\"module\":\"material_requests\",\"request_uuid\":\"dfe2e1e5-463d-4d9f-85a7-edcac1a45158\",\"request_no\":\"MR-000009\",\"project_name\":\"Project Contraction\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-15T09:50:40.000000Z\"}', '2026-04-15 05:21:26', '2026-04-15 05:20:40', '2026-04-15 05:21:26'),
('8996da29-9021-4781-8208-7843757aafd6', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"purchase_request_approval_required\",\"title\":\"Purchase Request Approval Required: PR-000001\",\"message\":\"A new purchase request is waiting for admin approval.\",\"module\":\"purchase_requests\",\"request_uuid\":\"eca77552-3074-454f-8055-067742377ab2\",\"request_no\":\"PR-000001\",\"request_type\":\"material\",\"project_name\":null,\"warehouse_name\":\"Kabul Warehouse\",\"vendor_name\":\"\\u0634\\u0631\\u06a9\\u062a \\u062a\\u0648\\u0644\\u06cc\\u062f\",\"requested_by_name\":\"Workflow Storekeeper\",\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/purchase-requests\",\"created_at\":\"2026-04-14T10:47:29.000000Z\"}', NULL, '2026-04-14 06:17:29', '2026-04-14 06:17:29'),
('8ae39aa9-8c2f-425a-9a65-22267f1edd62', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"material_request_approval_required\",\"title\":\"Material Request Approval Required: MR-000004\",\"message\":\"A new material request is waiting for admin approval.\",\"module\":\"material_requests\",\"request_uuid\":\"f5e09ec7-f94b-4786-9ab5-ad8c3bfa5103\",\"request_no\":\"MR-000004\",\"project_name\":\"Project Contraction\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-14T10:25:42.000000Z\"}', NULL, '2026-04-14 05:55:42', '2026-04-14 05:55:42'),
('8ea3623b-0fc2-4dd3-906f-d0ebad2be8a2', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 27, '{\"category\":\"asset_request_approved\",\"title\":\"Asset Request Approved: AR-000003\",\"message\":\"Asset request approved by System Admin.\",\"module\":\"asset_requests\",\"request_uuid\":\"54b4e80a-4459-4292-91b1-bde6df28c965\",\"request_no\":\"AR-000003\",\"project_name\":\"Project Contraction\",\"requested_by_name\":\"Workflow Project Manager\",\"requested_for_name\":\"Karim khan\",\"requested_asset_name\":\"\\u0644\\u067e\\u062a\\u0627\\u0628\",\"requested_asset_code\":\"GH434\",\"status\":\"approved\",\"action_url\":\"http:\\/\\/localhost:3000\\/asset-requests\",\"created_at\":\"2026-04-15T05:50:29.000000Z\"}', '2026-04-15 01:22:35', '2026-04-15 01:22:14', '2026-04-15 01:22:35'),
('92af1afa-875c-4450-a637-8fbf64a470c7', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"purchase_request_approval_required\",\"title\":\"Purchase Request Approval Required: PR-000002\",\"message\":\"A new purchase request is waiting for admin approval.\",\"module\":\"purchase_requests\",\"request_uuid\":\"38037780-3b38-4c42-9291-179478578c48\",\"request_no\":\"PR-000002\",\"request_type\":\"asset\",\"project_name\":null,\"warehouse_name\":\"Kabul Warehouse\",\"vendor_name\":\"\\u0634\\u0631\\u06a9\\u062a \\u062a\\u0648\\u0644\\u06cc\\u062f\",\"requested_by_name\":\"Workflow Storekeeper\",\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/purchase-requests\",\"created_at\":\"2026-04-15T05:05:31.000000Z\"}', NULL, '2026-04-15 00:35:34', '2026-04-15 00:35:34'),
('958d1def-5fbc-4638-9085-68363f738678', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"asset_request_approval_required\",\"title\":\"Asset Request Approval Required: AR-000001\",\"message\":\"A new asset request is waiting for admin approval.\",\"module\":\"asset_requests\",\"request_uuid\":\"694a930e-885c-44e3-a5a9-22315d221f67\",\"request_no\":\"AR-000001\",\"project_name\":\"Project Contraction\",\"requested_by_name\":\"System Admin\",\"requested_for_name\":\"Karim khan\",\"requested_asset_name\":\"Office Desk\",\"requested_asset_code\":\"OFFICE-0001\",\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/asset-requests\",\"created_at\":\"2026-04-15T05:22:48.000000Z\"}', NULL, '2026-04-15 00:52:48', '2026-04-15 00:52:48'),
('9d49d3ed-5231-4247-aa2d-cbcf6cb5f1bd', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"purchase_request_paid\",\"title\":\"Purchase Request Paid: PR-000002\",\"message\":\"Purchase payment processed by Workflow Accountant. Warehouse can now receive items.\",\"module\":\"purchase_requests\",\"request_uuid\":\"38037780-3b38-4c42-9291-179478578c48\",\"request_no\":\"PR-000002\",\"request_type\":\"asset\",\"project_name\":null,\"warehouse_name\":\"Kabul Warehouse\",\"vendor_name\":\"\\u0634\\u0631\\u06a9\\u062a \\u062a\\u0648\\u0644\\u06cc\\u062f\",\"requested_by_name\":\"Workflow Storekeeper\",\"status\":\"paid\",\"action_url\":\"http:\\/\\/localhost:3000\\/purchase-requests\",\"created_at\":\"2026-04-15T05:05:31.000000Z\"}', NULL, '2026-04-15 00:40:56', '2026-04-15 00:40:56'),
('9e470f4d-a5df-4f82-b31c-f32a13419988', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"material_request_approval_required\",\"title\":\"Material Request Approval Required: MR-000005\",\"message\":\"A new material request is waiting for admin approval.\",\"module\":\"material_requests\",\"request_uuid\":\"3e6d4e04-f52f-4e81-a2fb-f3196db6c18e\",\"request_no\":\"MR-000005\",\"project_name\":\"Project Contraction\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-14T10:26:56.000000Z\"}', NULL, '2026-04-14 05:56:56', '2026-04-14 05:56:56'),
('a2aad504-959e-450e-b10e-2f58e4c1a569', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 19, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000009\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"e6d7fb32-f611-4991-af6a-51c2c2d295cf\",\"sale_id\":\"SAL-000009\",\"customer_id\":1,\"customer_name\":\"Ahmad\",\"apartment_id\":8,\"apartment_label\":\"HHHHH-300 - Unit 404\",\"net_price\":12000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/e6d7fb32-f611-4991-af6a-51c2c2d295cf\\/financial\",\"created_at\":\"2026-04-07T05:27:22.542370Z\"}', NULL, '2026-04-07 00:57:22', '2026-04-07 00:57:22'),
('a3b372e5-3286-45f7-8741-da38ac21805d', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"asset_request_approved\",\"title\":\"Asset Request Approved: AR-000002\",\"message\":\"Asset request approved by System Admin.\",\"module\":\"asset_requests\",\"request_uuid\":\"ac3c0fdb-951d-474b-9794-05c880244e8a\",\"request_no\":\"AR-000002\",\"project_name\":\"New Project21\",\"requested_by_name\":\"Workflow Project Manager\",\"requested_for_name\":\"Karim khan\",\"requested_asset_name\":\"Office Desk\",\"requested_asset_code\":\"OFFICE-0001\",\"status\":\"approved\",\"action_url\":\"http:\\/\\/localhost:3000\\/asset-requests\",\"created_at\":\"2026-04-15T05:34:31.000000Z\"}', NULL, '2026-04-15 01:15:25', '2026-04-15 01:15:25'),
('b52b6aa8-72d3-4caa-9bc8-d42dc5426d5b', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 26, '{\"category\":\"material_request_approved\",\"title\":\"Material Request Approved: MR-000009\",\"message\":\"Material request approved by Workflow Admin.\",\"module\":\"material_requests\",\"request_uuid\":\"dfe2e1e5-463d-4d9f-85a7-edcac1a45158\",\"request_no\":\"MR-000009\",\"project_name\":\"Project Contraction\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"approved\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-15T09:50:40.000000Z\"}', NULL, '2026-04-15 05:21:37', '2026-04-15 05:21:37'),
('bc886b89-e688-43b0-97a8-126a704eeeec', 'App\\Notifications\\RentalBillCreatedFinanceNotification', 'App\\Models\\User', 25, '{\"category\":\"rental_bill_created_finance\",\"title\":\"Rental Bill Ready: RBL-000011\",\"message\":\"A customer rental bill was approved by System Admin and is ready for finance processing.\",\"rental_uuid\":\"6d9e19bc-7648-42b8-8025-ca231c5aebcb\",\"rental_id\":\"RNT-000007\",\"bill_uuid\":\"dce5daa5-0c1e-4da8-a7c8-b012ce438585\",\"bill_no\":\"RBL-000011\",\"tenant_id\":2,\"tenant_name\":\"Mahmod\",\"apartment_id\":16,\"apartment_label\":\"HJ232 - Unit 030\",\"payment_type\":\"advance\",\"amount_due\":60,\"due_date\":\"2026-04-18\",\"approved_by_user_id\":1,\"approved_by_name\":\"System Admin\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"created_at\":\"2026-04-18T05:48:35.734019Z\"}', NULL, '2026-04-18 01:18:35', '2026-04-18 01:18:35'),
('bf07df99-f258-4f4f-8fd1-0556ac6c2a46', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"purchase_request_paid\",\"title\":\"Purchase Request Paid: PR-000001\",\"message\":\"Purchase payment processed by Workflow Accountant. Warehouse can now receive items.\",\"module\":\"purchase_requests\",\"request_uuid\":\"eca77552-3074-454f-8055-067742377ab2\",\"request_no\":\"PR-000001\",\"request_type\":\"material\",\"project_name\":null,\"warehouse_name\":\"Kabul Warehouse\",\"vendor_name\":\"\\u0634\\u0631\\u06a9\\u062a \\u062a\\u0648\\u0644\\u06cc\\u062f\",\"requested_by_name\":\"Workflow Storekeeper\",\"status\":\"paid\",\"action_url\":\"http:\\/\\/localhost:3000\\/purchase-requests\",\"created_at\":\"2026-04-14T10:47:29.000000Z\"}', NULL, '2026-04-14 06:29:07', '2026-04-14 06:29:07'),
('bf43f68d-2aa3-423d-b136-6af3402bf6a9', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"material_request_approval_required\",\"title\":\"Material Request Approval Required: MR-000007\",\"message\":\"A new material request is waiting for admin approval.\",\"module\":\"material_requests\",\"request_uuid\":\"31e7e3e9-17d5-4613-8bb9-d3c472ebe7a9\",\"request_no\":\"MR-000007\",\"project_name\":\"Project Contraction\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-15T06:18:56.000000Z\"}', NULL, '2026-04-15 01:48:57', '2026-04-15 01:48:57'),
('c0d2f70a-e6c5-4213-b142-44f7dc8d9fe4', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"material_request_approval_required\",\"title\":\"Material Request Approval Required: MR-000006\",\"message\":\"A new material request is waiting for admin approval.\",\"module\":\"material_requests\",\"request_uuid\":\"006b604a-130a-403e-ae42-3df638e564a8\",\"request_no\":\"MR-000006\",\"project_name\":\"Project Contraction\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-14T10:35:53.000000Z\"}', NULL, '2026-04-14 06:05:53', '2026-04-14 06:05:53'),
('c1c8f4c8-1058-4e71-bd73-3a6f0b31a4b5', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 19, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000004\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"2a439163-01ff-4c33-b76a-a3fd6eebd393\",\"sale_id\":\"SAL-000004\",\"customer_id\":1,\"customer_name\":\"Ahmad\",\"apartment_id\":4,\"apartment_label\":\"GHTI3232 - Unit GH\",\"net_price\":3000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/2a439163-01ff-4c33-b76a-a3fd6eebd393\\/financial\",\"created_at\":\"2026-04-06T07:20:27.707850Z\"}', NULL, '2026-04-06 02:50:27', '2026-04-06 02:50:27'),
('c272faed-85c6-43d9-829e-f85be4f0ec90', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 27, '{\"category\":\"material_request_approval_required\",\"title\":\"Material Request Approval Required: MR-000008\",\"message\":\"A new material request is waiting for admin approval.\",\"module\":\"material_requests\",\"request_uuid\":\"c97d3744-2b28-4c13-8fa3-aad5ee36b5f3\",\"request_no\":\"MR-000008\",\"project_name\":\"New Project21\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-15T09:32:46.000000Z\"}', NULL, '2026-04-15 05:02:46', '2026-04-15 05:02:46'),
('c5ad838d-3f5e-4e91-ae58-653447489370', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"purchase_request_approved\",\"title\":\"Purchase Request Approved: PR-000003\",\"message\":\"Purchase request approved by System Admin.\",\"module\":\"purchase_requests\",\"request_uuid\":\"d006ab57-72ca-43d7-867f-db209627fd9e\",\"request_no\":\"PR-000003\",\"request_type\":\"asset\",\"project_name\":null,\"warehouse_name\":\"Kabul Warehouse\",\"vendor_name\":\"\\u0634\\u0631\\u06a9\\u062a \\u062a\\u0648\\u0644\\u06cc\\u062f\",\"requested_by_name\":\"Workflow Storekeeper\",\"status\":\"approved\",\"action_url\":\"http:\\/\\/localhost:3000\\/purchase-requests\",\"created_at\":\"2026-04-15T05:16:27.000000Z\"}', NULL, '2026-04-15 00:47:15', '2026-04-15 00:47:15'),
('c87c09d4-046b-42cc-a041-865dd2f7f354', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"purchase_request_approval_required\",\"title\":\"Purchase Request Approval Required: PR-000003\",\"message\":\"A new purchase request is waiting for admin approval.\",\"module\":\"purchase_requests\",\"request_uuid\":\"d006ab57-72ca-43d7-867f-db209627fd9e\",\"request_no\":\"PR-000003\",\"request_type\":\"asset\",\"project_name\":null,\"warehouse_name\":\"Kabul Warehouse\",\"vendor_name\":\"\\u0634\\u0631\\u06a9\\u062a \\u062a\\u0648\\u0644\\u06cc\\u062f\",\"requested_by_name\":\"Workflow Storekeeper\",\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/purchase-requests\",\"created_at\":\"2026-04-15T05:16:27.000000Z\"}', NULL, '2026-04-15 00:46:27', '2026-04-15 00:46:27'),
('d1511f23-3e0f-42eb-ae96-9fd7ce0e8bf5', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 19, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000005\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"351da0ab-84c2-44b6-94e6-ad4cd48da274\",\"sale_id\":\"SAL-000005\",\"customer_id\":2,\"customer_name\":\"Mahmod\",\"apartment_id\":5,\"apartment_label\":\"TEACHERGH3423 - Unit 40\",\"net_price\":2000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/351da0ab-84c2-44b6-94e6-ad4cd48da274\\/financial\",\"created_at\":\"2026-04-06T08:07:05.826671Z\"}', NULL, '2026-04-06 03:37:05', '2026-04-06 03:37:05'),
('d1deec87-7310-41df-8fe1-cca2c4220cbd', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"purchase_request_approved\",\"title\":\"Purchase Request Approved: PR-000001\",\"message\":\"Purchase request approved by System Admin.\",\"module\":\"purchase_requests\",\"request_uuid\":\"eca77552-3074-454f-8055-067742377ab2\",\"request_no\":\"PR-000001\",\"request_type\":\"material\",\"project_name\":null,\"warehouse_name\":\"Kabul Warehouse\",\"vendor_name\":\"\\u0634\\u0631\\u06a9\\u062a \\u062a\\u0648\\u0644\\u06cc\\u062f\",\"requested_by_name\":\"Workflow Storekeeper\",\"status\":\"approved\",\"action_url\":\"http:\\/\\/localhost:3000\\/purchase-requests\",\"created_at\":\"2026-04-14T10:47:29.000000Z\"}', NULL, '2026-04-14 06:19:13', '2026-04-14 06:19:13'),
('d8a81b7e-0085-480e-97b7-331b4dbb49c3', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 19, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000017\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"df91756c-0f9a-4c2c-b7b5-aee483504c69\",\"sale_id\":\"SAL-000017\",\"customer_id\":1,\"customer_name\":\"Ahmad\",\"apartment_id\":9,\"apartment_label\":\"TYU-3000 - Unit 505\",\"net_price\":40000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/df91756c-0f9a-4c2c-b7b5-aee483504c69\\/financial\",\"created_at\":\"2026-04-07T09:32:54.135408Z\"}', NULL, '2026-04-07 05:02:54', '2026-04-07 05:02:54'),
('da5420c4-34de-4b4e-907f-bac2ab55c94a', 'App\\Notifications\\SaleRejectedNotification', 'App\\Models\\User', 18, '{\"category\":\"sale_rejected\",\"title\":\"Sale Rejected: SAL-000018\",\"message\":\"Your apartment sale was rejected by System Admin. The sale is now cancelled.\",\"sale_uuid\":\"71c16207-54b5-4701-b94f-3a7ef82a11b3\",\"sale_id\":\"SAL-000018\",\"customer_id\":1,\"customer_name\":\"Ahmad\",\"apartment_id\":2,\"apartment_label\":\"HJ54545 - Unit 4949\",\"net_price\":434343,\"rejected_by_user_id\":1,\"rejected_by_name\":\"System Admin\",\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/71c16207-54b5-4701-b94f-3a7ef82a11b3\\/financial\",\"rejected_at\":\"2026-04-07T09:55:02.346797Z\"}', '2026-04-07 05:27:07', '2026-04-07 05:25:02', '2026-04-07 05:27:07'),
('def25977-5489-4abb-b594-7fa765cf513c', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"asset_request_approved\",\"title\":\"Asset Request Approved: AR-000001\",\"message\":\"Asset request approved by System Admin.\",\"module\":\"asset_requests\",\"request_uuid\":\"694a930e-885c-44e3-a5a9-22315d221f67\",\"request_no\":\"AR-000001\",\"project_name\":\"Project Contraction\",\"requested_by_name\":\"System Admin\",\"requested_for_name\":\"Karim khan\",\"requested_asset_name\":\"Office Desk\",\"requested_asset_code\":\"OFFICE-0001\",\"status\":\"approved\",\"action_url\":\"http:\\/\\/localhost:3000\\/asset-requests\",\"created_at\":\"2026-04-15T05:22:48.000000Z\"}', NULL, '2026-04-15 00:52:59', '2026-04-15 00:52:59'),
('e05f4cb6-4b76-4c54-a5b0-0eb84d3a7e34', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 26, '{\"category\":\"material_request_rejected\",\"title\":\"Material Request Rejected: MR-000007\",\"message\":\"Material request rejected by System Admin.\",\"module\":\"material_requests\",\"request_uuid\":\"31e7e3e9-17d5-4613-8bb9-d3c472ebe7a9\",\"request_no\":\"MR-000007\",\"project_name\":\"Project Contraction\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"rejected\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-15T06:18:56.000000Z\"}', NULL, '2026-04-15 05:00:00', '2026-04-15 05:00:00'),
('e447c1f0-82ff-4f15-b2a3-f9ee14cef4b7', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 26, '{\"category\":\"material_request_issued\",\"title\":\"Material Request Issued: MR-000008\",\"message\":\"Material request issued by Workflow Storekeeper.\",\"module\":\"material_requests\",\"request_uuid\":\"c97d3744-2b28-4c13-8fa3-aad5ee36b5f3\",\"request_no\":\"MR-000008\",\"project_name\":\"New Project21\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"issued\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests?queue=issued\",\"created_at\":\"2026-04-15T09:32:46.000000Z\"}', '2026-04-15 05:12:29', '2026-04-15 05:10:57', '2026-04-15 05:12:29'),
('e819360c-49e0-4085-82d7-1aac51b57932', 'App\\Notifications\\RentalApprovalRequiredNotification', 'App\\Models\\User', 25, '{\"category\":\"rental_approval_required\",\"title\":\"Rental Approval Required: RNT-000006\",\"message\":\"A new apartment rental was created and is waiting for admin approval.\",\"rental_uuid\":\"99b74ce9-3f52-4dbc-b73c-22e079cfbf6b\",\"rental_id\":\"RNT-000006\",\"tenant_id\":2,\"tenant_name\":\"Mahmod\",\"apartment_id\":15,\"apartment_label\":\"ALPH-400 - Unit 43\",\"monthly_rent\":50,\"status\":\"pending_admin_approval\",\"action_url\":\"http:\\/\\/localhost:3000\\/rentals?tab=pending-approval\",\"requested_at\":\"2026-04-18T05:19:34.145507Z\"}', NULL, '2026-04-18 00:49:34', '2026-04-18 00:49:34'),
('ed8c9cb7-bdae-498a-9df4-e9cf76598d28', 'App\\Notifications\\RentalApprovedNotification', 'App\\Models\\User', 29, '{\"category\":\"rental_approved\",\"title\":\"Rental Approved: RNT-000007\",\"message\":\"Your apartment rental was approved by System Admin. Finance can now process the payment.\",\"rental_uuid\":\"6d9e19bc-7648-42b8-8025-ca231c5aebcb\",\"rental_id\":\"RNT-000007\",\"tenant_id\":2,\"tenant_name\":\"Mahmod\",\"apartment_id\":16,\"apartment_label\":\"HJ232 - Unit 030\",\"monthly_rent\":20,\"approved_by_user_id\":1,\"approved_by_name\":\"System Admin\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"approved_at\":\"2026-04-18T05:48:28.000000Z\"}', NULL, '2026-04-18 01:18:28', '2026-04-18 01:18:28'),
('f26b2898-7b50-4fa7-8df1-470c3975acdd', 'App\\Notifications\\RentalBillCreatedFinanceNotification', 'App\\Models\\User', 25, '{\"category\":\"rental_bill_created_finance\",\"title\":\"Rental Bill Ready: RBL-000012\",\"message\":\"A customer rental bill was approved by System Admin and is ready for finance processing.\",\"rental_uuid\":\"6d9e19bc-7648-42b8-8025-ca231c5aebcb\",\"rental_id\":\"RNT-000007\",\"bill_uuid\":\"6d0feeec-3c10-413a-86ca-f67182ceb6ae\",\"bill_no\":\"RBL-000012\",\"tenant_id\":2,\"tenant_name\":\"Mahmod\",\"apartment_id\":16,\"apartment_label\":\"HJ232 - Unit 030\",\"payment_type\":\"monthly\",\"amount_due\":20,\"due_date\":\"2026-07-18\",\"approved_by_user_id\":1,\"approved_by_name\":\"System Admin\",\"action_url\":\"http:\\/\\/localhost:3000\\/rental-payments\",\"created_at\":\"2026-04-18T06:01:34.136526Z\"}', NULL, '2026-04-18 01:31:34', '2026-04-18 01:31:34');
INSERT INTO `notifications` (`id`, `type`, `notifiable_type`, `notifiable_id`, `data`, `read_at`, `created_at`, `updated_at`) VALUES
('fa265448-1343-40dd-85c0-37100f2cb541', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 19, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000012\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"620cbf9a-ef04-486f-bd15-e2ec12c04e00\",\"sale_id\":\"SAL-000012\",\"customer_id\":2,\"customer_name\":\"Mahmod\",\"apartment_id\":8,\"apartment_label\":\"HHHHH-300 - Unit 404\",\"net_price\":1000,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/620cbf9a-ef04-486f-bd15-e2ec12c04e00\\/financial\",\"created_at\":\"2026-04-07T05:47:12.754700Z\"}', NULL, '2026-04-07 01:17:12', '2026-04-07 01:17:12'),
('fb092d6e-bc4f-4a2c-a432-28e82a8a1f4e', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 25, '{\"category\":\"purchase_request_approved\",\"title\":\"Purchase Request Approved: PR-000002\",\"message\":\"Purchase request approved by System Admin.\",\"module\":\"purchase_requests\",\"request_uuid\":\"38037780-3b38-4c42-9291-179478578c48\",\"request_no\":\"PR-000002\",\"request_type\":\"asset\",\"project_name\":null,\"warehouse_name\":\"Kabul Warehouse\",\"vendor_name\":\"\\u0634\\u0631\\u06a9\\u062a \\u062a\\u0648\\u0644\\u06cc\\u062f\",\"requested_by_name\":\"Workflow Storekeeper\",\"status\":\"approved\",\"action_url\":\"http:\\/\\/localhost:3000\\/purchase-requests\",\"created_at\":\"2026-04-15T05:05:31.000000Z\"}', NULL, '2026-04-15 00:36:39', '2026-04-15 00:36:39'),
('fd725e08-ce58-4660-9595-e43cc373c9a4', 'App\\Notifications\\SaleRejectedNotification', 'App\\Models\\User', 18, '{\"category\":\"sale_rejected\",\"title\":\"Sale Rejected: SAL-000019\",\"message\":\"Your apartment sale was rejected by System Admin. The sale is now cancelled.\",\"sale_uuid\":\"65d9fbf0-7b61-40a9-a0f4-b8857e001687\",\"sale_id\":\"SAL-000019\",\"customer_id\":1,\"customer_name\":\"Ahmad\",\"apartment_id\":2,\"apartment_label\":\"HJ54545 - Unit 4949\",\"net_price\":3232323,\"rejected_by_user_id\":1,\"rejected_by_name\":\"System Admin\",\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/65d9fbf0-7b61-40a9-a0f4-b8857e001687\\/financial\",\"rejected_at\":\"2026-04-07T10:02:14.514010Z\"}', NULL, '2026-04-07 05:32:14', '2026-04-07 05:32:14'),
('fdd0af61-496f-4d99-afff-b8e7320a99b6', 'App\\Notifications\\WorkflowDatabaseNotification', 'App\\Models\\User', 27, '{\"category\":\"material_request_approved\",\"title\":\"Material Request Approved: MR-000008\",\"message\":\"Material request approved by Workflow Admin.\",\"module\":\"material_requests\",\"request_uuid\":\"c97d3744-2b28-4c13-8fa3-aad5ee36b5f3\",\"request_no\":\"MR-000008\",\"project_name\":\"New Project21\",\"warehouse_name\":\"Kabul Warehouse\",\"requested_by_name\":\"Workflow Project Manager\",\"status\":\"approved\",\"action_url\":\"http:\\/\\/localhost:3000\\/inventory-requests\",\"created_at\":\"2026-04-15T09:32:46.000000Z\"}', NULL, '2026-04-15 05:09:15', '2026-04-15 05:09:15'),
('ffcfee39-289a-4580-b6dc-39602411b18b', 'App\\Notifications\\SaleCreatedFinanceNotification', 'App\\Models\\User', 18, '{\"category\":\"sale_created_finance\",\"title\":\"New Sale Created: SAL-000020\",\"message\":\"A new apartment sale was created and is ready for finance payment processing.\",\"sale_uuid\":\"957813de-90e5-4742-9dcb-545171559d34\",\"sale_id\":\"SAL-000020\",\"customer_id\":1,\"customer_name\":\"Ahmad\",\"apartment_id\":2,\"apartment_label\":\"HJ54545 - Unit 4949\",\"net_price\":100,\"action_url\":\"http:\\/\\/localhost:3000\\/apartment-sales\\/957813de-90e5-4742-9dcb-545171559d34\\/financial\",\"created_at\":\"2026-04-07T10:45:30.630597Z\"}', NULL, '2026-04-07 06:15:30', '2026-04-07 06:15:30');

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
(34, 'employees.update\r\n', 'web', '2026-03-03 01:41:53', '2026-03-03 01:41:53'),
(35, 'employees.update', 'web', '2026-03-29 05:11:40', '2026-03-29 05:11:40'),
(36, 'projects.view', 'web', '2026-03-29 05:11:40', '2026-03-29 05:11:40'),
(37, 'projects.create', 'web', '2026-03-29 05:11:40', '2026-03-29 05:11:40'),
(38, 'projects.update', 'web', '2026-03-29 05:11:40', '2026-03-29 05:11:40'),
(39, 'inventory_master.view', 'web', '2026-03-29 05:11:40', '2026-03-29 05:11:40'),
(40, 'vendors.view', 'web', '2026-03-29 05:11:40', '2026-03-29 05:11:40'),
(41, 'vendors.create', 'web', '2026-03-29 05:11:40', '2026-03-29 05:11:40'),
(42, 'vendors.update', 'web', '2026-03-29 05:11:40', '2026-03-29 05:11:40'),
(43, 'warehouses.view', 'web', '2026-03-29 05:11:40', '2026-03-29 05:11:40'),
(44, 'warehouses.create', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(45, 'warehouses.update', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(46, 'materials.view', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(47, 'materials.create', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(48, 'materials.update', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(49, 'company_assets.view', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(50, 'company_assets.create', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(51, 'company_assets.update', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(52, 'warehouse_stock.view', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(53, 'material_requests.view', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(54, 'material_requests.create', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(55, 'material_requests.update', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(56, 'purchase_requests.view', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(57, 'purchase_requests.create', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(58, 'purchase_requests.update', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(59, 'asset_requests.view', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(60, 'asset_requests.create', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(61, 'asset_requests.update', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(62, 'stock_movements.view', 'web', '2026-03-29 05:11:41', '2026-03-29 05:11:41'),
(63, 'accounts.view', 'web', '2026-04-05 02:06:54', '2026-04-05 02:06:54'),
(64, 'accounts.create', 'web', '2026-04-05 02:06:54', '2026-04-05 02:06:54'),
(65, 'accounts.update', 'web', '2026-04-05 02:06:54', '2026-04-05 02:06:54'),
(66, 'account_transactions.view', 'web', '2026-04-05 02:06:54', '2026-04-05 02:06:54'),
(67, 'exchange_rates.view', 'web', '2026-04-05 06:50:18', '2026-04-05 06:50:18'),
(68, 'exchange_rates.create', 'web', '2026-04-05 06:50:18', '2026-04-05 06:50:18'),
(69, 'exchange_rates.update', 'web', '2026-04-05 06:50:18', '2026-04-05 06:50:18'),
(70, 'material_requests.issue', 'web', '2026-04-14 04:43:14', '2026-04-14 04:43:14'),
(71, 'purchase_requests.finance', 'web', '2026-04-14 04:43:14', '2026-04-14 04:43:14'),
(72, 'purchase_requests.receive', 'web', '2026-04-14 04:43:14', '2026-04-14 04:43:14');

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
(320, 'App\\Models\\User', 3, 'web', '0f9fd8fc251ff1e2fdfc3b1638cd67ec8afefa0424d9c0278f473627de1b2b8e', '[\"*\"]', '2026-03-14 03:02:00', NULL, '2026-03-14 02:58:43', '2026-03-14 03:02:00'),
(347, 'App\\Models\\User', 13, 'web', '7b7b889b54c6f2159320a2f1be59f54762c4f9e6ded354211cd996a34879dc5b', '[\"*\"]', '2026-03-18 02:22:48', NULL, '2026-03-18 02:18:13', '2026-03-18 02:22:48'),
(359, 'App\\Models\\User', 17, 'web', '13d3d2cb8282681dcf2cef01ae56c0ff0174da3760cc1a1387e915970f83deab', '[\"*\"]', '2026-03-18 07:04:00', NULL, '2026-03-18 03:41:09', '2026-03-18 07:04:00'),
(360, 'App\\Models\\User', 12, 'web', 'aa5ffa31ece23de9e3636d7d27c76e53a93606e0923fee0999012d4aad4f6ef4', '[\"*\"]', '2026-03-18 03:58:28', NULL, '2026-03-18 03:43:38', '2026-03-18 03:58:28'),
(443, 'App\\Models\\User', 2, 'web', 'b4ea076aac7a72c198d983f8f9183fcd45cfa35c09d3d05653d2c4eb590e8989', '[\"*\"]', '2026-04-07 03:00:50', NULL, '2026-04-07 03:00:38', '2026-04-07 03:00:50'),
(445, 'App\\Models\\User', 19, 'web', '1ad06b5187a00427d26a7a9349af1ff388225752b7a681fec77baf9a613ff767', '[\"*\"]', '2026-04-07 03:01:44', NULL, '2026-04-07 03:01:28', '2026-04-07 03:01:44'),
(453, 'App\\Models\\User', 18, 'web', '5cfd600dca9c71f7621f25586933c9b4f23d804a2358573c14690ed6e5d6476d', '[\"*\"]', '2026-04-08 04:20:43', NULL, '2026-04-07 04:18:31', '2026-04-08 04:20:43'),
(468, 'App\\Models\\User', 22, 'web', '8a7e3e455c514f2005dbba4c505b2bd53da07b944db34b2823497be08a8b6b95', '[\"*\"]', '2026-04-13 05:20:37', NULL, '2026-04-13 05:19:38', '2026-04-13 05:20:37'),
(471, 'App\\Models\\User', 23, 'web', '776fc96481eb136e91ab0f5936947ba57931a7753801e160b4fc2485183d7d36', '[\"*\"]', '2026-04-14 02:12:59', NULL, '2026-04-14 01:59:03', '2026-04-14 02:12:59'),
(473, 'App\\Models\\User', 24, 'web', '32989f69a3aba7f32dd04d87e31b3bc2df60610b4483a15b3b4b04d49f85f81b', '[\"*\"]', '2026-04-14 04:13:19', NULL, '2026-04-14 03:11:05', '2026-04-14 04:13:19'),
(487, 'App\\Models\\User', 27, 'web', '44aed7b13547ad2cd990fed473396427e5e9faaf7fa519eeddd6bf2d7d9f318e', '[\"*\"]', '2026-04-21 02:15:17', NULL, '2026-04-15 01:13:33', '2026-04-21 02:15:17'),
(488, 'App\\Models\\User', 26, 'web', '143e89a2591c2facbca187d402d3d53bd036d90da53e71cb4a00bffbbd91ad1e', '[\"*\"]', '2026-04-15 05:45:54', NULL, '2026-04-15 05:01:11', '2026-04-15 05:45:54'),
(492, 'App\\Models\\User', 25, 'web', '0c27d85155f3862604c764f79b421c156788031da00aca99bbb0ab83c8fc745a', '[\"*\"]', '2026-04-16 00:57:51', NULL, '2026-04-15 06:32:30', '2026-04-16 00:57:51'),
(498, 'App\\Models\\User', 29, 'web', 'aede70c41c7319eea82ea45f0263e928a8c42d1fc2241f65118e319979cdfa4d', '[\"*\"]', '2026-04-18 04:45:34', NULL, '2026-04-18 00:06:51', '2026-04-18 04:45:34'),
(499, 'App\\Models\\User', 28, 'web', '0e57b0c5462334d84d0e297c3959d63880e9ec400ebef63e4bb53b55add947db', '[\"*\"]', '2026-04-19 01:54:28', NULL, '2026-04-18 00:07:56', '2026-04-19 01:54:28'),
(505, 'App\\Models\\User', 30, 'web', '420f6214994b8de3d2fd39ade858762d477f0a793492f7f2d2ccff5d512474e6', '[\"*\"]', '2026-04-19 02:24:07', NULL, '2026-04-19 02:18:40', '2026-04-19 02:24:07'),
(509, 'App\\Models\\User', 1, 'web', '13fc54adda79ef81a0beaa97d2bb8007773253a648ba6b02fedfa7298297c90b', '[\"*\"]', '2026-04-20 04:33:59', NULL, '2026-04-20 02:57:29', '2026-04-20 04:33:59');

-- --------------------------------------------------------

--
-- Table structure for table `projects`
--

CREATE TABLE `projects` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `project_manager_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'planned',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `project_employee_assignments`
--

CREATE TABLE `project_employee_assignments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `project_id` bigint(20) UNSIGNED NOT NULL,
  `employee_id` bigint(20) UNSIGNED NOT NULL,
  `assigned_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `status` varchar(40) NOT NULL DEFAULT 'active',
  `assigned_at` timestamp NULL DEFAULT NULL,
  `released_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `project_material_stocks`
--

CREATE TABLE `project_material_stocks` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `project_id` bigint(20) UNSIGNED NOT NULL,
  `material_id` bigint(20) UNSIGNED NOT NULL,
  `qty_issued` decimal(14,2) NOT NULL DEFAULT 0.00,
  `qty_consumed` decimal(14,2) NOT NULL DEFAULT 0.00,
  `qty_returned` decimal(14,2) NOT NULL DEFAULT 0.00,
  `qty_on_site` decimal(14,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_requests`
--

CREATE TABLE `purchase_requests` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `request_no` varchar(255) NOT NULL,
  `request_type` varchar(30) NOT NULL DEFAULT 'material',
  `source_material_request_id` bigint(20) UNSIGNED DEFAULT NULL,
  `project_id` bigint(20) UNSIGNED DEFAULT NULL,
  `warehouse_id` bigint(20) UNSIGNED NOT NULL,
  `vendor_id` bigint(20) UNSIGNED DEFAULT NULL,
  `requested_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `requested_by_employee_id` bigint(20) UNSIGNED DEFAULT NULL,
  `status` varchar(40) NOT NULL DEFAULT 'pending',
  `approved_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `rejected_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `received_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `payment_processed_by_user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `received_at` timestamp NULL DEFAULT NULL,
  `payment_processed_at` timestamp NULL DEFAULT NULL,
  `payment_account_id` bigint(20) UNSIGNED DEFAULT NULL,
  `payment_account_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `payment_amount` decimal(14,2) DEFAULT NULL,
  `payment_currency_code` varchar(10) DEFAULT NULL,
  `payment_exchange_rate_snapshot` decimal(18,6) DEFAULT NULL,
  `payment_account_amount` decimal(14,2) DEFAULT NULL,
  `payment_slip_no` varchar(255) DEFAULT NULL,
  `payment_notes` text DEFAULT NULL,
  `purchase_receipt_no` varchar(255) DEFAULT NULL,
  `requested_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `purchase_request_items`
--

CREATE TABLE `purchase_request_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `purchase_request_id` bigint(20) UNSIGNED NOT NULL,
  `item_kind` varchar(30) NOT NULL DEFAULT 'material',
  `material_id` bigint(20) UNSIGNED DEFAULT NULL,
  `company_asset_id` bigint(20) UNSIGNED DEFAULT NULL,
  `asset_name` varchar(255) DEFAULT NULL,
  `asset_type` varchar(50) DEFAULT NULL,
  `asset_code_prefix` varchar(50) DEFAULT NULL,
  `quantity_requested` decimal(14,2) NOT NULL,
  `quantity_approved` decimal(14,2) NOT NULL DEFAULT 0.00,
  `quantity_received` decimal(14,2) NOT NULL DEFAULT 0.00,
  `estimated_unit_price` decimal(14,2) DEFAULT NULL,
  `estimated_line_total` decimal(14,2) DEFAULT NULL,
  `actual_unit_price` decimal(14,2) DEFAULT NULL,
  `actual_line_total` decimal(14,2) DEFAULT NULL,
  `unit` varchar(100) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `account_id` bigint(20) UNSIGNED DEFAULT NULL,
  `account_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `payment_currency_code` varchar(10) DEFAULT NULL,
  `exchange_rate_snapshot` decimal(12,6) DEFAULT NULL,
  `account_amount` decimal(15,2) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
('589c935d-f12c-4801-8a53-3ad6703c743c', 8, 'Auditor', 'web', '2026-02-28 02:40:36', '2026-02-28 02:40:36', NULL),
('ce3adf7b-b454-4916-96d5-abc1aff4127d', 9, 'Customer', 'web', '2026-04-13 00:26:41', '2026-04-13 00:26:41', NULL),
('9045cc8b-c40a-40e2-97f9-dcd6628eade3', 10, 'Warehouse Manager', 'web', '2026-04-14 02:09:57', '2026-04-14 02:16:58', NULL);

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
(7, 2),
(8, 1),
(8, 2),
(9, 1),
(9, 2),
(10, 1),
(11, 1),
(12, 1),
(13, 1),
(14, 1),
(15, 1),
(16, 1),
(17, 1),
(18, 1),
(19, 1),
(20, 1),
(21, 1),
(22, 1),
(23, 1),
(24, 1),
(25, 1),
(26, 1),
(27, 1),
(28, 1),
(29, 1),
(30, 1),
(31, 1),
(32, 1),
(35, 1),
(36, 1),
(37, 1),
(38, 1),
(39, 1),
(40, 1),
(41, 1),
(42, 1),
(43, 1),
(44, 1),
(45, 1),
(46, 1),
(47, 1),
(48, 1),
(49, 1),
(50, 1),
(51, 1),
(52, 1),
(53, 1),
(54, 1),
(55, 1),
(56, 1),
(57, 1),
(58, 1),
(59, 1),
(60, 1),
(61, 1),
(62, 1),
(63, 1),
(64, 1),
(65, 1),
(66, 1),
(67, 1),
(68, 1),
(69, 1);

-- --------------------------------------------------------

--
-- Table structure for table `salary_advances`
--

CREATE TABLE `salary_advances` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `employee_id` bigint(20) UNSIGNED NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `currency_code` varchar(10) NOT NULL DEFAULT 'USD',
  `deducted_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `remaining_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'pending',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `salary_advance_deductions`
--

CREATE TABLE `salary_advance_deductions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `salary_payment_id` bigint(20) UNSIGNED NOT NULL,
  `salary_advance_id` bigint(20) UNSIGNED NOT NULL,
  `amount` decimal(14,2) NOT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
  `gross_salary_usd` decimal(14,2) DEFAULT NULL,
  `salary_currency_code` varchar(10) NOT NULL DEFAULT 'USD',
  `salary_exchange_rate_snapshot` decimal(14,6) DEFAULT NULL,
  `advance_deducted` decimal(14,2) NOT NULL DEFAULT 0.00,
  `advance_deducted_usd` decimal(14,2) DEFAULT NULL,
  `tax_percentage` decimal(5,2) NOT NULL DEFAULT 0.00,
  `tax_deducted` decimal(14,2) NOT NULL DEFAULT 0.00,
  `tax_deducted_usd` decimal(14,2) DEFAULT NULL,
  `other_deductions` decimal(14,2) NOT NULL DEFAULT 0.00,
  `other_deductions_usd` decimal(14,2) DEFAULT NULL,
  `net_salary` decimal(14,2) NOT NULL,
  `net_salary_usd` decimal(14,2) DEFAULT NULL,
  `status` varchar(50) NOT NULL DEFAULT 'draft',
  `account_id` bigint(20) UNSIGNED DEFAULT NULL,
  `account_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `payment_currency_code` varchar(10) DEFAULT NULL,
  `exchange_rate_snapshot` decimal(16,6) DEFAULT NULL,
  `net_salary_account_amount` decimal(14,2) DEFAULT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `paid_at` datetime DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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
('40cxOyB9IZRyrX97JKsSgoQnV0TbsFDlnkRz7yNy', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', 'YTozOntzOjY6Il90b2tlbiI7czo0MDoiZllLNmkzc2F0Wko0QWxjcjVWVEtJVmJFUm9NV0FEUGltYjkxNkhWciI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly9sb2NhbGhvc3Q6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==', 1775551264),
('aRwhS39fgRhGXrb6VspN43aYKWGc6A3tHlFXIS4F', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', 'YTozOntzOjY6Il90b2tlbiI7czo0MDoic1Y3Nkd1VWNBVTdHZEtpYmo2cUMxbDRPcGpwY1hGZ1JaQzNNcWdycyI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly9sb2NhbGhvc3Q6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==', 1776231707),
('gjs8UqQVvkSdkcfhEwHSJJci7K7DQNDc1jxQ5jg4', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', 'YTozOntzOjY6Il90b2tlbiI7czo0MDoiZkpZWXRJYThsMG1hZ1FLTTFFV1JKUHM5N2NyN0FvMkdlSlloczQ1MyI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly9sb2NhbGhvc3Q6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==', 1776570741),
('qM0RrDbrJjEjzjiNef2e6T9ytQ6QLa4m3gdXWwut', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', 'YTozOntzOjY6Il90b2tlbiI7czo0MDoiN2xUM2g0YnFFbFBPcEF1QVBZcklvT1BNa0JUVHA4M0labWlNRE03diI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly9sb2NhbGhvc3Q6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==', 1775626369),
('rtuZR5nXSTcrOmtiHUNKl87aeef7JgoYJkiDsaMu', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', 'YTozOntzOjY6Il90b2tlbiI7czo0MDoiNUZHSldGS0NqVjVoNWpLRlFacUpmeEFaNEFqNVdKRWFtaDlYVWVHbSI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly9sb2NhbGhvc3Q6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==', 1776059724),
('vfZZCRRILBsifBPxDNJmF6wlxIBNOFwfd5iMrqB8', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36', 'YTozOntzOjY6Il90b2tlbiI7czo0MDoiT1Zzb0g5MjlMNm4zWXAycU5iQ3FNTVNzMGhzQ25UZlVoSGNITGw0YiI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly9sb2NhbGhvc3Q6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==', 1776161400),
('YCMW5kSF9Shtn1WnlVXJzcksyabOhSZDeWISsNFO', NULL, '127.0.0.1', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36', 'YTozOntzOjY6Il90b2tlbiI7czo0MDoiaTg2ZFNWeXZzd2VwYndXMGo2MkhOMUp3VjhHSmFnVFVFUGpOemVlTSI7czo5OiJfcHJldmlvdXMiO2E6Mjp7czozOiJ1cmwiO3M6MjE6Imh0dHA6Ly9sb2NhbGhvc3Q6ODAwMCI7czo1OiJyb3V0ZSI7Tjt9czo2OiJfZmxhc2giO2E6Mjp7czozOiJvbGQiO2E6MDp7fXM6MzoibmV3IjthOjA6e319fQ==', 1776227356);

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
(1, 1, '2ad2fb31-c375-4501-9173-46c312acbdf5', 'roles', '4b18db9c-ef11-49d4-b6b7-8308ff06094f', 'update', '2026-04-19 01:51:25', '2026-04-19 01:51:25', '2026-04-19 01:51:25'),
(2, 1, '2fd0ad12-df65-4f2d-9bcb-78a3b5a4cc3e', 'users', 'c7773fdb-2d91-47c8-859c-def840ece922', 'create', '2026-04-19 01:56:20', '2026-04-19 01:56:20', '2026-04-19 01:56:20'),
(3, 1, 'f61cbd9f-96a6-444b-b367-4b99d15d9048', 'roles', 'ad279ada-3611-4326-afd7-b3a4a1c3184f', 'update', '2026-04-19 02:00:35', '2026-04-19 02:00:35', '2026-04-19 02:00:35'),
(4, 1, 'fd2f34fe-ba03-4879-905b-d1eec26bcf7d', 'roles', 'ad279ada-3611-4326-afd7-b3a4a1c3184f', 'update', '2026-04-19 02:05:11', '2026-04-19 02:05:11', '2026-04-19 02:05:11'),
(5, 1, '8c928abd-282a-4d2f-b198-b0152207f602', 'roles', 'ad279ada-3611-4326-afd7-b3a4a1c3184f', 'update', '2026-04-19 02:17:50', '2026-04-19 02:17:50', '2026-04-19 02:17:50'),
(6, 1, 'd05163e0-5b3b-4b2d-b7cb-725d0c70fc0e', 'users', '13723096-def2-449f-90d4-8aed59d391ea', 'create', '2026-04-20 00:57:29', '2026-04-20 00:57:29', '2026-04-20 00:57:29');

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
  `customer_id` bigint(20) UNSIGNED DEFAULT NULL,
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

INSERT INTO `users` (`id`, `uuid`, `full_name`, `name`, `email`, `phone`, `customer_id`, `email_verified_at`, `password`, `status`, `remember_token`, `created_at`, `updated_at`, `last_login_at`, `deleted_at`) VALUES
(1, '290225db-0f79-49dd-9bb2-8e4fea19eb65', 'System Admin', 'System Admin', 'admin@gmail.com', '000000000', NULL, NULL, '$2y$12$x0Eq0HojHz.GfTf/FQRHUum0Zbj9oPL4I7pr0QFYXPxzGfAnmSpDq', 'active', NULL, '2026-02-28 02:40:37', '2026-04-20 02:57:29', '2026-04-20 02:57:29', NULL),
(2, '5af1f3dc-8e6c-449d-b3cc-53da45479951', 'ahmad', 'ahmad', 'ahmad@gmail.com', NULL, NULL, NULL, '$2y$12$piIuCQYHqacfJfhPb0PUA.KlDBu4lIbskX7/hcmWcnFSLZVU8h4dG', 'active', NULL, '2026-03-03 00:53:18', '2026-04-14 03:08:59', '2026-04-07 03:00:38', '2026-04-14 03:08:59'),
(3, 'ad821e3b-2a90-4213-86b0-3b28c5eb6924', 'tahir', 'tahir', 'tahir@gmail.com', NULL, NULL, NULL, '$2y$12$qQrL31Z3kh5UXlaa0zLtnO5DoTGwi93OaL4mA1Wv9bx6sm92kV6ju', 'active', NULL, '2026-03-07 00:11:52', '2026-03-17 05:43:33', '2026-03-14 02:58:43', '2026-03-17 05:43:33'),
(12, 'faf2c756-de04-4e8d-a145-adba997e3e9c', 'shams', 'shams', 'shams@gmail.com', NULL, NULL, NULL, '$2y$12$iQN0xDA5s2I//t.BzC6fbOrwG16H1shhRJEZfWTKTYms/4JfIsjei', 'active', NULL, '2026-03-14 03:17:24', '2026-03-29 02:32:47', '2026-03-18 03:43:38', '2026-03-29 02:32:47'),
(17, '548663d5-8770-4617-b458-72e17e31f364', 'example', 'example', 'example@gmail.com', NULL, NULL, NULL, '$2y$12$mo/pPHymcIpfE1QUrh8LvulUPuyS.CbJSGA2LnfJV2V7urTnMWIKG', 'active', NULL, '2026-03-18 03:10:12', '2026-03-29 02:32:52', '2026-03-18 03:41:09', '2026-03-29 02:32:52'),
(18, '71c1b326-6226-48be-b08b-40906de01ad2', 'example55', 'example55', 'example55@gmail.com', NULL, NULL, NULL, '$2y$12$IOWBnuubGDyT9v1VcTAMvOONJDC2GWXhE3K76S2E/ST5qL3MCaoJS', 'active', NULL, '2026-03-30 02:27:34', '2026-04-14 03:09:09', '2026-04-07 04:18:31', '2026-04-14 03:09:09'),
(19, '78b9969c-3cdf-422f-b043-c11d6bdf7884', 'karim', 'karim', 'karim@gmail.com', NULL, NULL, NULL, '$2y$12$LgMThOyzKSOdPswQhqYGXeZowtyV16/qQvX.O8u5fj6Pz0sjxzfHm', 'active', NULL, '2026-04-01 05:41:28', '2026-04-14 03:09:04', '2026-04-07 03:01:28', '2026-04-14 03:09:04'),
(20, '38ba72f6-dce6-49b4-9858-94aeda4aa35d', 'example1', 'example1', 'example1@gmail.com', NULL, NULL, NULL, '$2y$12$VC.RatRAS6IIhRhxWuxyWOisKQfT97GFjMSSJ6TlWUquQe14RSoPG', 'active', NULL, '2026-04-02 04:01:21', '2026-04-14 03:09:01', NULL, '2026-04-14 03:09:01'),
(21, 'd6c4ffb9-7b9a-4342-a91d-96978e28743f', 'example123', 'example123', 'example123@gmail.com', NULL, NULL, NULL, '$2y$12$3WESJdtpZJJtwAJBXemyf.K51TPpR2i0bGtwfAUwXLUzGVTc5bNXu', 'active', NULL, '2026-04-02 06:00:01', '2026-04-14 03:08:54', NULL, '2026-04-14 03:08:54'),
(22, 'b284894b-7b8d-429d-9b32-58dd175d732a', 'customer', 'customer', 'customer@gmail.com', NULL, 1, NULL, '$2y$12$Op875R7G.uK.ob2xj12Gu.Bn5FTw2YnSqsSlDM8snJYVITjx68Rbe', 'active', NULL, '2026-04-13 01:41:59', '2026-04-14 05:20:49', '2026-04-13 05:19:38', '2026-04-14 05:20:49'),
(23, '5e683e80-f50e-4f58-aa96-056cd170db94', 'finance', 'finance', 'finance@gmail.com', NULL, NULL, NULL, '$2y$12$TnnDA24Kl3rSLs4M6jCVEORS5YPvhFyOy1wJQCpuN/p.1OGzEKOCW', 'active', NULL, '2026-04-14 01:58:21', '2026-04-14 05:20:43', '2026-04-14 01:59:03', '2026-04-14 05:20:43'),
(24, '4d1099c2-e62b-48e2-abb1-67ac1e87e2d9', 'manager', 'manager', 'projectmanager@gmail.com', NULL, NULL, NULL, '$2y$12$cbeNkp6Y1tT83.GJuTLXmOEn.z2dfpwpDSQLt11DIi/2KQ4ovdFRu', 'active', NULL, '2026-04-14 03:10:33', '2026-04-14 05:20:53', '2026-04-14 03:11:05', '2026-04-14 05:20:53'),
(25, '57a07293-7c12-4500-87c1-cb9149257518', 'Workflow Admin', 'Workflow Admin', 'workflow.admin@example.com', NULL, NULL, NULL, '$2y$12$3pCvM4D5l1B3Vrd0Ov6Zn.VbZKCShHOXQkCZQby/L6XE9frflILBa', 'active', NULL, '2026-04-14 04:43:15', '2026-04-15 06:32:30', '2026-04-15 06:32:30', NULL),
(26, 'dd87ef0c-bbbc-462a-bf92-d4676ff6a077', 'Workflow Project Manager', 'Workflow Project Manager', 'workflow.pm@example.com', NULL, NULL, NULL, '$2y$12$6LlU4KO9lprIwT/uU19QTuS9rYTqux2eAIr8zQA3KknpavCXVCqjC', 'active', NULL, '2026-04-14 04:43:15', '2026-04-15 05:01:11', '2026-04-15 05:01:11', NULL),
(27, '9a0f1192-83c1-4692-8dce-3cc872ac7cbd', 'Workflow Storekeeper', 'Workflow Storekeeper', 'workflow.storekeeper@example.com', NULL, NULL, NULL, '$2y$12$emFAqGmISvPom.aZitgP4.7Wq.ju1yBXy5.IyLlNK2VmTx46idYmu', 'active', NULL, '2026-04-14 04:43:16', '2026-04-15 01:13:33', '2026-04-15 01:13:33', NULL),
(28, '6678238a-bd14-44ea-abcc-52c98c26aca3', 'Workflow Accountant', 'Workflow Accountant', 'workflow.finance@example.com', NULL, NULL, NULL, '$2y$12$DmQmsoWY9lc8xDVu7cpQKuDBRgR4wzr7yFUuH2DyTAzTc5SZgfJgm', 'active', NULL, '2026-04-14 04:43:16', '2026-04-18 00:07:56', '2026-04-18 00:07:56', NULL),
(29, 'a1e68fce-bcbe-4c3e-8af6-f5e9846918fd', 'worflow apartment', 'worflow apartment', 'apartmanager@gamil.com', NULL, NULL, NULL, '$2y$12$awvPmRWnGbjZ7/oAvWDEIuyUMuPe8EbqAWA20wCJ/sPjW71SCfQNe', 'active', NULL, '2026-04-16 04:25:46', '2026-04-18 00:06:51', '2026-04-18 00:06:51', NULL),
(30, 'c7773fdb-2d91-47c8-859c-def840ece922', 'workflow', 'workflow', 'workflow.apartmentmanager@gmail.com', NULL, NULL, NULL, '$2y$12$7K3VaMW4sLx1JEzAfrZzL.dek5zdbQGMZX49KYl5fXMl0Nxh6g6ty', 'active', NULL, '2026-04-19 01:56:20', '2026-04-19 02:18:40', '2026-04-19 02:18:40', NULL),
(31, '13723096-def2-449f-90d4-8aed59d391ea', 'ABC', 'ABC', 'abc@gmail.com', NULL, NULL, NULL, '$2y$12$ilWWDAiWdGlfE7KCtTviTeGvraBkGCy887imkU/n..I1DjkNb4OPG', 'active', NULL, '2026-04-20 00:57:29', '2026-04-20 00:57:29', NULL, NULL);

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

-- --------------------------------------------------------

--
-- Table structure for table `warehouse_material_stocks`
--

CREATE TABLE `warehouse_material_stocks` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` char(36) NOT NULL,
  `warehouse_id` bigint(20) UNSIGNED NOT NULL,
  `material_id` bigint(20) UNSIGNED NOT NULL,
  `qty_on_hand` decimal(14,2) NOT NULL DEFAULT 0.00,
  `qty_reserved` decimal(14,2) NOT NULL DEFAULT 0.00,
  `qty_available` decimal(14,2) NOT NULL DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `warehouse_material_stocks`
--

INSERT INTO `warehouse_material_stocks` (`id`, `uuid`, `warehouse_id`, `material_id`, `qty_on_hand`, `qty_reserved`, `qty_available`, `created_at`, `updated_at`) VALUES
(1, 'c4a202f4-e23e-43c0-957b-fdbd3f55e8aa', 1, 1, 7.00, 0.00, 7.00, '2026-04-02 03:38:19', '2026-04-15 05:27:29');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `accounts`
--
ALTER TABLE `accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `accounts_uuid_unique` (`uuid`),
  ADD UNIQUE KEY `accounts_name_unique` (`name`),
  ADD KEY `accounts_account_type_status_index` (`account_type`,`status`),
  ADD KEY `accounts_updated_at_index` (`updated_at`);

--
-- Indexes for table `account_transactions`
--
ALTER TABLE `account_transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `account_transactions_uuid_unique` (`uuid`),
  ADD KEY `account_transactions_created_by_user_id_foreign` (`created_by_user_id`),
  ADD KEY `account_transactions_reversal_of_id_foreign` (`reversal_of_id`),
  ADD KEY `account_transactions_account_id_transaction_date_index` (`account_id`,`transaction_date`),
  ADD KEY `account_transactions_reference_type_reference_uuid_index` (`reference_type`,`reference_uuid`),
  ADD KEY `account_transactions_module_status_index` (`module`,`status`),
  ADD KEY `account_transactions_updated_at_index` (`updated_at`);

--
-- Indexes for table `apartments`
--
ALTER TABLE `apartments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `apartments_uuid_unique` (`uuid`),
  ADD UNIQUE KEY `apartments_apartment_code_unique` (`apartment_code`);

--
-- Indexes for table `apartment_qr_access_tokens`
--
ALTER TABLE `apartment_qr_access_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `apartment_qr_access_tokens_uuid_unique` (`uuid`),
  ADD UNIQUE KEY `apartment_qr_access_tokens_apartment_id_unique` (`apartment_id`),
  ADD UNIQUE KEY `apartment_qr_access_tokens_token_unique` (`token`),
  ADD KEY `apartment_qr_access_tokens_created_by_user_id_foreign` (`created_by_user_id`);

--
-- Indexes for table `apartment_qr_scan_logs`
--
ALTER TABLE `apartment_qr_scan_logs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `apartment_qr_scan_logs_uuid_unique` (`uuid`),
  ADD KEY `apartment_qr_scan_logs_apartment_qr_access_token_id_foreign` (`apartment_qr_access_token_id`),
  ADD KEY `apartment_qr_scan_logs_apartment_id_foreign` (`apartment_id`),
  ADD KEY `apartment_qr_scan_logs_apartment_sale_id_foreign` (`apartment_sale_id`),
  ADD KEY `apartment_qr_scan_logs_user_id_foreign` (`user_id`);

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
  ADD KEY `asset_requests_status_updated_at_index` (`status`,`updated_at`),
  ADD KEY `asset_requests_requested_by_user_id_foreign` (`requested_by_user_id`),
  ADD KEY `asset_requests_rejected_by_user_id_foreign` (`rejected_by_user_id`);

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
  ADD KEY `company_assets_current_employee_id_foreign` (`current_employee_id`),
  ADD KEY `company_assets_current_warehouse_id_foreign` (`current_warehouse_id`);

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
-- Indexes for table `document_types`
--
ALTER TABLE `document_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `document_types_module_code_unique` (`module`,`code`),
  ADD UNIQUE KEY `document_types_uuid_unique` (`uuid`),
  ADD KEY `document_types_module_active_idx` (`module`,`is_active`);

--
-- Indexes for table `employees`
--
ALTER TABLE `employees`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `employees_uuid_unique` (`uuid`);

--
-- Indexes for table `employee_salary_histories`
--
ALTER TABLE `employee_salary_histories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `employee_salary_histories_uuid_unique` (`uuid`),
  ADD KEY `employee_salary_histories_changed_by_foreign` (`changed_by`),
  ADD KEY `employee_salary_histories_employee_id_effective_from_index` (`employee_id`,`effective_from`),
  ADD KEY `employee_salary_histories_updated_at_index` (`updated_at`);

--
-- Indexes for table `exchange_rates`
--
ALTER TABLE `exchange_rates`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `exchange_rates_uuid_unique` (`uuid`),
  ADD KEY `exchange_rates_approved_by_user_id_foreign` (`approved_by_user_id`),
  ADD KEY `exchange_rates_base_currency_quote_currency_is_active_index` (`base_currency`,`quote_currency`,`is_active`),
  ADD KEY `exchange_rates_effective_date_index` (`effective_date`),
  ADD KEY `exchange_rates_updated_at_index` (`updated_at`);

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
  ADD KEY `installment_payments_received_by_foreign` (`received_by`),
  ADD KEY `installment_payments_account_id_foreign` (`account_id`),
  ADD KEY `installment_payments_account_transaction_id_foreign` (`account_transaction_id`);

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
  ADD KEY `material_requests_status_updated_at_index` (`status`,`updated_at`),
  ADD KEY `material_requests_requested_by_user_id_foreign` (`requested_by_user_id`),
  ADD KEY `material_requests_rejected_by_user_id_foreign` (`rejected_by_user_id`);

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
  ADD KEY `municipality_receipts_received_by_foreign` (`received_by`),
  ADD KEY `municipality_receipts_account_id_foreign` (`account_id`),
  ADD KEY `municipality_receipts_account_transaction_id_foreign` (`account_transaction_id`);

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
  ADD KEY `projects_status_updated_at_index` (`status`,`updated_at`),
  ADD KEY `projects_project_manager_user_id_foreign` (`project_manager_user_id`);

--
-- Indexes for table `project_employee_assignments`
--
ALTER TABLE `project_employee_assignments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `project_employee_assignments_uuid_unique` (`uuid`),
  ADD KEY `project_employee_assignments_assigned_by_user_id_foreign` (`assigned_by_user_id`),
  ADD KEY `project_employee_assignments_project_id_status_index` (`project_id`,`status`),
  ADD KEY `project_employee_assignments_employee_id_status_index` (`employee_id`,`status`);

--
-- Indexes for table `project_material_stocks`
--
ALTER TABLE `project_material_stocks`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `project_material_stocks_project_id_material_id_unique` (`project_id`,`material_id`),
  ADD UNIQUE KEY `project_material_stocks_uuid_unique` (`uuid`),
  ADD KEY `project_material_stocks_material_id_foreign` (`material_id`);

--
-- Indexes for table `purchase_requests`
--
ALTER TABLE `purchase_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `purchase_requests_uuid_unique` (`uuid`),
  ADD UNIQUE KEY `purchase_requests_request_no_unique` (`request_no`),
  ADD KEY `purchase_requests_source_material_request_id_foreign` (`source_material_request_id`),
  ADD KEY `purchase_requests_warehouse_id_foreign` (`warehouse_id`),
  ADD KEY `purchase_requests_vendor_id_foreign` (`vendor_id`),
  ADD KEY `purchase_requests_requested_by_employee_id_foreign` (`requested_by_employee_id`),
  ADD KEY `purchase_requests_approved_by_user_id_foreign` (`approved_by_user_id`),
  ADD KEY `purchase_requests_received_by_user_id_foreign` (`received_by_user_id`),
  ADD KEY `purchase_requests_status_updated_at_index` (`status`,`updated_at`),
  ADD KEY `purchase_requests_requested_by_user_id_foreign` (`requested_by_user_id`),
  ADD KEY `purchase_requests_rejected_by_user_id_foreign` (`rejected_by_user_id`),
  ADD KEY `purchase_requests_payment_processed_by_user_id_foreign` (`payment_processed_by_user_id`),
  ADD KEY `purchase_requests_payment_account_id_foreign` (`payment_account_id`),
  ADD KEY `purchase_requests_payment_account_transaction_id_foreign` (`payment_account_transaction_id`);

--
-- Indexes for table `purchase_request_items`
--
ALTER TABLE `purchase_request_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `purchase_request_items_uuid_unique` (`uuid`),
  ADD KEY `purchase_request_items_purchase_request_id_foreign` (`purchase_request_id`),
  ADD KEY `purchase_request_items_material_id_foreign` (`material_id`),
  ADD KEY `purchase_request_items_company_asset_id_foreign` (`company_asset_id`);

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
  ADD KEY `rental_payment_receipts_rental_payment_id_index` (`rental_payment_id`),
  ADD KEY `rental_payment_receipts_account_id_foreign` (`account_id`),
  ADD KEY `rental_payment_receipts_account_transaction_id_foreign` (`account_transaction_id`);

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
-- Indexes for table `salary_advance_deductions`
--
ALTER TABLE `salary_advance_deductions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `salary_advance_deductions_uuid_unique` (`uuid`),
  ADD KEY `salary_advance_deductions_salary_payment_id_deleted_at_index` (`salary_payment_id`,`deleted_at`),
  ADD KEY `salary_advance_deductions_salary_advance_id_deleted_at_index` (`salary_advance_id`,`deleted_at`);

--
-- Indexes for table `salary_payments`
--
ALTER TABLE `salary_payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `salary_payments_uuid_unique` (`uuid`),
  ADD KEY `salary_payments_user_id_foreign` (`user_id`),
  ADD KEY `salary_payments_employee_id_status_index` (`employee_id`,`status`),
  ADD KEY `salary_payments_period_index` (`period`),
  ADD KEY `salary_payments_updated_at_index` (`updated_at`),
  ADD KEY `salary_payments_account_id_foreign` (`account_id`),
  ADD KEY `salary_payments_account_transaction_id_foreign` (`account_transaction_id`);

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
  ADD UNIQUE KEY `users_customer_id_unique` (`customer_id`),
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
-- Indexes for table `warehouse_material_stocks`
--
ALTER TABLE `warehouse_material_stocks`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `warehouse_material_stocks_warehouse_id_material_id_unique` (`warehouse_id`,`material_id`),
  ADD UNIQUE KEY `warehouse_material_stocks_uuid_unique` (`uuid`),
  ADD KEY `warehouse_material_stocks_material_id_foreign` (`material_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `accounts`
--
ALTER TABLE `accounts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `account_transactions`
--
ALTER TABLE `account_transactions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `apartments`
--
ALTER TABLE `apartments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `apartment_qr_access_tokens`
--
ALTER TABLE `apartment_qr_access_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `apartment_qr_scan_logs`
--
ALTER TABLE `apartment_qr_scan_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `apartment_rentals`
--
ALTER TABLE `apartment_rentals`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `apartment_sales`
--
ALTER TABLE `apartment_sales`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `apartment_sale_financials`
--
ALTER TABLE `apartment_sale_financials`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `apartment_sale_possession_logs`
--
ALTER TABLE `apartment_sale_possession_logs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `apartment_sale_terminations`
--
ALTER TABLE `apartment_sale_terminations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

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
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `crm_messages`
--
ALTER TABLE `crm_messages`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `documents`
--
ALTER TABLE `documents`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `document_types`
--
ALTER TABLE `document_types`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `employees`
--
ALTER TABLE `employees`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `employee_salary_histories`
--
ALTER TABLE `employee_salary_histories`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `exchange_rates`
--
ALTER TABLE `exchange_rates`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `installments`
--
ALTER TABLE `installments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `installment_payments`
--
ALTER TABLE `installment_payments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `materials`
--
ALTER TABLE `materials`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `material_requests`
--
ALTER TABLE `material_requests`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `material_request_items`
--
ALTER TABLE `material_request_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `municipality_payment_letters`
--
ALTER TABLE `municipality_payment_letters`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `municipality_receipts`
--
ALTER TABLE `municipality_receipts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `permissions`
--
ALTER TABLE `permissions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=73;

--
-- AUTO_INCREMENT for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=510;

--
-- AUTO_INCREMENT for table `projects`
--
ALTER TABLE `projects`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `project_employee_assignments`
--
ALTER TABLE `project_employee_assignments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `project_material_stocks`
--
ALTER TABLE `project_material_stocks`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `purchase_requests`
--
ALTER TABLE `purchase_requests`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `purchase_request_items`
--
ALTER TABLE `purchase_request_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rental_payments`
--
ALTER TABLE `rental_payments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `rental_payment_receipts`
--
ALTER TABLE `rental_payment_receipts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `salary_advances`
--
ALTER TABLE `salary_advances`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `salary_advance_deductions`
--
ALTER TABLE `salary_advance_deductions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `salary_payments`
--
ALTER TABLE `salary_payments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `stock_movements`
--
ALTER TABLE `stock_movements`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `sync_inbox`
--
ALTER TABLE `sync_inbox`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `system_settings`
--
ALTER TABLE `system_settings`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- AUTO_INCREMENT for table `vendors`
--
ALTER TABLE `vendors`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `warehouses`
--
ALTER TABLE `warehouses`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `warehouse_material_stocks`
--
ALTER TABLE `warehouse_material_stocks`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `account_transactions`
--
ALTER TABLE `account_transactions`
  ADD CONSTRAINT `account_transactions_account_id_foreign` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`),
  ADD CONSTRAINT `account_transactions_created_by_user_id_foreign` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `account_transactions_reversal_of_id_foreign` FOREIGN KEY (`reversal_of_id`) REFERENCES `account_transactions` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `apartment_qr_access_tokens`
--
ALTER TABLE `apartment_qr_access_tokens`
  ADD CONSTRAINT `apartment_qr_access_tokens_apartment_id_foreign` FOREIGN KEY (`apartment_id`) REFERENCES `apartments` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `apartment_qr_access_tokens_created_by_user_id_foreign` FOREIGN KEY (`created_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `apartment_qr_scan_logs`
--
ALTER TABLE `apartment_qr_scan_logs`
  ADD CONSTRAINT `apartment_qr_scan_logs_apartment_id_foreign` FOREIGN KEY (`apartment_id`) REFERENCES `apartments` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `apartment_qr_scan_logs_apartment_qr_access_token_id_foreign` FOREIGN KEY (`apartment_qr_access_token_id`) REFERENCES `apartment_qr_access_tokens` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `apartment_qr_scan_logs_apartment_sale_id_foreign` FOREIGN KEY (`apartment_sale_id`) REFERENCES `apartment_sales` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `apartment_qr_scan_logs_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

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
  ADD CONSTRAINT `asset_requests_rejected_by_user_id_foreign` FOREIGN KEY (`rejected_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `asset_requests_requested_asset_id_foreign` FOREIGN KEY (`requested_asset_id`) REFERENCES `company_assets` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `asset_requests_requested_by_employee_id_foreign` FOREIGN KEY (`requested_by_employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `asset_requests_requested_by_user_id_foreign` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `company_assets`
--
ALTER TABLE `company_assets`
  ADD CONSTRAINT `company_assets_current_employee_id_foreign` FOREIGN KEY (`current_employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `company_assets_current_warehouse_id_foreign` FOREIGN KEY (`current_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `company_assets_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `crm_messages`
--
ALTER TABLE `crm_messages`
  ADD CONSTRAINT `crm_messages_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `employee_salary_histories`
--
ALTER TABLE `employee_salary_histories`
  ADD CONSTRAINT `employee_salary_histories_changed_by_foreign` FOREIGN KEY (`changed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `employee_salary_histories_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`);

--
-- Constraints for table `exchange_rates`
--
ALTER TABLE `exchange_rates`
  ADD CONSTRAINT `exchange_rates_approved_by_user_id_foreign` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `installments`
--
ALTER TABLE `installments`
  ADD CONSTRAINT `installments_apartment_sale_id_foreign` FOREIGN KEY (`apartment_sale_id`) REFERENCES `apartment_sales` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `installment_payments`
--
ALTER TABLE `installment_payments`
  ADD CONSTRAINT `installment_payments_account_id_foreign` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `installment_payments_account_transaction_id_foreign` FOREIGN KEY (`account_transaction_id`) REFERENCES `account_transactions` (`id`) ON DELETE SET NULL,
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
  ADD CONSTRAINT `material_requests_rejected_by_user_id_foreign` FOREIGN KEY (`rejected_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `material_requests_requested_by_employee_id_foreign` FOREIGN KEY (`requested_by_employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `material_requests_requested_by_user_id_foreign` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
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
  ADD CONSTRAINT `municipality_receipts_account_id_foreign` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `municipality_receipts_account_transaction_id_foreign` FOREIGN KEY (`account_transaction_id`) REFERENCES `account_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `municipality_receipts_apartment_sale_id_foreign` FOREIGN KEY (`apartment_sale_id`) REFERENCES `apartment_sales` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `municipality_receipts_received_by_foreign` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `projects`
--
ALTER TABLE `projects`
  ADD CONSTRAINT `projects_project_manager_user_id_foreign` FOREIGN KEY (`project_manager_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `project_employee_assignments`
--
ALTER TABLE `project_employee_assignments`
  ADD CONSTRAINT `project_employee_assignments_assigned_by_user_id_foreign` FOREIGN KEY (`assigned_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `project_employee_assignments_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `project_employee_assignments_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `project_material_stocks`
--
ALTER TABLE `project_material_stocks`
  ADD CONSTRAINT `project_material_stocks_material_id_foreign` FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `project_material_stocks_project_id_foreign` FOREIGN KEY (`project_id`) REFERENCES `projects` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `purchase_requests`
--
ALTER TABLE `purchase_requests`
  ADD CONSTRAINT `purchase_requests_approved_by_user_id_foreign` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `purchase_requests_payment_account_id_foreign` FOREIGN KEY (`payment_account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `purchase_requests_payment_account_transaction_id_foreign` FOREIGN KEY (`payment_account_transaction_id`) REFERENCES `account_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `purchase_requests_payment_processed_by_user_id_foreign` FOREIGN KEY (`payment_processed_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `purchase_requests_received_by_user_id_foreign` FOREIGN KEY (`received_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `purchase_requests_rejected_by_user_id_foreign` FOREIGN KEY (`rejected_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `purchase_requests_requested_by_employee_id_foreign` FOREIGN KEY (`requested_by_employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `purchase_requests_requested_by_user_id_foreign` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `purchase_requests_source_material_request_id_foreign` FOREIGN KEY (`source_material_request_id`) REFERENCES `material_requests` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `purchase_requests_vendor_id_foreign` FOREIGN KEY (`vendor_id`) REFERENCES `vendors` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `purchase_requests_warehouse_id_foreign` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `purchase_request_items`
--
ALTER TABLE `purchase_request_items`
  ADD CONSTRAINT `purchase_request_items_company_asset_id_foreign` FOREIGN KEY (`company_asset_id`) REFERENCES `company_assets` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `purchase_request_items_material_id_foreign` FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `purchase_request_items_purchase_request_id_foreign` FOREIGN KEY (`purchase_request_id`) REFERENCES `purchase_requests` (`id`) ON DELETE CASCADE;

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
  ADD CONSTRAINT `rental_payment_receipts_account_id_foreign` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `rental_payment_receipts_account_transaction_id_foreign` FOREIGN KEY (`account_transaction_id`) REFERENCES `account_transactions` (`id`) ON DELETE SET NULL,
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
-- Constraints for table `salary_advance_deductions`
--
ALTER TABLE `salary_advance_deductions`
  ADD CONSTRAINT `salary_advance_deductions_salary_advance_id_foreign` FOREIGN KEY (`salary_advance_id`) REFERENCES `salary_advances` (`id`),
  ADD CONSTRAINT `salary_advance_deductions_salary_payment_id_foreign` FOREIGN KEY (`salary_payment_id`) REFERENCES `salary_payments` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `salary_payments`
--
ALTER TABLE `salary_payments`
  ADD CONSTRAINT `salary_payments_account_id_foreign` FOREIGN KEY (`account_id`) REFERENCES `accounts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `salary_payments_account_transaction_id_foreign` FOREIGN KEY (`account_transaction_id`) REFERENCES `account_transactions` (`id`) ON DELETE SET NULL,
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

--
-- Constraints for table `users`
--
ALTER TABLE `users`
  ADD CONSTRAINT `users_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `warehouse_material_stocks`
--
ALTER TABLE `warehouse_material_stocks`
  ADD CONSTRAINT `warehouse_material_stocks_material_id_foreign` FOREIGN KEY (`material_id`) REFERENCES `materials` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `warehouse_material_stocks_warehouse_id_foreign` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
