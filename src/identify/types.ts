/** A recognized recording, as returned by a recognizer (AudD now, ShazamKit in a native wrapper later). */
export type Match = {
  title: string;
  artist: string;
  album?: string;
  year?: number;
  label?: string;
  artworkUrl?: string;
  /** Broad genres from the recognizer's catalog (e.g. Apple Music's "Dance"). */
  genres: string[];
};

/** Release info looked up on Discogs. */
export type Release = {
  genres: string[];
  /** Discogs' fine-grained sub-genres, e.g. "Deep House". */
  styles: string[];
  year?: number;
  label?: string;
  country?: string;
  format?: string;
  coverUrl?: string;
  discogsUrl?: string;
};

export type Track = Match & Omit<Release, "genres">;

/** Progress for the UI. `until` is the performance.now() time at which the clip being recorded ends. */
export type IdentifyStage = { step: "recording"; until: number } | { step: "matching" } | { step: "details" };

export type Recognizer = {
  recognize(signal?: AbortSignal, onStage?: (stage: IdentifyStage) => void): Promise<Match | null>;
};

/** A failure worth showing to the user as-is. */
export class IdentifyError extends Error {}
