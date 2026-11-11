-- MySQL dump 10.13  Distrib 8.0.23, for Win64 (x86_64)
--
-- Host: localhost    Database: ai_customer_support
-- ------------------------------------------------------
-- Server version	8.0.23

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `ai_usage_logs`
--

DROP TABLE IF EXISTS `ai_usage_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `ai_usage_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `business_id` bigint unsigned NOT NULL,
  `conversation_id` bigint unsigned DEFAULT NULL,
  `provider` varchar(40) COLLATE utf8mb4_unicode_ci NOT NULL,
  `model` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `input_tokens` int unsigned DEFAULT NULL,
  `output_tokens` int unsigned DEFAULT NULL,
  `latency_ms` int unsigned DEFAULT NULL,
  `status` enum('success','error') COLLATE utf8mb4_unicode_ci NOT NULL,
  `error_code` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ai_usage_business` (`business_id`,`created_at`),
  KEY `fk_ai_usage_conversation` (`conversation_id`,`business_id`),
  CONSTRAINT `fk_ai_usage_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
  CONSTRAINT `fk_ai_usage_conversation` FOREIGN KEY (`conversation_id`, `business_id`) REFERENCES `conversations` (`id`, `business_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ai_usage_logs`
--

LOCK TABLES `ai_usage_logs` WRITE;
/*!40000 ALTER TABLE `ai_usage_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `ai_usage_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `business_admins`
--

DROP TABLE IF EXISTS `business_admins`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `business_admins` (
  `business_id` bigint unsigned NOT NULL,
  `user_id` bigint unsigned NOT NULL,
  `role` enum('owner','admin','staff') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'staff',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`business_id`,`user_id`),
  KEY `fk_ba_user` (`user_id`),
  CONSTRAINT `fk_ba_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
  CONSTRAINT `fk_ba_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `business_admins`
--

LOCK TABLES `business_admins` WRITE;
/*!40000 ALTER TABLE `business_admins` DISABLE KEYS */;
/*!40000 ALTER TABLE `business_admins` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `business_ai_schedules`
--

DROP TABLE IF EXISTS `business_ai_schedules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `business_ai_schedules` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `business_id` bigint unsigned NOT NULL,
  `weekday` tinyint unsigned NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `idx_schedule_business_day` (`business_id`,`weekday`),
  CONSTRAINT `fk_schedule_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
  CONSTRAINT `chk_schedule_time` CHECK ((`start_time` <> `end_time`)),
  CONSTRAINT `chk_schedule_weekday` CHECK ((`weekday` between 0 and 6))
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `business_ai_schedules`
--

LOCK TABLES `business_ai_schedules` WRITE;
/*!40000 ALTER TABLE `business_ai_schedules` DISABLE KEYS */;
INSERT INTO `business_ai_schedules` VALUES (1,1,0,'20:00:00','09:00:00',1),(2,1,1,'17:00:00','09:00:00',1),(3,1,2,'17:00:00','09:00:00',1),(4,1,3,'20:00:00','09:00:00',1),(5,1,4,'20:00:00','09:00:00',1),(6,1,5,'20:00:00','09:00:00',1),(7,1,6,'20:00:00','09:00:00',1);
/*!40000 ALTER TABLE `business_ai_schedules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `business_facebook_pages`
--

DROP TABLE IF EXISTS `business_facebook_pages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `business_facebook_pages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `business_id` bigint unsigned NOT NULL,
  `page_id` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `page_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `page_access_token_encrypted` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `connected_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `page_id` (`page_id`),
  UNIQUE KEY `uq_page_business` (`id`,`business_id`),
  KEY `idx_page_business` (`business_id`),
  CONSTRAINT `fk_page_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `business_facebook_pages`
--

LOCK TABLES `business_facebook_pages` WRITE;
/*!40000 ALTER TABLE `business_facebook_pages` DISABLE KEYS */;
INSERT INTO `business_facebook_pages` VALUES (1,1,'304687256333075','Codxplore','v1:973e4dc7a53707432a7acf88:3dceaa65184548308020333b55c97e60:cb43ceb2e49b434b036636888b7be1b55ac8cd5a4a9f9f9efebb1283d4a2e13075f4e31621818794a1ac0bc77f0268ff8611986b13b87b4629add97e808b121dfd2c569c0d718df1a156ec184e07b8cb5c9f406c889ba976f5e8c3e1ad057a7bdd1f93f2d3b635361c82da964333004fd59b6bace3697afbf945ed82ab573b5b49e94391874d7b4b1ea4b2e0e923997167ddc22e61105c469ac36f45564578e1b231bfeaf8599784696e7208e1554c4c1e864d77bb5ff9db465903314802ea0915ee29996b794fddb4035e3569afccd8a0a5f734ab2df342341d333ec9b6e97c',1,'2026-11-10 10:49:47'),(2,2,'233757060846568','Offersndeal','v1:88d8d81c51fe8d5c56bf986e:ba104965c2ff83f12a1f015a2e843b3a:58603d00676b8041c57908caf264918615ece638407ea0c4dc0e8ebed2611a42ef65d37032a7b4ee2953d9c8cbc147d5f50061740959ffe4056210d6a731dcca8fc16e125c6fe4fc551e910e01c042197124e41584cbc50042211efa04cd64d40272b7d9f94564c5cb40d716cb1888708b8ece863edf8adcfeb1c79edc1e8b7cba3970bef06711f062c8c323ef062ab179ff55a186ee7f81567daa86dad3a0927400a8e8d6b593e7e8d46188ad4f36cdc2b74ad09234f8a35acddf429936568faedd38269381b8daeaca56ce24307121ca8d04fe356b1e22c04b2be4dc5138bac5',1,'2026-11-10 10:51:38');
/*!40000 ALTER TABLE `business_facebook_pages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `business_settings`
--

DROP TABLE IF EXISTS `business_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `business_settings` (
  `business_id` bigint unsigned NOT NULL,
  `ai_mode` enum('off','always','scheduled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'off',
  `timezone` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Asia/Dhaka',
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BDT',
  `inside_dhaka_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `outside_dhaka_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `inside_dhaka_delivery_days` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `outside_dhaka_delivery_days` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`business_id`),
  CONSTRAINT `fk_settings_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
  CONSTRAINT `chk_inside_fee` CHECK ((`inside_dhaka_fee` >= 0)),
  CONSTRAINT `chk_outside_fee` CHECK ((`outside_dhaka_fee` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `business_settings`
--

LOCK TABLES `business_settings` WRITE;
/*!40000 ALTER TABLE `business_settings` DISABLE KEYS */;
INSERT INTO `business_settings` VALUES (1,'scheduled','Asia/Dhaka','BDT',0.00,0.00,NULL,NULL,'2026-11-10 11:48:01');
/*!40000 ALTER TABLE `business_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `businesses`
--

DROP TABLE IF EXISTS `businesses`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `businesses` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(200) COLLATE utf8mb4_unicode_ci NOT NULL,
  `slug` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `businesses`
--

LOCK TABLES `businesses` WRITE;
/*!40000 ALTER TABLE `businesses` DISABLE KEYS */;
INSERT INTO `businesses` VALUES (1,'Codxplore','codxplore',1,'2026-11-10 10:45:00','2026-11-10 10:45:00'),(2,'Offersndeal','offersndeal',1,'2026-11-10 10:45:03','2026-11-10 10:45:03');
/*!40000 ALTER TABLE `businesses` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `conversation_messages`
--

DROP TABLE IF EXISTS `conversation_messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `conversation_messages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `business_id` bigint unsigned NOT NULL,
  `conversation_id` bigint unsigned NOT NULL,
  `meta_message_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `direction` enum('incoming','outgoing') COLLATE utf8mb4_unicode_ci NOT NULL,
  `sender_type` enum('customer','ai','admin') COLLATE utf8mb4_unicode_ci NOT NULL,
  `body` text COLLATE utf8mb4_unicode_ci,
  `delivery_status` enum('received','pending','sent','failed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'received',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_message_meta` (`meta_message_id`),
  KEY `idx_message_conversation` (`conversation_id`,`business_id`,`id`),
  CONSTRAINT `fk_message_conversation` FOREIGN KEY (`conversation_id`, `business_id`) REFERENCES `conversations` (`id`, `business_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversation_messages`
--

LOCK TABLES `conversation_messages` WRITE;
/*!40000 ALTER TABLE `conversation_messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `conversation_messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `conversations`
--

DROP TABLE IF EXISTS `conversations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `conversations` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `business_id` bigint unsigned NOT NULL,
  `facebook_page_id` bigint unsigned NOT NULL,
  `customer_psid` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `handling_mode` enum('ai','human') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'ai',
  `status` enum('open','closed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `last_message_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_conversation_business` (`id`,`business_id`),
  UNIQUE KEY `uq_conversation_page_psid` (`facebook_page_id`,`customer_psid`),
  KEY `idx_conversation_business` (`business_id`,`last_message_at`),
  KEY `fk_conversation_page` (`facebook_page_id`,`business_id`),
  CONSTRAINT `fk_conversation_page` FOREIGN KEY (`facebook_page_id`, `business_id`) REFERENCES `business_facebook_pages` (`id`, `business_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `conversations`
--

LOCK TABLES `conversations` WRITE;
/*!40000 ALTER TABLE `conversations` DISABLE KEYS */;
/*!40000 ALTER TABLE `conversations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `inventory_movements`
--

DROP TABLE IF EXISTS `inventory_movements`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `inventory_movements` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `business_id` bigint unsigned NOT NULL,
  `variant_id` bigint unsigned NOT NULL,
  `quantity_change` int NOT NULL,
  `quantity_after` int unsigned NOT NULL,
  `reason` enum('initial','restock','sale','cancel','adjustment','return') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reference_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `reference_id` bigint unsigned DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_movement_variant` (`variant_id`,`business_id`,`created_at`),
  KEY `fk_movement_user` (`created_by`),
  CONSTRAINT `fk_movement_user` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_movement_variant` FOREIGN KEY (`variant_id`, `business_id`) REFERENCES `product_variants` (`id`, `business_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `inventory_movements`
--

LOCK TABLES `inventory_movements` WRITE;
/*!40000 ALTER TABLE `inventory_movements` DISABLE KEYS */;
/*!40000 ALTER TABLE `inventory_movements` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `order_items`
--

DROP TABLE IF EXISTS `order_items`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `order_items` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `business_id` bigint unsigned NOT NULL,
  `order_id` bigint unsigned NOT NULL,
  `variant_id` bigint unsigned DEFAULT NULL,
  `product_name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `sku` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variant_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `quantity` int unsigned NOT NULL,
  `unit_price` decimal(12,2) NOT NULL,
  `line_total` decimal(12,2) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_items` (`order_id`,`business_id`),
  KEY `fk_order_item_variant` (`variant_id`,`business_id`),
  CONSTRAINT `fk_order_item_order` FOREIGN KEY (`order_id`, `business_id`) REFERENCES `orders` (`id`, `business_id`),
  CONSTRAINT `fk_order_item_variant` FOREIGN KEY (`variant_id`, `business_id`) REFERENCES `product_variants` (`id`, `business_id`),
  CONSTRAINT `chk_order_item` CHECK (((`quantity` > 0) and (`unit_price` >= 0) and (`line_total` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `order_items`
--

LOCK TABLES `order_items` WRITE;
/*!40000 ALTER TABLE `order_items` DISABLE KEYS */;
/*!40000 ALTER TABLE `order_items` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orders`
--

DROP TABLE IF EXISTS `orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orders` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `business_id` bigint unsigned NOT NULL,
  `conversation_id` bigint unsigned DEFAULT NULL,
  `order_number` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `customer_name` varchar(200) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `customer_phone` varchar(40) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `delivery_address` text COLLATE utf8mb4_unicode_ci,
  `delivery_region` enum('inside_dhaka','outside_dhaka') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` enum('draft','pending_confirmation','confirmed','processing','shipped','delivered','cancelled') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'draft',
  `subtotal` decimal(12,2) NOT NULL DEFAULT '0.00',
  `delivery_fee` decimal(10,2) NOT NULL DEFAULT '0.00',
  `total` decimal(12,2) NOT NULL DEFAULT '0.00',
  `currency` char(3) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'BDT',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_order_business` (`id`,`business_id`),
  UNIQUE KEY `uq_order_number` (`business_id`,`order_number`),
  KEY `idx_order_business_status` (`business_id`,`status`,`created_at`),
  KEY `fk_order_conversation` (`conversation_id`,`business_id`),
  CONSTRAINT `fk_order_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`),
  CONSTRAINT `fk_order_conversation` FOREIGN KEY (`conversation_id`, `business_id`) REFERENCES `conversations` (`id`, `business_id`),
  CONSTRAINT `chk_order_totals` CHECK (((`subtotal` >= 0) and (`delivery_fee` >= 0) and (`total` >= 0)))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orders`
--

LOCK TABLES `orders` WRITE;
/*!40000 ALTER TABLE `orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_images`
--

DROP TABLE IF EXISTS `product_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_images` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `business_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `image_url` varchar(2048) COLLATE utf8mb4_unicode_ci NOT NULL,
  `alt_text` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `sort_order` int NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_image_product` (`product_id`,`business_id`,`sort_order`),
  CONSTRAINT `fk_image_product` FOREIGN KEY (`product_id`, `business_id`) REFERENCES `products` (`id`, `business_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_images`
--

LOCK TABLES `product_images` WRITE;
/*!40000 ALTER TABLE `product_images` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `product_variants`
--

DROP TABLE IF EXISTS `product_variants`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `product_variants` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `business_id` bigint unsigned NOT NULL,
  `product_id` bigint unsigned NOT NULL,
  `sku` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `variant_name` varchar(150) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `price` decimal(12,2) NOT NULL,
  `stock_qty` int unsigned NOT NULL DEFAULT '0',
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_variant_business` (`id`,`business_id`),
  UNIQUE KEY `uq_variant_sku` (`business_id`,`sku`),
  KEY `idx_variant_product` (`product_id`,`business_id`),
  CONSTRAINT `fk_variant_product` FOREIGN KEY (`product_id`, `business_id`) REFERENCES `products` (`id`, `business_id`),
  CONSTRAINT `chk_variant_price` CHECK ((`price` >= 0))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `product_variants`
--

LOCK TABLES `product_variants` WRITE;
/*!40000 ALTER TABLE `product_variants` DISABLE KEYS */;
/*!40000 ALTER TABLE `product_variants` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `products`
--

DROP TABLE IF EXISTS `products`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `products` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `business_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` text COLLATE utf8mb4_unicode_ci,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_product_business` (`id`,`business_id`),
  KEY `idx_product_business_name` (`business_id`,`name`),
  CONSTRAINT `fk_product_business` FOREIGN KEY (`business_id`) REFERENCES `businesses` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `products`
--

LOCK TABLES `products` WRITE;
/*!40000 ALTER TABLE `products` DISABLE KEYS */;
/*!40000 ALTER TABLE `products` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT '1',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'ai_customer_support'
--

--
-- Dumping routines for database 'ai_customer_support'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-11 10:39:24
