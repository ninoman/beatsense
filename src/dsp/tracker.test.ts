import { describe, expect, it } from "vitest";
import { TempoTracker } from "./tracker";

function feed(t: TempoTracker, values: number[]) {
  return values.map((v) => (t.push(v), t.bpm));
}

describe("TempoTracker", () => {
  it("shows a BPM once three estimates agree", () => {
    const t = new TempoTracker();
    expect(feed(t, [100.1, 99.9, 100.2])).toEqual([null, null, expect.closeTo(100.1, 1)]);
  });

  it("switches to a new song instead of sticking to the old tempo", () => {
    const t = new TempoTracker();
    feed(t, Array(8).fill(100));
    const shown = feed(t, [160, 160.2, 159.8, 160.1, 160, 159.9]);
    expect(shown.at(-1)).toBeCloseTo(160, 0);
  });

  it("does not freeze when estimates alternate between two tempos", () => {
    const t = new TempoTracker();
    feed(t, Array(8).fill(100));
    // Median of this mix (~120) agrees with nothing; must still leave 100.
    const shown = feed(t, [160, 80, 160, 80, 160, 80, 160, 80]);
    expect([80, 160]).toContainEqual(Math.round(shown.at(-1)!));
  });

  it("is stable on an alternating stream (no flip-flopping)", () => {
    const t = new TempoTracker();
    const shown = feed(t, [160, 80, 160, 80, 160, 80, 160, 80, 160, 80, 160, 80]).filter((v) => v !== null);
    expect(new Set(shown.map(Math.round)).size).toBe(1);
  });

  it("drops a stale BPM when estimates scatter", () => {
    const t = new TempoTracker();
    feed(t, Array(8).fill(100));
    feed(t, [70, 135, 88, 151, 117, 64, 173, 95]);
    expect(t.bpm).toBeNull();
  });

  it("ignores a single stray estimate", () => {
    const t = new TempoTracker();
    feed(t, Array(6).fill(128));
    t.push(85);
    expect(t.bpm).toBeCloseTo(128);
  });
});
