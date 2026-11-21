/**
 * @file lib/engine/letter.js
 * "Future You" letter generator with in-memory sliding-window IP rate limiting
 * and humanized fallback templates.
 */

const { callGemini, AiUnavailableError } = require('./ai');

// In-memory sliding-window rate limiter
// Map<ip, Array<timestampMs>>
const ipRequestWindows = new Map();

/**
 * Check and record an IP request against the sliding rate limit.
 * @param {string} ip
 * @param {number} [limitPerMin=20]
 * @returns {boolean} True if allowed, false if rate limited
 */
function checkRateLimit(ip, limitPerMin = 20) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const cutoff = now - windowMs;

  const timestamps = (ipRequestWindows.get(ip) || []).filter(ts => ts > cutoff);

  if (timestamps.length >= limitPerMin) {
    ipRequestWindows.set(ip, timestamps);
    return false;
  }

  timestamps.push(now);
  ipRequestWindows.set(ip, timestamps);
  return true;
}

/**
 * Format Indian rupee currency with commas.
 * @param {number} num
 * @returns {string}
 */
function formatRupees(num) {
  return '₹' + Math.abs(Math.round(num || 0)).toLocaleString('en-IN');
}

/**
 * Hand-written fallback templates chosen by fiscal situation.
 * Strictly plain text, warm, realistic, Indian English, 80-110 words.
 */
function getFallbackLetter(summary) {
  const goalName = summary.goalName || 'your goal';
  const targetDate = summary.goalDatePlan || 'the target date';
  const continueDate = summary.goalDateContinue || 'a little later';
  const monthlyNet = summary.monthlyNet || 0;
  const shortfall = summary.shortfallAtTarget || 0;
  const category = summary.topCategory || summary.topOverspendCategory || 'food and delivery';
  const cutPct = summary.cutPctNeeded ? `${summary.cutPctNeeded}%` : '20%';

  let text = '';

  if (monthlyNet <= 0) {
    // Net negative template
    text = `I am writing to you from ${targetDate}. Looking back, this was the month things came to a standstill with ${goalName}. We were spending every rupee that arrived, leaving zero cushion for tomorrow. The leak was not rent or bills—it was ${category}, quietly claiming our margin week after week. If you trim ${cutPct} from ${category} starting this pay cycle, you instantly free up breathing room. Take a quiet hour tonight and draw the line. You have pulled yourself out of tighter corners before.`;
  } else if (shortfall > 0) {
    // Will miss goal template
    text = `I am writing to you from ${targetDate}. We are close to ${goalName}, but we missed it by ${formatRupees(shortfall)}. It hurts because we could have made it without much sacrifice. The entire slip came down to ${category}. If you cut back just ${cutPct} on ${category} each month, the gap closes completely and we hit the number by ${targetDate} instead of drifting to ${continueDate}. Give yourself the gift of that discipline today. Your future self is counting on you.`;
  } else {
    // Will make it template
    text = `I am writing to you from ${targetDate}. You made it. ${goalName} is fully funded, and the quiet relief is hard to describe. Sticking to the plan and watching ${category} kept our monthly net steady at ${formatRupees(monthlyNet)}. Those evenings when you chose restraint over convenience paid for the peace of mind we have today. Hold on to this rhythm. You proved to yourself that you are someone who keeps promises to their future.`;
  }

  return {
    text,
    source: 'fallback',
    generatedAt: new Date().toISOString()
  };
}

/**
 * Clean LLM letter response and validate word count / formatting.
 * Must be 40 to 220 words and contain no markdown headers or bullet points.
 * @param {string} text
 * @returns {boolean}
 */
function isValidLetter(text) {
  if (!text || typeof text !== 'string') return false;
  // Disallow markdown bold, headers, bullets
  if (/[#*_`~]/.test(text) || /^\s*[-*•]\s+/m.test(text)) {
    return false;
  }

  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length >= 40 && words.length <= 220;
}

/**
 * Generate Future You letter via Gemini with automatic fallback on missing key,
 * rate limit, or format invalidation.
 * @param {Object} summary
 * @param {string} [clientIp='127.0.0.1']
 * @returns {Promise<import('../types').Letter>}
 */
async function generateLetter(summary, clientIp = '127.0.0.1') {
  const rateLimitPerMin = parseInt(process.env.RATE_LIMIT_PER_MIN || '20', 10);

  // Rate limiting check: on limit, return fallback letter gracefully
  if (!checkRateLimit(clientIp, rateLimitPerMin)) {
    return getFallbackLetter(summary);
  }

  const system = `You are the user's future self, writing a short, warm, plain-spoken letter in first person from the date they would reach, or miss, their goal. Indian English, no hype, no emojis, no bullet points. 80 to 110 words. Mention the goal, the exact rupee shortfall or surplus, the single category that matters most, and one concrete change with its rupee effect. End with one honest sentence of encouragement. Use only the numbers provided.`;

  // Privacy: prompt contains ONLY the summary numbers, never full SMS, accounts or transaction history
  const prompt = `Here is the current fiscal projection summary:
${JSON.stringify(summary, null, 2)}

Write the first-person letter now as plain text without any markdown or formatting.`;

  try {
    const rawLetter = await callGemini({
      system,
      prompt,
      json: false,
      maxTokens: 300
    });

    // Strip any accidental markdown formatting
    const cleaned = rawLetter
      .replace(/^["']|["']$/g, '')
      .replace(/[*#_~`]/g, '')
      .trim();

    if (isValidLetter(cleaned)) {
      return {
        text: cleaned,
        source: 'gemini',
        generatedAt: new Date().toISOString()
      };
    }

    return getFallbackLetter(summary);
  } catch (err) {
    // If Gemini fails or key missing, return human fallback seamlessly
    return getFallbackLetter(summary);
  }
}

module.exports = {
  generateLetter,
  getFallbackLetter,
  checkRateLimit,
  isValidLetter,
  formatRupees
};
