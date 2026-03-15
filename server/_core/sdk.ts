import { ForbiddenError } from "@shared/_core/errors";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { getUserFromRequest, verifyToken } from "./auth";

const COOKIE_NAME = "session";

class SDKServer {
  private parseCookies(cookieHeader: string | undefined): Map<string, string> {
    const cookies = new Map<string, string>();
    if (!cookieHeader) return cookies;
    
    cookieHeader.split(";").forEach((cookie) => {
      const [name, value] = cookie.trim().split("=");
      if (name && value) {
        cookies.set(name, value);
      }
    });
    
    return cookies;
  }

  /**
   * リクエストからユーザーを取得
   */
  async getUserFromRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);

    if (!sessionCookie) {
      console.log("[Auth] Missing session cookie");
      throw ForbiddenError("Invalid session cookie");
    }

    const payload = verifyToken(sessionCookie);
    if (!payload) {
      console.log("[Auth] Invalid token");
      throw ForbiddenError("Invalid session token");
    }

    const user = await db.getUserById(payload.userId);
    if (!user) {
      console.log("[Auth] User not found");
      throw ForbiddenError("User not found");
    }

    // 最終ログイン日時を更新
    await db.updateLastSignedIn(user.id);

    return user;
  }
}

export const sdk = new SDKServer();
