# subtitle-api (Soft-Subtitle/SRT generator for GPTs)

**目的**: ローカル動画ファイルを渡すと、OpenAIの文字起こしAPIで**SRT（ソフト字幕）**を生成し、ダウンロードURLを返す最小APIです。  
GPTs（Custom Action）からこのAPIを呼び出せば、**会話UIで字幕作成を自動化**できます。

---

## ✅ できること
- ローカル動画ファイルを受け取る → ffmpegで音声抽出（16kHz mono）
- OpenAI Audio Transcription（`gpt-4o-transcribe` など）で文字起こし
- **タイムスタンプつきセグメント → SRT**へ変換（セグメントが無い場合はテキストのみの単一字幕を出力・要改善）
- 生成した `out/<jobId>/out.srt` を静的配信（ダウンロードURLを返却）

## 🧩 フォルダ構成
```text
subtitle-api/
  ├─ src/
  │   ├─ index.ts      # Express API本体（/jobs）
  │   ├─ stt.ts        # 文字起こし呼び出し（OpenAI）
  │   └─ srt.ts        # セグメント→SRT変換ユーティリティ
  ├─ openapi.yaml      # GPTs用のActions定義（最小）
  ├─ package.json
  ├─ tsconfig.json
  ├─ .env.example
  ├─ .gitignore
  └─ Dockerfile
```

---

## 🚀 セットアップ
1. **ffmpeg** をインストール（macOS: `brew install ffmpeg`、Ubuntu: `apt-get install -y ffmpeg` など）  
2. 依存関係のインストール
   ```bash
   npm install
   ```
3. `.env.example` を `.env` にリネームして編集
   ```ini
   OPENAI_API_KEY=sk-xxx_your_key_here
   PORT=8787
   TRANSCRIBE_MODEL=gpt-4o-transcribe
   ```
4. 開発起動（ts-node）
   ```bash
   npm run dev
   # => http://localhost:8787
   ```

> Dockerを使う場合：
> ```bash
> docker build -t subtitle-api .
> docker run --rm -p 8787:8787 --env-file .env subtitle-api
> ```

---

## 🧪 動作確認（ローカル動画ファイルの例）
```bash
curl -s -X POST http://localhost:8787/jobs     -H "Content-Type: application/json"     -d '{"file_path":"C:\\videos\\sample.mp4"}' | jq
```
レスポンス例:
```json
{
  "id": "b1c2d3e4f5a6b7c8",
  "srt_url": "http://localhost:8787/artifacts/b1c2d3e4f5a6b7c8/out.srt",
  "text_preview": "・・・（冒頭テキスト）"
}
```
`srt_url` をブラウザで開くとダウンロードできます。

---

## 🧠 GPTs（Custom Action）接続
1. ChatGPT → **Explore GPTs** → **Create a GPT**
2. **Actions** → **Add Action** → `openapi.yaml` を貼り付け
3. 保存 → あなたのGPTから動画URLを渡すとこのAPIの`/jobs`が呼ばれ、SRTリンクが返ります。

---

## 📌 注意・拡張ポイント
- **セグメントが取れない**（APIによっては`text`のみ）場合、`src/index.ts` の `fallbackSingleSrt` が使われます。実運用では `src/stt.ts` のレスポンス形に合わせてセグメント生成ロジックを最適化してください。
- 大容量は **URL渡し** を原則にし、ファイル直添付は避けるのが安全です。
- 本番では生成物を **S3 / GCS / R2** にアップロードして**署名付きURL**で返す構成が推奨です（本テンプレートはローカル静的配信）。
- Whisper系モデルや `gpt-4o-transcribe` の最新仕様・料金はOpenAI公式ドキュメントを確認してください。

---

## 📞 エンドポイント
- `POST /jobs`
  - 入力: `{ "file_path": "C:\\videos\\sample.mp4" , "lang": "auto" }`
  - 出力: `{ "id": "...", "srt_url": "http://.../out.srt", "text_preview": "..." }`

---

## 🔒 ライセンス
MIT
