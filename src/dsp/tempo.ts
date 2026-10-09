// Tempo estimation from an onset-strength envelope via autocorrelation.

export type TempoDetails = {
  /** Autocorrelation normalized by acf[0], indexed by lag in frames. */
  acf: Float32Array;
  minLag: number;
  maxLag: number;
  /** Lag picked by the prior-weighted score, before the double-tempo check. */
  scoredLag: number;
  /** Final integer lag. */
  lag: number;
  doubled: boolean;
};

export type TempoEstimate = { bpm: number; confidence: number; details: TempoDetails };

export type TempoOptions = { minBpm?: number; maxBpm?: number };

/** Number of beat multiples (1..COMB beats) a candidate's grid is checked against. */
const COMB = 4;
const DOUBLE_RATIO = 0.7;

export function estimateTempo(
  env: ArrayLike<number>,
  frameRate: number,
  { minBpm = 60, maxBpm = 200 }: TempoOptions = {},
): TempoEstimate | null {
  const n = env.length;
  const minLag = Math.floor((frameRate * 60) / maxBpm);
  const maxLag = Math.ceil((frameRate * 60) / minBpm);
  if (n < COMB * maxLag + 2) return null;

  let mean = 0;
  for (let i = 0; i < n; i++) mean += env[i];
  mean /= n;
  // Mean-removed and lightly smoothed so beat periods that fall between two
  // integer lags don't split their autocorrelation peak.
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const prev = env[Math.max(0, i - 1)];
    const next = env[Math.min(n - 1, i + 1)];
    x[i] = 0.25 * prev + 0.5 * env[i] + 0.25 * next - mean;
  }

  const acfLen = Math.min(COMB * maxLag + 1, n - 1);
  const acf = new Float32Array(acfLen + 1);
  for (let lag = 0; lag <= acfLen; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += x[i] * x[i + lag];
    acf[lag] = s / (n - lag);
  }
  if (acf[0] <= 1e-12) return null;

  // Max of acf around i; multiples of a fractional true period drift off the integer grid.
  const peak = (i: number) => Math.max(acf[i - 1], acf[i], acf[Math.min(i + 1, acfLen)]);

  // Score each lag by how well its whole beat grid (1..COMB beats) repeats, so
  // sub-beat patterns (e.g. 16th hats lining up at 3/4 of a beat) don't win.
  // A log-Gaussian prior around 120 BPM breaks remaining half/double ties.
  let best = -1;
  let bestScore = -Infinity;
  for (let lag = minLag; lag <= maxLag; lag++) {
    const bpm = (60 * frameRate) / lag;
    const octaves = Math.log2(bpm / 120);
    const prior = Math.exp(-0.5 * (octaves / 0.9) ** 2);
    let comb = acf[lag];
    for (let k = 2; k <= COMB; k++) comb += peak(k * lag);
    const score = (comb / COMB) * prior;
    if (score > bestScore) {
      bestScore = score;
      best = lag;
    }
  }
  if (best < 1) return null;
  const scoredLag = best;
  let doubled = false;

  // Patterns like kick/snare alternation can make the 2-beat period look
  // stronger than the beat itself. If half the lag is nearly as periodic, prefer
  // the faster tempo. Eighth-note hats alone stay well below this ratio.
  const half = best / 2;
  if (half >= minLag) {
    const halfAcf = Math.max(acf[Math.floor(half)], acf[Math.ceil(half)]);
    if (halfAcf > DOUBLE_RATIO * acf[best]) {
      best = acf[Math.floor(half)] >= acf[Math.ceil(half)] ? Math.floor(half) : Math.ceil(half);
      doubled = true;
    }
  }

  // Parabolic interpolation for sub-frame lag precision.
  let lag = best;
  const a = acf[best - 1];
  const b = acf[best];
  const c = acf[best + 1];
  const denom = a - 2 * b + c;
  if (denom < 0) lag += (0.5 * (a - c)) / denom;

  return {
    bpm: (60 * frameRate) / lag,
    confidence: Math.max(0, Math.min(1, b / acf[0])),
    details: { acf: acf.map((v) => v / acf[0]), minLag, maxLag, scoredLag, lag: best, doubled },
  };
}

export function median(values: number[]): number {
  const s = [...values].sort((p, q) => p - q);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
