'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useLedger } from '@/context/LedgerContext';
import { isSupported as isTtsSupported, speak, pause, resume, stop, splitSentences } from '@/lib/voice';
import { isSupported as isSttSupported, listen, stopListening } from '@/lib/stt';
import { askFuture } from '@/lib/client';

export default function LetterTab() {
  const {
    letter,
    handleGenerateLetter,
    isLoading: isLetterLoading,
    error: letterError,
    projection,
    goal
  } = useLedger();

  // TTS State
  const [ttsSupported, setTtsSupported] = useState(false);
  const [isSpeakingLetter, setIsSpeakingLetter] = useState(false);
  const [isPausedLetter, setIsPausedLetter] = useState(false);
  const [activeSentenceIndex, setActiveSentenceIndex] = useState(-1);

  // STT & Ask State
  const [sttSupported, setSttSupported] = useState(false);
  const [sttState, setSttState] = useState('idle'); // idle | listening | error
  const [questionInput, setQuestionInput] = useState('');
  const [conversation, setConversation] = useState([]); // Array of { q, a, source } (max 3)
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState(null);

  const usedMicForLastQuestionRef = useRef(false);

  useEffect(() => {
    setTtsSupported(isTtsSupported());
    setSttSupported(isSttSupported());

    return () => {
      stop();
      stopListening();
    };
  }, []);

  // Split letter body into sentences for sequential highlight
  const letterSentences = letter?.text ? splitSentences(letter.text) : [];

  // Read Aloud Handlers
  const handleHearLetter = () => {
    if (!letter?.text || !ttsSupported) return;
    setIsSpeakingLetter(true);
    setIsPausedLetter(false);
    setActiveSentenceIndex(0);

    speak(letter.text, {
      onSentence: (idx) => {
        setActiveSentenceIndex(idx);
      },
      onEnd: () => {
        setIsSpeakingLetter(false);
        setIsPausedLetter(false);
        setActiveSentenceIndex(-1);
      }
    });
  };

  const handlePauseSpeech = () => {
    pause();
    setIsPausedLetter(true);
  };

  const handleResumeSpeech = () => {
    resume();
    setIsPausedLetter(false);
  };

  const handleStopSpeech = () => {
    stop();
    setIsSpeakingLetter(false);
    setIsPausedLetter(false);
    setActiveSentenceIndex(-1);
  };

  // Build current summary object for /api/ask
  const buildCurrentSummary = () => {
    return {
      goalName: goal?.name || 'Financial Goal',
      targetAmount: goal?.targetAmount || 500000,
      targetDate: goal?.targetDate || '2027-10-31',
      saved: goal?.saved || 0,
      monthlyIncome: projection?.monthlyIncome || 92000,
      monthlyFixed: projection?.monthlyFixed || 33000,
      monthlyVariable: projection?.monthlyVariable || 38430,
      monthlyNet: projection?.monthlyNet || 20570,
      whatIfNet: projection?.whatIfNet ?? null,
      shortfallAtTarget: projection?.shortfallAtTarget || 0,
      goalDateContinue: projection?.goalDateContinue || 'Nov 2027',
      goalDatePlan: projection?.goalDatePlan || 'Oct 2027',
      goalDateWhatIf: projection?.goalDateWhatIf || null,
      topCategory: projection?.topOverspend?.category || projection?.topCategories?.[0]?.category || 'Food & Dining',
      topCategories: projection?.topCategories || [],
      topOverspendRupeeGap: projection?.topOverspend?.rupeeGap || 2500,
      cutPctNeeded: projection?.cutPctNeeded || 15
    };
  };

  // Submit question to Future You
  const submitQuestion = async (queryText, usedMic = false) => {
    const q = queryText.trim();
    if (!q || isAsking) return;

    setIsAsking(true);
    setAskError(null);
    usedMicForLastQuestionRef.current = usedMic;
    setQuestionInput('');

    // Prepare previous history (max 3 turns)
    const historyPayload = conversation.slice(-3).map(turn => ({ q: turn.q, a: turn.a }));
    const summary = buildCurrentSummary();

    try {
      const res = await askFuture({
        question: q,
        summary,
        history: historyPayload
      });

      const newTurn = {
        q,
        a: res.answer,
        source: res.source
      };

      setConversation(prev => [...prev.slice(-2), newTurn]);

      // Automatically speak answer ONLY if the question was spoken via mic
      if (usedMic && ttsSupported) {
        speak(res.answer);
      }
    } catch (err) {
      setAskError(err.message || 'Future You could not answer right now.');
    } finally {
      setIsAsking(false);
    }
  };

  // Mic Speech Recognition Handler
  const handleMicClick = () => {
    if (sttState === 'listening') {
      stopListening();
      setSttState('idle');
      return;
    }

    listen({
      onResult: (transcript) => {
        setSttState('idle');
        submitQuestion(transcript, true);
      },
      onError: (err) => {
        setSttState('idle');
        setAskError(typeof err === 'string' ? err : 'Speech could not be recognized. You can type below.');
      },
      onEnd: () => {
        setSttState('idle');
      },
      onStateChange: (state) => {
        setSttState(state);
      }
    });
  };

  const handleSpeakAnswer = (answerText) => {
    if (!ttsSupported) return;
    speak(answerText);
  };

  const wordCount = letter?.text ? letter.text.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div className="flex flex-col w-full pb-16">
      {/* Top Header & Kicker */}
      <div className="flex items-center justify-between pb-space-sm">
        <span className="font-kicker text-kicker uppercase text-on-surface-variant tracking-[0.16em]">
          05 / LETTER
        </span>
        <span className="font-label-md text-label-md text-on-surface-variant flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 bg-secondary"></span>
          PROJECTION TESTIMONY
        </span>
      </div>

      {/* Editorial Headline */}
      <div className="pt-space-xs pb-space-md">
        <h1 className="font-['Fraunces'] text-[36px] leading-[40px] tracking-tight font-normal text-on-surface">
          Future You.
        </h1>
        <p className="font-['Fraunces'] italic text-body-lg text-on-surface-variant pt-space-xs">
          Once a month, I'll write to you as the person you're becoming.
        </p>
      </div>

      {/* Inline Marigold Error */}
      {letterError && (
        <div
          className="bg-surface-container-high p-space-sm mb-space-md text-error flex items-center gap-2"
          style={{ borderLeft: '3px solid #994700', border: '1px solid #cac6bd' }}
        >
          <span className="font-tabular-sm text-tabular-sm">{letterError}</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-space-md">
        <button
          type="button"
          disabled={isLetterLoading}
          onClick={handleGenerateLetter}
          className="bg-primary text-surface px-space-md py-3 font-label-md text-label-md uppercase tracking-wider hover:bg-on-surface-variant transition-colors disabled:opacity-50 cursor-pointer self-start sm:self-auto"
          style={{ borderRadius: 0 }}
        >
          <span>{isLetterLoading ? 'Writing letter...' : letter ? 'Write another' : 'Write my letter'}</span>
        </button>

        {letter && (
          <div className="flex items-center gap-2 font-tabular-sm text-on-surface-variant">
            <span>{wordCount} words</span>
            <span>·</span>
            <span>{letter.source === 'gemini' ? 'Gemini 2.5 Flash' : 'Offline letter. The writer was unavailable.'}</span>
          </div>
        )}
      </div>

      {/* Parchment Ruled Letter Folio */}
      <div
        className="bg-surface-container-lowest p-space-md md:p-10 border border-outline-variant relative flex flex-col gap-6"
        style={{
          boxShadow: 'inset 0 0 0 1px #cac6bd',
          borderRadius: 0
        }}
      >
        {/* Folio Header */}
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
          <span className="font-kicker text-kicker uppercase tracking-widest text-secondary">
            // DISPATCH FROM THE ARRIVAL DATE
          </span>
          <span className="font-tabular-sm text-tabular-sm text-on-surface-variant">
            {letter?.generatedAt ? new Date(letter.generatedAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : 'UNWRITTEN'}
          </span>
        </div>

        {/* The Letter Body */}
        {letter?.text ? (
          <div className="space-y-4 max-w-2xl py-2">
            <div className="font-['Fraunces'] italic text-body-md text-on-surface-variant">
              Dear me,
            </div>
            <p className="font-body-lg text-[22px] leading-[36px] text-on-surface font-normal">
              {letterSentences.map((sentence, idx) => {
                const isCurrent = isSpeakingLetter && activeSentenceIndex === idx;
                return (
                  <span
                    key={idx}
                    className={`transition-colors duration-200 ${
                      isCurrent
                        ? 'underline decoration-[#994700] decoration-2 underline-offset-4 text-primary font-medium'
                        : ''
                    }`}
                  >
                    {sentence}{' '}
                  </span>
                );
              })}
            </p>
            <div className="font-['Fraunces'] italic text-body-md text-on-surface-variant pt-2">
              — You, {projection?.goalDateContinue || projection?.goalDatePlan || 'Future Self'}
            </div>
          </div>
        ) : (
          <div className="py-16 text-center flex flex-col items-center justify-center gap-2">
            <p className="font-body-md text-on-surface-variant italic max-w-md">
              The parchment is quiet. Click "Write my letter" to hear how your current savings rate and category leaks echo into your arrival date.
            </p>
          </div>
        )}

        {/* Read Aloud Control Strip Under Letter */}
        {letter?.text && (
          <div className="pt-4 border-t border-outline-variant/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {ttsSupported ? (
              <div className="flex items-center gap-3">
                {!isSpeakingLetter ? (
                  <button
                    type="button"
                    onClick={handleHearLetter}
                    className="font-label-md text-label-md uppercase tracking-wider text-primary underline underline-offset-4 decoration-primary hover:text-secondary cursor-pointer"
                  >
                    Hear it from me
                  </button>
                ) : (
                  <div className="flex items-center gap-3 font-label-md text-label-md uppercase tracking-wider">
                    <span className="text-secondary">Speaking…</span>
                    <span>·</span>
                    {!isPausedLetter ? (
                      <button
                        type="button"
                        onClick={handlePauseSpeech}
                        className="underline underline-offset-4 decoration-primary text-primary hover:text-secondary cursor-pointer"
                      >
                        Pause
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResumeSpeech}
                        className="underline underline-offset-4 decoration-primary text-primary hover:text-secondary cursor-pointer"
                      >
                        Resume
                      </button>
                    )}
                    <span>·</span>
                    <button
                      type="button"
                      onClick={handleStopSpeech}
                      className="underline underline-offset-4 decoration-primary text-primary hover:text-secondary cursor-pointer"
                    >
                      Stop
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <span className="font-body-sm text-body-sm text-on-surface-variant italic">
                Your browser can't speak. The letter is still yours to read.
              </span>
            )}

            <span className="font-tabular-sm text-tabular-sm text-on-surface-variant">
              Your transactions never leave your device.
            </span>
          </div>
        )}
      </div>

      {/* Ask Future You Section */}
      <div
        className="mt-space-lg bg-surface-container-low p-space-md md:p-8 border border-outline-variant flex flex-col gap-5"
        style={{ borderRadius: 0 }}
      >
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
          <span className="font-kicker text-kicker uppercase tracking-widest text-on-surface">
            // ASK FUTURE YOU
          </span>
          <span className="font-tabular-sm text-tabular-sm text-on-surface-variant">
            VOICE &amp; DIALOGUE
          </span>
        </div>

        {/* Suggestion Links */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-kicker text-kicker uppercase text-on-surface-variant">Suggested:</span>
          <button
            type="button"
            disabled={isAsking}
            onClick={() => submitQuestion('Will I make it?')}
            className="font-body-sm text-body-sm text-primary underline underline-offset-4 decoration-primary hover:text-secondary cursor-pointer"
          >
            "Will I make it?"
          </button>
          <button
            type="button"
            disabled={isAsking}
            onClick={() => submitQuestion('What should I cut first?')}
            className="font-body-sm text-body-sm text-primary underline underline-offset-4 decoration-primary hover:text-secondary cursor-pointer"
          >
            "What should I cut first?"
          </button>
          <button
            type="button"
            disabled={isAsking}
            onClick={() => submitQuestion('What if rent goes up ₹3,000?')}
            className="font-body-sm text-body-sm text-primary underline underline-offset-4 decoration-primary hover:text-secondary cursor-pointer"
          >
            "What if rent goes up ₹3,000?"
          </button>
        </div>

        {/* Voice and Text Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitQuestion(questionInput, false);
          }}
          className="flex items-center gap-3 pt-1"
        >
          {sttSupported && (
            <button
              type="button"
              disabled={isAsking}
              onClick={handleMicClick}
              className={`px-3 py-2 border font-label-md text-label-md uppercase tracking-wider transition-colors cursor-pointer shrink-0 ${
                sttState === 'listening'
                  ? 'bg-secondary text-surface border-secondary animate-pulse'
                  : 'bg-surface-container-lowest text-primary border-primary hover:bg-surface-container'
              }`}
              style={{ borderRadius: 0 }}
            >
              {sttState === 'listening' ? 'Listening… ▍' : 'Speak'}
            </button>
          )}

          <div className="relative flex-1">
            <input
              type="text"
              value={questionInput}
              disabled={isAsking || sttState === 'listening'}
              onChange={(e) => setQuestionInput(e.target.value)}
              placeholder={sttState === 'listening' ? 'Speak now, listening to you…' : 'Ask Future You a question about your plan...'}
              className="w-full bg-transparent border-b border-primary py-2 px-1 font-body-md text-on-surface placeholder-on-surface-variant/50 focus:outline-none focus:border-b-2"
            />
          </div>

          <button
            type="submit"
            disabled={isAsking || !questionInput.trim()}
            className="px-4 py-2 bg-primary text-surface font-label-md text-label-md uppercase tracking-wider hover:bg-on-surface-variant transition-colors disabled:opacity-40 cursor-pointer shrink-0"
            style={{ borderRadius: 0 }}
          >
            {isAsking ? 'Thinking…' : 'Send'}
          </button>
        </form>

        {askError && (
          <div className="p-space-xs text-error font-tabular-sm text-tabular-sm">
            {askError}
          </div>
        )}

        {/* Conversation Dialogue Display (Max 3 turns) */}
        {conversation.length > 0 && (
          <div className="mt-space-sm space-y-4 border-t border-outline-variant/60 pt-4">
            {conversation.map((turn, idx) => (
              <div key={idx} className="flex flex-col gap-1.5 pb-3 border-b border-outline-variant/30 last:border-b-0">
                <div className="font-tabular-sm font-mono text-[13px] text-on-surface-variant">
                  &gt; You: "{turn.q}"
                </div>
                <div className="flex items-start justify-between gap-4">
                  <p className="font-['Fraunces'] italic text-[18px] leading-[28px] text-on-surface">
                    {turn.a}
                  </p>
                  {ttsSupported && (
                    <button
                      type="button"
                      onClick={() => handleSpeakAnswer(turn.a)}
                      className="font-label-md text-[11px] uppercase tracking-wider text-secondary underline underline-offset-4 decoration-secondary shrink-0 pt-1 cursor-pointer"
                    >
                      Hear it
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
