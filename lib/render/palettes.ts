/* Color palettes for pixel rendering */

import type { PaletteEntry } from "@/lib/types";

export const PALETTES: PaletteEntry[] = [
  {
    id: "mono",
    name: "Monochrome",
    colorFn: (t) => {
      const v = Math.floor(t * 255);
      return [v, v, v, 255];
    },
  },
  {
    id: "phosphor",
    name: "Phosphor",
    colorFn: (t) => {
      return [
        Math.floor(t * 30),
        Math.floor(t * 255),
        Math.floor(t * 65),
        255,
      ];
    },
  },
  {
    id: "amber",
    name: "Amber",
    colorFn: (t) => {
      return [
        Math.floor(t * 255),
        Math.floor(t * 176),
        Math.floor(t * 30),
        255,
      ];
    },
  },
  {
    id: "thermal",
    name: "Thermal",
    colorFn: (t) => {
      if (t < 0.33) {
        const s = t / 0.33;
        return [Math.floor(s * 255), 0, 0, 255];
      }
      if (t < 0.66) {
        const s = (t - 0.33) / 0.33;
        return [255, Math.floor(s * 255), 0, 255];
      }
      const s = (t - 0.66) / 0.34;
      return [255, 255, Math.floor(s * 255), 255];
    },
  },
  {
    id: "ice",
    name: "Ice",
    colorFn: (t) => {
      return [
        Math.floor(t * 100),
        Math.floor(t * 180),
        Math.floor(t * 255),
        255,
      ];
    },
  },
  {
    id: "neon",
    name: "Neon",
    colorFn: (t) => {
      const r = Math.floor(Math.sin(t * Math.PI * 2) * 127 + 128);
      const g = Math.floor(Math.sin(t * Math.PI * 2 + 2.094) * 127 + 128);
      const b = Math.floor(Math.sin(t * Math.PI * 2 + 4.189) * 127 + 128);
      return [r, g, b, 255];
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    colorFn: (t) => {
      if (t < 0.5) {
        const s = t / 0.5;
        return [Math.floor(s * 20), Math.floor(30 + s * 120), Math.floor(80 + s * 175), 255];
      }
      const s = (t - 0.5) / 0.5;
      return [Math.floor(20 + s * 200), Math.floor(150 + s * 105), Math.floor(255), 255];
    },
  },
  {
    id: "sunset",
    name: "Sunset",
    colorFn: (t) => {
      if (t < 0.33) {
        const s = t / 0.33;
        return [Math.floor(30 + s * 130), 0, Math.floor(80 + s * 50), 255];
      }
      if (t < 0.66) {
        const s = (t - 0.33) / 0.33;
        return [Math.floor(160 + s * 95), Math.floor(s * 80), Math.floor(130 - s * 130), 255];
      }
      const s = (t - 0.66) / 0.34;
      return [255, Math.floor(80 + s * 175), Math.floor(s * 50), 255];
    },
  },
  {
    id: "matrix",
    name: "Matrix",
    colorFn: (t) => {
      return [0, Math.floor(t * t * 255), Math.floor(t * 30), 255];
    },
  },
  {
    id: "plasma",
    name: "Plasma",
    colorFn: (t) => {
      const r = Math.floor(Math.sin(t * Math.PI * 0.95 + 0.2) * 127 + 128);
      const g = Math.floor(Math.sin(t * Math.PI * 1.1 + 1.8) * 127 + 128);
      const b = Math.floor(Math.sin(t * Math.PI * 1.3 + 4.0) * 127 + 128);
      return [r, g, b, 255];
    },
  },
  {
    id: "inferno",
    name: "Inferno",
    colorFn: (t) => {
      if (t < 0.25) {
        const s = t / 0.25;
        return [Math.floor(s * 120), 0, Math.floor(s * 30), 255];
      }
      if (t < 0.5) {
        const s = (t - 0.25) / 0.25;
        return [Math.floor(120 + s * 135), Math.floor(s * 60), Math.floor(30 - s * 30), 255];
      }
      if (t < 0.75) {
        const s = (t - 0.5) / 0.25;
        return [255, Math.floor(60 + s * 130), Math.floor(s * 20), 255];
      }
      const s = (t - 0.75) / 0.25;
      return [255, Math.floor(190 + s * 65), Math.floor(20 + s * 200), 255];
    },
  },
  {
    id: "grayscale_inv",
    name: "Grayscale Inv",
    colorFn: (t) => {
      const v = Math.floor((1 - t) * 255);
      return [v, v, v, 255];
    },
  },
];

export function getPalette(id: string): PaletteEntry {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0]!;
}
