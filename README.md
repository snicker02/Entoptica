# Entoptica v0.4.0

*Entoptic phenomena are visual effects whose source is within the eye itself: phosphenes, form constants, the shimmer behind closed eyelids.*

A psychedelic image engine built as a layer pipeline. Every stage can be stacked, randomized and animated:

```
SOURCES ──► CONFORMAL MAPS ──► SYMMETRY ──► FEEDBACK ──► PALETTE CYCLING ──► FX ──► POST
photo/video/camera   4-slot stack     8 modes      zoom/rotate/hue   cosine palettes    bloom, chroma,
domain warp          (13 maps)                     4 blend modes     luma/hue index     edge glow, grain
quasicrystal                                                         posterize          vignette, tone
reaction-diffusion
physarum
fractal
pattern
```

## Sources (all can run at once, each with opacity and 8 blend modes)
- **Photo** — image, video file or live camera, with optional displacement by the warp field.
- **Domain warp** — iterated fbm warping (`f(p + f(p + f(p)))`), up to 6 octaves and 4 warp levels. 12 wave types: value noise, gradient noise, ridged, turbulence, sine grid, triangle, square, cellular, cellular edges, 3-wave interference, ripple cells, spiral cells.
- **Quasicrystal** — N plane waves at equal angles (3–16), smooth, folded or thresholded.
- **Reaction-Diffusion** — Gray-Scott on the GPU, with feed/kill varied by noise or the photo, curl-flow advection, and 4 seed patterns.
- **Physarum** — up to 1M slime-mold agents with sensor/turn steering, photo attraction, and 4 spawn patterns.

- **Fractal** — Julia, Mandelbrot or Burning Ship Julia. Coloring by smooth escape or point/ring/cross orbit traps. The Julia *c* orbits a circle once per loop, so loops are seamless.
- **Pattern** — op-art generators: hypno spiral, moiré rings, animated Voronoi cells, Truchet arcs, warped checker.

## Moving the base image
In the Photo section, set position X/Y, rotation, scale and horizontal/vertical flips. You can also switch the canvas to **✥ Moving image** (header button, or press **M**): dragging then moves the image, wheel or pinch scales it, right/shift-drag or a two-finger twist rotates it, and double-click or double-tap resets it. Switch back to **✥ Moving view** to pan and zoom the whole scene.

## FX (screen space, before Post)
Ripple (loops with the animation), swirl, glitch slices (stepped per loop), liquid RGB, pixelate, halftone (45° screen), solarize, scanlines, left↔right mirror.

## Map stack (4 slots, 24 maps)
Droste spiral (seamless, integer strands), power zⁿ, Möbius disk automorphism, Blaschke product, exp, log spiral, sin, tan, sinh, tanh, Joukowski, circle inversion, bipolar log, loxodromic Möbius, log twist, rational zⁿ + b/zⁿ, Newton (z³−1) iteration, Julia warp, Kali fold, twirl + ripple, sine ripple, bulge/pinch, flower, tunnel.

## Symmetry
Mirror X, mirror XY, kaleidoscope (dihedral), rotational, square p4m tiling, hex tiling, and inversion mirror.

## Motion
Every procedural parameter is driven by a loop phase, so **Render one loop** produces a seamless video. You can capture two states (A/B) and morph between them over the loop. Feedback, Reaction-Diffusion and Physarum are stateful and evolve continuously.

## Export
- PNG at view size, 2048 or 4096 px (long edge), up to 8192 px where the GPU allows.
- **MP4**: frame-exact H.264 through WebCodecs with a built-in MP4 muxer. Falls back to MediaRecorder MP4 where WebCodecs isn't available.
- **WebM** through MediaRecorder.
- Live recording (start/stop) in either format.
- Settings save and load as JSON. The app also autosaves locally, with undo and redo.

## Controls
- Mouse: drag to pan, wheel to zoom, right-drag or shift-drag to rotate, double-click to reset.
- Touch: drag, pinch, two-finger pan/twist, double-tap to reset.
- Keys: **M** toggle moving view/image · **R** randomize · **Space** play/pause · **Ctrl+Z / Ctrl+Shift+Z** undo/redo · **Enter** apply.
- **Confirm changes before applying** (on by default): controls marked ◆ rebuild shaders or simulations, so they wait for **Apply**.
- Each section has a 🎲 randomize button and a **lock** checkbox; global Randomize skips locked sections.

## Shared image shelf

The **⇄ Shelf** button opens the image shelf shared by all apps on [snicker02.github.io](https://snicker02.github.io/#shelf). It stores images in this browser only (IndexedDB), and every app on the site can read the same shelf.

- **Save current** puts the current result on the shelf.
- **Send to ↗** opens another app in a new tab with the image already loaded.
- **Load here** loads a shelf image into this app. To add images to the shelf, use Add files, Paste, or drop them on the panel.
- Opening the app with `?shelf=<id>` loads that shelf image on start. Send to uses this.

The shelf code lives in [`snicker02.github.io/shared/bridge.js`](https://github.com/snicker02/snicker02.github.io/blob/main/shared/bridge.js). If it can't load (for example when you're offline), the app works as before and the button is hidden.

## Tech
WebGL1, no dependencies, ES modules: `index.html`, `main.js`, `engine/` (`gl`, `shaders`, `sims`, `params`, `ui`, `video`). On wide screens the sources sit in a left sidebar and the transform/colour/output stages in a right sidebar; on phones the view docks with a tab bar underneath. Reaction-Diffusion and Physarum need float render targets (Physarum also needs vertex texture fetch); devices without them show a note in those tabs.

Serve over HTTP (ES modules don't load from `file://`), e.g. `python3 -m http.server`.

## Changelog
- **0.4.0** — Warp gets a **Wave type** selector with 12 bases. 11 new maps: Sinh, Tanh, Bulge/pinch, Flower, Sine ripple, Kali fold, Bipolar log, Newton (z³−1), Rational zⁿ + b/zⁿ, Log twist, Loxodromic. Each map's spin control animates it seamlessly over the loop.
- **0.3.0**: adds the shared **⇄ Shelf** in the header. You can send the current frame to other snicker02 apps, and load shelf images as the photo source. PNG rendering is factored into `renderCanvas()`/`renderBlob()`.
- **0.2.1** — renamed from Ekstasis to **Entoptica**. Saved settings, section locks, last tab and the confirm choice migrate automatically from the old name. Export files are now named `entoptica_v…`.
- **0.2.0** — move/rotate/scale/flip the base image (sliders + canvas “Moving image” mode). New sources: Fractal (Julia/Mandelbrot/Burning Ship with orbit traps) and Pattern (hypno spiral, moiré, Voronoi, Truchet, warped checker). New FX section: ripple, swirl, glitch slices, liquid RGB, pixelate, halftone, solarize, scanlines, mirror. New presets: Julia Trance, Hypno Glitch, Voronoi Acid, Halftone Pop. Fixed two-finger twist direction.
- **0.1.3** — two sidebars on wide screens (≥1100 px): Sources on the left (Photo, Warp, Quasicrystal, Reaction-Diffusion, Physarum); Maps, Symmetry, Feedback, Palette, Post, Motion and Output on the right. Narrower windows merge into the right sidebar; phones keep the docked view + tabs.
- **0.1.2** — fix: “Render one loop” MP4 had black frames interleaved (strobing); frames are now captured before the encoder yields. Feedback is now time-normalised (60 fps reference) so renders at 24/30/60 fps match the live preview.
- **0.1.1** — starts clean: base image only, no effects (post defaults are neutral). New **Base image only** preset; the previous session is restorable via **↺ Last session** in the preset menu.
- **0.1.0** — first release: 5 sources, 13 conformal maps, 8 symmetries, feedback, palette cycling, post, A/B morph, PNG/MP4/WebM export, phone layout.

---
Created with help from Claude AI
