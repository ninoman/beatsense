import { useEffect } from "react";
import { useTapTempo } from "../hooks/useTapTempo";
import { BpmDisplay } from "./BpmDisplay";

type Props = { onSave: (bpm: number) => void };

export function TapPanel({ onSave }: Props) {
  const { bpm, count, pulse, stale, tap, reset } = useTapTempo();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault(); // also stops a focused button from "clicking"
        if (!e.repeat) tap();
      } else if (e.code === "Escape") reset();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tap, reset]);

  return (
    <section className="panel">
      <BpmDisplay bpm={bpm} dim={stale} />
      <p className="hint">
        {count === 0 ? "Tap along to the beat" : count === 1 ? "Keep tapping…" : `${count} taps`}
      </p>

      <button
        type="button"
        className="tap-pad"
        onPointerDown={(e) => {
          e.preventDefault();
          tap();
        }}
        aria-label="Tap"
      >
        <span key={pulse} className={pulse ? "tap-ring is-pulsing" : "tap-ring"} />
        <span className="tap-label">TAP</span>
      </button>
      <p className="hint subtle kbd-hint">
        or press <kbd>Space</kbd> · <kbd>Esc</kbd> to reset
      </p>

      <div className="actions">
        <button type="button" className="btn" onClick={reset} disabled={count === 0}>
          Reset
        </button>
        <button type="button" className="btn btn-primary" onClick={() => bpm && onSave(bpm)} disabled={!bpm}>
          Save
        </button>
      </div>
    </section>
  );
}
