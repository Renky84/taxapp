import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { trpc } from "@/lib/trpc";
import { Camera, Upload, Loader2, Check, X, ChevronRight } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

interface SelectedImage {
  file: File;
  preview: string;
}

export default function BatchScan() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState<SelectedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const { data: jobs, isLoading: jobsLoading, refetch: refetchJobs } = trpc.batchScan.getJobs.useQuery();
  const { data: currentJob } = trpc.batchScan.getCurrentJob.useQuery();

  const uploadMutation = trpc.batchScan.startBatch.useMutation({
    onSuccess: () => {
      toast.success("バッチ処理を開始しました");
      setSelectedImages([]);
      setIsOpen(false);
      refetchJobs();
    },
    onError: (error: any) => {
      toast.error(error.message || "アップロードに失敗しました");
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  };

  const processFiles = (files: File[]) => {
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      toast.error("画像ファイルを選択してください");
      return;
    }

    imageFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImages(prev => [...prev, {
          file,
          preview: e.target?.result as string,
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedImages.length === 0) {
      toast.error("画像を選択してください");
      return;
    }

    const formData = new FormData();
    selectedImages.forEach(img => {
      formData.append('files', img.file);
    });

    try {
      const response = await fetch('/api/trpc/batchScan.uploadImages', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      uploadMutation.mutate({ receiptIds: data.receiptIds });
    } catch (error) {
      toast.error("アップロードに失敗しました");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">レシート自動スキャン</h1>
            <p className="text-gray-600 mt-2">複数のレシート画像を一括処理します</p>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2">
                <Upload className="w-4 h-4" />
                スキャン開始
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>レシートをスキャン</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {/* Upload Area */}
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-gray-50 transition"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600 mb-4">
                    クリックして画像を選択するか、ドラッグ&ドロップ
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      ライブラリから選択
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => cameraInputRef.current?.click()}
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      カメラで撮影
                    </Button>
                  </div>
                </div>

                {/* Selected Images Preview */}
                {selectedImages.length > 0 && (
                  <div>
                    <p className="font-semibold mb-2">選択済み画像 ({selectedImages.length}枚)</p>
                    <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                      {selectedImages.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <img
                            src={img.preview}
                            alt={`preview-${idx}`}
                            className="w-full h-24 object-cover rounded"
                          />
                          <button
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    onClick={handleUpload}
                    disabled={selectedImages.length === 0 || uploadMutation.isPending}
                    className="flex-1"
                  >
                    {uploadMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        処理中...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        バッチ処理を開始
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsOpen(false)}
                  >
                    キャンセル
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Current Job Progress */}
        {currentJob && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-lg">処理中のジョブ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium">進捗状況</span>
                  <span className="text-sm text-gray-600">
                    {currentJob.processedCount} / {currentJob.totalCount}
                  </span>
                </div>
                <Progress
                  value={(currentJob.processedCount / currentJob.totalCount) * 100}
                  className="h-2"
                />
              </div>
              <p className="text-sm text-gray-600">
                {currentJob.status === 'processing' && 'レシートを処理中です...'}
                {currentJob.status === 'completed' && '処理が完了しました！'}
                {currentJob.status === 'failed' && `エラーが発生しました: ${currentJob.errorMessage}`}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Job History */}
        <Card>
          <CardHeader>
            <CardTitle>処理履歴</CardTitle>
          </CardHeader>
          <CardContent>
            {jobsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : jobs && jobs.length > 0 ? (
              <div className="space-y-2">
                {jobs.map((job: any) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-sm">
                        {new Date(job.createdAt).toLocaleDateString('ja-JP')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {job.totalCount}枚のレシートを処理
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {job.processedCount} / {job.totalCount}
                        </p>
                        <p className={`text-xs ${
                          job.status === 'completed' ? 'text-green-600' :
                          job.status === 'failed' ? 'text-red-600' :
                          'text-blue-600'
                        }`}>
                          {job.status === 'pending' && '待機中'}
                          {job.status === 'processing' && '処理中'}
                          {job.status === 'completed' && '完了'}
                          {job.status === 'failed' && 'エラー'}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                処理履歴がありません
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
