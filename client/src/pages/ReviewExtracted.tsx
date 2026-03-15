import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Loader2, ReceiptText, ShieldAlert, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type DraftState = {
  categoryId?: string;
  amount?: string;
  description?: string;
  date?: string;
};

export default function ReviewExtracted() {
  const utils = trpc.useUtils();
  const { data: queue, isLoading } = trpc.receipts.reviewQueue.useQuery();
  const { data: categories } = trpc.categories.list.useQuery();
  const [drafts, setDrafts] = useState<Record<number, DraftState>>({});

  const approveMutation = trpc.receipts.approveReview.useMutation({
    onSuccess: async () => {
      toast.success("帳簿に登録しました");
      await utils.receipts.reviewQueue.invalidate();
      await utils.expenses.list.invalidate();
      await utils.journal.list.invalidate();
      await utils.journal.summary.invalidate();
    },
    onError: (error) => toast.error(error.message || "登録に失敗しました"),
  });

  const rejectMutation = trpc.receipts.rejectReview.useMutation({
    onSuccess: async () => {
      toast.success("要確認キューから外しました");
      await utils.receipts.reviewQueue.invalidate();
    },
    onError: (error) => toast.error(error.message || "却下に失敗しました"),
  });

  const pendingCount = queue?.length || 0;
  const highRiskCount = useMemo(
    () => (queue || []).filter((item: any) => (item.confidence || 0) < 80).length,
    [queue],
  );

  const getDraft = (item: any): DraftState => ({
    categoryId: drafts[item.id]?.categoryId ?? String(item.categoryId || ""),
    amount: drafts[item.id]?.amount ?? String(item.amount || item.detail?.totalAmount || 0),
    description: drafts[item.id]?.description ?? item.description ?? `${item.detail?.storeName || ""}`.trim(),
    date:
      drafts[item.id]?.date ??
      (item.date ? new Date(item.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]),
  });

  const updateDraft = (item: any, patch: DraftState) => {
    setDrafts((prev) => ({
      ...prev,
      [item.id]: {
        ...getDraft(item),
        ...prev[item.id],
        ...patch,
      },
    }));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">要確認書類</h1>
          <p className="mt-2 text-gray-600">
            AIが読み取ったレシート・請求書の結果を確認して、そのまま経費と仕訳に登録できます。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">未確認書類</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}件</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">低信頼度</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{highRiskCount}件</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">処理内容</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-gray-600">承認すると経費登録と仕訳作成まで進みます。</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>レビューキュー</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : !queue?.length ? (
              <div className="py-10 text-center text-gray-500">未確認の書類はありません。</div>
            ) : (
              <div className="space-y-6">
                {queue.map((item: any) => {
                  const draft = getDraft(item);

                  return (
                    <div key={item.id} className="space-y-4 rounded-xl border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <ReceiptText className="h-5 w-5 text-slate-600" />
                            <p className="text-lg font-semibold">{item.detail?.storeName || item.receiptFileName || "レシート"}</p>
                            <span
                              className={`rounded-full px-2 py-1 text-xs ${
                                (item.confidence || 0) < 80
                                  ? "bg-amber-100 text-amber-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              信頼度 {item.confidence || 0}%
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-gray-500">
                            {item.receiptFileName || "画像"} / {draft.date}
                          </p>
                          {!!item.duplicateCandidates?.length && (
                            <p className="mt-2 text-sm text-amber-700">
                              同日・同額の経費が {item.duplicateCandidates.length} 件見つかりました。二重登録の可能性があります。
                            </p>
                          )}
                        </div>

                        {(item.confidence || 0) < 80 && (
                          <div className="flex items-center gap-2 text-sm text-amber-700">
                            <ShieldAlert className="h-4 w-4" />
                            誤読の可能性があります
                          </div>
                        )}
                      </div>

                      {item.receiptFileUrl &&
                        (String(item.receiptMimeType || "").includes("pdf") ||
                        String(item.receiptFileName || "").toLowerCase().endsWith(".pdf") ? (
                          <iframe
                            src={item.receiptFileUrl}
                            title={item.receiptFileName || "document"}
                            className="h-[520px] w-full max-w-3xl rounded-lg border bg-slate-50"
                          />
                        ) : (
                          <img
                            src={item.receiptFileUrl}
                            alt={item.receiptFileName || "receipt"}
                            className="w-full max-w-md rounded-lg border bg-slate-50 object-contain"
                          />
                        ))}

                      <div className="grid gap-6 lg:grid-cols-2">
                        <div className="space-y-3">
                          <div>
                            <Label>推奨カテゴリ</Label>
                            <Select value={draft.categoryId} onValueChange={(value) => updateDraft(item, { categoryId: value })}>
                              <SelectTrigger>
                                <SelectValue placeholder="カテゴリを選択" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories?.map((category: any) => (
                                  <SelectItem key={category.id} value={String(category.id)}>
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>金額</Label>
                            <Input type="number" value={draft.amount} onChange={(e) => updateDraft(item, { amount: e.target.value })} />
                          </div>
                          <div>
                            <Label>日付</Label>
                            <Input type="date" value={draft.date} onChange={(e) => updateDraft(item, { date: e.target.value })} />
                          </div>
                          <div>
                            <Label>摘要</Label>
                            <Textarea
                              value={draft.description}
                              onChange={(e) => updateDraft(item, { description: e.target.value })}
                              rows={4}
                            />
                          </div>
                        </div>

                        <div className="space-y-4">
                          {!!item.duplicateCandidates?.length && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                              <p className="font-medium text-amber-800">重複候補</p>
                              <div className="mt-2 space-y-2 text-sm text-amber-900">
                                {item.duplicateCandidates.map((candidate: any) => (
                                  <div key={candidate.id} className="rounded-md border border-amber-200 bg-white px-3 py-2">
                                    <div>
                                      #{candidate.id} / {new Date(candidate.date).toISOString().split("T")[0]} / ¥
                                      {Number(candidate.amount || 0).toLocaleString()}
                                    </div>
                                    <div className="text-amber-700">{candidate.description || "摘要なし"}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <p className="mb-2 font-medium">読み取り明細</p>
                            <div className="overflow-hidden rounded-lg border">
                              <table className="w-full text-sm">
                                <thead className="border-b bg-slate-50">
                                  <tr>
                                    <th className="px-3 py-2 text-left">品目</th>
                                    <th className="px-3 py-2 text-right">数量</th>
                                    <th className="px-3 py-2 text-right">金額</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(item.lineItems || []).map((line: any) => (
                                    <tr key={line.id} className="border-b last:border-b-0">
                                      <td className="px-3 py-2">{line.itemName}</td>
                                      <td className="px-3 py-2 text-right">{line.quantity}</td>
                                      <td className="px-3 py-2 text-right">¥{Number(line.totalPrice || 0).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          onClick={() => rejectMutation.mutate({ extractedExpenseId: item.id })}
                          disabled={rejectMutation.isPending}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          却下
                        </Button>
                        <Button
                          onClick={() =>
                            approveMutation.mutate({
                              extractedExpenseId: item.id,
                              categoryId: Number(draft.categoryId),
                              amount: Number(draft.amount),
                              description: draft.description,
                              date: draft.date,
                            })
                          }
                          disabled={approveMutation.isPending || !draft.categoryId || !draft.amount || !draft.description}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          帳簿に登録
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
