import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTheme } from "@/contexts/ThemeContext";
import { trpc } from "@/lib/trpc";
import {
  ArrowRight,
  Camera,
  Clock3,
  FileBarChart,
  Landmark,
  Loader2,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useMemo, useState } from "react";
import { useLocation } from "wouter";

function formatYen(value: number) {
  return `¥${Math.round(value / 100).toLocaleString("ja-JP")}`;
}

export default function Home() {
  const { user, loading } = useAuth();
  const { taxMode } = useTheme();
  const [, setLocation] = useLocation();
  const [selectedYear] = useState(new Date().getFullYear());
  const [selectedMonth] = useState(new Date().getMonth() + 1);

  const { data: monthlyData, isLoading: monthlyLoading } = trpc.reports.getMonthlyReport.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });
  const { data: recentReceipts } = trpc.receipts.list.useQuery({ limit: 5 });
  const { data: profile } = trpc.profile.get.useQuery();

  const daysUntilDeadline = profile?.taxFilingDeadline
    ? Math.ceil((new Date(profile.taxFilingDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const chartData = useMemo(
    () => [
      { name: "売上", value: (monthlyData?.totalSales || 0) / 100 },
      { name: "経費", value: (monthlyData?.totalExpenses || 0) / 100 },
      { name: "利益", value: (monthlyData?.profit || 0) / 100 },
    ],
    [monthlyData],
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-background px-6 py-14">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <div className="inline-flex rounded-full border border-border/70 bg-card px-4 py-2 text-sm text-muted-foreground shadow-sm">
                2026年の帳簿づくりを、静かに強く支える申告アプリ
              </div>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                  白色は軽やかに。青色は本格的に。<br />
                  見た目も帳簿も、ちゃんと整う。
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
                  レシート保存、複式簿記、帳簿生成までをひとつにまとめた個人事業主向けの確定申告アプリです。
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button size="lg" className="h-12 rounded-2xl px-6" onClick={() => setLocation("/register")}>
                  新規登録
                </Button>
                <Button variant="outline" size="lg" className="h-12 rounded-2xl px-6" onClick={() => setLocation("/login")}>
                  ログイン
                </Button>
              </div>
            </div>

            <div className="rounded-[32px] border border-border/70 bg-card/95 p-6 shadow-2xl shadow-black/5 backdrop-blur">
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["証憑保存", "7年保存を見据えた保管", Receipt],
                  ["スキャン", "画像から記帳候補を整理", Camera],
                  ["複式簿記", "事業主貸借にも対応", Landmark],
                  ["レポート", "月次の流れを一目で確認", FileBarChart],
                ].map(([title, desc, Icon]) => (
                  <div key={String(title)} className="rounded-3xl border border-border/70 bg-background/80 p-5">
                    <Icon className="h-8 w-8 text-primary" />
                    <div className="mt-4 text-lg font-semibold">{title}</div>
                    <div className="mt-2 text-sm leading-6 text-muted-foreground">{desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <section className="dashboard-hero rounded-[32px] border border-border/70 p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-medium uppercase tracking-[0.22em] text-current/80">
                {taxMode === "blue" ? "Blue Filing Mode" : "White Filing Mode"}
              </div>
              <div>
                <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">{selectedYear}年の帳簿を、落ち着いて整える。</h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-current/80 sm:text-base">
                  収入、経費、証憑、資金の流れをひとつの画面から見渡せるように、ダッシュボードから先に磨いています。
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button className="h-12 rounded-2xl bg-white/95 px-5 text-slate-900 hover:bg-white" onClick={() => setLocation("/receipt-scan")}>
                レシートを読み取る
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" className="h-12 rounded-2xl border-white/20 bg-transparent px-5 text-current hover:bg-white/10" onClick={() => setLocation("/reports")}>
                帳簿を確認する
              </Button>
            </div>
          </div>
        </section>

        {daysUntilDeadline !== null && (
          <Card className="rounded-[28px] border border-border/70 bg-card/90 shadow-sm">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Clock3 className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">確定申告の目安日まで</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight">
                    {profile?.taxFilingDeadline ? new Date(profile.taxFilingDeadline).toLocaleDateString("ja-JP") : "-"}
                  </p>
                </div>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-4xl font-semibold tracking-tight">{daysUntilDeadline}</p>
                <p className="text-sm text-muted-foreground">日</p>
              </div>
            </CardContent>
          </Card>
        )}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard title={`${selectedMonth}月売上`} value={formatYen(monthlyData?.totalSales || 0)} icon={TrendingUp} tone="positive" />
          <MetricCard title={`${selectedMonth}月経費`} value={formatYen(monthlyData?.totalExpenses || 0)} icon={TrendingDown} tone="negative" />
          <MetricCard title={`${selectedMonth}月利益`} value={formatYen(monthlyData?.profit || 0)} icon={Wallet} tone="neutral" />
          <MetricCard
            title="利益率"
            value={`${(monthlyData?.totalSales || 0) > 0 ? (((monthlyData?.profit || 0) / (monthlyData?.totalSales || 1)) * 100).toFixed(1) : "0.0"}%`}
            icon={Landmark}
            tone="neutral"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card className="rounded-[28px] border border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">{selectedMonth}月の推移</CardTitle>
              <CardDescription>売上・経費・利益をひと目で確認できます。</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px] pt-4">
              {monthlyLoading ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={12}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `¥${value.toLocaleString()}`} />
                    <Tooltip formatter={(value: number) => `¥${value.toLocaleString("ja-JP")}`} cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} />
                    <Bar dataKey="value" radius={[14, 14, 0, 0]} fill="var(--chart-1)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[28px] border border-border/70 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">最近の証憑</CardTitle>
              <CardDescription>スキャン後の確認や入力漏れの発見に使えます。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-2">
              {recentReceipts?.length ? (
                recentReceipts.map((receipt: any) => (
                  <button
                    key={receipt.id}
                    type="button"
                    onClick={() => setLocation("/receipts")}
                    className="flex w-full items-center justify-between rounded-2xl border border-border/70 bg-background px-4 py-4 text-left transition hover:border-primary/40 hover:bg-accent/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{receipt.storeName || "店舗名未設定"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {receipt.purchaseDate ? new Date(receipt.purchaseDate).toLocaleDateString("ja-JP") : "日付未設定"}
                      </p>
                    </div>
                    <div className="pl-4 text-right">
                      <p className="font-semibold">{formatYen(receipt.totalAmount || 0)}</p>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
                  まだ証憑がありません。最初の1枚を読み取ってみましょう。
                </div>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: any;
  tone: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
        : "bg-primary/10 text-primary";

  return (
    <Card className="rounded-[28px] border border-border/70 shadow-sm">
      <CardContent className="flex items-start justify-between gap-4 p-6">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
