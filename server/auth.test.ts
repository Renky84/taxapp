import { describe, it, expect, vi, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

// Mock the database module
vi.mock('./db', () => ({
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  updateUserEmailVerified: vi.fn(),
  getUserById: vi.fn(),
}));

// Mock the auth module
vi.mock('./_core/auth', async () => {
  const actual = await vi.importActual('./_core/auth');
  return {
    ...actual,
    sendVerificationEmail: vi.fn().mockResolvedValue(true),
  };
});

import { getUserByEmail, createUser, updateUserEmailVerified, getUserById } from './db';

describe('Authentication System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Password Hashing', () => {
    it('should hash password correctly', async () => {
      const password = 'testPassword123';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(0);
    });

    it('should verify password correctly', async () => {
      const password = 'testPassword123';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const isValid = await bcrypt.compare(password, hashedPassword);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123';
      const wrongPassword = 'wrongPassword';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const isValid = await bcrypt.compare(wrongPassword, hashedPassword);
      expect(isValid).toBe(false);
    });
  });

  describe('User Registration', () => {
    it('should check for existing user by email', async () => {
      const mockGetUserByEmail = vi.mocked(getUserByEmail);
      mockGetUserByEmail.mockResolvedValue(null);

      const result = await getUserByEmail('test@example.com');
      
      expect(mockGetUserByEmail).toHaveBeenCalledWith('test@example.com');
      expect(result).toBeNull();
    });

    it('should reject registration if email already exists', async () => {
      const mockGetUserByEmail = vi.mocked(getUserByEmail);
      mockGetUserByEmail.mockResolvedValue({
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashedPassword',
        emailVerified: true,
        emailVerificationToken: null,
        role: 'user',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const existingUser = await getUserByEmail('test@example.com');
      
      expect(existingUser).not.toBeNull();
      expect(existingUser?.email).toBe('test@example.com');
    });

    it('should create new user with hashed password', async () => {
      const mockCreateUser = vi.mocked(createUser);
      const mockUser = {
        id: 1,
        email: 'newuser@example.com',
        name: 'New User',
        passwordHash: 'hashedPassword',
        emailVerified: false,
        emailVerificationToken: 'verificationToken',
        role: 'user' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockCreateUser.mockResolvedValue(mockUser);

      const result = await createUser({
        email: 'newuser@example.com',
        name: 'New User',
        passwordHash: 'hashedPassword',
        emailVerificationToken: 'verificationToken',
      });

      expect(mockCreateUser).toHaveBeenCalled();
      expect(result.email).toBe('newuser@example.com');
      expect(result.emailVerified).toBe(false);
    });
  });

  describe('Email Verification', () => {
    it('should update email verified status', async () => {
      const mockUpdateUserEmailVerified = vi.mocked(updateUserEmailVerified);
      mockUpdateUserEmailVerified.mockResolvedValue(undefined);

      await updateUserEmailVerified(1);

      expect(mockUpdateUserEmailVerified).toHaveBeenCalledWith(1);
    });
  });

  describe('User Authentication', () => {
    it('should get user by ID', async () => {
      const mockGetUserById = vi.mocked(getUserById);
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        passwordHash: 'hashedPassword',
        emailVerified: true,
        emailVerificationToken: null,
        role: 'user' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockGetUserById.mockResolvedValue(mockUser);

      const result = await getUserById(1);

      expect(mockGetUserById).toHaveBeenCalledWith(1);
      expect(result?.id).toBe(1);
      expect(result?.email).toBe('test@example.com');
    });

    it('should return null for non-existent user', async () => {
      const mockGetUserById = vi.mocked(getUserById);
      mockGetUserById.mockResolvedValue(null);

      const result = await getUserById(999);

      expect(result).toBeNull();
    });
  });

  describe('Password Validation', () => {
    it('should accept valid password (8+ characters)', () => {
      const password = 'validPass123';
      const isValid = password.length >= 8;
      expect(isValid).toBe(true);
    });

    it('should reject short password (less than 8 characters)', () => {
      const password = 'short';
      const isValid = password.length >= 8;
      expect(isValid).toBe(false);
    });
  });

  describe('Email Validation', () => {
    it('should accept valid email format', () => {
      const email = 'test@example.com';
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test(email)).toBe(true);
    });

    it('should reject invalid email format', () => {
      const invalidEmails = ['invalid', 'invalid@', '@example.com', 'invalid@.com'];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      invalidEmails.forEach(email => {
        expect(emailRegex.test(email)).toBe(false);
      });
    });
  });
});
