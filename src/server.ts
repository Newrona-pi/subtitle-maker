import http from 'http';
import { config as loadEnv } from 'dotenv';
import handler from '../api/transcribe';

loadEnv();

type VercelLikeResponse = http.ServerResponse & {
  status: (code: number) => VercelLikeResponse;
  json: (body: unknown) => void;
};

function augmentResponse(res: http.ServerResponse): VercelLikeResponse {
  const augmented = res as VercelLikeResponse;
  augmented.status = (code: number) => {
    augmented.statusCode = code;
    return augmented;
  };
  augmented.json = (body: unknown) => {
    if (!augmented.headersSent) {
      augmented.setHeader('Content-Type', 'application/json');
    }
    augmented.end(JSON.stringify(body));
  };
  return augmented;
}

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.statusCode = 400;
    res.end('Bad Request');
    return;
  }

  if (req.url !== '/api/transcribe') {
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  const augmentedRes = augmentResponse(res);

  try {
    await handler(req as any, augmentedRes);
    if (!augmentedRes.writableEnded) {
      augmentedRes.end();
    }
  } catch (error) {
    console.error('[local-server] handler error:', error);
    if (!augmentedRes.headersSent) {
      augmentedRes.status(500).json({ error: 'Internal Server Error' });
    } else if (!augmentedRes.writableEnded) {
      augmentedRes.end();
    }
  }
});

const port = Number(process.env.PORT || 3000);

server.listen(port, () => {
  console.log(`[local-server] Listening on http://localhost:${port}/api/transcribe`);
});
