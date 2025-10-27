"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const dotenv_1 = require("dotenv");
const transcribe_1 = __importDefault(require("../api/transcribe"));
(0, dotenv_1.config)();
function augmentResponse(res) {
    const augmented = res;
    augmented.status = (code) => {
        augmented.statusCode = code;
        return augmented;
    };
    augmented.json = (body) => {
        if (!augmented.headersSent) {
            augmented.setHeader('Content-Type', 'application/json');
        }
        augmented.end(JSON.stringify(body));
    };
    return augmented;
}
const server = http_1.default.createServer(async (req, res) => {
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
        await (0, transcribe_1.default)(req, augmentedRes);
        if (!augmentedRes.writableEnded) {
            augmentedRes.end();
        }
    }
    catch (error) {
        console.error('[local-server] handler error:', error);
        if (!augmentedRes.headersSent) {
            augmentedRes.status(500).json({ error: 'Internal Server Error' });
        }
        else if (!augmentedRes.writableEnded) {
            augmentedRes.end();
        }
    }
});
const port = Number(process.env.PORT || 3000);
server.listen(port, () => {
    console.log(`[local-server] Listening on http://localhost:${port}/api/transcribe`);
});
