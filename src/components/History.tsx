import type { HistoryEntry } from "../lib/history";

type Props = { entries: HistoryEntry[]; onClear: () => void };

const time = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function when(at: number): string {
  const d = new Date(at);
  return d.toDateString() === new Date().toDateString() ? time.format(d) : date.format(d);
}

export function History({ entries, onClear }: Props) {
  if (entries.length === 0) return null;
  return (
    <section className="history">
      <header className="history-header">
        <h2>Saved</h2>
        <button type="button" className="link-btn" onClick={onClear}>
          Clear
        </button>
      </header>
      <ul>
        {entries.map((e) => (
          <li key={e.at}>
            <span className="history-bpm">{e.bpm.toFixed(1)}</span>
            <span className="history-source">{e.source === "tap" ? "Tapped" : "Listened"}</span>
            <span className="history-time">{when(e.at)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
