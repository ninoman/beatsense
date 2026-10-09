// Song identification: a recognizer finds the recording, Discogs adds genres/styles and release info.
import { normalizeArtist, normalizeTitle } from "./normalize";
import type { IdentifyStage, Match, Recognizer, Release, Track } from "./types";
import { apiFetch } from "./web";

export { createWebRecognizer } from "./web";
export { IdentifyError, type IdentifyStage, type Recognizer, type Track } from "./types";

export async function identifyTrack(
  recognizer: Recognizer,
  signal?: AbortSignal,
  onStage?: (stage: IdentifyStage) => void,
): Promise<Track | null> {
  const match = await recognizer.recognize(signal, onStage);
  if (!match) return null;
  onStage?.({ step: "details" });
  const release = await lookupRelease(match, signal).catch((e: unknown) => {
    if (signal?.aborted) throw e;
    return null; // Discogs is a bonus: still show the match with the recognizer's genres
  });
  if (!release) return { ...match, styles: [] };
  return {
    ...match,
    ...release,
    genres: release.genres.length > 0 ? release.genres : match.genres,
    year: release.year ?? match.year,
    label: release.label ?? match.label,
  };
}

async function lookupRelease(match: Match, signal?: AbortSignal): Promise<Release | null> {
  const q = new URLSearchParams({ artist: normalizeArtist(match.artist), title: normalizeTitle(match.title) });
  const res = await apiFetch(`/api/discogs?${q}`, { signal });
  const data = (await res.json()) as { release: Release | null };
  return data.release;
}
