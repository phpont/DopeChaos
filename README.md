# DopeChaos

An interactive laboratory for dynamical systems.

## Architecture

- chaos-core: numerical models, independent of the browser.
- chaos-web: browser interface written in Rust with Leptos.
- Trunk: WebAssembly build and static asset pipeline.
- Cloudflare Workers Static Assets: planned hosting.

## Development

Requires Rust 1.99, the wasm32 target, and Trunk.

```sh
cargo test -p chaos-core
cargo fmt --all -- --check
trunk serve
```

## Production build

```sh
trunk build --release
```

Deployment is configured in wrangler.jsonc.

## Status

Foundation only. No simulation or visualization is implemented.