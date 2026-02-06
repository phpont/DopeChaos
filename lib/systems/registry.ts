/* System plugin registry — all systems register here */

import type { SystemDefinition } from "@/lib/types";

const systems = new Map<string, SystemDefinition>();

export function registerSystem(def: SystemDefinition): void {
  if (systems.has(def.id)) {
    throw new Error(`System "${def.id}" is already registered.`);
  }
  systems.set(def.id, def);
}

export function getSystem(id: string): SystemDefinition {
  const sys = systems.get(id);
  if (!sys) throw new Error(`System "${id}" not found in registry.`);
  return sys;
}

export function getAllSystems(): SystemDefinition[] {
  return Array.from(systems.values());
}

export function getSystemIds(): string[] {
  return Array.from(systems.keys());
}
