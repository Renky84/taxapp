# taxapp fresh rebuild starter

2026年運用を前提にした、確定申告アプリの再出発用パッケージです。

## このZIPで入れてあるもの
- 白色申告 / 青色申告テーマの土台
- ダッシュボードの新デザイン方向
- S3系ストレージ前提の環境変数
- Windowsでも動かしやすい `cross-env` 対応スクリプト
- GitHubにそのまま置き換えやすい構成

## まだこれから詰めるもの
- 取引入力画面の全面刷新
- 事業主貸 / 事業主借の専用導線
- 帳簿画面の仕上げ
- OCR / AI 読み取り精度向上
- 本番公開の最終調整

## ローカル起動
1. `.env.example` をコピーして `.env` を作る
2. 依存関係を入れる
3. 起動する

```bash
npm install
npm run dev
```

## WindowsでGitHubへ反映
```bash
git add .
git commit -m "fresh rebuild starter"
git push origin main
```

## 次のおすすめ作業順
1. 起動確認
2. 取引入力画面の新デザイン
3. 事業主貸借ロジック
4. 証憑一覧とOCR改善
5. 帳簿 / レポート完成
