CREATE TABLE IF NOT EXISTS `journalEntries` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `entryDate` date NOT NULL,
  `description` text,
  `sourceType` enum('manual','sale','expense','receipt_scan') NOT NULL DEFAULT 'manual',
  `sourceId` int,
  `status` enum('draft','confirmed','needs_review') NOT NULL DEFAULT 'confirmed',
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `journalEntries_id` PRIMARY KEY(`id`)
);

CREATE TABLE IF NOT EXISTS `journalLines` (
  `id` int AUTO_INCREMENT NOT NULL,
  `journalEntryId` int NOT NULL,
  `side` enum('debit','credit') NOT NULL,
  `accountCode` varchar(20) NOT NULL,
  `accountName` varchar(100) NOT NULL,
  `amount` int NOT NULL,
  `memo` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `journalLines_id` PRIMARY KEY(`id`)
);
