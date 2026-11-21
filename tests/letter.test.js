const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { getFallbackLetter, isValidLetter, checkRateLimit, formatRupees } = require('../lib/engine/letter');

describe('Letter Engine & Rate Limiter', () => {
  test('Fallback template 1: Net negative generates valid letter', () => {
    const summary = {
      goalName: 'Emergency Corpus',
      targetDate: 'Oct 2027',
      monthlyNet: -2000,
      topCategory: 'Food & Dining',
      cutPctNeeded: 25
    };

    const letter = getFallbackLetter(summary);
    assert.ok(letter.text, 'Letter text must exist');
    assert.equal(letter.source, 'fallback');
    assert.ok(letter.text.includes('standstill'), 'Should pick net negative template');
    assert.ok(isValidLetter(letter.text), 'Letter text must be valid format without markdown');
  });

  test('Fallback template 2: Shortfall generates valid letter with rupee shortfall', () => {
    const summary = {
      goalName: 'Emergency Corpus',
      targetDate: 'Oct 2027',
      goalDateContinue: 'Dec 2027',
      monthlyNet: 15000,
      shortfallAtTarget: 35000,
      topCategory: 'Online Shopping',
      cutPctNeeded: 20
    };

    const letter = getFallbackLetter(summary);
    assert.ok(letter.text, 'Letter text must exist');
    assert.equal(letter.source, 'fallback');
    assert.ok(letter.text.includes('missed it by ₹35,000'), 'Should contain formatted shortfall');
    assert.ok(isValidLetter(letter.text), 'Letter text must be valid format without markdown');
  });

  test('Fallback template 3: On-track surplus generates encouraging letter', () => {
    const summary = {
      goalName: 'Emergency Corpus',
      targetDate: 'Oct 2027',
      monthlyNet: 22000,
      shortfallAtTarget: 0,
      topCategory: 'Food & Dining'
    };

    const letter = getFallbackLetter(summary);
    assert.ok(letter.text, 'Letter text must exist');
    assert.equal(letter.source, 'fallback');
    assert.ok(letter.text.includes('You made it'), 'Should pick on-track template');
    assert.ok(isValidLetter(letter.text), 'Letter text must be valid format without markdown');
  });

  test('formatRupees formats Indian currency commas correctly', () => {
    assert.equal(formatRupees(15000), '₹15,000');
    assert.equal(formatRupees(125000), '₹1,25,000');
    assert.equal(formatRupees(0), '₹0');
  });

  test('checkRateLimit restricts requests after limit exceeded within 60s', () => {
    const testIp = '192.168.1.99';
    // Limit to 3 requests
    assert.equal(checkRateLimit(testIp, 3), true, 'Request 1 should pass');
    assert.equal(checkRateLimit(testIp, 3), true, 'Request 2 should pass');
    assert.equal(checkRateLimit(testIp, 3), true, 'Request 3 should pass');
    assert.equal(checkRateLimit(testIp, 3), false, 'Request 4 should be blocked');
  });
});
