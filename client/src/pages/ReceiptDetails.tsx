import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Loader2, Trash2, Edit2, Check, X } from "lucide-react";
import { useState } from "react";
import { useRoute } from "wouter";
import { toast } from "sonner";

export default function ReceiptDetails() {
  const [, params] = useRoute("/receipt-details/:id");
  const receiptId = params?.id ? parseInt(params.id) : null;
  
  const [editingItems, setEditingItems] = useState<Record<number, boolean>>({});
  const [editValues, setEditValues] = useState<Record<number, any>>({});

  // レシート詳細情報を取得（実装予定）
  // const { data: receiptDetail, isLoading } = trpc.receipts.getDetail.useQuery({ receiptId: receiptId || 0 });

  // モックデータ（実装時に削除）
  const receiptDetail = {
    id: 1,
    receiptId: 1,
    storeName: "コンビニ A店",
    storeAddress: "東京都渋谷区",
    purchaseDate: "2025-11-29",
    purchaseTime: "14:30",
    paymentMethod: "クレジットカード",
    totalAmount: 15000,
    taxAmount: 1364,
    lineItems: [
      { id: 1, itemName: "コーヒー", quantity: 1, unitPrice: 500, totalPrice: 500, category: "飲食" },
      { id: 2, itemName: "弁当", quantity: 2, unitPrice: 700, totalPrice: 1400, category: "飲食" },
      { id: 3, itemName: "ノート", quantity: 3, unitPrice: 200, totalPrice: 600, category: "消耗品" },
      { id: 4, itemName: "ペン", quantity: 5, unitPrice: 100, totalPrice: 500, category: "消耗品" },
    ]
  };

  const handleEditItem = (itemId: number, item: any) => {
    setEditingItems({ ...editingItems, [itemId]: true });
    setEditValues({ ...editValues, [itemId]: { ...item } });
  };

  const handleSaveItem = (itemId: number) => {
    setEditingItems({ ...editingItems, [itemId]: false });
    toast.success("商品情報を更新しました");
  };

  const handleCancelEdit = (itemId: number) => {
    setEditingItems({ ...editingItems, [itemId]: false });
    setEditValues({ ...editValues, [itemId]: undefined });
  };

  const handleDeleteItem = (itemId: number) => {
    // 実装時にAPI呼び出し
    toast.success("商品を削除しました");
  };

  const handleUpdateField = (itemId: number, field: string, value: any) => {
    setEditValues({
      ...editValues,
      [itemId]: { ...editValues[itemId], [field]: value }
    });
  };

  if (!receiptId) {
    return (
      <DashboardLayout>
        <div className="text-center py-8 text-gray-500">
          レシートが見つかりません
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">レシート詳細確認</h1>
          <p className="text-gray-600 mt-2">店舗情報と購入商品を確認・編集できます</p>
        </div>

        {/* Store Information */}
        <Card>
          <CardHeader>
            <CardTitle>店舗情報</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label className="text-sm text-gray-600">店舗名</Label>
                <p className="text-lg font-semibold mt-1">{receiptDetail.storeName}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">住所</Label>
                <p className="text-lg font-semibold mt-1">{receiptDetail.storeAddress}</p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">購入日時</Label>
                <p className="text-lg font-semibold mt-1">
                  {receiptDetail.purchaseDate} {receiptDetail.purchaseTime}
                </p>
              </div>
              <div>
                <Label className="text-sm text-gray-600">支払い方法</Label>
                <p className="text-lg font-semibold mt-1">{receiptDetail.paymentMethod}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Receipt Image */}
        <Card>
          <CardHeader>
            <CardTitle>レシート画像</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center h-64">
              <p className="text-gray-500">レシート画像表示エリア</p>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle>購入商品一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Mobile View */}
              <div className="md:hidden space-y-3">
                {receiptDetail.lineItems.map((item) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                    {editingItems[item.id] ? (
                      <>
                        <div>
                          <Label className="text-xs text-gray-600">商品名</Label>
                          <Input
                            value={editValues[item.id]?.itemName || ""}
                            onChange={(e) => handleUpdateField(item.id, "itemName", e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs text-gray-600">数量</Label>
                            <Input
                              type="number"
                              value={editValues[item.id]?.quantity || ""}
                              onChange={(e) => handleUpdateField(item.id, "quantity", parseInt(e.target.value))}
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-gray-600">単価</Label>
                            <Input
                              type="number"
                              value={editValues[item.id]?.unitPrice || ""}
                              onChange={(e) => handleUpdateField(item.id, "unitPrice", parseInt(e.target.value))}
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">カテゴリ</Label>
                          <Input
                            value={editValues[item.id]?.category || ""}
                            onChange={(e) => handleUpdateField(item.id, "category", e.target.value)}
                            className="mt-1"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            className="flex-1 gap-1"
                            onClick={() => handleSaveItem(item.id)}
                          >
                            <Check className="w-4 h-4" />
                            保存
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 gap-1"
                            onClick={() => handleCancelEdit(item.id)}
                          >
                            <X className="w-4 h-4" />
                            キャンセル
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-gray-900">{item.itemName}</p>
                            <p className="text-xs text-gray-500 mt-1">{item.category}</p>
                          </div>
                          <p className="font-semibold text-gray-900">¥{(item.totalPrice / 100).toLocaleString()}</p>
                        </div>
                        <p className="text-xs text-gray-600">
                          {item.quantity}個 × ¥{(item.unitPrice / 100).toLocaleString()}
                        </p>
                        <div className="flex gap-2 pt-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 gap-1"
                            onClick={() => handleEditItem(item.id, item)}
                          >
                            <Edit2 className="w-3 h-3" />
                            編集
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteItem(item.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="text-left py-3 px-4">商品名</th>
                      <th className="text-right py-3 px-4">数量</th>
                      <th className="text-right py-3 px-4">単価</th>
                      <th className="text-right py-3 px-4">合計</th>
                      <th className="text-left py-3 px-4">カテゴリ</th>
                      <th className="text-center py-3 px-4">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receiptDetail.lineItems.map((item) => (
                      <tr key={item.id} className="border-b hover:bg-gray-50">
                        {editingItems[item.id] ? (
                          <>
                            <td className="py-3 px-4">
                              <Input
                                value={editValues[item.id]?.itemName || ""}
                                onChange={(e) => handleUpdateField(item.id, "itemName", e.target.value)}
                                className="text-sm"
                              />
                            </td>
                            <td className="text-right py-3 px-4">
                              <Input
                                type="number"
                                value={editValues[item.id]?.quantity || ""}
                                onChange={(e) => handleUpdateField(item.id, "quantity", parseInt(e.target.value))}
                                className="text-sm w-16 ml-auto"
                              />
                            </td>
                            <td className="text-right py-3 px-4">
                              <Input
                                type="number"
                                value={editValues[item.id]?.unitPrice || ""}
                                onChange={(e) => handleUpdateField(item.id, "unitPrice", parseInt(e.target.value))}
                                className="text-sm w-20 ml-auto"
                              />
                            </td>
                            <td className="text-right py-3 px-4 font-semibold">
                              ¥{((editValues[item.id]?.quantity || 0) * (editValues[item.id]?.unitPrice || 0) / 100).toLocaleString()}
                            </td>
                            <td className="py-3 px-4">
                              <Input
                                value={editValues[item.id]?.category || ""}
                                onChange={(e) => handleUpdateField(item.id, "category", e.target.value)}
                                className="text-sm"
                              />
                            </td>
                            <td className="text-center py-3 px-4 space-x-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveItem(item.id)}
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancelEdit(item.id)}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="py-3 px-4">{item.itemName}</td>
                            <td className="text-right py-3 px-4">{item.quantity}</td>
                            <td className="text-right py-3 px-4">¥{(item.unitPrice / 100).toLocaleString()}</td>
                            <td className="text-right py-3 px-4 font-semibold">¥{(item.totalPrice / 100).toLocaleString()}</td>
                            <td className="py-3 px-4">{item.category}</td>
                            <td className="text-center py-3 px-4 space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEditItem(item.id, item)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteItem(item.id)}
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </Button>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card>
          <CardHeader>
            <CardTitle>合計</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-lg">
                <span className="text-gray-600">小計</span>
                <span className="font-semibold">¥{((receiptDetail.totalAmount - receiptDetail.taxAmount) / 100).toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-gray-600">税金</span>
                <span className="font-semibold">¥{(receiptDetail.taxAmount / 100).toLocaleString()}</span>
              </div>
              <div className="border-t pt-2 flex justify-between text-xl">
                <span className="font-semibold text-gray-900">合計</span>
                <span className="font-bold text-blue-600">¥{(receiptDetail.totalAmount / 100).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4 flex-col md:flex-row">
          <Button className="flex-1 md:flex-none" size="lg">
            確認して経費に登録
          </Button>
          <Button variant="outline" className="flex-1 md:flex-none" size="lg">
            キャンセル
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
