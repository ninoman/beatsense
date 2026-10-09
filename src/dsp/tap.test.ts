import { describe, expect, it } from "vitest";
import { TapTempo } from "./tap";

describe("TapTempo", () => {
  it("needs two taps", () => {
    const t = new TapTempo();
    expect(t.tap(0)).toBeNull();
    expect(t.tap(500)).toBeCloseTo(120);
  });

  it("is accurate with human jitter", () => {
    const t = new TapTempo();
    const jitter = [12, -8, 20, -15, 5, -20, 10, 0, -5, 18];
    let bpm: number | null = null;
    jitter.forEach((j, i) => (bpm = t.tap(i * 468.75 + j))); // 128 BPM
    expect(bpm!).toBeGreaterThan(126);
    expect(bpm!).toBeLessThan(130);
  });

  it("resets after a long pause", () => {
    const t = new TapTempo();
    t.tap(0);
    t.tap(500);
    t.tap(5000);
    expect(t.count).toBe(1);
    expect(t.tap(5400)).toBeCloseTo(150);
  });
});
