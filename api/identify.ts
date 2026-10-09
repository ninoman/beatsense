// POST /api/identify — multipart `file` (a few seconds of mic audio) -> AudD song recognition.
// Vercel Function; AUDD_API_TOKEN stays server-side.

/** ~10 s of 128 kbps audio is ~160 KB; anything far larger isn't a clip from our recorder. */
const MAX_BYTES = 2 * 1024 * 1024;

type AuddResponse = {
  status: "success" | "error";
  error?: { error_code: number; error_message: string };
  result: {
    artist: string;
    title: string;
    album?: string;
    release_date?: string;
    label?: string;
    apple_music?: { genreNames?: string[]; artwork?: { url: string } };
  } | null;
};

export async function POST(request: Request): Promise<Response> {
  const token = process.env.AUDD_API_TOKEN;
  if (!token) return json({ error: "Song recognition isn't configured." }, 500);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size === 0) return json({ error: "Missing audio clip." }, 400);
  if (file.size > MAX_BYTES) return json({ error: "Audio clip is too large." }, 413);

  const body = new FormData();
  body.set("api_token", token);
  body.set("return", "apple_music");
  body.set("file", file, file instanceof File ? file.name : "clip");

  const res = await fetch("https://api.audd.io/", { method: "POST", body }).catch(() => null);
  if (!res?.ok) return json({ error: "Recognition service is unavailable." }, 502);
  const data = (await res.json()) as AuddResponse;
  if (data.status !== "success") {
    console.error("AudD error", data.error);
    return json({ error: "Recognition failed." }, 502);
  }

  const r = data.result;
  if (!r) return json({ match: null });
  const year = Number.parseInt(r.release_date ?? "", 10);
  return json({
    match: {
      title: r.title,
      artist: r.artist,
      album: r.album || undefined,
      year: Number.isFinite(year) ? year : undefined,
      label: r.label || undefined,
      artworkUrl: r.apple_music?.artwork?.url.replace("{w}", "300").replace("{h}", "300"),
      // Apple tags almost everything with the catch-all "Music" too.
      genres: (r.apple_music?.genreNames ?? []).filter((g) => g !== "Music"),
    },
  });
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
