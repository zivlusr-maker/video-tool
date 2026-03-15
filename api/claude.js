export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (req.body && req.body.__ping) return res.status(200).json({ ok: true });

  const gKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

  // Veo 视频生成 (predictLongRunning)
  if (req.body && req.body.__veo) {
    if (!gKey) return res.status(503).json({ error: 'GOOGLE_API_KEY not configured' });
    const { model, body: veoBody } = req.body;
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:predictLongRunning?key=${gKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veoBody) }
      );
      const text = await r.text();
      if (!text) return res.status(200).json({ error: 'Empty response from Veo API' });
      try {
        return res.status(r.status).json(JSON.parse(text));
      } catch(e) {
        return res.status(200).json({ error: 'Veo response parse error: ' + text.substring(0, 200) });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Veo 轮询进度
  if (req.body && req.body.__veo_poll) {
    if (!gKey) return res.status(503).json({ error: 'GOOGLE_API_KEY not configured' });
    const { opName } = req.body;
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${opName}?key=${gKey}`
      );
      const text = await r.text();
      if (!text) return res.status(200).json({ done: false });
      try {
        return res.status(r.status).json(JSON.parse(text));
      } catch(e) {
        return res.status(200).json({ error: 'Poll parse error: ' + text.substring(0, 200) });
      }
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Gemini 文本/图片生成
  if (req.body && req.body.__gemini) {
    if (!gKey) return res.status(503).json({ error: 'GOOGLE_API_KEY not configured' });
    const { model, body: geminiBody } = req.body;
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(geminiBody) }
      );
      const d = await r.json();
      return res.status(r.status).json(d);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  // Claude 文本生成
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not configured' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
