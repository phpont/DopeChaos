"use client";

/* Root client component — manages all application state and layout.
 * System selection, view switching, parameter management, mobile tabs. */

import { useState, useCallback, useMemo, useEffect } from "react";
import { getAllSystems, getSystem } from "@/lib/systems";
import type { RenderMode, ParamValues } from "@/lib/types";
import { Viewer } from "./Viewer";
import { Controls } from "./Controls";
import { ExplainPanel } from "./ExplainPanel";
import { AsciiLogo } from "./AsciiLogo";

type MobileTab = "view" | "controls" | "explain";

export function TerminalShell() {
  const allSystems = useMemo(() => getAllSystems(), []);

  const [systemId, setSystemId] = useState("logistic");
  const [viewId, setViewId] = useState("bifurcation");
  const [renderMode, setRenderMode] = useState<RenderMode>("pixel");
  const [paletteId, setPaletteId] = useState("phosphor");
  const [charsetId, setCharsetId] = useState("standard");
  const [isRunning, setIsRunning] = useState(true);
  const [mobileTab, setMobileTab] = useState<MobileTab>("view");
  const [params, setParams] = useState<ParamValues>(() => {
    const sys = getSystem("logistic");
    const defaults: ParamValues = {};
    for (const p of sys.paramsSchema) {
      defaults[p.key] = p.default;
    }
    return defaults;
  });

  const system = useMemo(() => getSystem(systemId), [systemId]);
  const currentView = useMemo(
    () => system.views.find((v) => v.id === viewId) ?? system.views[0]!,
    [system, viewId]
  );

  const handleSystemChange = useCallback(
    (newId: string) => {
      const newSys = getSystem(newId);
      setSystemId(newId);
      setViewId(newSys.views[0]!.id);
      setIsRunning(true);
      // Reset params to new system defaults
      const defaults: ParamValues = {};
      for (const p of newSys.paramsSchema) {
        defaults[p.key] = p.default;
      }
      setParams(defaults);
    },
    []
  );

  const handleViewChange = useCallback(
    (newViewId: string) => {
      setViewId(newViewId);
      setIsRunning(true);
    },
    []
  );

  const handleParamChange = useCallback((key: string, value: number | boolean | string) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handlePreset = useCallback((presetParams: ParamValues) => {
    setParams((prev) => ({ ...prev, ...presetParams }));
  }, []);

  const handleReset = useCallback(() => {
    const defaults: ParamValues = {};
    for (const p of system.paramsSchema) {
      defaults[p.key] = p.default;
    }
    setParams(defaults);
    setIsRunning(true);
  }, [system]);

  return (
    <div
      className="terminal-shell"
      data-tab={mobileTab}
    >
      {/* Header */}
      <header className="terminal-header">
        <AsciiLogo />
        <div className="terminal-header-controls">
          {/* System selector */}
          <select
            className="terminal-select"
            value={systemId}
            onChange={(e) => handleSystemChange(e.target.value)}
          >
            {allSystems.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* View selector */}
          <select
            className="terminal-select"
            value={viewId}
            onChange={(e) => handleViewChange(e.target.value)}
          >
            {system.views.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          {/* Render mode toggle */}
          <button
            className={`terminal-button ${renderMode === "pixel" ? "active" : ""}`}
            onClick={() => setRenderMode("pixel")}
          >
            [PIXEL]
          </button>
          <button
            className={`terminal-button ${renderMode === "ascii" ? "active" : ""}`}
            onClick={() => setRenderMode("ascii")}
          >
            [ASCII]
          </button>

          {/* Play/Pause (for animated views) */}
          {currentView.animated && (
            <button
              className="terminal-button"
              onClick={() => setIsRunning((r) => !r)}
            >
              [{isRunning ? "PAUSE" : "RUN"}]
            </button>
          )}

          {/* Reset */}
          <button className="terminal-button" onClick={handleReset}>
            [RESET]
          </button>
        </div>
      </header>

      {/* Body: sidebar + main */}
      <div className="terminal-body">
        <aside className="terminal-sidebar">
          <Controls
            system={system}
            params={params}
            onParamChange={handleParamChange}
            onPreset={handlePreset}
            paletteId={paletteId}
            onPaletteChange={setPaletteId}
            charsetId={charsetId}
            onCharsetChange={setCharsetId}
            renderMode={renderMode}
          />
          <ExplainPanel system={system} />
        </aside>

        <main className="terminal-main">
          <Viewer
            system={system}
            view={currentView}
            params={params}
            renderMode={renderMode}
            paletteId={paletteId}
            charsetId={charsetId}
            isRunning={isRunning}
          />
        </main>
      </div>

      {/* Mobile tab bar */}
      <nav className="terminal-tabbar">
        {(["view", "controls", "explain"] as const).map((tab) => (
          <button
            key={tab}
            className={mobileTab === tab ? "active" : ""}
            onClick={() => setMobileTab(tab)}
          >
            {tab.toUpperCase()}
          </button>
        ))}
      </nav>

      {/* Status bar */}
      <div className="terminal-status">
        <span>
          {system.name} &gt; {currentView.name} [{renderMode.toUpperCase()}]
        </span>
        <span>DopeChaos v1.0</span>
      </div>
    </div>
  );
}
