import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Camera, FileText, Receipt, TrendingUp, FileBarChart, User, Loader2, Clock, ShieldCheck, Briefcase, HardDrive, Rocket, Stethoscope } from "lucide-react";
import { useLocation } from "wouter";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { useState } from "react";

export default function Home() {
  const { user, loading } = useAuth();
  const [, setLocation] = useLocation();
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="bg-blue-100 p-4 rounded-full">
                <Receipt className="w-12 h-12 text-blue-600" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">確定申告アプリ</h1>
            <p className="text-gray-600">
              レシート管理から帳簿作成まで、確定申告に必要な機能をすべて提供します
            </p>
          </div>
          <div className="space-y-3">
            <Button
              onClick={() => setLocation("/login")}
              size="lg"
              className="w-full text-lg py-6"
            >
              ログイン
            </Button>
            <Button
              onClick={() => setLocation("/register")}
              variant="outline"
              size="lg"
              className="w-full text-lg py-6"
            >
              新規登録
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ログイン後はダッシュボードを表示
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
        <div className="grid grid-cols-2 md:grid-cols-9 gap-4">
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
          <a href="/monthly-close" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 text-center">
                <Clock className="w-12 h-12 mx-auto mb-2 text-amber-600" />
                <h3 className="font-semibold text-gray-900">月次締め</h3>
              </CardContent>
            </Card>
          </a>
          <a href="/final-review" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 text-center">
                <ShieldCheck className="w-12 h-12 mx-auto mb-2 text-emerald-600" />
                <h3 className="font-semibold text-gray-900">最終確認</h3>
              </CardContent>
            </Card>
          </a>
          <a href="/submission-pack" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 text-center">
                <Briefcase className="w-12 h-12 mx-auto mb-2 text-sky-700" />
                <h3 className="font-semibold text-gray-900">申告準備パック</h3>
              </CardContent>
            </Card>
          </a>
          <a href="/operations-setup" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 text-center">
                <HardDrive className="w-12 h-12 mx-auto mb-2 text-slate-700" />
                <h3 className="font-semibold text-gray-900">運用準備</h3>
              </CardContent>
            </Card>
          </a>
          <a href="/go-live-checklist" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 text-center">
                <Rocket className="w-12 h-12 mx-auto mb-2 text-indigo-700" />
                <h3 className="font-semibold text-gray-900">公開前チェック</h3>
              </CardContent>
            </Card>
          </a>
          <a href="/deployment-diagnostics" className="block">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="pt-6 text-center">
                <Stethoscope className="w-12 h-12 mx-auto mb-2 text-cyan-700" />
                <h3 className="font-semibold text-gray-900">起動診断</h3>
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
                  ¥{((monthlyData.totalSales || 0) ).toLocaleString()}
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
                  ¥{((monthlyData.totalExpenses || 0) ).toLocaleString()}
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
                  ¥{((monthlyData.profit || 0) ).toLocaleString()}
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
                        ¥{((receipt.totalAmount || 0) ).toLocaleString()}
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
                    { name: '売上', value: (monthlyData.totalSales || 0)  },
                    { name: '経費', value: (monthlyData.totalExpenses || 0)  },
                    { name: '利益', value: (monthlyData.profit || 0) }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip formatter={(value: any) => `¥${value.toLocaleString()}`} />
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
                      <span className="text-sm font-semibold">¥{(expense.amount ).toLocaleString()}</span>
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
                      <span className="text-sm font-semibold text-blue-600">¥{(sale.amount ).toLocaleString()}</span>
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
                      <span className="text-sm font-semibold text-red-600">¥{(expense.amount ).toLocaleString()}</span>
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
