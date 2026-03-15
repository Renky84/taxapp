import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Receipt, Loader2, Eye, EyeOff, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function Login() {
  const { user, loading, refetch } = useAuth();
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [twoFactorMethod, setTwoFactorMethod] = useState<"email" | "totp">("email");

  if (user && !loading) {
    setLocation("/");
    return null;
  }

  const completeLogin = async () => {
    toast.success("ログイン成功！");
    await refetch();
    setLocation("/");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "ログインに失敗しました");
        return;
      }
      if (data.requiresTwoFactor) {
        setPendingToken(data.pendingToken);
        setTwoFactorMethod(data.user?.twoFactorMethod || "email");
        toast.success(data.user?.twoFactorMethod === "totp" ? "認証アプリの6桁コードを入力してください" : "確認コードをメールに送信しました");
        return;
      }
      await completeLogin();
    } catch {
      toast.error("ログインに失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingToken) return;
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/login/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingToken, code: twoFactorCode }),
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || "確認に失敗しました");
        return;
      }
      await completeLogin();
    } catch {
      toast.error("確認コードの送信に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md w-full">
        <Card className="shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="bg-blue-100 p-4 rounded-full">
                {pendingToken ? (twoFactorMethod === "totp" ? <Smartphone className="w-12 h-12 text-blue-600" /> : <ShieldCheck className="w-12 h-12 text-blue-600" />) : <Receipt className="w-12 h-12 text-blue-600" />}
              </div>
            </div>
            <CardTitle className="text-2xl">確定申告アプリ</CardTitle>
            <CardDescription>
              {pendingToken ? (twoFactorMethod === "totp" ? "認証アプリに表示された6桁コードを入力してください" : "メールに届いた6桁コードを入力してください") : "アカウントにログインしてください"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!pendingToken ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="email">メールアドレス</Label><Input id="email" type="email" placeholder="example@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                <div className="space-y-2">
                  <Label htmlFor="password">パスワード</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} placeholder="パスワードを入力" value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>{isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />ログイン中...</> : "ログイン"}</Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyTwoFactor} className="space-y-4">
                <div className="space-y-3">
                  <Label>確認コード</Label>
                  <InputOTP maxLength={6} value={twoFactorCode} onChange={setTwoFactorCode}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                      <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                  <p className="text-sm text-gray-500">{twoFactorMethod === "totp" ? "Google Authenticator や 1Password などの認証アプリに表示されたコードを入力してください。" : "コードは10分間有効です。メールが見つからないときは迷惑メールも確認してください。"}</p>
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting || twoFactorCode.length !== 6}>{isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />確認中...</> : "確認してログイン"}</Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => { setPendingToken(null); setTwoFactorCode(""); setTwoFactorMethod("email"); }}>戻る</Button>
              </form>
            )}
            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-gray-600">アカウントをお持ちでない方は<Link href="/register" className="text-blue-600 hover:underline ml-1">新規登録</Link></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
