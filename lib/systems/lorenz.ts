/* Lorenz Attractor: dx/dt = σ(y-x), dy/dt = x(ρ-z)-y, dz/dt = xy-βz
 * RK4 integration producing 3D trajectory chunks. */

import type { SystemDefinition } from "@/lib/types";

export const lorenzSystem: SystemDefinition = {
  id: "lorenz",
  name: "Lorenz Attractor",
  description:
    "A system of three coupled differential equations that produces the famous butterfly-shaped strange attractor, discovered by Edward Lorenz in 1963.",
  equations:
    "dx/dt = sigma * (y - x)\ndy/dt = x * (rho - z) - y\ndz/dt = x * y - beta * z",
  references: [
    { label: "Wikipedia: Lorenz system", url: "https://en.wikipedia.org/wiki/Lorenz_system" },
  ],
  paramsSchema: [
    { key: "sigma", label: "sigma", kind: "number", min: 0, max: 50, step: 0.1, default: 10 },
    { key: "rho", label: "rho", kind: "number", min: 0, max: 100, step: 0.1, default: 28 },
    { key: "beta", label: "beta", kind: "number", min: 0, max: 20, step: 0.01, default: 2.667 },
    { key: "dt", label: "dt", kind: "number", min: 0.001, max: 0.05, step: 0.001, default: 0.005 },
    { key: "stepsPerFrame", label: "Steps/Frame", kind: "number", min: 50, max: 2000, step: 50, default: 300 },
    { key: "projection", label: "Projection", kind: "select", options: [
      { value: "xz", label: "X-Z" },
      { value: "xy", label: "X-Y" },
      { value: "yz", label: "Y-Z" },
    ], default: "xz" },
    { key: "trailLength", label: "Trail Len", kind: "number", min: 500, max: 30000, step: 500, default: 8000 },
    { key: "compare", label: "Compare", kind: "boolean", default: false },
    { key: "delta", label: "Delta (cmp)", kind: "number", min: 0.0001, max: 1, step: 0.0001, default: 0.001 },
  ],
  presets: [
    { name: "Classic", description: "The standard Lorenz attractor", params: { sigma: 10, rho: 28, beta: 2.667 } },
    { name: "Tight Spiral", description: "Lower rho, tighter orbits", params: { sigma: 10, rho: 14, beta: 2.667 } },
    { name: "Wild Chaos", description: "High rho for fast, wide trajectories", params: { sigma: 10, rho: 99.96, beta: 2.667 } },
  ],
  views: [
    { id: "trajectory", name: "Trajectory", description: "Animated 2D projection of the 3D attractor path", animated: true },
    { id: "compare", name: "Compare", description: "Two nearby trajectories diverging — sensitivity to initial conditions", animated: true },
  ],
  renderSpec: {
    preview: { resolutionDivisor: 1, maxIterations: 5000, tileSize: 128 },
    refine: { resolutionDivisor: 1, maxIterations: 30000, tileSize: 128 },
  },
  explain: [
    {
      heading: "What is the Lorenz Attractor?",
      body: "A set of three coupled ODEs originally derived from atmospheric convection. For certain parameter values (sigma=10, rho=28, beta=8/3), the system never settles into a fixed point or periodic orbit — instead it traces out an infinitely long, non-repeating path confined to a fractal structure.",
    },
    {
      heading: "Parameters",
      body: "sigma (Prandtl number): coupling between x and y. rho (Rayleigh number): driving force — chaos appears above rho ≈ 24.74. beta: geometric factor. dt: integration time step (smaller = more accurate, slower).",
    },
    {
      heading: "Reading the Trajectory",
      body: "You see a 2D projection of the 3D path. The two lobes of the butterfly correspond to the two unstable fixed points the trajectory orbits around. The system switches unpredictably between lobes.",
    },
    {
      heading: "Compare Mode",
      body: "Two trajectories start almost identically (separated by 'delta'). They initially follow the same path, then rapidly diverge — a hallmark of chaos known as sensitive dependence on initial conditions.",
    },
  ],
};

// ============================================================
// Computation functions
// ============================================================

/** Single RK4 integration step for the Lorenz system */
function rk4Step(
  x: number, y: number, z: number,
  sigma: number, rho: number, beta: number,
  dt: number
): [number, number, number] {
  const dx1 = sigma * (y - x);
  const dy1 = x * (rho - z) - y;
  const dz1 = x * y - beta * z;

  const x2 = x + dx1 * dt * 0.5;
  const y2 = y + dy1 * dt * 0.5;
  const z2 = z + dz1 * dt * 0.5;
  const dx2 = sigma * (y2 - x2);
  const dy2 = x2 * (rho - z2) - y2;
  const dz2 = x2 * y2 - beta * z2;

  const x3 = x + dx2 * dt * 0.5;
  const y3 = y + dy2 * dt * 0.5;
  const z3 = z + dz2 * dt * 0.5;
  const dx3 = sigma * (y3 - x3);
  const dy3 = x3 * (rho - z3) - y3;
  const dz3 = x3 * y3 - beta * z3;

  const x4 = x + dx3 * dt;
  const y4 = y + dy3 * dt;
  const z4 = z + dz3 * dt;
  const dx4 = sigma * (y4 - x4);
  const dy4 = x4 * (rho - z4) - y4;
  const dz4 = x4 * y4 - beta * z4;

  return [
    x + (dx1 + 2 * dx2 + 2 * dx3 + dx4) * dt / 6,
    y + (dy1 + 2 * dy2 + 2 * dy3 + dy4) * dt / 6,
    z + (dz1 + 2 * dz2 + 2 * dz3 + dz4) * dt / 6,
  ];
}

/** Compute a chunk of Lorenz trajectory points via RK4.
 *  Returns Float64Array of [x0,y0,z0, x1,y1,z1, ...] and final state. */
export function computeLorenzChunk(
  startX: number, startY: number, startZ: number,
  sigma: number, rho: number, beta: number,
  dt: number,
  chunkSize: number
): { points: Float64Array; lastState: [number, number, number] } {
  const points = new Float64Array(chunkSize * 3);
  let x = startX, y = startY, z = startZ;

  for (let i = 0; i < chunkSize; i++) {
    [x, y, z] = rk4Step(x, y, z, sigma, rho, beta, dt);
    points[i * 3] = x;
    points[i * 3 + 1] = y;
    points[i * 3 + 2] = z;
  }

  return { points, lastState: [x, y, z] };
}

/** Project 3D points to 2D.
 *  Input: Float64Array [x0,y0,z0, x1,y1,z1, ...]
 *  Output: Float64Array [u0,v0, u1,v1, ...] */
export function projectPoints(
  points3D: Float64Array,
  projection: string
): Float64Array {
  const count = points3D.length / 3;
  const result = new Float64Array(count * 2);

  for (let i = 0; i < count; i++) {
    const x = points3D[i * 3]!;
    const y = points3D[i * 3 + 1]!;
    const z = points3D[i * 3 + 2]!;

    switch (projection) {
      case "xy":
        result[i * 2] = x;
        result[i * 2 + 1] = y;
        break;
      case "yz":
        result[i * 2] = y;
        result[i * 2 + 1] = z;
        break;
      case "xz":
      default:
        result[i * 2] = x;
        result[i * 2 + 1] = z;
        break;
    }
  }

  return result;
}
