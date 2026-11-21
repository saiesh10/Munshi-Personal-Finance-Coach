/**
 * @file lib/engine/ask.js
 * "Future You" conversational engine.
 * Pure logic providing dynamic financial simulations, Gemini generation,
 * sliding-window rate limiting, and mathematically accurate what-if answers in English and Hindi.
 */

const { callGemini } = require('./ai');
const { checkRateLimit } = require('./letter');

/**
 * Clean LLM answer and ensure it strictly contains no markdown and is under 80 words.
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
 * Extract numbers/amounts from text (e.g. 8000, 10000, 10k, ₹5,000).
 * @param {string} text
 * @returns {number | null}
 */
function extractAmount(text) {
  if (!text || typeof text !== 'string') return null;

  // Match "10k", "8.5k"
  const kMatch = text.match(/\b([0-9]+(?:\.[0-9]+)?)\s*k\b/i);
  if (kMatch) {
    return Math.round(parseFloat(kMatch[1]) * 1000);
  }

  // Match numbers with rupee prefixes/suffixes or standalone
  const numMatch = text.match(/(?:Rs\.?|INR|₹)?\s*([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:rupees|rs|inr)?/i);
  if (numMatch && numMatch[1]) {
    const clean = numMatch[1].replace(/,/g, '');
    const num = parseFloat(clean);
    // Ignore current/upcoming calendar years
    if (!isNaN(num) && num > 0 && num !== 2026 && num !== 2027 && num !== 2028) {
      return Math.round(num);
    }
  }

  return null;
}

/**
 * Calculate dynamic, mathematically accurate financial answers for what-ifs,
 * timeline simulations, rent hikes, salary changes, and purchases.
 * @param {string} question
 * @param {Object} summary
 * @param {string} [lang='en']
 * @returns {string}
 */
function getDynamicFinancialAnswer(question, summary = {}, lang = 'en') {
  const q = question.toLowerCase().trim();
  const isHindi = (lang || summary?.lang || '').toLowerCase().startsWith('hi') || /[\u0900-\u097F]/.test(q);

  const goalName = summary.goalName || (isHindi ? 'तुम्हारा लक्ष्य' : 'your milestone');
  const targetDate = summary.goalDatePlan || (isHindi ? 'लक्ष्य तिथि' : 'the target date');
  const continueDate = summary.goalDateContinue || (isHindi ? 'कुछ समय बाद' : 'a little later');
  const monthlyNet = Number(summary.monthlyNet) || 20570;
  const shortfall = Number(summary.shortfallAtTarget) || 0;
  const topCat = summary.topCategory || (isHindi ? 'खान-पान' : 'food and delivery');
  const cutPct = summary.cutPctNeeded ? `${summary.cutPctNeeded}%` : '15%';

  const targetAmount = Number(summary.targetAmount) || 500000;
  const saved = Number(summary.saved) || 0;
  const remaining = Math.max(0, targetAmount - saved);
  const currMonths = Math.ceil(remaining / Math.max(1, monthlyNet));

  // 1. Rent & Housing Changes (e.g. "what if rent increases to 8000", "what if rent increases to 10000 rupees")
  if (
    q.includes('rent') ||
    q.includes('किराया') ||
    q.includes('housing') ||
    q.includes('room rent')
  ) {
    const extractedNum = extractAmount(q);
    const currRent = Number(summary.currentRent) || 28000;
    let hike = 3000;

    if (extractedNum) {
      const isTo = /\b(?:increases|rises|goes up|climbs)\s+to\b/i.test(q) || /\bto\s+[0-9]/i.test(q);
      if (isTo && extractedNum > currRent) {
        hike = extractedNum - currRent;
      } else {
        hike = extractedNum;
      }
    }

    const newNet = monthlyNet - hike;
    const newMonths = newNet > 0 ? Math.ceil(remaining / newNet) : Infinity;
    const delay = isFinite(newMonths) ? Math.max(1, newMonths - currMonths) : null;

    if (newNet > 0) {
      return isHindi
        ? `अगर किराया ₹${hike.toLocaleString('en-IN')} बढ़ जाता है, तो हमारी मासिक बचत घटकर ₹${newNet.toLocaleString('en-IN')} रह जाएगी, जिससे ${goalName} लगभग ${delay} ${delay === 1 ? 'महीना' : 'महीने'} पिछड़ जाएगा। ${topCat} में ₹${hike.toLocaleString('en-IN')} की कटौती करने से इस बढ़ोतरी का असर समाप्त हो जाएगा और हमारी तारीख सुरक्षित रहेगी।`
        : `If rent rises by ₹${hike.toLocaleString('en-IN')}, our monthly savings drop to ₹${newNet.toLocaleString('en-IN')}, delaying ${goalName} by about ${delay} ${delay === 1 ? 'month' : 'months'}. Trimming ₹${hike.toLocaleString('en-IN')} from ${topCat} completely absorbs the hike and keeps our target date intact.`;
    }

    return isHindi
      ? `अगर किराया ₹${hike.toLocaleString('en-IN')} बढ़ता है, तो हमारी मासिक बचत शून्य या नकारात्मक हो जाएगी, जिससे ${goalName} की प्रगति रुक जाएगी। हमें तुरंत ${topCat} में ₹${hike.toLocaleString('en-IN')} की बचत करनी होगी ताकि हमारी नींव सुरक्षित रहे।`
      : `If rent rises by ₹${hike.toLocaleString('en-IN')}, our monthly savings drop to ₹0 or turn negative, wiping out our cushion for ${goalName}. We would need to immediately trim ₹${hike.toLocaleString('en-IN')} across ${topCat} to protect our foundation.`;
  }

  // 2. Salary & Income Adjustments (e.g. "what if my salary increases by 10000", "what if I get a 15000 raise")
  if (
    q.includes('salary') ||
    q.includes('income') ||
    q.includes('raise') ||
    q.includes('bonus') ||
    q.includes('वेतन') ||
    q.includes('कमाई')
  ) {
    const amount = extractAmount(q) || 10000;
    const isDecrease = /\b(?:drop|cut|decrease|loss|reduce|कम)\b/i.test(q);
    const delta = isDecrease ? -amount : amount;
    const newNet = monthlyNet + delta;

    if (delta > 0) {
      const newMonths = Math.ceil(remaining / Math.max(1, newNet));
      const advance = Math.max(1, currMonths - newMonths);
      return isHindi
        ? `मासिक आय में ₹${amount.toLocaleString('en-IN')} की बढ़ोतरी से हमारी बचत ₹${newNet.toLocaleString('en-IN')} हो जाएगी, जिससे हम ${goalName} तय समय से लगभग ${advance} महीने पहले ही हासिल कर लेंगे!`
        : `With a ₹${amount.toLocaleString('en-IN')} monthly income boost, our savings margin rises to ₹${newNet.toLocaleString('en-IN')}, reaching ${goalName} about ${advance} ${advance === 1 ? 'month' : 'months'} ahead of schedule!`;
    }

    const delay = Math.max(1, Math.ceil(remaining / Math.max(1, newNet)) - currMonths);
    return isHindi
      ? `यदि मासिक आय में ₹${amount.toLocaleString('en-IN')} की कमी आती है, तो बचत घटकर ₹${newNet.toLocaleString('en-IN')} रह जाएगी, जिससे ${goalName} लगभग ${delay} महीने पिछड़ जाएगा।`
      : `If monthly income drops by ₹${amount.toLocaleString('en-IN')}, our savings shrink to ₹${newNet.toLocaleString('en-IN')}, delaying ${goalName} by about ${delay} months.`;
  }

  // 3. Large Discretionary Purchases (e.g. "can I buy an iPhone for 80000", "what if I spend 50000 on travel")
  if (
    q.includes('buy') ||
    q.includes('purchase') ||
    q.includes('iphone') ||
    q.includes('car') ||
    q.includes('bike') ||
    q.includes('trip') ||
    q.includes('vacation') ||
    q.includes('spend') ||
    q.includes('खरीद') ||
    q.includes('खर्च')
  ) {
    const amount = extractAmount(q);
    if (amount) {
      const monthsCost = (amount / Math.max(1, monthlyNet)).toFixed(1);
      const delayMonths = Math.ceil(amount / Math.max(1, monthlyNet));
      return isHindi
        ? `₹${amount.toLocaleString('en-IN')} खर्च करना हमारी लगभग ${monthsCost} महीने की बचत के बराबर है, जिससे ${goalName} करीब ${delayMonths} महीने पीछे खिसक सकता है। इसे सुरक्षित रूप से खरीदने के लिए अपनी मुख्य बचत को छुए बिना एक अलग फंड बनाएं।`
        : `Spending ₹${amount.toLocaleString('en-IN')} represents about ${monthsCost} months of our net savings, pushing ${goalName} back by roughly ${delayMonths} ${delayMonths === 1 ? 'month' : 'months'}. To afford it safely, set aside a separate sinking fund rather than tapping our core savings.`;
    }
  }

  // 4. "Will I make it?" / "On track"
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

  // 5. "What should I cut first?"
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

  // 6. Out-of-scope non-money question detection
  const nonMoneyKeywords = ['weather', 'cricket', 'recipe', 'movie', 'joke', 'poem', 'who are you', 'president', 'capital of', 'मौसम', 'गाना', 'कविता', 'क्रिकेट', 'फिल्म', 'चुटकुला'];
  if (nonMoneyKeywords.some(kw => q.includes(kw))) {
    return isHindi
      ? 'मैं केवल आपके पैसों और इस लक्ष्य तक की हमारी यात्रा के बारे में बात कर सकता हूँ। मुझसे बचत, किराया या खर्चों के बारे में पूछें।'
      : 'I can only speak about your money and our shared journey to this goal. Ask me about your savings, rent, or leaks.';
  }

  // 7. Legal / Tax / Stock picking advice disclaimer
  const legalTaxKeywords = ['crypto', 'stock pick', 'tax filing', 'legal', 'itr', 'lawyer', 'bitcoin', 'शेयर', 'टैक्स', 'वकील'];
  if (legalTaxKeywords.some(kw => q.includes(kw))) {
    return isHindi
      ? 'मैं आपका भविष्य हूँ, कोई वित्तीय या कर सलाहकार नहीं। कानूनी, टैक्स या निवेश निर्णयों के लिए कृपया किसी योग्य पेशेवर से सलाह लें।'
      : 'I am your future self, not a certified advisor. For legal, tax, or specific investment decisions, please consult a qualified professional.';
  }

  // Default fallback
  const net = monthlyNet || 15000;
  return isHindi
    ? `अपने लक्ष्य से पीछे मुड़कर देखते हुए, ${topCat} में बचाया गया हर रुपया किसी भी दिखावे से अधिक सुकून देता है। हर महीने ₹${net.toLocaleString('en-IN')} की बचत का नियम बनाए रखें, हम वहाँ ज़रूर पहुँचेंगे।`
    : `Looking back from our goal, every rupee kept in ${topCat} gives us more peace than any convenience purchase. Stick to our monthly savings target of ₹${net.toLocaleString('en-IN')} and we will get there.`;
}

/**
 * Handle question to Future You with Gemini and dynamic mathematical fallback.
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

  // Exact chips matching (for instant response on standard UI buttons)
  const exactChips = [
    'will i make it?',
    'will i make it',
    'what should i cut first?',
    'what should i cut first',
    'what if rent goes up ₹3,000?',
    'what if rent goes up 3000?',
    'क्या मैं अपने लक्ष्य तक पहुँच पाऊँगा?',
    'क्या मैं अपने लक्ष्य तक पहुँच पाऊँगा',
    'मुझे सबसे पहले क्या कम करना चाहिए?',
    'मुझे सबसे पहले क्या कम करना चाहिए',
    'अगर किराया ₹3,000 बढ़ जाए तो क्या होगा?',
    'अगर किराया ₹3,000 बढ़ जाए तो क्या होगा'
  ];

  const lowerQ = cleanQ.toLowerCase();
  const isExactChip = exactChips.includes(lowerQ);

  // If rate limit exceeded, return dynamic fallback immediately
  if (!checkRateLimit(clientIp, rateLimitPerMin)) {
    return {
      answer: getDynamicFinancialAnswer(cleanQ, summary, isHindi ? 'hi' : 'en'),
      source: 'fallback'
    };
  }

  // If Gemini API Key is available AND this is not an exact chip, query Gemini for dynamic reasoning
  if (process.env.GEMINI_API_KEY && !isExactChip) {
    const goalName = summary.goalName || 'Goal';
    const targetDate = summary.goalDatePlan || 'target arrival date';
    const monthlyNet = summary.monthlyNet || 20570;
    const currentRent = summary.currentRent || 28000;
    const topCat = summary.topCategory || 'Food & Dining';

    const system = isHindi
      ? `You are the user's future self, speaking out loud in first person from your goal date (${targetDate}) where you reached ${goalName}. Natural conversational Hindi (Devanagari script), friendly and plain-spoken, no hype, no emojis, no bullet points, under 60 words. The user asked a specific question. Answer it directly and calculate the exact rupee and month effect using their data: Monthly Income: ₹${summary.monthlyIncome || 92000}, Current Rent: ₹${currentRent}, Monthly Net Savings: ₹${monthlyNet}, Top Leak: ${topCat}. If they ask what if rent/expenses change, calculate the exact new savings and delay or advance in months. Never repeat a canned response.`
      : `You are the user's future self, speaking out loud in first person from your goal date (${targetDate}) where you reached ${goalName}. Indian English, warm and plain-spoken, no hype, no emojis, no bullet points, under 60 words. The user asked a specific question. Answer it directly and calculate the exact rupee and month effect using their data: Monthly Income: ₹${summary.monthlyIncome || 92000}, Current Rent: ₹${currentRent}, Monthly Net Savings: ₹${monthlyNet}, Top Leak: ${topCat}. If they ask what if rent or expenses change, calculate the exact new savings and delay or advance in months. Never repeat a canned response.`;

    const conversationHistory = (history || []).slice(-3).map(turn => `User: ${turn.q}\nFuture You: ${turn.a}`).join('\n\n');

    const prompt = `Current Financial Summary:
${JSON.stringify(summary, null, 2)}

${conversationHistory ? `Recent Dialogue:\n${conversationHistory}\n\n` : ''}User's Question: "${cleanQ}"

Answer directly as their future self in plain spoken text without any markdown or formatting:`;

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
    } catch {
      // Fall through to dynamic math solver
    }
  }

  // Calculate dynamic answer based on the exact user question and financial summary
  return {
    answer: getDynamicFinancialAnswer(cleanQ, summary, isHindi ? 'hi' : 'en'),
    source: 'fallback'
  };
}

module.exports = {
  answerFutureQuestion,
  getDynamicFinancialAnswer,
  getPrecomputedAnswer: getDynamicFinancialAnswer, // Backward-compatibility for test imports
  extractAmount,
  isValidSpokenAnswer
};
