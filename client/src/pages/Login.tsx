import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Receipt, Loader2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { toast } from "sonner";

export default function Login() {
  const { user, loading, refetch } = useAuth();
  const [, setLocation] = useLocation();
  
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ログイン済みの場合はホームにリダイレクト
  if (user && !loading) {
    setLocation("/");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "ログインに失敗しました");
        return;
      }

      toast.success("ログイン成功！");

      // 認証状態を更新
      await refetch();
      setLocation("/");
    } catch (error) {
      toast.error("ログインに失敗しました。もう一度お試しください。");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-md w-full">
        <Card className="shadow-xl">
          <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="bg-blue-100 p-4 rounded-full">
                <Receipt className="w-12 h-12 text-blue-600" />
              </div>
            </div>
            <CardTitle className="text-2xl">確定申告アプリ</CardTitle>
            <CardDescription>
              アカウントにログインしてください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">パスワード</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="パスワードを入力"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ログイン中...
                  </>
                ) : (
                  "ログイン"
                )}
              </Button>
            </form>
            <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-gray-600">
                アカウントをお持ちでない方は
                <Link href="/register" className="text-blue-600 hover:underline ml-1">
                  新規登録
                </Link>
              </p>
              <p className="text-sm text-gray-600">
                <Link href="/forgot-password" className="text-blue-600 hover:underline">
                  パスワードをお忘れの方
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
