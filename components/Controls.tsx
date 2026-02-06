"use client";

/* Auto-generated control panel built from SystemDefinition.paramsSchema.
 * Renders sliders, checkboxes, and dropdowns based on param kind. */

import type {
  SystemDefinition,
  ParamSchema,
  NumberParam,
  BooleanParam,
  SelectParam,
  ParamValues,
} from "@/lib/types";
import { PALETTES } from "@/lib/render/palettes";
import { ASCII_CHARSETS } from "@/lib/constants";
import type { RenderMode } from "@/lib/types";

interface ControlsProps {
  system: SystemDefinition;
  params: ParamValues;
  onParamChange: (key: string, value: number | boolean | string) => void;
  onPreset: (params: ParamValues) => void;
  paletteId: string;
  onPaletteChange: (id: string) => void;
  charsetId: string;
  onCharsetChange: (id: string) => void;
  renderMode: RenderMode;
}

export function Controls({
  system,
  params,
  onParamChange,
  onPreset,
  paletteId,
  onPaletteChange,
  charsetId,
  onCharsetChange,
  renderMode,
}: ControlsProps) {
  return (
    <div>
      {/* Presets */}
      <div className="controls-section">
        <h3>Presets</h3>
        <div className="preset-grid">
          {system.presets.map((preset) => (
            <button
              key={preset.name}
              className="terminal-button"
              onClick={() => onPreset(preset.params)}
              title={preset.description}
            >
              [{preset.name}]
            </button>
          ))}
        </div>
      </div>

      {/* Parameters */}
      <div className="controls-section">
        <h3>Parameters</h3>
        {system.paramsSchema.map((schema) => (
          <ParamControl
            key={schema.key}
            schema={schema}
            value={params[schema.key] ?? schema.default}
            onChange={(v) => onParamChange(schema.key, v)}
          />
        ))}
      </div>

      {/* Render settings */}
      <div className="controls-section">
        <h3>Render</h3>
        {/* Palette selector — always visible (used for both pixel and colored ASCII) */}
        <div className="param-row">
          <label>Palette</label>
          <select
            className="terminal-select"
            value={paletteId}
            onChange={(e) => onPaletteChange(e.target.value)}
          >
            {PALETTES.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        {/* Charset selector — only in ASCII mode */}
        {renderMode === "ascii" && (
          <div className="param-row">
            <label>Charset</label>
            <select
              className="terminal-select"
              value={charsetId}
              onChange={(e) => onCharsetChange(e.target.value)}
            >
              {Object.keys(ASCII_CHARSETS).map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Individual param controls
// ============================================================

function ParamControl({
  schema,
  value,
  onChange,
}: {
  schema: ParamSchema;
  value: number | boolean | string;
  onChange: (v: number | boolean | string) => void;
}) {
  switch (schema.kind) {
    case "number":
      return <NumberControl schema={schema} value={Number(value)} onChange={onChange} />;
    case "boolean":
      return <BoolControl schema={schema} value={Boolean(value)} onChange={onChange} />;
    case "select":
      return <SelectControl schema={schema} value={String(value)} onChange={onChange} />;
  }
}

function NumberControl({
  schema,
  value,
  onChange,
}: {
  schema: NumberParam;
  value: number;
  onChange: (v: number) => void;
}) {
  // Determine decimal places from step
  const decimals = schema.step < 0.01 ? 4 : schema.step < 0.1 ? 3 : schema.step < 1 ? 2 : 0;

  return (
    <div className="param-row">
      <label title={schema.key}>{schema.label}</label>
      <input
        type="range"
        min={schema.min}
        max={schema.max}
        step={schema.step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="param-value">{value.toFixed(decimals)}</span>
    </div>
  );
}

function BoolControl({
  schema,
  value,
  onChange,
}: {
  schema: BooleanParam;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="param-checkbox">
      <input
        type="checkbox"
        id={`param-${schema.key}`}
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={`param-${schema.key}`}>{schema.label}</label>
    </div>
  );
}

function SelectControl({
  schema,
  value,
  onChange,
}: {
  schema: SelectParam;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="param-row">
      <label>{schema.label}</label>
      <select
        className="terminal-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {schema.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
