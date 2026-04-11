CREATE TABLE `expenseCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`code` varchar(20) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenseCategories_id` PRIMARY KEY(`id`),
	CONSTRAINT `expenseCategories_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`receiptId` int,
	`categoryId` int NOT NULL,
	`amount` int NOT NULL,
	`description` text,
	`date` date NOT NULL,
	`isAutoClassified` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`fileKey` varchar(255) NOT NULL,
	`fileUrl` varchar(255) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`uploadedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `receipts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`description` text,
	`date` date NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userProfiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`businessName` varchar(255),
	`businessType` varchar(100),
	`taxFilingDeadline` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userProfiles_id` PRIMARY KEY(`id`),
	CONSTRAINT `userProfiles_userId_unique` UNIQUE(`userId`)
);
