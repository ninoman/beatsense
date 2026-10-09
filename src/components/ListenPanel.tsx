import { useEffect, useState } from "react";
import { useIdentify } from "../hooks/useIdentify";
import { useMicTempo } from "../hooks/useMicTempo";
import { useWakeLock } from "../hooks/useWakeLock";
import type { HistoryTrack } from "../lib/history";
import { BpmDisplay } from "./BpmDisplay";
import { DebugPanel } from "./DebugPanel";
import { SongPanel } from "./SongPanel";

const DEBUG = new URLSearchParams(location.search).has("debug");

function download(json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `bpm-debug-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Props = { onSave: (bpm: number, track?: HistoryTrack) => void };

export function ListenPanel({ onSave }: Props) {
  const mic = useMicTempo({ debug: DEBUG });
  const [multiplier, setMultiplier] = useState(1);
  const listening = mic.status === "listening";
  const micOn = listening || mic.status === "starting";
  const song = useIdentify({ recordClip: mic.recordClip, listening, level: mic.level });
  useWakeLock(listening);

  const { cancel: cancelSong } = song;
  useEffect(() => {
    if (mic.status === "error") cancelSong(); // the mic never started, so a pending identify can't run
  }, [mic.status, cancelSong]);

  const bpm = mic.bpm === null ? null : mic.bpm * multiplier;

  const toggle = () => {
    if (micOn) {
      mic.stop();
      song.cancel(); // keep a found track on screen
    } else {
      setMultiplier(1);
      song.cancel(true);
      void mic.start();
    }
  };

  let hint = "Play music near your device";
  if (mic.status === "starting") hint = "Requesting microphone…";
  else if (mic.status === "error") hint = mic.error ?? "Something went wrong";
  else if (listening && mic.level < 0.05) hint = "Too quiet — move closer to the music";
  else if (listening && mic.progress < 1) hint = "Listening…";
  else if (listening && mic.bpm === null) hint = "Finding the beat…";
  else if (listening) hint = mic.confidence >= 0.75 ? "Locked on" : "Settling…";

  const save = () => {
    if (!bpm) return;
    const t = song.track;
    onSave(bpm, t ? { title: t.title, artist: t.artist, styles: (t.styles.length ? t.styles : t.genres).slice(0, 3) } : undefined);
  };

  // One tap from idle: start the mic (BPM detection comes along) and identify.
  const identifySong = () => {
    if (!micOn) {
      setMultiplier(1);
      void mic.start();
    }
    song.identify();
  };


  return (
    <section className="panel">
      <BpmDisplay bpm={bpm} dim={!listening} waiting={listening} />
      <p className={`hint${mic.status === "error" ? " is-error" : ""}`}>{hint}</p>

      <div className="listen-row">
        <button type="button" className={`listen-btn${micOn ? " is-active" : ""}`} onClick={toggle}>
          <span className="listen-icon" aria-hidden>
            {listening ? "■" : "●"}
          </span>
          {listening ? "Stop" : mic.status === "starting" ? "Starting…" : "Detect BPM"}
        </button>
        <button
          type="button"
          className={`listen-btn is-secondary${song.pending ? " is-busy" : ""}`}
          onClick={identifySong}
          disabled={song.pending}
        >
          {song.pending ? (
            <span className="eq is-mini" aria-hidden>
              <i />
              <i />
              <i />
            </span>
          ) : (
            <span className="listen-icon" aria-hidden>
              ♪
            </span>
          )}
          {song.pending ? "Identifying…" : song.track ? "Identify again" : "Identify song"}
        </button>
      </div>

      <div className="meters" aria-hidden={!listening}>
        <div className="meter">
          <span className="meter-label">Level</span>
          <div className="meter-track">
            <div className="meter-fill" style={{ width: `${mic.level * 100}%` }} />
          </div>
        </div>
        <div className="meter">
          <span className="meter-label">{mic.progress < 1 ? "Buffer" : "Confidence"}</span>
          <div className="meter-track">
            <div
              className="meter-fill is-accent"
              style={{ width: `${(mic.progress < 1 ? mic.progress : mic.confidence) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={() => setMultiplier((m) => m / 2)} disabled={!bpm}>
          ÷2
        </button>
        <button type="button" className="btn" onClick={() => setMultiplier((m) => m * 2)} disabled={!bpm}>
          ×2
        </button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!bpm}>
          Save
        </button>
      </div>

      <div className="identify">
        <SongPanel
          status={song.status}
          stage={song.stage}
          track={song.track}
          error={song.error}
          level={mic.level}
          onRetry={identifySong}
        />
      </div>
      {DEBUG && (
        <DebugPanel
          debug={mic.debug}
          onDownload={() => {
            const json = mic.exportRecording();
            if (json) download(json);
          }}
        />
      )}
    </section>
  );
}
