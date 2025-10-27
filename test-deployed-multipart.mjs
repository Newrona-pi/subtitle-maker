import { readFileSync } from 'fs';
import FormData from 'form-data';

// デプロイされたAPIのURL
const API_URL = 'https://subtitle-maker.vercel.app/api/transcribe';
const API_KEY = 'Xx7xVx1x_Mg8s4xV7q2G9nG4xNf0K1rQ-w3yZ8tJ2pL6mB4aC9rU2eD5qH7vW0y';

async function testDeployedMultipart() {
  try {
    console.log('デプロイ環境でmultipart/form-data方式をテスト中...');
    
    // 動画ファイルを読み込み
    const videoBuffer = readFileSync('ssstik.io_@zizikqindv0_1761540170273.mp4');
    
    // FormDataを作成（multipart/form-data）
    const formData = new FormData();
    formData.append('file', videoBuffer, {
      filename: 'test-video.mp4',
      contentType: 'video/mp4'
    });
    formData.append('output_format', 'srt');
    formData.append('language', 'ja');
    
    console.log('動画ファイルをアップロード中...');
    console.log('ファイルサイズ:', videoBuffer.length, 'bytes');
    
    // APIにリクエストを送信
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        ...formData.getHeaders()
      },
      body: formData
    });
    
    console.log('APIレスポンス:', response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('エラーレスポンス:', errorText);
      return;
    }
    
    const result = await response.json();
    console.log('デプロイmultipart方式テスト成功！');
    console.log('フォーマット:', result.format);
    console.log('テキストプレビュー:', result.text_preview);
    
    // SRTファイルを保存
    if (result.srt) {
      const fs = await import('fs');
      fs.writeFileSync('deployed-multipart-output.srt', result.srt, 'utf8');
      console.log('デプロイmultipart方式SRTファイルを保存しました: deployed-multipart-output.srt');
    }
    
  } catch (error) {
    console.error('デプロイmultipart方式テストに失敗しました:', error);
  }
}

testDeployedMultipart();
