// Web Worker entry point.
// Loads the same WASM binary as the main app but only calls exported worker functions.
// The Leptos app is NOT mounted here — start() detects the worker context and skips it.

import init, { worker_init_canvas, worker_render } from './dopechaos.js';

(async () => {
    await init();

    self.onmessage = (e) => {
        const msg = e.data;

        if (msg && typeof msg === 'object' && msg.type === 'init_canvas') {
            worker_init_canvas(msg.canvas);
            return;
        }

        if (typeof msg === 'string') {
            worker_render(msg);
        }
    };
})();
