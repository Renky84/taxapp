import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { BookOpen, Info } from "lucide-react";

const categoryDescriptions: Record<string, { description: string; examples: string[] }> = {
  "消耗品": {
    description: "事業で使用する消耗品費です。取得価額が10万円未満、または使用可能期間が1年未満のものが該当します。",
    examples: ["文房具", "コピー用紙", "インクカートリッジ", "事務用品", "清掃用品"]
  },
  "交通費": {
    description: "事業のための移動にかかった費用です。電車・バス・タクシー代、駐車場代などが該当します。",
    examples: ["電車賃", "バス代", "タクシー代", "駐車場代", "高速道路料金"]
  },
  "食事代": {
    description: "事業に関連する飲食費です。会議費や福利厚生費として計上できる場合もあります。",
    examples: ["会議での飲食", "出張時の食事", "従業員との食事", "取引先との飲食"]
  },
  "通信費": {
    description: "電話代、インターネット料金、郵便代など、通信にかかる費用です。",
    examples: ["携帯電話料金", "インターネット料金", "郵便代", "宅配便代", "FAX代"]
  },
  "水道光熱費": {
    description: "事業で使用する電気・ガス・水道の料金です。自宅兼事務所の場合は按分が必要です。",
    examples: ["電気代", "ガス代", "水道代", "灯油代"]
  },
  "賃料": {
    description: "事務所や店舗の家賃、駐車場代など、場所を借りるための費用です。",
    examples: ["事務所家賃", "店舗家賃", "駐車場代", "倉庫賃料", "土地賃借料"]
  },
  "広告宣伝費": {
    description: "商品やサービスの宣伝・広告にかかる費用です。",
    examples: ["Web広告", "チラシ印刷", "看板制作", "SNS広告", "名刺作成"]
  },
  "旅費": {
    description: "出張にかかる交通費・宿泊費です。業務に必要な移動であることが条件です。",
    examples: ["新幹線代", "飛行機代", "ホテル宿泊費", "レンタカー代", "出張手当"]
  },
  "接待交際費": {
    description: "取引先との接待や贈答品にかかる費用です。事業との関連性が明確である必要があります。",
    examples: ["取引先との飲食", "お中元・お歳暮", "ゴルフ接待", "手土産", "慶弔費"]
  },
  "修繕費": {
    description: "建物や設備の修理・メンテナンスにかかる費用です。",
    examples: ["建物修理", "機械修理", "車両修理", "パソコン修理", "設備メンテナンス"]
  },
  "保険料": {
    description: "事業に関する保険の掛金です。生命保険は対象外です。",
    examples: ["火災保険", "自動車保険", "損害保険", "賠償責任保険"]
  },
  "税金": {
    description: "事業に関する税金です。所得税や住民税は対象外です。",
    examples: ["固定資産税", "自動車税", "印紙税", "事業税", "登録免許税"]
  },
  "その他": {
    description: "上記のいずれにも該当しない経費です。",
    examples: ["雑費", "その他の経費"]
  }
};

export default function CategoryGuide() {
  const { data: categories, isLoading } = trpc.expenses.getCategories.useQuery();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-3 rounded-lg">
            <BookOpen className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">経費区分ガイド</h1>
            <p className="text-gray-600 mt-1">税務署の基準に基づいた経費区分の説明</p>
          </div>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <Info className="w-5 h-5" />
              経費区分について
            </CardTitle>
            <CardDescription className="text-blue-800">
              適切な経費区分を選択することで、確定申告がスムーズになります。
              不明な場合は「その他」を選択し、後で税理士に相談することをお勧めします。
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Categories List */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories?.map((category) => {
              const info = categoryDescriptions[category.name] || {
                description: "説明がありません",
                examples: []
              };
              
              return (
                <Card key={category.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg">{category.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {info.description}
                    </CardDescription>
                  </CardHeader>
                  {info.examples.length > 0 && (
                    <CardContent>
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-gray-700">具体例：</p>
                        <ul className="list-disc list-inside space-y-1">
                          {info.examples.map((example, index) => (
                            <li key={index} className="text-sm text-gray-600">
                              {example}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* Tax Office Link */}
        <Card className="bg-gray-50">
          <CardHeader>
            <CardTitle className="text-base">参考リンク</CardTitle>
            <CardDescription>
              <a
                href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2210.htm"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                国税庁：やさしい必要経費の知識
              </a>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </DashboardLayout>
  );
}
