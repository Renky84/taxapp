import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Copy, HardDrive, KeyRound, Rocket, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function copyText(text: string) {
  navigator.clipboard.writeText(text).then(() => toast.success("コピーしました"), () => toast.error("コピーに失敗しました"));
}

const groupIcon: Record<string, any> = {
  "アプリ基盤": Rocket,
  "メール送信": KeyRound,
  "AI / 読取": ShieldCheck,
  "リモートストレージ": HardDrive,
};

export default function GoLiveChecklist() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.system.getGoLiveChecklist.useQuery();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">公開前チェックリスト</h1>
            <p className="mt-2 text-gray-600">本番公開で詰まりやすい、環境変数・マイグレーション・確認手順を1か所にまとめました。</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setLocation('/operations-setup')}>運用準備へ</Button>
            <Button onClick={() => setLocation('/submission-pack')}>申告準備パックへ</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">ストレージ</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-slate-900">{data?.storageMode === 'remote' ? `Remote (${data?.storageProvider})` : 'Local'}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">未設定の必須項目</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-amber-600">{data?.criticalPending?.length ?? 0}件</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">マイグレーション数</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-blue-700">{data?.migrationFiles?.length ?? 0}本</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>実行コマンド</CardTitle>
            <CardDescription>そのまま貼り付けやすいように分けています。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {isLoading ? <div className="text-sm text-gray-500">読み込み中...</div> : Object.entries(data?.commands || {}).map(([key, value]) => (
              <div key={key} className="rounded-xl border p-4">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="font-medium text-slate-900">{key}</div>
                  <Button variant="ghost" size="sm" onClick={() => copyText(String(value))}><Copy className="h-4 w-4" /></Button>
                </div>
                <code className="block whitespace-pre-wrap break-all rounded bg-slate-50 px-3 py-2 text-sm">{String(value)}</code>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>本番用の手順</CardTitle>
            <CardDescription>この順でやると戻り作業が減ります。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.steps || []).map((step: string) => (
              <div key={step} className="flex items-start gap-3 rounded-xl border p-3 text-sm text-slate-700">
                <Wrench className="mt-0.5 h-4 w-4 text-blue-600" />
                <span>{step}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          {(data?.envGroups || []).map((group: any) => {
            const Icon = groupIcon[group.label] || AlertTriangle;
            return (
              <Card key={group.label}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Icon className="h-5 w-5" /> {group.label}</CardTitle>
                  <CardDescription>必須のものから先に埋めてください。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {group.items.map((item: any) => (
                    <div key={item.key} className="rounded-xl border p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-mono text-sm text-slate-900">{item.key}</div>
                        <div className="flex items-center gap-2">
                          {item.required ? <Badge variant="destructive">必須</Badge> : <Badge variant="secondary">任意</Badge>}
                          <Badge variant={item.configured ? "default" : "outline"}>{item.configured ? "設定済み" : "未設定"}</Badge>
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">例: {item.example}</div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>マイグレーション確認</CardTitle>
            <CardDescription>本番DBに反映すべきSQLです。新しい環境では全て、既存環境では未適用分を反映してください。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {(data?.migrationFiles || []).map((name: string) => (
              <div key={name} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span className="font-mono">{name}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {Boolean(data?.criticalPending?.length) && (
          <Card className="border-amber-300 bg-amber-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900"><AlertTriangle className="h-5 w-5" /> 先に埋めるべき項目</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data?.criticalPending?.map((item: string) => (
                <div key={item} className="text-sm text-amber-900">・{item}</div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
