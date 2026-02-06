"use client";

/* Main visualization component.
 * Manages canvas/ASCII output, worker communication, the rAF animation loop,
 * resize handling, universal streaming (chunk_ready/continue), mouse interaction,
 * palette-based coloring for all modes, and colored ASCII rendering. */

import { useRef, useEffect, useCallback, useState } from "react";
import type {
  SystemDefinition,
  ViewDefinition,
  RenderMode,
  WorkerResponse,
  ParamValues,
  CobwebResponse,
} from "@/lib/types";
import { useWorker } from "@/lib/useWorker";
import { getPalette } from "@/lib/render/palettes";
import { intensityGridToAscii } from "@/lib/render/ascii";

interface ViewerProps {
  system: SystemDefinition;
  view: ViewDefinition;
  params: ParamValues;
  renderMode: RenderMode;
  paletteId: string;
  charsetId: string;
  isRunning: boolean;
}

export function Viewer({
  system,
  view,
  params,
  renderMode,
  paletteId,
  charsetId,
  isRunning,
}: ViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const sizeRef = useRef({ width: 800, height: 600 });
  const [, setProgressVisible] = useState(false);

  // Lorenz point accumulation for pixel mode rAF drawing
  const pointsRef = useRef<{ traj0: Float64Array[]; traj1: Float64Array[] }>({
    traj0: [],
    traj1: [],
  });
  const rafRef = useRef<number>(0);
  const lorenzBoundsRef = useRef({ minX: -25, maxX: 25, minY: 0, maxY: 55 });

  // Cobweb data
  const cobwebRef = useRef<CobwebResponse | null>(null);

  // ASCII frame accumulator + intensities for colored rendering
  const asciiLinesRef = useRef<string[]>([]);
  const asciiIntensitiesRef = useRef<Float64Array | null>(null);

  // Julia pan/zoom interaction state
  const dragRef = useRef<{ startX: number; startY: number; startCenterX: number; startCenterY: number } | null>(null);
  const onParamChangeRef = useRef<((key: string, value: number) => void) | null>(null);

  // Streaming: track isRunning via ref for use in callbacks (avoid stale closures)
  const isRunningRef = useRef(isRunning);
  isRunningRef.current = isRunning;

  // Track current paletteId via ref for rAF loop
  const paletteIdRef = useRef(paletteId);
  paletteIdRef.current = paletteId;

  // Trail length for Lorenz
  const trailLengthRef = useRef(8000);
  trailLengthRef.current = Number(params["trailLength"]) || 8000;

  // Ref for requestContinue to avoid stale closures
  const requestContinueRef = useRef<((jobId: string) => void) | null>(null);

  const handleWorkerMessage = useCallback(
    (msg: WorkerResponse) => {
      switch (msg.type) {
        case "tile": {
          if (renderMode !== "pixel") return;
          const canvas = canvasRef.current;
          if (!canvas) return;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          const imageData = new ImageData(
            new Uint8ClampedArray(msg.pixels),
            msg.width,
            msg.height
          );

          // Check if we need to scale (preview mode renders at lower resolution)
          const ew = msg.effectiveWidth;
          const eh = msg.effectiveHeight;
          if (ew < canvas.width || eh < canvas.height) {
            const scaleX = canvas.width / ew;
            const scaleY = canvas.height / eh;
            const tmpCanvas = new OffscreenCanvas(msg.width, msg.height);
            const tmpCtx = tmpCanvas.getContext("2d")!;
            tmpCtx.putImageData(imageData, 0, 0);
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(
              tmpCanvas,
              0, 0, msg.width, msg.height,
              msg.x * scaleX, msg.y * scaleY,
              msg.width * scaleX, msg.height * scaleY
            );
          } else {
            ctx.putImageData(imageData, msg.x, msg.y);
          }
          break;
        }

        case "asciiFrame": {
          asciiLinesRef.current = msg.lines;
          if (msg.intensities) {
            asciiIntensitiesRef.current = new Float64Array(msg.intensities);
          }
          renderColoredAscii(msg.lines, msg.cols, msg.intensities ? new Float64Array(msg.intensities) : null);
          break;
        }

        case "lorenzAscii": {
          if (msg.trajectoryIndex === 0) {
            asciiLinesRef.current = msg.lines;
            if (msg.intensities) {
              asciiIntensitiesRef.current = new Float64Array(msg.intensities);
            }
            renderColoredAscii(msg.lines, msg.cols, msg.intensities ? new Float64Array(msg.intensities) : null);
          }
          break;
        }

        case "points": {
          const coords = new Float64Array(msg.coords);
          if (msg.trajectoryIndex === 0) {
            pointsRef.current.traj0.push(coords);
          } else {
            pointsRef.current.traj1.push(coords);
          }
          // Update bounds
          updateLorenzBounds(coords);
          // Trim trail if needed
          trimTrail(pointsRef.current.traj0, trailLengthRef.current);
          trimTrail(pointsRef.current.traj1, trailLengthRef.current);
          break;
        }

        case "cobweb": {
          cobwebRef.current = msg;
          drawCobweb(msg);
          break;
        }

        case "chunk_ready": {
          // Universal streaming: if running, request next chunk
          if (isRunningRef.current && requestContinueRef.current) {
            requestContinueRef.current(msg.jobId);
          }
          break;
        }

        case "progress": {
          if (progressRef.current) {
            progressRef.current.style.width = `${msg.progress * 100}%`;
          }
          break;
        }

        case "complete": {
          setProgressVisible(false);
          break;
        }

        case "error": {
          console.error("[Worker]", msg.message);
          break;
        }
      }
    },
    [renderMode]
  );

  const { submit, cancel, requestContinue, currentJobRef } = useWorker(handleWorkerMessage);
  requestContinueRef.current = requestContinue;

  // ============================================================
  // Colored ASCII rendering helper
  // ============================================================

  function renderColoredAscii(lines: string[], cols: number, intensities: Float64Array | null) {
    const pre = preRef.current;
    if (!pre) return;

    if (!lines || lines.length === 0) {
      pre.textContent = "";
      return;
    }

    if (!intensities) {
      pre.textContent = lines.join("\n");
      return;
    }

    const palette = getPalette(paletteIdRef.current);
    const parts: string[] = [];

    function escapeChar(ch: string): string {
      if (ch === "<") return "&lt;";
      if (ch === ">") return "&gt;";
      if (ch === "&") return "&amp;";
      return ch;
    }

    for (let row = 0; row < lines.length; row++) {
      const line = lines[row];
      if (!line) continue;
      for (let col = 0; col < line.length; col++) {
        const ch = line[col] ?? " ";
        const idx = row * cols + col;
        const intensity = idx < intensities.length ? (intensities[idx] ?? 0) : 0;

        if (intensity > 0.01) {
          const [r, g, b] = palette.colorFn(intensity);
          parts.push(`<span style="color:rgb(${r},${g},${b})">${escapeChar(ch)}</span>`);
        } else {
          parts.push(escapeChar(ch));
        }
      }
      if (row < lines.length - 1) parts.push("\n");
    }

    pre.innerHTML = parts.join("");
  }

  // ============================================================
  // Submit computation
  // ============================================================

  const submitComputation = useCallback(
    () => {
      const { width, height } = sizeRef.current;
      if (width <= 0 || height <= 0) return;

      setProgressVisible(true);
      if (progressRef.current) {
        progressRef.current.style.width = "0%";
      }

      // Clear previous data
      if (system.id === "lorenz") {
        pointsRef.current = { traj0: [], traj1: [] };
        lorenzBoundsRef.current = { minX: -25, maxX: 25, minY: 0, maxY: 55 };
      }

      submit({
        systemId: system.id,
        viewId: view.id,
        quality: "refine", // streaming replaces preview/refine cycle
        renderMode,
        paletteId,
        charsetId,
        params,
        width,
        height,
      });
    },
    [system.id, view.id, params, renderMode, paletteId, charsetId, submit]
  );

  // Re-submit when deps change
  useEffect(() => {
    // Clear canvas for new render
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    submitComputation();

    return () => {
      cancel();
    };
  }, [submitComputation, cancel]);

  // ============================================================
  // Resume streaming when isRunning changes from false to true
  // ============================================================

  const prevRunningRef = useRef(isRunning);
  useEffect(() => {
    if (isRunning && !prevRunningRef.current) {
      // User pressed RUN after pause — resume streaming
      const jobId = currentJobRef.current;
      if (jobId) {
        requestContinue(jobId);
      }
    }
    prevRunningRef.current = isRunning;
  }, [isRunning, requestContinue, currentJobRef]);

  // ============================================================
  // Resize handling
  // ============================================================

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleResize = () => {
      const rect = container.getBoundingClientRect();
      const w = Math.floor(rect.width);
      const h = Math.floor(rect.height);
      if (w <= 0 || h <= 0) return;

      sizeRef.current = { width: w, height: h };

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.imageSmoothingEnabled = false;
        }
      }
    };

    const ro = new ResizeObserver(handleResize);
    ro.observe(container);
    handleResize();

    return () => ro.disconnect();
  }, []);

  // ============================================================
  // rAF loop for Lorenz trajectory drawing (pixel mode)
  // ============================================================

  useEffect(() => {
    if (system.id !== "lorenz" || renderMode !== "pixel") return;

    let running = true;

    function draw() {
      if (!running) return;

      const canvas = canvasRef.current;
      if (!canvas) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const w = canvas.width;
      const h = canvas.height;
      const bounds = lorenzBoundsRef.current;

      // Clear with slight fade for trail effect
      ctx.fillStyle = "rgba(10, 10, 10, 0.08)";
      ctx.fillRect(0, 0, w, h);

      // Map world coords to canvas
      const rangeX = (bounds.maxX - bounds.minX) || 1;
      const rangeY = (bounds.maxY - bounds.minY) || 1;
      const padX = rangeX * 0.1;
      const padY = rangeY * 0.1;
      const mX = bounds.minX - padX;
      const rX = rangeX + 2 * padX;
      const mY = bounds.minY - padY;
      const rY = rangeY + 2 * padY;

      function toCanvas(x: number, y: number): [number, number] {
        return [
          ((x - mX) / rX) * w,
          h - ((y - mY) / rY) * h,
        ];
      }

      const palette = getPalette(paletteIdRef.current);

      // Draw trajectory 0 with palette gradient
      drawTrajectory(ctx, pointsRef.current.traj0, toCanvas, palette, 0, 1);
      // Draw trajectory 1 (compare mode) with palette offset
      if (pointsRef.current.traj1.length > 0) {
        drawTrajectory(ctx, pointsRef.current.traj1, toCanvas, palette, 0.5, 1);
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [system.id, renderMode, paletteId]);

  // ============================================================
  // rAF loop for Lorenz trajectory drawing (ASCII mode)
  // ============================================================

  useEffect(() => {
    if (system.id !== "lorenz" || renderMode !== "ascii") return;

    let running = true;
    let frameCount = 0;
    const FRAME_SKIP = 3; // Update every N frames

    function drawAscii() {
      if (!running) return;

      // Throttle DOM writes
      frameCount++;
      if (frameCount % FRAME_SKIP !== 0) {
        rafRef.current = requestAnimationFrame(drawAscii);
        return;
      }

      const pre = preRef.current;
      if (!pre) {
        rafRef.current = requestAnimationFrame(drawAscii);
        return;
      }

      const chunks = pointsRef.current.traj0;
      if (chunks.length === 0) {
        pre.textContent = "Waiting for data...";
        rafRef.current = requestAnimationFrame(drawAscii);
        return;
      }

      const { width, height } = sizeRef.current;
      if (width <= 0 || height <= 0) {
        rafRef.current = requestAnimationFrame(drawAscii);
        return;
      }

      const asciiW = Math.min(160, Math.max(40, Math.floor(width / 8)));
      const asciiH = Math.min(80, Math.max(20, Math.floor(height / 16)));

      // Use bounds from accumulated points
      const bounds = lorenzBoundsRef.current;
      const rangeX = (bounds.maxX - bounds.minX) || 1;
      const rangeY = (bounds.maxY - bounds.minY) || 1;
      const padX = rangeX * 0.05 || 1;
      const padY = rangeY * 0.05 || 1;
      const minX = bounds.minX - padX;
      const maxX = bounds.maxX + padX;
      const minY = bounds.minY - padY;
      const maxY = bounds.maxY + padY;
      const rX = (maxX - minX) || 1;
      const rY = (maxY - minY) || 1;

      // Rasterize to density grid
      const density = new Uint32Array(asciiW * asciiH);
      for (const chunk of chunks) {
        for (let i = 0; i < chunk.length; i += 2) {
          const x = chunk[i];
          const y = chunk[i + 1];
          if (x === undefined || y === undefined) continue;
          const col = Math.floor(((x - minX) / rX) * (asciiW - 1));
          const row = Math.floor(((maxY - y) / rY) * (asciiH - 1));
          if (col >= 0 && col < asciiW && row >= 0 && row < asciiH) {
            density[row * asciiW + col]++;
          }
        }
      }

      // Normalize via log scaling
      let maxD = 0;
      for (let i = 0; i < density.length; i++) {
        const d = density[i];
        if (d !== undefined && d > maxD) maxD = d;
      }

      const norm = new Float64Array(density.length);
      if (maxD > 0) {
        const logMax = Math.log1p(maxD);
        for (let i = 0; i < density.length; i++) {
          norm[i] = Math.log1p(density[i] ?? 0) / logMax;
        }
      }

      const lines = intensityGridToAscii(norm, asciiW, asciiH, charsetId);
      renderColoredAscii(lines, asciiW, norm);

      rafRef.current = requestAnimationFrame(drawAscii);
    }

    rafRef.current = requestAnimationFrame(drawAscii);

    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [system.id, renderMode, paletteId, charsetId]);

  // ============================================================
  // Cobweb drawing (with palette colors)
  // ============================================================

  function drawCobweb(data: CobwebResponse) {
    const canvas = canvasRef.current;
    if (!canvas || renderMode !== "pixel") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const pad = 40;
    const plotW = w - 2 * pad;
    const plotH = h - 2 * pad;
    const palette = getPalette(paletteIdRef.current);

    function toCanvas(x: number, y: number): [number, number] {
      return [pad + x * plotW, h - pad - y * plotH];
    }

    // Background grid
    ctx.strokeStyle = "rgba(51, 51, 51, 0.5)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 10; i++) {
      const v = i / 10;
      const [x1, y1] = toCanvas(v, 0);
      const [x2, y2] = toCanvas(v, 1);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [x3, y3] = toCanvas(0, v);
      const [x4, y4] = toCanvas(1, v);
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }

    // Identity line y=x
    ctx.strokeStyle = "rgba(100, 100, 100, 0.8)";
    ctx.lineWidth = 1;
    const id = data.identityLine;
    const [ix1, iy1] = toCanvas(id[0], id[1]);
    const [ix2, iy2] = toCanvas(id[2], id[3]);
    ctx.beginPath();
    ctx.moveTo(ix1, iy1);
    ctx.lineTo(ix2, iy2);
    ctx.stroke();

    // Parabola — use palette color at t=0.3
    const parabola = new Float64Array(data.parabolaCoords);
    const [pr, pg, pb] = palette.colorFn(0.3);
    ctx.strokeStyle = `rgba(${pr}, ${pg}, ${pb}, 0.9)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < parabola.length / 2; i++) {
      const [cx, cy] = toCanvas(parabola[i * 2]!, parabola[i * 2 + 1]!);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Iteration path — use palette color at t=0.8
    const path = new Float64Array(data.iterationCoords);
    const [ir, ig, ib] = palette.colorFn(0.8);
    ctx.strokeStyle = `rgba(${ir}, ${ig}, ${ib}, 0.8)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < path.length / 2; i++) {
      const [cx, cy] = toCanvas(path[i * 2]!, path[i * 2 + 1]!);
      if (i === 0) ctx.moveTo(cx, cy);
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = "#555";
    ctx.font = "11px monospace";
    ctx.fillText("0", pad - 12, h - pad + 14);
    ctx.fillText("1", w - pad - 4, h - pad + 14);
    ctx.fillText("1", pad - 12, pad + 4);
  }

  // ============================================================
  // Julia mouse interaction (pan & zoom)
  // ============================================================

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (system.id !== "julia" || renderMode !== "pixel") return;
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startCenterX: Number(params["centerX"]) || 0,
        startCenterY: Number(params["centerY"]) || 0,
      };
    },
    [system.id, renderMode, params]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragRef.current || system.id !== "julia") return;
      const { width, height } = sizeRef.current;
      const zoom = Number(params["zoom"]) || 1;
      const aspect = width / height;
      const rangeX = (2 * aspect) / zoom;
      const rangeY = 2 / zoom;
      const dx = ((e.clientX - dragRef.current.startX) / width) * rangeX;
      const dy = ((e.clientY - dragRef.current.startY) / height) * rangeY;

      onParamChangeRef.current?.("centerX", dragRef.current.startCenterX - dx);
      onParamChangeRef.current?.("centerY", dragRef.current.startCenterY + dy);
    },
    [system.id, params]
  );

  const handleMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (system.id !== "julia" || renderMode !== "pixel") return;
      e.preventDefault();
      const zoom = Number(params["zoom"]) || 1;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.max(0.1, Math.min(1000, zoom * factor));
      onParamChangeRef.current?.("zoom", newZoom);
    },
    [system.id, renderMode, params]
  );

  // ============================================================
  // Helpers
  // ============================================================

  function updateLorenzBounds(coords: Float64Array) {
    const bounds = lorenzBoundsRef.current;
    for (let i = 0; i < coords.length; i += 2) {
      const x = coords[i]!;
      const y = coords[i + 1]!;
      if (x < bounds.minX) bounds.minX = x;
      if (x > bounds.maxX) bounds.maxX = x;
      if (y < bounds.minY) bounds.minY = y;
      if (y > bounds.maxY) bounds.maxY = y;
    }
  }

  return (
    <div ref={containerRef} className="viewer-container">
      <div
        ref={progressRef}
        className="viewer-progress"
        style={{ width: "0%" }}
      />
      <canvas
        ref={canvasRef}
        className="viewer-canvas"
        style={{ display: renderMode === "pixel" ? "block" : "none" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      />
      <pre
        ref={preRef}
        className="viewer-ascii"
        style={{ display: renderMode === "ascii" ? "block" : "none" }}
      />
    </div>
  );
}

// ============================================================
// Trail trimming for Lorenz
// ============================================================

function trimTrail(chunks: Float64Array[], maxPoints: number): void {
  let totalPoints = 0;
  for (const chunk of chunks) {
    totalPoints += chunk.length / 2;
  }

  while (totalPoints > maxPoints && chunks.length > 1) {
    const removed = chunks.shift()!;
    totalPoints -= removed.length / 2;
  }
}

// ============================================================
// Draw Lorenz trajectory with palette gradient
// ============================================================

function drawTrajectory(
  ctx: CanvasRenderingContext2D,
  chunks: Float64Array[],
  toCanvas: (x: number, y: number) => [number, number],
  palette: ReturnType<typeof getPalette>,
  tOffset: number,
  lineWidth: number
) {
  if (chunks.length === 0) return;

  // Count total points
  let totalPoints = 0;
  for (const chunk of chunks) {
    totalPoints += chunk.length / 2;
  }
  if (totalPoints === 0) return;

  // Draw in batches with gradient color
  const batchSize = 50;
  let pointIndex = 0;
  let prevX: number | undefined;
  let prevY: number | undefined;

  ctx.lineWidth = lineWidth;

  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i += 2) {
      const [cx, cy] = toCanvas(chunk[i]!, chunk[i + 1]!);

      if (pointIndex % batchSize === 0 || prevX === undefined) {
        // Start new batch with updated color
        if (prevX !== undefined) {
          ctx.stroke();
        }
        const t = tOffset + (pointIndex / totalPoints) * 0.5; // use 0.5 range per trajectory
        const [r, g, b] = palette.colorFn(Math.min(t, 1));
        const alpha = 0.3 + 0.7 * (pointIndex / totalPoints); // fade in: old=dim, new=bright
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
        ctx.beginPath();
        if (prevX !== undefined) {
          ctx.moveTo(prevX, prevY!);
        } else {
          ctx.moveTo(cx, cy);
        }
      }

      ctx.lineTo(cx, cy);
      prevX = cx;
      prevY = cy;
      pointIndex++;
    }
  }

  if (prevX !== undefined) {
    ctx.stroke();
  }
}
