import dotenv from "dotenv";
dotenv.config();
import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import { transcribeWav, TranscriptResult } from "./stt";
import { segmentsToSrt, Seg } from "./srt";

const app = express();
app.use(express.json({ limit: "10mb" }));

// Simple helper
function sh(cmd: string) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString();
}

app.get("/healthz", (_req, res) => res.send("ok"));

// ファイル処理用のメインエンドポイント
app.post("/jobs", async (req, res) => {
  try {
    const { file_path, lang = "auto" } = req.body as { file_path: string; lang?: string };
    if (!file_path) return res.status(400).json({ error: "file_path required" });

    // ファイルの存在確認
    if (!fs.existsSync(file_path)) {
      return res.status(400).json({ error: "File not found" });
    }

    const jobId = crypto.randomBytes(8).toString("hex");
    const workDir = path.join(process.cwd(), "out", jobId);
    fs.mkdirSync(workDir, { recursive: true });

    const wav = path.join(workDir, "audio.wav");
    const srt = path.join(workDir, "out.srt");

    // 1) Extract audio (16kHz mono wav)
    sh(`ffmpeg -y -i "${file_path}" -vn -ac 1 -ar 16000 "${wav}"`);

    // 2) Transcribe
    const tr: TranscriptResult = await transcribeWav(wav, lang);

    // 3) Build SRT (prefer segments; fallback to single block if not available)
    let body = "";
    if (tr.segments && tr.segments.length > 0) {
      body = segmentsToSrt(tr.segments);
    } else {
      body = fallbackSingleSrt(tr.text || ""); // minimal fallback
    }
    fs.writeFileSync(srt, body, "utf-8");

    const base = `${req.protocol}://${req.get("host")}`;
    const srtUrl = `${base}/artifacts/${jobId}/out.srt`;
    res.json({ id: jobId, srt_url: srtUrl, text_preview: (tr.text || "").slice(0, 200) });
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e?.message || "internal_error" });
  }
});

function fallbackSingleSrt(text: string) {
  const one = text.trim() || "(no speech recognized)";
  return `1\n00:00:00,000 --> 00:59:59,000\n${one}\n`;
}

// static artifacts
app.use("/artifacts", express.static("out"));

const port = Number(process.env.PORT || 8787);
app.listen(port, () => console.log(`subtitle-api listening on :${port}`));
