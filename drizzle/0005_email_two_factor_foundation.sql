ALTER TABLE users
  ADD COLUMN twoFactorEnabled boolean NOT NULL DEFAULT false,
  ADD COLUMN twoFactorMethod enum('email','totp') NOT NULL DEFAULT 'email';
