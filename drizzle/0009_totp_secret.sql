ALTER TABLE users
  ADD COLUMN totpSecret varchar(64) NULL,
  ADD COLUMN totpVerifiedAt timestamp NULL;
