import { useCallback, useEffect, useRef, useState } from "react";
import { TAP_RESET_MS, TapTempo } from "../dsp/tap";
import { haptic } from "../lib/device";

export function useTapTempo() {
  const tempo = useRef(new TapTempo());
  const [bpm, setBpm] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [stale, setStale] = useState(false);
  const staleTimer = useRef(0);

  const tap = useCallback(() => {
    const next = tempo.current.tap(performance.now());
    setBpm(next);
    setCount(tempo.current.count);
    setPulse((p) => p + 1);
    setStale(false);
    haptic();
    window.clearTimeout(staleTimer.current);
    staleTimer.current = window.setTimeout(() => setStale(true), TAP_RESET_MS);
  }, []);

  const reset = useCallback(() => {
    tempo.current.reset();
    window.clearTimeout(staleTimer.current);
    setBpm(null);
    setCount(0);
    setStale(false);
  }, []);

  useEffect(() => () => window.clearTimeout(staleTimer.current), []);

  return { bpm, count, pulse, stale, tap, reset };
}
