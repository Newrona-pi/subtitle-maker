import { readFileSync, writeFileSync } from 'fs';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// .envファイルを読み込み
dotenv.config();

// OpenAIクライアントを初期化（環境変数からAPIキーを取得）
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generateSubtitle() {
  try {
    console.log('動画ファイルを読み込み中...');
    const videoBuffer = readFileSync('ssstik.io_@jyuno_o_1761268362528.mp4');
    
    console.log('音声を文字起こし中...');
    const transcription = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file: new File([videoBuffer], 'video.mp4', { type: 'video/mp4' }),
      response_format: 'verbose_json',
    });

    console.log('文字起こし完了');
    console.log('テキスト:', transcription.text);
    
    // セグメントがある場合はそれを使用、ない場合はテキストを分割
    let segments = [];
    if (transcription.segments && transcription.segments.length > 0) {
      segments = transcription.segments.map(seg => ({
        start: seg.start,
        end: seg.end,
        text: seg.text
      }));
    } else {
      // テキストを時間ベースで分割（仮想的な時間設定）
      const words = transcription.text.split(' ');
      const wordsPerSegment = 10; // 1セグメントあたりの単語数
      
      for (let i = 0; i < words.length; i += wordsPerSegment) {
        const segmentWords = words.slice(i, i + wordsPerSegment);
        segments.push({
          start: i * 2, // 2秒間隔で仮設定
          end: (i + wordsPerSegment) * 2,
          text: segmentWords.join(' ')
        });
      }
    }
    
    // SRT形式に変換
    const srtContent = segmentsToSrt(segments);
    
    // SRTファイルを保存
    const outputPath = 'ssstik.io_@jyuno_o_1761268362528.srt';
    writeFileSync(outputPath, srtContent, 'utf8');
    
    console.log(`字幕ファイルが生成されました: ${outputPath}`);
    
  } catch (error) {
    console.error('エラーが発生しました:', error);
  }
}

function segmentsToSrt(segments) {
  return segments
    .map((segment, index) => {
      const start = formatTime(segment.start);
      const end = formatTime(segment.end);
      return `${index + 1}\n${start} --> ${end}\n${segment.text}\n`;
    })
    .join('\n');
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds - Math.floor(seconds)) * 1000);
  
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
}

generateSubtitle();
