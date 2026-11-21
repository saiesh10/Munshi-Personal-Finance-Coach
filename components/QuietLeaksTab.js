'use client';

import React, { useState } from 'react';
import { useLedger } from '@/context/LedgerContext';

export default function QuietLeaksTab() {
  const { subscriptions, adjustments, setAdjustments, setActiveTab } = useLedger();

  // Track decision per subscription: null | 'keep' | 'cancel'
  const [decisions, setDecisions] = useState({});

  const totalAnnualDrain = subscriptions.reduce((sum, s) => sum + (s.annualCost || 0), 0);
  const forgottenCount = subscriptions.filter(s => Array.isArray(s.flags) && s.flags.includes('unused')).length;

  // Compute cancelled annual savings
  const cancelledSubscriptions = subscriptions.filter(s => {
    const isExplicitCancel = decisions[s.id] === 'cancel';
    const isPlanSkipped = adjustments.some(a => a.type === 'skip_subscription' && a.target === s.id);
    return isExplicitCancel || isPlanSkipped;
  });

  const cancelledAnnualSavings = cancelledSubscriptions.reduce((sum, s) => sum + (s.annualCost || 0), 0);

  const handleDecision = (sub, choice) => {
    const newDecisions = { ...decisions, [sub.id]: choice };
    setDecisions(newDecisions);

    if (choice === 'cancel') {
      const monthlyCost = Math.round(sub.annualCost / 12);
      if (!adjustments.some(a => a.type === 'skip_subscription' && a.target === sub.id)) {
        setAdjustments([
          ...adjustments,
          {
            type: 'skip_subscription',
            target: sub.id,
            amount: monthlyCost
          }
        ]);
      }
    } else if (choice === 'keep') {
      setAdjustments(adjustments.filter(a => !(a.type === 'skip_subscription' && a.target === sub.id)));
    }
  };

  const getSinceDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    } catch {
      return 'recent';
    }
  };

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Top Header & Kicker */}
      <div className="flex items-center justify-between pb-space-sm">
        <span className="font-kicker text-kicker uppercase text-on-surface-variant tracking-[0.16em]">
          03 / QUIET LEAKS
        </span>
        <span className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 bg-secondary"></span>
          AUDIT OF RECURRENT FLOWS
        </span>
      </div>

      {/* Editorial Headline */}
      <div className="pt-space-xs pb-space-xs">
        <h1 className="font-['Fraunces'] text-[36px] leading-[40px] tracking-tight font-normal text-on-surface">
          Quiet Leaks.
        </h1>
        <p className="font-['Fraunces'] italic text-body-lg text-on-surface-variant pt-space-xs">
          Expose forgotten and rising subscriptions. Small leaks sink big ships.
        </p>
      </div>

      {/* Computed Intro Sentence */}
      {subscriptions.length > 0 && (
        <div className="py-space-xs mb-space-sm border-b border-outline-variant/60">
          <p className="font-body-md text-on-surface">
            {subscriptions.length} {subscriptions.length === 1 ? 'thing charges' : 'things charge'} you every month.{' '}
            {forgottenCount > 0 ? `${forgottenCount} ${forgottenCount === 1 ? 'looks' : 'look'} forgotten. ` : ''}
            Together they cost <strong className="font-mono font-medium">₹{totalAnnualDrain.toLocaleString('en-IN')}</strong> a year.
          </p>
        </div>
      )}

      {/* Subscription Rows List */}
      <div className="border border-outline-variant divide-y divide-outline-variant bg-surface-container-lowest">
        {subscriptions.length === 0 ? (
          <div className="p-10 text-center font-body-md text-on-surface-variant italic">
            No recurring charges detected yet. Paste at least 2 consecutive months of statements on the 01 Paste tab.
          </div>
        ) : (
          subscriptions.map((sub) => {
            const isCancelled = decisions[sub.id] === 'cancel' || adjustments.some(a => a.type === 'skip_subscription' && a.target === sub.id);
            const isKept = decisions[sub.id] === 'keep';
            const hasFlags = Array.isArray(sub.flags) && sub.flags.length > 0;
            const sinceFormatted = getSinceDate(sub.lastDate);

            return (
              <div
                key={sub.id}
                className={`p-space-md flex flex-col gap-2 transition-colors ${
                  isCancelled ? 'bg-surface-container/50 opacity-60' : 'hover:bg-surface-container-low'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className={`font-['Fraunces'] text-xl font-normal ${isCancelled ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                        {sub.merchant}
                      </span>
                      {isKept && (
                        <span className="font-label-md text-[11px] uppercase tracking-wider text-[#244f31] bg-tertiary-fixed px-1.5 py-0.5">
                          Kept
                        </span>
                      )}
                      {isCancelled && (
                        <span className="font-label-md text-[11px] uppercase tracking-wider text-error bg-error-container px-1.5 py-0.5">
                          Marked to cancel
                        </span>
                      )}
                    </div>
                    <span className="font-tabular-sm text-tabular-sm text-on-surface-variant font-mono">
                      ₹{sub.amount} / {sub.cadence === 'monthly' ? 'month' : sub.cadence} · since {sinceFormatted} · ₹{sub.annualCost.toLocaleString('en-IN')} / yr
                    </span>
                  </div>

                  {/* Actions: Keep or I'll cancel it */}
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0 font-label-md text-label-md uppercase tracking-wider">
                    <button
                      type="button"
                      onClick={() => handleDecision(sub, 'keep')}
                      className={`px-3 py-1.5 border transition-colors cursor-pointer ${
                        isKept
                          ? 'bg-[#244f31] text-surface border-[#244f31]'
                          : 'bg-surface-container-low text-on-surface border-outline-variant hover:bg-surface-container'
                      }`}
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDecision(sub, isCancelled ? 'keep' : 'cancel')}
                      className={`px-3 py-1.5 border transition-colors cursor-pointer ${
                        isCancelled
                          ? 'bg-secondary text-surface border-secondary'
                          : 'bg-surface-container-low text-secondary border-outline-variant hover:bg-secondary-fixed'
                      }`}
                    >
                      {isCancelled ? 'Cancel undone' : "I'll cancel it"}
                    </button>
                  </div>
                </div>

                {/* Flag lines in Marigold Italic */}
                {hasFlags && (
                  <div className="pt-1">
                    <p className="font-body-sm text-body-sm text-secondary italic font-serif">
                      {sub.flagMessage || 'Price or usage flag detected.'}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Running Bottom Line & Advance Button */}
      {subscriptions.length > 0 && (
        <div className="pt-space-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-outline-variant mt-space-md">
          <span className="font-body-md text-on-surface">
            {cancelledAnnualSavings > 0 ? (
              <>If you cancel the ones you marked: <strong className="font-mono text-secondary font-medium">₹{cancelledAnnualSavings.toLocaleString('en-IN')}</strong> a year back in your pocket.</>
            ) : (
              'Mark any subscriptions above to calculate your annual savings back.'
            )}
          </span>

          <button
            type="button"
            onClick={() => setActiveTab('plan')}
            className="bg-primary text-surface px-space-lg py-3 font-label-md text-label-md uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-on-surface-variant transition-colors cursor-pointer"
            style={{ borderRadius: 0 }}
          >
            <span>See effect on goal date</span>
            <span className="font-tabular-md">→</span>
          </button>
        </div>
      )}
    </div>
  );
}
