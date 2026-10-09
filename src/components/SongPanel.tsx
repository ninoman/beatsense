import { useState, type CSSProperties } from "react";
import type { IdentifyStatus } from "../hooks/useIdentify";
import type { IdentifyStage, Track } from "../identify";
import { TrackCard } from "./TrackCard";

type Props = {
  status: IdentifyStatus;
  stage: IdentifyStage | null;
  track: Track | null;
  error: string | null;
  /** Mic input level 0..1, drives the equalizer height. */
  level: number;
  onRetry: () => void;
};

/** The slot under the meters: listening progress, the identified track, or a no-match message. */
export function SongPanel({ status, stage, track, error, level, onRetry }: Props) {
  if (track) return <TrackCard key={`${track.artist}/${track.title}`} track={track} />;
  if (status === "waiting" || status === "identifying") return <ListeningCard stage={stage} level={level} />;
  if (status === "notFound" || status === "error") {
    return (
      <div className="song-card is-message" role="status">
        <div className="song-card-icon" aria-hidden>
          {status === "error" ? "!" : "?"}
        </div>
        <div className="song-card-body">
          <p className="song-card-title">{status === "error" ? "Something went wrong" : "No match"}</p>
          <p className="song-card-sub">{error ?? "Try closer to the speaker"}</p>
        </div>
        <button type="button" className="btn song-retry" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }
  return null;
}

const COPY: Record<IdentifyStage["step"] | "waiting", [string, string]> = {
  waiting: ["Waiting for music", "Play a song near your device"],
  recording: ["Listening…", "Keep the music playing"],
  matching: ["Matching…", "Looking for this song"],
  details: ["Found it", "Getting genre and release info"],
};

function ListeningCard({ stage, level }: { stage: IdentifyStage | null; level: number }) {
  const step = stage?.step ?? "waiting";
  const [title, sub] = COPY[step];
  const amp = step === "waiting" ? 0.15 : Math.min(1, 0.35 + level * 1.5);
  return (
    <div className={`song-card is-listening is-${step}`} role="status" aria-live="polite">
      <div className="eq" style={{ "--amp": amp } as CSSProperties} aria-hidden>
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <div className="song-card-body">
        <p className="song-card-title">{title}</p>
        <p className="song-card-sub">{sub}</p>
        {step !== "waiting" && (
          <div className="song-progress" aria-hidden>
            {stage?.step === "recording" ? <RecordingBar key={stage.until} until={stage.until} /> : <i className="is-busy" />}
          </div>
        )}
      </div>
    </div>
  );
}

/** Fills over the time left on the clip; remounted (via key) for each new clip. */
function RecordingBar({ until }: { until: number }) {
  const [ms] = useState(() => Math.max(0, until - performance.now()));
  return <i className="is-filling" style={{ animationDuration: `${ms}ms` }} />;
}
