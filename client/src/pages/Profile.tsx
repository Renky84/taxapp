import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const { data: profile, isLoading, refetch } = trpc.profile.get.useQuery();
  const [formData, setFormData] = useState({
    businessName: "",
    businessType: "",
    taxFilingDeadline: "",
  });
  const [isEditing, setIsEditing] = useState(false);

  const updateMutation = trpc.profile.update.useMutation({
    onSuccess: () => {
      toast.success("プロフィールを更新しました");
      setIsEditing(false);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "更新に失敗しました");
    },
  });

  const handleEdit = () => {
    if (profile) {
      setFormData({
        businessName: profile.businessName || "",
        businessType: profile.businessType || "",
        taxFilingDeadline: profile.taxFilingDeadline ? new Date(profile.taxFilingDeadline).toISOString().split('T')[0] : "",
      });
    }
    setIsEditing(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      businessName: formData.businessName,
      businessType: formData.businessType,
      taxFilingDeadline: formData.taxFilingDeadline,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">プロフィール</h1>
          <p className="text-gray-600 mt-2">事業者情報を管理</p>
        </div>

        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle>ユーザー情報</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm text-gray-600">名前</Label>
              <p className="text-lg font-semibold">{user?.name || "未設定"}</p>
            </div>
            <div>
              <Label className="text-sm text-gray-600">メールアドレス</Label>
              <p className="text-lg font-semibold">{user?.email || "未設定"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Business Profile */}
        <Card>
          <CardHeader className="flex items-center justify-between">
            <CardTitle>事業者情報</CardTitle>
            {!isEditing && (
              <Button variant="outline" onClick={handleEdit}>
                編集
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="businessName">事業名</Label>
                  <Input
                    id="businessName"
                    placeholder="例：田中商事"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="businessType">事業形態</Label>
                  <Input
                    id="businessType"
                    placeholder="例：個人事業主"
                    value={formData.businessType}
                    onChange={(e) => setFormData({ ...formData, businessType: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="taxFilingDeadline">確定申告期限</Label>
                  <Input
                    id="taxFilingDeadline"
                    type="date"
                    value={formData.taxFilingDeadline}
                    onChange={(e) => setFormData({ ...formData, taxFilingDeadline: e.target.value })}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "保存中..." : "保存"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                  >
                    キャンセル
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm text-gray-600">事業名</Label>
                  <p className="text-lg font-semibold">{profile?.businessName || "未設定"}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">事業形態</Label>
                  <p className="text-lg font-semibold">{profile?.businessType || "未設定"}</p>
                </div>
                <div>
                  <Label className="text-sm text-gray-600">確定申告期限</Label>
                  <p className="text-lg font-semibold">
                    {profile?.taxFilingDeadline
                      ? new Date(profile.taxFilingDeadline).toLocaleDateString('ja-JP')
                      : "未設定"}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Settings */}
        <Card>
          <CardHeader>
            <CardTitle>アカウント設定</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-2">メールアドレス</p>
              <p className="text-lg font-semibold">{user?.email || "未設定"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 mb-2">アカウント作成日</p>
              <p className="text-lg font-semibold">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('ja-JP') : "未設定"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
