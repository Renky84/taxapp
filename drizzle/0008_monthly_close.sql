CREATE TABLE IF NOT EXISTS `monthClosings` (
  `id` int AUTO_INCREMENT NOT NULL PRIMARY KEY,
  `userId` int NOT NULL,
  `year` int NOT NULL,
  `month` int NOT NULL,
  `status` enum('open','closed') NOT NULL DEFAULT 'open',
  `closedAt` timestamp NULL,
  `notes` text NULL,
  `summaryJson` text NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
