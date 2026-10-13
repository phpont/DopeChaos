mod graphics;

use leptos::prelude::*;

#[component]
fn App() -> impl IntoView {
    let canvas = NodeRef::<leptos::html::Canvas>::new();
    let renderer = StoredValue::new_local(None::<graphics::Renderer>);
    let (error, set_error) = signal(None::<String>);

    canvas.on_load(move |element| match graphics::Renderer::new(&element) {
        Ok(scene) => {
            scene.draw(element.width(), element.height());
            renderer.set_value(Some(scene));
        }
        Err(message) => set_error.set(Some(message)),
    });

    view! {
        <main class="shell">
            <header class="intro">
                <p class="eyebrow">"DOPECHAOS / EXPERIMENT 01"</p>
                <h1>"The Lorenz system"</h1>
                <p class="description">
                    "A deterministic system with sensitive dependence on initial conditions."
                </p>
            </header>

            <section class="viewport" aria-label="Lorenz attractor visualization">
                <canvas
                    node_ref=canvas
                    width="1200"
                    height="675"
                    aria-label="Static three-dimensional projection of the Lorenz attractor"
                />
            </section>

            <p class="status">
                {move || error.get().unwrap_or_else(|| {
                    "14,000 vertices / WebGL2 / Rust WASM / Static preview".to_string()
                })}
            </p>
        </main>
    }
}

fn main() {
    leptos::mount::mount_to_body(|| view! { <App /> });
}
