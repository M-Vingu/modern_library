function getBaseUrl() {
  return String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
}

function getApiKey() {
  return String(process.env.OPENAI_API_KEY || '').trim();
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const chunks = [];
  for (const item of payload?.output || []) {
    for (const contentItem of item?.content || []) {
      if (typeof contentItem?.text === 'string' && contentItem.text.trim()) {
        chunks.push(contentItem.text.trim());
      }
    }
  }

  return chunks.join('\n').trim();
}

async function requestOpenAiJson({ model, input, timeoutMs = 15000 }) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getBaseUrl()}/responses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, input }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorText.slice(0, 300)}`);
    }

    const payload = await response.json();
    const outputText = extractOutputText(payload);

    if (!outputText) throw new Error('OpenAI API returned empty output');
    return {
      parsed: JSON.parse(outputText),
      usage: payload.usage || {},
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { extractOutputText, requestOpenAiJson };
