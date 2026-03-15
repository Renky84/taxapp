import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Camera, Upload, Loader2, Check, X, Trash2, Edit2, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";


interface LineItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface ScannedData {
  storeName: string;
  storeAddress?: string;
  storePhone?: string;
  purchaseDate: string;
  paymentMethod: string;
  totalAmount: number;
  lineItems: LineItem[];
  receiptId?: number;
  categoryId?: number;
  fileName: string;
  success: boolean;
  error?: string;
  duplicateCount?: number;
}

export default function ReceiptScan() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedResults, setScannedResults] = useState<ScannedData[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingData, setEditingData] = useState<ScannedData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: categories } = trpc.expenses.getCategories.useQuery();
  const batchClassifyMutation = trpc.receipts.batchClassify.useMutation();
  const createExpenseMutation = trpc.expenses.create.useMutation();
  const trpcUtils = trpc.useUtils();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length > 100) {
      toast.error("一度にアップロードできるのは最大100枚までです");
      return;
    }

    const oversizedFiles = files.filter(f => f.size > 16 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error(`${oversizedFiles.length}個のファイルが16MBを超えています`);
      return;
    }

    setSelectedFiles(files);
    setScannedResults([]);
    setEditingIndex(null);
    setEditingData(null);
    toast.success(`${files.length}枚のレシートを選択しました`);
  };

  const handleBatchScan = async () => {
    if (selectedFiles.length === 0) {
      toast.error("レシート画像を選択してください");
      return;
    }

    setIsScanning(true);
    setProgress(0);
    setProcessedCount(0);
    
    // 予定時間を計算（1枚あたり約5秒）
    const estimatedSeconds = selectedFiles.length * 5;
    setEstimatedTime(estimatedSeconds);

    try {
      // Convert files to base64
      const receiptsData = await Promise.all(
        selectedFiles.map(async (file) => {
          return new Promise<{ imageData: string; mimeType: string; fileName: string }>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              resolve({
                imageData: e.target?.result as string,
                mimeType: file.type,
                fileName: file.name,
              });
            };
            reader.readAsDataURL(file);
          });
        })
      );

      // バッチ処理を実行
      const startTime = Date.now();
      const results = await batchClassifyMutation.mutateAsync({ receipts: receiptsData });
      
      // 結果を整形
      const fallbackCategoryId =
        categories?.find((category) => category.code === "other")?.id ??
        categories?.[0]?.id;

      const formattedResults: ScannedData[] = results.map((result: any) => {
        if (result.success) {
          return {
            ...result.data,
            categoryId: result.data?.categoryId ?? fallbackCategoryId,
            fileName: result.fileName,
            success: true,
          };
        } else {
          return {
            storeName: "",
            purchaseDate: new Date().toISOString().split('T')[0],
            paymentMethod: "現金",
            totalAmount: 0,
            lineItems: [],
            fileName: result.fileName,
            success: false,
            error: result.error,
          };
        }
      });

      // 重複チェックを実行
      const resultsWithDuplicates = await Promise.all(
        formattedResults.map(async (result) => {
          if (result.success) {
            try {
              const duplicates = await trpcUtils.receipts.checkDuplicates.fetch({
                storeName: result.storeName,
                date: result.purchaseDate,
                amount: result.totalAmount,
              });
              return {
                ...result,
                duplicateCount: duplicates?.length || 0,
              };
            } catch (error) {
              return result;
            }
          }
          return result;
        })
      );

      setScannedResults(resultsWithDuplicates);
      setIsScanning(false);
      setProgress(100);
      
      const successCount = formattedResults.filter(r => r.success).length;
      const failCount = formattedResults.filter(r => !r.success).length;
      
      if (failCount > 0) {
        toast.warning(`${successCount}枚のスキャンが完了しました。${failCount}枚は失敗しました。`);
      } else {
        toast.success(`${successCount}枚のスキャンが完了しました`);
      }
    } catch (error: any) {
      setIsScanning(false);
      toast.error(error.message || "スキャンに失敗しました");
    }
  };

  const handleRemoveItem = (index: number) => {
    const newResults = [...scannedResults];
    newResults.splice(index, 1);
    setScannedResults(newResults);
    toast.success("削除しました");
  };

  const handleEditItem = (index: number) => {
    const item = scannedResults[index];
    setEditingIndex(index);
    setEditingData({ ...item });
    setSelectedCategory(item.categoryId?.toString() || "");
  };

  const handleSaveEdit = () => {
    if (editingIndex === null || !editingData) return;
    
    const newResults = [...scannedResults];
    newResults[editingIndex] = editingData;
    setScannedResults(newResults);
    setEditingIndex(null);
    setEditingData(null);
    toast.success("変更を保存しました");
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingData(null);
  };

  const handleRemoveLineItem = (lineItemId: string) => {
    if (!editingData) return;
    
    const newLineItems = editingData.lineItems.filter(item => item.id !== lineItemId);
    setEditingData({
      ...editingData,
      lineItems: newLineItems,
      totalAmount: newLineItems.reduce((sum, item) => sum + item.totalPrice, 0),
    });
  };

  const handleRegisterToLedger = async (index: number) => {
    const item = scannedResults[index];
    
    if (!item.categoryId) {
      toast.error("経費区分を選択してください");
      return;
    }

    try {
      const description = `${item.storeName}\n${item.lineItems.map(li => `${li.name} x${li.quantity}`).join('\n')}`;
      
      await createExpenseMutation.mutateAsync({
        categoryId: item.categoryId,
        amount: item.totalAmount,
        description: description,
        date: item.purchaseDate,
        receiptId: item.receiptId,
      });

      toast.success("帳簿に登録しました");
      
      // 登録済みアイテムを削除
      const newResults = [...scannedResults];
      newResults.splice(index, 1);
      setScannedResults(newResults);
    } catch (error: any) {
      toast.error(error.message || "登録に失敗しました");
    }
  };

  const handleRegisterAll = async () => {
    const validItems = scannedResults.filter(r => r.success && r.categoryId);
    
    if (validItems.length === 0) {
      toast.error("登録可能なレシートがありません");
      return;
    }

    try {
      for (const item of validItems) {
        const description = `${item.storeName}\n${item.lineItems.map(li => `${li.name} x${li.quantity}`).join('\n')}`;
        
        await createExpenseMutation.mutateAsync({
          categoryId: item.categoryId!,
          amount: item.totalAmount,
          description: description,
          date: item.purchaseDate,
          receiptId: item.receiptId,
        });
      }

      toast.success(`${validItems.length}件を帳簿に登録しました`);
      setScannedResults([]);
      setSelectedFiles([]);
    } catch (error: any) {
      toast.error(error.message || "一括登録に失敗しました");
    }
  };

  // プログレスバーの更新（スキャン中）
  useEffect(() => {
    if (isScanning && estimatedTime > 0) {
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + (100 / estimatedTime);
          return newProgress >= 95 ? 95 : newProgress;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isScanning, estimatedTime]);

  const renderItem = (index: number) => {
    const item = scannedResults[index];
    const isEditing = editingIndex === index;

    if (isEditing && editingData) {
      return (
        <div key={index} className="mb-4">
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <span>編集中: {editingData.fileName}</span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveEdit}>
                    <Check className="w-4 h-4 mr-1" />
                    保存
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                    <X className="w-4 h-4 mr-1" />
                    キャンセル
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>店舗名</Label>
                  <Input
                    value={editingData.storeName}
                    onChange={(e) => setEditingData({ ...editingData, storeName: e.target.value })}
                  />
                </div>
                <div>
                  <Label>購入日</Label>
                  <Input
                    type="date"
                    value={editingData.purchaseDate}
                    onChange={(e) => setEditingData({ ...editingData, purchaseDate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>支払い方法</Label>
                  <Input
                    value={editingData.paymentMethod}
                    onChange={(e) => setEditingData({ ...editingData, paymentMethod: e.target.value })}
                  />
                </div>
                <div>
                  <Label>経費区分</Label>
                  <Select
                    value={selectedCategory}
                    onValueChange={(value) => {
                      setSelectedCategory(value);
                      setEditingData({ ...editingData, categoryId: parseInt(value) });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択してください" />
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
              </div>

              <div>
                <Label>商品明細</Label>
                <div className="space-y-2 mt-2">
                  {editingData.lineItems.map((lineItem) => (
                    <div key={lineItem.id} className="flex items-center justify-between p-2 bg-accent rounded">
                      <span>{lineItem.name} x{lineItem.quantity}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">¥{lineItem.totalPrice.toLocaleString()}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRemoveLineItem(lineItem.id)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-right">
                  <span className="text-lg font-bold">合計: ¥{editingData.totalAmount.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div key={index} className="mb-4">
        <Card className={!item.success ? "border-destructive" : ""}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                {!item.success && <AlertTriangle className="w-5 h-5 text-destructive" />}
                {item.success && item.duplicateCount && item.duplicateCount > 0 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{item.duplicateCount}件の重複が見つかりました</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                <span>{item.fileName}</span>
              </div>
              <div className="flex gap-2">
                {item.success && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => handleEditItem(index)}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="sm" onClick={() => handleRegisterToLedger(index)} disabled={!item.categoryId}>
                      帳簿に登録
                    </Button>
                  </>
                )}
                <Button size="sm" variant="destructive" onClick={() => handleRemoveItem(index)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          {item.success ? (
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">店舗名:</span>
                  <span className="ml-2 font-medium">{item.storeName}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">購入日:</span>
                  <span className="ml-2 font-medium">{item.purchaseDate}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">支払い方法:</span>
                  <span className="ml-2 font-medium">{item.paymentMethod}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">合計:</span>
                  <span className="ml-2 font-bold text-lg">¥{item.totalAmount.toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-4">
                <span className="text-sm text-muted-foreground">商品: </span>
                <span className="text-sm">{item.lineItems.length}点</span>
              </div>
            </CardContent>
          ) : (
            <CardContent>
              <p className="text-destructive">エラー: {item.error}</p>
            </CardContent>
          )}
        </Card>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">レシートスキャン</h1>
          <p className="text-muted-foreground mt-1">最大100枚のレシートを同時にスキャンできます</p>
        </div>

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle>レシートをアップロード</CardTitle>
            <CardDescription>
              画像ファイルを選択してください（最大100枚、各ファイル16MB以下）
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isScanning}
                className="flex-1"
              >
                <Upload className="w-4 h-4 mr-2" />
                ファイルを選択
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelect}
                className="hidden"
              />
              <Button
                onClick={handleBatchScan}
                disabled={selectedFiles.length === 0 || isScanning}
                className="flex-1"
              >
                {isScanning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    スキャン中...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    スキャン開始
                  </>
                )}
              </Button>
            </div>

            {selectedFiles.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {selectedFiles.length}枚のレシートを選択中
              </div>
            )}

            {isScanning && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>進行状況</span>
                  <span>予定時間: 約{Math.ceil(estimatedTime)}秒</span>
                </div>
                <Progress value={progress} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        {scannedResults.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>スキャン結果</CardTitle>
                  <CardDescription>
                    {scannedResults.filter(r => r.success).length}件成功 / {scannedResults.length}件
                  </CardDescription>
                </div>
                <Button onClick={handleRegisterAll} disabled={scannedResults.filter(r => r.success && r.categoryId).length === 0}>
                  すべて帳簿に登録
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-y-auto space-y-4">
                {scannedResults.map((_, index) => renderItem(index))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
