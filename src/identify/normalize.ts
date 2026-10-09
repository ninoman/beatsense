// Recognizers report titles like "Song (feat. X) [2011 Remaster]" that rarely match Discogs track
// titles; strip that noise before searching.

const FEAT = /\s*[([]\s*(?:feat\.?|ft\.?|featuring|with)\s[^)\]]*[)\]]/gi;
const TRAILING_FEAT = /\s+(?:feat\.?|ft\.?|featuring)\s.*$/i;
const VERSION_WORDS = String.raw`remaster(?:ed)?|radio edit|single version|album version|original mix|extended mix|edit|mono|stereo|live`;
const BRACKETED_VERSION = new RegExp(String.raw`\s*[([][^)\]]*\b(?:${VERSION_WORDS})\b[^)\]]*[)\]]`, "gi");
const DASHED_VERSION = new RegExp(String.raw`\s+-\s+[^-]*\b(?:${VERSION_WORDS})\b.*$`, "i");

export function normalizeTitle(title: string): string {
  const cleaned = title
    .replace(FEAT, "")
    .replace(BRACKETED_VERSION, "")
    .replace(DASHED_VERSION, "")
    .replace(TRAILING_FEAT, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || title.trim();
}

/** Keeps the main artist only: "Daft Punk feat. Pharrell Williams" -> "Daft Punk". */
export function normalizeArtist(artist: string): string {
  return artist.replace(TRAILING_FEAT, "").replace(FEAT, "").trim() || artist.trim();
}
