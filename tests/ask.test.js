const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  answerFutureQuestion,
  getPrecomputedAnswer,
  isValidSpokenAnswer
} = require('../lib/engine/ask');

describe('Future You Voice & Ask Engine', () => {
  const mockSummary = {
    goalName: 'Emergency Fund',
    targetAmount: 500000,
    targetDate: '2027-10-31',
    saved: 120000,
    monthlyIncome: 92000,
    monthlyFixed: 33000,
    monthlyVariable: 38430,
    monthlyNet: 20570,
    shortfallAtTarget: 25000,
    goalDateContinue: 'Dec 2027',
    goalDatePlan: 'Oct 2027',
    topCategory: 'Food & Dining',
    topOverspendRupeeGap: 3400,
    cutPctNeeded: 18
  };

  test('Question 1: "Will I make it?" returns a valid non-empty answer with no Gemini key', async () => {
    // Ensure GEMINI_API_KEY is unset for this test
    const origKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const result = await answerFutureQuestion({
        question: 'Will I make it?',
        summary: mockSummary,
        history: []
      });

      assert.ok(result, 'Result should exist');
      assert.ok(result.answer, 'Answer must not be empty');
      assert.equal(typeof result.answer, 'string');
      assert.equal(result.source, 'fallback');
      assert.ok(result.answer.length > 20, 'Answer should have substantive content');
    } finally {
      if (origKey) process.env.GEMINI_API_KEY = origKey;
    }
  });

  test('Question 2: "What should I cut first?" returns a valid non-empty answer with no Gemini key', async () => {
    const origKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const result = await answerFutureQuestion({
        question: 'What should I cut first?',
        summary: mockSummary,
        history: []
      });

      assert.ok(result.answer, 'Answer must not be empty');
      assert.ok(result.answer.includes('Food & Dining') || result.answer.includes('Food'), 'Should mention topCategory');
      assert.equal(result.source, 'fallback');
    } finally {
      if (origKey) process.env.GEMINI_API_KEY = origKey;
    }
  });

  test('Question 3: "What if rent goes up ₹3,000?" returns a valid non-empty answer with no Gemini key', async () => {
    const origKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const result = await answerFutureQuestion({
        question: 'What if rent goes up ₹3,000?',
        summary: mockSummary,
        history: []
      });

      assert.ok(result.answer, 'Answer must not be empty');
      assert.ok(result.answer.includes('rent') || result.answer.includes('savings'), 'Should discuss rent impact');
      assert.equal(result.source, 'fallback');
    } finally {
      if (origKey) process.env.GEMINI_API_KEY = origKey;
    }
  });

  test('Answers never contain markdown formatting characters', async () => {
    const questions = [
      'Will I make it?',
      'What should I cut first?',
      'What if rent goes up ₹3,000?',
      'What is the weather today?'
    ];

    const markdownRegex = /[*#_`~\[\]]/;

    for (const q of questions) {
      const answer = getPrecomputedAnswer(q, mockSummary) || 'Standard plain spoken response.';
      assert.equal(
        markdownRegex.test(answer),
        false,
        `Answer for "${q}" should not contain markdown characters. Found in: ${answer}`
      );
    }
  });

  test('isValidSpokenAnswer strictly validates spoken suitability', () => {
    // Valid plain spoken sentences
    assert.equal(isValidSpokenAnswer('Yes you are on track. Keep this quiet discipline going.'), true);

    // Markdown bold or italic should fail
    assert.equal(isValidSpokenAnswer('Yes **you are on track**. Keep going.'), false);
    assert.equal(isValidSpokenAnswer('Yes _you are on track_. Keep going.'), false);

    // Markdown bullets should fail
    assert.equal(isValidSpokenAnswer('- Cut dining\n- Cut travel'), false);

    // Overlong text (> 70 words) should fail
    const overlong = new Array(75).fill('word').join(' ');
    assert.equal(isValidSpokenAnswer(overlong), false);
  });
});
