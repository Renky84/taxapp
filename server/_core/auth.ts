import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { Request, Response } from "express";
import * as db from "../db";
import { ENV } from "./env";

const JWT_SECRET = ENV.cookieSecret;
const COOKIE_NAME = "session";
const SALT_ROUNDS = 10;
const APP_NAME = ENV.appName;

const SMTP_HOST = ENV.smtp.host;
const SMTP_PORT = ENV.smtp.port;
const SMTP_USER = ENV.smtp.user;
const SMTP_PASS = ENV.smtp.pass;
const FROM_EMAIL = ENV.smtp.fromEmail;
const APP_URL = ENV.appUrl || "http://localhost:3000";
const TWO_FACTOR_PENDING_SECRET = ENV.twoFactorPendingSecret;
const TOTP_SETUP_SECRET = ENV.totpSetupSecret;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(userId: number, email: string): string {
  return jwt.sign({ userId, email }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { userId: number; email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
  } catch {
    return null;
  }
}

export function generateRandomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateOtpCode(length = 6): string {
  return Array.from({ length }, () => crypto.randomInt(0, 10)).join("");
}

function base32Encode(buffer: Buffer): string {
  let bits = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  let output = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const normalized = input.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = "";
  for (const char of normalized) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

function buildOtpAuthUrl(email: string, secret: string) {
  const label = encodeURIComponent(`${APP_NAME}:${email}`);
  const issuer = encodeURIComponent(APP_NAME);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

function generateHotp(secret: string, counter: number): string {
  const key = base32Decode(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buffer.writeUInt32BE(counter % 0x100000000, 4);
  const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return (code % 1000000).toString().padStart(6, "0");
}

function verifyTotpCode(secret: string, code: string, window = 1): boolean {
  const normalizedCode = code.replace(/\D/g, "");
  const currentCounter = Math.floor(Date.now() / 1000 / 30);
  for (let offset = -window; offset <= window; offset++) {
    if (generateHotp(secret, currentCounter + offset) === normalizedCode) return true;
  }
  return false;
}

type PendingTokenPayload = {
  userId: number;
  email: string;
  purpose: "two_factor_pending";
  method: "email" | "totp";
  code?: string;
};

function generateTwoFactorPendingToken(payload: Omit<PendingTokenPayload, "purpose">): string {
  return jwt.sign({ ...payload, purpose: "two_factor_pending" }, TWO_FACTOR_PENDING_SECRET, { expiresIn: "10m" });
}

function verifyTwoFactorPendingToken(token: string): PendingTokenPayload | null {
  try {
    return jwt.verify(token, TWO_FACTOR_PENDING_SECRET) as PendingTokenPayload;
  } catch {
    return null;
  }
}

function generateTotpSetupToken(payload: { userId: number; email: string; secret: string }): string {
  return jwt.sign({ ...payload, purpose: "totp_setup" }, TOTP_SETUP_SECRET, { expiresIn: "15m" });
}

function verifyTotpSetupToken(token: string): { userId: number; email: string; secret: string; purpose: string } | null {
  try {
    return jwt.verify(token, TOTP_SETUP_SECRET) as { userId: number; email: string; secret: string; purpose: string };
  } catch {
    return null;
  }
}

async function sendTwoFactorCodeEmail(email: string, code: string): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    console.warn("[Auth] Email not configured, skipping two-factor email");
    return false;
  }
  try {
    await transport.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: "ログイン確認コード - 確定申告アプリ",
      html: `
        <h1>ログイン確認コード</h1>
        <p>ログイン確認のため、以下の6桁コードを入力してください。</p>
        <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${code}</p>
        <p>有効期限は10分です。</p>
        <p>心当たりがない場合は、このメールを破棄してください。</p>
      `,
    });
    return true;
  } catch (error) {
    console.error("[Auth] Failed to send two-factor email:", error);
    return false;
  }
}

export function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: ENV.isProduction,
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: ENV.isProduction,
    sameSite: "lax",
    path: "/",
  });
}

export async function getUserFromRequest(req: Request) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return (await db.getUserById(payload.userId)) || null;
}

export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) return false;
  const verificationUrl = `${APP_URL}/verify-email?token=${token}`;
  try {
    await transport.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: "メールアドレスの確認 - 確定申告アプリ",
      html: `
        <h1>メールアドレスの確認</h1>
        <p>確定申告アプリへのご登録ありがとうございます。</p>
        <p>以下のリンクをクリックして、メールアドレスを確認してください：</p>
        <p><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p>このリンクは24時間有効です。</p>
      `,
    });
    return true;
  } catch (error) {
    console.error("[Auth] Failed to send verification email:", error);
    return false;
  }
}

export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) return false;
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  try {
    await transport.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: "パスワードリセット - 確定申告アプリ",
      html: `
        <h1>パスワードリセット</h1>
        <p>以下のリンクをクリックして、新しいパスワードを設定してください：</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>このリンクは1時間有効です。</p>
      `,
    });
    return true;
  } catch (error) {
    console.error("[Auth] Failed to send password reset email:", error);
    return false;
  }
}

export async function registerUser(email: string, password: string, name?: string, businessName?: string, businessType?: string): Promise<{ success: boolean; userId?: number; error?: string }> {
  const existingUser = await db.getUserByEmail(email);
  if (existingUser) return { success: false, error: "このメールアドレスは既に登録されています" };

  const passwordHash = await hashPassword(password);
  const verificationToken = generateRandomToken();
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const userId = await db.createUser({
    email,
    passwordHash,
    name: name || null,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: verificationExpires,
  } as any);

  if (!userId) return { success: false, error: "ユーザーの作成に失敗しました" };

  if (businessName || businessType) {
    await db.createUserProfile({ userId, businessName: businessName || null, businessType: businessType || null });
  }
  await sendVerificationEmail(email, verificationToken);
  return { success: true, userId };
}

export async function loginUser(email: string, password: string): Promise<{ success: boolean; token?: string; user?: any; error?: string; requiresTwoFactor?: boolean; pendingToken?: string }> {
  const user = await db.getUserByEmail(email);
  if (!user) return { success: false, error: "メールアドレスまたはパスワードが正しくありません" };

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) return { success: false, error: "メールアドレスまたはパスワードが正しくありません" };

  if (user.twoFactorEnabled && user.twoFactorMethod === "email") {
    const code = generateOtpCode();
    const mailSent = await sendTwoFactorCodeEmail(user.email, code);
    if (!mailSent) return { success: false, error: "2段階認証メールの送信に失敗しました。メール設定を確認してください。" };
    return {
      success: true,
      requiresTwoFactor: true,
      pendingToken: generateTwoFactorPendingToken({ userId: user.id, email: user.email, method: "email", code }),
      user,
    };
  }

  if (user.twoFactorEnabled && user.twoFactorMethod === "totp") {
    if (!user.totpSecret) return { success: false, error: "TOTP設定が未完了です。プロフィールで再設定してください。" };
    return {
      success: true,
      requiresTwoFactor: true,
      pendingToken: generateTwoFactorPendingToken({ userId: user.id, email: user.email, method: "totp" }),
      user,
    };
  }

  await db.updateLastSignedIn(user.id);
  return { success: true, token: generateToken(user.id, user.email), user };
}

export async function verifyTwoFactorLogin(pendingToken: string, code: string): Promise<{ success: boolean; token?: string; user?: any; error?: string }> {
  const payload = verifyTwoFactorPendingToken(pendingToken);
  if (!payload || payload.purpose !== "two_factor_pending") return { success: false, error: "確認コードの有効期限が切れたか、不正なリクエストです" };
  const user = await db.getUserById(payload.userId);
  if (!user) return { success: false, error: "ユーザーが見つかりません" };

  const normalizedCode = code.replace(/\D/g, "");
  if (payload.method === "email") {
    if (payload.code !== normalizedCode) return { success: false, error: "確認コードが正しくありません" };
  } else {
    if (!user.totpSecret || !verifyTotpCode(user.totpSecret, normalizedCode)) return { success: false, error: "認証アプリのコードが正しくありません" };
  }

  await db.updateLastSignedIn(user.id);
  return { success: true, token: generateToken(user.id, user.email), user };
}

export async function beginTotpSetup(userId: number, email: string) {
  const secret = generateTotpSecret();
  const setupToken = generateTotpSetupToken({ userId, email, secret });
  return {
    secret,
    otpauthUrl: buildOtpAuthUrl(email, secret),
    setupToken,
    manualEntryKey: secret,
  };
}

export async function confirmTotpSetup(userId: number, setupToken: string, code: string): Promise<{ success: boolean; error?: string }> {
  const payload = verifyTotpSetupToken(setupToken);
  if (!payload || payload.purpose !== "totp_setup" || payload.userId !== userId) return { success: false, error: "TOTP設定トークンの有効期限が切れました。再設定してください。" };
  if (!verifyTotpCode(payload.secret, code)) return { success: false, error: "認証アプリのコードが一致しません" };
  const ok = await db.updateUser(userId, {
    twoFactorEnabled: true,
    twoFactorMethod: "totp",
    totpSecret: payload.secret,
    totpVerifiedAt: new Date(),
  } as any);
  return ok ? { success: true } : { success: false, error: "TOTP設定の保存に失敗しました" };
}

export async function disableTotp(userId: number): Promise<boolean> {
  return db.updateUser(userId, {
    twoFactorEnabled: false,
    twoFactorMethod: "email",
    totpSecret: null,
    totpVerifiedAt: null,
  } as any);
}

export async function updateTwoFactorPreference(userId: number, enabled: boolean, method: "email" | "totp" = "email"): Promise<boolean> {
  const updates: Record<string, any> = { twoFactorEnabled: enabled, twoFactorMethod: method };
  if (!enabled && method === "email") {
    updates.totpSecret = null;
    updates.totpVerifiedAt = null;
  }
  return await db.updateUser(userId, updates as any);
}

export async function verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
  const user = await db.getUserByVerificationToken(token);
  if (!user) return { success: false, error: "無効な認証トークンです" };
  if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) return { success: false, error: "認証トークンの有効期限が切れています" };
  return (await db.verifyUserEmail(user.id)) ? { success: true } : { success: false, error: "メール認証に失敗しました" };
}

export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  const user = await db.getUserByEmail(email);
  if (!user) return { success: true };
  const resetToken = generateRandomToken();
  await db.updateUser(user.id, { passwordResetToken: resetToken, passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000) } as any);
  await sendPasswordResetEmail(email, resetToken);
  return { success: true };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  const user = await db.getUserByResetToken(token);
  if (!user) return { success: false, error: "無効なリセットトークンです" };
  if (user.passwordResetExpires && new Date() > user.passwordResetExpires) return { success: false, error: "リセットトークンの有効期限が切れています" };
  const passwordHash = await hashPassword(newPassword);
  await db.updateUser(user.id, { passwordHash, passwordResetToken: null, passwordResetExpires: null } as any);
  return { success: true };
}
