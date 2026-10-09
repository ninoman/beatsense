// AudioWorklet: runs OnsetDetector on the audio thread and posts batches of frames.
import { OnsetDetector } from "./onset";

// Minimal typings for the AudioWorkletGlobalScope (not part of lib.dom).
declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

const BATCH = 8;

class OnsetProcessor extends AudioWorkletProcessor {
  private onsets = new Float32Array(BATCH);
  private rms = new Float32Array(BATCH);
  private n = 0;
  private detector = new OnsetDetector(sampleRate, ({ onset, rms }) => {
    this.onsets[this.n] = onset;
    this.rms[this.n] = rms;
    if (++this.n === BATCH) {
      this.port.postMessage({ onsets: this.onsets.slice(), rms: this.rms.slice() });
      this.n = 0;
    }
  });

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (channel) this.detector.process(channel);
    return true;
  }
}

registerProcessor("onset-processor", OnsetProcessor);
