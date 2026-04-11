ALTER TABLE `expenses` ADD `isDeleted` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `expenses` ADD `deletedAt` timestamp;