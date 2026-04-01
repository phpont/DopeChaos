use std::cell::RefCell;

use dc_core::{ikeda, julia, peter_de_jong};
use dc_protocol::{RenderFamily, RenderRequest, SystemParams, WorkerResponse};
use dc_render::{render_to_ascii, render_to_pixels};
use wasm_bindgen::prelude::*;
use wasm_bindgen::Clamped;
use web_sys::{ImageData, OffscreenCanvas, OffscreenCanvasRenderingContext2d};

thread_local! {
    static CTX: RefCell<Option<OffscreenCanvasRenderingContext2d>> = RefCell::new(None);
}

/// Called once from chaos.worker.js with the transferred OffscreenCanvas.
#[wasm_bindgen]
pub fn worker_init_canvas(canvas: OffscreenCanvas) {
    let ctx = canvas
        .get_context("2d")
        .unwrap()
        .unwrap()
        .dyn_into::<OffscreenCanvasRenderingContext2d>()
        .expect("2d context");

    CTX.with(|c| *c.borrow_mut() = Some(ctx));
    post_response(&WorkerResponse::Ready);
}

/// Called from chaos.worker.js for every render request (JSON-encoded RenderRequest).
#[wasm_bindgen]
pub fn worker_render(msg: String) {
    let req: RenderRequest = match serde_json::from_str(&msg) {
        Ok(r) => r,
        Err(e) => {
            post_response(&WorkerResponse::Error {
                id: 0,
                message: e.to_string(),
            });
            return;
        }
    };

    let t0 = js_sys::Date::now();

    CTX.with(|c| {
        if let Some(ctx) = c.borrow().as_ref() {
            if let Err(e) = perform_render(ctx, &req) {
                post_response(&WorkerResponse::Error {
                    id: req.id,
                    message: e,
                });
                return;
            }
        }
    });

    post_response(&WorkerResponse::Complete {
        id: req.id,
        elapsed_ms: js_sys::Date::now() - t0,
    });
}

fn perform_render(ctx: &OffscreenCanvasRenderingContext2d, req: &RenderRequest) -> Result<(), String> {
    match req.family {
        RenderFamily::Ascii => render_ascii(ctx, req),
        _ => render_pixels(ctx, req),
    }
}

fn render_pixels(ctx: &OffscreenCanvasRenderingContext2d, req: &RenderRequest) -> Result<(), String> {
    let buf  = compute_scalar(req.width, req.height, &req.system);
    let rgba = render_to_pixels(&buf, &req.family, &req.template);

    let image_data = ImageData::new_with_u8_clamped_array_and_sh(Clamped(&rgba), req.width, req.height)
        .map_err(|e| format!("{e:?}"))?;

    ctx.put_image_data(&image_data, 0.0, 0.0)
        .map_err(|e| format!("{e:?}"))
}

fn render_ascii(ctx: &OffscreenCanvasRenderingContext2d, req: &RenderRequest) -> Result<(), String> {
    let cw = req.width as f64;
    let ch = req.height as f64;

    // Compute at character resolution
    let cols = (req.width / 9).max(1);
    let rows = (req.height / 16).max(1);

    let buf              = compute_scalar(cols, rows, &req.system);
    let (chars, fg, bg) = render_to_ascii(&buf, &req.template);

    let char_w    = cw / cols as f64;
    let char_h    = ch / rows as f64;
    let font_size = char_h.floor() as u32;

    ctx.set_fill_style_str(bg);
    ctx.fill_rect(0.0, 0.0, cw, ch);
    ctx.set_font(&format!("{font_size}px monospace"));
    ctx.set_fill_style_str(fg);

    for (i, glyph) in chars.iter().enumerate() {
        let col = (i as u32 % cols) as f64;
        let row = (i as u32 / cols) as f64;
        let x   = col * char_w;
        let y   = (row + 1.0) * char_h;
        ctx.fill_text(&glyph.to_string(), x, y).ok();
    }

    Ok(())
}

fn compute_scalar(w: u32, h: u32, system: &SystemParams) -> Vec<f64> {
    match system {
        SystemParams::Julia(p)       => julia::scalar_buffer(w, h, p),
        SystemParams::PeterDeJong(p) => peter_de_jong::scalar_buffer(w, h, p),
        SystemParams::Ikeda(p)       => ikeda::scalar_buffer(w, h, p),
    }
}

fn post_response(resp: &WorkerResponse) {
    let json = serde_json::to_string(resp).unwrap_or_default();
    post_message_raw(&json);
}

#[wasm_bindgen]
extern "C" {
    /// Binds self.postMessage in the DedicatedWorker context.
    #[wasm_bindgen(js_namespace = self, js_name = postMessage)]
    fn post_message_raw(msg: &str);
}
