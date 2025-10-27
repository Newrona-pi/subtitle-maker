"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
async function handler(req, res) {
    console.log('Test API called with method:', req.method);
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    // 認証チェック
    const expected = process.env.SUBTITLE_API_KEY;
    if (!expected) {
        return res.status(500).json({ error: 'Server not configured' });
    }
    const headerVal = req.headers['x-api-key'];
    const apiKey = Array.isArray(headerVal) ? headerVal[0] : headerVal;
    if (!apiKey || apiKey !== expected) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        // シンプルなレスポンス
        return res.status(200).json({
            message: 'Test API is working',
            timestamp: new Date().toISOString()
        });
    }
    catch (e) {
        console.error('Test API error:', e);
        return res.status(500).json({ error: String(e?.message || e) });
    }
}
