/* Histogram normalization for density-based renders */

/** Normalize a density histogram using log scaling.
 *  Maps raw counts to 0-1 range using log1p for better contrast. */
export function normalizeHistogramLog(counts: Uint32Array): Float64Array {
  const result = new Float64Array(counts.length);
  let maxLog = 0;

  for (let i = 0; i < counts.length; i++) {
    const c = counts[i]!;
    if (c > 0) {
      const v = Math.log1p(c);
      result[i] = v;
      if (v > maxLog) maxLog = v;
    }
  }

  if (maxLog > 0) {
    const invMax = 1 / maxLog;
    for (let i = 0; i < result.length; i++) {
      result[i]! *= invMax;
    }
  }

  return result;
}
