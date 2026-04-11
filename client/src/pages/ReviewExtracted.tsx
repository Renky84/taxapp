import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { CheckCircle, XCircle, Image as ImageIcon, Loader2, Edit2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function ReviewExtracted() {
  const [, setLocation] = useLocation();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editData, setEditData] = useState<any>(null);

  // Get job ID from URL params (would need to be passed properly in real app)
  const jobId = 1; // Placeholder

  const { data: jobDetails, isLoading, refetch } = trpc.batchScan.getJobDetails.useQuery(
    { jobId },
    { enabled: jobId > 0 }
  );

  const { data: categories } = trpc.categories.list.useQuery();

  const approveMutation = trpc.batchScan.approveExtracted.useMutation({
    onSuccess: () => {
      toast.success("承認しました");
      setSelectedId(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "承認に失敗しました");
    },
  });

  const rejectMutation = trpc.batchScan.rejectExtracted.useMutation({
    onSuccess: () => {
      toast.success("却下しました");
      setSelectedId(null);
      refetch();
    },
    onError: (error: any) => {
      toast.error(error.message || "却下に失敗しました");
    },
  });

  const handleApprove = (extracted: any) => {
    const data = editData || extracted;
    approveMutation.mutate({
      extractedId: extracted.id,
      amount: data.approvedAmount || data.amount,
      categoryId: data.approvedCategoryId || data.categoryId,
      description: data.approvedDescription || data.description,
      date: data.approvedDate || data.date,
    });
  };

  const handleReject = (id: number) => {
    rejectMutation.mutate({ extractedId: id });
  };

  const extracted = jobDetails?.extracted || [];
  const pendingItems = extracted.filter((e: any) => e.status === 'pending');
  const approvedCount = extracted.filter((e: any) => e.status === 'approved').length;
  const rejectedCount = extracted.filter((e: any) => e.status === 'rejected').length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">抽出データ確認</h1>
          <p className="text-gray-600 mt-2">レシートから抽出されたデータを確認・編集します</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-blue-600">{pendingItems.length}</p>
                <p className="text-sm text-gray-600 mt-1">確認待ち</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-green-600">{approvedCount}</p>
                <p className="text-sm text-gray-600 mt-1">承認済み</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-red-600">{rejectedCount}</p>
                <p className="text-sm text-gray-600 mt-1">却下</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Extracted Items */}
        <Card>
          <CardHeader>
            <CardTitle>抽出データ一覧</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : extracted.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                抽出データがありません
              </div>
            ) : (
              <div className="space-y-4">
                {extracted.map((item: any) => (
                  <div
                    key={item.id}
                    className={`border rounded-lg p-4 ${
                      item.status === 'pending' ? 'bg-white' :
                      item.status === 'approved' ? 'bg-green-50' :
                      'bg-red-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <img
                            src={`/api/receipts/${item.receiptId}`}
                            alt="receipt"
                            className="w-16 h-16 object-cover rounded"
                          />
                          <div className="flex-1">
                            <p className="font-semibold">
                              ¥{item.amount.toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-600">
                              {item.categoryName} - {item.description}
                            </p>
                            <p className="text-xs text-gray-500">
                              {new Date(item.date).toLocaleDateString('ja-JP')}
                            </p>
                          </div>
                        </div>
                        {item.confidence && (
                          <p className="text-xs text-gray-500">
                            信頼度: {item.confidence}%
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {item.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedId(item.id);
                                setEditData(null);
                              }}
                            >
                              <Edit2 className="w-4 h-4 mr-1" />
                              編集
                            </Button>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => handleApprove(item)}
                              disabled={approveMutation.isPending}
                            >
                              <CheckCircle className="w-4 h-4 mr-1" />
                              承認
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleReject(item.id)}
                              disabled={rejectMutation.isPending}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              却下
                            </Button>
                          </>
                        )}
                        {item.status === 'approved' && (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-5 h-5" />
                            <span className="text-sm font-medium">承認済み</span>
                          </div>
                        )}
                        {item.status === 'rejected' && (
                          <div className="flex items-center gap-1 text-red-600">
                            <XCircle className="w-5 h-5" />
                            <span className="text-sm font-medium">却下</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit Dialog */}
        {selectedId !== null && (
          <Dialog open={selectedId !== null} onOpenChange={() => setSelectedId(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>データを編集</DialogTitle>
              </DialogHeader>
              {extracted.find((e: any) => e.id === selectedId) && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">金額</label>
                    <Input
                      type="number"
                      value={editData?.approvedAmount || extracted.find((e: any) => e.id === selectedId)?.amount || 0}
                      onChange={(e) => setEditData({
                        ...editData,
                        approvedAmount: parseFloat(e.target.value)
                      })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">カテゴリ</label>
                    <Select
                      value={String(editData?.approvedCategoryId || extracted.find((e: any) => e.id === selectedId)?.categoryId || '')}
                      onValueChange={(value) => setEditData({
                        ...editData,
                        approvedCategoryId: parseInt(value)
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((cat: any) => (
                          <SelectItem key={cat.id} value={String(cat.id)}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">説明</label>
                    <Input
                      value={editData?.approvedDescription || extracted.find((e: any) => e.id === selectedId)?.description || ''}
                      onChange={(e) => setEditData({
                        ...editData,
                        approvedDescription: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">日付</label>
                    <Input
                      type="date"
                      value={editData?.approvedDate || (() => {
                        const item = extracted.find((e: any) => e.id === selectedId);
                        if (!item) return '';
                        if (item.date instanceof Date) {
                          return item.date.toISOString().split('T')[0];
                        }
                        return item.date || '';
                      })()}
                      onChange={(e) => setEditData({
                        ...editData,
                        approvedDate: e.target.value
                      })}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => {
                        const item = extracted.find((e: any) => e.id === selectedId);
                        handleApprove(item);
                      }}
                    >
                      承認
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setSelectedId(null)}
                    >
                      キャンセル
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>
    </DashboardLayout>
  );
}
