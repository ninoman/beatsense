// Turns a stream of per-tick tempo estimates into a stable displayed BPM.
import { median } from "./tempo";

/** Recent estimates considered. */
const WINDOW = 8;
/** Estimates within this relative distance of each other count as agreeing. */
const TOLERANCE = 0.02;
/** Agreeing estimates needed before showing a (new) BPM. */
const MIN_AGREE = 3;
/** Below this many supporting estimates the shown BPM is considered stale and dropped. */
const MIN_SUPPORT = 2;

export class TempoTracker {
  private estimates: number[] = [];
  private current: number | null = null;

  get bpm(): number | null {
    return this.current;
  }

  /** Share of recent estimates agreeing with the shown BPM, 0..1. */
  get confidence(): number {
    return this.current === null ? 0 : this.cluster(this.current).length / WINDOW;
  }

  push(bpm: number): void {
    this.estimates.push(bpm);
    if (this.estimates.length > WINDOW) this.estimates.shift();
    this.update();
  }

  clear(): void {
    this.estimates = [];
    this.current = null;
  }

  private cluster(around: number): number[] {
    return this.estimates.filter((b) => Math.abs(b - around) / around <= TOLERANCE);
  }

  private update(): void {
    // Largest group of mutually close estimates; ties go to the most recent.
    let best: number[] = [];
    for (const e of this.estimates) {
      const c = this.cluster(e);
      if (c.length >= best.length) best = c;
    }
    const shownSupport = this.current === null ? [] : this.cluster(this.current);

    // Hysteresis: switch only when a different tempo has strictly more support.
    if (best.length >= MIN_AGREE && best.length > shownSupport.length) this.current = median(best);
    else if (shownSupport.length >= MIN_SUPPORT) this.current = median(shownSupport);
    else this.current = null;
  }
}
