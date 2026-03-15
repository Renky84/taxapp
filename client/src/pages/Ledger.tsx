import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, RefreshCw, BookOpenText } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export default function Ledger() {
  const utils = trpc.useUtils();
  const today = new Date();
  const [selectedYear, setSelectedYear] = useState(today.getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((today.getMonth() + 1).toString());
  const [entryDate, setEntryDate] = useState(today.toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [debitAccountCode, setDebitAccountCode] = useState("521");
  const [creditAccountCode, setCreditAccountCode] = useState("111");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");

  const params = useMemo(() => ({
    year: Number(selectedYear),
    month: Number(selectedMonth),
  }), [selectedYear, selectedMonth]);

  const { data: accounts } = trpc.journal.accounts.useQuery();
  const { data: entries, isLoading } = trpc.journal.list.useQuery(params);
  const { data: summary, isLoading: summaryLoading } = trpc.journal.summary.useQuery(params);

  const createManual = trpc.journal.createManual.useMutation({
    onSuccess: async () => {
      toast.success("手動仕訳を登録しました");
      setDescription("");
      setAmount("");
      setMemo("");
      await utils.journal.list.invalidate(params);
      await utils.journal.summary.invalidate(params);
      await utils.reports.getMonthlyReport.invalidate(params);
    },
    onError: (error) => {
      toast.error(error.message || "仕訳の登録に失敗しました");
    }
  });

  const syncCurrentMonth = trpc.journal.syncCurrentMonth.useMutation({
    onSuccess: async (result) => {
      toast.success(`売上・経費から ${result.createdCount} 件の仕訳を補完しました`);
      await utils.journal.list.invalidate(params);
      await utils.journal.summary.invalidate(params);
      await utils.reports.getMonthlyReport.invalidate(params);
    },
    onError: (error) => {
      toast.error(error.message || "仕訳補完に失敗しました");
    }
  });

  const handleCreateManual = async () => {
    if (!description.trim()) {
      toast.error("摘要を入力してください");
      return;
    }
    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      toast.error("金額を入力してください");
      return;
    }

    await createManual.mutateAsync({
      entryDate,
      description,
      debitAccountCode,
      creditAccountCode,
      amount: numericAmount,
      memo: memo || undefined,
    });
  };

  const years = Array.from({ length: 5 }, (_, i) => (today.getFullYear() - i).toString());
  const months = Array.from({ length: 12 }, (_, i) => (i + 1).toString());

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">仕訳帳</h1>
            <p className="text-gray-600 mt-2">売上・経費から自動生成された仕訳と、手動仕訳を確認できます。</p>
          </div>
          <Button
            onClick={() => syncCurrentMonth.mutate(params)}
            disabled={syncCurrentMonth.isPending}
            className="gap-2"
            variant="outline"
          >
            {syncCurrentMonth.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            売上・経費から仕訳を補完
          </Button>
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
                  <SelectContent>
                    {years.map(year => <SelectItem key={year} value={year}>{year}年</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">月</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {months.map(month => <SelectItem key={month} value={month}>{month}月</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">借方合計</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">¥{summary?.totals.debit.toLocaleString() || "0"}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">貸方合計</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">¥{summary?.totals.credit.toLocaleString() || "0"}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">仕訳件数</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{entries?.length || 0}件</div></CardContent>
          </Card>
        </div>

        <div className="grid xl:grid-cols-[1.1fr_1.4fr] gap-6">
          <Card>
            <CardHeader>
              <CardTitle>手動仕訳を追加</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">日付</label>
                <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">摘要</label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="例: LANケーブル購入" />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">借方</label>
                  <Select value={debitAccountCode} onValueChange={setDebitAccountCode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {accounts?.map(account => (
                        <SelectItem key={account.code} value={account.code}>{account.code} {account.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">貸方</label>
                  <Select value={creditAccountCode} onValueChange={setCreditAccountCode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {accounts?.map(account => (
                        <SelectItem key={account.code} value={account.code}>{account.code} {account.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">金額</label>
                <Input type="number" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="1320" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">メモ</label>
                <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="任意。補足を残せます。" />
              </div>
              <Button onClick={handleCreateManual} disabled={createManual.isPending} className="w-full gap-2">
                {createManual.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                手動仕訳を登録
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BookOpenText className="w-5 h-5" /> 科目別集計</CardTitle>
              </CardHeader>
              <CardContent>
                {summaryLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                ) : !summary?.rows.length ? (
                  <p className="text-sm text-gray-500">まだ仕訳がありません。</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="border-b">
                        <tr>
                          <th className="text-left py-2 px-3">科目</th>
                          <th className="text-right py-2 px-3">借方</th>
                          <th className="text-right py-2 px-3">貸方</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.rows.map((row) => (
                          <tr key={row.accountCode} className="border-b">
                            <td className="py-2 px-3">{row.accountCode} {row.accountName}</td>
                            <td className="py-2 px-3 text-right">¥{row.debit.toLocaleString()}</td>
                            <td className="py-2 px-3 text-right">¥{row.credit.toLocaleString()}</td>
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
                <CardTitle>仕訳一覧</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
                ) : !entries?.length ? (
                  <p className="text-sm text-gray-500">この月の仕訳はまだありません。</p>
                ) : (
                  <div className="space-y-4">
                    {entries.map((entry) => (
                      <div key={entry.id} className="rounded-lg border p-4 space-y-3">
                        <div className="flex justify-between gap-3 flex-wrap">
                          <div>
                            <p className="font-semibold text-gray-900">{entry.description || "仕訳"}</p>
                            <p className="text-xs text-gray-500">{new Date(entry.entryDate).toLocaleDateString("ja-JP")} / {entry.sourceType} / {entry.status}</p>
                          </div>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b">
                              <tr>
                                <th className="text-left py-2 px-3">区分</th>
                                <th className="text-left py-2 px-3">科目</th>
                                <th className="text-right py-2 px-3">金額</th>
                                <th className="text-left py-2 px-3">メモ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {entry.lines.map((line) => (
                                <tr key={line.id} className="border-b last:border-b-0">
                                  <td className="py-2 px-3">{line.side === "debit" ? "借方" : "貸方"}</td>
                                  <td className="py-2 px-3">{line.accountCode} {line.accountName}</td>
                                  <td className="py-2 px-3 text-right">¥{line.amount.toLocaleString()}</td>
                                  <td className="py-2 px-3 text-gray-600">{line.memo || "-"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
