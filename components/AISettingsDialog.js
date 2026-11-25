'use client';

import React, { useState, useEffect } from 'react';
import { Sparkles, Key, CheckCircle2, ShieldCheck, ExternalLink, X, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import Card from './ui/Card';
import Button from './ui/Button';

export default function AISettingsDialog({ isOpen, onClose }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('munshi_gemini_api_key') || '';
        if (stored) {
          setApiKey(stored);
          setHasStoredKey(true);
        } else {
          setHasStoredKey(false);
        }
      } catch {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      handleClear();
      return;
    }

    try {
      localStorage.setItem('munshi_gemini_api_key', trimmed);
      setHasStoredKey(true);
      toast.success('Gemini API key saved! AI features are now active.');
      if (onClose) onClose();
    } catch {
      toast.error('Could not save key to browser storage.');
    }
  };

  const handleClear = () => {
    try {
      localStorage.removeItem('munshi_gemini_api_key');
      setApiKey('');
      setHasStoredKey(false);
      toast('Switched to Munshi offline intelligence engine.');
      if (onClose) onClose();
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-surface border border-border rounded-card shadow-lift p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-control bg-primary-tint text-primary flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 stroke-[2]" />
            </div>
            <div>
              <h3 className="font-semibold text-[17px] text-ink leading-tight">
                AI Engine Settings
              </h3>
              <p className="text-[12px] text-muted mt-0.5">
                Connect Google Gemini or run with zero-cost offline intelligence
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-muted hover:text-ink hover:bg-canvas rounded-control transition-colors cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Engine Status Banner */}
        <div className={`p-3 rounded-control border flex items-center justify-between text-[13px] ${
          hasStoredKey
            ? 'bg-primary-tint/50 border-primary/30 text-primary'
            : 'bg-canvas border-border text-ink'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${hasStoredKey ? 'bg-success animate-pulse' : 'bg-muted'}`} />
            <span className="font-medium">
              {hasStoredKey ? 'Gemini AI Active' : 'Offline Math Engine Active'}
            </span>
          </div>
          <span className="text-[11px] text-muted">
            {hasStoredKey ? 'Generative Reasoning' : '100% Private & Free'}
          </span>
        </div>

        {/* Input Field */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[13px] font-medium text-ink flex items-center justify-between">
            <span>Google Gemini API Key</span>
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] text-primary hover:underline flex items-center gap-1 font-normal"
            >
              <span>Get free key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </label>

          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full bg-canvas border border-border rounded-control h-10 pl-3.5 pr-10 text-[13px] text-ink font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-muted hover:text-ink cursor-pointer"
              aria-label={showKey ? 'Hide key' : 'Show key'}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <p className="text-[11px] text-muted leading-relaxed">
            Your key stays securely in your browser and is only sent to Google to generate "Future You" answers. Raw transaction statements are never stored on external databases.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          {hasStoredKey ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClear}
              className="text-danger border-danger/30 hover:bg-danger-tint"
            >
              Remove key
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
            >
              Save settings
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
