# subtitle-api (Vercel Serverless)

## Env
- OPENAI_API_KEY: your OpenAI key
- SUBTITLE_API_KEY: any long random secret (must match GPTs Action header `X-API-Key`)

## Deploy
- Vercel Project: Framework=Other / Build/Output/Install: empty
- `vercel.json` sets Node20 etc.

## Test
curl -X POST "https://<your>.vercel.app/api/transcribe" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: <SUBTITLE_API_KEY>" \
  -d '{"file_url":"https://example.com/sample.mp4","output_format":"srt"}'
