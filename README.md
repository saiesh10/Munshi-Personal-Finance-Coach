# Munshi — Personal Finance Coach for India

> *The accountant who remembers you.*

A zero-cost, private personal finance coach designed for Indian households. Built on the timeless discipline of the mercantile *bahi-khata*, Munshi parses messy Indian bank SMS messages and statements, categorizes expenditures, audits recurring subscriptions ("quiet leaks"), runs deterministic multi-month goal projections, and delivers a voice-enabled dispatch from your future self.

---

## 5-Screen Ledger Architecture

```
01 Paste  ──►  02 Ledger  ──►  03 Quiet leaks  ──►  04 Plan  ──►  05 Letter
(Intake)       (Journal)       (Subscriptions)     (Course)       (Voice & Letter)
```

1. **01 Paste**: Paste raw SMS alerts or upload bank CSV statements. Cleans and extracts transactions using deterministic regex and offline PapaParse.
2. **02 Ledger**: The core *bahi-khata* table. Changing any category creates a rule that retroactively updates matching historical rows and persists across future statements.
3. **03 Quiet leaks**: Exposes forgotten subscriptions, price hikes, and unutilized membership companions (Swiggy One, Zomato Gold, Amazon Prime, Uber One). One-click to test skipping in your plan.
4. **04 Plan**: Deterministic multi-month cash flow simulation. Drag category cut sliders (-50% to +50%) or test rent adjustments to see your goal arrival date move in real time. Mid-month pacing drift nudges alert you if spend is outpacing targets.
5. **05 Letter (Future You Voice)**: An authentic first-person letter written from the date you reach your goal. Includes voice read-aloud and conversational voice Q&A ("Ask Future You").

---

## "Future You" Voice System

- **Read Aloud**: Browser-native Web Speech Synthesis (`window.speechSynthesis`).
  - Automatically selects authentic Indian English voices (`en-IN`), falling back to `en-GB` or natural English.
  - Sentence-by-sentence utterance queuing with keep-alive pulse to prevent Chrome's 15-second cut-off bug.
  - Live sentence underline tracking in Marigold (`#994700`).
  - Text controls: `Hear it from me`, `Pause`, `Resume`, `Stop`.
  - Zero API cost, runs 100% locally on the device.
- **Ask Future You (Voice & Text Q&A)**:
  - Speech Recognition (`webkitSpeechRecognition` / `SpeechRecognition`) with `lang="en-IN"`.
  - Suggested instant queries:
    - *"Will I make it?"*
    - *"What should I cut first?"*
    - *"What if rent goes up ₹3,000?"*
  - Pre-computed deterministic simulation answers: Immediate answers even without an AI key or network connection.
  - Answers are automatically spoken aloud if asked via microphone.

---

## Privacy & Security Guarantees

- **Stateless Backend**: Backend Route Handlers (`app/api/*`) are purely stateless. They do not maintain a database or external cache.
- **Client-Side Ownership**: Transaction histories remain stored in the user's browser `localStorage`.
- **Zero Raw Data to LLMs**: Neither full SMS messages, card numbers, nor transaction lists are ever sent to Gemini. Only minimal aggregated numbers (e.g. goal target, monthly net, category averages) are sent for letter phrasing.

---

## Local Development

### 1. Requirements
- Node.js 18+ (tested on Node 20 and Node 24)
- npm 9+

### 2. Setup
1. Clone or navigate to the workspace:
   ```bash
   cd Munshi-Personal-Finance-Coach
   ```
2. Copy the environment configuration:
   ```bash
   cp .env.example .env.local
   ```
3. *(Optional)* Add a free Gemini API key from [Google AI Studio](https://aistudio.google.com/) (no credit card required).
   > **Note on Model**: The default recommended model is `gemini-2.5-flash`.
4. Install dependencies:
   ```bash
   npm install
   ```
5. Run the development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in Chrome or Edge.

---

## Testing

### Unit Test Suite (`node:test`)
Run all 22 unit tests across the 7 modules:
```bash
npm test
```

### Live Smoke Tests
To test all 8 API endpoints against the running server:
```bash
# In one terminal:
npm run dev

# In another terminal:
npm run smoke
```

---

## Manual Chrome Testing Checklist

1. **Read Aloud (Text-to-Speech)**:
   - Navigate to `05 Letter` and click "Write my letter".
   - Click "Hear it from me".
   - Verify that sentences highlight sequentially with a marigold underline as spoken.
   - Click "Pause", verify playback halts, click "Resume", then "Stop".
2. **Mic Question (Speech-to-Text)**:
   - In Chrome or Edge, click "Speak". Allow microphone permissions when prompted.
   - Say: *"Will I make it?"*
   - Verify the state switches to "Listening…", transcripts appear in the input, and the answer is returned and spoken aloud automatically.
3. **Typed Question & Suggestions**:
   - Click the link *"What if rent goes up ₹3,000?"*.
   - Verify the simulated answer shows the exact rupee impact on monthly net and projected goal delay.
   - Click "Hear it" next to the answer to hear it on demand.
4. **Unsupported Browser Fallback**:
   - In Firefox or with speech disabled, verify "Speak" is cleanly hidden, typed input remains fully functional, and a message explains browser speech status without breaking layout.
