/**
 * @file lib/voice.js
 * Browser Text-to-Speech (TTS) using window.speechSynthesis.
 * Sentence-by-sentence playback with Chrome keep-alive and Indian English voice selection.
 */

let activeUtterance = null;
let currentSentenceIndex = -1;
let sentencesList = [];
let onSentenceCallback = null;
let onEndCallback = null;
let keepAliveTimer = null;
let isPausedState = false;

/**
 * Check if browser supports Web Speech Synthesis.
 * @returns {boolean}
 */
export function isSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/**
 * Split text into natural sentences for sequential playback and sentence-level tracking.
 * Preserves decimals (e.g. ₹1,499.00 or 2.5%) and abbreviations (e.g. Rs.500).
 * @param {string} text
 * @returns {string[]}
 */
export function splitSentences(text) {
  if (!text || typeof text !== 'string') return [];
  const cleaned = text.trim();
  if (!cleaned) return [];

  // Split on punctuation (.!? or newline) followed by space, avoiding decimals and titles
  const parts = cleaned.split(/(?<!\b(?:Rs|No|Mr|Mrs|Dr))(?<=[.!?\n])\s+/);
  return parts.map(s => s.trim()).filter(Boolean);
}

/**
 * Find the most suitable voice:
 * 1. lang "en-IN"
 * 2. lang "en-GB"
 * 3. any English lang
 * Prioritize names: "Neerja", "Heera", "Google UK English", "Samantha"
 * @returns {SpeechSynthesisVoice | null}
 */
function pickBestVoice() {
  if (!isSupported()) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length === 0) return null;

  const preferredNames = ['neerja', 'heera', 'google uk english', 'samantha'];

  // 1. Check en-IN
  const enInVoices = voices.filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('en-in'));
  for (const name of preferredNames) {
    const match = enInVoices.find(v => v.name.toLowerCase().includes(name));
    if (match) return match;
  }
  if (enInVoices.length > 0) return enInVoices[0];

  // 2. Check en-GB
  const enGbVoices = voices.filter(v => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith('en-gb'));
  for (const name of preferredNames) {
    const match = enGbVoices.find(v => v.name.toLowerCase().includes(name));
    if (match) return match;
  }
  if (enGbVoices.length > 0) return enGbVoices[0];

  // 3. Any English
  const englishVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('en'));
  for (const name of preferredNames) {
    const match = englishVoices.find(v => v.name.toLowerCase().includes(name));
    if (match) return match;
  }
  if (englishVoices.length > 0) return englishVoices[0];

  return voices[0] || null;
}

/**
 * Clear keep-alive timer.
 */
function clearKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

/**
 * Chrome keep-alive: Chrome pauses speech synthesis after ~15s on long texts.
 */
function startKeepAlive() {
  clearKeepAlive();
  keepAliveTimer = setInterval(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis?.speaking && !isPausedState) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    }
  }, 5000);
}

/**
 * Internal recursive sentence speaker.
 */
function speakNextSentence() {
  if (!isSupported() || sentencesList.length === 0) return;

  currentSentenceIndex++;
  if (currentSentenceIndex >= sentencesList.length) {
    const finishCb = onEndCallback;
    stop();
    if (typeof finishCb === 'function') {
      finishCb();
    }
    return;
  }

  const textToSpeak = sentencesList[currentSentenceIndex];
  if (typeof onSentenceCallback === 'function') {
    onSentenceCallback(currentSentenceIndex);
  }

  const utterance = new window.SpeechSynthesisUtterance(textToSpeak);
  activeUtterance = utterance;

  const voice = pickBestVoice();
  if (voice) {
    utterance.voice = voice;
  }
  utterance.lang = voice?.lang || 'en-IN';
  utterance.rate = 0.92;
  utterance.pitch = 0.9;

  utterance.onend = () => {
    if (activeUtterance !== utterance) return;
    if (!isPausedState && sentencesList.length > 0) {
      speakNextSentence();
    }
  };

  utterance.onerror = (e) => {
    if (activeUtterance !== utterance) return;
    if (e.error === 'canceled' || e.error === 'interrupted') return;
    const finishCb = onEndCallback;
    stop();
    if (typeof finishCb === 'function') {
      finishCb();
    }
  };

  window.speechSynthesis.speak(utterance);
}

/**
 * Speak text sequentially by sentence.
 * @param {string} text
 * @param {Object} [options]
 * @param {function(number): void} [options.onSentence]
 * @param {function(): void} [options.onEnd]
 */
export function speak(text, { onSentence, onEnd } = {}) {
  if (!isSupported() || !text) return;

  // Stop any previous speech
  stop();

  sentencesList = splitSentences(text);
  if (sentencesList.length === 0) return;

  currentSentenceIndex = -1;
  onSentenceCallback = onSentence || null;
  onEndCallback = onEnd || null;
  isPausedState = false;

  startKeepAlive();

  // If voices aren't loaded yet, wait for voiceschanged
  if (window.speechSynthesis.getVoices().length === 0) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      speakNextSentence();
    };
  } else {
    speakNextSentence();
  }
}

/**
 * Pause speaking.
 */
export function pause() {
  if (!isSupported()) return;
  isPausedState = true;
  window.speechSynthesis.pause();
}

/**
 * Resume speaking.
 */
export function resume() {
  if (!isSupported()) return;
  isPausedState = false;
  window.speechSynthesis.resume();
}

/**
 * Stop speaking immediately and reset state.
 */
export function stop() {
  clearKeepAlive();
  isPausedState = false;
  currentSentenceIndex = -1;
  activeUtterance = null;
  sentencesList = [];
  onSentenceCallback = null;
  if (isSupported()) {
    window.speechSynthesis.cancel();
  }
}
