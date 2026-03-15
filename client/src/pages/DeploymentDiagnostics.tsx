import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, Rocket, ShieldAlert, Stethoscope } from "lucide-react";
import { useLocation } from "wouter";

export default function DeploymentDiagnostics() {
  const [, setLocation] = useLocation();
  const { data, isLoading } = trpc.system.getDeploymentDiagnostics.useQuery();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">起動診断</h1>
            <p className="mt-2 text-gray-600">本番公開前に、起動不能になりやすい設定漏れと最低限の動作確認ポイントをまとめています。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setLocation('/operations-setup')}>運用準備</Button>
            <Button variant="outline" onClick={() => setLocation('/go-live-checklist')}>公開前チェック</Button>
            <Button onClick={() => setLocation('/submission-pack')} className="gap-2"><Rocket className="h-4 w-4" /> 申告準備パック</Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
        ) : data ? (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">診断スコア</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-slate-900">{data.score} / {data.total}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">致命的ブロッカー</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-red-600">{data.blockers.length}件</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">注意項目</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-amber-600">{data.warnings.length}件</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">保存先</CardTitle></CardHeader>
                <CardContent><div className="text-lg font-semibold text-cyan-700">{data.storageMode} / {data.storageProvider}</div></CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Stethoscope className="h-5 w-5" /> 設定診断</CardTitle>
                  <CardDescription>fail は公開前に必ず解消、warn は運用方針に応じて確認してください。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.checks.map((item: any) => (
                    <div key={item.key} className="flex items-start justify-between gap-3 rounded-xl border p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-medium">
                          {item.status === 'pass' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className={`h-4 w-4 ${item.status === 'fail' ? 'text-red-600' : 'text-amber-600'}`} />}
                          <span>{item.label}</span>
                        </div>
                        <p className="text-sm text-gray-600">{item.detail}</p>
                      </div>
                      <Badge variant={item.status === 'pass' ? 'secondary' : item.status === 'fail' ? 'destructive' : 'outline'}>
                        {item.status === 'pass' ? 'OK' : item.status === 'fail' ? 'BLOCKER' : 'WARN'}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> 先に直す項目</CardTitle>
                    <CardDescription>公開が止まる可能性が高い順に並べています。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.blockers.length === 0 ? (
                      <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">致命的ブロッカーは見つかっていません。次はスモークテストへ進めます。</div>
                    ) : data.blockers.map((item: any) => (
                      <div key={item.key} className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <div className="font-medium text-red-700">{item.label}</div>
                        <p className="mt-1 text-sm text-red-700/90">{item.detail}</p>
                      </div>
                    ))}
                    {data.warnings.map((item: any) => (
                      <div key={item.key} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                        <div className="font-medium text-amber-800">{item.label}</div>
                        <p className="mt-1 text-sm text-amber-800/90">{item.detail}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>本番コマンド</CardTitle>
                    <CardDescription>環境構築後に順番どおり実行する想定です。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {Object.entries(data.commands).map(([key, command]) => (
                      <div key={key} className="rounded-lg border bg-slate-50 px-3 py-2 font-mono text-slate-700">{String(command)}</div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>スモークテスト</CardTitle>
                <CardDescription>最低限ここまで通れば、公開直後の初期トラブルをかなり減らせます。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 lg:grid-cols-2">
                {data.smokeTests.map((item: any) => (
                  <div key={item.step} className="rounded-xl border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">{item.step}. {item.label}</div>
                      <Button size="sm" variant="outline" onClick={() => setLocation(item.path)} className="gap-1">開く <ExternalLink className="h-3.5 w-3.5" /></Button>
                    </div>
                    <p className="mt-2 text-sm text-gray-600">期待結果: {item.expected}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
