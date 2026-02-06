/* Julia Set: z <- z^2 + c, escape-time fractal.
 * Tile-based computation with smooth coloring. */

import type { SystemDefinition } from "@/lib/types";

export const juliaSystem: SystemDefinition = {
  id: "julia",
  name: "Julia Set",
  description:
    "For a fixed complex constant c, the Julia set is the boundary between points whose orbits under z^2+c escape to infinity and those that remain bounded. Different c values produce wildly different fractals.",
  equations: "z(n+1) = z(n)^2 + c\n\nz, c are complex numbers\nEscape condition: |z| > R",
  references: [
    { label: "Wikipedia: Julia set", url: "https://en.wikipedia.org/wiki/Julia_set" },
  ],
  paramsSchema: [
    { key: "cr", label: "c (real)", kind: "number", min: -2, max: 2, step: 0.001, default: -0.7269 },
    { key: "ci", label: "c (imag)", kind: "number", min: -2, max: 2, step: 0.001, default: 0.1889 },
    { key: "centerX", label: "Center X", kind: "number", min: -3, max: 3, step: 0.01, default: 0 },
    { key: "centerY", label: "Center Y", kind: "number", min: -3, max: 3, step: 0.01, default: 0 },
    { key: "zoom", label: "Zoom", kind: "number", min: 0.1, max: 1000, step: 0.1, default: 1 },
    { key: "maxIter", label: "Max Iter", kind: "number", min: 50, max: 2000, step: 25, default: 200 },
    { key: "escapeRadius", label: "Escape R", kind: "number", min: 2, max: 100, step: 1, default: 4 },
  ],
  presets: [
    { name: "Spiral", description: "Spiraling dendrite structure", params: { cr: -0.7269, ci: 0.1889, zoom: 1, centerX: 0, centerY: 0 } },
    { name: "Dendrite", description: "Tree-like branching", params: { cr: -0.1, ci: 0.651, zoom: 1, centerX: 0, centerY: 0 } },
    { name: "Douady Rabbit", description: "Three-lobed figure", params: { cr: -0.123, ci: 0.745, zoom: 1, centerX: 0, centerY: 0 } },
    { name: "Siegel Disk", description: "Smooth rotational region", params: { cr: -0.391, ci: -0.587, zoom: 1, centerX: 0, centerY: 0 } },
    { name: "San Marco", description: "Basilica-like symmetry", params: { cr: -0.75, ci: 0, zoom: 1, centerX: 0, centerY: 0 } },
  ],
  views: [
    { id: "fractal", name: "Fractal", description: "Escape-time rendering of the Julia set with smooth coloring", animated: true },
  ],
  renderSpec: {
    preview: { resolutionDivisor: 4, maxIterations: 80, tileSize: 128 },
    refine: { resolutionDivisor: 1, maxIterations: 200, tileSize: 128 },
  },
  explain: [
    {
      heading: "What is a Julia Set?",
      body: "For each point z0 in the complex plane, iterate z = z^2 + c. If the orbit escapes (|z| grows beyond the escape radius), the point is outside the set; the number of iterations before escape determines the coloring. Points that never escape form the Julia set itself (shown in black/darkest color).",
    },
    {
      heading: "Parameters",
      body: "c (real, imag): The complex constant defining which Julia set to render. Small changes in c produce dramatically different fractals. Zoom: magnification level. Center: which part of the complex plane you're viewing. Max Iter: higher values show finer detail at the boundary but take longer.",
    },
    {
      heading: "Reading the Visualization",
      body: "Colors represent how quickly each point escapes. Dark regions (interior) are bounded orbits. Bright regions escape quickly. The most intricate detail appears at the boundary between escape and non-escape.",
    },
    {
      heading: "Interaction",
      body: "Drag to pan around the complex plane. Use the mouse wheel to zoom in/out toward the cursor. A low-res preview appears immediately; full detail renders after you stop interacting.",
    },
  ],
};

// ============================================================
// Computation functions
// ============================================================

const LOG2 = Math.log(2);

/** Compute escape-time values for a single tile of the Julia set.
 *  Returns Float64Array[tileW * tileH] with smooth iteration counts.
 *  0.0 means the point is in the set (never escaped). */
export function computeJuliaTile(
  tileX: number,
  tileY: number,
  tileW: number,
  tileH: number,
  canvasW: number,
  canvasH: number,
  cr: number,
  ci: number,
  centerX: number,
  centerY: number,
  zoom: number,
  maxIter: number,
  escapeRadius: number
): Float64Array {
  const result = new Float64Array(tileW * tileH);
  const escR2 = escapeRadius * escapeRadius;
  const logEscR = Math.log(escapeRadius);

  // Map canvas to complex plane: [-aspect/zoom, aspect/zoom] x [-1/zoom, 1/zoom] centered at (centerX, centerY)
  const aspect = canvasW / canvasH;
  const rangeX = (2 * aspect) / zoom;
  const rangeY = 2 / zoom;
  const startRe = centerX - rangeX / 2;
  const startIm = centerY - rangeY / 2;
  const scaleX = rangeX / canvasW;
  const scaleY = rangeY / canvasH;

  for (let py = 0; py < tileH; py++) {
    const im0 = startIm + (tileY + py) * scaleY;
    for (let px = 0; px < tileW; px++) {
      const re0 = startRe + (tileX + px) * scaleX;

      let zr = re0;
      let zi = im0;
      let iter = 0;

      while (iter < maxIter) {
        const zr2 = zr * zr;
        const zi2 = zi * zi;
        if (zr2 + zi2 > escR2) break;
        zi = 2 * zr * zi + ci;
        zr = zr2 - zi2 + cr;
        iter++;
      }

      if (iter < maxIter) {
        // Smooth coloring: fractional escape count
        const zr2 = zr * zr;
        const zi2 = zi * zi;
        const modulus = Math.sqrt(zr2 + zi2);
        const smooth = iter + 1 - Math.log(Math.log(modulus)) / LOG2;
        result[py * tileW + px] = smooth;
      }
      // else: stays 0 (in set)
    }
  }

  return result;
}
