// Turns raw audio samples into an onset-strength envelope: one value per hop.
// Pure and allocation-free per sample so it can run inside an AudioWorklet.

export const HOP_SIZE = 256;

/** Second-order low-pass (RBJ cookbook) used to isolate kick/bass energy. */
class LowPass {
  private b0: number;
  private b1: number;
  private b2: number;
  private a1: number;
  private a2: number;
  private x1 = 0;
  private x2 = 0;
  private y1 = 0;
  private y2 = 0;

  constructor(sampleRate: number, cutoff: number, q = Math.SQRT1_2) {
    const w0 = (2 * Math.PI * cutoff) / sampleRate;
    const alpha = Math.sin(w0) / (2 * q);
    const cos = Math.cos(w0);
    const a0 = 1 + alpha;
    this.b0 = (1 - cos) / 2 / a0;
    this.b1 = (1 - cos) / a0;
    this.b2 = this.b0;
    this.a1 = (-2 * cos) / a0;
    this.a2 = (1 - alpha) / a0;
  }

  process(x: number): number {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

export type OnsetFrame = { onset: number; rms: number };

export class OnsetDetector {
  private low: LowPass;
  private count = 0;
  private lowSum = 0;
  private fullSum = 0;
  private prevLow = 0;
  private prevFull = 0;
  private onFrame: (frame: OnsetFrame) => void;

  constructor(sampleRate: number, onFrame: (frame: OnsetFrame) => void) {
    this.low = new LowPass(sampleRate, 150);
    this.onFrame = onFrame;
  }

  process(samples: Float32Array): void {
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i];
      const l = this.low.process(x);
      this.fullSum += x * x;
      this.lowSum += l * l;
      if (++this.count === HOP_SIZE) this.emit();
    }
  }

  private emit(): void {
    const fullE = this.fullSum / HOP_SIZE;
    const lowE = this.lowSum / HOP_SIZE;
    // Log compression makes the detector respond to relative, not absolute, loudness changes.
    const full = Math.log1p(1000 * fullE);
    const low = Math.log1p(1000 * lowE);
    const onset = Math.max(0, full - this.prevFull) + Math.max(0, low - this.prevLow);
    this.prevFull = full;
    this.prevLow = low;
    this.onFrame({ onset, rms: Math.sqrt(fullE) });
    this.count = 0;
    this.fullSum = 0;
    this.lowSum = 0;
  }
}
