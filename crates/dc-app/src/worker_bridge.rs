use dc_protocol::{RenderRequest, WorkerResponse};
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{HtmlCanvasElement, MessageEvent, Worker, WorkerOptions, WorkerType};

pub struct WorkerBridge {
    worker: Worker,
    // Kept alive so the closure is not dropped
    _on_message: Closure<dyn FnMut(MessageEvent)>,
}

impl WorkerBridge {
    /// Creates the worker, transfers the canvas, and wires up the response handler.
    pub fn new(
        canvas: HtmlCanvasElement,
        on_ready: impl Fn() + 'static,
        on_complete: impl Fn(u64, f64) + 'static,
        on_error: impl Fn(u64, String) + 'static,
    ) -> Self {
        let opts = WorkerOptions::new();
        opts.set_type(WorkerType::Module);

        let worker =
            Worker::new_with_options("./chaos.worker.js", &opts).expect("spawn worker");

        // Transfer canvas ownership to the worker (zero-copy, permanent)
        init_worker_canvas(&worker, &canvas);

        let on_msg = Closure::wrap(Box::new(move |e: MessageEvent| {
            if let Some(s) = e.data().as_string() {
                if let Ok(resp) = serde_json::from_str::<WorkerResponse>(&s) {
                    match resp {
                        WorkerResponse::Ready => on_ready(),
                        WorkerResponse::Complete { id, elapsed_ms } => on_complete(id, elapsed_ms),
                        WorkerResponse::Error { id, message } => on_error(id, message),
                    }
                }
            }
        }) as Box<dyn FnMut(MessageEvent)>);

        worker.set_onmessage(Some(on_msg.as_ref().unchecked_ref()));

        WorkerBridge { worker, _on_message: on_msg }
    }

    pub fn send_render(&self, req: &RenderRequest) {
        let json = serde_json::to_string(req).unwrap_or_default();
        self.worker
            .post_message(&JsValue::from_str(&json))
            .ok();
    }
}

/// Inline JS glue — transfers the OffscreenCanvas to the worker.
/// This must be JS (not Rust) because `transferControlToOffscreen` requires
/// the canvas and the transfer array to live in the same JS call frame.
#[wasm_bindgen(inline_js = r#"
export function dc_init_worker_canvas(worker, canvas) {
    const offscreen = canvas.transferControlToOffscreen();
    worker.postMessage({ type: 'init_canvas', canvas: offscreen }, [offscreen]);
}
"#)]
extern "C" {
    fn dc_init_worker_canvas(worker: &Worker, canvas: &HtmlCanvasElement);
}

fn init_worker_canvas(worker: &Worker, canvas: &HtmlCanvasElement) {
    dc_init_worker_canvas(worker, canvas);
}
