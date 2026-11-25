// Entoptica — parameter schema, palettes, presets, randomizer
export const VERSION = '0.2.1';

export const BLENDS = ['Normal', 'Add', 'Screen', 'Multiply', 'Difference', 'Lighten', 'Overlay', 'Exclusion'];

export const PALETTES = [
  ['Rainbow',  [.5, .5, .5], [.5, .5, .5], [1, 1, 1], [0, .33, .67]],
  ['Acid',     [.5, .5, .5], [.5, .5, .5], [1, 1, 1], [0, .10, .20]],
  ['Sunset',   [.5, .5, .5], [.5, .5, .5], [1, 1, .5], [.8, .9, .3]],
  ['Ocean',    [.5, .5, .5], [.5, .5, .5], [1, .7, .4], [0, .15, .2]],
  ['Neon',     [.5, .5, .5], [.5, .5, .5], [2, 1, 0], [.5, .2, .25]],
  ['Toxic',    [.8, .5, .4], [.2, .4, .2], [2, 1, 1], [0, .25, .25]],
  ['Infrared', [.5, .5, .5], [.5, .5, .5], [1, 1, 1], [.3, .2, .2]],
  ['Fire',     [.6, .3, .15], [.5, .35, .2], [1, 1, 1], [0, .1, .2]],
  ['Velvet',   [.55, .4, .55], [.45, .35, .45], [1, 1, 1], [.65, .15, .85]],
  ['Candy',    [.65, .5, .6], [.35, .4, .4], [1, 2, 1], [.1, .5, .8]],
  ['Plasma',   [.5, .5, .5], [.5, .5, .5], [1, 1, 1], [.0, .25, .75]],
  ['Mono',     [.5, .5, .5], [.5, .5, .5], [1, 1, 1], [0, 0, 0]],
];
const PAL_OPTS = PALETTES.map(p => p[0]);

export const MAP_TYPES = ['None', 'Droste spiral', 'Power zⁿ', 'Möbius (disk)', 'Blaschke', 'Exp', 'Log spiral',
  'Sin', 'Tan', 'Joukowski', 'Circle inversion', 'Twirl + ripple', 'Tunnel', 'Julia warp'];
// [a range, b range, a default, b default, a label, b label, a step, b step]
export const MAP_PARAMS = [
  [[0, 1], [0, 1], 0, 0, 'a', 'b', .01, .01],
  [[1.2, 12], [-4, 4], 3, 1, 'ratio', 'strands', .01, 1],
  [[-5, 5], [-3.1416, 3.1416], 2, 0, 'power', 'phase', .01, .01],
  [[-.95, .95], [-.95, .95], .4, 0, 're c', 'im c', .01, .01],
  [[2, 8], [0, .95], 3, .5, 'zeros', 'radius', 1, .01],
  [[.2, 4], [-3.1416, 3.1416], 1, 0, 'scale', 'shift', .01, .01],
  [[.1, 3], [-3, 3], 1, .5, 'scale', 'twist', .01, .01],
  [[.2, 4], [.2, 2], 1, 1, 'freq', 'amp', .01, .01],
  [[.2, 4], [.2, 2], 1, 1, 'freq', 'amp', .01, .01],
  [[0, 1.5], [-1, 1], .7, 0, 're c', 'im c', .01, .01],
  [[.1, 2], [-1, 1], .8, 0, 'radius', 'offset', .01, .01],
  [[-8, 8], [0, .5], 2, .1, 'twirl', 'ripple', .01, .01],
  [[.2, 3], [-2, 2], 1, 0, 'depth', 'travel', .01, .01],
  [[1, 6], [-3.1416, 3.1416], 2, .5, 'iters', 'c angle', 1, .01],
];

export const SYM_TYPES = ['None', 'Mirror X', 'Mirror XY', 'Kaleidoscope', 'Rotational', 'Square tile (p4m)', 'Hex tile', 'Inversion mirror'];

// Control helpers
const R = (k, label, min, max, step, v, o = {}) => ({ k, label, t: 'range', min, max, step, v, ...o });
const S = (k, label, opts, v, o = {}) => ({ k, label, t: 'select', opts, v, ...o });
const C = (k, label, v, o = {}) => ({ k, label, t: 'check', v, ...o });
const B = (k, label, o = {}) => ({ k, label, t: 'button', ...o });

function sourceHead(p, on, op, bl) {
  return [C(p + '_on', 'Enabled', on, { struct: 1 }), R(p + '_op', 'Opacity', 0, 1, .01, op, { r: [.45, 1] }), S(p + '_bl', 'Blend', BLENDS, bl)];
}

function mapSlot(i, type) {
  const d = MAP_PARAMS[type];
  return [
    S(`m${i}_t`, `Map ${i} type`, MAP_TYPES, type, { struct: 1 }),
    R(`m${i}_a`, `Map ${i} a`, -12, 12, .01, d[2], { dyn: 'a' }),
    R(`m${i}_b`, `Map ${i} b`, -4, 4, .01, d[3], { dyn: 'b' }),
    R(`m${i}_sc`, `Map ${i} scale`, .1, 4, .01, 1, { r: [.5, 2] }),
    R(`m${i}_rot`, `Map ${i} rotate°`, -180, 180, 1, 0),
    R(`m${i}_spin`, `Map ${i} spin /loop`, -3, 3, 1, 0, { r: [-1, 1] }),
  ];
}

export const SCHEMA = [
  { id: 'photo', title: 'Photo', ctl: [
    ...sourceHead('ph', true, 1, 0),
    B('ph_load', 'Load image / video…', { act: 1 }), B('ph_cam', 'Camera on / off', { act: 1 }), B('ph_test', 'Built-in test card', { act: 1 }),
    R('ph_scale', 'Scale', .05, 8, .01, 1, { r: [.4, 2] }),
    R('ph_x', 'Position X', -4, 4, .001, 0, { norand: 1 }),
    R('ph_y', 'Position Y', -4, 4, .001, 0, { norand: 1 }),
    R('ph_rot', 'Rotation°', -180, 180, .1, 0, { norand: 1 }),
    C('ph_fx', 'Flip horizontal', false, { norand: 1 }), C('ph_fy', 'Flip vertical', false, { norand: 1 }),
    B('ph_move', 'Drag moves image (toggle)', { act: 1 }), B('ph_reset', 'Reset image position', { act: 1 }),
    S('ph_edge', 'Outside image', ['Mirror tile', 'Repeat tile', 'Empty'], 2),
    R('ph_disp', 'Warp displacement', 0, 2, .01, 0, { r: [0, .8] }),
    R('ph_hue', 'Hue shift', 0, 1, .01, 0),
    R('ph_sat', 'Saturation', 0, 3, .01, 1, { r: [.6, 2] }),
  ] },
  { id: 'warp', title: 'Warp', ctl: [
    ...sourceHead('dw', false, .7, 2),
    R('dw_oct', 'Octaves', 1, 6, 1, 4, { struct: 1, r: [2, 5] }),
    R('dw_iter', 'Warp depth', 1, 4, 1, 2, { struct: 1 }),
    R('dw_scale', 'Scale', .1, 6, .01, 1.5),
    R('dw_str', 'Strength', 0, 8, .01, 3, { r: [.5, 6] }),
    R('dw_flow', 'Flow cycles /loop', 0, 4, 1, 1),
    R('dw_flowr', 'Flow radius', 0, 3, .01, .6),
    R('dw_con', 'Color density', .1, 6, .01, 1.6),
    S('dw_pal', 'Palette', PAL_OPTS, 1), R('dw_off', 'Palette offset', 0, 1, .01, 0),
  ] },
  { id: 'quasi', title: 'Quasicrystal', ctl: [
    ...sourceHead('qc', false, .8, 4),
    R('qc_n', 'Waves', 3, 16, 1, 7),
    R('qc_freq', 'Frequency', 1, 80, .1, 18, { r: [6, 40] }),
    R('qc_speed', 'Phase cycles /loop', -6, 6, 1, 1),
    R('qc_twist', 'Radial twist', -20, 20, .1, 0, { r: [-6, 6] }),
    R('qc_con', 'Contrast', .1, 6, .01, 1.5),
    S('qc_mode', 'Mode', ['Smooth', 'Folded bands', 'Threshold'], 0),
    S('qc_pal', 'Palette', PAL_OPTS, 0), R('qc_off', 'Palette offset', 0, 1, .01, 0),
  ] },
  { id: 'rd', title: 'Reaction-Diffusion', ctl: [
    ...sourceHead('rd', false, 1, 2),
    S('rd_res', 'Sim size', ['256', '512', '1024'], 1, { struct: 1, norand: 1 }),
    R('rd_steps', 'Steps / frame', 1, 32, 1, 12, { r: [6, 20] }),
    R('rd_feed', 'Feed', .01, .1, .0005, .037),
    R('rd_kill', 'Kill', .04, .075, .0005, .06),
    R('rd_var', 'Feed/kill variation', 0, 1, .01, .3),
    S('rd_mod', 'Variation source', ['None', 'Noise', 'Photo'], 1),
    R('rd_adv', 'Flow advection', 0, 2, .01, 0, { r: [0, .6] }),
    S('rd_seedm', 'Seed pattern', ['Spots', 'Center', 'Photo', 'Noise'], 0),
    B('rd_seed', 'Reseed', { act: 1 }),
    R('rd_scale', 'Display scale', .2, 4, .01, 1),
    R('rd_gain', 'Color gain', .2, 6, .01, 2),
    C('rd_inv', 'Invert', false),
    S('rd_pal', 'Palette', PAL_OPTS, 4), R('rd_off', 'Palette offset', 0, 1, .01, 0),
  ] },
  { id: 'phys', title: 'Physarum', ctl: [
    ...sourceHead('py', false, 1, 1),
    S('py_n', 'Agents', ['16k', '65k', '262k', '1M'], 2, { struct: 1, norand: 1 }),
    S('py_res', 'Trail size', ['256', '512', '1024'], 1, { struct: 1, norand: 1 }),
    R('py_sa', 'Sensor angle°', 5, 90, 1, 30),
    R('py_sd', 'Sensor distance', 1, 40, .1, 9),
    R('py_ra', 'Turn angle°', 1, 90, 1, 25),
    R('py_speed', 'Speed', .2, 4, .01, 1.2),
    R('py_dep', 'Deposit', .01, 1, .01, .15),
    R('py_decay', 'Decay', .8, .999, .001, .93),
    R('py_diff', 'Diffuse', 0, 1, .01, .5),
    R('py_att', 'Photo attraction', 0, 4, .01, 0, { r: [0, 1.5] }),
    R('py_steps', 'Steps / frame', 1, 4, 1, 1, { norand: 1 }),
    S('py_spawn', 'Spawn', ['Random', 'Center burst', 'Ring inward', 'Spiral'], 0),
    B('py_seed', 'Respawn', { act: 1 }),
    R('py_scale', 'Display scale', .2, 4, .01, 1),
    R('py_gain', 'Color gain', .05, 4, .01, .6),
    S('py_pal', 'Palette', PAL_OPTS, 8), R('py_off', 'Palette offset', 0, 1, .01, 0),
  ] },
  { id: 'fractal', title: 'Fractal', ctl: [
    ...sourceHead('fr', false, 1, 0),
    S('fr_type', 'Type', ['Julia', 'Mandelbrot', 'Burning Ship Julia'], 0),
    S('fr_trap', 'Coloring', ['Smooth escape', 'Point trap', 'Ring trap', 'Cross trap'], 1),
    R('fr_iter', 'Iterations', 8, 200, 1, 80, { r: [30, 120] }),
    R('fr_zoom', 'Zoom', .1, 20, .01, 1.2, { r: [.5, 3] }),
    R('fr_cx', 'Center X', -2, 2, .001, 0, { r: [-.6, .3] }),
    R('fr_cy', 'Center Y', -2, 2, .001, 0, { r: [-.4, .4] }),
    R('fr_cr', 'Julia c radius', 0, 1.2, .001, .815, { r: [.62, .82] }),
    R('fr_ca', 'Julia c angle°', -180, 180, .1, 169),
    R('fr_cyc', 'c orbit cycles /loop', -3, 3, 1, 1, { r: [-1, 1] }),
    R('fr_den', 'Color density', .1, 6, .01, 1.5),
    S('fr_pal', 'Palette', PAL_OPTS, 4), R('fr_off', 'Palette offset', 0, 1, .01, 0),
  ] },
  { id: 'pattern', title: 'Pattern', ctl: [
    ...sourceHead('pt', false, 1, 0),
    S('pt_mode', 'Mode', ['Hypno spiral', 'Moiré rings', 'Voronoi cells', 'Truchet arcs', 'Warped checker'], 0),
    R('pt_scale', 'Scale', .2, 6, .01, 1.5),
    R('pt_k', 'Count / frequency', 1, 24, 1, 6, { r: [2, 14] }),
    R('pt_sharp', 'Sharpness', .5, 20, .1, 3, { r: [1, 8] }),
    R('pt_twist', 'Twist', -4, 4, .01, 1, { r: [-2, 2] }),
    R('pt_cyc', 'Cycles /loop', -6, 6, 1, 1, { r: [-2, 2] }),
    S('pt_pal', 'Palette', PAL_OPTS, 4), R('pt_off', 'Palette offset', 0, 1, .01, 0),
  ] },
  { id: 'maps', title: 'Maps', ctl: [
    ...mapSlot(1, 0), ...mapSlot(2, 0), ...mapSlot(3, 0), ...mapSlot(4, 0),
  ] },
  { id: 'sym', title: 'Symmetry', ctl: [
    S('sy_mode', 'Mode', SYM_TYPES, 0, { struct: 1 }),
    R('sy_n', 'Folds', 2, 24, 1, 6, { r: [3, 12] }),
    R('sy_rot', 'Rotate°', -180, 180, 1, 0),
    R('sy_spin', 'Spin /loop', -3, 3, 1, 0, { r: [-1, 1] }),
    R('sy_cell', 'Tile size', .1, 3, .01, .8),
  ] },
  { id: 'fb', title: 'Feedback', ctl: [
    R('fb_amt', 'Amount', 0, .99, .01, 0, { r: [0, .8] }),
    S('fb_mode', 'Mode', ['Mix', 'Lighten', 'Difference', 'Screen'], 0),
    R('fb_zoom', 'Zoom', .8, 1.25, .001, 1.02, { r: [.95, 1.06] }),
    R('fb_rot', 'Rotate° (per 1/60 s)', -10, 10, .01, .5, { r: [-3, 3] }),
    R('fb_hue', 'Hue shift (per 1/60 s)', -.2, .2, .001, .01, { r: [-.05, .05] }),
    R('fb_dx', 'Drift X', -.02, .02, .0005, 0, { r: [-.005, .005] }),
    R('fb_dy', 'Drift Y', -.02, .02, .0005, 0, { r: [-.005, .005] }),
    R('fb_disp', 'Luma displace', -.05, .05, .0005, 0, { r: [-.02, .02] }),
    C('fb_loop', 'Palette inside loop', false),
    B('fb_clear', 'Clear trails', { act: 1 }),
  ] },
  { id: 'pal', title: 'Palette', ctl: [
    R('pc_amt', 'Amount', 0, 1, .01, 0, { r: [0, 1] }),
    S('pc_pal', 'Palette', PAL_OPTS, 0),
    R('pc_off', 'Offset', 0, 1, .01, 0),
    R('pc_cyc', 'Cycles /loop', -6, 6, 1, 1),
    R('pc_bands', 'Bands', .2, 12, .01, 1.5, { r: [.5, 5] }),
    S('pc_src', 'Index from', ['Luminance', 'Hue', 'Hue + luma', 'Radial + luma'], 0),
    R('pc_post', 'Posterize', 0, 24, 1, 0, { r: [0, 0] }),
  ] },
  { id: 'fx', title: 'FX', ctl: [
    R('fx_rip', 'Ripple', 0, 2, .01, 0, { r: [0, .5] }),
    R('fx_rfreq', 'Ripple frequency', .5, 20, .1, 4),
    R('fx_rcyc', 'Ripple cycles /loop', -6, 6, 1, 1, { r: [-2, 2] }),
    R('fx_swirl', 'Swirl', -6, 6, .01, 0, { r: [-2, 2] }),
    R('fx_swr', 'Swirl radius', .1, 2, .01, .8),
    R('fx_glitch', 'Glitch slices', 0, 1, .01, 0, { r: [0, .4] }),
    R('fx_slices', 'Slice count', 4, 120, 1, 40),
    R('fx_grate', 'Glitch steps /loop', 1, 120, 1, 24),
    R('fx_liquid', 'Liquid RGB', 0, 4, .01, 0, { r: [0, 1.5] }),
    R('fx_pix', 'Pixelate', 0, 64, 1, 0, { r: [0, 0] }),
    R('fx_ht', 'Halftone', 0, 1, .01, 0, { r: [0, 0] }),
    R('fx_hts', 'Halftone size', 3, 40, .5, 10),
    R('fx_sol', 'Solarize', 0, 1, .01, 0, { r: [0, .4] }),
    R('fx_scan', 'Scanlines', 0, 1, .01, 0, { r: [0, 0] }),
    C('fx_mirror', 'Mirror left ↔ right', false),
  ] },
  { id: 'post', title: 'Post', ctl: [
    R('po_chroma', 'Chromatic split', 0, .05, .0005, 0, { r: [0, .015] }),
    R('po_bloom', 'Bloom', 0, 3, .01, 0, { r: [0, 1.2] }),
    R('po_bthr', 'Bloom threshold', 0, 1, .01, .55),
    R('po_brad', 'Bloom radius', 1, 4, 1, 2),
    R('po_edge', 'Edge glow', 0, 4, .01, 0, { r: [0, 1] }),
    R('po_sat', 'Saturation', 0, 3, .01, 1, { r: [.8, 1.8] }),
    R('po_con', 'Contrast', .3, 2.5, .01, 1, { r: [.8, 1.4] }),
    R('po_bri', 'Brightness', -.5, .5, .01, 0, { r: [-.1, .1] }),
    R('po_hue', 'Hue rotate', 0, 1, .01, 0),
    R('po_vig', 'Vignette', 0, 1.5, .01, 0, { r: [0, .7] }),
    R('po_grain', 'Grain', 0, .3, .005, 0, { r: [0, .06] }),
    C('po_inv', 'Invert', false, { norand: 1 }),
  ] },
  { id: 'motion', title: 'Motion', ctl: [
    B('mo_play', 'Play / pause', { act: 1 }),
    R('mo_loop', 'Loop length (s)', 2, 60, .5, 12, { norand: 1 }),
    R('mo_speed', 'Time scale', 0, 4, .01, 1, { norand: 1 }),
    C('mo_morph', 'Morph A ↔ B', false, { norand: 1 }),
    R('mo_mcyc', 'Morph cycles /loop', 1, 4, 1, 1, { norand: 1 }),
    B('mo_capA', 'Capture A', { act: 1 }), B('mo_capB', 'Capture B', { act: 1 }),
    B('mo_view', 'Reset view', { act: 1 }),
  ] },
  { id: 'out', title: 'Output', ctl: [
    R('rs', 'Render scale', .25, 1.5, .05, 1, { norand: 1 }),
    S('png_size', 'PNG size', ['View', '2048', '4096', '8192'], 1, { norand: 1 }),
    B('png', 'Save PNG', { act: 1 }),
    S('rec_fmt', 'Video format', ['MP4', 'WebM'], 0, { norand: 1 }),
    S('rec_size', 'Loop render size', ['View', '720p', '1080p', 'Square 1080', 'Vertical 1080×1920'], 2, { norand: 1 }),
    S('rec_fps', 'FPS', ['24', '30', '60'], 1, { norand: 1 }),
    R('rec_pre', 'Pre-roll (s)', 0, 20, .5, 2, { norand: 1 }),
    B('rec_loop', 'Render one loop', { act: 1 }),
    B('rec_live', 'Record live (start / stop)', { act: 1 }),
    B('json_save', 'Save settings (.json)', { act: 1 }), B('json_load', 'Load settings…', { act: 1 }),
  ] },
];

export const CONTROLS = {};
for (const sec of SCHEMA) for (const c of sec.ctl) { c.sec = sec.id; CONTROLS[c.k] = c; }

export function defaults() {
  const P = { vx: 0, vy: 0, vz: 1, vr: 0 };
  for (const k in CONTROLS) { const c = CONTROLS[k]; if (c.t !== 'button') P[k] = c.v; }
  return P;
}

// Effective range for a control (map a/b ranges depend on map type)
export function rangeOf(c, P) {
  if (c.dyn) {
    const i = c.k[1];
    const d = MAP_PARAMS[P[`m${i}_t`] | 0] || MAP_PARAMS[0];
    const r = c.dyn === 'a' ? d[0] : d[1];
    return { min: r[0], max: r[1], step: c.dyn === 'a' ? d[6] : d[7], label: `Map ${i} ${c.dyn === 'a' ? d[4] : d[5]}` };
  }
  return { min: c.min, max: c.max, step: c.step, label: c.label };
}

function rnd(a, b) { return a + Math.random() * (b - a); }
function quant(v, step, min) { return step >= 1 ? Math.round(v) : Math.round((v - min) / step) * step + min; }

export function randomizeSection(P, secId) {
  const sec = SCHEMA.find(s => s.id === secId);
  for (const c of sec.ctl) {
    if (c.t === 'button' || c.norand || c.hidden) continue;
    if (c.t === 'check') { if (!c.k.endsWith('_on')) P[c.k] = Math.random() < .3; continue; }
    if (c.t === 'select') {
      if (c.k.startsWith('m') && c.k.endsWith('_t')) P[c.k] = Math.random() < .45 ? 0 : 1 + Math.floor(Math.random() * (MAP_TYPES.length - 1));
      else P[c.k] = Math.floor(Math.random() * c.opts.length);
      continue;
    }
    if (c.dyn) continue; // after types
    const r = c.r || [c.min, c.max];
    P[c.k] = +quant(rnd(r[0], r[1]), c.step, c.min).toFixed(5);
  }
  for (const c of sec.ctl) if (c.dyn) {
    const g = rangeOf(c, P);
    P[c.k] = +quant(rnd(g.min, g.max), g.step, g.min).toFixed(4);
  }
  if (secId === 'maps') {
    // keep the stack sane: at most 3 active maps, at least one
    let act = [1, 2, 3, 4].filter(i => P[`m${i}_t`] > 0);
    while (act.length > 3) { P[`m${act.pop()}_t`] = 0; }
    if (!act.length) P.m1_t = 1 + Math.floor(Math.random() * (MAP_TYPES.length - 1));
    for (const i of [1, 2, 3, 4]) { const g = rangeOf(CONTROLS[`m${i}_a`], P); P[`m${i}_a`] = Math.min(g.max, Math.max(g.min, P[`m${i}_a`])); }
  }
}

export function randomizeSourceMix(P) {
  const keys = ['ph', 'dw', 'qc', 'rd', 'py'];
  for (const k of keys) P[k + '_on'] = Math.random() < .45;
  if (!keys.some(k => P[k + '_on'])) P[keys[1 + Math.floor(Math.random() * 2)] + '_on'] = true;
}

// Presets: deltas from defaults
// Post look the effect presets were tuned with (the defaults are now neutral)
const LOOK = { ph_edge: 0, po_chroma: .004, po_bloom: .4, po_sat: 1.15, po_con: 1.05, po_vig: .3, po_grain: .02 };

export const BASE_PRESET = 'Base image only';
export const PRESETS = {
  [BASE_PRESET]: {},
  'Acid Droste': { ...LOOK, ph_on: true, dw_on: true, dw_op: .55, dw_bl: 6, m1_t: 1, m1_a: 4, m1_b: 1, m1_sc: 1, pc_amt: .45, pc_cyc: 1, pc_bands: 2, po_bloom: .6, fb_amt: 0 },
  'Quasicrystal Mandala': { ...LOOK, ph_on: false, qc_on: true, qc_op: 1, qc_bl: 0, qc_n: 7, qc_freq: 22, qc_speed: 1, qc_con: 2.2, qc_mode: 1, qc_pal: 4, sy_mode: 3, sy_n: 8, m1_t: 2, m1_a: 1.5, pc_amt: .3, po_bloom: .8, po_chroma: .006 },
  'Liquid Marble': { ...LOOK, ph_on: false, dw_on: true, dw_op: 1, dw_bl: 0, dw_oct: 5, dw_iter: 3, dw_str: 4.2, dw_scale: 1.2, dw_con: 2.2, dw_pal: 9, m1_t: 11, m1_a: 1.5, m1_b: .06, fb_amt: .45, fb_zoom: 1.004, fb_rot: .2, fb_hue: .004, po_bloom: .5 },
  'Coral Tunnel': { ...LOOK, ph_on: false, rd_on: true, rd_op: 1, rd_bl: 0, rd_seedm: 3, rd_steps: 20, rd_feed: .0367, rd_kill: .0649, rd_var: .4, rd_pal: 7, rd_gain: 2.4, m1_t: 12, m1_a: 1.2, m1_spin: 1, sy_mode: 0, po_bloom: .9, po_bthr: .4, pc_amt: .25 },
  'Slime Nebula': { ...LOOK, ph_on: false, py_on: true, py_op: 1, py_bl: 0, py_sa: 28, py_sd: 12, py_ra: 22, py_decay: .95, py_gain: .5, py_pal: 8, sy_mode: 3, sy_n: 6, fb_amt: .5, fb_zoom: 1.01, fb_rot: .3, fb_hue: .006, fb_mode: 1, po_bloom: 1.2, po_bthr: .3 },
  'Blaschke Bloom': { ...LOOK, ph_on: true, qc_on: true, qc_op: .5, qc_bl: 7, qc_n: 5, qc_freq: 14, m1_t: 4, m1_a: 4, m1_b: .6, m1_spin: 1, m2_t: 1, m2_a: 2.6, m2_b: 1, pc_amt: .55, pc_bands: 2.5, pc_cyc: 2, po_bloom: .7 },
  'Feedback Vortex': { ...LOOK, ph_on: true, dw_on: true, dw_op: .4, dw_bl: 4, m1_t: 3, m1_a: .35, m1_b: .25, m1_spin: 1, sy_mode: 3, sy_n: 6, fb_amt: .78, fb_zoom: 1.03, fb_rot: 1.5, fb_hue: .02, fb_mode: 1, fb_loop: false, pc_amt: .3, pc_cyc: 1, po_bloom: .6 },
  'Julia Trance': { ...LOOK, ph_on: false, fr_on: true, fr_type: 0, fr_trap: 2, fr_iter: 90, fr_zoom: 1.1, fr_cr: .815, fr_ca: 169, fr_cyc: 1, fr_den: 1.4, fr_pal: 4, po_bloom: .6, pc_amt: .2, fx_rip: .12, fx_rfreq: 3 },
  'Hypno Glitch': { ...LOOK, ph_on: true, pt_on: true, pt_op: .85, pt_bl: 4, pt_mode: 0, pt_k: 6, pt_sharp: 4, pt_twist: 1.2, pt_cyc: 2, pt_pal: 4, fx_glitch: .35, fx_grate: 24, fx_liquid: .8, fx_scan: .3 },
  'Voronoi Acid': { ...LOOK, ph_on: false, dw_on: true, dw_op: 1, dw_bl: 0, pt_on: true, pt_op: .75, pt_bl: 6, pt_mode: 2, pt_scale: 1.2, pt_k: 8, pt_twist: .6, pt_sharp: 3, pt_pal: 1, m1_t: 11, m1_a: 1.2, m1_b: .08, fx_swirl: 1.2, fx_swr: .9, po_bloom: .5 },
  'Halftone Pop': { ...LOOK, ph_on: true, ph_edge: 0, m1_t: 1, m1_a: 3, m1_b: 1, pc_amt: .6, pc_pal: 9, fx_ht: 1, fx_hts: 9, po_bloom: 0, po_vig: 0, po_chroma: 0 },
  'Everything': { ...LOOK, ph_on: true, ph_op: .7, dw_on: true, dw_op: .5, dw_bl: 2, qc_on: true, qc_op: .45, qc_bl: 4, qc_n: 9, rd_on: true, rd_op: .6, rd_bl: 2, py_on: true, py_op: .8, py_bl: 1, py_gain: .4, m1_t: 1, m1_a: 3.2, m1_b: 1, m2_t: 11, m2_a: 1.2, m2_b: .05, sy_mode: 3, sy_n: 6, fb_amt: .5, fb_zoom: 1.012, fb_rot: .6, fb_hue: .008, pc_amt: .35, pc_cyc: 1, po_bloom: .7, po_chroma: .006 },
};
