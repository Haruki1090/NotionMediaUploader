# NotionMediaUploader

## 概要
NotionMediaUploaderは、LINEで受け取った画像を自動的にNotionデータベースに保存するGoogle Apps Scriptプロジェクトです。LINEボットを通じて写真を送信すると、Notionの指定されたデータベースに画像がアップロードされ、メタデータ（送信者名、日時など）と共に保存されます。

## 機能
- LINEからの画像メッセージを自動で受信
- 受信した画像をNotionのデータベースにアップロード
- 送信者名、受信日時などのメタデータを一緒に保存
- アップロード完了時にLINEユーザーへ確認メッセージを送信

## セットアップ方法
1. **前提条件**
   - LINEの開発者アカウント
   - NotionのAPI統合設定
   - Google Apps Script環境

2. **スクリプトプロパティの設定**
   Google Apps Scriptのプロジェクト設定で以下のスクリプトプロパティを設定します：
   - `LINE_CHANNEL_ACCESS_TOKEN`: LINEのチャネルアクセストークン
   - `NOTION_API_TOKEN`: NotionのAPI統合トークン
   - `NOTION_DATABASE_ID`: 画像を保存するNotionデータベースのID

3. **Notionデータベースの準備**
   以下のプロパティを持つデータベースをNotionで作成します：
   - `タイトル`: タイトルプロパティ（Title型）
   - `画像`: ファイルプロパティ（Files型）
   - `送信者`: テキストプロパティ（Rich Text型）
   - `受信日時`: 日付プロパティ（Date型）

4. **Webhookの設定**
   - スクリプトをデプロイしてWebアプリとして公開
   - 生成されたURLをLINE MessagingのWebhook URLとして設定

## 使用方法
1. LINEボットと友達になる
2. ボットに画像を送信
3. 自動的にNotionデータベースに画像が保存される
4. 保存完了後、LINEで確認メッセージが届く

## デバッグ機能
- `debugConfiguration()`: 設定の確認とAPI接続テスト
- `checkNotionDatabase()`: Notionデータベース構造の確認
- `testWebhook()`: Webhookの動作テスト

## 注意事項
- セキュリティのため、本番環境では必ずLINE Webhookの署名検証を有効にしてください
- Notionデータベースの構造変更時は、スクリプト内のプロパティ名も更新する必要があります
