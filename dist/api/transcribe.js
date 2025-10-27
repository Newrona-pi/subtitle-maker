"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
const openai_1 = require("openai");
const uploads_1 = require("openai/uploads");
function textToSrt(text) {
    const lines = text.split(/\r?\n/).filter(Boolean);
    return lines
        .map((line, i) => {
        const start = `00:00:${String(i).padStart(2, '0')},000`;
        const end = `00:00:${String(i + 1).padStart(2, '0')},000`;
        return `${i + 1}\n${start} --> ${end}\n${line}\n`;
    })
        .join('\n');
}
async function handler(req, res) {
    if (req.method !== 'POST')
        return res.status(405).json({ error: 'Method Not Allowed' });
    // ---- Auth ------------------------------------------------------
    const expected = process.env.SUBTITLE_API_KEY;
    if (!expected)
        return res.status(500).json({ error: 'Server not configured' });
    const headerVal = req.headers['x-api-key'];
    const apiKey = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    if (!apiKey || apiKey !== expected)
        return res.status(401).json({ error: 'Unauthorized' });
    try {
        // bodyが string の場合に備えてパース
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body ?? {});
        const { file_url, file_id, output_format = 'srt', language, } = body;
        if (!file_url && !file_id) {
            return res.status(422).json({ error: 'file_url or file_id is required' });
        }
        const client = new openai_1.OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        // ---- Fetch file bytes ----------------------------------------
        let buf;
        if (file_url) {
            const r = await fetch(file_url);
            if (!r.ok)
                throw new Error(`fetch file_url failed: ${r.status}`);
            buf = Buffer.from(await r.arrayBuffer());
        }
        else {
            const response = await client.files.content(file_id);
            const arrayBuffer = await response.arrayBuffer();
            buf = Buffer.from(arrayBuffer);
        }
        // ---- OpenAI Transcribe (File 未定義対策に toFile を使用) ------
        const tx = await client.audio.transcriptions.create({
            model: 'gpt-4o-transcribe',
            file: await (0, uploads_1.toFile)(buf, 'input.mp4', { type: 'audio/mp4' }),
            // language, // 必要なら有効化！APIの仕様に合わせて調整
            response_format: 'verbose_json',
        });
        const text = tx.text || '';
        const preview = text.slice(0, 2000);
        if (output_format === 'text') {
            return res.status(200).json({ format: 'text', text, text_preview: preview });
        }
        if (output_format === 'vtt') {
            const vtt = 'WEBVTT\n\n' + textToSrt(text).replace(/,000/g, '.000');
            return res.status(200).json({ format: 'vtt', vtt, text_preview: preview });
        }
        const srt = textToSrt(text);
        return res.status(200).json({ format: 'srt', srt, text_preview: preview });
    }
    catch (e) {
        console.error(e);
        return res.status(500).json({ error: String(e?.message || e) });
    }
}
