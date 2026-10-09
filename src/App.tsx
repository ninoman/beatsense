import { useState } from "react";
import { History } from "./components/History";
import { ListenPanel } from "./components/ListenPanel";
import { TapPanel } from "./components/TapPanel";
import { ThemeToggle } from "./components/ThemeToggle";
import { useHistory } from "./hooks/useHistory";

type Mode = "tap" | "listen";

export default function App() {
  const [mode, setMode] = useState<Mode>("tap");
  const history = useHistory();

  return (
    <div className="app">
      <header className="top">
        <h1 className="logo">
          Beat<span>Sense</span>
        </h1>
        <ThemeToggle />
      </header>

      <main>
        <nav className="tabs" role="tablist">
          {(["tap", "listen"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={`tab${mode === m ? " is-active" : ""}`}
              onClick={() => setMode(m)}
            >
              {m === "tap" ? "Tap" : "Listen"}
            </button>
          ))}
        </nav>
        {mode === "tap" ? (
          <TapPanel onSave={(bpm) => history.add(bpm, "tap")} />
        ) : (
          <ListenPanel onSave={(bpm, track) => history.add(bpm, "listen", track)} />
        )}
        <History entries={history.entries} onClear={history.clear} />
      </main>
    </div>
  );
}
