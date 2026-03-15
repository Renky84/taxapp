import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Receipt, Loader2, Eye, EyeOff, Building2 } from "lucide-react";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Register() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
  
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // 事業情報
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");

  // ログイン済みの場合はホームにリダイレクト
  if (user && !loading) {
    setLocation("/");
    return null;
  }

  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("パスワードが一致しません");
      return;
    }
    
    if (password.length < 8) {
      toast.error("パスワードは8文字以上で入力してください");
      return;
    }
    
    setStep(2);
  };

  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          email, 
          password, 
          name,
          businessName,
          businessType,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "登録に失敗しました");
        return;
      }

      toast.success("登録が完了しました！ログインしてください。");
      setLocation("/login");
    } catch (error) {
      toast.error("登録に失敗しました。もう一度お試しください。");
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
                {step === 1 ? (
                  <Receipt className="w-12 h-12 text-blue-600" />
                ) : (
                  <Building2 className="w-12 h-12 text-blue-600" />
                )}
              </div>
            </div>
            <CardTitle className="text-2xl">
              {step === 1 ? "新規登録" : "事業情報の入力"}
            </CardTitle>
            <CardDescription>
              {step === 1 
                ? "アカウント情報を入力してください" 
                : "事業に関する情報を入力してください"}
            </CardDescription>
            {/* ステップインジケーター */}
            <div className="flex justify-center gap-2">
              <div className={`w-3 h-3 rounded-full ${step >= 1 ? 'bg-blue-600' : 'bg-gray-300'}`} />
              <div className={`w-3 h-3 rounded-full ${step >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`} />
            </div>
          </CardHeader>
          <CardContent>
            {step === 1 ? (
              <form onSubmit={handleStep1Submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">お名前</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="山田 太郎"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
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
                  <Label htmlFor="password">パスワード（8文字以上）</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="パスワードを入力"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
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
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">パスワード（確認）</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="パスワードを再入力"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                >
                  次へ
                </Button>
              </form>
            ) : (
              <form onSubmit={handleStep2Submit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="businessName">屋号・事業名</Label>
                  <Input
                    id="businessName"
                    type="text"
                    placeholder="例：山田商店"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessType">事業形態</Label>
                  <Select value={businessType} onValueChange={setBusinessType}>
                    <SelectTrigger>
                      <SelectValue placeholder="事業形態を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">個人事業主</SelectItem>
                      <SelectItem value="freelance">フリーランス</SelectItem>
                      <SelectItem value="side_business">副業</SelectItem>
                      <SelectItem value="corporation">法人</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep(1)}
                  >
                    戻る
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        登録中...
                      </>
                    ) : (
                      "登録する"
                    )}
                  </Button>
                </div>
              </form>
            )}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                すでにアカウントをお持ちの方は
                <Link href="/login" className="text-blue-600 hover:underline ml-1">
                  ログイン
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
