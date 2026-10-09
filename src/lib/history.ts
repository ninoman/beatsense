export type HistoryTrack = { title: string; artist: string; styles: string[] };

export type HistoryEntry = { bpm: number; source: "tap" | "listen"; at: number; track?: HistoryTrack };

const KEY = "beatsense:history";
export const HISTORY_LIMIT = 20;

export function loadHistory(): HistoryEntry[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]).slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // Storage unavailable (private mode, quota): history just won't persist.
  }
}
