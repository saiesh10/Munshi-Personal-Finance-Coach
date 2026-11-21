/**
 * @file lib/engine/ai.js
 * Safe Gemini client and AI fallback wrappers.
 * Adheres strictly to zero-leak privacy, timeouts, and quota backoff.
 */

class AiUnavailableError extends Error {
  constructor(message = 'Gemini API key is not configured or service is unavailable') {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

/**
 * Call Gemini REST API directly using global fetch with timeout and single retry.
 * @param {Object} options
 * @param {string} options.prompt
 * @param {string} [options.system]
 * @param {boolean} [options.json=false]
 * @param {number} [options.maxTokens=512]
 * @returns {Promise<string>}
 */
async function callGemini({ prompt, system = '', json = false, maxTokens = 512 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new AiUnavailableError('GEMINI_API_KEY environment variable is not set');
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const contents = [];
  if (system) {
    contents.push({
      role: 'user',
      parts: [{ text: `Instructions: ${system}\n\nTask: ${prompt}` }]
    });
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });
  }

  const payload = {
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.2
    }
  };

  if (json) {
    payload.generationConfig.responseMimeType = 'application/json';
  }

  async function makeRequest() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second timeout

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        const err = new Error(`Gemini API error ${res.status}: ${errorText}`);
        err.status = res.status;
        throw err;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return text.trim();
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  try {
    return await makeRequest();
  } catch (err) {
    // Retry once on 429 or 5xx with 600ms backoff
    if (err.status === 429 || (err.status >= 500 && err.status < 600) || err.name === 'AbortError') {
      await new Promise(r => setTimeout(r, 600));
      return await makeRequest();
    }
    throw err;
  }
}

/**
 * Safely parse JSON from raw LLM output.
 * Strips markdown code blocks.
 * @param {string} raw
 * @returns {any}
 */
function cleanAndParseJson(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let cleaned = raw.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Categorize unknown merchant keys in a single batch call.
 * Never leaks full SMS or account numbers; only sends merchant keys.
 * @param {string[]} merchantKeys
 * @param {string[]} validCategories
 * @returns {Promise<Record<string, string>>}
 */
async function categorizeUnknownMerchants(merchantKeys, validCategories) {
  if (!Array.isArray(merchantKeys) || merchantKeys.length === 0) {
    return {};
  }

  const prompt = `Classify these Indian merchant names into exactly one of these categories:
Categories: ${validCategories.join(', ')}

Merchants:
${merchantKeys.map(k => `- ${k}`).join('\n')}

Respond ONLY with a JSON array of objects:
[{"merchantKey": "MERCHANT", "category": "Category Name"}]`;

  try {
    const raw = await callGemini({
      prompt,
      system: 'You are a precise transaction classification assistant. Output valid JSON only.',
      json: true,
      maxTokens: 512
    });

    const parsed = cleanAndParseJson(raw);
    const result = {};

    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && item.merchantKey && item.category && validCategories.includes(item.category)) {
          result[item.merchantKey.toUpperCase()] = item.category;
        }
      }
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * Parse unreadable SMS lines via Gemini fallback (capped at 10 lines).
 * @param {string[]} lines
 * @returns {Promise<Array<Object>>}
 */
async function parseUnreadableSmsLines(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return [];
  }

  const candidateLines = lines.slice(0, 10);
  const prompt = `Extract transaction details from these unparsed Indian SMS/alert strings.
Only include transactions that represent confirmed settlements (ignore OTPs, promo messages, or login alerts).

Lines:
${candidateLines.map((l, i) => `${i + 1}. ${l}`).join('\n')}

Return a JSON array of objects with:
[
  {
    "rawText": "exact original line",
    "amount": 123.45,
    "date": "YYYY-MM-DD",
    "direction": "debit" or "credit",
    "merchant": "Clean Title Case Merchant",
    "merchantKey": "UPPERCASE_KEY"
  }
]`;

  try {
    const raw = await callGemini({
      prompt,
      system: 'You are an Indian financial SMS parsing engine. Output valid JSON only.',
      json: true,
      maxTokens: 768
    });

    const parsed = cleanAndParseJson(raw);
    if (!Array.isArray(parsed)) return [];

    let createHashFn = null;
    try {
      const crypto = require('crypto');
      if (crypto && typeof crypto.createHash === 'function') {
        createHashFn = (str) => crypto.createHash('sha256').update(str).digest('hex').slice(0, 16);
      }
    } catch {}

    const fallbackHash = (str) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
      }
      return 'ai_' + Math.abs(hash).toString(16).padStart(8, '0');
    };

    return parsed.filter(item => item && item.amount > 0 && item.direction).map(item => {
      const keyStr = `${item.date}|${item.amount}|${item.merchantKey}|${item.rawText}`;
      const id = createHashFn ? createHashFn(keyStr) : fallbackHash(keyStr);
      return {
        id,
        date: item.date || new Date().toISOString().slice(0, 10),
        amount: Number(item.amount),
        direction: item.direction === 'credit' ? 'credit' : 'debit',
        merchant: item.merchant || 'Unknown Merchant',
        merchantKey: (item.merchantKey || 'UNKNOWN').toUpperCase(),
        category: 'Other',
        categorySource: 'ai',
        rawText: item.rawText || ''
      };
    });
  } catch {
    return [];
  }
}

module.exports = {
  callGemini,
  cleanAndParseJson,
  categorizeUnknownMerchants,
  parseUnreadableSmsLines,
  AiUnavailableError
};
