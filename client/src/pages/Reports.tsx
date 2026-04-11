import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, Download } from "lucide-react";
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Reports() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());

  const { data: monthlyData, isLoading } = trpc.reports.getMonthlyReport.useQuery({
    year: parseInt(selectedYear),
    month: parseInt(selectedMonth),
  });

  const { data: categories } = trpc.categories.list.useQuery();

  const handleExportExcel = () => {
    if (!monthlyData || !categories) {
      toast.error("データを読み込んでください");
      return;
    }

    // 税務署提出用の帳簿形式
    // UTF-8 BOMを付加して文字化けを防ぐ
    const BOM = "\uFEFF";
    
    const csvRows = [
      ["確定申告用帳簿"],
      [`${selectedYear}年${selectedMonth}月分`],
      [],
      ["■ 収支概要"],
      ["項目", "金額"],
      ["売上合計", `¥${monthlyData.totalSales.toLocaleString()}`],
      ["経費合計", `¥${monthlyData.totalExpenses.toLocaleString()}`],
      ["利益", `¥${monthlyData.profit.toLocaleString()}`],
      [],
      ["■ 経費明細"],
      ["日付", "摘要", "経費区分", "金額", "備考"],
    ];

    // 経費を日付順にソート
    const sortedExpenses = [...monthlyData.expenses].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    sortedExpenses.forEach((expense: any) => {
      const category = categories.find(c => c.id === expense.categoryId);
      const date = new Date(expense.date);
      const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
      
      csvRows.push([
        dateStr,
        expense.description || "（説明なし）",
        category?.name || "不明",
        `¥${expense.amount.toLocaleString()}`,
        expense.receiptId ? "レシート添付" : ""
      ]);
    });

    // 経費区分別集計
    csvRows.push([]);
    csvRows.push(["■ 経費区分別集計"]);
    csvRows.push(["経費区分", "金額", "割合"]);

    const categoryTotals: { [key: string]: number } = {};
    sortedExpenses.forEach((expense: any) => {
      const category = categories.find(c => c.id === expense.categoryId);
      const categoryName = category?.name || "不明";
      categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + expense.amount;
    });

    Object.entries(categoryTotals)
      .sort((a, b) => b[1] - a[1])
      .forEach(([categoryName, total]) => {
        const percentage = monthlyData.totalExpenses > 0 
          ? ((total / monthlyData.totalExpenses) * 100).toFixed(1)
          : "0.0";
        csvRows.push([
          categoryName,
          `¥${total.toLocaleString()}`,
          `${percentage}%`
        ]);
      });

    // 売上明細
    if (monthlyData.sales && monthlyData.sales.length > 0) {
      csvRows.push([]);
      csvRows.push(["■ 売上明細"]);
      csvRows.push(["日付", "摘要", "金額"]);

      const sortedSales = [...monthlyData.sales].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      sortedSales.forEach((sale: any) => {
        const date = new Date(sale.date);
        const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
        
        csvRows.push([
          dateStr,
          sale.description || "（説明なし）",
          `¥${sale.amount.toLocaleString()}`
        ]);
      });
    }

    // CSVフォーマットに変換（カンマ区切り、ダブルクォートでエスケープ）
    const csvContent = BOM + csvRows.map(row => 
      row.map(cell => {
        const cellStr = String(cell);
        // カンマや改行を含む場合はダブルクォートで囲む
        if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    ).join('\n');

    // Excelで開けるようにUTF-8 BOM付きで保存
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `確定申告帳簿_${selectedYear}年${selectedMonth}月.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success("帳簿をダウンロードしました");
  };

  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">帳簿生成</h1>
          <p className="text-gray-600 mt-2">確定申告用の帳簿を生成・ダウンロード（Excel対応）</p>
        </div>

        {/* Month/Year Selection */}
        <Card>
          <CardHeader>
            <CardTitle>期間選択</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-2">年</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}年
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">月</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month} value={month.toString()}>
                        {month}月
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleExportExcel} disabled={isLoading} className="gap-2">
                <Download className="w-4 h-4" />
                Excelで帳簿をダウンロード
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Statement */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : monthlyData ? (
          <div className="space-y-4">
            {/* Summary Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">売上合計</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    ¥{monthlyData.totalSales.toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">経費合計</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-600">
                    ¥{monthlyData.totalExpenses.toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">利益</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${monthlyData.profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                    ¥{monthlyData.profit.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Expense Details */}
            <Card>
              <CardHeader>
                <CardTitle>経費明細</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-2 px-4">日付</th>
                        <th className="text-left py-2 px-4">摘要</th>
                        <th className="text-left py-2 px-4">経費区分</th>
                        <th className="text-right py-2 px-4">金額</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...monthlyData.expenses]
                        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                        .map((expense: any) => {
                          const category = categories?.find(c => c.id === expense.categoryId);
                          return (
                            <tr key={expense.id} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-4">
                                {new Date(expense.date).toLocaleDateString('ja-JP')}
                              </td>
                              <td className="py-2 px-4">{expense.description || "（説明なし）"}</td>
                              <td className="py-2 px-4">{category?.name || "不明"}</td>
                              <td className="text-right py-2 px-4 font-semibold">
                                ¥{expense.amount.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>経費区分別集計</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-2 px-4">経費区分</th>
                        <th className="text-right py-2 px-4">金額</th>
                        <th className="text-right py-2 px-4">割合</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const categoryTotals: { [key: string]: number } = {};
                        monthlyData.expenses.forEach((expense: any) => {
                          const category = categories?.find(c => c.id === expense.categoryId);
                          const categoryName = category?.name || "不明";
                          categoryTotals[categoryName] = (categoryTotals[categoryName] || 0) + expense.amount;
                        });
                        
                        return Object.entries(categoryTotals)
                          .sort((a, b) => b[1] - a[1])
                          .map(([categoryName, total]) => (
                            <tr key={categoryName} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-4">{categoryName}</td>
                              <td className="text-right py-2 px-4 font-semibold">
                                ¥{total.toLocaleString()}
                              </td>
                              <td className="text-right py-2 px-4 text-gray-600">
                                {monthlyData.totalExpenses > 0
                                  ? ((total / monthlyData.totalExpenses) * 100).toFixed(1)
                                  : 0}%
                              </td>
                            </tr>
                          ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Sales Details */}
            {monthlyData.sales && monthlyData.sales.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>売上明細</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-2 px-4">日付</th>
                          <th className="text-left py-2 px-4">摘要</th>
                          <th className="text-right py-2 px-4">金額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...monthlyData.sales]
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .map((sale: any) => (
                            <tr key={sale.id} className="border-b hover:bg-gray-50">
                              <td className="py-2 px-4">
                                {new Date(sale.date).toLocaleDateString('ja-JP')}
                              </td>
                              <td className="py-2 px-4">{sale.description || "（説明なし）"}</td>
                              <td className="text-right py-2 px-4 font-semibold">
                                ¥{sale.amount.toLocaleString()}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>統計情報</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">売上件数</p>
                    <p className="text-2xl font-bold">{monthlyData.sales?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">経費件数</p>
                    <p className="text-2xl font-bold">{monthlyData.expenses?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">利益率</p>
                    <p className="text-2xl font-bold">
                      {monthlyData.totalSales > 0
                        ? ((monthlyData.profit / monthlyData.totalSales) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">経費率</p>
                    <p className="text-2xl font-bold">
                      {monthlyData.totalSales > 0
                        ? ((monthlyData.totalExpenses / monthlyData.totalSales) * 100).toFixed(1)
                        : 0}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
