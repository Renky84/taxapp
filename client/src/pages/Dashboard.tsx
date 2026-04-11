import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Loader2, Receipt, TrendingUp, FileText, Camera, Calendar, Clock } from "lucide-react";
import { useState } from "react";

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const [selectedYear] = useState(new Date().getFullYear());
  const [selectedMonth] = useState(new Date().getMonth() + 1);

  const { data: monthlyData, isLoading: monthlyLoading } = trpc.reports.getMonthlyReport.useQuery({
    year: selectedYear,
    month: selectedMonth,
  });

  const { data: recentReceipts } = trpc.receipts.list.useQuery({ limit: 5 });
  const { data: profile } = trpc.profile.get.useQuery();

  // 確定申告期限までの残り日数を計算
  const daysUntilDeadline = profile?.taxFilingDeadline
    ? Math.ceil((new Date(profile.taxFilingDeadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{selectedYear}年 確定申告ダッシュボード</h1>
          <p className="text-gray-600 mt-2">売上と経費の概要を確認できます</p>
        </div>

        {/* 確定申告期限カウントダウン */}
        {daysUntilDeadline !== null && (
          <Card className={`border-2 ${
            daysUntilDeadline <= 30 ? 'border-red-500 bg-red-50' :
            daysUntilDeadline <= 60 ? 'border-yellow-500 bg-yellow-50' :
            'border-blue-500 bg-blue-50'
          }`}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className={`w-8 h-8 ${
                    daysUntilDeadline <= 30 ? 'text-red-600' :
                    daysUntilDeadline <= 60 ? 'text-yellow-600' :
                    'text-blue-600'
                  }`} />
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">確定申告期限まで</h3>
                    <p className="text-sm text-gray-600">
                      {profile?.taxFilingDeadline ? new Date(profile.taxFilingDeadline).toLocaleDateString('ja-JP') : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-4xl font-bold ${
                    daysUntilDeadline <= 30 ? 'text-red-600' :
                    daysUntilDeadline <= 60 ? 'text-yellow-600' :
                    'text-blue-600'
                  }`}>
                    {daysUntilDeadline}
                  </div>
                  <div className="text-sm text-gray-600">日</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* クイックアクセスメニュー */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/sales" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 text-center">
                <TrendingUp className="w-12 h-12 mx-auto mb-2 text-blue-600" />
                <h3 className="font-semibold text-gray-900">売上登録</h3>
              </CardContent>
            </Card>
          </a>
          <a href="/receipt-scan" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 text-center">
                <Camera className="w-12 h-12 mx-auto mb-2 text-green-600" />
                <h3 className="font-semibold text-gray-900">レシートスキャン</h3>
              </CardContent>
            </Card>
          </a>
          <a href="/expenses" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 text-center">
                <Receipt className="w-12 h-12 mx-auto mb-2 text-red-600" />
                <h3 className="font-semibold text-gray-900">経費一覧</h3>
              </CardContent>
            </Card>
          </a>
          <a href="/reports" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 text-center">
                <FileText className="w-12 h-12 mx-auto mb-2 text-purple-600" />
                <h3 className="font-semibold text-gray-900">帳簿生成</h3>
              </CardContent>
            </Card>
          </a>
        </div>

        {/* Monthly Summary Cards */}
        {monthlyLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : monthlyData ? (
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {selectedMonth}月売上
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">
                  ¥{((monthlyData.totalSales || 0) / 100).toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {selectedMonth}月経費
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  ¥{((monthlyData.totalExpenses || 0) / 100).toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {selectedMonth}月利益
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${(monthlyData.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ¥{((monthlyData.profit || 0) / 100).toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  利益率
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {(monthlyData.totalSales || 0) > 0 ? (((monthlyData.profit || 0) / (monthlyData.totalSales || 0)) * 100).toFixed(1) : 0}%
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* 最近のレシート */}
        {recentReceipts && recentReceipts.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                最近のレシート
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recentReceipts.map((receipt: any) => (
                  <a
                    key={receipt.id}
                    href={`/receipts`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center">
                        <Receipt className="w-6 h-6 text-gray-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{receipt.storeName || '店舗名不明'}</div>
                        <div className="text-sm text-gray-600">
                          {receipt.purchaseDate ? new Date(receipt.purchaseDate).toLocaleDateString('ja-JP') : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        ¥{((receipt.totalAmount || 0) / 100).toLocaleString()}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Sales and Expenses Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>{selectedMonth}月 売上・経費比較</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : monthlyData ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    { name: '売上', value: (monthlyData.totalSales || 0) / 100 },
                    { name: '経費', value: (monthlyData.totalExpenses || 0) / 100 },
                    { name: '利益', value: (monthlyData.profit || 0) / 100 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => `¥${value.toLocaleString()}`} />
                    <Bar dataKey="value" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </CardContent>
          </Card>

          {/* Monthly Expense Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>{selectedMonth}月 経費内訳</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : monthlyData && monthlyData.expenses && monthlyData.expenses.length > 0 ? (
                <div className="space-y-2">
                  {monthlyData.expenses.map((expense: any, index: number) => (
                    <div key={expense.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <span className="text-sm text-gray-600">{expense.description}</span>
                      <span className="text-sm font-semibold">¥{(expense.amount / 100).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  経費データがありません
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sales and Expenses List */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Sales List */}
          <Card>
            <CardHeader>
              <CardTitle>{selectedMonth}月 売上一覧</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : monthlyData && monthlyData.sales && monthlyData.sales.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {monthlyData.sales.map((sale: any) => (
                    <div key={sale.id} className="flex justify-between items-center p-2 bg-blue-50 rounded">
                      <span className="text-sm text-gray-700">{sale.description}</span>
                      <span className="text-sm font-semibold text-blue-600">¥{(sale.amount / 100).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  売上データがありません
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expenses List */}
          <Card>
            <CardHeader>
              <CardTitle>{selectedMonth}月 経費一覧</CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : monthlyData && monthlyData.expenses && monthlyData.expenses.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {monthlyData.expenses.map((expense: any) => (
                    <div key={expense.id} className="flex justify-between items-center p-2 bg-red-50 rounded">
                      <span className="text-sm text-gray-700">{expense.description}</span>
                      <span className="text-sm font-semibold text-red-600">¥{(expense.amount / 100).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  経費データがありません
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
