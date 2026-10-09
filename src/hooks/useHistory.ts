import { useCallback, useEffect, useState } from "react";
import { HISTORY_LIMIT, loadHistory, saveHistory, type HistoryEntry } from "../lib/history";

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadHistory);

  useEffect(() => saveHistory(entries), [entries]);

  const add = useCallback((bpm: number, source: HistoryEntry["source"]) => {
    setEntries((e) => [{ bpm, source, at: Date.now() }, ...e].slice(0, HISTORY_LIMIT));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, add, clear };
}
