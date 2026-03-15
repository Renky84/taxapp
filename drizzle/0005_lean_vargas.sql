CREATE TABLE `journalEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`entryDate` date NOT NULL,
	`description` text,
	`sourceType` enum('manual','sale','expense','receipt_scan') NOT NULL DEFAULT 'manual',
	`sourceId` int,
	`status` enum('draft','confirmed','needs_review') NOT NULL DEFAULT 'confirmed',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `journalEntries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `journalLines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`journalEntryId` int NOT NULL,
	`side` enum('debit','credit') NOT NULL,
	`accountCode` varchar(20) NOT NULL,
	`accountName` varchar(100) NOT NULL,
	`amount` int NOT NULL,
	`memo` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `journalLines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monthClosings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`year` int NOT NULL,
	`month` int NOT NULL,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`closedAt` timestamp,
	`notes` text,
	`summaryJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `monthClosings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` DROP INDEX `users_openId_unique`;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `receipts` ADD `mimeType` varchar(120) DEFAULT 'image/jpeg' NOT NULL;--> statement-breakpoint
ALTER TABLE `receipts` ADD `documentType` enum('receipt','invoice','document') DEFAULT 'receipt' NOT NULL;--> statement-breakpoint
ALTER TABLE `userProfiles` ADD `representativeName` varchar(255);--> statement-breakpoint
ALTER TABLE `userProfiles` ADD `postalCode` varchar(10);--> statement-breakpoint
ALTER TABLE `userProfiles` ADD `address` text;--> statement-breakpoint
ALTER TABLE `userProfiles` ADD `phoneNumber` varchar(20);--> statement-breakpoint
ALTER TABLE `userProfiles` ADD `fiscalYearStart` int DEFAULT 1;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerified` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerificationToken` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `emailVerificationExpires` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `passwordResetToken` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordResetExpires` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `twoFactorMethod` enum('email','totp') DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `totpSecret` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `totpVerifiedAt` timestamp;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_email_unique` UNIQUE(`email`);--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `openId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `loginMethod`;