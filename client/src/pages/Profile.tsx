import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, ShieldCheck, Database, Bot, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Profile() {
  const { user, refetch: refetchAuth } = useAuth();
  const { data: profile, isLoading, refetch } = trpc.profile.get.useQuery();
  const { data: securitySettings, refetch: refetchSecurity } = trpc.auth.getSecuritySettings.useQuery();
  const [formData, setFormData] = useState({ businessName: "", businessType: "", taxFilingDeadline: "" });
  const [isEditing, setIsEditing] = useState(false);
  const [totpSetupToken, setTotpSetupToken] = useState("");
  const [totpSecret, setTotpSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");

  useEffect(() => {
    if (profile && !isEditing) {
      setFormData({
        businessName: profile.businessName || "",
        businessType: profile.businessType || "",
        taxFilingDeadline: profile.taxFilingDeadline ? new Date(profile.taxFilingDeadline).toISOString().split('T')[0] : "",
      });
    }
  }, [profile, isEditing]);

  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: () => { toast.success("プロフィールを更新しました"); setIsEditing(false); refetch(); },
    onError: (error) => toast.error(error.message || "更新に失敗しました"),
  });
  const updateSecurityMutation = trpc.auth.updateSecuritySettings.useMutation({
    onSuccess: async () => { toast.success("セキュリティ設定を更新しました"); await refetchSecurity(); await refetchAuth(); },
    onError: (error) => toast.error(error.message || "2段階認証の更新に失敗しました"),
  });
  const beginTotpMutation = trpc.auth.beginTotpSetup.useMutation({
    onSuccess: (data) => {
      setTotpSetupToken(data.setupToken); setTotpSecret(data.manualEntryKey); setOtpauthUrl(data.otpauthUrl);
      toast.success("認証アプリにシークレットを登録してください");
    }, onError: (error) => toast.error(error.message || "TOTP設定の開始に失敗しました")
  });
  const confirmTotpMutation = trpc.auth.confirmTotpSetup.useMutation({
    onSuccess: async () => { toast.success("認証アプリ2段階認証を有効化しました"); setTotpCode(""); await refetchSecurity(); await refetchAuth(); },
    onError: (error) => toast.error(error.message || "TOTP設定の確認に失敗しました")
  });
  const disableTotpMutation = trpc.auth.disableTotp.useMutation({
    onSuccess: async () => { toast.success("認証アプリ2段階認証を解除しました"); setTotpSetupToken(""); setTotpSecret(""); setTotpCode(""); await refetchSecurity(); await refetchAuth(); },
    onError: (error) => toast.error(error.message || "TOTP解除に失敗しました")
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div><h1 className="text-3xl font-bold text-gray-900">プロフィール</h1><p className="text-gray-600 mt-2">事業者情報とセキュリティ設定を管理します。</p></div>

        <Card><CardHeader><CardTitle>ユーザー情報</CardTitle></CardHeader><CardContent className="space-y-4"><div><Label className="text-sm text-gray-600">名前</Label><p className="text-lg font-semibold">{user?.name || "未設定"}</p></div><div><Label className="text-sm text-gray-600">メールアドレス</Label><p className="text-lg font-semibold">{user?.email || "未設定"}</p></div></CardContent></Card>

        <Card>
          <CardHeader className="flex items-center justify-between"><div><CardTitle>事業者情報</CardTitle><CardDescription>AI相談や帳簿の初期設定にも利用します。</CardDescription></div>{!isEditing && <Button variant="outline" onClick={() => setIsEditing(true)}>編集</Button>}</CardHeader>
          <CardContent>
            {isLoading ? <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div> : isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div><Label htmlFor="businessName">事業名</Label><Input id="businessName" value={formData.businessName} onChange={(e) => setFormData({ ...formData, businessName: e.target.value })} /></div>
                <div><Label htmlFor="businessType">事業形態</Label><Input id="businessType" value={formData.businessType} onChange={(e) => setFormData({ ...formData, businessType: e.target.value })} /></div>
                <div><Label htmlFor="taxFilingDeadline">確定申告期限</Label><Input id="taxFilingDeadline" type="date" value={formData.taxFilingDeadline} onChange={(e) => setFormData({ ...formData, taxFilingDeadline: e.target.value })} /></div>
                <div className="flex gap-2"><Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? "保存中..." : "保存"}</Button><Button type="button" variant="outline" onClick={() => setIsEditing(false)}>キャンセル</Button></div>
              </form>
            ) : (
              <div className="space-y-4">
                <div><Label className="text-sm text-gray-600">事業名</Label><p className="text-lg font-semibold">{profile?.businessName || "未設定"}</p></div>
                <div><Label className="text-sm text-gray-600">事業形態</Label><p className="text-lg font-semibold">{profile?.businessType || "未設定"}</p></div>
                <div><Label className="text-sm text-gray-600">確定申告期限</Label><p className="text-lg font-semibold">{profile?.taxFilingDeadline ? new Date(profile.taxFilingDeadline).toLocaleDateString('ja-JP') : "未設定"}</p></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> セキュリティ</CardTitle><CardDescription>メールコードと認証アプリの2段階認証を選べます。</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div className="space-y-1"><p className="font-medium">メールコード</p><p className="text-sm text-gray-600">ログイン時にメールで届く6桁コードを確認します。</p></div>
              <Switch checked={Boolean(securitySettings?.twoFactorEnabled) && securitySettings?.twoFactorMethod === "email"} onCheckedChange={(checked) => updateSecurityMutation.mutate({ twoFactorEnabled: checked, twoFactorMethod: "email" })} disabled={updateSecurityMutation.isPending} />
            </div>
            <div className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1"><p className="font-medium flex items-center gap-2"><Smartphone className="h-4 w-4" /> 認証アプリ（TOTP）</p><p className="text-sm text-gray-600">Google Authenticator などの認証アプリで30秒ごとのコードを使います。</p></div>
                <div className="flex gap-2">
                  {securitySettings?.totpConfigured ? (
                    <>
                      <Button variant="outline" onClick={() => updateSecurityMutation.mutate({ twoFactorEnabled: true, twoFactorMethod: "totp" })}>この方式を使う</Button>
                      <Button variant="destructive" onClick={() => disableTotpMutation.mutate()} disabled={disableTotpMutation.isPending}>解除</Button>
                    </>
                  ) : (
                    <Button onClick={() => beginTotpMutation.mutate()} disabled={beginTotpMutation.isPending}>{beginTotpMutation.isPending ? "発行中..." : "設定を始める"}</Button>
                  )}
                </div>
              </div>
              {totpSecret ? (
                <div className="rounded-lg bg-slate-50 p-3 text-sm space-y-2">
                  <p>認証アプリに次のシークレットを登録してください。</p>
                  <code className="block break-all rounded bg-white px-3 py-2 border">{totpSecret}</code>
                  <p className="text-xs text-gray-500 break-all">otpauth URL: {otpauthUrl}</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1"><Label htmlFor="totpCode">認証アプリの6桁コード</Label><Input id="totpCode" value={totpCode} onChange={(e) => setTotpCode(e.target.value)} placeholder="123456" maxLength={6} /></div>
                    <Button onClick={() => confirmTotpMutation.mutate({ setupToken: totpSetupToken, code: totpCode })} disabled={confirmTotpMutation.isPending || totpCode.length !== 6}>確認して有効化</Button>
                  </div>
                </div>
              ) : null}
              {securitySettings?.totpConfigured ? <p className="text-sm text-emerald-700">設定済み {securitySettings?.totpVerifiedAt ? `（確認: ${new Date(securitySettings.totpVerifiedAt).toLocaleString('ja-JP')}）` : ''}</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>開発状況</CardTitle><CardDescription>今回の段階で本番運用寄りの土台まで入れています。</CardDescription></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border p-4"><div className="mb-2 flex items-center gap-2 font-medium"><Database className="h-4 w-4" /> オンライン保存</div><p className="text-sm text-gray-600">ローカル保存だけでなく、S3系ストレージへ切り替えやすい形に整理しました。</p></div>
            <div className="rounded-xl border p-4"><div className="mb-2 flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" /> 2段階認証</div><p className="text-sm text-gray-600">メールコードに加えて、認証アプリのTOTPにも対応しました。</p></div>
            <div className="rounded-xl border p-4"><div className="mb-2 flex items-center gap-2 font-medium"><Bot className="h-4 w-4" /> AI相談</div><p className="text-sm text-gray-600">帳簿や経費分類を相談できるAIページを追加済みです。</p></div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
