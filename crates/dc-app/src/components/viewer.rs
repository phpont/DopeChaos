use leptos::*;

/// The canvas container. Canvas ownership is immediately transferred to the worker
/// after mount, so this component renders no visible DOM state — just the element.
#[component]
pub fn Viewer(canvas_ref: NodeRef<html::Canvas>) -> impl IntoView {
    view! {
        <canvas
            node_ref=canvas_ref
            class="viewer-canvas"
        />
        <div class="viewer-overlay">"DOPECHAOS"</div>
    }
}
