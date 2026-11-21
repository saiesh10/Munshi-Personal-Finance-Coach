'use client';

import React from 'react';
import { useLedger } from '@/context/LedgerContext';

const NAV_ITEMS = [
  { id: 'paste', label: '01 Paste' },
  { id: 'ledger', label: '02 Ledger' },
  { id: 'quiet-leaks', label: '03 Quiet leaks' },
  { id: 'plan', label: '04 Plan' },
  { id: 'letter', label: '05 Letter' }
];

export default function Header() {
  const { activeTab, setActiveTab, setShowResetModal, transactions } = useLedger();

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date());

  return (
    <>
      {/* Desktop Left Rail (Always visible on md+ screens) */}
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-64 bg-surface border-r border-outline-variant flex-col justify-between p-6 z-40 select-none">
        {/* Brand Wordmark & Tagline */}
        <div className="flex flex-col gap-1">
          <span className="font-['Fraunces'] text-2xl font-semibold tracking-tight text-primary leading-tight">
            Munshi
          </span>
          <span className="font-body-sm text-body-sm italic text-on-surface-variant">
            The accountant who remembers you.
          </span>
        </div>

        {/* Ledger Contents Navigation (01 to 05) */}
        <nav className="flex flex-col gap-1 my-auto py-6">
          <div className="font-kicker text-kicker uppercase text-on-surface-variant pb-2 tracking-widest">
            // LEDGER FOLIOS
          </div>
          {NAV_ITEMS.map(item => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center text-left py-2.5 px-3 uppercase tracking-wider font-label-md text-label-md transition-all cursor-pointer ${
                  isActive
                    ? 'border-l-4 border-secondary bg-surface-container-low text-primary font-semibold'
                    : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low/50 border-l-4 border-transparent'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Bottom Status & Reset books */}
        <div className="flex flex-col gap-2 pt-4 border-t border-outline-variant/60">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-tertiary-fixed-dim inline-block"></span>
            <span className="font-tabular-sm text-[12px] text-on-surface-variant font-mono">
              Books as of {formattedDate}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="font-kicker text-kicker uppercase tracking-wider text-primary underline underline-offset-4 decoration-primary hover:text-secondary self-start cursor-pointer"
          >
            Reset books
          </button>
        </div>
      </aside>

      {/* Mobile Top Header Strip (visible on < md screens) */}
      <header className="md:hidden fixed top-0 inset-x-0 z-50 bg-surface/90 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)] pt-safe">
        <div className="h-28 px-margin flex flex-col justify-between pt-space-xs pb-space-xs">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="font-['Fraunces'] text-2xl font-semibold tracking-tight text-primary leading-tight">
                Munshi
              </span>
              <span className="font-body-sm text-body-sm italic text-on-surface-variant leading-none">
                The accountant who remembers you.
              </span>
            </div>
            <div className="flex items-center gap-space-sm">
              <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                <span className="material-symbols-outlined text-on-primary text-[18px]">person</span>
              </div>
            </div>
          </div>

          <nav className="flex items-center gap-space-sm overflow-x-auto no-scrollbar py-space-xs">
            {NAV_ITEMS.map(item => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center shrink-0 px-space-sm py-space-xs uppercase tracking-wider transition-colors min-h-[44px] ${
                    isActive
                      ? 'text-primary font-semibold border-b-2 border-secondary'
                      : 'text-on-surface-variant font-kicker text-kicker hover:text-on-surface'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>
    </>
  );
}
