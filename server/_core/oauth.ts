import type { Express, Request, Response } from "express";
import {
  registerUser,
  loginUser,
  verifyTwoFactorLogin,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  setSessionCookie,
  clearSessionCookie,
  getUserFromRequest,
} from "./auth";

export function registerAuthRoutes(app: Express) {
  // 新規登録
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, name, businessName, businessType } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "メールアドレスとパスワードは必須です" });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: "パスワードは8文字以上で入力してください" });
      }

      const result = await registerUser(email, password, name, businessName, businessType);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, message: "登録が完了しました。メールを確認してください。" });
    } catch (error) {
      console.error("[Auth] Register error:", error);
      res.status(500).json({ error: "登録に失敗しました" });
    }
  });

  // ログイン
  app.post("/api/auth/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "メールアドレスとパスワードは必須です" });
      }

      const result = await loginUser(email, password);

      if (!result.success) {
        return res.status(401).json({ error: result.error });
      }

      if (result.requiresTwoFactor) {
        return res.json({
          success: true,
          requiresTwoFactor: true,
          pendingToken: result.pendingToken,
          user: result.user,
        });
      }

      // セッションCookieを設定
      setSessionCookie(res, result.token!);

      res.json({ success: true, user: result.user });
    } catch (error) {
      console.error("[Auth] Login error:", error);
      res.status(500).json({ error: "ログインに失敗しました" });
    }
  });


  app.post("/api/auth/login/verify", async (req: Request, res: Response) => {
    try {
      const { pendingToken, code } = req.body;

      if (!pendingToken || !code) {
        return res.status(400).json({ error: "確認用トークンとコードは必須です" });
      }

      const result = await verifyTwoFactorLogin(pendingToken, code);

      if (!result.success) {
        return res.status(401).json({ error: result.error });
      }

      setSessionCookie(res, result.token!);
      res.json({ success: true, user: result.user });
    } catch (error) {
      console.error("[Auth] Verify 2FA error:", error);
      res.status(500).json({ error: "2段階認証の確認に失敗しました" });
    }
  });

  // ログアウト
  app.post("/api/auth/logout", async (req: Request, res: Response) => {
    try {
      clearSessionCookie(res);
      res.json({ success: true });
    } catch (error) {
      console.error("[Auth] Logout error:", error);
      res.status(500).json({ error: "ログアウトに失敗しました" });
    }
  });

  // 現在のユーザー情報取得
  app.get("/api/auth/me", async (req: Request, res: Response) => {
    try {
      const user = await getUserFromRequest(req);

      if (!user) {
        return res.status(401).json({ error: "認証が必要です" });
      }

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        emailVerified: user.emailVerified,
      });
    } catch (error) {
      console.error("[Auth] Get user error:", error);
      res.status(401).json({ error: "認証が必要です" });
    }
  });

  // メール認証
  app.get("/api/auth/verify-email", async (req: Request, res: Response) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== "string") {
        return res.status(400).json({ error: "認証トークンが必要です" });
      }

      const result = await verifyEmail(token);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, message: "メールアドレスが確認されました" });
    } catch (error) {
      console.error("[Auth] Verify email error:", error);
      res.status(500).json({ error: "メール認証に失敗しました" });
    }
  });

  // パスワードリセットリクエスト
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "メールアドレスは必須です" });
      }

      await requestPasswordReset(email);

      res.json({ success: true, message: "パスワードリセットメールを送信しました" });
    } catch (error) {
      console.error("[Auth] Forgot password error:", error);
      res.status(500).json({ error: "パスワードリセットリクエストに失敗しました" });
    }
  });

  // パスワードリセット
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ error: "トークンとパスワードは必須です" });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: "パスワードは8文字以上で入力してください" });
      }

      const result = await resetPassword(token, password);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ success: true, message: "パスワードがリセットされました" });
    } catch (error) {
      console.error("[Auth] Reset password error:", error);
      res.status(500).json({ error: "パスワードリセットに失敗しました" });
    }
  });

  // 旧OAuthコールバック（互換性のため残す）
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    res.redirect("/login");
  });
}

// 互換性のためのエクスポート
export const registerOAuthRoutes = registerAuthRoutes;
