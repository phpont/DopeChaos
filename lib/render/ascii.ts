/* ASCII rendering utilities */

import { ASCII_CHARSETS } from "@/lib/constants";

/** Convert a normalized intensity (0-1) to an ASCII character */
export function intensityToChar(t: number, charset: string = "standard"): string {
  const chars = ASCII_CHARSETS[charset] ?? ASCII_CHARSETS["standard"]!;
  const idx = Math.min(Math.floor(Math.max(0, t) * chars.length), chars.length - 1);
  return chars[idx]!;
}

/** Convert a 2D grid of normalized intensities to ASCII string rows */
export function intensityGridToAscii(
  data: Float64Array,
  width: number,
  height: number,
  charset: string = "standard"
): string[] {
  const chars = ASCII_CHARSETS[charset] ?? ASCII_CHARSETS["standard"]!;
  const maxIdx = chars.length - 1;
  const rows: string[] = [];

  for (let y = 0; y < height; y++) {
    let row = "";
    for (let x = 0; x < width; x++) {
      const t = data[y * width + x] ?? 0;
      const idx = Math.min(Math.floor(Math.max(0, t) * chars.length), maxIdx);
      row += chars[idx]!;
    }
    rows.push(row);
  }

  return rows;
}
