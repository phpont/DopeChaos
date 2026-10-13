use std::{cell::RefCell, rc::Rc};

use chaos_core::{LorenzPair, PairStates, Parameters, State};
use wasm_bindgen::{JsCast, closure::Closure};
use web_sys::{HtmlCanvasElement, Window};

use crate::graphics::Renderer;

const DT: f64 = 0.005;
const SPEED: f64 = 5.0;
const MAX_STEPS: usize = 14_000;
const MAX_FRAME_SECONDS: f64 = 0.05;

pub struct Playback {
    window: Window,
    canvas: HtmlCanvasElement,
    renderer: Renderer,
    pair: LorenzPair,
    scratch: Vec<f32>,
    steps: usize,
    accumulated: f64,
    previous_frame: Option<f64>,
    playing: bool,
    pending_frame: Option<i32>,
    callback: Option<Closure<dyn FnMut(f64)>>,
    on_progress: Box<dyn Fn(f64)>,
    on_stopped: Box<dyn Fn()>,
    on_error: Box<dyn Fn(String)>,
}

impl Playback {
    pub fn new(
        canvas: HtmlCanvasElement,
        on_progress: impl Fn(f64) + 'static,
        on_stopped: impl Fn() + 'static,
        on_error: impl Fn(String) + 'static,
    ) -> Result<Rc<RefCell<Self>>, String> {
        let initial = PairStates {
            reference: State {
                x: 1.0,
                y: 1.0,
                z: 1.0,
            },
            perturbed: State {
                x: 1.000_000_001,
                y: 1.0,
                z: 1.0,
            },
        };
        let pair = LorenzPair::new(initial, Parameters::default(), DT)
            .map_err(|error| format!("Invalid Lorenz configuration: {error:?}"))?;

        let mut renderer = Renderer::new(&canvas, MAX_STEPS + 1)?;
        renderer.append(&[1.0, 1.0, 1.0])?;
        renderer.draw(canvas.width(), canvas.height());

        let window = web_sys::window().ok_or_else(|| "Browser window unavailable.".to_string())?;
        let playback = Rc::new(RefCell::new(Self {
            window,
            canvas,
            renderer,
            pair,
            scratch: Vec::with_capacity(256 * 3),
            steps: 0,
            accumulated: 0.0,
            previous_frame: None,
            playing: false,
            pending_frame: None,
            callback: None,
            on_progress: Box::new(on_progress),
            on_stopped: Box::new(on_stopped),
            on_error: Box::new(on_error),
        }));

        let weak = Rc::downgrade(&playback);
        let callback = Closure::<dyn FnMut(f64)>::wrap(Box::new(move |timestamp| {
            let Some(shared) = weak.upgrade() else { return };
            let mut player = shared.borrow_mut();
            player.pending_frame = None;

            if !player.playing {
                return;
            }

            if let Err(error) = player.advance(timestamp) {
                player.playing = false;
                (player.on_error)(error);
                return;
            }

            if player.steps == MAX_STEPS {
                player.playing = false;
                (player.on_stopped)();
            } else if let Err(error) = player.schedule() {
                player.playing = false;
                (player.on_error)(error);
            }
        }));

        playback.borrow_mut().callback = Some(callback);
        playback.borrow_mut().resume()?;
        Ok(playback)
    }

    fn schedule(&mut self) -> Result<(), String> {
        let callback = self
            .callback
            .as_ref()
            .ok_or("Animation callback missing.")?;
        let handle = self
            .window
            .request_animation_frame(callback.as_ref().unchecked_ref())
            .map_err(|error| format!("requestAnimationFrame failed: {error:?}"))?;
        self.pending_frame = Some(handle);
        Ok(())
    }

    fn advance(&mut self, timestamp: f64) -> Result<(), String> {
        let elapsed = self
            .previous_frame
            .replace(timestamp)
            .map(|previous| ((timestamp - previous) * 0.001).clamp(0.0, MAX_FRAME_SECONDS))
            .unwrap_or(0.0);

        if !elapsed.is_finite() {
            return Err("Invalid animation timestamp.".into());
        }

        self.accumulated += elapsed * SPEED;
        let due = (self.accumulated / DT).floor() as usize;
        let count = due.min(MAX_STEPS - self.steps);
        self.scratch.clear();

        for _ in 0..count {
            let states = self
                .pair
                .step()
                .map_err(|error| format!("Lorenz integration failed: {error:?}"))?;
            let state = states.reference;
            self.scratch
                .extend_from_slice(&[state.x as f32, state.y as f32, state.z as f32]);
        }

        if count > 0 {
            self.renderer.append(&self.scratch)?;
            self.steps += count;
            self.accumulated -= count as f64 * DT;
            (self.on_progress)(self.steps as f64 * DT);
        }

        self.renderer
            .draw(self.canvas.width(), self.canvas.height());
        Ok(())
    }

    pub fn pause(&mut self) {
        self.playing = false;
        self.previous_frame = None;
        if let Some(handle) = self.pending_frame.take() {
            let _ = self.window.cancel_animation_frame(handle);
        }
    }

    pub fn resume(&mut self) -> Result<(), String> {
        if self.playing || self.steps == MAX_STEPS {
            return Ok(());
        }
        self.previous_frame = None;
        self.playing = true;
        if let Err(error) = self.schedule() {
            self.playing = false;
            return Err(error);
        }
        Ok(())
    }

    pub fn restart(&mut self) -> Result<(), String> {
        self.pause();
        self.pair.reset();
        self.renderer.reset();
        self.renderer.append(&[1.0, 1.0, 1.0])?;
        self.renderer
            .draw(self.canvas.width(), self.canvas.height());
        self.steps = 0;
        self.accumulated = 0.0;
        (self.on_progress)(0.0);
        self.resume()
    }
}

impl Drop for Playback {
    fn drop(&mut self) {
        self.pause();
        self.callback = None;
    }
}
