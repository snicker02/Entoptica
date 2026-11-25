# Entoptica v0.6.0

*Entoptic phenomena are visual effects whose source is within the eye itself: phosphenes, form constants, the shimmer behind closed eyelids.*

A psychedelic image engine built as a layer pipeline. Every stage can be stacked, randomized and animated:

```
SYMMETRY ⇄ MAPS (per-layer routing) ──► LAYERS (your order) ──► FEEDBACK / PALETTE / FX (your order) ──► POST
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

## Pipeline panel
The **Pipeline** panel (top of the left sidebar; the first tab on phones) shows the whole chain, top to bottom.

- **Coordinates:** Symmetry and Maps bend the space every layer is sampled from. Use ▲/▼ to swap their order, since kaleidoscope-then-warp looks completely different from warp-then-kaleidoscope. The four map slots can be reordered too, and each slot's settings and LFOs move with it.
- **Layers:** the sources. The top of the list is drawn last, in front, and each layer blends onto everything below it. Use ▲/▼ to restack, the checkbox to enable, and the name to jump to its settings.
  - Each layer also has a **Coordinates** route in its own section: *Symmetry + Maps*, *Symmetry only*, *Maps only* or *Straight*. That lets a sharp, undistorted photo sit over a kaleidoscoped fractal.
- **Image chain:** Feedback, Palette and FX run on the finished stack in the order shown, and **Post** (bloom, colour, vignette, grain) is always last. For example, FX before Feedback smears glitches into the trails, and Palette after FX recolours the halftone dots.
  - *Loop the whole chain* (Feedback) feeds the end of the chain back, not just the feedback output.

The 🎲 on the panel shuffles the layers. Sometimes it also flips the coordinate order or shuffles the image chain.

## Modulation (LFOs)
Every live slider has a **~** button. Click it to attach an LFO with these settings:
- **Wave:** sine, triangle, saw up/down, square, stepped random or smooth random.
- **Cycles per loop:** −8…8.
- **Depth:** a percentage of the slider's range.
- **Phase.**

Waves run a whole number of cycles per loop, so **Render one loop** stays seamless. The glowing dot under a modulated slider shows its live value; the slider itself keeps your base value. In **Motion**, *~ Random LFOs* adds three to sliders that are currently doing something, and *Clear all LFOs* removes them. LFOs are saved with undo/redo, JSON settings and share links.

## Share links
**🔗 Link** copies a URL that recreates the current look. It contains only the settings that differ from the defaults, deflate-compressed into the `#s=` hash. That includes layer order, LFOs, view, maps and everything else except device/output preferences. Your own photo isn't included; whoever opens the link sees the test card until they load an image. Opening a link applies it once, then clears the hash, so a refresh returns to a clean start. ↺ Last session is still available.

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
- Header: **🔗 Link** copies a shareable link.
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
WebGL1, no dependencies, ES modules: `index.html`, `main.js`, `engine/` (`gl`, `shaders`, `sims`, `params`, `ui`, `video`, `share`). On wide screens the sources sit in a left sidebar and the transform/colour/output stages in a right sidebar; on phones the view docks with a tab bar underneath. Reaction-Diffusion and Physarum need float render targets (Physarum also needs vertex texture fetch); devices without them show a note in those tabs.

Serve over HTTP (ES modules don't load from `file://`), e.g. `python3 -m http.server`.

## Changelog
- **0.6.0** — The **Pipeline** panel adds Coordinates (swap Symmetry ⇄ Maps, reorder map slots) and an **Image chain** (reorder Feedback / Palette / FX; Post always last) alongside the layer stack. Per-layer **Coordinates** routing: Symmetry + Maps, Symmetry only, Maps only, or Straight. FX now runs as its own pass. *Loop the whole chain* replaces *Palette inside loop*. Share links carry the new order and routing.
- **0.5.0** — **Layers** panel: restack sources with ▲/▼, enable them, and jump to their settings. The warp field is now computed before compositing, so displacement works in any order. **LFO modulation** on every live slider: 7 waves, whole cycles per loop so loops stay seamless, live indicator dot, *Random LFOs* / *Clear all*. **🔗 Share links**: compressed settings in the URL hash, loaded on open.
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
