import { useState } from "react";
import type { Track } from "../identify";

type Props = { track: Track };

export function TrackCard({ track }: Props) {
  const [coverFailed, setCoverFailed] = useState(false);
  const tags = track.styles.length > 0 ? track.styles : track.genres;
  const meta = [track.year, track.label, track.country].filter(Boolean).join(" · ");
  const cover = track.artworkUrl ?? track.coverUrl;

  return (
    <article className="song-card track">
      <div className="track-cover">
        {cover && !coverFailed ? (
          <img src={cover} alt="" width={72} height={72} onError={() => setCoverFailed(true)} />
        ) : (
          <span aria-hidden>♪</span>
        )}
      </div>
      <div className="song-card-body">
        <p className="track-title">{track.title}</p>
        <p className="song-card-sub">{track.artist}</p>
        {meta && <p className="track-meta">{meta}</p>}
      </div>
      {(tags.length > 0 || track.discogsUrl) && (
        <footer className="track-footer">
          <ul className="track-tags" aria-label="Genres">
            {tags.slice(0, 4).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {track.discogsUrl && (
            <a className="track-link" href={track.discogsUrl} target="_blank" rel="noreferrer">
              Discogs ↗
            </a>
          )}
        </footer>
      )}
    </article>
  );
}
