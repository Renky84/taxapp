import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { Request, Response } from "express";
import * as db from "../db";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";
const COOKIE_NAME = "session";
const SALT_ROUNDS = 10;

// メール設定（環境変数から取得）
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASS || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@example.com";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

// メールトランスポーター
let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!transporter && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return transporter;
}

// パスワードハッシュ化
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// パスワード検証
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// JWTトークン生成
export function generateToken(userId: number, email: string): string {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// JWTトークン検証
export function verifyToken(token: string): { userId: number; email: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number; email: string };
  } catch {
    return null;
  }
}

// ランダムトークン生成
export function generateRandomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// セッションCookie設定
export function setSessionCookie(res: Response, token: string) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7日
    path: "/",
  });
}

// セッションCookie削除
export function clearSessionCookie(res: Response) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

// リクエストからユーザーを取得
export async function getUserFromRequest(req: Request) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    console.log("[Auth] Missing session cookie");
    return null;
  }

  const payload = verifyToken(token);
  if (!payload) {
    console.log("[Auth] Invalid token");
    return null;
  }

  const user = await db.getUserById(payload.userId);
  if (!user) {
    console.log("[Auth] User not found");
    return null;
  }

  return user;
}

// 認証メール送信
export async function sendVerificationEmail(email: string, token: string): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    console.warn("[Auth] Email not configured, skipping verification email");
    return false;
  }

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
        <p>このメールに心当たりがない場合は、無視してください。</p>
      `,
    });
    return true;
  } catch (error) {
    console.error("[Auth] Failed to send verification email:", error);
    return false;
  }
}

// パスワードリセットメール送信
export async function sendPasswordResetEmail(email: string, token: string): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    console.warn("[Auth] Email not configured, skipping password reset email");
    return false;
  }

  const resetUrl = `${APP_URL}/reset-password?token=${token}`;

  try {
    await transport.sendMail({
      from: FROM_EMAIL,
      to: email,
      subject: "パスワードリセット - 確定申告アプリ",
      html: `
        <h1>パスワードリセット</h1>
        <p>パスワードリセットのリクエストを受け付けました。</p>
        <p>以下のリンクをクリックして、新しいパスワードを設定してください：</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>このリンクは1時間有効です。</p>
        <p>このメールに心当たりがない場合は、無視してください。</p>
      `,
    });
    return true;
  } catch (error) {
    console.error("[Auth] Failed to send password reset email:", error);
    return false;
  }
}

// ユーザー登録
export async function registerUser(
  email: string,
  password: string,
  name?: string,
  businessName?: string,
  businessType?: string
): Promise<{ success: boolean; userId?: number; error?: string }> {
  // メールアドレスの重複チェック
  const existingUser = await db.getUserByEmail(email);
  if (existingUser) {
    return { success: false, error: "このメールアドレスは既に登録されています" };
  }

  // パスワードハッシュ化
  const passwordHash = await hashPassword(password);

  // 認証トークン生成
  const verificationToken = generateRandomToken();
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24時間

  // ユーザー作成
  const userId = await db.createUser({
    email,
    passwordHash,
    name: name || null,
    emailVerificationToken: verificationToken,
    emailVerificationExpires: verificationExpires,
  });

  if (!userId) {
    return { success: false, error: "ユーザーの作成に失敗しました" };
  }

  // 事業情報をプロフィールに保存
  if (businessName || businessType) {
    await db.createUserProfile({
      userId,
      businessName: businessName || null,
      businessType: businessType || null,
    });
  }

  // 認証メール送信
  await sendVerificationEmail(email, verificationToken);

  return { success: true, userId };
}

// ログイン
export async function loginUser(
  email: string,
  password: string
): Promise<{ success: boolean; token?: string; user?: any; error?: string }> {
  const user = await db.getUserByEmail(email);
  if (!user) {
    return { success: false, error: "メールアドレスまたはパスワードが正しくありません" };
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    return { success: false, error: "メールアドレスまたはパスワードが正しくありません" };
  }

  // メール認証チェック（オプション：開発中は無効化可能）
  // if (!user.emailVerified) {
  //   return { success: false, error: "メールアドレスが確認されていません" };
  // }

  // 最終ログイン日時を更新
  await db.updateLastSignedIn(user.id);

  // JWTトークン生成
  const token = generateToken(user.id, user.email);

  return {
    success: true,
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    },
  };
}

// メール認証
export async function verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
  const user = await db.getUserByVerificationToken(token);
  if (!user) {
    return { success: false, error: "無効な認証トークンです" };
  }

  if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
    return { success: false, error: "認証トークンの有効期限が切れています" };
  }

  const success = await db.verifyUserEmail(user.id);
  if (!success) {
    return { success: false, error: "メール認証に失敗しました" };
  }

  return { success: true };
}

// パスワードリセットリクエスト
export async function requestPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  const user = await db.getUserByEmail(email);
  if (!user) {
    // セキュリティのため、ユーザーが存在しない場合も成功を返す
    return { success: true };
  }

  const resetToken = generateRandomToken();
  const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1時間

  await db.updateUser(user.id, {
    passwordResetToken: resetToken,
    passwordResetExpires: resetExpires,
  });

  await sendPasswordResetEmail(email, resetToken);

  return { success: true };
}

// パスワードリセット
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const user = await db.getUserByResetToken(token);
  if (!user) {
    return { success: false, error: "無効なリセットトークンです" };
  }

  if (user.passwordResetExpires && new Date() > user.passwordResetExpires) {
    return { success: false, error: "リセットトークンの有効期限が切れています" };
  }

  const passwordHash = await hashPassword(newPassword);

  await db.updateUser(user.id, {
    passwordHash,
    passwordResetToken: null,
    passwordResetExpires: null,
  });

  return { success: true };
}
