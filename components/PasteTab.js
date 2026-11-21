'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useLedger } from '@/context/LedgerContext';
import { SAMPLE_RAW_SMS } from '@/lib/mock/sampleData';

const DEFAULT_SAMPLE_TEXT = `Rs 499.00 debited from A/C XX4102 on 12-Nov-26 to NETFLIX MUMBAI. Ref 631728192831. Bal Rs 41,200.00 - HDFC Bank
Paid Rs 340.00 to SWIGGY via UPI on 14-Nov-26. Ref 631892182912 - ICICI Bank`;

export default function PasteTab() {
  const {
    handleParseAndCategorize,
    handleLoadSampleData,
    lastParseStats,
    unparsed,
    isLoading,
    error,
    setActiveTab
  } = useLedger();

  const [inputText, setInputText] = useState(DEFAULT_SAMPLE_TEXT);
  const [showRawDrawer, setShowRawDrawer] = useState(false);
  const fileInputRef = useRef(null);

  const lineCount = inputText.trim() ? inputText.trim().split('\n').filter(Boolean).length : 0;

  const handleRead = async () => {
    if (!inputText.trim()) return;
    await handleParseAndCategorize({ text: inputText });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const csvContent = event.target?.result;
      if (typeof csvContent === 'string') {
        setInputText(csvContent);
        await handleParseAndCategorize({ csv: csvContent });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col w-full pb-12">
      {/* Hidden CSV file picker */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".csv,text/csv"
        className="hidden"
      />

      {/* Top Ledger Margin & Kicker */}
      <div className="flex items-center justify-between pb-space-sm">
        <span className="font-kicker text-kicker uppercase text-on-surface-variant tracking-[0.16em]">
          01 / PASTE
        </span>
        <span className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 bg-secondary"></span>
          UNRECONCILED DESK
        </span>
      </div>

      {/* Editorial Headline Section */}
      <div className="pt-space-xs pb-space-md">
        <h1 className="font-['Fraunces'] text-[36px] leading-[40px] tracking-tight font-normal text-on-surface">
          Bring your mess.
        </h1>
        <p className="font-['Fraunces'] italic text-body-lg text-on-surface-variant pt-space-xs">
          Paste whatever your bank sent you. I'll handle the mess.
        </p>
      </div>

      {/* Inline Marigold Error Banner */}
      {error && (
        <div
          className="bg-surface-container-high p-space-md mb-space-md flex items-start gap-space-sm"
          style={{ borderLeft: '3px solid #ba1a1a' }}
        >
          <span className="material-symbols-outlined text-error text-[20px] shrink-0 mt-0.5">error</span>
          <div className="flex flex-col">
            <span className="font-label-md text-label-md uppercase tracking-wider text-error">
              // AUDIT INTERRUPTION
            </span>
            <p className="font-body-sm text-body-sm text-on-surface mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Munshi Advice Stamp Note */}
      <div
        className="bg-surface-container-high p-space-md mb-space-lg flex items-start gap-space-sm"
        style={{ borderLeft: '3px solid #994700' }}
      >
        <span className="material-symbols-outlined text-secondary text-[20px] shrink-0 mt-0.5">history_edu</span>
        <div className="flex flex-col">
          <span className="font-label-md text-label-md uppercase tracking-wider text-secondary">
            // MUNSHI GUIDANCE
          </span>
          <p className="font-body-sm text-body-sm text-on-surface italic mt-0.5">
            Raw transactional text messages, UPI push notes, or copied email intimations. Leave in the sender IDs and timestamps; the ledger sorts chronology on its own.
          </p>
        </div>
      </div>

      {/* The Parchment Ruled Textarea Card */}
      <div
        className="bg-surface-container-lowest p-space-md flex flex-col relative"
        style={{ boxShadow: 'inset 0 0 0 1px #cac6bd' }}
      >
        {/* Folio Header Bar */}
        <div className="flex items-center justify-between pb-space-xs mb-space-xs border-b border-outline-variant/60">
          <div className="flex items-center gap-2">
            <span className="font-kicker text-kicker uppercase tracking-widest text-on-surface-variant">
              LEDGER INTAKE FOLIO
            </span>
            <span className="font-tabular-sm text-tabular-sm text-on-surface-variant/80">#BK-2026-NOV</span>
          </div>
          <span className="font-tabular-sm text-tabular-sm text-on-surface-variant">
            {lineCount} {lineCount === 1 ? 'line buffered' : 'lines buffered'}
          </span>
        </div>

        {/* Ruled Line Background Textarea Wrapper */}
        <div className="relative w-full min-h-[260px] bg-surface-container-lowest">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            rows={9}
            spellCheck={false}
            placeholder="Paste your bank SMS messages or statement here..."
            className="w-full min-h-[260px] bg-transparent font-tabular-md text-tabular-md text-on-surface p-space-xs resize-y focus:outline-none placeholder-on-surface-variant/40 selection:bg-secondary-fixed selection:text-on-secondary-fixed"
            style={{
              backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, #cac6bd 31px, #cac6bd 32px)',
              lineHeight: '32px',
              paddingTop: '1px',
              border: 'none',
              borderRadius: '0px'
            }}
          />
        </div>

        {/* Quick Format Assistance Strip */}
        <div className="flex items-center justify-between pt-space-xs border-t border-outline-variant/60 font-kicker text-kicker text-on-surface-variant uppercase">
          <span>Auto-splits SMS, NEFT &amp; IMPS</span>
          <span className="text-on-surface">Private • Parsed locally</span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-space-md pt-space-lg">
        <div className="flex items-center gap-space-sm flex-wrap">
          {/* Primary Action: Read These */}
          <button
            type="button"
            disabled={isLoading || !inputText.trim()}
            onClick={handleRead}
            className="bg-primary text-surface px-space-md py-3 font-label-md text-label-md uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-on-surface-variant transition-colors disabled:opacity-50 cursor-pointer"
            style={{ borderRadius: 0 }}
          >
            <span className="material-symbols-outlined text-[16px]">menu_book</span>
            <span>{isLoading ? 'Reading...' : 'Read these'}</span>
          </button>

          {/* Secondary: Upload CSV */}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => fileInputRef.current?.click()}
            className="bg-surface-container-low text-on-surface px-space-md py-3 font-label-md text-label-md uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-surface-container transition-colors disabled:opacity-50 cursor-pointer"
            style={{ border: '1px solid #1c1b18', borderRadius: 0 }}
          >
            <span className="material-symbols-outlined text-[16px]">file_upload</span>
            <span>Upload CSV</span>
          </button>
        </div>

        {/* Text Link: Try with Sample Data */}
        <button
          type="button"
          disabled={isLoading}
          onClick={async () => {
            setInputText(SAMPLE_RAW_SMS);
            await handleLoadSampleData();
          }}
          className="font-label-md text-label-md uppercase tracking-wider text-primary underline underline-offset-4 decoration-primary hover:text-secondary self-start sm:self-center transition-colors py-2 cursor-pointer"
        >
          Try with sample data
        </button>
      </div>

      {/* Subtle Archival Divider */}
      <div className="w-full my-space-xl" style={{ height: '1px', backgroundColor: '#cac6bd' }}></div>

      {/* Parsing Result Ledger Pane */}
      {lastParseStats && (
        <div
          className="bg-surface-container p-space-md relative flex flex-col gap-space-md"
          style={{ border: '1px solid #cac6bd', borderRadius: 0 }}
        >
          {/* Header of the intake audit */}
          <div className="flex items-center justify-between border-b border-outline-variant pb-space-sm">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-secondary text-[20px]">assignment_turned_in</span>
              <span className="font-kicker text-kicker uppercase tracking-widest text-on-surface">
                Munshi's Intake Audit
              </span>
            </div>
            <span
              className="font-label-md text-label-md text-on-surface-variant bg-surface-container-high px-2 py-0.5"
              style={{ border: '1px solid #cac6bd' }}
            >
              VERIFIED {lastParseStats.parsed} TRANSACTIONS
            </span>
          </div>

          {/* Tally Grid Metric */}
          <div className="grid grid-cols-3 gap-space-sm py-space-xs">
            <div className="bg-surface-container-low p-space-sm" style={{ border: '1px solid #cac6bd' }}>
              <span className="font-kicker text-kicker uppercase text-on-surface-variant block">Discovered</span>
              <span className="font-tabular-lg text-tabular-lg font-medium text-on-surface">
                {String(lastParseStats.discovered).padStart(2, '0')}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant block italic">SMS / Notes</span>
            </div>

            <div
              className="bg-surface-container-low p-space-sm"
              style={{
                borderLeft: '3px solid #244f31',
                borderTop: '1px solid #cac6bd',
                borderRight: '1px solid #cac6bd',
                borderBottom: '1px solid #cac6bd'
              }}
            >
              <span className="font-kicker text-kicker uppercase text-on-tertiary-fixed-variant block">Parsed</span>
              <span className="font-tabular-lg text-tabular-lg font-medium text-on-surface">
                {String(lastParseStats.parsed).padStart(2, '0')}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant block italic">Categorized</span>
            </div>

            <div
              className="bg-surface-container-low p-space-sm"
              style={{
                borderLeft: '3px solid #994700',
                borderTop: '1px solid #cac6bd',
                borderRight: '1px solid #cac6bd',
                borderBottom: '1px solid #cac6bd'
              }}
            >
              <span className="font-kicker text-kicker uppercase text-secondary block">Ambiguous</span>
              <span className="font-tabular-lg text-tabular-lg font-medium text-secondary">
                {String(lastParseStats.unparsed).padStart(2, '0')}
              </span>
              <span className="font-body-sm text-body-sm text-on-surface-variant block italic">Raw strings</span>
            </div>
          </div>

          {/* Editorial Result Statement */}
          <div className="pt-space-xs">
            <p className="font-body-lg text-body-lg text-on-surface leading-snug">
              Read {lastParseStats.discovered} messages. Understood {lastParseStats.parsed}.{' '}
              {lastParseStats.unparsed > 0 ? `Couldn't read ${lastParseStats.unparsed}.` : 'Reconciled all entries.'}
            </p>
            {lastParseStats.unparsed > 0 && (
              <div className="pt-space-xs flex items-center gap-space-sm">
                <button
                  type="button"
                  onClick={() => setShowRawDrawer(!showRawDrawer)}
                  className="font-kicker text-kicker uppercase tracking-wider text-secondary underline underline-offset-4 decoration-secondary hover:text-on-secondary-fixed transition-colors cursor-pointer"
                >
                  {showRawDrawer ? `hide the ${lastParseStats.unparsed} raw lines` : `show the ${lastParseStats.unparsed} raw lines`}
                </button>
              </div>
            )}
          </div>

          {/* Collapsible Raw Ambiguous Lines Inspection Pane */}
          {showRawDrawer && unparsed.length > 0 && (
            <div
              className="bg-surface-container-highest p-space-md"
              style={{ border: '1px solid #cac6bd' }}
            >
              <div className="flex items-center justify-between pb-space-xs mb-space-xs border-b border-outline-variant">
                <span className="font-kicker text-kicker uppercase text-on-surface-variant">
                  Unresolved Text Segments (Manual Ledger Needed)
                </span>
                <span className="font-tabular-sm text-tabular-sm text-secondary">
                  {unparsed.length} entries
                </span>
              </div>
              <div className="space-y-space-sm font-tabular-sm text-tabular-sm text-on-surface">
                {unparsed.map((line, idx) => (
                  <div
                    key={idx}
                    className="p-space-xs bg-surface-container-low"
                    style={{ borderLeft: '2px solid #994700' }}
                  >
                    <span className="text-on-surface-variant block text-[11px] uppercase tracking-wider">
                      Entry {idx + 1}
                    </span>
                    <code>"{line}"</code>
                    <p className="font-body-sm text-body-sm italic text-on-surface-variant mt-1">
                      Munshi note: Non-settlement message or non-standard format.
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bottom Actions: Advance to Ledger Page */}
          <div className="pt-space-sm border-t border-outline-variant flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm">
            <span className="font-body-sm text-body-sm text-on-surface-variant italic">
              Balances automatically calculated with ledger rules.
            </span>
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className="w-full sm:w-auto bg-primary text-surface px-space-lg py-3 font-label-md text-label-md uppercase tracking-wider flex items-center justify-center gap-space-sm hover:bg-on-surface-variant transition-colors cursor-pointer"
              style={{ borderRadius: 0 }}
            >
              <span>Open the ledger</span>
              <span className="font-tabular-md">→</span>
            </button>
          </div>
        </div>
      )}

      {/* Historical Archival Context Stamp */}
      <div className="mt-space-lg p-space-md bg-surface-container-low flex items-center justify-between border-t border-b border-outline-variant">
        <div className="flex items-center gap-space-sm">
          <span className="material-symbols-outlined text-outline text-[18px]">verified_user</span>
          <span className="font-kicker text-kicker uppercase text-on-surface-variant tracking-wider">
            Zero telemetry • Parsed on your machine only
          </span>
        </div>
        <span className="font-tabular-sm text-tabular-sm text-on-surface-variant">FOLIO VOL. XIV</span>
      </div>
    </div>
  );
}
