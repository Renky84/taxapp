import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Loader2, Download, Eye, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";

export default function Receipts() {
  const [previewReceipt, setPreviewReceipt] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const { data: receipts, isLoading, refetch } = trpc.receipts.list.useQuery();

  const deleteMutation = trpc.receipts.deleteReceipt.useMutation({
    onSuccess: () => {
      toast.success("レシートを削除しました");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "削除に失敗しました");
    },
  });

  const handlePreview = (receipt: any) => {
    setPreviewReceipt(receipt);
    setIsPreviewOpen(true);
  };

  const handleDownload = (receipt: any) => {
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = receipt.fileUrl;
    link.download = receipt.fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("ダウンロードを開始しました");
  };

  const handleDelete = (id: number) => {
    if (confirm("このレシートを削除してもよろしいですか？")) {
      deleteMutation.mutate({ id });
    }
  };

  return (
    <DashboardLayout>
      <div className="container py-8">
        <Card>
          <CardHeader>
            <CardTitle>レシート一覧</CardTitle>
            <p className="text-sm text-muted-foreground">
              保存されたレシート画像・請求書PDFを確認できます（7年間保存）
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : !receipts || receipts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                レシートがありません
              </div>
            ) : (
              <div className="space-y-4">
                {receipts.map((receipt: any) => (
                  <div
                    key={receipt.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{receipt.fileName}</p>
                      <p className="text-sm text-muted-foreground">
                        アップロード日時: {new Date(receipt.uploadedAt).toLocaleString('ja-JP')}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreview(receipt)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        プレビュー
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(receipt)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        ダウンロード
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleDelete(receipt.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewReceipt?.fileName}</DialogTitle>
          </DialogHeader>
          {previewReceipt && (
            <div className="mt-4">
              {String(previewReceipt.mimeType || '').includes('pdf') || String(previewReceipt.fileName || '').toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={previewReceipt.fileUrl}
                  title={previewReceipt.fileName}
                  className="w-full h-[70vh] rounded-md border"
                />
              ) : (
                <img
                  src={previewReceipt.fileUrl}
                  alt={previewReceipt.fileName}
                  className="w-full h-auto max-h-[70vh] object-contain"
                />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
