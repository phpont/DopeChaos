use std::cell::RefCell;
use std::rc::Rc;

use dc_protocol::{
    default_template, IkedaParams, JuliaParams, PeterDeJongParams, RenderFamily, RenderRequest,
    SystemParams,
};
use leptos::*;
use wasm_bindgen::closure::Closure;
use wasm_bindgen::JsCast;

use crate::components::{controls::Controls, status_bar::StatusBar, viewer::Viewer};
use crate::worker_bridge::WorkerBridge;

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum SystemKind {
    Julia,
    PeterDeJong,
    Ikeda,
}

impl SystemKind {
    pub fn label(self) -> &'static str {
        match self {
            Self::Julia       => "Julia Set",
            Self::PeterDeJong => "Peter de Jong",
            Self::Ikeda       => "Ikeda Map",
        }
    }
}

#[component]
pub fn App() -> impl IntoView {
    // ── Render config ──────────────────────────────────────────────────────
    let (system_kind, set_system_kind)        = create_signal(SystemKind::Julia);
    let (render_family, set_render_family)    = create_signal(RenderFamily::Pixel);
    let (template, set_template)              = create_signal(default_template(&RenderFamily::Pixel).to_string());

    // ── System parameters ──────────────────────────────────────────────────
    let (julia_params, set_julia_params)      = create_signal(JuliaParams::default());
    let (pdj_params, set_pdj_params)          = create_signal(PeterDeJongParams::default());
    let (ikeda_params, set_ikeda_params)      = create_signal(IkedaParams::default());

    // ── Canvas ─────────────────────────────────────────────────────────────
    let canvas_ref                            = create_node_ref::<html::Canvas>();
    let (canvas_size, set_canvas_size)        = create_signal((800u32, 600u32));

    // ── Status ─────────────────────────────────────────────────────────────
    let (worker_ready, set_worker_ready)      = create_signal(false);
    let (is_rendering, set_is_rendering)      = create_signal(false);
    let (last_render_ms, set_render_ms)       = create_signal(0.0f64);
    let (render_id, set_render_id)            = create_signal(0u64);

    let bridge: Rc<RefCell<Option<WorkerBridge>>> = Rc::new(RefCell::new(None));

    // ── Initialise worker once the canvas element is mounted ───────────────
    {
        let bridge = bridge.clone();
        create_effect(move |_| {
            let Some(canvas) = canvas_ref.get() else { return };

            if let Some(parent) = canvas.parent_element() {
                let w = (parent.client_width() as u32).max(200);
                let h = (parent.client_height() as u32).max(200);
                canvas.set_width(w);
                canvas.set_height(h);
                set_canvas_size.set((w, h));
            }

            let b = WorkerBridge::new(
                (*canvas).clone(),
                move || set_worker_ready.set(true),
                move |_id, ms| {
                    set_is_rendering.set(false);
                    set_render_ms.set(ms);
                },
                move |_id, msg| {
                    set_is_rendering.set(false);
                    leptos::logging::log!("worker error: {msg}");
                },
            );

            *bridge.borrow_mut() = Some(b);
        });
    }

    // ── Debounced render effect ────────────────────────────────────────────
    let pending: Rc<RefCell<Option<i32>>> = Rc::new(RefCell::new(None));

    {
        let bridge  = bridge.clone();
        let pending = pending.clone();

        create_effect(move |_| {
            if !worker_ready.get() { return; }

            let (w, h)  = canvas_size.get();
            let family  = render_family.get();
            let tmpl    = template.get();
            let kind    = system_kind.get();

            let system = match kind {
                SystemKind::Julia       => SystemParams::Julia(julia_params.get()),
                SystemKind::PeterDeJong => SystemParams::PeterDeJong(pdj_params.get()),
                SystemKind::Ikeda       => SystemParams::Ikeda(ikeda_params.get()),
            };

            let next_id = render_id.get_untracked() + 1;
            set_render_id.set(next_id);
            set_is_rendering.set(true);

            let req = RenderRequest { id: next_id, width: w, height: h, system, family, template: tmpl };

            // Cancel previous debounce timer
            let win = web_sys::window().unwrap();
            if let Some(h) = pending.borrow_mut().take() {
                win.clear_timeout_with_handle(h);
            }

            let bridge_ref  = bridge.clone();
            let pending_ref = pending.clone();

            let cb = Closure::once(Box::new(move || {
                pending_ref.borrow_mut().take();
                if let Some(b) = bridge_ref.borrow().as_ref() {
                    b.send_render(&req);
                }
            }) as Box<dyn FnOnce()>);

            let handle = win
                .set_timeout_with_callback_and_timeout_and_arguments_0(
                    cb.as_ref().unchecked_ref(),
                    120,
                )
                .unwrap();

            cb.forget();
            *pending.borrow_mut() = Some(handle);
        });
    }

    view! {
        <div class="app">
            <aside class="controls-panel">
                <p class="panel-title">"DopeChaos"</p>
                <Controls
                    system_kind=system_kind
                    set_system_kind=set_system_kind
                    render_family=render_family
                    set_render_family=set_render_family
                    template=template
                    set_template=set_template
                    julia_params=julia_params
                    set_julia_params=set_julia_params
                    pdj_params=pdj_params
                    set_pdj_params=set_pdj_params
                    ikeda_params=ikeda_params
                    set_ikeda_params=set_ikeda_params
                />
            </aside>
            <main class="viewer-area">
                <Viewer canvas_ref=canvas_ref />
            </main>
            <StatusBar
                system_kind=system_kind
                render_family=render_family
                is_rendering=is_rendering
                last_render_ms=last_render_ms
            />
        </div>
    }
}
