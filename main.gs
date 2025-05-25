// LINE to Notion Photo Upload System (Google Apps Script)

// 設定値
const LINE_CHANNEL_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_ACCESS_TOKEN');
const NOTION_API_TOKEN = PropertiesService.getScriptProperties().getProperty('NOTION_API_TOKEN');
const NOTION_DATABASE_ID = PropertiesService.getScriptProperties().getProperty('NOTION_DATABASE_ID');

/**
 * LINEからのWebhookを受信するメイン関数
 */
function doPost(e) {
  try {
    // リクエストボディが存在するかチェック
    if (!e.postData || !e.postData.contents) {
      console.error('No post data received');
      return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
    }
    
    const data = JSON.parse(e.postData.contents);
    console.log('Received webhook data:', JSON.stringify(data, null, 2));
    
    // LINE Webhookの署名検証（セキュリティのため）
    // 初期テスト時はコメントアウトしても可
    // if (!verifySignature(e.postData.contents, e.parameter.headers)) {
    //   return ContentService.createTextOutput('Unauthorized').setMimeType(ContentService.MimeType.TEXT);
    // }
    
    // イベントが存在するかチェック
    if (!data.events || !Array.isArray(data.events)) {
      console.log('No events in webhook data');
      return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
    }
    
    // イベントを処理
    data.events.forEach(event => {
      console.log('Processing event:', event.type, event.message?.type);
      if (event.type === 'message' && event.message && event.message.type === 'image') {
        handleImageMessage(event);
      }
    });
    
    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
  } catch (error) {
    console.error('Error in doPost:', error);
    // エラーが発生してもOKを返す（LINEの再送を防ぐため）
    return ContentService.createTextOutput('OK').setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * 画像メッセージを処理
 */
function handleImageMessage(event) {
  try {
    const messageId = event.message.id;
    const userId = event.source.userId;
    
    console.log('処理開始 - messageId:', messageId, 'userId:', userId);
    
    // LINEから画像を取得
    const imageBlob = getImageFromLine(messageId);
    console.log('画像取得結果:', imageBlob ? '成功' : '失敗');
    
    // ユーザー名を取得
    const userName = getUserName(userId);
    console.log('ユーザー名取得結果:', userName);
    
    if (imageBlob) {
      // Notionに画像をアップロード
      const result = uploadToNotion(imageBlob, userName, event.timestamp);
      console.log('Notion保存結果:', result);
      
      // ユーザーに確認メッセージを送信
      replyToUser(event.replyToken, '写真をNotionに保存しました！📸');
    } else {
      console.error('画像の取得に失敗しました');
      replyToUser(event.replyToken, '申し訳ありません。画像の取得に失敗しました。');
    }
  } catch (error) {
    console.error('Error handling image message:', error);
    replyToUser(event.replyToken, '申し訳ありません。エラーが発生しました。');
  }
}

/**
 * LINEから画像データを取得
 */
function getImageFromLine(messageId) {
  try {
    const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;
    
    const response = UrlFetchApp.fetch(url, {
      headers: {
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      }
    });
    
    if (response.getResponseCode() === 200) {
      return response.getBlob();
    }
    
    return null;
  } catch (error) {
    console.error('Error getting image from LINE:', error);
    return null;
  }
}

/**
 * Notionに画像をアップロード（File Upload API使用）
 */
function uploadToNotion(imageBlob, userName, timestamp) {
  try {
    console.log('Notionアップロード開始:', userName);
    
    // 1. File Upload objectを作成
    const fileUpload = createFileUpload(imageBlob);
    console.log('File Upload作成結果:', fileUpload);
    
    if (fileUpload && fileUpload.id) {
      // 2. ファイルコンテンツを送信
      const uploadResult = sendFileContent(fileUpload.id, imageBlob);
      console.log('ファイル送信結果:', uploadResult);
      
      if (uploadResult && uploadResult.status === 'uploaded') {
        // 3. Notionデータベースにエントリを作成（File Upload IDを使用）
        const result = createNotionDatabaseEntry(fileUpload.id, userName, timestamp);
        console.log('Notionデータベース作成結果:', result);
        return result;
      }
    }
    
    return false;
  } catch (error) {
    console.error('Error uploading to Notion:', error);
    return false;
  }
}

/**
 * ステップ1: File Upload objectを作成
 */
function createFileUpload(imageBlob) {
  try {
    const payload = {
      filename: `line_photo_${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`,
      content_type: 'image/jpeg'
    };
    
    console.log('File Upload作成リクエスト:', JSON.stringify(payload, null, 2));
    
    const response = UrlFetchApp.fetch('https://api.notion.com/v1/file_uploads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload)
    });
    
    console.log('File Upload作成レスポンス:', response.getResponseCode(), response.getContentText());
    
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    } else {
      console.error('Error creating file upload:', response.getContentText());
      return null;
    }
  } catch (error) {
    console.error('Error creating file upload:', error);
    return null;
  }
}

/**
 * ステップ2: ファイルコンテンツを送信
 */
function sendFileContent(fileUploadId, imageBlob) {
  try {
    console.log('ファイルコンテンツ送信開始:', fileUploadId);
    
    // multipart/form-dataでファイルを送信
    const response = UrlFetchApp.fetch(`https://api.notion.com/v1/file_uploads/${fileUploadId}/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_TOKEN}`,
        'Notion-Version': '2022-06-28'
        // Content-Typeは自動設定されるため指定しない
      },
      payload: {
        'file': imageBlob
      }
    });
    
    console.log('ファイル送信レスポンス:', response.getResponseCode(), response.getContentText());
    
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText());
    } else {
      console.error('Error sending file content:', response.getContentText());
      return null;
    }
  } catch (error) {
    console.error('Error sending file content:', error);
    return null;
  }
}

/**
 * ステップ3: Notionデータベースにエントリを作成（File Upload IDを使用）
 */
function createNotionDatabaseEntry(fileUploadId, userName, timestamp) {
  try {
    const now = new Date();
    const dateString = now.toISOString().split('T')[0]; // YYYY-MM-DD形式
    
    console.log('Notionエントリ作成開始:', {fileUploadId, userName, dateString});
    
    const payload = {
      parent: {
        database_id: NOTION_DATABASE_ID
      },
      properties: {
        'タイトル': {  // データベースのタイトルプロパティ名
          title: [
            {
              text: {
                content: `写真 - ${now.toLocaleString('ja-JP')}`
              }
            }
          ]
        },
        '画像': {  // ファイルプロパティ名（Files型）
          files: [
            {
              type: 'file_upload',
              file_upload: {
                id: fileUploadId
              },
              name: `photo_${now.getTime()}.jpg`
            }
          ]
        },
        '送信者': {  // LINEユーザー名を保存
          rich_text: [
            {
              text: {
                content: userName
              }
            }
          ]
        },
        '受信日時': {  // システム受信日時
          date: {
            start: dateString
          }
        }
      }
    };
    
    console.log('Notion API リクエスト:', JSON.stringify(payload, null, 2));
    
    const response = UrlFetchApp.fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload)
    });
    
    console.log('Notion APIレスポンス:', response.getResponseCode(), response.getContentText());
    
    if (response.getResponseCode() === 200) {
      console.log('Successfully created Notion page with file');
      return JSON.parse(response.getContentText());
    } else {
      console.error('Error creating Notion page:', response.getContentText());
      return false;
    }
    
  } catch (error) {
    console.error('Error creating Notion database entry:', error);
    return false;
  }
}

/**
 * LINEユーザー名を取得
 */
function getUserName(userId) {
  try {
    const url = `https://api.line.me/v2/bot/profile/${userId}`;
    
    const response = UrlFetchApp.fetch(url, {
      headers: {
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`
      }
    });
    
    if (response.getResponseCode() === 200) {
      const profile = JSON.parse(response.getContentText());
      return profile.displayName;
    } else {
      console.error('Error getting user profile:', response.getContentText());
      return `User_${userId.substring(0, 8)}`; // フォールバック
    }
  } catch (error) {
    console.error('Error getting user name:', error);
    return `User_${userId.substring(0, 8)}`; // フォールバック
  }
}

/**
 * LINEユーザーに返信
 */
function replyToUser(replyToken, message) {
  try {
    const payload = {
      replyToken: replyToken,
      messages: [
        {
          type: 'text',
          text: message
        }
      ]
    };
    
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload)
    });
  } catch (error) {
    console.error('Error replying to user:', error);
  }
}

/**
 * LINE Webhookの署名検証
 */
function verifySignature(body, headers) {
  // 実際の実装では、LINE Channel Secretを使って署名を検証
  // セキュリティ上重要なので必ず実装してください
  return true; // 簡略化のため常にtrueを返す
}

/**
 * 初期設定用の関数（手動実行）
 */
function setupWebhook() {
  // GASのWebアプリURLを取得してLINE Messaging APIのWebhook URLに設定
  const webAppUrl = ScriptApp.getService().getUrl();
  console.log('Webhook URL:', webAppUrl);
  console.log('このURLをLINE Messaging APIのWebhook URLに設定してください');
}

/**
 * Webhook接続テスト用関数
 */
function doGet(e) {
  // GETリクエストでのテスト用
  return ContentService.createTextOutput('LINE Bot is running!').setMimeType(ContentService.MimeType.TEXT);
}

/**
 * 手動でWebhookをテストする関数
 */
function testWebhook() {
  const testData = {
    events: [
      {
        type: 'message',
        message: {
          type: 'text',
          text: 'test'
        },
        source: {
          userId: 'test-user-id'
        },
        replyToken: 'test-reply-token',
        timestamp: Date.now()
      }
    ]
  };
  
  const mockEvent = {
    postData: {
      contents: JSON.stringify(testData)
    }
  };
  
  const result = doPost(mockEvent);
  console.log('Test result:', result.getContent());
}

/**
 * Notionデータベースの構造を確認する関数
 */
function checkNotionDatabase() {
  try {
    const response = UrlFetchApp.fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}`, {
      headers: {
        'Authorization': `Bearer ${NOTION_API_TOKEN}`,
        'Notion-Version': '2022-06-28'
      }
    });
    
    const database = JSON.parse(response.getContentText());
    console.log('Database properties:', Object.keys(database.properties));
    
    return database;
  } catch (error) {
    console.error('Error checking database:', error);
  }
}

/**
 * デバッグ用：各種設定と接続をテスト
 */
function debugConfiguration() {
  console.log('=== 設定確認 ===');
  console.log('LINE_CHANNEL_ACCESS_TOKEN:', LINE_CHANNEL_ACCESS_TOKEN ? '設定済み' : '未設定');
  console.log('NOTION_API_TOKEN:', NOTION_API_TOKEN ? '設定済み' : '未設定');
  console.log('NOTION_DATABASE_ID:', NOTION_DATABASE_ID ? '設定済み' : '未設定');
  
  // Notionデータベース接続テスト
  try {
    const response = UrlFetchApp.fetch(`https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}`, {
      headers: {
        'Authorization': `Bearer ${NOTION_API_TOKEN}`,
        'Notion-Version': '2022-06-28'
      }
    });
    
    console.log('Notion接続テスト:', response.getResponseCode());
    if (response.getResponseCode() === 200) {
      const database = JSON.parse(response.getContentText());
      console.log('データベース名:', database.title[0]?.plain_text);
      console.log('プロパティ:', Object.keys(database.properties));
    } else {
      console.error('Notion接続エラー:', response.getContentText());
    }
  } catch (error) {
    console.error('Notion接続テストエラー:', error);
  }
  
  // Notion File Upload API接続テスト
  try {
    const testPayload = {
      filename: 'test.jpg',
      content_type: 'image/jpeg'
    };
    
    const response = UrlFetchApp.fetch('https://api.notion.com/v1/file_uploads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_API_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(testPayload)
    });
    
    console.log('Notion File Upload API接続テスト:', response.getResponseCode());
    if (response.getResponseCode() === 200) {
      console.log('File Upload API: 正常');
    } else {
      console.error('File Upload APIエラー:', response.getContentText());
    }
  } catch (error) {
    console.error('File Upload API接続テストエラー:', error);
  }
}