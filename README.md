# AICanScanO-Plus: Guided Oral Lesion Screening

A web application that fuses a short clinical intake with an intra-oral photograph to produce an AI-assisted,
region-annotated risk screening for **OPMD** (oral potentially malignant disorders), **OSMF** (oral submucous
fibrosis), and **OSCC** (oral squamous cell carcinoma).

> **⚠️ Disclaimer:** This is a **prototype/research tool**, not a medical device. It does not provide medical
> diagnoses. Always consult a qualified healthcare professional for any oral health concerns.

---

## What's new vs. AICanScanO v1

- **Patient details first.** A short clinical intake (age, sex, tobacco/alcohol/betel quid use, lesion duration,
  anatomical site, lesion colour, ulceration, pain, previous OPMD) is shown before the photo upload, and fused
  with the image analysis instead of judging the photo in isolation.
- **Shape-aware region detection.** The model returns the actual outline of a flagged lesion when its margin is
  visible, rendered directly on the photo. A tight bounding box is used as a fallback.
- **Three-class plus normal screening.** OPMD, OSMF, OSCC, and Normal probability breakdown, plus a transparent
  "fused diagnostic probability" that blends the image-derived score with the clinical risk factors.
- **Diagnosis first, details on demand.** The headline result (risk level, class, annotated photo) shows
  immediately; the full clinical report is one click away.
- **Backend model is Anthropic Claude** (`claude-haiku-4-5`, vision-capable) using forced tool-use for reliable
  structured output, so there is no fragile JSON-from-prose parsing.
- **Consistent risk level.** The headline risk badge is derived deterministically from the diagnosis class and
  fused probability, so it can never contradict the class probabilities shown next to it.

---

## Quick Start

```bash
# 1. Install dependencies
npm install
npm run frontend:install

# 2. Configure your Anthropic API key
echo "ANTHROPIC_API_KEY=your_key_here" > .env

# 3. Build the frontend and start the server
npm run build
npm start

# 4. Open in browser
open http://localhost:3000
```

For frontend hot-reload during development: `npm run dev` (runs the Express API and the Vite dev server together).

The app works **without an API key**. It returns simulated screening results (including plausible bounding
boxes) so the UI and UX can be demoed offline.

---

## Environment Variables

| Variable            | Required | Description                                                                 |
|----------------------|----------|-------------------------------------------------------------------------------|
| `ANTHROPIC_API_KEY`  | No (mock mode if unset) | Your Anthropic API key ([console.anthropic.com](https://console.anthropic.com/settings/keys)) |
| `PORT`               | No       | Server port (defaults to `3000`)                                              |

---

## Model

**Anthropic Claude, `claude-haiku-4-5`**

- Cheapest current-generation Claude model with image understanding.
- Called with a **forced tool call** (`submit_oral_screening_result`) so the response is a validated structured
  object: clinical assessment, suspicious-region shape or bounding box, class probabilities, and triage routing.
  Not free-text JSON that has to be parsed and hoped for.

---

## Project Structure

```
aicanscano-plus/
├── server.js              # Express backend, /analyze endpoint, Claude integration, clinical fusion
├── test_claude.js         # Standalone script to smoke-test the Anthropic API key
├── package.json
├── .env                   # API key (create this yourself, not committed)
├── README.md
└── frontend/               # Vite + React + TypeScript + Tailwind
    └── src/
        ├── App.tsx
        ├── components/
        │   ├── Layout.tsx
        │   ├── DiagnosisWizard.tsx     # patient details, photo upload, diagnose
        │   ├── ClinicalIntakeForm.tsx  # Table-2-style clinical variable intake
        │   ├── ScanOverlay.tsx         # grid + shape/bounding-box region detection overlay
        │   └── ResultsReport.tsx       # diagnosis headline, probability bars, fused score, full report
        └── lib/
            └── types.ts                 # shared API contract types
```

---

## How the "fused diagnostic probability" works

The model returns image-derived class probabilities (normal, OPMD, OSMF, OSCC). The backend separately scores
the clinical intake against known risk factors (tobacco, alcohol, betel quid, ulceration, pain, lesion duration,
previous OPMD, lesion colour, age) into a 0 to 1 clinical risk score. The two are blended
(`0.65 x image score + 0.35 x clinical score`) into one **fused_ai_diagnostic_probability**, shown transparently
alongside its two components. This is a simple, explainable heuristic for demonstration purposes. It is not a
clinically validated fusion model.

---

## Limitations

- **Not clinically validated.** Model performance on real-world images may differ significantly from research
  benchmarks, and the clinical-fusion heuristic is illustrative only.
- **Mock mode by default.** Without an Anthropic API key, responses (including regions) are simulated.
- **Image quality matters.** Poor lighting, blur, or incorrect framing may affect results.
- **No data persistence.** Images and intake answers are processed in memory and not stored.

---

## License

MIT
