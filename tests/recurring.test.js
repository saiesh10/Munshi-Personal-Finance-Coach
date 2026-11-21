const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { detectRecurring } = require('../lib/engine/recurring');
const { SAMPLE_TRANSACTIONS } = require('../lib/mock/sampleData');

describe('Recurring Engine', () => {
  test('Detects monthly Netflix, price-up Hotstar, and unused Swiggy One on sample data', () => {
    const subscriptions = detectRecurring(SAMPLE_TRANSACTIONS);
    assert.ok(subscriptions.length >= 3, 'Should detect at least Netflix, Hotstar, and Swiggy One');

    // 1. Netflix check: monthly cadence
    const netflix = subscriptions.find(s => s.merchantKey === 'NETFLIX');
    assert.ok(netflix, 'Netflix subscription should be detected');
    assert.equal(netflix.cadence, 'monthly');
    assert.equal(netflix.amount, 499);
    assert.equal(netflix.annualCost, 499 * 12);

    // 2. Hotstar check: price_up flag (from 149 to 299)
    const hotstar = subscriptions.find(s => s.merchantKey === 'HOTSTAR');
    assert.ok(hotstar, 'Hotstar subscription should be detected');
    assert.ok(hotstar.flags.includes('price_up'), 'Hotstar should have price_up flag');

    // 3. Swiggy One check: unused flag (companion Swiggy has <= 1 order in 90 days)
    const swiggyOne = subscriptions.find(s => s.merchantKey === 'SWIGGY ONE');
    assert.ok(swiggyOne, 'Swiggy One membership should be detected');
    assert.ok(swiggyOne.flags.includes('unused'), 'Swiggy One should have unused flag');

    // 4. Overlap check: Netflix and Hotstar are both video services
    assert.ok(netflix.flags.includes('overlap'), 'Netflix should be flagged with overlap');
    assert.ok(hotstar.flags.includes('overlap'), 'Hotstar should be flagged with overlap');
  });
});
