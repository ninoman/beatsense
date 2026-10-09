type Props = {
  bpm: number | null;
  /** Fades a value that is no longer live (stale taps, stopped listening). */
  dim?: boolean;
  /** Animates the empty placeholder while waiting for a result. */
  waiting?: boolean;
};

export function BpmDisplay({ bpm, dim, waiting }: Props) {
  if (bpm === null) {
    return (
      <div className="bpm-display" aria-live="polite">
        <span className={`bpm-value bpm-empty${waiting ? " is-waiting" : ""}`} aria-label="No BPM yet">
          <i />
          <i />
          <i />
        </span>
        <span className="bpm-unit">BPM</span>
      </div>
    );
  }

  const [whole, decimal] = bpm.toFixed(1).split(".");
  return (
    <div className="bpm-display" aria-live="polite">
      <span className={`bpm-value${dim ? " is-dim" : ""}`}>
        {whole}
        <span className="bpm-decimal">.{decimal}</span>
      </span>
      <span className="bpm-unit">BPM</span>
    </div>
  );
}
