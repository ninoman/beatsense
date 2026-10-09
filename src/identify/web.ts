// Browser recognizer: records short mic clips and sends them to /api/identify (AudD).
import { IdentifyError, type Match, type Recognizer } from "./types";

type RecordClip = (seconds: number, signal?: AbortSignal) => Promise<Blob>;

/** Most songs match on the short clip; the long one (recorded in parallel) covers quiet intros. */
const SHORT_CLIP_SECONDS = 5;
const LONG_CLIP_SECONDS = 10;

export function createWebRecognizer(recordClip: RecordClip): Recognizer {
  return {
    async recognize(signal, onStage) {
      const clips = new AbortController();
      const stop = () => clips.abort();
      signal?.addEventListener("abort", stop, { once: true });
      const startedAt = performance.now();
      const long = recordClip(LONG_CLIP_SECONDS, clips.signal);
      long.catch(() => {}); // not awaited if the short clip matches
      try {
        onStage?.({ step: "recording", until: startedAt + SHORT_CLIP_SECONDS * 1000 });
        const short = await recordClip(SHORT_CLIP_SECONDS, clips.signal);
        onStage?.({ step: "matching" });
        const first = await sendClip(short, signal);
        if (first) return first;
        onStage?.({ step: "recording", until: startedAt + LONG_CLIP_SECONDS * 1000 });
        const full = await long;
        onStage?.({ step: "matching" });
        return await sendClip(full, signal);
      } finally {
        stop();
        signal?.removeEventListener("abort", stop);
      }
    },
  };
}

async function sendClip(clip: Blob, signal?: AbortSignal): Promise<Match | null> {
  const body = new FormData();
  body.set("file", clip, clip.type.includes("mp4") ? "clip.mp4" : "clip.webm");
  const res = await apiFetch("/api/identify", { method: "POST", body, signal });
  const data = (await res.json()) as { match: Match | null };
  return data.match;
}

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    throw new IdentifyError(navigator.onLine ? "Couldn't reach the server." : "You're offline.");
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new IdentifyError(data?.error ?? `Server error (${res.status}).`);
  }
  return res;
}
