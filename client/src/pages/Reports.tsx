import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { BookOpenText, Download, FileSpreadsheet, Loader2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function toCsv(rows: Array<Array<string | number>>) {
  const bom = "\uFEFF";
  return (
    bom +
    rows
      .map((row) =>
        row
          .map((cell) => {
            const value = String(cell ?? "");
            return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
          })
          .join(","),
      )
      .join("\n")
  );
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

export default function Reports() {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((today.getMonth() + 1).toString());

  const params = useMemo(
    () => ({ year: parseInt(selectedYear, 10), month: parseInt(selectedMonth, 10) }),
    [selectedYear, selectedMonth],
  );
  const selectedYearNumber = parseInt(selectedYear, 10);

  const { data: monthlyData, isLoading } = trpc.reports.getMonthlyReport.useQuery(params);
  const { data: categories } = trpc.categories.list.useQuery();
  const { data: journalCsvRows } = trpc.reports.exportJournalCsv.useQuery(params);
  const { data: generalLedgerCsvRows } = trpc.reports.exportGeneralLedgerCsv.useQuery(params);
  const { data: yearlyBookRows } = trpc.reports.exportYearlyBookCsv.useQuery({ year: selectedYearNumber });
  const { data: yearlyJournalRows } = trpc.reports.exportYearlyJournalCsv.useQuery({ year: selectedYearNumber });
  const { data: yearlyGeneralLedgerRows } = trpc.reports.exportYearlyGeneralLedgerCsv.useQuery({
    year: selectedYearNumber,
  });
  const { data: filingCheckRows } = trpc.reports.exportFilingCheckCsv.useQuery({ year: selectedYearNumber });
  const { data: finalReviewRows } = trpc.reports.exportFinalReviewCsv.useQuery({ year: selectedYearNumber });

  const handleExportBook = () => {
    if (!monthlyData || !categories) {
      toast.error("データを読み込んでください");
      return;
    }

    const rows: Array<Array<string | number>> = [
      ["確定申告用帳簿"],
      [`${selectedYear}年${selectedMonth}月分`],
      [],
      ["収支概要"],
      ["項目", "金額"],
      ["売上合計", monthlyData.totalSales],
      ["経費合計", monthlyData.totalExpenses],
      ["利益", monthlyData.profit],
      [],
      ["経費明細"],
      ["日付", "摘要", "経費区分", "金額", "備考"],
    ];

    const sortedExpenses = [...monthlyData.expenses].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );

    sortedExpenses.forEach((expense: any) => {
      const category = categories.find((c: any) => c.id === expense.categoryId);
      rows.push([
        new Date(expense.date).toLocaleDateString("ja-JP"),
        expense.description || "（説明なし）",
        category?.name || "不明",
        expense.amount,
        expense.receiptId ? "レシート添付" : "",
      ]);
    });

    rows.push([], ["経費区分別集計"], ["経費区分", "金額", "割合"]);

    const categoryTotals: Record<string, number> = {};
    sortedExpenses.forEach((expense: any) => {
      const category = categories.find((c: any) => c.id === expense.categoryId);
      const name = category?.name || "不明";
      categoryTotals[name] = (categoryTotals[name] || 0) + expense.amount;
    });

    Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .forEach(([name, total]) => {
        const percentage =
          monthlyData.totalExpenses > 0 ? `${((total / monthlyData.totalExpenses) * 100).toFixed(1)}%` : "0.0%";
        rows.push([name, total, percentage]);
      });

    if (monthlyData.sales.length) {
      rows.push([], ["売上明細"], ["日付", "摘要", "金額"]);
      [...monthlyData.sales]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .forEach((sale: any) => {
          rows.push([new Date(sale.date).toLocaleDateString("ja-JP"), sale.description || "（説明なし）", sale.amount]);
        });
    }

    downloadCsv(`確定申告帳簿_${selectedYear}年${selectedMonth}月.csv`, rows);
    toast.success("帳簿CSVをダウンロードしました");
  };

  const handleExportJournal = () => {
    if (!journalCsvRows) {
      toast.error("仕訳データを読み込んでください");
      return;
    }
    downloadCsv(`仕訳帳_${selectedYear}年${selectedMonth}月.csv`, journalCsvRows as Array<Array<string | number>>);
    toast.success("仕訳帳CSVをダウンロードしました");
  };

  const handleExportGeneralLedger = () => {
    if (!generalLedgerCsvRows) {
      toast.error("総勘定元帳データを読み込んでください");
      return;
    }
    downloadCsv(
      `総勘定元帳_${selectedYear}年${selectedMonth}月.csv`,
      generalLedgerCsvRows as Array<Array<string | number>>,
    );
    toast.success("総勘定元帳CSVをダウンロードしました");
  };

  const handleExportYearlyBook = () => {
    if (!yearlyBookRows) {
      toast.error("年次帳簿データを読み込んでください");
      return;
    }
    downloadCsv(`確定申告帳簿_${selectedYear}年_年次.csv`, yearlyBookRows as Array<Array<string | number>>);
    toast.success("年次帳簿CSVをダウンロードしました");
  };

  const handleExportYearlyJournal = () => {
    if (!yearlyJournalRows) {
      toast.error("年次仕訳帳データを読み込んでください");
      return;
    }
    downloadCsv(`仕訳帳_${selectedYear}年_年次.csv`, yearlyJournalRows as Array<Array<string | number>>);
    toast.success("年次仕訳帳CSVをダウンロードしました");
  };

  const handleExportYearlyGeneralLedger = () => {
    if (!yearlyGeneralLedgerRows) {
      toast.error("年次総勘定元帳データを読み込んでください");
      return;
    }
    downloadCsv(
      `総勘定元帳_${selectedYear}年_年次.csv`,
      yearlyGeneralLedgerRows as Array<Array<string | number>>,
    );
    toast.success("年次総勘定元帳CSVをダウンロードしました");
  };

  const handleExportFilingCheck = () => {
    if (!filingCheckRows) {
      toast.error("申告チェックデータを読み込んでください");
      return;
    }
    downloadCsv(`申告チェック_${selectedYear}年.csv`, filingCheckRows as Array<Array<string | number>>);
    toast.success("申告チェックCSVをダウンロードしました");
  };

  const handleExportFinalReview = () => {
    if (!finalReviewRows) {
      toast.error("最終確認データを読み込んでください");
      return;
    }
    downloadCsv(`最終確認_${selectedYear}年.csv`, finalReviewRows as Array<Array<string | number>>);
    toast.success("最終確認CSVをダウンロードしました");
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 5 }, (_, i) => today.getFullYear() - i);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">帳簿生成</h1>
          <p className="mt-2 text-gray-600">確定申告用帳簿、仕訳帳、総勘定元帳を月別に出力できます。</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>期間選択</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="mb-2 block text-sm font-medium">年</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}年
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">月</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {month}月
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleExportBook} disabled={isLoading} className="gap-2">
                <Download className="h-4 w-4" />
                帳簿CSV
              </Button>
              <Button onClick={handleExportJournal} disabled={isLoading} variant="outline" className="gap-2">
                <BookOpenText className="h-4 w-4" />
                仕訳帳CSV
              </Button>
              <Button onClick={handleExportGeneralLedger} disabled={isLoading} variant="outline" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                総勘定元帳CSV
              </Button>
            </div>

            <div className="mt-4 flex flex-wrap items-end gap-4 border-t pt-4">
              <div className="text-sm text-gray-600">年次まとめ</div>
              <Button onClick={handleExportYearlyBook} disabled={isLoading} variant="secondary" className="gap-2">
                <Download className="h-4 w-4" />
                年次帳簿CSV
              </Button>
              <Button onClick={handleExportYearlyJournal} disabled={isLoading} variant="outline" className="gap-2">
                <BookOpenText className="h-4 w-4" />
                年次仕訳帳CSV
              </Button>
              <Button onClick={handleExportYearlyGeneralLedger} disabled={isLoading} variant="outline" className="gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                年次総勘定元帳CSV
              </Button>
              <Button onClick={handleExportFilingCheck} disabled={isLoading} variant="outline" className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                申告チェックCSV
              </Button>
              <Button onClick={handleExportFinalReview} disabled={isLoading} variant="outline" className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                最終確認CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : monthlyData ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">売上合計</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">¥{monthlyData.totalSales.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">経費合計</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">¥{monthlyData.totalExpenses.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">利益</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${monthlyData.profit >= 0 ? "text-blue-600" : "text-red-600"}`}>
                    ¥{monthlyData.profit.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">仕訳件数</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-900">{monthlyData.journalEntries?.length || 0}件</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">要確認</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">{monthlyData.reviewCount || 0}件</div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>科目別サマリー</CardTitle>
                </CardHeader>
                <CardContent>
                  {!monthlyData.journalSummary?.length ? (
                    <p className="text-sm text-gray-500">まだ仕訳がありません。</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b">
                          <tr>
                            <th className="px-3 py-2 text-left">科目</th>
                            <th className="px-3 py-2 text-right">借方</th>
                            <th className="px-3 py-2 text-right">貸方</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyData.journalSummary.map((row: any) => (
                            <tr key={row.accountCode} className="border-b">
                              <td className="px-3 py-2">{row.accountCode} {row.accountName}</td>
                              <td className="px-3 py-2 text-right">¥{row.debit.toLocaleString()}</td>
                              <td className="px-3 py-2 text-right">¥{row.credit.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>当月の記録件数</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 text-sm">
                    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <span>売上件数</span>
                      <span className="font-semibold">{monthlyData.sales.length}件</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <span>経費件数</span>
                      <span className="font-semibold">{monthlyData.expenses.length}件</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <span>レシート起点の仕訳</span>
                      <span className="font-semibold">
                        {monthlyData.journalEntries.filter((entry: any) => entry.sourceType === "receipt_scan").length}件
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                      <span>手動仕訳</span>
                      <span className="font-semibold">
                        {monthlyData.journalEntries.filter((entry: any) => entry.sourceType === "manual").length}件
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
