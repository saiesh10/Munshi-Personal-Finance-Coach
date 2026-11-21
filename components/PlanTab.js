'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLedger } from '@/context/LedgerContext';

export default function PlanTab() {
  const {
    profile,
    setProfile,
    goal,
    setGoal,
    adjustments,
    setAdjustments,
    projection,
    nudges,
    handleSimulate,
    setActiveTab,
    isLoading,
    error
  } = useLedger();

  // Local state for interactive sliders (-50% to +50%)
  const [categoryCuts, setCategoryCuts] = useState({});
  const [rentDelta, setRentDelta] = useState(0);

  // Debounced simulation trigger
  const debounceTimerRef = useRef(null);

  // Sync adjustments to local sliders
  useEffect(() => {
    const cuts = {};
    for (const a of adjustments) {
      if (a.type === 'category_cut') {
        cuts[a.target] = Math.round((a.changePct || 0) * 100);
      } else if (a.type === 'rent_delta') {
        setRentDelta(a.amount || 0);
      }
    }
    setCategoryCuts(cuts);
  }, [adjustments]);

  // Initial simulation
  useEffect(() => {
    handleSimulate();
  }, []);

  const triggerSimulation = (newCuts, newRentDelta) => {
    const nextAdjustments = [];

    // Keep active skipped subscriptions
    for (const a of adjustments) {
      if (a.type === 'skip_subscription') {
        nextAdjustments.push(a);
      }
    }

    // Add category cuts
    for (const [cat, pct] of Object.entries(newCuts)) {
      if (pct !== 0) {
        nextAdjustments.push({
          type: 'category_cut',
          target: cat,
          changePct: pct / 100
        });
      }
    }

    // Add rent delta
    if (newRentDelta !== 0) {
      nextAdjustments.push({
        type: 'rent_delta',
        target: 'Rent',
        amount: Number(newRentDelta)
      });
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      handleSimulate(nextAdjustments);
    }, 200);
  };

  const handleSliderChange = (category, value) => {
    const updated = { ...categoryCuts, [category]: Number(value) };
    setCategoryCuts(updated);
    triggerSimulation(updated, rentDelta);
  };

  const handleRentStep = (delta) => {
    const nextVal = (rentDelta || 0) + delta;
    setRentDelta(nextVal);
    triggerSimulation(categoryCuts, nextVal);
  };

  // Preset Handlers
  const handlePresetCutDelivery = () => {
    const topCat = projection?.topOverspend?.category || projection?.topCategories?.[0]?.category || 'Food & Dining';
    const updated = { ...categoryCuts, [topCat]: -30 };
    setCategoryCuts(updated);
    triggerSimulation(updated, rentDelta);
  };

  const handlePresetRentUp = () => {
    const nextVal = (rentDelta || 0) + 3000;
    setRentDelta(nextVal);
    triggerSimulation(categoryCuts, nextVal);
  };

  const handlePresetSkipSub = () => {
    const dummySubAdj = {
      type: 'skip_subscription',
      target: 'sample_sub',
      amount: 499
    };
    if (!adjustments.some(a => a.type === 'skip_subscription')) {
      const nextAdj = [...adjustments, dummySubAdj];
      setAdjustments(nextAdj);
      handleSimulate(nextAdj);
    }
  };

  const handleResetAdjustments = () => {
    setCategoryCuts({});
    setRentDelta(0);
    setAdjustments([]);
    handleSimulate([]);
  };

  // Fixed costs helpers
  const fixedCostsList = Array.isArray(profile.fixedCosts)
    ? profile.fixedCosts.map((fc, i) => (typeof fc === 'number' ? { name: `Fixed Cost ${i + 1}`, amount: fc } : fc))
    : [{ name: 'Fixed Outflow', amount: Number(profile.fixedCosts) || 0 }];

  const handleUpdateFixedCost = (index, field, value) => {
    const updated = [...fixedCostsList];
    updated[index] = { ...updated[index], [field]: field === 'amount' ? (Number(value) || 0) : value };
    setProfile({ ...profile, fixedCosts: updated });
    triggerSimulation(categoryCuts, rentDelta);
  };

  const handleAddFixedCost = () => {
    const updated = [...fixedCostsList, { name: 'New Bill', amount: 1000 }];
    setProfile({ ...profile, fixedCosts: updated });
    triggerSimulation(categoryCuts, rentDelta);
  };

  const topCats = projection?.topCategories || [];

  // SVG Chart Dimensions & Computations
  const chartWidth = 600;
  const chartHeight = 220;
  const padding = 35;

  const months = projection?.months || [];
  const planSeries = projection?.planSeries || [];
  const continueSeries = projection?.continueSeries || [];
  const whatIfSeries = projection?.whatIfSeries || null;
  const targetAmount = Number(goal.targetAmount) || 500000;

  const maxVal = Math.max(
    targetAmount * 1.05,
    ...planSeries,
    ...continueSeries,
    ...(whatIfSeries || [])
  );

  const getX = (idx) => {
    if (months.length <= 1) return padding;
    return padding + (idx / (months.length - 1)) * (chartWidth - 2 * padding);
  };

  const getY = (val) => {
    const safeVal = Math.max(0, val || 0);
    return chartHeight - padding - (safeVal / maxVal) * (chartHeight - 2 * padding);
  };

  const toPath = (series) => {
    if (!series || series.length === 0) return '';
    return series.map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(val)}`).join(' ');
  };

  const planPath = toPath(planSeries);
  const continuePath = toPath(continueSeries);
  const whatIfPath = whatIfSeries ? toPath(whatIfSeries) : null;
  const targetY = getY(targetAmount);

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Top Header & Kicker */}
      <div className="flex items-center justify-between pb-space-sm">
        <span className="font-kicker text-kicker uppercase text-on-surface-variant tracking-[0.16em]">
          04 / PLAN
        </span>
        <span className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 bg-secondary"></span>
          FUTURE CASH FLOW TRAJECTORY
        </span>
      </div>

      {/* Editorial Headline */}
      <div className="pt-space-xs pb-space-xs">
        <h1 className="font-['Fraunces'] text-[36px] leading-[40px] tracking-tight font-normal text-on-surface">
          The Course.
        </h1>
        <p className="font-['Fraunces'] italic text-body-lg text-on-surface-variant pt-space-xs">
          Set the goal and test what-ifs. Plain arithmetic moves the arrival date as you drag.
        </p>
      </div>

      {/* Top Drift Nudges Strip */}
      {nudges && nudges.length > 0 && (
        <div className="space-y-1.5 my-space-xs mb-space-md">
          {nudges.map((nudge) => {
            const isWarning = nudge.type === 'warning';
            return (
              <div
                key={nudge.id}
                className="py-1 px-2 font-tabular-sm text-tabular-sm flex items-center gap-2"
                style={{
                  borderLeft: isWarning ? '3px solid #994700' : '3px solid #244f31',
                  backgroundColor: '#f8f3e8'
                }}
              >
                <span className={`inline-block w-2 h-2 shrink-0 ${isWarning ? 'bg-secondary' : 'bg-[#244f31]'}`}></span>
                <span className="text-on-surface font-body-sm italic">{nudge.message}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Two Column Grid: Left Column "Your books" & Right Column "The projection" */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-space-lg">
        {/* Left Column: Your Books (Editable Underlined Fields) */}
        <div className="lg:col-span-5 flex flex-col gap-space-md bg-surface-container-low p-space-md border border-outline-variant">
          <div className="border-b border-outline-variant/60 pb-2">
            <span className="font-kicker text-kicker uppercase tracking-widest text-on-surface">
              // YOUR BOOKS (EDITABLE)
            </span>
          </div>

          {/* Monthly Income */}
          <div className="flex flex-col gap-1">
            <label className="font-label-md text-label-md uppercase text-on-surface-variant">
              Monthly Net Income
            </label>
            <div className="flex items-center gap-1 font-mono font-medium text-lg">
              <span>₹</span>
              <input
                type="number"
                value={profile.monthlyIncome || ''}
                onChange={(e) => {
                  setProfile({ ...profile, monthlyIncome: Number(e.target.value) || 0 });
                  triggerSimulation(categoryCuts, rentDelta);
                }}
                className="bg-transparent border-b border-primary py-0.5 focus:outline-none w-full font-mono"
              />
            </div>
          </div>

          {/* Fixed Costs Rows with + add */}
          <div className="flex flex-col gap-2 pt-1 border-t border-outline-variant/60">
            <div className="flex items-center justify-between">
              <label className="font-label-md text-label-md uppercase text-on-surface-variant">
                Fixed Outflows &amp; Rent
              </label>
              <button
                type="button"
                onClick={handleAddFixedCost}
                className="font-label-md text-[11px] uppercase tracking-wider text-secondary underline cursor-pointer"
              >
                + add
              </button>
            </div>

            <div className="space-y-2">
              {fixedCostsList.map((fc, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={fc.name}
                    onChange={(e) => handleUpdateFixedCost(idx, 'name', e.target.value)}
                    className="bg-transparent border-b border-outline-variant py-0.5 font-body-sm w-36 text-on-surface focus:outline-none focus:border-primary"
                  />
                  <span className="font-mono text-sm">₹</span>
                  <input
                    type="number"
                    value={fc.amount || ''}
                    onChange={(e) => handleUpdateFixedCost(idx, 'amount', e.target.value)}
                    className="bg-transparent border-b border-outline-variant py-0.5 font-mono text-sm w-24 text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Goal Settings */}
          <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant/60">
            <label className="font-label-md text-label-md uppercase text-on-surface-variant">
              Target Milestone &amp; Savings
            </label>

            <div className="flex flex-col gap-1.5">
              <span className="font-body-sm text-[12px] text-on-surface-variant italic">Goal Name</span>
              <input
                type="text"
                value={goal.name || ''}
                onChange={(e) => {
                  setGoal({ ...goal, name: e.target.value });
                }}
                className="bg-transparent border-b border-primary py-0.5 font-['Fraunces'] text-lg text-on-surface focus:outline-none"
              />

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="font-body-sm text-[12px] text-on-surface-variant italic">Target (₹)</span>
                  <input
                    type="number"
                    value={goal.targetAmount || ''}
                    onChange={(e) => {
                      setGoal({ ...goal, targetAmount: Number(e.target.value) || 0 });
                      triggerSimulation(categoryCuts, rentDelta);
                    }}
                    className="bg-transparent border-b border-primary py-0.5 font-mono w-full text-on-surface focus:outline-none"
                  />
                </div>
                <div>
                  <span className="font-body-sm text-[12px] text-on-surface-variant italic">Target Date</span>
                  <input
                    type="date"
                    value={goal.targetDate || ''}
                    onChange={(e) => {
                      setGoal({ ...goal, targetDate: e.target.value });
                      triggerSimulation(categoryCuts, rentDelta);
                    }}
                    className="bg-transparent border-b border-primary py-0.5 font-mono w-full text-on-surface focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-1">
                <span className="font-body-sm text-[12px] text-on-surface-variant italic">Currently Saved (₹)</span>
                <input
                  type="number"
                  value={goal.saved || ''}
                  onChange={(e) => {
                    setGoal({ ...goal, saved: Number(e.target.value) || 0 });
                    triggerSimulation(categoryCuts, rentDelta);
                  }}
                  className="bg-transparent border-b border-primary py-0.5 font-mono w-full text-on-surface focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: The Projection Chart & What-If Controls */}
        <div className="lg:col-span-7 flex flex-col gap-space-md">
          {/* Projection Chart Container */}
          <div className="bg-surface-container-lowest p-space-md border border-outline-variant flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
              <span className="font-kicker text-kicker uppercase tracking-widest text-on-surface">
                // PROJECTION HORIZON
              </span>
              <div className="flex items-center gap-3 font-tabular-sm text-[11px]">
                <span className="flex items-center gap-1 text-secondary">
                  <span className="w-3 h-0.5 border-b border-dashed border-secondary"></span> Status quo
                </span>
                <span className="flex items-center gap-1 text-[#244f31]">
                  <span className="w-3 h-0.5 bg-[#244f31]"></span> Plan
                </span>
                {whatIfSeries && (
                  <span className="flex items-center gap-1 text-primary">
                    <span className="w-3 h-0.5 bg-primary"></span> What-If
                  </span>
                )}
              </div>
            </div>

            {/* SVG Visualizer */}
            <div className="relative w-full overflow-hidden">
              <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto select-none">
                {/* Horizontal target line */}
                <line
                  x1={padding}
                  y1={targetY}
                  x2={chartWidth - padding}
                  y2={targetY}
                  stroke="#cac6bd"
                  strokeDasharray="3 3"
                />
                <text
                  x={chartWidth - padding}
                  y={targetY - 5}
                  textAnchor="end"
                  className="font-mono text-[10px] fill-on-surface-variant"
                >
                  Target: ₹{targetAmount.toLocaleString('en-IN')}
                </text>

                {/* Plan Series (Moss solid) */}
                <path
                  d={planPath}
                  fill="none"
                  stroke="#244f31"
                  strokeWidth="2"
                />

                {/* Continue Series (Marigold dashed) */}
                <path
                  d={continuePath}
                  fill="none"
                  stroke="#994700"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />

                {/* What-If Series (Solid ink) */}
                {whatIfPath && (
                  <path
                    d={whatIfPath}
                    fill="none"
                    stroke="#1c1b18"
                    strokeWidth="2.5"
                  />
                )}
              </svg>

              {/* Handwritten Note at widest gap */}
              {projection?.topOverspend && (
                <div className="text-[12px] font-['Fraunces'] italic text-secondary pt-1 text-right">
                  ↳ this gap is mostly {projection.topOverspend.category}
                </div>
              )}
            </div>

            {/* Impact Sentence Below Chart */}
            <div className="pt-2 border-t border-outline-variant/60 font-body-md text-on-surface">
              Carrying on, you reach ₹{targetAmount.toLocaleString('en-IN')} in{' '}
              <strong className="font-mono font-medium">{projection?.goalDateContinue || 'beyond horizon'}</strong>.
              {whatIfSeries && projection?.goalDateWhatIf && (
                <> With these changes, <strong className="font-mono text-[#244f31] font-medium">{projection.goalDateWhatIf}</strong>.</>
              )}
            </div>
          </div>

          {/* What-If Panel */}
          <div className="bg-surface-container-low p-space-md border border-outline-variant flex flex-col gap-space-sm">
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
              <span className="font-kicker text-kicker uppercase tracking-widest text-on-surface">
                // WHAT-IF LEVERS
              </span>
              <button
                type="button"
                onClick={handleResetAdjustments}
                className="font-label-md text-[11px] uppercase tracking-wider text-on-surface-variant underline hover:text-primary cursor-pointer"
              >
                Reset
              </button>
            </div>

            {/* Presets Strip */}
            <div className="flex items-center gap-x-3 gap-y-1.5 flex-wrap font-body-sm text-body-sm">
              <span className="font-kicker text-kicker uppercase text-on-surface-variant">Presets:</span>
              <button
                type="button"
                onClick={handlePresetCutDelivery}
                className="text-primary underline underline-offset-4 hover:text-secondary cursor-pointer"
              >
                "Cut food delivery 30%"
              </button>
              <button
                type="button"
                onClick={handlePresetRentUp}
                className="text-primary underline underline-offset-4 hover:text-secondary cursor-pointer"
              >
                "Rent goes up ₹3,000"
              </button>
              <button
                type="button"
                onClick={handlePresetSkipSub}
                className="text-primary underline underline-offset-4 hover:text-secondary cursor-pointer"
              >
                "Skip one subscription"
              </button>
            </div>

            {/* Sliders Grid for Top 4 Variable Categories (-50% to +50%) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm pt-2">
              {topCats.map(({ category, monthlyAvg }) => {
                const currentVal = categoryCuts[category] || 0;
                return (
                  <div key={category} className="bg-surface-container-lowest p-2 border border-outline-variant/60 flex flex-col gap-1">
                    <div className="flex items-center justify-between font-label-md text-[12px]">
                      <span className="text-on-surface font-medium truncate">{category}</span>
                      <span className={`font-mono ${currentVal < 0 ? 'text-[#244f31]' : currentVal > 0 ? 'text-secondary' : 'text-on-surface-variant'}`}>
                        {currentVal > 0 ? `+${currentVal}%` : `${currentVal}%`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="5"
                      value={currentVal}
                      onChange={(e) => handleSliderChange(category, e.target.value)}
                      className="w-full accent-primary cursor-pointer"
                    />
                  </div>
                );
              })}
            </div>

            {/* Rent Stepper (₹500 steps) */}
            <div className="flex items-center justify-between pt-2 border-t border-outline-variant/60 font-label-md text-label-md">
              <span className="text-on-surface uppercase">Rent Stepper (₹500 steps):</span>
              <div className="flex items-center gap-2 font-mono">
                <button
                  type="button"
                  onClick={() => handleRentStep(-500)}
                  className="px-2 py-0.5 border border-primary bg-surface-container-lowest hover:bg-surface cursor-pointer"
                >
                  -₹500
                </button>
                <span className="w-16 text-center font-medium">
                  {rentDelta > 0 ? `+₹${rentDelta}` : rentDelta < 0 ? `-₹${Math.abs(rentDelta)}` : '₹0'}
                </span>
                <button
                  type="button"
                  onClick={() => handleRentStep(500)}
                  className="px-2 py-0.5 border border-primary bg-surface-container-lowest hover:bg-surface cursor-pointer"
                >
                  +₹500
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Dispatch Action */}
      <div className="flex items-center justify-between pt-space-md border-t border-outline-variant mt-space-lg">
        <span className="font-body-sm text-body-sm text-on-surface-variant italic">
          Ready to receive the arrival testimony?
        </span>
        <button
          type="button"
          onClick={() => setActiveTab('letter')}
          className="bg-primary text-surface px-space-lg py-3 font-label-md text-label-md uppercase tracking-wider flex items-center gap-2 hover:bg-on-surface-variant transition-colors cursor-pointer"
          style={{ borderRadius: 0 }}
        >
          <span>Dispatch Future You letter</span>
          <span className="font-tabular-md">→</span>
        </button>
      </div>
    </div>
  );
}
