mod app;
mod components;
mod worker_bridge;
mod worker_handler;

use wasm_bindgen::prelude::*;

/// WASM entry point — called by the generated init() in both main-thread and worker contexts.
/// Only mounts Leptos when running in a window context; the worker skips it.
#[wasm_bindgen(start)]
pub fn start() {
    #[cfg(debug_assertions)]
    console_error_panic_hook::set_once();

    if web_sys::window().is_some() {
        leptos::mount_to_body(app::App);
    }
}

// Re-export the worker API so chaos.worker.js can call them
pub use worker_handler::worker_init_canvas;
pub use worker_handler::worker_render;
