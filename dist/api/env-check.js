"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
async function handler(req, res) {
    console.log('Environment check API called');
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    try {
        const envCheck = {
            SUBTITLE_API_KEY: process.env.SUBTITLE_API_KEY ? 'SET' : 'NOT_SET',
            OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT_SET',
            NODE_ENV: process.env.NODE_ENV || 'undefined'
        };
        console.log('Environment variables:', envCheck);
        return res.status(200).json({
            message: 'Environment check',
            environment: envCheck,
            timestamp: new Date().toISOString()
        });
    }
    catch (e) {
        console.error('Environment check error:', e);
        return res.status(500).json({ error: String(e?.message || e) });
    }
}
