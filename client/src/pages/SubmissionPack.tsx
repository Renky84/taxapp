import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, Briefcase, CheckCircle2, Download, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function formatCurrency(value: number) {
  return `¥${(value || 0).toLocaleString()}`;
}

export default function SubmissionPack() {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()));
  const [, setLocation] = useLocation();
  const year = useMemo(() => parseInt(selectedYear, 10), [selectedYear]);
  const years = Array.from({ length: 5 }, (_, i) => String(today.getFullYear() - i));

  const { data, isLoading } = trpc.reports.getSubmissionPackSummary.useQuery({ year });
  const { data: submissionCsv } = trpc.reports.exportSubmissionPackCsv.useQuery({ year });
  const { data: yearlyBookCsv } = trpc.reports.exportYearlyBookCsv.useQuery({ year });
  const { data: yearlyJournalCsv } = trpc.reports.exportYearlyJournalCsv.useQuery({ year });
  const { data: yearlyGeneralLedgerCsv } = trpc.reports.exportYearlyGeneralLedgerCsv.useQuery({ year });
  const { data: filingCheckCsv } = trpc.reports.exportFilingCheckCsv.useQuery({ year });
  const { data: finalReviewCsv } = trpc.reports.exportFinalReviewCsv.useQuery({ year });

  const downloadAll = () => {
    if (!submissionCsv || !yearlyBookCsv || !yearlyJournalCsv || !yearlyGeneralLedgerCsv || !filingCheckCsv || !finalReviewCsv) {
      toast.error("出力データの読込が完了していません");
      return;
    }
    downloadCsv(`申告準備パック_${year}年.csv`, submissionCsv);
    downloadCsv(`年次帳簿_${year}年.csv`, yearlyBookCsv);
    downloadCsv(`年次仕訳帳_${year}年.csv`, yearlyJournalCsv);
    downloadCsv(`年次総勘定元帳_${year}年.csv`, yearlyGeneralLedgerCsv);
    downloadCsv(`申告チェック_${year}年.csv`, filingCheckCsv);
    downloadCsv(`最終確認_${year}年.csv`, finalReviewCsv);
    toast.success("申告準備用CSVをまとめてダウンロードしました");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">申告準備パック</h1>
            <p className="mt-2 text-gray-600">申告直前に必要な確認とCSV出力を1か所にまとめています。</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-2 block text-sm font-medium">対象年</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}年</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="gap-2" onClick={downloadAll}>
              <Download className="h-4 w-4" /> まとめてCSV出力
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
        ) : data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">準備完了率</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-blue-700">{data.completionRate}%</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">年間売上</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-emerald-600">{formatCurrency(data.yearlySummary.totalSales)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">年間経費</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-rose-600">{formatCurrency(data.yearlySummary.totalExpenses)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">年間利益</CardTitle></CardHeader>
                <CardContent><div className={`text-2xl font-bold ${data.yearlySummary.profit >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{formatCurrency(data.yearlySummary.profit)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">警告数</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-amber-600">{data.warningCount}件</div></CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" /> 提出前にそろえるCSV</CardTitle>
                  <CardDescription>出力の準備状態を確認しながら、必要なファイルをまとめてダウンロードできます。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.documents.map((item: any) => (
                    <div key={item.key} className="flex items-start justify-between gap-3 rounded-xl border p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {item.status === 'ready' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                          <p className="font-medium">{item.label}</p>
                        </div>
                        <p className="text-sm text-gray-600">{item.detail}</p>
                      </div>
                      <Badge variant={item.status === 'ready' ? 'secondary' : 'destructive'}>{item.status === 'ready' ? '準備済み' : '要確認'}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>優先アクション</CardTitle>
                    <CardDescription>警告を減らすために先に開くとよい画面です。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {data.recommendedActions.length === 0 ? (
                      <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">今のところ優先アクションはありません。提出前の最終確認へ進めます。</div>
                    ) : data.recommendedActions.map((item: any, index: number) => (
                      <div key={`${item.label}-${index}`} className="rounded-xl border p-4">
                        <div className="font-medium">{item.label}</div>
                        <p className="mt-1 text-sm text-gray-600">{item.detail}</p>
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => setLocation(item.path)}>この画面を開く</Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>提出前の進め方</CardTitle>
                    <CardDescription>迷わず進められるように、最後の導線を固定しています。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-gray-700">
                    <div className="rounded-xl border p-3">1. <span className="font-medium">運用準備</span> でストレージ・AI・認証設定を確認</div>
                    <div className="rounded-xl border p-3">2. <span className="font-medium">申告チェック</span> と <span className="font-medium">最終確認</span> で警告を減らす</div>
                    <div className="rounded-xl border p-3">3. このページで <span className="font-medium">CSVをまとめて出力</span> して提出準備を完了</div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Button variant="outline" onClick={() => setLocation('/operations-setup')}>運用準備</Button>
                      <Button variant="outline" onClick={() => setLocation('/go-live-checklist')}>公開前チェック</Button>
                      <Button variant="outline" onClick={() => setLocation('/deployment-diagnostics')}>起動診断</Button>
                      <Button variant="outline" onClick={() => setLocation('/filing-check')}>申告チェック</Button>
                      <Button variant="outline" onClick={() => setLocation('/final-review')}>最終確認</Button>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>事業情報</CardTitle>
                    <CardDescription>提出前にプロフィール側も確認しておくと安心です。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-gray-700">
                    <div className="rounded-lg border px-3 py-2">事業名: <span className="font-medium">{data.businessName || '未設定'}</span></div>
                    <div className="rounded-lg border px-3 py-2">事業形態: <span className="font-medium">{data.businessType || '未設定'}</span></div>
                    <div className="rounded-lg border px-3 py-2">申告期限: <span className="font-medium">{data.deadline || '未設定'}</span></div>
                    <Button variant="outline" onClick={() => setLocation('/profile')}>プロフィールを開く</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
