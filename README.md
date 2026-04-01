# DopeChaos

> chaos is just order that hasn't introduced itself yet

A web-based chaos attractor visualizer built in Rust + WASM. Explore Julia sets, strange attractors, and orbital maps with live parameter control — rendered in real-time directly in the browser.

---

## What it does

Pick a chaotic system. Twist the parameters. Watch structure emerge from nothing.

Three systems, three render styles. All running in a Web Worker so the UI stays responsive while the math churns.

**Systems**
- **Julia Set** — classic fractal escape-time math with smooth coloring
- **Peter de Jong** — dense, ornamental strange attractor with extreme parameter sensitivity
- **Ikeda Map** — orbital/spiral dynamics with strong visual identity

**Render families**
| Family | Templates |
|--------|-----------|
| Pixel | Neon Glow, Monochrome Ink |
| ASCII | Terminal Noir, Amber Monitor |
| Density | Cosmic Dust, Soft Bloom |

---

## Stack

- **Rust** — all computation
- **Leptos 0.6 CSR** — reactive UI
- **WASM** — runs entirely in the browser
- **Web Workers + OffscreenCanvas** — heavy math off the main thread
- **Trunk** — local build and dev server
- **Vercel** — static hosting

No backend. No auth. No database. No SSR.

---

## Run locally

You need Rust, the `wasm32-unknown-unknown` target, `wasm-bindgen-cli`, and Trunk.

```bash
# Install dependencies (once)
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli
cargo install trunk

# Dev server
trunk serve

# Production build
trunk build --release
```

Open `http://localhost:8080` and start breaking things.

---

## Project structure

```
crates/
  dc-protocol/   — shared message types (no WASM deps)
  dc-core/       — pure math: Julia, Peter de Jong, Ikeda
  dc-render/     — render templates: pixel, ASCII, density
  dc-app/        — Leptos UI + Web Worker bridge

public/
  chaos.worker.js  — worker bootstrap (loads same WASM, skips Leptos mount)
  styles.css
```

The math never touches the UI. The UI never touches the math. The worker is the only thing that does both.

---

## Deploy to Vercel

The `vercel.json` handles everything. Just connect the repo and push.

The COOP/COEP headers are required for `OffscreenCanvas` and `SharedArrayBuffer` support.

---

## Architecture note

The current UI is intentionally generic — controls panel on the left, canvas on the right. It's a placeholder. The core logic (`dc-core`, `dc-render`, `dc-protocol`) is fully decoupled from Leptos and can survive a complete UI rewrite without changes.

Adding a new system = one new file in `dc-core/src/systems/`.
Adding a new render template = one new file in `dc-render/src/pixel/` (or ascii/, density/).

---

## License

MIT
