import { TRPCError } from "@trpc/server";
import nodemailer from "nodemailer";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "title is required" });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "content is required" });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `title must be at most ${TITLE_MAX_LENGTH} chars`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `content must be at most ${CONTENT_MAX_LENGTH} chars`,
    });
  }

  return { title, content };
};

/**
 * Project-owner notification (Manus dependency removed).
 *
 * - If SMTP + OWNER_NOTIFICATION_EMAIL are configured, an email is sent.
 * - Otherwise, it logs to server console and returns false.
 */
export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  const { title, content } = validatePayload(payload);

  const to = process.env.OWNER_NOTIFICATION_EMAIL;
  const SMTP_HOST = process.env.SMTP_HOST;
  const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587");
  const SMTP_USER = process.env.SMTP_USER;
  const SMTP_PASS = process.env.SMTP_PASS;
  const FROM_EMAIL = process.env.FROM_EMAIL || "noreply@example.com";

  // Always log (helpful for local dev)
  console.log(`[NotifyOwner] ${title}\n${content}`);

  if (!to || !SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: FROM_EMAIL,
      to,
      subject: `[Tax App] ${title}`,
      text: content,
    });

    return true;
  } catch (e) {
    console.warn("[NotifyOwner] failed:", e);
    return false;
  }
}
