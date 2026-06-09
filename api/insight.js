export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        max_tokens: 1000,
        messages: [
          {
            role: 'system',
            content: `You are a particle shape generator. Given a description, return ONLY a JSON array of [x,y] coordinate pairs forming the outline and silhouette of that shape.
Rules:
- Coordinates normalized: x between -1 and 1, y between -1 and 1
- Return between 250 and 500 points
- Trace the outline AND add internal points for density
- Return ONLY the raw JSON array, no explanation, no markdown, no code block
- Example: [[-0.5,0],[0,0.8],[0.5,0]]`
          },
          {
            role: 'user',
            content: `Generate particle coordinates for: "${prompt}"`
          }
        ]
      })
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g, '').trim();
    const points = JSON.parse(clean);

    if (!Array.isArray(points) || points.length === 0) {
      return res.status(500).json({ error: 'Invalid response from model' });
    }

    return res.status(200).json({ points });
  } catch (err) {
    console.error('Shape generation error:', err);
    return res.status(500).json({ error: err.message });
  }
}
