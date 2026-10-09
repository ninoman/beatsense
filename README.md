# BeatSense

Tap-tempo and microphone BPM detector with song identification. React + Vite PWA, plus two
Vercel Functions in `api/` that keep the AudD and Discogs tokens server-side.

```bash
npm install
npm run dev     # http://localhost:5173 (mic works on localhost; elsewhere needs https)
npm run dev:full  # vercel dev: app + api/ (needs .env, see .env.example)
npm test        # DSP tests on synthesized drum loops
npm run build   # static site in dist/, installable + offline
```

## How it works

- **Tap** (`src/dsp/tap.ts`): least-squares fit over the last 12 taps; resets after a 2 s pause.
- **Listen** (`src/dsp/`): mic → AudioWorklet (`onset-processor.ts`) computes a two-band
  (sub-150 Hz + full) log-energy onset envelope every 256 samples → main thread autocorrelates
  the last 8 s (`tempo.ts`) every 500 ms with a 120 BPM prior and a double-tempo check → median of
  the last 6 confident estimates. ÷2 / ×2 buttons fix octave errors.
- **Identify song** (`src/identify/`): while listening, `MicTempoDetector.recordClip` records 5 s and
  10 s clips from the same mic stream (in parallel, so tempo tracking keeps running) → `api/identify`
  (AudD). On a match, `api/discogs` looks up genres, styles, year, label and country (the earliest
  Discogs release whose tracklist has the title). Recognizers implement `Recognizer`, so a native
  wrapper can plug in ShazamKit instead of AudD.

The DSP code is framework-free so it can be reused in a native wrapper later.
