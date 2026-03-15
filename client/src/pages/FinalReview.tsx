import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Download, Loader2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function formatCurrency(value: number) {
  return `¥${(value || 0).toLocaleString()}`;
}

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

export default function FinalReview() {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(String(today.getFullYear()));
  const [, setLocation] = useLocation();
  const year = useMemo(() => parseInt(selectedYear, 10), [selectedYear]);
  const years = Array.from({ length: 5 }, (_, i) => String(today.getFullYear() - i));

  const { data, isLoading } = trpc.reports.getFinalReviewSummary.useQuery({ year });
  const { data: csvRows } = trpc.reports.exportFinalReviewCsv.useQuery({ year });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">最終確認</h1>
            <p className="mt-2 text-gray-600">申告直前に見るべき項目を1画面にまとめています。</p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-2 block text-sm font-medium">対象年</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}年</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                if (!csvRows) return toast.error("CSVデータを読み込めていません");
                downloadCsv(`最終確認_${year}年.csv`, csvRows);
                toast.success("最終確認CSVをダウンロードしました");
              }}
            >
              <Download className="h-4 w-4" /> CSV出力
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
        ) : data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">年間売上</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(data.yearlySummary.totalSales)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">年間経費</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(data.yearlySummary.totalExpenses)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">年間利益</CardTitle></CardHeader>
                <CardContent><div className={`text-2xl font-bold ${data.yearlySummary.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatCurrency(data.yearlySummary.profit)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">月次締め</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-slate-900">{data.monthlyCloseRate}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">証憑保存率</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-slate-900">{data.receiptCoverageRate}%</div></CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> 申告直前のチェック</CardTitle>
                  <CardDescription>要確認が残っている項目から順番に片付けてください。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.readinessItems.map((item: any) => (
                    <div key={item.key} className="flex items-start justify-between gap-3 rounded-xl border p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {item.status === 'ok' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                          <p className="font-medium">{item.label}</p>
                        </div>
                        <p className="text-sm text-gray-600">{item.detail}</p>
                      </div>
                      <Badge variant={item.status === 'ok' ? 'secondary' : 'destructive'}>{item.status === 'ok' ? 'OK' : '要確認'}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>優先して開く画面</CardTitle>
                    <CardDescription>詰まりやすい作業にすぐ飛べます。</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <Button variant="outline" onClick={() => setLocation('/filing-check')}>申告チェックを開く</Button>
                    <Button variant="outline" onClick={() => setLocation('/monthly-close')}>月次締めを確認する</Button>
                    <Button variant="outline" onClick={() => setLocation('/review-extracted')}>要確認キューを開く</Button>
                    <Button variant="outline" onClick={() => setLocation('/reports')}>帳簿CSVを出力する</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>重複候補</CardTitle>
                    <CardDescription>同日・同額・同カテゴリ・同摘要の経費を候補表示しています。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="rounded-lg border px-3 py-2">候補件数: <span className="font-semibold">{data.duplicateCandidateCount}件</span></div>
                    {data.duplicateCandidates.length === 0 ? (
                      <div className="rounded-lg bg-slate-50 p-3 text-gray-600">重複候補はありません。</div>
                    ) : (
                      data.duplicateCandidates.slice(0, 5).map((item: any) => (
                        <div key={item.id} className="rounded-lg bg-slate-50 p-3">
                          <div className="font-medium">{item.date} / {formatCurrency(item.amount)}</div>
                          <div className="text-gray-600">{item.description || '（摘要なし）'}</div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>月別ヘルス</CardTitle>
                <CardDescription>月次締めと未確定仕訳の有無をまとめています。</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {data.monthlyHealth.map((row: any) => (
                    <div key={row.month} className="rounded-xl border p-4 text-sm">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="font-semibold">{row.month}月</span>
                        <Badge variant={row.isClosed ? 'secondary' : 'destructive'}>{row.isClosed ? '締め済み' : '未締め'}</Badge>
                      </div>
                      <div className="space-y-1 text-gray-600">
                        <div>売上 {formatCurrency(row.sales)}</div>
                        <div>経費 {formatCurrency(row.expenses)}</div>
                        <div>利益 {formatCurrency(row.profit)}</div>
                        <div>未確定仕訳 {row.unsettledJournalCount}件</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
