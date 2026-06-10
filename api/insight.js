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
        max_tokens: 2000,
        temperature: 0.3,
        messages: [
          {
            role: 'system',
            content: 'You are a particle coordinate generator. You MUST respond with ONLY a raw JSON array. No markdown, no explanation, no code blocks, no backticks. Just the array starting with [ and ending with ]. Example of valid response: [[-0.5,0.2],[0.3,-0.1],[0.8,0.5]]'
          },
          {
            role: 'user',
            content: `Generate 300 [x,y] coordinate pairs (x and y between -1 and 1) that form the shape of: ${prompt}. Trace the outline and fill the interior. Return ONLY the JSON array.`
          }
        ]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq API error:', response.status, errText);
      return res.status(500).json({ error: `Groq API error: ${response.status}` });
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || '';

    if (!rawText) {
      console.error('Empty response from Groq');
      return res.status(500).json({ error: 'Empty response from model' });
    }

    // Aggressive cleaning
    let clean = rawText
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/^\s*Here.*?:/mi, '')
      .trim();

    // Extract just the array if there's surrounding text
    const arrayMatch = clean.match(/\[[\s\S]*\]/);
    if (!arrayMatch) {
      console.error('No array found in response:', rawText.slice(0, 200));
      return res.status(500).json({ error: 'No valid array in response', raw: rawText.slice(0, 200) });
    }

    const points = JSON.parse(arrayMatch[0]);

    if (!Array.isArray(points) || points.length === 0) {
      return res.status(500).json({ error: 'Invalid points array' });
    }

    return res.status(200).json({ points });

  } catch (err) {
    console.error('Shape generation error:', err);
    return res.status(500).json({ error: err.message });
  }
}
