/**
 * @file lib/engine/ask.js
 * "Future You" conversational engine.
 * Pure logic providing pre-computed simulation answers, Gemini generation,
 * sliding-window rate limiting, and conversational fallbacks.
 */

const { callGemini } = require('./ai');
const { checkRateLimit } = require('./letter');
const { simulate, formatMonthYear } = require('./simulate');

/**
 * Clean LLM answer and ensure it strictly contains no markdown and is under 70 words.
 * @param {string} text
 * @returns {boolean}
 */
function isValidSpokenAnswer(text) {
  if (!text || typeof text !== 'string') return false;
  // Strictly reject markdown tokens: bold, italics, headers, bullets, backticks
  if (/[#*_`~\[\]]/.test(text) || /^\s*[-*•]\s+/m.test(text) || /^\d+\.\s+/m.test(text)) {
    return false;
  }
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length >= 5 && words.length <= 70;
}

/**
 * Generate pre-computed deterministic answers for standard financial queries.
 * @param {string} question
 * @param {Object} summary
 * @returns {string | null}
 */
function getPrecomputedAnswer(question, summary = {}) {
  const q = question.toLowerCase().trim();

  const goalName = summary.goalName || 'your milestone';
  const targetDate = summary.goalDatePlan || 'the target date';
  const continueDate = summary.goalDateContinue || 'a little later';
  const monthlyNet = Number(summary.monthlyNet) || 0;
  const shortfall = Number(summary.shortfallAtTarget) || 0;
  const topCat = summary.topCategory || 'food and delivery';
  const cutPct = summary.cutPctNeeded ? `${summary.cutPctNeeded}%` : '15%';

  // 1. "Will I make it?"
  if (q.includes('will i make it') || q.includes('can i reach') || q.includes('on track')) {
    if (shortfall <= 0 && monthlyNet > 0) {
      return `Yes, you are on track to reach ${goalName} by ${targetDate}. Keeping our monthly savings margin steady at ₹${monthlyNet.toLocaleString('en-IN')} gets us across the line with room to spare. Keep this quiet discipline going.`;
    }
    return `At your current pace, you will reach ${goalName} around ${continueDate}, falling about ₹${shortfall.toLocaleString('en-IN')} short of our ${targetDate} date. Cutting ${cutPct} on ${topCat} each month closes the gap completely. We are close enough that a small fix today changes the outcome.`;
  }

  // 2. "What should I cut first?"
  if (q.includes('what should i cut') || q.includes('cut first') || q.includes('where to cut')) {
    const leakRupees = summary.topOverspendRupeeGap ? `₹${summary.topOverspendRupeeGap.toLocaleString('en-IN')}` : 'a substantial amount';
    return `Start with ${topCat}. It is running ${leakRupees} above our normal baseline and holds the easiest savings without hurting your day-to-day life. Trimming ${cutPct} there protects our goal date and keeps money in our pocket.`;
  }

  // 3. "What if rent goes up ₹3,000?"
  if (q.includes('rent goes up') || q.includes('rent increases') || q.includes('rent hike')) {
    const newNet = monthlyNet - 3000;
    if (newNet <= 0) {
      return `If rent climbs by ₹3,000, our monthly savings drop to zero or turn negative, halting progress toward ${goalName}. We would need to immediately trim ₹3,000 from ${topCat} to protect our foundation.`;
    }

    // Recompute projected timeline delay using remaining corpus
    const targetAmount = Number(summary.targetAmount) || 500000;
    const saved = Number(summary.saved) || 0;
    const remaining = Math.max(0, targetAmount - saved);
    const currMonths = Math.ceil(remaining / Math.max(1, monthlyNet));
    const newMonths = Math.ceil(remaining / Math.max(1, newNet));
    const delay = Math.max(1, newMonths - currMonths);

    return `If rent rises by ₹3,000, our monthly savings drop to ₹${newNet.toLocaleString('en-IN')}, delaying ${goalName} by about ${delay} ${delay === 1 ? 'month' : 'months'}. Trimming ₹3,000 from ${topCat} completely absorbs the hike and keeps our target date intact.`;
  }

  // 4. Out-of-scope non-money question detection
  const nonMoneyKeywords = ['weather', 'cricket', 'recipe', 'movie', 'joke', 'poem', 'who are you', 'president', 'capital of'];
  if (nonMoneyKeywords.some(kw => q.includes(kw))) {
    return 'I can only speak about your money and our shared journey to this goal. Ask me about your savings, rent, or leaks.';
  }

  // 5. Legal / Tax / Stock picking advice disclaimer
  const legalTaxKeywords = ['crypto', 'stock pick', 'tax filing', 'legal', 'itr', 'lawyer', 'bitcoin'];
  if (legalTaxKeywords.some(kw => q.includes(kw))) {
    return 'I am your future self, not a certified advisor. For legal, tax, or specific investment decisions, please consult a qualified professional.';
  }

  return null;
}

/**
 * Fallback generic spoken response.
 * @param {Object} summary
 * @returns {string}
 */
function getGenericFallbackAnswer(summary = {}) {
  const topCat = summary.topCategory || 'daily conveniences';
  const net = summary.monthlyNet || 15000;
  return `Looking back from our goal, every rupee kept in ${topCat} gives us more peace than any convenience purchase. Stick to our monthly savings target of ₹${net.toLocaleString('en-IN')} and we will get there.`;
}

/**
 * Handle question to Future You with Gemini and pre-computed fallback.
 * @param {Object} params
 * @param {string} params.question
 * @param {Object} params.summary
 * @param {Array<{q: string, a: string}>} [params.history=[]]
 * @param {string} [params.clientIp='127.0.0.1']
 * @returns {Promise<{ answer: string, source: 'gemini' | 'fallback' }>}
 */
async function answerFutureQuestion({ question, summary, history = [], clientIp = '127.0.0.1' }) {
  const cleanQ = question.trim();
  const rateLimitPerMin = parseInt(process.env.RATE_LIMIT_PER_MIN || '20', 10);

  // Check pre-computed deterministic answers first
  const precomputed = getPrecomputedAnswer(cleanQ, summary);

  // Rate limiting check: on limit, use precomputed or fallback directly
  if (!checkRateLimit(clientIp, rateLimitPerMin)) {
    return {
      answer: precomputed || getGenericFallbackAnswer(summary),
      source: 'fallback'
    };
  }

  // If Gemini API Key is missing, return pre-computed or fallback immediately
  if (!process.env.GEMINI_API_KEY) {
    return {
      answer: precomputed || getGenericFallbackAnswer(summary),
      source: 'fallback'
    };
  }

  const system = `You are the user's future self, speaking out loud in first person, warm and plain-spoken, Indian English, no hype, no emojis, no lists, no markdown. Answer in 2 to 4 short sentences, under 60 words, suitable to be spoken. Use ONLY the numbers provided. If asked something outside their money, say gently that you only know their money. Never give legal, tax or investment advice; for those, say to ask a professional.`;

  const conversationHistory = (history || []).slice(-3).map(turn => `User: ${turn.q}\nFuture You: ${turn.a}`).join('\n\n');

  const prompt = `Current Financial Summary:
${JSON.stringify(summary, null, 2)}

${conversationHistory ? `Recent Dialogue:\n${conversationHistory}\n\n` : ''}User's Question: "${cleanQ}"

Answer directly as their future self in spoken plain text without any markdown or formatting:`;

  try {
    const rawAnswer = await callGemini({
      system,
      prompt,
      json: false,
      maxTokens: 120
    });

    const cleaned = rawAnswer
      .replace(/^["']|["']$/g, '')
      .replace(/[*#_~`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (isValidSpokenAnswer(cleaned)) {
      return {
        answer: cleaned,
        source: 'gemini'
      };
    }

    return {
      answer: precomputed || getGenericFallbackAnswer(summary),
      source: 'fallback'
    };
  } catch {
    return {
      answer: precomputed || getGenericFallbackAnswer(summary),
      source: 'fallback'
    };
  }
}

module.exports = {
  answerFutureQuestion,
  getPrecomputedAnswer,
  getGenericFallbackAnswer,
  isValidSpokenAnswer
};
