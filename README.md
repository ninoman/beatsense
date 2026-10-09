# BeatSense

Tap-tempo and microphone BPM detector. React + Vite PWA, no backend.

```bash
npm install
npm run dev     # http://localhost:5173 (mic works on localhost; elsewhere needs https)
npm test        # DSP tests on synthesized drum loops
npm run build   # static site in dist/, installable + offline
```

## How it works

- **Tap** (`src/dsp/tap.ts`): least-squares fit over the last 12 taps; resets after a 2 s pause.
- **Listen** (`src/dsp/`): mic → AudioWorklet (`onset-processor.ts`) computes a two-band
  (sub-150 Hz + full) log-energy onset envelope every 256 samples → main thread autocorrelates
  the last 8 s (`tempo.ts`) every 500 ms with a 120 BPM prior and a double-tempo check → median of
  the last 6 confident estimates. ÷2 / ×2 buttons fix octave errors.

The DSP code is framework-free so it can be reused in a native wrapper later.
