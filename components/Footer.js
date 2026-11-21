'use client';

import React from 'react';
import { useLedger } from '@/context/LedgerContext';

export default function Footer() {
  const { setShowResetModal } = useLedger();

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(new Date());

  return (
    <footer className="md:hidden fixed bottom-0 inset-x-0 z-50 pb-safe bg-surface-container/95 backdrop-blur-xl shadow-[0_-1px_8px_rgba(0,0,0,0.03)]">
      <div className="h-12 px-margin flex items-center justify-between">
        <div className="flex items-center gap-space-xs">
          <span className="w-1.5 h-1.5 bg-tertiary-fixed-dim inline-block"></span>
          <span className="font-tabular-sm text-tabular-sm text-on-surface-variant font-mono">
            Books as of {formattedDate}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowResetModal(true)}
          className="font-kicker text-kicker uppercase tracking-wider text-primary underline underline-offset-4 decoration-primary min-h-[44px] flex items-center hover:text-secondary cursor-pointer"
        >
          Reset books
        </button>
      </div>
    </footer>
  );
}
