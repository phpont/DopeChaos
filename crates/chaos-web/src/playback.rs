use std::{cell::RefCell, rc::Rc};

use chaos_core::{LorenzPair, PairStates, Parameters, State};
use wasm_bindgen::{JsCast, closure::Closure};
use web_sys::{Event, HtmlCanvasElement, ResizeObserver, Window};

use crate::graphics::Renderer;

const DT: f64 = 0.005;
const SPEED: f64 = 5.0;
const MAX_STEPS: usize = 14_000;
const MAX_FRAME_SECONDS: f64 = 0.05;

pub struct Playback {
    window: Window,
    canvas: HtmlCanvasElement,
    renderer: Option<Renderer>,
    pair: LorenzPair,
    vertices: Vec<f32>,
    scratch: Vec<f32>,
    steps: usize,
    accumulated: f64,
    previous_frame: Option<f64>,
    playing: bool,
    context_lost: bool,
    resume_on_restore: bool,
    pending_frame: Option<i32>,
    callback: Option<Closure<dyn FnMut(f64)>>,
    resize_observer: Option<ResizeObserver>,
    resize_callback: Option<Closure<dyn FnMut(js_sys::Array, ResizeObserver)>>,
    lost_listener: Option<Closure<dyn FnMut(Event)>>,
    restored_listener: Option<Closure<dyn FnMut(Event)>>,
    on_progress: Box<dyn Fn(f64)>,
    on_stopped: Box<dyn Fn()>,
    on_context_changed: Box<dyn Fn(bool, bool)>,
    on_error: Box<dyn Fn(String)>,
}

impl Playback {
    pub fn new(
        canvas: HtmlCanvasElement,
        on_progress: impl Fn(f64) + 'static,
        on_stopped: impl Fn() + 'static,
        on_context_changed: impl Fn(bool, bool) + 'static,
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
            renderer: Some(renderer),
            pair,
            vertices: vec![1.0, 1.0, 1.0],
            scratch: Vec::with_capacity(256 * 3),
            steps: 0,
            accumulated: 0.0,
            previous_frame: None,
            playing: false,
            context_lost: false,
            resume_on_restore: false,
            pending_frame: None,
            callback: None,
            resize_observer: None,
            resize_callback: None,
            lost_listener: None,
            restored_listener: None,
            on_progress: Box::new(on_progress),
            on_stopped: Box::new(on_stopped),
            on_context_changed: Box::new(on_context_changed),
            on_error: Box::new(on_error),
        }));

        let weak = Rc::downgrade(&playback);

        let callback = Closure::<dyn FnMut(f64)>::new(move |timestamp| {
            let Some(shared) = weak.upgrade() else {
                return;
            };

            let mut player = shared.borrow_mut();
            player.pending_frame = None;

            if !player.playing {
                return;
            }

            if let Err(error) = player.advance(timestamp) {
                player.pause();
                (player.on_error)(error);
                return;
            }

            if player.steps == MAX_STEPS {
                player.pause();
                (player.on_stopped)();
            } else if let Err(error) = player.schedule() {
                player.pause();
                (player.on_error)(error);
            }
        });

        playback.borrow_mut().callback = Some(callback);

        let weak = Rc::downgrade(&playback);

        let resize_callback =
            Closure::<dyn FnMut(js_sys::Array, ResizeObserver)>::new(move |_, _| {
                if let Some(shared) = weak.upgrade() {
                    shared.borrow_mut().resize();
                }
            });

        let observer = ResizeObserver::new(resize_callback.as_ref().unchecked_ref())
            .map_err(|error| format!("ResizeObserver initialization failed: {error:?}"))?;

        let container = playback
            .borrow()
            .canvas
            .parent_element()
            .ok_or_else(|| "Canvas container unavailable.".to_string())?;

        observer.observe(&container);

        {
            let mut player = playback.borrow_mut();
            player.resize_observer = Some(observer);
            player.resize_callback = Some(resize_callback);
            player.resize();
        }

        Self::register_context_events(&playback)?;
        playback.borrow_mut().resume()?;

        Ok(playback)
    }

    fn register_context_events(shared: &Rc<RefCell<Self>>) -> Result<(), String> {
        let canvas = shared.borrow().canvas.clone();

        let weak = Rc::downgrade(shared);
        let lost = Closure::<dyn FnMut(Event)>::new(move |event: Event| {
            event.prevent_default();

            if let Some(shared) = weak.upgrade() {
                shared.borrow_mut().handle_context_lost();
            }
        });

        let weak = Rc::downgrade(shared);
        let restored = Closure::<dyn FnMut(Event)>::new(move |_event: Event| {
            if let Some(shared) = weak.upgrade() {
                let mut player = shared.borrow_mut();

                if let Err(error) = player.restore_context() {
                    (player.on_error)(error);
                }
            }
        });

        canvas
            .add_event_listener_with_callback("webglcontextlost", lost.as_ref().unchecked_ref())
            .map_err(|error| format!("Context loss listener failed: {error:?}"))?;

        if let Err(error) = canvas.add_event_listener_with_callback(
            "webglcontextrestored",
            restored.as_ref().unchecked_ref(),
        ) {
            let _ = canvas.remove_event_listener_with_callback(
                "webglcontextlost",
                lost.as_ref().unchecked_ref(),
            );

            return Err(format!("Context restore listener failed: {error:?}"));
        }

        let mut player = shared.borrow_mut();
        player.lost_listener = Some(lost);
        player.restored_listener = Some(restored);

        Ok(())
    }

    fn handle_context_lost(&mut self) {
        if self.context_lost {
            return;
        }

        self.resume_on_restore = self.playing;
        self.pause();
        self.context_lost = true;
        self.renderer = None;

        (self.on_context_changed)(true, false);
    }

    fn restore_context(&mut self) -> Result<(), String> {
        if !self.context_lost {
            return Ok(());
        }

        let mut renderer = Renderer::new(&self.canvas, MAX_STEPS + 1)?;
        renderer.append(&self.vertices)?;
        renderer.draw(self.canvas.width(), self.canvas.height());

        self.renderer = Some(renderer);
        self.context_lost = false;

        if self.resume_on_restore && self.steps < MAX_STEPS {
            self.resume()?;
        }

        self.resume_on_restore = false;
        (self.on_context_changed)(false, self.playing);

        Ok(())
    }

    fn resize(&mut self) {
        let rect = self.canvas.get_bounding_client_rect();
        let css_width = rect.width();
        let css_height = rect.height();

        if !css_width.is_finite()
            || !css_height.is_finite()
            || css_width <= 0.0
            || css_height <= 0.0
        {
            return;
        }

        let ratio = self.window.device_pixel_ratio();

        let ratio = if ratio.is_finite() && ratio > 0.0 {
            ratio.min(2.0)
        } else {
            1.0
        };

        let scale = ratio.min(4096.0 / css_width).min(4096.0 / css_height);

        let width = (css_width * scale).round().max(1.0) as u32;
        let height = (css_height * scale).round().max(1.0) as u32;

        if self.canvas.width() == width && self.canvas.height() == height {
            return;
        }

        self.canvas.set_width(width);
        self.canvas.set_height(height);

        if let Some(renderer) = &self.renderer {
            renderer.draw(width, height);
        }
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
            let renderer = self.renderer.as_mut().ok_or("Renderer unavailable.")?;

            renderer.append(&self.scratch)?;
            self.vertices.extend_from_slice(&self.scratch);

            self.steps += count;
            self.accumulated -= count as f64 * DT;

            (self.on_progress)(self.steps as f64 * DT);
        }

        if let Some(renderer) = &self.renderer {
            renderer.draw(self.canvas.width(), self.canvas.height());
        }

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
        if self.context_lost {
            return Err("WebGL context unavailable.".into());
        }

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
        if self.context_lost {
            return Err("WebGL context unavailable.".into());
        }

        self.pause();

        let renderer = self.renderer.as_mut().ok_or("Renderer unavailable.")?;

        renderer.reset();
        renderer.append(&[1.0, 1.0, 1.0])?;
        renderer.draw(self.canvas.width(), self.canvas.height());

        self.pair.reset();

        self.vertices.clear();
        self.vertices.extend_from_slice(&[1.0, 1.0, 1.0]);

        self.steps = 0;
        self.accumulated = 0.0;

        (self.on_progress)(0.0);

        self.resume()
    }
}

impl Drop for Playback {
    fn drop(&mut self) {
        self.pause();

        if let Some(observer) = self.resize_observer.take() {
            observer.disconnect();
        }

        if let Some(listener) = &self.lost_listener {
            let _ = self.canvas.remove_event_listener_with_callback(
                "webglcontextlost",
                listener.as_ref().unchecked_ref(),
            );
        }

        if let Some(listener) = &self.restored_listener {
            let _ = self.canvas.remove_event_listener_with_callback(
                "webglcontextrestored",
                listener.as_ref().unchecked_ref(),
            );
        }

        self.lost_listener = None;
        self.restored_listener = None;
        self.resize_callback = None;
        self.callback = None;
    }
}
