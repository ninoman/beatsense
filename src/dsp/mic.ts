// Microphone -> AudioWorklet onset envelope -> rolling tempo estimate.
import processorUrl from "./onset-processor.ts?worker&url";
import { HOP_SIZE } from "./onset";
import { estimateTempo, type TempoDetails } from "./tempo";
import { TempoTracker } from "./tracker";

const WINDOW_SECONDS = 8;
const MIN_SECONDS = 5;
const ESTIMATE_EVERY_MS = 500;
/** Raw autocorrelation strength below which a tick is ignored (busy real music sits ~0.15-0.35). */
const MIN_CONFIDENCE = 0.1;
const SILENCE_RMS = 0.003;
const MAX_RECORDING_SECONDS = 180;
const DEBUG_TICKS = 40;
/** Clip formats for song recognition, in order of preference (Chrome/Firefox: webm, Safari: mp4). */
const CLIP_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

export type DebugTick = {
  /** Seconds since start. */
  t: number;
  bpm: number | null;
  confidence: number;
  /** BPM picked before the double-tempo check. */
  scoredBpm: number | null;
  doubled: boolean;
  accepted: boolean;
  /** Smoothed BPM shown to the user after this tick. */
  shown: number | null;
  level: number;
};

export type MicDebug = {
  frameRate: number;
  /** Onset envelope of the current analysis window. */
  env: Float32Array;
  details: TempoDetails | null;
  ticks: DebugTick[];
};

export type MicUpdate = {
  /** Smoothed BPM, or null while not confident yet. */
  bpm: number | null;
  /** Share of recent estimates agreeing with the shown BPM, 0..1. */
  confidence: number;
  /** Input level 0..1 for a meter. */
  level: number;
  /** Buffer fill 0..1 until the first estimate is possible. */
  progress: number;
  debug?: MicDebug;
};

export class MicError extends Error {}

export class MicTempoDetector {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private timer = 0;
  private env = new Float32Array(0);
  private write = 0;
  private filled = 0;
  private frameRate = 0;
  private level = 0;
  private tracker = new TempoTracker();
  private onUpdate: (u: MicUpdate) => void;
  private debug: boolean;
  private recording: number[] = [];
  private ticks: DebugTick[] = [];
  private startedAt = 0;
  private recorders = new Set<MediaRecorder>();

  constructor(onUpdate: (u: MicUpdate) => void, { debug = false } = {}) {
    this.onUpdate = onUpdate;
    this.debug = debug;
  }

  /** Full onset recording + tick log as JSON, for offline replay (debug mode only). */
  exportRecording(): string {
    return JSON.stringify({
      frameRate: this.frameRate,
      hopSize: HOP_SIZE,
      sampleRate: this.frameRate * HOP_SIZE,
      onsets: this.recording.map((v) => Math.round(v * 1e5) / 1e5),
      ticks: this.ticks,
    });
  }

  async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new MicError("Microphone access needs a secure (https) connection.");
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        // Voice processing distorts music: keep the raw signal.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      if (name === "NotAllowedError") throw new MicError("Microphone permission was denied.");
      if (name === "NotFoundError") throw new MicError("No microphone found.");
      throw new MicError("Could not access the microphone.");
    }

    const ctx = new AudioContext();
    this.ctx = ctx;
    await ctx.audioWorklet.addModule(processorUrl);
    await ctx.resume();

    this.frameRate = ctx.sampleRate / HOP_SIZE;
    this.env = new Float32Array(Math.round(this.frameRate * WINDOW_SECONDS));
    this.write = 0;
    this.filled = 0;
    this.tracker.clear();
    this.recording = [];
    this.ticks = [];
    this.startedAt = performance.now();

    const source = ctx.createMediaStreamSource(this.stream);
    const node = new AudioWorkletNode(ctx, "onset-processor", { numberOfOutputs: 1 });
    node.port.onmessage = (e: MessageEvent<{ onsets: Float32Array; rms: Float32Array }>) => this.push(e.data);
    // Some browsers only pull nodes that reach the destination; route through silence.
    const mute = ctx.createGain();
    mute.gain.value = 0;
    source.connect(node).connect(mute).connect(ctx.destination);

    this.timer = window.setInterval(() => this.estimate(), ESTIMATE_EVERY_MS);
  }

  /**
   * Record `seconds` of the live mic stream (e.g. for song recognition) without interrupting tempo
   * tracking. Several clips may record at once. Rejects if the mic stops or `signal` aborts first.
   */
  recordClip(seconds: number, signal?: AbortSignal): Promise<Blob> {
    const stream = this.stream;
    if (!stream) return Promise.reject(new MicError("Start listening first."));
    if (signal?.aborted) return Promise.reject(new DOMException("Recording aborted.", "AbortError"));
    if (typeof MediaRecorder === "undefined") {
      return Promise.reject(new MicError("Recording isn't supported in this browser."));
    }
    const mimeType = CLIP_TYPES.find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 128_000 });
    this.recorders.add(rec);

    return new Promise((resolve, reject) => {
      const chunks: Blob[] = [];
      let failed: Error | null = null;
      const finish = () => rec.state !== "inactive" && rec.stop();
      const timer = window.setTimeout(finish, seconds * 1000);
      const onAbort = () => {
        failed = new DOMException("Recording aborted.", "AbortError");
        finish();
      };
      signal?.addEventListener("abort", onAbort, { once: true });

      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onerror = () => {
        failed = new MicError("Recording failed.");
      };
      rec.onstop = () => {
        window.clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
        this.recorders.delete(rec);
        if (!failed && this.stream !== stream) failed = new MicError("Listening stopped.");
        if (failed) reject(failed);
        else resolve(new Blob(chunks, { type: rec.mimeType || mimeType || "audio/webm" }));
      };
      rec.start();
    });
  }

  stop(): void {
    window.clearInterval(this.timer);
    this.recorders.forEach((r) => r.state !== "inactive" && r.stop());
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    void this.ctx?.close();
    this.ctx = null;
  }

  private push({ onsets, rms }: { onsets: Float32Array; rms: Float32Array }): void {
    for (let i = 0; i < onsets.length; i++) {
      this.env[this.write] = onsets[i];
      this.write = (this.write + 1) % this.env.length;
      this.filled = Math.min(this.filled + 1, this.env.length);
      this.level = Math.max(rms[i], this.level * 0.97);
      if (this.debug && this.recording.length < this.frameRate * MAX_RECORDING_SECONDS) this.recording.push(onsets[i]);
    }
  }

  private estimate(): void {
    const minFrames = this.frameRate * MIN_SECONDS;
    const progress = Math.min(1, this.filled / minFrames);
    const ordered = new Float32Array(this.filled);
    const start = (this.write - this.filled + this.env.length) % this.env.length;
    for (let i = 0; i < this.filled; i++) ordered[i] = this.env[(start + i) % this.env.length];

    let r: ReturnType<typeof estimateTempo> = null;
    let accepted = false;
    if (this.level < SILENCE_RMS) {
      this.tracker.clear();
    } else if (this.filled >= minFrames) {
      r = estimateTempo(ordered, this.frameRate);
      if (r && r.confidence >= MIN_CONFIDENCE) {
        accepted = true;
        this.tracker.push(r.bpm);
      }
    }

    const shown = this.tracker.bpm;

    let debug: MicDebug | undefined;
    if (this.debug) {
      this.ticks.push({
        t: Math.round(performance.now() - this.startedAt) / 1000,
        bpm: r && Math.round(r.bpm * 10) / 10,
        confidence: r ? Math.round(r.confidence * 1000) / 1000 : 0,
        scoredBpm: r && Math.round(((60 * this.frameRate) / r.details.scoredLag) * 10) / 10,
        doubled: r?.details.doubled ?? false,
        accepted,
        shown: shown && Math.round(shown * 10) / 10,
        level: Math.round(this.level * 1e4) / 1e4,
      });
      debug = {
        frameRate: this.frameRate,
        env: ordered,
        details: r?.details ?? null,
        ticks: this.ticks.slice(-DEBUG_TICKS),
      };
    }

    this.onUpdate({
      bpm: shown,
      confidence: this.tracker.confidence,
      level: Math.min(1, Math.sqrt(this.level) * 2),
      progress,
      debug,
    });
  }
}
