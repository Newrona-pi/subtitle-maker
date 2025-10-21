import OpenAI from "openai";
import fs from "node:fs";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type Seg = { start: number; end: number; text: string };
export type TranscriptResult = { text?: string; segments: Seg[] };

export async function transcribeWav(wavPath: string, lang?: string): Promise<TranscriptResult> {
  const model = process.env.TRANSCRIBE_MODEL || "gpt-4o-transcribe";

  // Try verbose_json first (segments included). Fall back to plain text if not supported.
  try {
    const res: any = await client.audio.transcriptions.create({
      file: fs.createReadStream(wavPath) as any,
      model,
      // language: lang && lang !== "auto" ? lang : undefined,  // enable if supported in your model/SDK
      response_format: "verbose_json"
    });

    const text: string | undefined = res?.text || res?.results?.text || undefined;
    const segments: Seg[] = (res?.segments || []).map((s: any) => ({
      start: typeof s.start === "number" ? s.start : parseFloat(s.start),
      end: typeof s.end === "number" ? s.end : parseFloat(s.end),
      text: s.text ?? ""
    }));

    if (segments.length > 0 || text) return { text, segments };
  } catch (err) {
    // fall through to plain text request
    console.warn("[transcribeWav] verbose_json not supported; falling back to plain text:", (err as any)?.message);
  }

  // Fallback: request plain text
  const plain: any = await client.audio.transcriptions.create({
    file: fs.createReadStream(wavPath) as any,
    model
  });
  const text: string | undefined = plain?.text ? String(plain.text) : String(plain);
  return { text, segments: [] };
}
