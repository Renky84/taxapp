import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, CheckCircle2, Loader2, TrendingUp, Wallet, ReceiptText, Bot } from "lucide-react";
import { useMemo, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";

function formatCurrency(value: number) {
  return `¥${(value || 0).toLocaleString()}`;
}

export default function FilingCheck() {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear().toString());
  const [, setLocation] = useLocation();
  const year = useMemo(() => parseInt(selectedYear, 10), [selectedYear]);
  const years = Array.from({ length: 5 }, (_, i) => (today.getFullYear() - i).toString());

  const { data: yearly, isLoading: yearlyLoading } = trpc.reports.getYearlySummary.useQuery({ year });
  const { data: check, isLoading: checkLoading } = trpc.reports.getFilingCheck.useQuery({ year });

  const isLoading = yearlyLoading || checkLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">申告チェック</h1>
            <p className="mt-2 text-gray-600">年次集計と申告前の抜け漏れをまとめて確認できます。</p>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">対象年</label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={y}>{y}年</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium"><TrendingUp className="h-4 w-4" /> 年間売上</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(yearly?.totalSales || 0)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium"><Wallet className="h-4 w-4" /> 年間経費</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-red-600">{formatCurrency(yearly?.totalExpenses || 0)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium"><ReceiptText className="h-4 w-4" /> 年間利益</CardTitle></CardHeader>
                <CardContent><div className={`text-2xl font-bold ${(yearly?.profit || 0) >= 0 ? "text-blue-600" : "text-red-600"}`}>{formatCurrency(yearly?.profit || 0)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm font-medium"><AlertTriangle className="h-4 w-4" /> 要対応</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-amber-600">{check?.warningCount || 0}件</div></CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>申告前チェック</CardTitle>
                  <CardDescription>優先度の高いものから確認してください。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(check?.items || []).map((item: any) => (
                    <div key={item.key} className="flex items-start justify-between gap-3 rounded-xl border p-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          {item.status === "ok" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                          <p className="font-medium">{item.label}</p>
                        </div>
                        <p className="text-sm text-gray-600">{item.message}</p>
                      </div>
                      <Badge variant={item.status === "ok" ? "secondary" : "destructive"}>{item.status === "ok" ? "OK" : "要確認"}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>月別の推移</CardTitle>
                    <CardDescription>入力が止まっている月を見つけやすくしています。</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(yearly?.monthly || []).map((row: any) => (
                      <div key={row.month} className="rounded-xl border p-3 text-sm">
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-medium">{row.month}月</span>
                          <span className={`${row.profit >= 0 ? "text-blue-600" : "text-red-600"} font-semibold`}>{formatCurrency(row.profit)}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-gray-600">
                          <div>売上 {formatCurrency(row.sales)}</div>
                          <div>経費 {formatCurrency(row.expenses)}</div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>次の一手</CardTitle>
                    <CardDescription>不足がある場合はここから進めると早いです。</CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-2">
                    <Button variant="outline" onClick={() => setLocation('/review-extracted')}>要確認キューを開く</Button>
                    <Button variant="outline" onClick={() => setLocation('/reports')}>帳簿CSVを出力する</Button>
                    <Button variant="outline" onClick={() => setLocation('/assistant')}>AI相談で整理する</Button>
                    <Button variant="outline" onClick={() => setLocation('/final-review')}>最終確認を開く</Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Bot className="h-4 w-4" /> AIに聞く例</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-gray-700">
                    <div className="rounded-lg bg-slate-50 p-3">今年の未入力っぽい月から優先順位をつけて</div>
                    <div className="rounded-lg bg-slate-50 p-3">要確認のレシートを先に片付けるべき理由を教えて</div>
                    <div className="rounded-lg bg-slate-50 p-3">今年の利益推移を見て、申告前に気を付ける点を整理して</div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
