"use client";

import type { SystemDefinition } from "@/lib/types";

interface ExplainPanelProps {
  system: SystemDefinition;
}

export function ExplainPanel({ system }: ExplainPanelProps) {
  return (
    <div className="explain-panel">
      <h2>{system.name}</h2>
      <p>{system.description}</p>

      <div className="explain-equations">
        <pre>{system.equations}</pre>
      </div>

      {system.explain.map((section, i) => (
        <div key={i}>
          <h3>{section.heading}</h3>
          <p>{section.body}</p>
        </div>
      ))}

      {system.references.length > 0 && (
        <div className="explain-references">
          <h3>References</h3>
          <ul>
            {system.references.map((ref, i) => (
              <li key={i}>
                <a href={ref.url} target="_blank" rel="noopener noreferrer">
                  {ref.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
