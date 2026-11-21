'use client';

import React from 'react';
import { useLedger } from '@/context/LedgerContext';

export default function ResetDialog() {
  const { showResetModal, setShowResetModal, handleResetBooks } = useLedger();

  if (!showResetModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-none">
      <div
        className="bg-surface-container-lowest max-w-md w-full p-6 border-2 border-primary"
        style={{ borderRadius: 0 }}
      >
        <div className="flex items-center gap-2 border-b border-outline-variant pb-2 mb-4">
          <span className="material-symbols-outlined text-secondary text-[22px]">warning</span>
          <span className="font-kicker text-kicker uppercase tracking-widest text-primary">
            CONFIRM RECONCILIATION RESET
          </span>
        </div>

        <h3 className="font-['Fraunces'] text-2xl text-on-surface mb-2 font-normal">
          Clear all ledger folios?
        </h3>

        <p className="font-body-md text-on-surface-variant mb-6 italic">
          This will wipe all transactions, user categorization rules, recurring charges, and your future projection from this browser. This cannot be undone.
        </p>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant">
          <button
            type="button"
            onClick={() => setShowResetModal(false)}
            className="px-4 py-2 border border-primary font-label-md text-label-md uppercase tracking-wider hover:bg-surface-container transition-colors"
            style={{ borderRadius: 0 }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleResetBooks}
            className="px-4 py-2 bg-error text-white font-label-md text-label-md uppercase tracking-wider hover:bg-red-800 transition-colors"
            style={{ borderRadius: 0 }}
          >
            Reset completely
          </button>
        </div>
      </div>
    </div>
  );
}
