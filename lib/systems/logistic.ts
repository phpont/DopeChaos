/* Logistic Map: x_{n+1} = r * x_n * (1 - x_n)
 * Includes bifurcation diagram (density) and cobweb plot computations. */

import type { SystemDefinition } from "@/lib/types";

export const logisticSystem: SystemDefinition = {
  id: "logistic",
  name: "Logistic Map",
  description:
    "A simple discrete dynamical system that exhibits the full route from order to chaos as the parameter r increases.",
  equations: "x(n+1) = r * x(n) * (1 - x(n))\n\nr in [0, 4],  x in [0, 1]",
  references: [
    { label: "Wikipedia: Logistic map", url: "https://en.wikipedia.org/wiki/Logistic_map" },
  ],
  paramsSchema: [
    { key: "r", label: "r (growth)", kind: "number", min: 0, max: 4, step: 0.001, default: 3.57 },
    { key: "x0", label: "x0 (initial)", kind: "number", min: 0.001, max: 0.999, step: 0.001, default: 0.5 },
    { key: "rMin", label: "r min", kind: "number", min: 0, max: 4, step: 0.01, default: 2.5 },
    { key: "rMax", label: "r max", kind: "number", min: 0, max: 4, step: 0.01, default: 4.0 },
    { key: "warmup", label: "Warmup", kind: "number", min: 50, max: 2000, step: 50, default: 300 },
    { key: "samples", label: "Samples", kind: "number", min: 100, max: 5000, step: 100, default: 500 },
  ],
  presets: [
    { name: "Edge of Chaos", description: "Onset of chaos at r ≈ 3.5699", params: { r: 3.5699, rMin: 2.5, rMax: 4.0 } },
    { name: "Period-3 Window", description: "Stable period-3 island", params: { r: 3.8284, rMin: 3.8, rMax: 3.86 } },
    { name: "Full Chaos", description: "Maximum chaos at r = 4", params: { r: 4.0, rMin: 2.5, rMax: 4.0 } },
    { name: "Period Doubling", description: "The doubling cascade", params: { r: 3.45, rMin: 2.8, rMax: 3.6 } },
  ],
  views: [
    { id: "bifurcation", name: "Bifurcation", description: "Density diagram: x-axis = r, y-axis = x, brightness = frequency", animated: true },
    { id: "cobweb", name: "Cobweb", description: "Graphical iteration showing the map function and trajectory", animated: true },
  ],
  renderSpec: {
    preview: { resolutionDivisor: 4, maxIterations: 300, tileSize: 128 },
    refine: { resolutionDivisor: 1, maxIterations: 2000, tileSize: 128 },
  },
  explain: [
    {
      heading: "What is the Logistic Map?",
      body: "The logistic map is one of the simplest equations that produces chaotic behavior. Starting from an initial value x0, each step multiplies x by r and (1-x). Despite its simplicity, it shows period-doubling bifurcations and full chaos.",
    },
    {
      heading: "Parameters",
      body: "r (growth rate): Controls the behavior. Below 3: convergence to a fixed point. Around 3.45: period-2 oscillation. Around 3.54: period-4. At r ≈ 3.5699: onset of chaos. x0: Starting value between 0 and 1.",
    },
    {
      heading: "Reading the Bifurcation Diagram",
      body: "X-axis shows r values, Y-axis shows the values x visits after warmup. Brighter regions mean x visits that value more often. You can see the cascade of period doublings leading to chaos, with periodic windows (like the period-3 window near r ≈ 3.83).",
    },
    {
      heading: "Reading the Cobweb Plot",
      body: "The parabola is the map f(x) = r*x*(1-x). The diagonal is y = x. Starting from x0, the zigzag trace alternates between the parabola (vertical step) and the diagonal (horizontal step), showing how x evolves over iterations.",
    },
  ],
};

// ============================================================
// Computation functions (called by the worker)
// ============================================================

/** Compute bifurcation density histogram.
 *  Returns Uint32Array of size rBins * xBins with visit counts. */
export function computeBifurcation(
  rMin: number,
  rMax: number,
  rBins: number,
  xBins: number,
  warmup: number,
  samples: number,
  x0: number,
  checkCancelled: () => boolean
): Uint32Array | null {
  const density = new Uint32Array(rBins * xBins);
  const rStep = (rMax - rMin) / rBins;

  for (let ri = 0; ri < rBins; ri++) {
    if (ri % 32 === 0 && checkCancelled()) return null;

    const r = rMin + ri * rStep;
    let x = x0;

    // Warmup: discard transients
    for (let i = 0; i < warmup; i++) {
      x = r * x * (1 - x);
    }

    // Sample: accumulate density
    for (let i = 0; i < samples; i++) {
      x = r * x * (1 - x);
      const bin = Math.floor(x * xBins);
      if (bin >= 0 && bin < xBins) {
        density[ri * xBins + bin]!++;
      }
    }
  }

  return density;
}

/** Compute cobweb plot data.
 *  Returns parabola curve points and iteration zigzag path. */
export function computeCobweb(
  r: number,
  x0: number,
  steps: number
): { parabola: Float64Array; path: Float64Array } {
  // Parabola: 256 sample points of f(x) = r*x*(1-x) for x in [0,1]
  const parabolaN = 256;
  const parabola = new Float64Array(parabolaN * 2);
  for (let i = 0; i < parabolaN; i++) {
    const xp = i / (parabolaN - 1);
    parabola[i * 2] = xp;
    parabola[i * 2 + 1] = r * xp * (1 - xp);
  }

  // Cobweb iteration path: start at (x0, 0), zigzag between parabola and diagonal
  const pathPoints: number[] = [];
  let x = x0;
  pathPoints.push(x, 0); // start on x-axis

  for (let i = 0; i < steps; i++) {
    const y = r * x * (1 - x);
    pathPoints.push(x, y);  // vertical to parabola
    pathPoints.push(y, y);  // horizontal to diagonal
    x = y;
  }

  return {
    parabola,
    path: new Float64Array(pathPoints),
  };
}
