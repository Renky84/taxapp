import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Sales() {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
  });

  const { data: sales, isLoading, refetch } = trpc.sales.list.useQuery();
  const createMutation = trpc.sales.create.useMutation({
    onSuccess: () => {
      toast.success("売上を追加しました");
      setFormData({ amount: "", description: "", date: new Date().toISOString().split('T')[0] });
      setIsOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "エラーが発生しました");
    },
  });

  const deleteMutation = trpc.sales.delete.useMutation({
    onSuccess: () => {
      toast.success("売上を削除しました");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "エラーが発生しました");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || !formData.date) {
      toast.error("金額と日付を入力してください");
      return;
    }
    createMutation.mutate({
      amount: Math.round(parseFloat(formData.amount) * 100),
      description: formData.description,
      date: formData.date,
    });
  };

  const totalSales = sales?.reduce((sum, s) => sum + s.amount, 0) || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">売上管理</h1>
            <p className="text-gray-600 mt-2">月別の売上を記録・管理します</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                売上を追加
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>売上を追加</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="amount">金額（円）</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="10000"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    step="0.01"
                  />
                </div>
                <div>
                  <Label htmlFor="date">日付</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="description">説明（オプション）</Label>
                  <Input
                    id="description"
                    placeholder="商品販売など"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <Button type="submit" disabled={createMutation.isPending} className="w-full">
                  {createMutation.isPending ? "追加中..." : "追加"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>売上合計</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              ¥{(totalSales / 100).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        {/* Sales List */}
        <Card>
          <CardHeader>
            <CardTitle>売上一覧</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : sales && sales.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-4">日付</th>
                      <th className="text-left py-2 px-4">説明</th>
                      <th className="text-right py-2 px-4">金額</th>
                      <th className="text-right py-2 px-4">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((sale) => (
                      <tr key={sale.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-4">{new Date(sale.date).toLocaleDateString('ja-JP')}</td>
                        <td className="py-2 px-4">{sale.description || "-"}</td>
                        <td className="text-right py-2 px-4 font-semibold">¥{(sale.amount / 100).toLocaleString()}</td>
                        <td className="text-right py-2 px-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteMutation.mutate({ id: sale.id })}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                売上がありません
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
