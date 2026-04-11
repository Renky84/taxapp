CREATE TABLE `receiptDetails` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptId` int NOT NULL,
	`storeName` varchar(255),
	`storeAddress` text,
	`purchaseDate` date,
	`purchaseTime` varchar(10),
	`paymentMethod` varchar(50),
	`totalAmount` int,
	`taxAmount` int,
	`rawData` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `receiptDetails_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `receiptLineItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`receiptDetailId` int NOT NULL,
	`itemName` varchar(255) NOT NULL,
	`quantity` int NOT NULL DEFAULT 1,
	`unitPrice` int NOT NULL,
	`totalPrice` int NOT NULL,
	`category` varchar(100),
	`isDeleted` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `receiptLineItems_id` PRIMARY KEY(`id`)
);
