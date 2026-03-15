import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Trash2, Edit2, Undo2 } from "lucide-react";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function Expenses() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [formData, setFormData] = useState({
    categoryId: "",
    amount: "",
    description: "",
    date: new Date().toISOString().split('T')[0],
  });

  const { data: expenses, isLoading, refetch } = trpc.expenses.list.useQuery();
  const { data: categories } = trpc.categories.list.useQuery();
  
  const createMutation = trpc.expenses.create.useMutation({
    onSuccess: () => {
      toast.success("経費を追加しました");
      setFormData({ categoryId: "", amount: "", description: "", date: new Date().toISOString().split('T')[0] });
      setIsCreateOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "エラーが発生しました");
    },
  });

  const updateMutation = trpc.expenses.update.useMutation({
    onSuccess: () => {
      toast.success("経費を更新しました");
      setEditingExpense(null);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "エラーが発生しました");
    },
  });

  const deleteMutation = trpc.expenses.delete.useMutation({
    onSuccess: () => {
      toast.success("経費を削除しました");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "エラーが発生しました");
    },
  });

  const restoreMutation = trpc.expenses.restore.useMutation({
    onSuccess: () => {
      toast.success("経費を復旧しました");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "エラーが発生しました");
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.categoryId || !formData.amount || !formData.date) {
      toast.error("カテゴリ、金額、日付を入力してください");
      return;
    }
    createMutation.mutate({
      categoryId: parseInt(formData.categoryId),
      amount: parseFloat(formData.amount),
      description: formData.description,
      date: formData.date,
    });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    
    updateMutation.mutate({
      id: editingExpense.id,
      categoryId: editingExpense.categoryId,
      amount: editingExpense.amount,
      description: editingExpense.description,
      date: editingExpense.date,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("この経費を削除してもよろしいですか？")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleRestore = (id: number) => {
    if (confirm("この経費を復旧してもよろしいですか？")) {
      restoreMutation.mutate({ id });
    }
  };

  const openEditDialog = (expense: any) => {
    setEditingExpense({
      id: expense.id,
      categoryId: expense.categoryId,
      amount: expense.amount,
      description: expense.description || "",
      date: expense.date,
    });
  };

  // 月ごとにグループ化
  const expensesByMonth = useMemo(() => {
    if (!expenses) return {};
    
    const filtered = showDeleted 
      ? expenses.filter((e: any) => e.isDeleted)
      : expenses.filter((e: any) => !e.isDeleted);
    
    const grouped: { [key: string]: any[] } = {};
    
    filtered.forEach((expense: any) => {
      const date = new Date(expense.date);
      const monthKey = `${date.getFullYear()}年${date.getMonth() + 1}月`;
      
      if (!grouped[monthKey]) {
        grouped[monthKey] = [];
      }
      grouped[monthKey].push(expense);
    });
    
    // 各月の経費を日付順にソート
    Object.keys(grouped).forEach(month => {
      grouped[month].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });
    
    return grouped;
  }, [expenses, showDeleted]);

  // 月のキーを新しい順にソート
  const sortedMonths = useMemo(() => {
    return Object.keys(expensesByMonth).sort((a, b) => {
      const [yearA, monthA] = a.replace('年', '-').replace('月', '').split('-').map(Number);
      const [yearB, monthB] = b.replace('年', '-').replace('月', '').split('-').map(Number);
      return yearB * 12 + monthB - (yearA * 12 + monthA);
    });
  }, [expensesByMonth]);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">経費管理</h1>
            <p className="text-muted-foreground mt-1">月別の経費一覧</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={showDeleted ? "default" : "outline"}
              onClick={() => setShowDeleted(!showDeleted)}
            >
              {showDeleted ? "通常表示" : "削除済み表示"}
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  経費を追加
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>経費を追加</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <Label htmlFor="category">カテゴリ</Label>
                    <Select
                      value={formData.categoryId}
                      onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="カテゴリを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="amount">金額</Label>
                    <Input
                      id="amount"
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="1000"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">説明</Label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="経費の説明"
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
                  <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "追加中..." : "追加"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* 編集ダイアログ */}
        <Dialog open={!!editingExpense} onOpenChange={(open) => !open && setEditingExpense(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>経費を編集</DialogTitle>
            </DialogHeader>
            {editingExpense && (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <Label htmlFor="edit-category">カテゴリ</Label>
                  <Select
                    value={editingExpense.categoryId.toString()}
                    onValueChange={(value) => setEditingExpense({ ...editingExpense, categoryId: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((category) => (
                        <SelectItem key={category.id} value={category.id.toString()}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit-amount">金額</Label>
                  <Input
                    id="edit-amount"
                    type="number"
                    value={editingExpense.amount}
                    onChange={(e) => setEditingExpense({ ...editingExpense, amount: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-description">説明</Label>
                  <Input
                    id="edit-description"
                    value={editingExpense.description}
                    onChange={(e) => setEditingExpense({ ...editingExpense, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-date">日付</Label>
                  <Input
                    id="edit-date"
                    type="date"
                    value={editingExpense.date}
                    onChange={(e) => setEditingExpense({ ...editingExpense, date: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "更新中..." : "更新"}
                </Button>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* 月別経費一覧 */}
        {sortedMonths.length > 0 ? (
          <div className="space-y-6">
            {sortedMonths.map((month) => {
              const monthExpenses = expensesByMonth[month];
              const monthTotal = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
              
              return (
                <Card key={month}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{month}</CardTitle>
                      <div className="text-lg font-semibold text-primary">
                        合計: ¥{monthTotal.toLocaleString()}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {monthExpenses.map((expense) => {
                        const category = categories?.find(c => c.id === expense.categoryId);
                        return (
                          <div
                            key={expense.id}
                            className="flex items-center justify-between py-3 px-4 border-l-4 border-primary/30 bg-accent/30 rounded"
                          >
                            <div className="flex-1 flex items-center gap-4">
                              <span className="text-sm text-muted-foreground min-w-[80px]">
                                {new Date(expense.date).toLocaleDateString('ja-JP', { month: '2-digit', day: '2-digit' })}
                              </span>
                              <span className="font-medium min-w-[120px]">
                                {expense.description || "（説明なし）"}
                              </span>
                              <span className="text-sm px-3 py-1 bg-primary/10 text-primary rounded-full">
                                {category?.name || "不明"}
                              </span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="font-bold text-lg min-w-[100px] text-right">
                                ¥{expense.amount.toLocaleString()}
                              </span>
                              {!showDeleted ? (
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openEditDialog(expense)}
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => handleDelete(expense.id)}
                                    disabled={deleteMutation.isPending}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRestore(expense.id)}
                                  disabled={restoreMutation.isPending}
                                >
                                  <Undo2 className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8">
              <p className="text-center text-muted-foreground">
                {showDeleted ? "削除済みの経費がありません" : "経費がありません。経費を追加してください。"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
