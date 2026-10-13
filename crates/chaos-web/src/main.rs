use leptos::prelude::*;

#[component]
fn App() -> impl IntoView {
    view! {
        <main class="shell">
            <p class="eyebrow">"DOPECHAOS / EXPERIMENT 01"</p>
            <h1>"The Lorenz system"</h1>
            <p class="description">
                "An exploration of sensitive dependence on initial conditions."
            </p>
            <p class="status">"Simulation not implemented yet."</p>
        </main>
    }
}

fn main() {
    leptos::mount::mount_to_body(|| view! { <App /> });
}
