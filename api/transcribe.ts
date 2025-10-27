import type { IncomingMessage, ServerResponse } from 'http';
import Busboy from 'busboy';
import type { FileInfo, FieldInfo } from 'busboy';
import type { Readable } from 'stream';
import { OpenAI } from 'openai';
import { toFile } from 'openai/uploads';

type VercelRequest = IncomingMessage & {
  body?: unknown;
};

type VercelResponse = ServerResponse & {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

type OutputFormat = 'srt' | 'vtt' | 'text';

function getHeader(headers: VercelRequest['headers'], name: string) {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  return value;
}

async function parseJsonBody(req: VercelRequest) {
  if (req.body !== undefined && req.body !== null) return req.body;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (!chunks.length) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function parseMultipart(req: VercelRequest) {
  return new Promise<{
    buffer: Buffer;
    filename?: string;
    mimeType?: string;
    fields: Record<string, string>;
  }>((resolve, reject) => {
    const busboy = Busboy({ 
      headers: req.headers,
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit
        files: 1,
        fields: 10
      },
      preservePath: false
    });
    const fields: Record<string, string> = {};
    const fileChunks: Buffer[] = [];
    let filename: string | undefined;
    let mimeType: string | undefined;
    let fileCaptured = false;

    busboy.on(
      'file',
      (_field: string, file: Readable & { truncated?: boolean }, info: FileInfo) => {
        if (fileCaptured) {
          file.resume();
          return;
        }
        fileCaptured = true;
        filename = info.filename;
        mimeType = info.mimeType;
        file.on('data', (data: Buffer) => {
          fileChunks.push(data);
        });
        file.on('limit', () => {
          reject(new Error('Uploaded file exceeded configured size limit'));
          file.resume();
        });
        file.on('error', reject);
      },
    );

    busboy.on('field', (fieldname: string, value: string, _info: FieldInfo) => {
      fields[fieldname] = value;
    });

    busboy.on('error', reject);

    busboy.on('finish', () => {
      if (!fileCaptured) {
        reject(new Error('No file field found in multipart payload'));
        return;
      }
      resolve({
        buffer: Buffer.concat(fileChunks),
        filename,
        mimeType,
        fields,
      });
    });

    req.pipe(busboy);
  });
}

function resolveOutputFormat(value?: string): OutputFormat {
  if (value === 'vtt') return 'vtt';
  if (value === 'text') return 'text';
  return 'srt';
}

function textToSrt(text: string) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  return lines
    .map((line, i) => {
      const start = `00:00:${String(i).padStart(2, '0')},000`;
      const end = `00:00:${String(i + 1).padStart(2, '0')},000`;
      return `${i + 1}\n${start} --> ${end}\n${line}\n`;
    })
    .join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  // ---- Auth ------------------------------------------------------
  const expected = process.env.SUBTITLE_API_KEY;
  if (!expected) return res.status(500).json({ error: 'Server not configured' });
  const headerVal = req.headers['x-api-key'];
  const apiKey =
    Array.isArray(headerVal) ? headerVal[0] : (headerVal as string | undefined);
  if (!apiKey || apiKey !== expected) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const contentType = getHeader(req.headers, 'content-type');
    const isMultipart =
      typeof contentType === 'string' && contentType.includes('multipart/form-data');

    let fileBuffer: Buffer | undefined;
    let providedFileName: string | undefined;
    let providedMime: string | undefined;
    let file_url: string | undefined;
    let file_id: string | undefined;
    let output_format: OutputFormat = 'srt';
    let language: string | undefined;

    if (isMultipart) {
      const { buffer, filename, mimeType, fields } = await parseMultipart(req);
      fileBuffer = buffer;
      providedFileName = filename;
      providedMime = mimeType;
      file_url = fields.file_url;
      file_id = fields.file_id;
      output_format = resolveOutputFormat(fields.output_format);
      language = fields.language;
    } else {
      const rawBody = await parseJsonBody(req);
      const body =
        typeof rawBody === 'string' ? JSON.parse(rawBody) : (rawBody ?? {});

      ({
        file_url,
        file_id,
        output_format = 'srt',
        language,
      } = body as {
        file_url?: string;
        file_id?: string;
        output_format?: OutputFormat;
        language?: string;
      });
      output_format = resolveOutputFormat(output_format);
    }

    if (!fileBuffer && !file_url && !file_id) {
      return res.status(422).json({ error: 'file, file_url or file_id is required' });
    }

    // ---- Fetch file bytes ----------------------------------------
    let buf: Buffer;
    if (fileBuffer) {
      buf = fileBuffer;
    } else if (file_url) {
      const r = await fetch(file_url);
      if (!r.ok) throw new Error(`fetch file_url failed: ${r.status}`);
      buf = Buffer.from(await r.arrayBuffer());
    } else {
      const response = await client.files.content(file_id!);
      const arrayBuffer = await response.arrayBuffer();
      buf = Buffer.from(arrayBuffer);
    }

    const filename = providedFileName || 'input.mp4';
    const mimeType = providedMime || 'audio/mp4';

    // ---- OpenAI Transcribe ---------------------------------------
    const tx = await client.audio.transcriptions.create({
      model: 'gpt-4o-transcribe',
      file: await toFile(buf, filename, { type: mimeType }),
      ...(language ? { language } : {}),
      response_format: 'json',
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
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}
