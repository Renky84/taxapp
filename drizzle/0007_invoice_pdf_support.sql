ALTER TABLE `receipts`
  ADD COLUMN `mimeType` varchar(120) NOT NULL DEFAULT "image/jpeg",
  ADD COLUMN `documentType` enum('receipt','invoice','document') NOT NULL DEFAULT 'receipt';
