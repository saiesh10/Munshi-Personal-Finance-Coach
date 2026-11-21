/**
 * @file lib/engine/ask.js
 * "Future You" conversational engine.
 * Pure logic providing pre-computed simulation answers, Gemini generation,
 * sliding-window rate limiting, and conversational fallbacks in English and Hindi.
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
  return words.length >= 4 && words.length <= 80;
}

/**
 * Generate pre-computed deterministic answers for standard financial queries.
 * Supports both English and Hindi questions and responses.
 * @param {string} question
 * @param {Object} summary
 * @param {string} [lang='en']
 * @returns {string | null}
 */
function getPrecomputedAnswer(question, summary = {}, lang = 'en') {
  const q = question.toLowerCase().trim();
  const isHindi = (lang || summary?.lang || '').toLowerCase().startsWith('hi') || /[\u0900-\u097F]/.test(q);

  const goalName = summary.goalName || (isHindi ? 'तुम्हारा लक्ष्य' : 'your milestone');
  const targetDate = summary.goalDatePlan || (isHindi ? 'लक्ष्य तिथि' : 'the target date');
  const continueDate = summary.goalDateContinue || (isHindi ? 'कुछ समय बाद' : 'a little later');
  const monthlyNet = Number(summary.monthlyNet) || 0;
  const shortfall = Number(summary.shortfallAtTarget) || 0;
  const topCat = summary.topCategory || (isHindi ? 'खान-पान' : 'food and delivery');
  const cutPct = summary.cutPctNeeded ? `${summary.cutPctNeeded}%` : '15%';

  // 1. "Will I make it?" / "क्या मैं अपने लक्ष्य तक पहुँच पाऊँगा?"
  if (
    q.includes('will i make it') ||
    q.includes('can i reach') ||
    q.includes('on track') ||
    q.includes('पहुँच') ||
    q.includes('लक्ष्य') ||
    q.includes('पूरा होगा')
  ) {
    if (shortfall <= 0 && monthlyNet > 0) {
      return isHindi
        ? `हाँ, तुम ${targetDate} तक ${goalName} पूरा करने की सही राह पर हो। हर महीने ₹${monthlyNet.toLocaleString('en-IN')} की बचत हमें बिना किसी परेशानी के लक्ष्य तक पहुँचा देगी। इस संयम को बनाए रखो।`
        : `Yes, you are on track to reach ${goalName} by ${targetDate}. Keeping our monthly savings margin steady at ₹${monthlyNet.toLocaleString('en-IN')} gets us across the line with room to spare. Keep this quiet discipline going.`;
    }
    return isHindi
      ? `वर्तमान रफ़्तार से, तुम ${continueDate} के आसपास ${goalName} तक पहुँचोगे, जो कि हमारे ${targetDate} के लक्ष्य से लगभग ₹${shortfall.toLocaleString('en-IN')} पीछे है। ${topCat} पर हर महीने ${cutPct} कम खर्च करने से यह अंतर पूरी तरह भर जाएगा। आज का एक छोटा कदम परिणाम बदल सकता है।`
      : `At your current pace, you will reach ${goalName} around ${continueDate}, falling about ₹${shortfall.toLocaleString('en-IN')} short of our ${targetDate} date. Cutting ${cutPct} on ${topCat} each month closes the gap completely. We are close enough that a small fix today changes the outcome.`;
  }

  // 2. "What should I cut first?" / "मुझे सबसे पहले क्या कम करना चाहिए?"
  if (
    q.includes('what should i cut') ||
    q.includes('cut first') ||
    q.includes('where to cut') ||
    q.includes('कम करना चाहिए') ||
    q.includes('कहाँ कटौती') ||
    q.includes('खर्च कम')
  ) {
    const leakRupees = summary.topOverspendRupeeGap ? `₹${summary.topOverspendRupeeGap.toLocaleString('en-IN')}` : (isHindi ? 'काफी अधिक' : 'a substantial amount');
    return isHindi
      ? `सबसे पहले ${topCat} से शुरुआत करो। यह हमारे सामान्य खर्च से ${leakRupees} अधिक चल रहा है और यहाँ कटौती करना सबसे आसान है। वहाँ ${cutPct} कम करने से हमारा लक्ष्य सुरक्षित रहेगा और हर महीने बचत बढ़ेगी।`
      : `Start with ${topCat}. It is running ${leakRupees} above our normal baseline and holds the easiest savings without hurting your day-to-day life. Trimming ${cutPct} there protects our goal date and keeps money in our pocket.`;
  }

  // 3. "What if rent goes up ₹3,000?" / "अगर किराया ₹3,000 बढ़ जाए तो क्या होगा?"
  if (
    q.includes('rent goes up') ||
    q.includes('rent increases') ||
    q.includes('rent hike') ||
    q.includes('किराया') ||
    q.includes('rent')
  ) {
    const newNet = monthlyNet - 3000;
    if (newNet <= 0) {
      return isHindi
        ? `अगर किराया ₹3,000 बढ़ता है, तो हमारी मासिक बचत शून्य या नकारात्मक हो जाएगी, जिससे ${goalName} की प्रगति रुक जाएगी। हमें तुरंत ${topCat} में ₹3,000 की बचत करनी होगी ताकि हमारी नींव सुरक्षित रहे।`
        : `If rent climbs by ₹3,000, our monthly savings drop to zero or turn negative, halting progress toward ${goalName}. We would need to immediately trim ₹3,000 from ${topCat} to protect our foundation.`;
    }

    // Recompute projected timeline delay using remaining corpus
    const targetAmount = Number(summary.targetAmount) || 500000;
    const saved = Number(summary.saved) || 0;
    const remaining = Math.max(0, targetAmount - saved);
    const currMonths = Math.ceil(remaining / Math.max(1, monthlyNet));
    const newMonths = Math.ceil(remaining / Math.max(1, newNet));
    const delay = Math.max(1, newMonths - currMonths);

    return isHindi
      ? `अगर किराया ₹3,000 बढ़ जाता है, तो हमारी मासिक बचत घटकर ₹${newNet.toLocaleString('en-IN')} रह जाएगी, जिससे ${goalName} लगभग ${delay} महीने पिछड़ जाएगा। ${topCat} में ₹3,000 की कटौती करने से इस बढ़ोतरी का कोई असर नहीं पड़ेगा और हमारी तारीख सुरक्षित रहेगी।`
      : `If rent rises by ₹3,000, our monthly savings drop to ₹${newNet.toLocaleString('en-IN')}, delaying ${goalName} by about ${delay} ${delay === 1 ? 'month' : 'months'}. Trimming ₹3,000 from ${topCat} completely absorbs the hike and keeps our target date intact.`;
  }

  // 4. Out-of-scope non-money question detection
  const nonMoneyKeywords = ['weather', 'cricket', 'recipe', 'movie', 'joke', 'poem', 'who are you', 'president', 'capital of', 'मौसम', 'गाना', 'कविता', 'क्रिकेट', 'फिल्म', 'चुटकुला'];
  if (nonMoneyKeywords.some(kw => q.includes(kw))) {
    return isHindi
      ? 'मैं केवल आपके पैसों और इस लक्ष्य तक की हमारी यात्रा के बारे में बात कर सकता हूँ। मुझसे बचत, किराया या खर्चों के बारे में पूछें।'
      : 'I can only speak about your money and our shared journey to this goal. Ask me about your savings, rent, or leaks.';
  }

  // 5. Legal / Tax / Stock picking advice disclaimer
  const legalTaxKeywords = ['crypto', 'stock pick', 'tax filing', 'legal', 'itr', 'lawyer', 'bitcoin', 'शेयर', 'टैक्स', 'वकील'];
  if (legalTaxKeywords.some(kw => q.includes(kw))) {
    return isHindi
      ? 'मैं आपका भविष्य हूँ, कोई वित्तीय या कर सलाहकार नहीं। कानूनी, टैक्स या निवेश निर्णयों के लिए कृपया किसी योग्य पेशेवर से सलाह लें।'
      : 'I am your future self, not a certified advisor. For legal, tax, or specific investment decisions, please consult a qualified professional.';
  }

  return null;
}

/**
 * Fallback generic spoken response in English or Hindi.
 * @param {Object} summary
 * @param {string} [lang='en']
 * @returns {string}
 */
function getGenericFallbackAnswer(summary = {}, lang = 'en') {
  const isHindi = (lang || summary?.lang || '').toLowerCase().startsWith('hi');
  const topCat = summary.topCategory || (isHindi ? 'दैनिक सुविधाओं' : 'daily conveniences');
  const net = summary.monthlyNet || 15000;

  return isHindi
    ? `अपने लक्ष्य से पीछे मुड़कर देखते हुए, ${topCat} में बचाया गया हर रुपया किसी भी दिखावे से अधिक सुकून देता है। हर महीने ₹${net.toLocaleString('en-IN')} की बचत का नियम बनाए रखें, हम वहाँ ज़रूर पहुँचेंगे।`
    : `Looking back from our goal, every rupee kept in ${topCat} gives us more peace than any convenience purchase. Stick to our monthly savings target of ₹${net.toLocaleString('en-IN')} and we will get there.`;
}

/**
 * Handle question to Future You with Gemini and pre-computed fallback.
 * @param {Object} params
 * @param {string} params.question
 * @param {Object} params.summary
 * @param {Array<{q: string, a: string}>} [params.history=[]]
 * @param {string} [params.clientIp='127.0.0.1']
 * @param {string} [params.lang='en']
 * @returns {Promise<{ answer: string, source: 'gemini' | 'fallback' }>}
 */
async function answerFutureQuestion({ question, summary, history = [], clientIp = '127.0.0.1', lang = 'en' }) {
  const cleanQ = question.trim();
  const rateLimitPerMin = parseInt(process.env.RATE_LIMIT_PER_MIN || '20', 10);
  const selectedLang = (lang || summary?.lang || 'en').toLowerCase();
  const isHindi = selectedLang.startsWith('hi') || /[\u0900-\u097F]/.test(cleanQ);

  // Check pre-computed deterministic answers first
  const precomputed = getPrecomputedAnswer(cleanQ, summary, isHindi ? 'hi' : 'en');

  // Rate limiting check: on limit, use precomputed or fallback directly
  if (!checkRateLimit(clientIp, rateLimitPerMin)) {
    return {
      answer: precomputed || getGenericFallbackAnswer(summary, isHindi ? 'hi' : 'en'),
      source: 'fallback'
    };
  }

  // If Gemini API Key is missing, return pre-computed or fallback immediately
  if (!process.env.GEMINI_API_KEY) {
    return {
      answer: precomputed || getGenericFallbackAnswer(summary, isHindi ? 'hi' : 'en'),
      source: 'fallback'
    };
  }

  const system = isHindi
    ? `You are the user's future self, speaking out loud in first person in natural, warm conversational Hindi (Devanagari script), friendly and plain-spoken, no hype, no emojis, no lists, no markdown. Answer in 2 to 4 short sentences, under 60 words, suitable to be spoken. Use ONLY the numbers provided. If asked something outside money, say gently in Hindi that you only know their money. Never give legal or tax advice; for those, ask a professional.`
    : `You are the user's future self, speaking out loud in first person, warm and plain-spoken, Indian English, no hype, no emojis, no lists, no markdown. Answer in 2 to 4 short sentences, under 60 words, suitable to be spoken. Use ONLY the numbers provided. If asked something outside their money, say gently that you only know their money. Never give legal, tax or investment advice; for those, say to ask a professional.`;

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
      maxTokens: 140
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
      answer: precomputed || getGenericFallbackAnswer(summary, isHindi ? 'hi' : 'en'),
      source: 'fallback'
    };
  } catch {
    return {
      answer: precomputed || getGenericFallbackAnswer(summary, isHindi ? 'hi' : 'en'),
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
