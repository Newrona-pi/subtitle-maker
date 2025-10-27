"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeWav = transcribeWav;
const openai_1 = __importDefault(require("openai"));
const client = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
async function transcribeWav(audioBuffer, lang) {
    const model = process.env.TRANSCRIBE_MODEL || "whisper-1";
    // Create a File-like object from Buffer
    const audioFile = new File([audioBuffer.buffer], 'audio.wav', { type: 'audio/wav' });
    // Try verbose_json first (segments included). Fall back to plain text if not supported.
    try {
        const res = await client.audio.transcriptions.create({
            file: audioFile,
            model,
            language: lang && lang !== "auto" ? lang : undefined,
            response_format: "verbose_json"
        });
        const text = res?.text || res?.results?.text || undefined;
        const segments = (res?.segments || []).map((s) => ({
            start: typeof s.start === "number" ? s.start : parseFloat(s.start),
            end: typeof s.end === "number" ? s.end : parseFloat(s.end),
            text: s.text ?? ""
        }));
        if (segments.length > 0 || text)
            return { text, segments };
    }
    catch (err) {
        // fall through to plain text request
        console.warn("[transcribeWav] verbose_json not supported; falling back to plain text:", err?.message);
    }
    // Fallback: request plain text
    const plain = await client.audio.transcriptions.create({
        file: audioFile,
        model,
        language: lang && lang !== "auto" ? lang : undefined
    });
    const text = plain?.text ? String(plain.text) : String(plain);
    return { text, segments: [] };
}
