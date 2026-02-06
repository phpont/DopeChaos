/* Shared types for DopeChaos chaos visualizer */

// ============================================================
// Parameter Schema — drives auto-generated UI controls
// ============================================================

export interface NumberParam {
  key: string;
  label: string;
  kind: "number";
  min: number;
  max: number;
  step: number;
  default: number;
}

export interface BooleanParam {
  key: string;
  label: string;
  kind: "boolean";
  default: boolean;
}

export interface SelectParam {
  key: string;
  label: string;
  kind: "select";
  options: ReadonlyArray<{ value: string; label: string }>;
  default: string;
}

export type ParamSchema = NumberParam | BooleanParam | SelectParam;

export type ParamValues = Record<string, number | boolean | string>;

// ============================================================
// Views and Rendering
// ============================================================

export interface ViewDefinition {
  id: string;
  name: string;
  description: string;
  animated: boolean;
}

export type QualityLevel = "preview" | "refine";

export interface RenderSpec {
  resolutionDivisor: number;
  maxIterations: number;
  tileSize: number;
}

export type RenderMode = "pixel" | "ascii";

// ============================================================
// Presets
// ============================================================

export interface Preset {
  name: string;
  description: string;
  params: ParamValues;
}

// ============================================================
// System Definition — the core plugin contract
// ============================================================

export interface ExplainSection {
  heading: string;
  body: string;
}

export interface SystemDefinition {
  id: string;
  name: string;
  description: string;
  equations: string;
  references: ReadonlyArray<{ label: string; url: string }>;
  paramsSchema: ReadonlyArray<ParamSchema>;
  presets: ReadonlyArray<Preset>;
  views: ReadonlyArray<ViewDefinition>;
  renderSpec: Record<QualityLevel, RenderSpec>;
  explain: ReadonlyArray<ExplainSection>;
}

// ============================================================
// Color Palettes
// ============================================================

export interface PaletteEntry {
  id: string;
  name: string;
  colorFn: (t: number) => [number, number, number, number];
}

// ============================================================
// Worker Message Protocol
// ============================================================

export type JobId = string;

/* Main thread → Worker */

export interface ComputeRequest {
  type: "compute";
  jobId: JobId;
  systemId: string;
  viewId: string;
  quality: QualityLevel;
  renderMode: RenderMode;
  paletteId: string;
  charsetId: string;
  params: ParamValues;
  width: number;
  height: number;
}

export interface CancelRequest {
  type: "cancel";
  jobId: JobId;
}

export interface ContinueRequest {
  type: "continue";
  jobId: JobId;
}

export type WorkerRequest = ComputeRequest | CancelRequest | ContinueRequest;

/* Worker → Main thread */

export interface TileResponse {
  type: "tile";
  jobId: JobId;
  x: number;
  y: number;
  width: number;
  height: number;
  pixels: ArrayBuffer;
  /** The total effective canvas dimensions (may be smaller than actual canvas in preview) */
  effectiveWidth: number;
  effectiveHeight: number;
  /** Optional intensity data for colored ASCII overlay (Float64Array of 0-1 values) */
  asciiIntensities?: ArrayBuffer;
}

export interface AsciiFrameResponse {
  type: "asciiFrame";
  jobId: JobId;
  lines: string[];
  cols: number;
  rows: number;
  /** Intensity data for colored ASCII (Float64Array of 0-1 values, cols*rows) */
  intensities: ArrayBuffer;
}

export interface PointsResponse {
  type: "points";
  jobId: JobId;
  coords: ArrayBuffer;
  trajectoryIndex: number;
  chunkIndex: number;
}

export interface CobwebResponse {
  type: "cobweb";
  jobId: JobId;
  parabolaCoords: ArrayBuffer;
  iterationCoords: ArrayBuffer;
  identityLine: [number, number, number, number];
}

export interface LorenzAsciiResponse {
  type: "lorenzAscii";
  jobId: JobId;
  lines: string[];
  cols: number;
  rows: number;
  trajectoryIndex: number;
  /** Intensity data for colored ASCII (Float64Array of 0-1 values, cols*rows) */
  intensities: ArrayBuffer;
}

export interface ProgressResponse {
  type: "progress";
  jobId: JobId;
  progress: number;
}

export interface CompleteResponse {
  type: "complete";
  jobId: JobId;
}

export interface ChunkReadyResponse {
  type: "chunk_ready";
  jobId: JobId;
}

export interface ErrorResponse {
  type: "error";
  jobId: JobId;
  message: string;
}

export type WorkerResponse =
  | TileResponse
  | AsciiFrameResponse
  | PointsResponse
  | CobwebResponse
  | LorenzAsciiResponse
  | ProgressResponse
  | CompleteResponse
  | ChunkReadyResponse
  | ErrorResponse;
