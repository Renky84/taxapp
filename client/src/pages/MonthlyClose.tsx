import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Loader2, Lock, LockOpen, ReceiptText, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function formatCurrency(value: number) {
  return `¥${(value || 0).toLocaleString()}`;
}

export default function MonthlyClose() {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(String(today.getMonth() + 1));
  const [notes, setNotes] = useState("");
  const year = useMemo(() => parseInt(selectedYear, 10), [selectedYear]);
  const month = useMemo(() => parseInt(selectedMonth, 10), [selectedMonth]);
  const years = Array.from({ length: 5 }, (_, i) => String(today.getFullYear() - i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1));

  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.reports.getMonthlyCloseStatus.useQuery({ year, month }, {
    onSuccess: (value) => setNotes(value.closing?.notes || ""),
  });
  const { data: closings } = trpc.reports.listMonthlyClosings.useQuery({ year });

  const mutation = trpc.reports.updateMonthlyCloseStatus.useMutation({
    onSuccess: async () => {
      await utils.reports.getMonthlyCloseStatus.invalidate({ year, month });
      await utils.reports.listMonthlyClosings.invalidate({ year });
      toast.success("月次締めの状態を更新しました");
    },
    onError: (error) => {
      toast.error(error.message || "月次締めの更新に失敗しました");
    },
  });

  const closeMonth = async () => {
    await mutation.mutateAsync({ year, month, status: "closed", notes });
  };

  const reopenMonth = async () => {
    await mutation.mutateAsync({ year, month, status: "open", notes });
  };

  const closedMonths = new Set((closings || []).filter((item: any) => item.status === "closed").map((item: any) => item.month));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">月次締め</h1>
            <p className="mt-2 text-gray-600">その月の入力漏れと未承認項目を確認してから締め処理できます。</p>
          </div>
          <div className="flex gap-3">
            <div>
              <label className="mb-2 block text-sm font-medium">年</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}年</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium">月</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{months.map(m => <SelectItem key={m} value={m}>{m}月</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>締め状況</CardTitle>
            <CardDescription>年単位で、どの月が締め済みかを確認できます。</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {months.map((m) => {
              const mNumber = parseInt(m, 10);
              const isClosed = closedMonths.has(mNumber);
              return (
                <Badge key={m} variant={isClosed ? "default" : "outline"} className="px-3 py-1">
                  {m}月 {isClosed ? "締め済み" : "未締め"}
                </Badge>
              );
            })}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
        ) : data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium"><ReceiptText className="h-4 w-4" /> 月売上</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(data.totalSales)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium"><Wallet className="h-4 w-4" /> 月経費</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(data.totalExpenses)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="h-4 w-4" /> 利益</CardTitle></CardHeader>
                <CardContent><div className={`text-2xl font-bold ${data.profit >= 0 ? "text-blue-600" : "text-red-600"}`}>{formatCurrency(data.profit)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="h-4 w-4" /> 要確認</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-amber-600">{data.warningCount}件</div></CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>締め前チェック</CardTitle>
                  <CardDescription>警告が0件になると月次締めできます。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.items.map((item: any) => (
                    <div key={item.key} className="flex items-start gap-3 rounded-xl border p-4">
                      {item.status === "ok" ? (
                        <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
                      ) : (
                        <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
                      )}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900">{item.label}</div>
                          <Badge variant={item.status === "ok" ? "default" : "secondary"}>{item.status === "ok" ? "OK" : "要対応"}</Badge>
                        </div>
                        <p className="text-sm text-gray-600">{item.message}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>締め操作</CardTitle>
                  <CardDescription>締めメモを残しておくと、あとで見返しやすくなります。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border p-4">
                    <div className="mb-2 flex items-center gap-2 font-medium text-gray-900">
                      {data.closing.status === "closed" ? <Lock className="h-4 w-4 text-blue-600" /> : <LockOpen className="h-4 w-4 text-gray-500" />}
                      現在の状態
                    </div>
                    <p className="text-sm text-gray-600">
                      {data.closing.status === "closed"
                        ? `${year}年${month}月は締め済みです。`
                        : `${year}年${month}月はまだ未締めです。`}
                    </p>
                    {data.closing.closedAt && (
                      <p className="mt-2 text-xs text-gray-500">締め日時: {new Date(data.closing.closedAt).toLocaleString("ja-JP")}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium">締めメモ</label>
                    <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={6} placeholder="例: レシート確認完了。通信費の請求書も登録済み。" />
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                    売上 {data.salesCount}件 / 経費 {data.expenseCount}件 / 未承認 {data.pendingExtractedCount}件 / 未確定仕訳 {data.unsettledJournalCount}件
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button onClick={closeMonth} disabled={mutation.isPending || data.warningCount > 0 || data.closing.status === "closed"}>
                      <Lock className="mr-2 h-4 w-4" /> この月を締める
                    </Button>
                    <Button variant="outline" onClick={reopenMonth} disabled={mutation.isPending || data.closing.status !== "closed"}>
                      <LockOpen className="mr-2 h-4 w-4" /> 締めを解除する
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
