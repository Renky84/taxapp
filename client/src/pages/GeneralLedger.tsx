import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Loader2, BookCopy } from "lucide-react";
import { useMemo, useState } from "react";

export default function GeneralLedger() {
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(String(today.getMonth() + 1));
  const params = useMemo(() => ({ year: Number(selectedYear), month: Number(selectedMonth) }), [selectedYear, selectedMonth]);
  const { data, isLoading } = trpc.journal.generalLedger.useQuery(params);

  const years = Array.from({ length: 5 }, (_, i) => String(today.getFullYear() - i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">総勘定元帳</h1>
          <p className="text-gray-600 mt-2">月ごとの勘定科目別の動きを確認できます。</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>対象月</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap items-end">
              <div>
                <label className="block text-sm font-medium mb-2">年</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map(year => <SelectItem key={year} value={year}>{year}年</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">月</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>{months.map(month => <SelectItem key={month} value={month}>{month}月</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : !data?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">この月の総勘定元帳データはまだありません。</CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {data.map((ledger) => (
              <Card key={`${ledger.accountCode}-${ledger.accountName}`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BookCopy className="w-5 h-5" />
                    {ledger.accountCode} {ledger.accountName}
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    借方合計 ¥{ledger.debitTotal.toLocaleString()} / 貸方合計 ¥{ledger.creditTotal.toLocaleString()} / 月末残高 ¥{ledger.balance.toLocaleString()}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-2 px-3">日付</th>
                          <th className="text-left py-2 px-3">摘要</th>
                          <th className="text-left py-2 px-3">相手科目</th>
                          <th className="text-left py-2 px-3">借貸</th>
                          <th className="text-right py-2 px-3">金額</th>
                          <th className="text-right py-2 px-3">残高</th>
                          <th className="text-left py-2 px-3">メモ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ledger.lines.map((line) => (
                          <tr key={`${ledger.accountCode}-${line.journalEntryId}-${line.side}-${line.amount}-${line.memo ?? ''}`} className="border-b last:border-b-0">
                            <td className="py-2 px-3">{new Date(line.entryDate).toLocaleDateString("ja-JP")}</td>
                            <td className="py-2 px-3">{line.description || '-'}</td>
                            <td className="py-2 px-3">{line.counterAccount || '-'}</td>
                            <td className="py-2 px-3">{line.side === 'debit' ? '借方' : '貸方'}</td>
                            <td className="py-2 px-3 text-right">¥{line.amount.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right">¥{line.runningBalance.toLocaleString()}</td>
                            <td className="py-2 px-3 text-gray-600">{line.memo || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
