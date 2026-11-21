'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLedger } from '@/context/LedgerContext';
import { CATEGORIES } from '@/lib/engine/categories';

export default function LedgerTab() {
  const { transactions, setTransactions, rules, setRules, handleLearnRule, isLoading, error } = useLedger();

  const [selectedMonth, setSelectedMonth] = useState('All');
  const [filterType, setFilterType] = useState('all'); // all | debit | credit
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [editingRowId, setEditingRowId] = useState(null);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [flashingRowIds, setFlashingRowIds] = useState(new Set());

  // Margin note & Undo state (lasts 8 seconds)
  const [marginNote, setMarginNote] = useState(null); // { text, previousTxns, previousRules }
  const noteTimerRef = useRef(null);

  // Extract unique available months from transactions
  const availableMonths = React.useMemo(() => {
    const months = new Set();
    for (const t of transactions) {
      if (t.date) {
        try {
          const d = new Date(t.date);
          const mon = d.toLocaleString('en-US', { month: 'short' });
          months.add(mon);
        } catch {}
      }
    }
    return Array.from(months);
  }, [transactions]);

  // Filter transactions
  const filtered = transactions.filter(t => {
    // Month filter
    if (selectedMonth !== 'All' && t.date) {
      const d = new Date(t.date);
      const mon = d.toLocaleString('en-US', { month: 'short' });
      if (mon !== selectedMonth) return false;
    }

    // Direction filter
    if (filterType === 'debit' && t.direction !== 'debit') return false;
    if (filterType === 'credit' && t.direction !== 'credit') return false;

    // Category filter
    if (categoryFilter !== 'All' && t.category !== categoryFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchMerchant = (t.merchant || '').toLowerCase().includes(q);
      const matchCat = (t.category || '').toLowerCase().includes(q);
      const matchRaw = (t.rawText || '').toLowerCase().includes(q);
      if (!matchMerchant && !matchCat && !matchRaw) return false;
    }

    return true;
  });

  // Calculate totals for active filtered set
  const totalCredit = filtered
    .filter(t => t.direction === 'credit')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const totalDebit = filtered
    .filter(t => t.direction === 'debit')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  const netBalance = totalCredit - totalDebit;

  const handleCategorySelect = async (txn, newCategory) => {
    if (!newCategory || txn.category === newCategory) {
      setEditingRowId(null);
      return;
    }

    // Save snapshot for 8-second undo
    const snapshotTxns = [...transactions];
    const snapshotRules = [...rules];

    const res = await handleLearnRule(txn, newCategory);
    setEditingRowId(null);
    setCustomCategoryInput('');

    if (res.success) {
      const count = res.affectedCount || 0;
      const targetKey = txn.merchantKey;

      // Flash moss underline on affected rows
      const affectedIds = new Set(
        transactions
          .filter(t => t.merchantKey === targetKey)
          .map(t => t.id)
      );
      setFlashingRowIds(affectedIds);
      setTimeout(() => setFlashingRowIds(new Set()), 2000);

      // Margin note for 8 seconds
      const noteText = `↳ Learned: ${txn.merchant} is ${newCategory}. Also fixed ${count} other ${count === 1 ? 'row' : 'rows'}.`;
      setMarginNote({
        text: noteText,
        snapshotTxns,
        snapshotRules
      });

      if (noteTimerRef.current) {
        clearTimeout(noteTimerRef.current);
      }
      noteTimerRef.current = setTimeout(() => {
        setMarginNote(null);
      }, 8000);
    }
  };

  const handleUndo = () => {
    if (!marginNote) return;
    setTransactions(marginNote.snapshotTxns);
    setRules(marginNote.snapshotRules);
    setMarginNote(null);
    if (noteTimerRef.current) {
      clearTimeout(noteTimerRef.current);
    }
  };

  return (
    <div className="flex flex-col w-full pb-12">
      {/* Top Header & Kicker */}
      <div className="flex items-center justify-between pb-space-sm">
        <span className="font-kicker text-kicker uppercase text-on-surface-variant tracking-[0.16em]">
          02 / LEDGER
        </span>
        <span className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 bg-secondary"></span>
          CHRONOLOGICAL JOURNAL
        </span>
      </div>

      {/* Editorial Headline */}
      <div className="pt-space-xs pb-space-xs">
        <h1 className="font-['Fraunces'] text-[36px] leading-[40px] tracking-tight font-normal text-on-surface">
          The Books.
        </h1>
        <p className="font-['Fraunces'] italic text-body-lg text-on-surface-variant pt-space-xs">
          Every rupee accounted for. Fix a category, and Munshi remembers it forever.
        </p>
      </div>

      {/* Summary Sentence Strip */}
      <div className="py-space-xs mb-space-sm font-tabular-md text-tabular-md text-on-surface border-b border-outline-variant/60 flex items-center gap-2">
        <span>In <strong className="text-[#244f31] font-medium font-mono">₹{totalCredit.toLocaleString('en-IN')}</strong></span>
        <span>·</span>
        <span>Out <strong className="text-primary font-medium font-mono">₹{totalDebit.toLocaleString('en-IN')}</strong></span>
        <span>·</span>
        <span>Left <strong className={`font-medium font-mono ${netBalance >= 0 ? 'text-[#244f31]' : 'text-secondary'}`}>
          {netBalance < 0 ? '-' : ''}₹{Math.abs(netBalance).toLocaleString('en-IN')}
        </strong></span>
      </div>

      {/* Margin Note with 8-second Undo */}
      {marginNote && (
        <div
          className="bg-surface-container-high p-space-sm mb-space-sm flex items-center justify-between"
          style={{ borderLeft: '3px solid #244f31', border: '1px solid #cac6bd' }}
        >
          <span className="font-tabular-sm text-tabular-sm text-on-surface font-mono">
            {marginNote.text}
          </span>
          <button
            type="button"
            onClick={handleUndo}
            className="font-label-md text-label-md uppercase tracking-wider text-secondary underline underline-offset-4 decoration-secondary hover:text-on-secondary-fixed cursor-pointer ml-3 shrink-0"
          >
            Undo
          </button>
        </div>
      )}

      {/* Error notification if any */}
      {error && (
        <div
          className="bg-surface-container-high p-space-sm mb-space-sm flex items-center gap-2 text-error"
          style={{ borderLeft: '3px solid #ba1a1a', border: '1px solid #cac6bd' }}
        >
          <span className="font-tabular-sm text-tabular-sm">{error}</span>
        </div>
      )}

      {/* Month Links & Filter Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-sm py-space-xs mb-space-xs">
        {/* Month Links (Aug · Sep · Oct · Nov · All) */}
        <div className="flex items-center gap-2 flex-wrap font-tabular-sm text-tabular-sm">
          {availableMonths.map(mon => (
            <React.Fragment key={mon}>
              <button
                type="button"
                onClick={() => setSelectedMonth(mon)}
                className={`cursor-pointer transition-colors ${
                  selectedMonth === mon
                    ? 'text-primary font-semibold underline underline-offset-4 decoration-secondary'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {mon}
              </button>
              <span>·</span>
            </React.Fragment>
          ))}
          <button
            type="button"
            onClick={() => setSelectedMonth('All')}
            className={`cursor-pointer transition-colors ${
              selectedMonth === 'All'
                ? 'text-primary font-semibold underline underline-offset-4 decoration-secondary'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            All
          </button>
        </div>

        {/* Category & Search Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-surface border border-outline-variant font-tabular-sm text-tabular-sm px-2 py-1 text-on-surface focus:outline-none cursor-pointer"
            style={{ borderRadius: 0 }}
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search merchant or text..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-surface border border-outline-variant font-tabular-sm text-tabular-sm px-2 py-1 text-on-surface focus:outline-none w-36 sm:w-44"
            style={{ borderRadius: 0 }}
          />
        </div>
      </div>

      {/* The Core Bahi-Khata Ledger Table */}
      <div
        className="bg-surface-container-lowest overflow-x-auto border border-outline-variant"
        style={{ borderRadius: 0 }}
      >
        <table className="w-full text-left border-collapse">
          <thead>
            <tr
              className="border-b-2 border-outline-variant font-kicker text-kicker uppercase text-on-surface-variant bg-surface-container-high"
              style={{ borderBottom: '3px double #cac6bd' }}
            >
              <th className="p-3 w-28">Date</th>
              <th className="p-3">Merchant</th>
              <th className="p-3 w-52">Category</th>
              <th className="p-3 w-36 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/60 font-tabular-sm text-tabular-sm">
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-10 text-center text-on-surface-variant italic font-body-md">
                  The books are empty. Paste some texts first on the 01 Paste tab.
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-10 text-center text-on-surface-variant italic font-body-md">
                  No transactions match the selected filters.
                </td>
              </tr>
            ) : (
              filtered.map((t) => {
                const isDebit = t.direction === 'debit';
                const isExpanded = expandedRowId === t.id;
                const isEditing = editingRowId === t.id;
                const isFlashing = flashingRowIds.has(t.id);
                const isAmbiguous = t.categorySource === 'unsure' || t.category === 'Other';

                return (
                  <React.Fragment key={t.id}>
                    <tr
                      className={`hover:bg-surface-container-low transition-colors ${
                        isFlashing ? 'border-b-2 border-[#244f31] bg-surface-container-low' : ''
                      }`}
                    >
                      {/* Date */}
                      <td className="p-3 whitespace-nowrap text-on-surface-variant font-mono">
                        {t.date}
                      </td>

                      {/* Merchant (Clickable to reveal raw SMS) */}
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => setExpandedRowId(isExpanded ? null : t.id)}
                          className="text-left font-medium text-on-surface hover:text-secondary underline decoration-dotted underline-offset-4 cursor-pointer"
                        >
                          {t.merchant}
                        </button>
                      </td>

                      {/* Category (Clickable to pick or type custom) */}
                      <td className="p-3">
                        {isEditing ? (
                          <div className="flex flex-col gap-1">
                            <select
                              value={CATEGORIES.includes(t.category) ? t.category : 'Other'}
                              onChange={(e) => {
                                if (e.target.value === 'Other') {
                                  // Keep editing open for custom input
                                } else {
                                  handleCategorySelect(t, e.target.value);
                                }
                              }}
                              className="bg-surface border border-primary p-1 font-tabular-sm text-tabular-sm text-on-surface"
                              style={{ borderRadius: 0 }}
                              autoFocus
                            >
                              {CATEGORIES.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                              ))}
                            </select>
                            <div className="flex items-center gap-1 mt-1">
                              <input
                                type="text"
                                placeholder="Or type custom..."
                                value={customCategoryInput}
                                onChange={(e) => setCustomCategoryInput(e.target.value)}
                                className="bg-surface border border-outline-variant p-1 font-tabular-sm text-[12px] w-full"
                              />
                              <button
                                type="button"
                                disabled={!customCategoryInput.trim()}
                                onClick={() => handleCategorySelect(t, customCategoryInput.trim())}
                                className="px-2 py-1 bg-primary text-surface font-label-md text-[10px] uppercase cursor-pointer"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRowId(t.id);
                              setCustomCategoryInput('');
                            }}
                            className={`text-left cursor-pointer transition-colors ${
                              isAmbiguous
                                ? 'text-secondary font-mono italic underline decoration-secondary underline-offset-2'
                                : 'text-on-surface hover:text-secondary'
                            }`}
                          >
                            {isAmbiguous ? 'unsure, tap to set' : t.category}
                          </button>
                        )}
                      </td>

                      {/* Amount */}
                      <td className="p-3 text-right whitespace-nowrap font-medium font-mono">
                        <span className={isDebit ? 'text-primary' : 'text-[#244f31]'}>
                          {isDebit ? '' : '+ '}₹{Number(t.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>

                    {/* Expandable Original SMS Drawer */}
                    {isExpanded && t.rawText && (
                      <tr className="bg-surface-container">
                        <td colSpan={4} className="p-3 pl-8 text-on-surface-variant font-mono text-[12px] border-b border-outline-variant/60">
                          <span className="font-kicker text-kicker uppercase text-secondary block mb-0.5">
                            Original Bank Intimation:
                          </span>
                          <code>"{t.rawText}"</code>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
