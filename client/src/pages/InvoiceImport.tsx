import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { FileText, Loader2, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type ImportResult = {
  success: boolean;
  fileName: string;
  error?: string;
  data?: {
    storeName: string;
    purchaseDate: string;
    dueDate?: string;
    paymentMethod?: string;
    totalAmount: number;
    taxAmount?: number;
    description?: string;
    confidence?: number;
    documentType?: string;
  };
};

export default function InvoiceImport() {
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const importMutation = trpc.receipts.importDocuments.useMutation({
    onSuccess: async (data) => {
      setResults(data as ImportResult[]);
      setProgress(100);
      await utils.receipts.reviewQueue.invalidate();
      await utils.receipts.list.invalidate();
      const successCount = data.filter((item: any) => item.success).length;
      const failedCount = data.length - successCount;
      if (failedCount > 0) {
        toast.warning(`${successCount}件を要確認へ追加しました。${failedCount}件は失敗しました。`);
      } else {
        toast.success(`${successCount}件を要確認へ追加しました。`);
      }
    },
    onError: (error) => {
      toast.error(error.message || "請求書の取込に失敗しました");
    },
    onSettled: () => {
      setProgress(0);
    },
  });

  const onPickFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files || []).filter((file) => {
      const ok = file.type === "application/pdf" || file.type.startsWith("image/");
      if (!ok) {
        toast.error(`${file.name} はPDFまたは画像のみ対応です`);
      }
      return ok;
    });
    setFiles(picked);
    setResults([]);
  };

  const onImport = async () => {
    if (!files.length) {
      toast.error("PDFまたは画像を選択してください");
      return;
    }

    setProgress(15);
    const documents = await Promise.all(
      files.map(async (file) => {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error(`${file.name} の読込に失敗しました`));
          reader.readAsDataURL(file);
        });
        return {
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileData: dataUrl,
        };
      })
    );
    setProgress(55);
    await importMutation.mutateAsync({ documents });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">請求書PDF取込</h1>
          <p className="text-gray-600 mt-2">
            PDFや画像をアップロードすると、AIが帳簿候補を作成して要確認キューへ入れます。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>ファイルを選択</CardTitle>
            <CardDescription>対応形式: PDF / JPG / PNG / WEBP</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input ref={inputRef} type="file" accept="application/pdf,image/*" multiple onChange={onPickFiles} />
            {files.length > 0 && (
              <div className="rounded-lg border p-4 space-y-2">
                <div className="text-sm font-medium">選択中: {files.length}件</div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {files.map((file) => (
                    <div key={`${file.name}-${file.size}`} className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>{file.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {importMutation.isPending && <Progress value={progress} />}
            <div className="flex gap-3">
              <Button onClick={onImport} disabled={importMutation.isPending || files.length === 0}>
                {importMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                取込して要確認へ送る
              </Button>
              <Button type="button" variant="outline" onClick={() => setLocation("/review-extracted")}>
                要確認を開く
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>取込結果</CardTitle>
          </CardHeader>
          <CardContent>
            {results.length === 0 ? (
              <div className="text-sm text-muted-foreground">まだ取込結果はありません。</div>
            ) : (
              <div className="space-y-3">
                {results.map((result) => (
                  <div key={result.fileName} className="rounded-lg border p-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium break-all">{result.fileName}</div>
                      {result.success ? (
                        <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" />完了</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-sm text-amber-600"><AlertTriangle className="h-4 w-4" />失敗</span>
                      )}
                    </div>
                    {result.success && result.data ? (
                      <div className="grid md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div>取引先: {result.data.storeName || "-"}</div>
                        <div>日付: {result.data.purchaseDate || "-"}</div>
                        <div>金額: ¥{(result.data.totalAmount || 0).toLocaleString("ja-JP")}</div>
                        <div>信頼度: {result.data.confidence || 0}%</div>
                        <div className="md:col-span-2">摘要: {result.data.description || "-"}</div>
                      </div>
                    ) : (
                      <div className="text-sm text-destructive">{result.error || "取込に失敗しました"}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
