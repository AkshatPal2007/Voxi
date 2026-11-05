# Animation performance — 0.1.3

The previous stage checked `elapsed >= 1000 / 45` and reset its last-frame timestamp to each actual render. On a steady 60 Hz callback sequence this accepted every second callback: 30 updates per second. The new scheduler targets 60 updates per second, retains fractional scheduling remainder for high-refresh displays, and skips missed slots rather than running catch-up renders.

Unchanged visual state now reuses existing GPU pixels. The redraw key includes cursor position, word emphasis envelopes, phrase blend, active-word state, orbit phase and appearance settings, rather than raw song time alone. Word onset stays tied to supplied timestamps; movement takes up to 240 ms, shortened for rapid words. Enlargement eases in over 120 ms and releases over 140 ms. Reduced motion bypasses spatial interpolation.

CanvasTexture mipmap generation is disabled because this screen-aligned stage already uses linear minification. Resolution and pixel-ratio caps, offscreen/hidden skipping and explicit resource disposal remain in place. No full-screen motion-blur pass, temporal history buffer or additional dependency was introduced.

## Evidence and limits

25 automated tests pass, including scheduling at simulated 60/120/144 Hz and continuous word-size release. Synthetic callback sequences verify scheduling, not device FPS or CPU/GPU utilization. Actual rendering cost depends on viewport, device pixel ratio, text and glow cost, word density and hardware. Rapid lyrics can require more texture updates under the new 60 Hz target; held words and pauses skip redundant uploads. Full-song hardware profiling and a comparative frame-time/GPU-memory capture remain outstanding; no measured hardware speedup is claimed.

## Research

- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame) — display-aligned scheduling and timestamp-based motion.
- [Three.js: Texture](https://threejs.org/docs/pages/Texture.html) — texture update/upload and mipmap settings.
- [Three.js: Canvas textures](https://threejs.org/manual/pages/canvas-textures.html) — updating the texture when its contents change.
- [web.dev: High-performance animations](https://web.dev/articles/animations-guide) — compositor-friendly transforms/opacity and the cost of paint effects.
