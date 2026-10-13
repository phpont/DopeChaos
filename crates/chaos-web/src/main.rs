mod graphics;
mod playback;

use std::{cell::RefCell, rc::Rc};

use leptos::prelude::*;

use crate::playback::Playback;

#[component]
fn App() -> impl IntoView {
    let canvas = NodeRef::<leptos::html::Canvas>::new();
    let playback = Rc::new(RefCell::new(None::<Rc<RefCell<Playback>>>));
    let (time, set_time) = signal(0.0_f64);
    let (playing, set_playing) = signal(false);
    let (error, set_error) = signal(None::<String>);
    let (context_lost, set_context_lost) = signal(false);

    let on_load = Rc::clone(&playback);
    canvas.on_load(move |element| {
        match Playback::new(
            element,
            move |value| set_time.set(value),
            move || set_playing.set(false),
            move |lost, running| {
                set_context_lost.set(lost);
                set_playing.set(running);
            },
            move |message| set_error.set(Some(message)),
        ) {
            Ok(instance) => {
                *on_load.borrow_mut() = Some(instance);
                set_playing.set(true);
            }
            Err(message) => set_error.set(Some(message)),
        }
    });

    let on_toggle = Rc::clone(&playback);
    let on_restart = Rc::clone(&playback);
    let on_dispose = StoredValue::new_local(Rc::clone(&playback));

    on_cleanup(move || {
        on_dispose.with_value(|playback| {
            if let Some(instance) = playback.borrow_mut().take() {
                instance.borrow_mut().pause();
            }
        });
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

                    aria-label="Lorenz trajectory evolving from the initial state"
                />
            </section>

            <div class="playback-controls">
                <button
                    type="button"
                    disabled=move || context_lost.get() || error.get().is_some() || (!playing.get() && time.get() >= 70.0)
                    on:click=move |_| {
                        if let Some(instance) = on_toggle.borrow().as_ref() {
                            let mut player = instance.borrow_mut();
                            if playing.get_untracked() {
                                player.pause();
                                set_playing.set(false);
                            } else {
                                match player.resume() {
                                    Ok(()) => set_playing.set(true),
                                    Err(message) => set_error.set(Some(message)),
                                }
                            }
                        }
                    }
                >{move || if playing.get() { "Pause" } else if time.get() >= 70.0 { "Complete" } else { "Play" }}</button>
                <button
                    type="button"
                    disabled=move || context_lost.get() || error.get().is_some()
                    on:click=move |_| {
                        if let Some(instance) = on_restart.borrow().as_ref() {
                            match instance.borrow_mut().restart() {
                                Ok(()) => set_playing.set(true),
                                Err(message) => set_error.set(Some(message)),
                            }
                        }
                    }
                >"Restart"</button>
                <output>{move || format!("t = {:.2}", time.get())}</output>
            </div>
            <p class="status">
                {move || {
                    if context_lost.get() {
                        "WebGL context lost. Waiting for restoration.".to_string()
                    } else {
                        error.get().unwrap_or_else(|| {
                            "WebGL2 / Rust WASM / RK4 dt=0.005 / 14,000 steps".to_string()
                        })
                    }
                }}
            </p>
        </main>
    }
}

fn main() {
    leptos::mount::mount_to_body(|| view! { <App /> });
}
