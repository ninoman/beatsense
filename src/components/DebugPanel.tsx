import { useEffect, useRef } from "react";
import type { MicDebug } from "../dsp/mic";

type Props = { debug: MicDebug | undefined; onDownload: () => void };

const W = 440;
const H = 110;

function setup(canvas: HTMLCanvasElement | null) {
  const ctx = canvas?.getContext("2d");
  if (!canvas || !ctx) return null;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const css = getComputedStyle(canvas);
  return { ctx, accent: css.getPropertyValue("--accent"), muted: css.getPropertyValue("--muted") };
}

export function DebugPanel({ debug, onDownload }: Props) {
  const envRef = useRef<HTMLCanvasElement>(null);
  const acfRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const e = setup(envRef.current);
    if (e && debug && debug.env.length) {
      const { ctx, muted } = e;
      let max = 1e-6;
      for (const v of debug.env) max = Math.max(max, v);
      ctx.strokeStyle = muted;
      ctx.beginPath();
      debug.env.forEach((v, i) => {
        const x = (i / debug.env.length) * W;
        const y = H - (v / max) * (H - 4);
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.stroke();
    }

    const a = setup(acfRef.current);
    const d = debug?.details;
    if (a && d && debug) {
      const { ctx, accent, muted } = a;
      const fr = debug.frameRate;
      // x axis is BPM 60..200 (log scale) so octave relationships are equidistant.
      const toX = (bpm: number) => (Math.log2(bpm / 60) / Math.log2(200 / 60)) * W;
      const toY = (v: number) => H / 2 - v * (H / 2 - 4);
      ctx.strokeStyle = muted;
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = muted;
      ctx.font = "10px system-ui";
      for (const bpm of [60, 80, 100, 120, 150, 200]) ctx.fillText(String(bpm), Math.min(W - 18, toX(bpm) + 2), H - 2);
      ctx.beginPath();
      for (let lag = d.minLag; lag <= d.maxLag; lag++) {
        const x = toX((60 * fr) / lag);
        if (lag === d.minLag) ctx.moveTo(x, toY(d.acf[lag]));
        else ctx.lineTo(x, toY(d.acf[lag]));
      }
      ctx.stroke();
      const mark = (lag: number, color: string) => {
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(toX((60 * fr) / lag), 0);
        ctx.lineTo(toX((60 * fr) / lag), H);
        ctx.stroke();
      };
      if (d.doubled) mark(d.scoredLag, muted);
      mark(d.lag, accent);
    }
  }, [debug]);

  return (
    <section className="debug">
      <header className="history-header">
        <h2>Debug</h2>
        <button type="button" className="link-btn" onClick={onDownload}>
          Download recording
        </button>
      </header>
      <p className="debug-label">Onset envelope (analysis window)</p>
      <canvas ref={envRef} style={{ width: "100%", aspectRatio: `${W} / ${H}` }} />
      <p className="debug-label">Autocorrelation by BPM · accent = chosen, grey = before ×2 check</p>
      <canvas ref={acfRef} style={{ width: "100%", aspectRatio: `${W} / ${H}` }} />
      <table className="debug-ticks">
        <thead>
          <tr>
            <th>t</th>
            <th>raw</th>
            <th>scored</th>
            <th>×2</th>
            <th>acf</th>
            <th>ok</th>
            <th>shown</th>
          </tr>
        </thead>
        <tbody>
          {[...(debug?.ticks ?? [])].reverse().slice(0, 16).map((t) => (
            <tr key={t.t}>
              <td>{t.t.toFixed(1)}</td>
              <td>{t.bpm ?? "–"}</td>
              <td>{t.scoredBpm ?? "–"}</td>
              <td>{t.doubled ? "×2" : ""}</td>
              <td>{t.confidence.toFixed(2)}</td>
              <td>{t.accepted ? "✓" : "✗"}</td>
              <td>{t.shown ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
