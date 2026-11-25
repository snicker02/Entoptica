# Entoptica v0.2.1

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
- **Domain warp** — iterated fbm warping (`f(p + f(p + f(p)))`), up to 6 octaves and 4 warp levels.
- **Quasicrystal** — N plane waves at equal angles (3–16), smooth, folded or thresholded.
- **Reaction-Diffusion** — Gray-Scott on the GPU, with feed/kill varied by noise or the photo, curl-flow advection, and 4 seed patterns.
- **Physarum** — up to 1M slime-mold agents with sensor/turn steering, photo attraction, and 4 spawn patterns.

- **Fractal** — Julia, Mandelbrot or Burning Ship Julia. Coloring by smooth escape or point/ring/cross orbit traps. The Julia *c* orbits a circle once per loop, so loops are seamless.
- **Pattern** — op-art generators: hypno spiral, moiré rings, animated Voronoi cells, Truchet arcs, warped checker.

## Moving the base image
In the Photo section, set position X/Y, rotation, scale and horizontal/vertical flips. You can also switch the canvas to **✥ Moving image** (header button, or press **M**): dragging then moves the image, wheel or pinch scales it, right/shift-drag or a two-finger twist rotates it, and double-click or double-tap resets it. Switch back to **✥ Moving view** to pan and zoom the whole scene.

## FX (screen space, before Post)
Ripple (loops with the animation), swirl, glitch slices (stepped per loop), liquid RGB, pixelate, halftone (45° screen), solarize, scanlines, left↔right mirror.

## Conformal map stack (4 slots)
Droste spiral (seamless, integer strands), power zⁿ, Möbius disk automorphism, Blaschke product, exp, log spiral, sin, tan, Joukowski, circle inversion, twirl + ripple, tunnel, Julia warp.

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

## Tech
WebGL1, no dependencies, ES modules: `index.html`, `main.js`, `engine/` (`gl`, `shaders`, `sims`, `params`, `ui`, `video`). On wide screens the sources sit in a left sidebar and the transform/colour/output stages in a right sidebar; on phones the view docks with a tab bar underneath. Reaction-Diffusion and Physarum need float render targets (Physarum also needs vertex texture fetch); devices without them show a note in those tabs.

Serve over HTTP (ES modules don't load from `file://`), e.g. `python3 -m http.server`.

## Changelog
- **0.2.1** — renamed from Ekstasis to **Entoptica**. Saved settings, section locks, last tab and the confirm choice migrate automatically from the old name. Export files are now named `entoptica_v…`.
- **0.2.0** — move/rotate/scale/flip the base image (sliders + canvas “Moving image” mode). New sources: Fractal (Julia/Mandelbrot/Burning Ship with orbit traps) and Pattern (hypno spiral, moiré, Voronoi, Truchet, warped checker). New FX section: ripple, swirl, glitch slices, liquid RGB, pixelate, halftone, solarize, scanlines, mirror. New presets: Julia Trance, Hypno Glitch, Voronoi Acid, Halftone Pop. Fixed two-finger twist direction.
- **0.1.3** — two sidebars on wide screens (≥1100 px): Sources on the left (Photo, Warp, Quasicrystal, Reaction-Diffusion, Physarum); Maps, Symmetry, Feedback, Palette, Post, Motion and Output on the right. Narrower windows merge into the right sidebar; phones keep the docked view + tabs.
- **0.1.2** — fix: “Render one loop” MP4 had black frames interleaved (strobing); frames are now captured before the encoder yields. Feedback is now time-normalised (60 fps reference) so renders at 24/30/60 fps match the live preview.
- **0.1.1** — starts clean: base image only, no effects (post defaults are neutral). New **Base image only** preset; the previous session is restorable via **↺ Last session** in the preset menu.
- **0.1.0** — first release: 5 sources, 13 conformal maps, 8 symmetries, feedback, palette cycling, post, A/B morph, PNG/MP4/WebM export, phone layout.

---
Created with help from Claude AI
