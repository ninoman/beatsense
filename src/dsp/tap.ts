// Tap tempo: BPM from a least-squares fit of tap times against tap index,
// which is less sensitive to a single sloppy tap than averaging intervals.

export const TAP_RESET_MS = 2000;
const MAX_TAPS = 12;

export class TapTempo {
  private taps: number[] = [];

  tap(now: number): number | null {
    const last = this.taps[this.taps.length - 1];
    if (last !== undefined && now - last > TAP_RESET_MS) this.taps = [];
    this.taps.push(now);
    if (this.taps.length > MAX_TAPS) this.taps.shift();
    return this.bpm();
  }

  reset(): void {
    this.taps = [];
  }

  get count(): number {
    return this.taps.length;
  }

  bpm(): number | null {
    const n = this.taps.length;
    if (n < 2) return null;
    const meanI = (n - 1) / 2;
    let meanT = 0;
    for (const t of this.taps) meanT += t;
    meanT /= n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - meanI) * (this.taps[i] - meanT);
      den += (i - meanI) ** 2;
    }
    const msPerBeat = num / den;
    return msPerBeat > 0 ? 60000 / msPerBeat : null;
  }
}
