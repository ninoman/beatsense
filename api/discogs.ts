// GET /api/discogs?artist=&title= — genres, styles and release info for a recognized song.
// Vercel Function; DISCOGS_TOKEN stays server-side. Responses are CDN-cached because Discogs
// allows only 60 authenticated requests per minute.

const USER_AGENT = "BeatSense/0.1 +https://github.com/ninoman/beatsense";

type SearchResult = {
  year?: string;
  genre?: string[];
  style?: string[];
  label?: string[];
  country?: string;
  format?: string[];
  cover_image?: string;
  uri?: string;
};

export async function GET(request: Request): Promise<Response> {
  const token = process.env.DISCOGS_TOKEN;
  if (!token) return json({ error: "Discogs lookup isn't configured." }, 500);

  const params = new URL(request.url).searchParams;
  const artist = params.get("artist")?.trim();
  const title = params.get("title")?.trim();
  if (!artist || !title) return json({ error: "artist and title are required." }, 400);

  try {
    // Releases by the artist whose tracklist contains the title; then a looser full-text search.
    const results =
      (await search(token, { artist, track: title })) ?? (await search(token, { q: `${artist} ${title}` }));
    const best = results && pickOriginal(results);
    if (!best) return json({ release: null }, 200, 3600);
    return json({ release: toRelease(best) }, 200, 86400);
  } catch (e) {
    console.error("Discogs error", e);
    return json({ error: e instanceof RateLimited ? "Discogs is busy, try again shortly." : "Discogs lookup failed." }, 502);
  }
}

class RateLimited extends Error {}

async function search(token: string, query: Record<string, string>): Promise<SearchResult[] | null> {
  const q = new URLSearchParams({ ...query, type: "release", per_page: "25" });
  const res = await fetch(`https://api.discogs.com/database/search?${q}`, {
    headers: { Authorization: `Discogs token=${token}`, "User-Agent": USER_AGENT },
  });
  if (res.status === 429) throw new RateLimited();
  if (!res.ok) throw new Error(`Discogs ${res.status}`);
  const data = (await res.json()) as { results?: SearchResult[] };
  return data.results?.length ? data.results : null;
}

/** Reissues and compilations come later, so the earliest dated release is usually the original. */
function pickOriginal(results: SearchResult[]): SearchResult {
  const year = (r: SearchResult) => Number.parseInt(r.year ?? "", 10) || Infinity;
  return results.reduce((best, r) => (year(r) < year(best) ? r : best));
}

function toRelease(r: SearchResult) {
  const year = Number.parseInt(r.year ?? "", 10);
  return {
    genres: r.genre ?? [],
    styles: r.style ?? [],
    year: Number.isFinite(year) ? year : undefined,
    label: r.label?.[0],
    country: r.country || undefined,
    format: r.format?.[0],
    // Discogs' placeholder "spacer.gif" isn't a real cover.
    coverUrl: r.cover_image && !r.cover_image.endsWith("spacer.gif") ? r.cover_image : undefined,
    discogsUrl: r.uri ? `https://www.discogs.com${r.uri}` : undefined,
  };
}

function json(data: unknown, status = 200, cacheSeconds = 0): Response {
  const cache = cacheSeconds > 0 ? `public, s-maxage=${cacheSeconds}, stale-while-revalidate=604800` : "no-store";
  return Response.json(data, { status, headers: { "Cache-Control": cache } });
}
