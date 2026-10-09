import { useCallback, useEffect, useRef, useState } from "react";
import { MicError } from "../dsp/mic";
import { createWebRecognizer, IdentifyError, identifyTrack, type IdentifyStage, type Track } from "../identify";

/** "waiting": requested, but holding off until there's music so no request is spent on silence. */
export type IdentifyStatus = "idle" | "waiting" | "identifying" | "found" | "notFound" | "error";

/** Same threshold ListenPanel uses for "Too quiet". */
const MIN_LEVEL = 0.05;
const LOUD_FOR_MS = 1500;

type RecordClip = (seconds: number, signal?: AbortSignal) => Promise<Blob>;
type Mic = { recordClip: RecordClip; listening: boolean; level: number };

export function useIdentify({ recordClip, listening, level }: Mic) {
  const run = useRef<AbortController | null>(null);
  const loudSince = useRef<number | null>(null);
  const [status, setStatus] = useState<IdentifyStatus>("idle");
  const [track, setTrack] = useState<Track | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<IdentifyStage | null>(null);

  /** Requests an identification; it starts once the mic has heard music for a moment. */
  const identify = useCallback(() => {
    run.current?.abort();
    run.current = null;
    loudSince.current = null;
    setTrack(null);
    setError(null);
    setStage(null);
    setStatus("waiting");
  }, []);

  const start = useCallback(async () => {
    const ctrl = new AbortController();
    run.current = ctrl;
    setStatus("identifying");
    try {
      const t = await identifyTrack(createWebRecognizer(recordClip), ctrl.signal, (s) => {
        if (!ctrl.signal.aborted) setStage(s);
      });
      if (ctrl.signal.aborted) return;
      setTrack(t);
      setStatus(t ? "found" : "notFound");
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setError(e instanceof IdentifyError || e instanceof MicError ? e.message : "Couldn't identify the song.");
      setStatus("error");
    } finally {
      if (run.current === ctrl) run.current = null;
      if (!ctrl.signal.aborted) setStage(null);
    }
  }, [recordClip]);

  // Level updates arrive every ~500 ms while listening.
  useEffect(() => {
    if (status !== "waiting" || !listening || level < MIN_LEVEL) {
      loudSince.current = null;
      return;
    }
    loudSince.current ??= performance.now();
    if (performance.now() - loudSince.current >= LOUD_FOR_MS) void start();
  }, [status, listening, level, start]);

  /** Cancels a pending identification; with `clear`, also forgets the last result. */
  const cancel = useCallback((clear = false) => {
    run.current?.abort();
    run.current = null;
    setStage(null);
    if (clear) {
      setTrack(null);
      setError(null);
      setStatus("idle");
    } else setStatus((s) => (s === "waiting" || s === "identifying" ? "idle" : s));
  }, []);

  useEffect(() => () => run.current?.abort(), []);

  const pending = status === "waiting" || status === "identifying";
  return { status, stage, pending, track, error, identify, cancel };
}
