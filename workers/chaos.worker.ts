/* Chaos computation Web Worker.
 * Universal streaming state machine: each system computes one chunk at a time,
 * sends results + chunk_ready, then waits for a "continue" message from main thread.
 * This enables real-time continuous simulation for ALL systems (pause/resume via message flow).
 * Supports job cancellation via jobId checking. */

import type {
  WorkerRequest,
  WorkerResponse,
  ComputeRequest,
  JobId,
} from "../lib/types";
import { computeLorenzChunk, projectPoints } from "../lib/systems/lorenz";
import { computeJuliaTile } from "../lib/systems/julia";
import { normalizeHistogramLog } from "../lib/render/histogram";
import { getPalette } from "../lib/render/palettes";
import { intensityGridToAscii } from "../lib/render/ascii";

// ============================================================
// Streaming state machine
// ============================================================

let currentJobId: JobId | null = null;

// Generic streaming state — each system stores its own shape here
let streamState: Record<string, unknown> | null = null;
let streamJobId: JobId | null = null;
let streamHandler: ((jobId: JobId) => void) | null = null;
let waitingForContinue = false;

function isCancelled(jobId: JobId): boolean {
  return currentJobId !== jobId;
}

function send(msg: WorkerResponse, transfer?: Transferable[]): void {
  postMessage(msg, { transfer: transfer ?? [] });
}

/** Signal that this chunk is done and we're waiting for continue */
function sendChunkReady(jobId: JobId): void {
  waitingForContinue = true;
  send({ type: "chunk_ready", jobId });
}

function clearStreamState(): void {
  streamState = null;
  streamJobId = null;
  streamHandler = null;
  waitingForContinue = false;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;

  if (msg.type === "cancel") {
    if (currentJobId === msg.jobId) {
      currentJobId = null;
    }
    if (streamJobId === msg.jobId) {
      clearStreamState();
    }
    return;
  }

  if (msg.type === "continue") {
    if (msg.jobId === streamJobId && waitingForContinue && streamHandler) {
      waitingForContinue = false;
      try {
        streamHandler(msg.jobId);
      } catch (err) {
        if (!isCancelled(msg.jobId)) {
          send({ type: "error", jobId: msg.jobId, message: String(err) });
        }
      }
    }
    return;
  }

  if (msg.type === "compute") {
    // Cancel any previous stream
    clearStreamState();
    currentJobId = msg.jobId;
    try {
      handleCompute(msg);
    } catch (err) {
      if (!isCancelled(msg.jobId)) {
        send({ type: "error", jobId: msg.jobId, message: String(err) });
      }
    }
  }
};

function handleCompute(req: ComputeRequest): void {
  const { systemId, viewId } = req;

  switch (systemId) {
    case "logistic":
      if (viewId === "bifurcation") handleBifurcation(req);
      else if (viewId === "cobweb") handleCobweb(req);
      break;
    case "lorenz":
      handleLorenz(req);
      break;
    case "julia":
      handleJulia(req);
      break;
    default:
      send({ type: "error", jobId: req.jobId, message: `Unknown system: ${systemId}` });
  }
}

// ============================================================
// Logistic Map — Bifurcation (Progressive Densification)
// ============================================================

interface BifurcationStreamState {
  type: "bifurcation";
  renderMode: string;
  paletteId: string;
  charsetId: string;
  w: number;
  h: number;
  rMin: number;
  rMax: number;
  x0: number;
  samplesPerChunk: number;
  /** Accumulated density across all chunks */
  density: Uint32Array;
  /** Current x-value per r-column (continuing iteration state) */
  xValues: Float64Array;
  /** Total samples accumulated so far */
  totalSamples: number;
  width: number;
  height: number;
}

function handleBifurcation(req: ComputeRequest): void {
  const { jobId, renderMode, paletteId, charsetId, params, width, height } = req;

  const w = Math.max(1, Math.ceil(width));
  const h = Math.max(1, Math.ceil(height));
  const rMin = Number(params["rMin"]) || 2.5;
  const rMax = Number(params["rMax"]) || 4.0;
  const warmup = Number(params["warmup"]) || 300;
  const x0 = Number(params["x0"]) || 0.5;
  const samplesPerChunk = Number(params["samples"]) || 500;

  // Initialize: warmup all r-columns and store their x-values
  const rStep = (rMax - rMin) / w;
  const xValues = new Float64Array(w);
  for (let ri = 0; ri < w; ri++) {
    const r = rMin + ri * rStep;
    let x = x0;
    for (let i = 0; i < warmup; i++) {
      x = r * x * (1 - x);
    }
    xValues[ri] = x;
  }

  const density = new Uint32Array(w * h);

  // Store stream state
  const state: BifurcationStreamState = {
    type: "bifurcation",
    renderMode, paletteId, charsetId,
    w, h, rMin, rMax, x0,
    samplesPerChunk,
    density,
    xValues,
    totalSamples: 0,
    width, height,
  };

  streamState = state as unknown as Record<string, unknown>;
  streamJobId = jobId;
  streamHandler = continueBifurcation;

  // Compute first chunk
  continueBifurcation(jobId);
}

function continueBifurcation(jobId: JobId): void {
  if (isCancelled(jobId)) return;
  const state = streamState as unknown as BifurcationStreamState;
  if (!state || state.type !== "bifurcation") return;

  const { w, h, rMin, rMax, samplesPerChunk, density, xValues } = state;
  const rStep = (rMax - rMin) / w;

  // Compute one chunk of samples for all r-columns
  for (let ri = 0; ri < w; ri++) {
    const r = rMin + ri * rStep;
    let x = xValues[ri]!;

    for (let i = 0; i < samplesPerChunk; i++) {
      x = r * x * (1 - x);
      const bin = Math.floor(x * h);
      if (bin >= 0 && bin < h) {
        density[ri * h + bin]!++;
      }
    }
    xValues[ri] = x;
  }

  state.totalSamples += samplesPerChunk;

  if (isCancelled(jobId)) return;

  // Normalize and send results
  const normalized = normalizeHistogramLog(density);

  if (state.renderMode === "ascii") {
    const asciiW = Math.min(160, Math.max(40, Math.floor(state.width / 8)));
    const asciiH = Math.min(80, Math.max(20, Math.floor(state.height / 16)));

    // Downsample normalized to ASCII size and flip Y
    const downsampled = new Float64Array(asciiW * asciiH);
    for (let ay = 0; ay < asciiH; ay++) {
      for (let ax = 0; ax < asciiW; ax++) {
        const srcX = Math.floor((ax / asciiW) * w);
        const srcY = h - 1 - Math.floor((ay / asciiH) * h);
        downsampled[ay * asciiW + ax] = normalized[srcX * h + srcY]!;
      }
    }

    const lines = intensityGridToAscii(downsampled, asciiW, asciiH, state.charsetId);
    const intBuf = downsampled.buffer as ArrayBuffer;
    send(
      { type: "asciiFrame", jobId, lines, cols: asciiW, rows: asciiH, intensities: intBuf },
      [intBuf]
    );
  } else {
    const palette = getPalette(state.paletteId);
    const tileSize = 128;

    for (let ty = 0; ty < h; ty += tileSize) {
      for (let tx = 0; tx < w; tx += tileSize) {
        if (isCancelled(jobId)) return;

        const tw = Math.min(tileSize, w - tx);
        const th = Math.min(tileSize, h - ty);
        const pixels = new ArrayBuffer(tw * th * 4);
        const rgba = new Uint8ClampedArray(pixels);

        for (let py = 0; py < th; py++) {
          for (let px = 0; px < tw; px++) {
            // Flip Y: canvas row 0 is top, but y=0 should be bottom
            const srcY = h - 1 - (ty + py);
            const t = normalized[(tx + px) * h + srcY]!;
            const [r, g, b, a] = palette.colorFn(t);
            const idx = (py * tw + px) * 4;
            rgba[idx] = r;
            rgba[idx + 1] = g;
            rgba[idx + 2] = b;
            rgba[idx + 3] = a;
          }
        }

        send(
          { type: "tile", jobId, x: tx, y: ty, width: tw, height: th, pixels, effectiveWidth: w, effectiveHeight: h },
          [pixels]
        );
      }
    }
  }

  sendChunkReady(jobId);
}

// ============================================================
// Logistic Map — Cobweb (Step-by-step Animation)
// ============================================================

interface CobwebStreamState {
  type: "cobweb";
  r: number;
  x: number;
  currentStep: number;
  maxSteps: number;
  pathPoints: number[];
  parabolaCoords: Float64Array;
}

function handleCobweb(req: ComputeRequest): void {
  const { jobId, params } = req;
  const r = Number(params["r"]) || 3.57;
  const x0 = Number(params["x0"]) || 0.5;

  // Compute parabola (static, sent with every update)
  const parabolaN = 256;
  const parabola = new Float64Array(parabolaN * 2);
  for (let i = 0; i < parabolaN; i++) {
    const xp = i / (parabolaN - 1);
    parabola[i * 2] = xp;
    parabola[i * 2 + 1] = r * xp * (1 - xp);
  }

  const state: CobwebStreamState = {
    type: "cobweb",
    r,
    x: x0,
    currentStep: 0,
    maxSteps: 200,
    pathPoints: [x0, 0], // start on x-axis
    parabolaCoords: parabola,
  };

  streamState = state as unknown as Record<string, unknown>;
  streamJobId = jobId;
  streamHandler = continueCobweb;

  // Send first frame (just the starting point + parabola)
  continueCobweb(jobId);
}

function continueCobweb(jobId: JobId): void {
  if (isCancelled(jobId)) return;
  const state = streamState as unknown as CobwebStreamState;
  if (!state || state.type !== "cobweb") return;

  // Compute one cobweb step (if not at max)
  if (state.currentStep < state.maxSteps) {
    const y = state.r * state.x * (1 - state.x);
    state.pathPoints.push(state.x, y);  // vertical to parabola
    state.pathPoints.push(y, y);        // horizontal to diagonal
    state.x = y;
    state.currentStep++;
  }
  // Even after max steps, keep sending chunk_ready so pause/resume works

  // Send cobweb data
  const path = new Float64Array(state.pathPoints);
  // Clone parabola since we send it every time
  const parabola = new Float64Array(state.parabolaCoords);
  const parabolaBuf = parabola.buffer as ArrayBuffer;
  const pathBuf = path.buffer as ArrayBuffer;

  send(
    {
      type: "cobweb",
      jobId,
      parabolaCoords: parabolaBuf,
      iterationCoords: pathBuf,
      identityLine: [0, 0, 1, 1],
    },
    [parabolaBuf, pathBuf]
  );

  sendChunkReady(jobId);
}

// ============================================================
// Lorenz Attractor (Streaming Chunks)
// ============================================================

interface LorenzStreamState {
  type: "lorenz";
  sigma: number;
  rho: number;
  beta: number;
  dt: number;
  stepsPerFrame: number;
  projection: string;
  doCompare: boolean;
  renderMode: string;
  charsetId: string;
  width: number;
  height: number;
  state1: [number, number, number];
  state2: [number, number, number];
  chunkIndex: number;
}

function handleLorenz(req: ComputeRequest): void {
  const { jobId, viewId, params, renderMode, charsetId, width, height } = req;
  const sigma = Number(params["sigma"]) || 10;
  const rho = Number(params["rho"]) || 28;
  const beta = Number(params["beta"]) || 2.667;
  const dt = Number(params["dt"]) || 0.005;
  const stepsPerFrame = Number(params["stepsPerFrame"]) || 300;
  const projection = String(params["projection"] || "xz");
  const doCompare = viewId === "compare" || Boolean(params["compare"]);
  const delta = Number(params["delta"]) || 0.001;

  const state: LorenzStreamState = {
    type: "lorenz",
    sigma, rho, beta, dt, stepsPerFrame, projection,
    doCompare, renderMode, charsetId,
    width, height,
    state1: [1, 1, 1],
    state2: [1 + delta, 1, 1],
    chunkIndex: 0,
  };

  streamState = state as unknown as Record<string, unknown>;
  streamJobId = jobId;
  streamHandler = continueLorenz;

  // Compute first chunk
  continueLorenz(jobId);
}

function continueLorenz(jobId: JobId): void {
  if (isCancelled(jobId)) return;
  const state = streamState as unknown as LorenzStreamState;
  if (!state || state.type !== "lorenz") return;

  const { sigma, rho, beta, dt, stepsPerFrame, projection, doCompare } = state;

  // Compute chunk for trajectory 1
  const chunk1 = computeLorenzChunk(
    state.state1[0], state.state1[1], state.state1[2],
    sigma, rho, beta, dt, stepsPerFrame
  );
  state.state1 = chunk1.lastState;
  const proj1 = projectPoints(chunk1.points, projection);
  const buf1 = proj1.buffer as ArrayBuffer;
  send(
    { type: "points", jobId, coords: buf1, trajectoryIndex: 0, chunkIndex: state.chunkIndex },
    [buf1]
  );

  // Compare trajectory
  if (doCompare) {
    const chunk2 = computeLorenzChunk(
      state.state2[0], state.state2[1], state.state2[2],
      sigma, rho, beta, dt, stepsPerFrame
    );
    state.state2 = chunk2.lastState;
    const proj2 = projectPoints(chunk2.points, projection);
    const buf2 = proj2.buffer as ArrayBuffer;
    send(
      { type: "points", jobId, coords: buf2, trajectoryIndex: 1, chunkIndex: state.chunkIndex },
      [buf2]
    );
  }

  state.chunkIndex++;
  sendChunkReady(jobId);
}

// ============================================================
// Julia Set (Progressive Refinement)
// ============================================================

interface JuliaStreamState {
  type: "julia";
  renderMode: string;
  paletteId: string;
  charsetId: string;
  cr: number;
  ci: number;
  centerX: number;
  centerY: number;
  zoom: number;
  escapeRadius: number;
  targetMaxIter: number;
  currentMaxIter: number;
  iterStep: number;
  width: number;
  height: number;
}

function handleJulia(req: ComputeRequest): void {
  const { jobId, renderMode, paletteId, charsetId, params, width, height } = req;

  const cr = Number(params["cr"]) ?? -0.7269;
  const ci = Number(params["ci"]) ?? 0.1889;
  const centerX = Number(params["centerX"]) || 0;
  const centerY = Number(params["centerY"]) || 0;
  const zoom = Number(params["zoom"]) || 1;
  const escapeRadius = Number(params["escapeRadius"]) || 4;
  const targetMaxIter = Number(params["maxIter"]) || 200;

  const state: JuliaStreamState = {
    type: "julia",
    renderMode, paletteId, charsetId,
    cr, ci, centerX, centerY, zoom, escapeRadius,
    targetMaxIter,
    currentMaxIter: 25, // start low for progressive refinement
    iterStep: 25,
    width, height,
  };

  streamState = state as unknown as Record<string, unknown>;
  streamJobId = jobId;
  streamHandler = continueJulia;

  // Compute first pass
  continueJulia(jobId);
}

function continueJulia(jobId: JobId): void {
  if (isCancelled(jobId)) return;
  const state = streamState as unknown as JuliaStreamState;
  if (!state || state.type !== "julia") return;

  const { cr, ci, centerX, centerY, zoom, escapeRadius, currentMaxIter, width, height } = state;

  // Only recompute if we haven't reached target yet
  if (state.currentMaxIter <= state.targetMaxIter) {
    const w = width;
    const h = height;

    if (state.renderMode === "ascii") {
      const asciiW = Math.min(160, Math.max(40, Math.floor(width / 8)));
      const asciiH = Math.min(80, Math.max(20, Math.floor(height / 16)));

      const escapeData = computeJuliaTile(0, 0, asciiW, asciiH, asciiW, asciiH, cr, ci, centerX, centerY, zoom, currentMaxIter, escapeRadius);
      if (isCancelled(jobId)) return;

      const norm = new Float64Array(asciiW * asciiH);
      for (let i = 0; i < norm.length; i++) {
        const v = escapeData[i]!;
        norm[i] = v > 0 ? v / currentMaxIter : 0;
      }

      const lines = intensityGridToAscii(norm, asciiW, asciiH, state.charsetId);
      const intBuf = norm.buffer as ArrayBuffer;
      send(
        { type: "asciiFrame", jobId, lines, cols: asciiW, rows: asciiH, intensities: intBuf },
        [intBuf]
      );
    } else {
      const palette = getPalette(state.paletteId);
      const tileSize = 128;

      for (let ty = 0; ty < h; ty += tileSize) {
        for (let tx = 0; tx < w; tx += tileSize) {
          if (isCancelled(jobId)) return;

          const tw = Math.min(tileSize, w - tx);
          const th = Math.min(tileSize, h - ty);

          const escapeData = computeJuliaTile(
            tx, ty, tw, th, w, h,
            cr, ci, centerX, centerY, zoom, currentMaxIter, escapeRadius
          );

          const pixels = new ArrayBuffer(tw * th * 4);
          const rgba = new Uint8ClampedArray(pixels);

          for (let i = 0; i < tw * th; i++) {
            const v = escapeData[i]!;
            const t = v > 0 ? Math.min(v / currentMaxIter, 1) : 0;
            const [r, g, b, a] = palette.colorFn(t);
            rgba[i * 4] = r;
            rgba[i * 4 + 1] = g;
            rgba[i * 4 + 2] = b;
            rgba[i * 4 + 3] = a;
          }

          send(
            { type: "tile", jobId, x: tx, y: ty, width: tw, height: th, pixels, effectiveWidth: w, effectiveHeight: h },
            [pixels]
          );
        }
      }
    }

    // Increase maxIter for next pass
    state.currentMaxIter = Math.min(
      state.currentMaxIter + state.iterStep,
      state.targetMaxIter + state.iterStep // allow one pass at target
    );
  }

  // Always send chunk_ready to keep pause/resume working even after reaching max
  sendChunkReady(jobId);
}
