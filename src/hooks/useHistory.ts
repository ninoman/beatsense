import { useCallback, useEffect, useState } from "react";
import { HISTORY_LIMIT, loadHistory, saveHistory, type HistoryEntry, type HistoryTrack } from "../lib/history";

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory);

  useEffect(() => saveHistory(entries), [entries]);

  const add = useCallback((bpm: number, source: HistoryEntry["source"], track?: HistoryTrack) => {
    setEntries((e) => [{ bpm, source, at: Date.now(), track }, ...e].slice(0, HISTORY_LIMIT));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, add, clear };
}
