import { useState } from "react";
import { useMicTempo } from "../hooks/useMicTempo";
import { useWakeLock } from "../hooks/useWakeLock";
import { BpmDisplay } from "./BpmDisplay";
import { DebugPanel } from "./DebugPanel";

const DEBUG = new URLSearchParams(location.search).has("debug");

function download(json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `bpm-debug-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

type Props = { onSave: (bpm: number) => void };

export function ListenPanel({ onSave }: Props) {
  const mic = useMicTempo({ debug: DEBUG });
  const [multiplier, setMultiplier] = useState(1);
  const listening = mic.status === "listening";
  useWakeLock(listening);

  const bpm = mic.bpm === null ? null : mic.bpm * multiplier;

  const toggle = () => {
    if (listening || mic.status === "starting") mic.stop();
    else {
      setMultiplier(1);
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

  return (
    <section className="panel">
      <BpmDisplay bpm={bpm} dim={!listening} waiting={listening} />
      <p className={`hint${mic.status === "error" ? " is-error" : ""}`}>{hint}</p>

      <button type="button" className={`listen-btn${listening ? " is-active" : ""}`} onClick={toggle}>
        <span className="listen-icon" aria-hidden>
          {listening ? "■" : "●"}
        </span>
        {listening ? "Stop" : mic.status === "starting" ? "Starting…" : "Start listening"}
      </button>

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
        <button type="button" className="btn btn-primary" onClick={() => bpm && onSave(bpm)} disabled={!bpm}>
          Save
        </button>
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
