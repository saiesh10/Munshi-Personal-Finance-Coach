const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { simulate } = require('../lib/engine/simulate');
const { SAMPLE_PROFILE, SAMPLE_GOAL, SAMPLE_TRANSACTIONS } = require('../lib/mock/sampleData');

describe('Simulate Engine', () => {
  test('No NaN with empty data or missing parameters', () => {
    const emptyProj = simulate({
      profile: {},
      goal: {},
      transactions: [],
      adjustments: []
    });

    assert.ok(emptyProj, 'Projection should exist');
    assert.equal(isNaN(emptyProj.monthlyIncome), false, 'monthlyIncome should not be NaN');
    assert.equal(isNaN(emptyProj.monthlyFixed), false, 'monthlyFixed should not be NaN');
    assert.equal(isNaN(emptyProj.monthlyVariable), false, 'monthlyVariable should not be NaN');
    assert.equal(isNaN(emptyProj.monthlyNet), false, 'monthlyNet should not be NaN');
    assert.equal(isNaN(emptyProj.shortfallAtTarget), false, 'shortfallAtTarget should not be NaN');

    for (const val of emptyProj.continueSeries) {
      assert.equal(isNaN(val), false, 'continueSeries values should not be NaN');
    }
    for (const val of emptyProj.planSeries) {
      assert.equal(isNaN(val), false, 'planSeries values should not be NaN');
    }
  });

  test('whatIf improves the goal date when cutting spend', () => {
    const baseline = simulate({
      profile: SAMPLE_PROFILE,
      goal: SAMPLE_GOAL,
      transactions: SAMPLE_TRANSACTIONS,
      adjustments: []
    });

    assert.equal(baseline.whatIfSeries, null, 'whatIfSeries should be null when no adjustments');

    const adjusted = simulate({
      profile: SAMPLE_PROFILE,
      goal: SAMPLE_GOAL,
      transactions: SAMPLE_TRANSACTIONS,
      adjustments: [
        {
          type: 'category_cut',
          target: 'Food & Dining',
          changePct: -0.50
        }
      ]
    });

    assert.ok(Array.isArray(adjusted.whatIfSeries), 'whatIfSeries should be an array');
    assert.ok(adjusted.whatIfNet > baseline.monthlyNet, 'whatIfNet should be higher than baseline monthlyNet');

    // Compare continue series vs whatIf series at same month
    const lastIdx = adjusted.continueSeries.length - 1;
    assert.ok(adjusted.whatIfSeries[lastIdx] >= adjusted.continueSeries[lastIdx], 'Adjusted savings should exceed baseline');
  });
});
