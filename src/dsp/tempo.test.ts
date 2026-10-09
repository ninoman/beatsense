import { describe, expect, it } from "vitest";
import { HOP_SIZE, OnsetDetector } from "./onset";
import { estimateTempo } from "./tempo";

const SR = 44100;

// Deterministic PRNG so tests are stable.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32 - 0.5;
  };
}

/** Synthesizes a drum loop: kick on beats, snare on 2 & 4, hi-hat on eighths, plus noise. */
function drumLoop(bpm: number, seconds: number, { noise = 0.01, hats = 0.1, offbeatKick = false } = {}) {
  const out = new Float32Array(Math.floor(SR * seconds));
  const rand = rng(bpm * 7919);
  const beat = (60 / bpm) * SR;
  const add = (start: number, len: number, f: (t: number) => number) => {
    for (let i = 0; i < len && start + i < out.length; i++) out[start + i] += f(i / SR);
  };
  for (let b = 0; b * beat < out.length; b++) {
    const s = Math.round(b * beat);
    add(s, SR * 0.15, (t) => 0.6 * Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 25));
    if (b % 2 === 1) add(s, SR * 0.1, (t) => 0.3 * rand() * Math.exp(-t * 30));
    if (offbeatKick && b % 4 === 3) {
      add(Math.round(s + beat / 2), SR * 0.15, (t) => 0.5 * Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 25));
    }
    if (hats) {
      for (const h of [0, 0.5]) add(Math.round(s + h * beat), SR * 0.03, (t) => hats * rand() * Math.exp(-t * 150));
    }
  }
  for (let i = 0; i < out.length; i++) out[i] += noise * rand();
  return out;
}

/** Hip-hop style bar: kicks on 1, 3 and the "and" of 3, snare on 2 & 4, 16th-note hats. */
function hipHopLoop(bpm: number, seconds: number) {
  const out = new Float32Array(Math.floor(SR * seconds));
  const rand = rng(bpm * 104729);
  const beat = (60 / bpm) * SR;
  const add = (start: number, len: number, f: (t: number) => number) => {
    for (let i = 0; i < len && start + i < out.length; i++) out[start + i] += f(i / SR);
  };
  const kick = (t: number) => 0.6 * Math.sin(2 * Math.PI * 55 * t) * Math.exp(-t * 25);
  for (let b = 0; b * beat < out.length; b++) {
    const s = Math.round(b * beat);
    if (b % 2 === 0) add(s, SR * 0.15, kick);
    if (b % 4 === 2) add(Math.round(s + beat * 0.75), SR * 0.15, kick);
    if (b % 2 === 1) add(s, SR * 0.12, (t) => 0.35 * rand() * Math.exp(-t * 25));
    for (const h of [0, 0.25, 0.5, 0.75]) {
      add(Math.round(s + h * beat), SR * 0.03, (t) => (h % 0.5 ? 0.12 : 0.25) * rand() * Math.exp(-t * 120));
    }
  }
  return out;
}

function detect(audio: Float32Array) {
  const frames: number[] = [];
  const det = new OnsetDetector(SR, (f) => frames.push(f.onset));
  for (let i = 0; i < audio.length; i += 128) det.process(audio.subarray(i, i + 128));
  const frameRate = SR / HOP_SIZE;
  return estimateTempo(frames.slice(-Math.round(frameRate * 8)), frameRate);
}

describe("estimateTempo (end to end from audio)", () => {
  for (const bpm of [72, 90, 100, 120, 128, 140, 160, 174]) {
    it(`detects ${bpm} BPM`, () => {
      const r = detect(drumLoop(bpm, 10));
      expect(r).not.toBeNull();
      expect(r!.bpm).toBeCloseTo(bpm, 0);
      expect(r!.confidence).toBeGreaterThan(0.2);
    });
  }

  it("handles syncopated kicks and heavy noise", () => {
    const r = detect(drumLoop(124, 10, { noise: 0.05, offbeatKick: true }));
    expect(r!.bpm).toBeCloseTo(124, 0);
  });

  it("does not double slow tempos with loud eighth-note hats", () => {
    for (const bpm of [72, 85, 95]) expect(detect(drumLoop(bpm, 10, { hats: 0.3 }))!.bpm).toBeCloseTo(bpm, 0);
  });

  it("does not double hip-hop grooves with 16th-note hats", () => {
    for (const bpm of [85, 92, 100]) {
      const audio = hipHopLoop(bpm, 20);
      // Check several window positions, as the live detector does every 500 ms.
      for (let end = 10; end <= 20; end += 0.5) {
        const r = detect(audio.subarray(0, Math.round(end * SR)));
        expect(r!.bpm, `${bpm} BPM at ${end}s`).toBeCloseTo(bpm, 0);
      }
    }
  });

  it("returns low confidence for pure noise", () => {
    const rand = rng(1);
    const audio = Float32Array.from({ length: SR * 10 }, () => 0.05 * rand());
    const r = detect(audio);
    expect(r === null || r.confidence < 0.2).toBe(true);
  });

  it("returns null for silence or too-short input", () => {
    expect(detect(new Float32Array(SR * 10))).toBeNull();
    expect(estimateTempo([1, 0, 1], 100)).toBeNull();
  });
});
