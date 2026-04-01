use dc_protocol::RenderFamily;
use leptos::*;

use crate::app::SystemKind;

#[component]
pub fn StatusBar(
    system_kind:    ReadSignal<SystemKind>,
    render_family:  ReadSignal<RenderFamily>,
    is_rendering:   ReadSignal<bool>,
    last_render_ms: ReadSignal<f64>,
) -> impl IntoView {
    let family_label = move || match render_family.get() {
        RenderFamily::Pixel   => "pixel",
        RenderFamily::Ascii   => "ascii",
        RenderFamily::Density => "density",
    };

    view! {
        <footer class="status-bar">
            <span class="status-item">
                <span
                    class="status-dot"
                    class:active=move || is_rendering.get()
                />
                {move || if is_rendering.get() { "rendering" } else { "idle" }}
            </span>
            <span class="status-item">
                <span class="status-value">{move || system_kind.get().label()}</span>
            </span>
            <span class="status-item">
                {family_label}
            </span>
            <span class="status-item">
                {move || {
                    let ms = last_render_ms.get();
                    if ms > 0.0 {
                        format!("{ms:.0}ms")
                    } else {
                        "—".to_string()
                    }
                }}
            </span>
        </footer>
    }
}
