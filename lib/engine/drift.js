/**
 * @file lib/engine/drift.js
 * Mid-month pacing and savings drift detection engine.
 * Emits actionable nudges when category spending outpaces monthly baselines.
 */

const { simulate } = require('./simulate');

/**
 * Detect mid-month spend pacing drift and generate proactive nudges.
 * @param {Object} params
 * @param {import('../types').Transaction[]} params.transactions
 * @param {import('../types').Profile} params.profile
 * @param {import('../types').Goal} params.goal
 * @param {string | Date} [params.today=new Date()]
 * @returns {import('../types').Nudge[]}
 */
function detectDrift({ transactions = [], profile = {}, goal = {}, today = new Date() }) {
  const currentDate = today instanceof Date ? today : new Date(today);
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth(); // 0-indexed
  const dayOfMonth = Math.max(1, currentDate.getDate());

  // Total days in current calendar month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Run simulation to get baseline monthly averages and monthlyNet
  const sim = simulate({ profile, goal, transactions, today: currentDate });
  const monthlyNet = Math.max(1, sim.monthlyNet || 1);

  // Group current month debits by category
  const currentMonthPrefix = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
  const currentMonthDebits = {};

  const excluded = new Set(['Housing & Rent', 'Income', 'Transfers', 'Investments']);

  for (const txn of transactions) {
    if (!txn || txn.direction !== 'debit' || !txn.date) continue;
    if (excluded.has(txn.category)) continue;

    if (txn.date.startsWith(currentMonthPrefix)) {
      const cat = txn.category || 'Other';
      currentMonthDebits[cat] = (currentMonthDebits[cat] || 0) + txn.amount;
    }
  }

  const nudges = [];

  // Evaluate each category from simulation's top categories and active spends
  const categoryAverages = new Map();
  for (const tc of sim.topCategories) {
    categoryAverages.set(tc.category, tc.monthlyAvg);
  }

  for (const [cat, actualSoFar] of Object.entries(currentMonthDebits)) {
    const monthlyAvg = categoryAverages.get(cat) || (actualSoFar * 0.8);
    if (monthlyAvg <= 0) continue;

    const expectedSpend = monthlyAvg * (dayOfMonth / daysInMonth);
    const rupeeDiff = actualSoFar - expectedSpend;
    const ratio = expectedSpend > 0 ? actualSoFar / expectedSpend : 1;

    // Condition: actual exceeds expected by > 15% and by more than ₹500
    if (ratio > 1.15 && rupeeDiff > 500) {
      const projectedMonthEnd = (actualSoFar / dayOfMonth) * daysInMonth;
      const projectedOverspend = Math.round(projectedMonthEnd - monthlyAvg);
      const slipDays = Math.round(projectedOverspend / Math.max(1, monthlyNet / 30));
      const pctAhead = Math.round(((actualSoFar - expectedSpend) / expectedSpend) * 100);
      const slipWeeks = Math.max(1, Math.round(slipDays / 7));

      nudges.push({
        id: `drift_${cat.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        category: cat,
        type: 'warning',
        message: `${cat} is ${pctAhead}% ahead of your usual pace. At this rate the goal slips about ${slipWeeks} ${slipWeeks === 1 ? 'week' : 'weeks'}.`,
        slipDays,
        projectedOverspend
      });
    }
  }

  // Sort by slipDays descending and take top 3
  nudges.sort((a, b) => b.slipDays - a.slipDays);
  const topNudges = nudges.slice(0, 3);

  // If everything is fine, return one positive nudge
  if (topNudges.length === 0) {
    return [
      {
        id: 'drift_on_pace',
        category: 'All',
        type: 'positive',
        message: "You're on pace this month. Nothing to fix.",
        slipDays: 0,
        projectedOverspend: 0
      }
    ];
  }

  return topNudges;
}

module.exports = {
  detectDrift
};
