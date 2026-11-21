'use client';

import React from 'react';
import { LedgerProvider, useLedger } from '@/context/LedgerContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ResetDialog from '@/components/ResetDialog';
import PasteTab from '@/components/PasteTab';
import LedgerTab from '@/components/LedgerTab';
import QuietLeaksTab from '@/components/QuietLeaksTab';
import PlanTab from '@/components/PlanTab';
import LetterTab from '@/components/LetterTab';

function TabContent() {
  const { activeTab } = useLedger();

  switch (activeTab) {
    case 'paste':
      return <PasteTab />;
    case 'ledger':
      return <LedgerTab />;
    case 'quiet-leaks':
      return <QuietLeaksTab />;
    case 'plan':
      return <PlanTab />;
    case 'letter':
      return <LetterTab />;
    default:
      return <PasteTab />;
  }
}

export default function Home() {
  return (
    <LedgerProvider>
      <Header />
      <main className="flex flex-col relative w-full md:pl-72 px-margin md:px-12 pt-28 md:pt-10 pb-16 md:pb-12 bg-surface min-h-screen">
        <div className="max-w-5xl w-full mx-auto">
          <TabContent />
        </div>
      </main>
      <Footer />
      <ResetDialog />
    </LedgerProvider>
  );
}
