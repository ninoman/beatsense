import { useCallback, useEffect, useRef, useState } from "react";
import { MicError, MicTempoDetector, type MicUpdate } from "../dsp/mic";

export type MicStatus = "idle" | "starting" | "listening" | "error";

const EMPTY: MicUpdate = { bpm: null, confidence: 0, level: 0, progress: 0 };

export function useMicTempo({ debug = false } = {}) {
  const detector = useRef<MicTempoDetector | null>(null);
  // Kept after stop so a debug recording can still be exported.
  const last = useRef<MicTempoDetector | null>(null);
  const [status, setStatus] = useState<MicStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [update, setUpdate] = useState<MicUpdate>(EMPTY);

  const stop = useCallback(() => {
    detector.current?.stop();
    detector.current = null;
    setStatus("idle");
    setUpdate((u) => ({ ...EMPTY, debug: u.debug })); // keep the debug view after stopping
  }, []);

  const start = useCallback(async () => {
    detector.current?.stop();
    const d = new MicTempoDetector(setUpdate, { debug });
    detector.current = d;
    last.current = d;
    setError(null);
    setUpdate(EMPTY);
    setStatus("starting");
    try {
      await d.start();
      if (detector.current === d) setStatus("listening");
    } catch (e) {
      d.stop();
      if (detector.current !== d) return;
      detector.current = null;
      setError(e instanceof MicError ? e.message : "Could not start audio processing.");
      setStatus("error");
    }
  }, [debug]);

  const exportRecording = useCallback(() => last.current?.exportRecording() ?? null, []);

  useEffect(() => () => detector.current?.stop(), []);

  return { status, error, ...update, start, stop, exportRecording };
}
