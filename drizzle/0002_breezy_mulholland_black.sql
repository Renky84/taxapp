CREATE TABLE `extractedExpenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`receiptId` int NOT NULL,
	`jobId` int NOT NULL,
	`amount` int NOT NULL,
	`categoryId` int,
	`categoryName` varchar(100),
	`description` text,
	`date` date,
	`confidence` int NOT NULL DEFAULT 100,
	`status` enum('pending','approved','rejected','manual_edit') NOT NULL DEFAULT 'pending',
	`approvedAmount` int,
	`approvedCategoryId` int,
	`approvedDescription` text,
	`approvedDate` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `extractedExpenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `processingJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobType` varchar(50) NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`totalCount` int NOT NULL,
	`processedCount` int NOT NULL DEFAULT 0,
	`receiptIds` text NOT NULL,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `processingJobs_id` PRIMARY KEY(`id`)
);
