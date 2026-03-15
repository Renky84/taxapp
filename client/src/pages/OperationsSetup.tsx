import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Database, HardDrive, KeyRound, Mail, Sparkles } from "lucide-react";
import { useLocation } from "wouter";

const iconMap: Record<string, any> = {
  database: Database,
  auth: KeyRound,
  smtp: Mail,
  storage: HardDrive,
  ai: Sparkles,
};

export default function OperationsSetup() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.system.getReadiness.useQuery();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">運用準備</h1>
          <p className="mt-2 text-gray-600">本番公開前に、ログイン・保存・AI読取の設定漏れをまとめて確認できます。</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">準備済み</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-emerald-600">{data?.readyCount ?? 0}件</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">要対応</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-amber-600">{data?.attentionCount ?? 0}件</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">書類保存</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold text-slate-900">{data?.storageMode === "remote" ? `Remote (${data?.storageProvider || 'remote'})` : "Local"}</div></CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>環境チェック</CardTitle>
            <CardDescription>未設定の項目があると、本番運用でログインやPDF読取が止まる可能性があります。</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-gray-500">読み込み中...</div>
            ) : (
              <div className="space-y-3">
                {data?.checks.map((item: any) => {
                  const Icon = iconMap[item.key] || AlertTriangle;
                  return (
                    <div key={item.key} className="flex items-start justify-between gap-4 rounded-xl border p-4">
                      <div className="flex gap-3">
                        <Icon className="mt-0.5 h-5 w-5 text-slate-600" />
                        <div>
                          <div className="font-medium text-slate-900">{item.label}</div>
                          <div className="mt-1 text-sm text-gray-600">{item.detail}</div>
                        </div>
                      </div>
                      <div className={`rounded-full px-3 py-1 text-xs font-medium ${item.status === "ready" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {item.status === "ready" ? "準備OK" : "要対応"}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>次にやること</CardTitle>
            <CardDescription>時間がない前提で、優先度の高い順に見られるようにしています。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(data?.recommendedActions?.length ? data.recommendedActions : ['大きな設定漏れは見つかっていません。']) .map((action: string) => (
              <div key={action} className="flex items-center gap-2 text-sm text-slate-700">
                {data?.recommendedActions?.length ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                <span>{action}</span>
              </div>
            ))}

            <div className="flex flex-wrap gap-2 pt-3">
              <Button variant="outline" onClick={() => setLocation('/profile')}>プロフィールを確認</Button>
              <Button variant="outline" onClick={() => setLocation('/submission-pack')}>申告準備パックへ</Button>
              <Button variant="outline" onClick={() => setLocation('/go-live-checklist')}>公開前チェックへ</Button>
              <Button variant="outline" onClick={() => setLocation('/assistant')}>AI相談を開く</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
