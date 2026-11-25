// Entoptica — psychedelic layer-pipeline image engine
import { createGL, compile, makeTarget, freeTarget, makePingPong, freePingPong, pass, makeTex } from './engine/gl.js';
import { VS, composeFS, FEEDBACK_FS, PALETTE_FS, BRIGHT_FS, BLUR_FS, POST_FS } from './engine/shaders.js';
import { Sims } from './engine/sims.js';
import { VERSION, SCHEMA, CONTROLS, PALETTES, MAP_PARAMS, PRESETS, defaults, randomizeSection, rangeOf, normOrder, modulatable, lfoValue, randomLFO, LAYER_INFO } from './engine/params.js';
import { encodeState, decodeState, copyText } from './engine/share.js';
import { UI } from './engine/ui.js';
import { createH264, hasWebCodecs, pickRecorderMime, startMediaRecorder, download } from './engine/video.js';

const LS = 'entoptica.';
// One-time migration: carry saved settings, section locks, tab and confirm choice over from the old name (Ekstasis ≤ 0.2.0)
(() => {
  try {
    if (localStorage.getItem(LS + 'migrated')) return;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('ekstasis.')) { const nk = LS + k.slice(9); if (localStorage.getItem(nk) === null) localStorage.setItem(nk, localStorage.getItem(k)); }
    }
    localStorage.setItem(LS + 'migrated', '1');
  } catch (e) { /* storage unavailable */ }
})();
const STRUCT = Object.keys(CONTROLS).filter(k => CONTROLS[k].struct);
const SOURCES = ['ph', 'dw', 'qc', 'rd', 'py', 'fr', 'pt'];
const SRC_SEC = { ph: 'photo', dw: 'warp', qc: 'quasi', rd: 'rd', py: 'phys', fr: 'fractal', pt: 'pattern' };
const NO_MORPH = /(_spin|_flow|qc_speed|pc_cyc|fr_cyc|pt_cyc|fx_rcyc|fx_grate|fx_slices|pt_k|^mo_|_steps|^rs$|^rec_|^png_)/;
const RD_SIZES = [256, 512, 1024], PY_SIDES = [128, 256, 512, 1024], PY_TRAILS = [256, 512, 1024];
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const $ = (id) => document.getElementById(id);
const stamp = () => new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);

class App {
  constructor() {
    this.canvas = $('gl'); this.view = $('view');
    try { this.core = createGL(this.canvas); } catch (e) { $('hud').textContent = e.message; throw e; }
    this.gl = this.core.gl;
    this.P = defaults();
    // Always start clean (base image, no effects). The previous session stays restorable from the preset menu.
    this.lastSession = null;
    try { const s = JSON.parse(localStorage.getItem(LS + 'state') || 'null'); if (s && typeof s === 'object') this.lastSession = s; } catch (e) { /* ignore */ }
    this.A = {};
    this.confirm = localStorage.getItem(LS + 'confirm') !== '0';
    this.hist = []; this.hi = -1;
    this.time = 0; this.playing = true; this.last = performance.now();
    this.morphA = null; this.morphB = null;
    this.offline = false; this.override = null; this.live = null;
    this.fpsAcc = 0; this.fpsN = 0;

    const gl = this.gl;
    this.pFb = compile(gl, VS, FEEDBACK_FS, 'feedback');
    this.pPal = compile(gl, VS, PALETTE_FS, 'palette');
    this.pBright = compile(gl, VS, BRIGHT_FS, 'bright');
    this.pBlur = compile(gl, VS, BLUR_FS, 'blur');
    this.pPost = compile(gl, VS, POST_FS, 'post');
    this.pComp = null; this.compKey = '';

    this.photoTex = makeTex(gl, 1, 1, gl.UNSIGNED_BYTE, true, false, new Uint8Array([128, 128, 128, 255]));
    this.photoAsp = 1; this.video = null; this.camStream = null;
    this.setTestCard();

    this.sims = new Sims(this.core);
    this.ui = new UI($('panel'), this);
    this.wireHeader();
    this.wireInput();
    this.applyStruct(true);
    this.commit();
    this.loadFromHash();
    addEventListener('hashchange', () => this.loadFromHash());

    new ResizeObserver(() => this.resize()).observe(this.view);
    this.resize();
    addEventListener('keydown', (e) => this.onKey(e));
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---------- state ----------
  applyStruct(reseed) {
    for (const k of STRUCT) this.A[k] = this.P[k];
    const A = this.A, S = this.sims;
    if (A.rd_on && S.rdOk) { const had = !!S.rd; S.ensureRD(RD_SIZES[A.rd_res], this.P, this.photoTex); if (reseed && had) S.seedRD(this.P, this.photoTex); }
    if (A.py_on && S.pyOk) { const had = !!S.ag; S.ensurePY(PY_SIDES[A.py_n], PY_TRAILS[A.py_res], this.P); if (reseed && had) S.spawnPY(this.P); }
    this.rebuildCompose();
    this.ui.setPending(false);
  }
  rebuildCompose() {
    const A = this.A, S = this.sims;
    const spec = {
      ph: !!A.ph_on, dw: !!A.dw_on, qc: !!A.qc_on, rd: !!A.rd_on && S.rdOk, py: !!A.py_on && S.pyOk, fr: !!A.fr_on, pt: !!A.pt_on,
      dwOct: A.dw_oct, dwIter: A.dw_iter, dwBasis: A.dw_wave | 0, order: normOrder(this.P.lay), maps: [A.m1_t, A.m2_t, A.m3_t, A.m4_t].map(v => v | 0), sym: A.sy_mode | 0,
    };
    const key = JSON.stringify(spec);
    if (key === this.compKey && this.pComp) return;
    try {
      const p = compile(this.gl, VS, composeFS(spec), 'compose');
      if (this.pComp) this.gl.deleteProgram(this.pComp.prog);
      this.pComp = p; this.compKey = key;
    } catch (e) { console.error(e); this.toast('Shader error: ' + e.message.slice(0, 160)); }
  }
  commit() {
    const s = JSON.stringify(this.P);
    if (this.hist[this.hi] === s) return;
    this.hist = this.hist.slice(0, this.hi + 1); this.hist.push(s);
    if (this.hist.length > 120) this.hist.shift();
    this.hi = this.hist.length - 1;
    this.save();
  }
  save() { clearTimeout(this._sv); this._sv = setTimeout(() => { try { localStorage.setItem(LS + 'state', JSON.stringify(this.P)); } catch (e) { /* quota */ } }, 300); }
  restore(s) {
    const o = JSON.parse(s); this.P = Object.assign(defaults(), o);
    this.ui.syncAll(); this.applyStruct(false); this.save();
  }
  undo() { if (this.hi > 0) { this.hi--; this.restore(this.hist[this.hi]); } }
  redo() { if (this.hi < this.hist.length - 1) { this.hi++; this.restore(this.hist[this.hi]); } }
  paramsChanged(k) { if (k === 'rs') this.resize(); this.save(); }
  mapTypeChanged(i) {
    const t = this.P[`m${i}_t`] | 0, d = MAP_PARAMS[t];
    this.P[`m${i}_a`] = d[2]; this.P[`m${i}_b`] = d[3];
    this.ui.sync(`m${i}_a`); this.ui.sync(`m${i}_b`);
  }
  locked(sec) { return this.ui.locks[sec]?.checked; }
  randomizeSection(id) {
    randomizeSection(this.P, id);
    this.afterBigChange(true);
  }
  randomizeAll() {
    for (const sec of SCHEMA) if (!['motion', 'out'].includes(sec.id) && !this.locked(sec.id)) randomizeSection(this.P, sec.id);
    const free = SOURCES.filter(s => !this.locked(SRC_SEC[s]));
    for (const s of free) this.P[s + '_on'] = Math.random() < (s === 'ph' ? .4 : .45);
    // always keep an instant, full-frame base layer (sims start empty)
    if (!['ph', 'dw', 'qc', 'fr', 'pt'].some(s => this.P[s + '_on'])) {
      const base = ['dw', 'qc', 'ph', 'fr', 'pt'].filter(s => !this.locked(SRC_SEC[s]));
      this.P[(base.length ? base : ['dw'])[Math.floor(Math.random() * (base.length || 1))] + '_on'] = true;
    }
    // first layer in compose order is opaque Normal so nothing blends onto black
    const first = normOrder(this.P.lay).find(s => this.P[s + '_on']);
    if (first && !this.locked(SRC_SEC[first])) { this.P[first + '_bl'] = 0; this.P[first + '_op'] = Math.max(.85, this.P[first + '_op']); }
    if (!this.locked('fb') && Math.random() < .45) this.P.fb_amt = 0;
    if (!this.locked('fx')) for (const k of ['fx_rip', 'fx_swirl', 'fx_glitch', 'fx_liquid', 'fx_sol']) if (Math.random() < .6) this.P[k] = 0;
    if (!this.locked('layers') && Math.random() < .35) randomizeSection(this.P, 'layers');
    // keep the bottom-most enabled layer opaque Normal after any shuffle
    const base0 = normOrder(this.P.lay).find(s => this.P[s + '_on']);
    if (base0 && !this.locked(SRC_SEC[base0])) { this.P[base0 + '_bl'] = 0; this.P[base0 + '_op'] = Math.max(.85, this.P[base0 + '_op']); }
    // never wipe LFOs the user set up; occasionally add some when there are none
    if (!this.P.mod || !Object.keys(this.P.mod).length) { this.P.mod = {}; if (Math.random() < .4) this.addRandomLFOs(1 + Math.floor(Math.random() * 2), true); }
    this.afterBigChange(true);
  }
  afterBigChange(reseed) {
    this.ui.syncAll(); this.applyStruct(reseed); this.commit();
  }
  applyPreset(name) {
    const keep = {};
    for (const k in this.P) if (CONTROLS[k] && ['motion', 'out'].includes(CONTROLS[k].sec)) keep[k] = this.P[k];
    this.P = Object.assign(defaults(), PRESETS[name] || {}, keep);
    this.clearFeedback();
    this.afterBigChange(true);
  }

  // ---------- header / actions ----------
  wireHeader() {
    $('ver').textContent = 'v' + VERSION;
    const ps = $('preset');
    ps.innerHTML = '<option value="">Presets…</option>' + Object.keys(PRESETS).map(n => `<option>${n}</option>`).join('')
      + (this.lastSession ? '<option value="__last">↺ Last session</option>' : '');
    ps.onchange = () => {
      if (ps.value === '__last') { this.P = Object.assign(defaults(), this.lastSession); this.clearFeedback(); this.afterBigChange(true); this.toast('Last session restored'); }
      else if (ps.value) this.applyPreset(ps.value);
      ps.value = '';
    };
    $('rand').onclick = () => this.randomizeAll();
    $('linkBtn').onclick = () => this.copyLink();
    $('undo').onclick = () => this.undo();
    $('redo').onclick = () => this.redo();
    $('play').onclick = () => this.togglePlay();
    $('dragmode').onclick = () => this.setDragImage(!this.dragImage);
    const cf = $('confirm'); cf.checked = this.confirm;
    cf.onchange = () => { this.confirm = cf.checked; localStorage.setItem(LS + 'confirm', cf.checked ? '1' : '0'); if (!cf.checked && this.ui.pending) this.applyStruct(false); };
    $('apply').onclick = () => { this.applyStruct(false); this.commit(); };
    $('file').onchange = (e) => { const f = e.target.files[0]; if (f) this.loadMedia(f); e.target.value = ''; };
    $('jsonfile').onchange = (e) => { const f = e.target.files[0]; if (f) f.text().then(t => { try { this.P = Object.assign(defaults(), JSON.parse(t)); this.afterBigChange(true); this.toast('Settings loaded'); } catch (er) { this.toast('Not a valid settings file'); } }); e.target.value = ''; };
    $('busycancel').onclick = () => { this.cancelRender = true; };
    this.dragImage = false; this.setDragImage(false);
  }
  togglePlay() { this.playing = !this.playing; $('play').textContent = this.playing ? '❚❚' : '▶'; }
  action(k, btn) {
    const P = this.P, S = this.sims;
    switch (k) {
      case 'ph_load': $('file').click(); break;
      case 'ph_cam': this.toggleCamera(); break;
      case 'ph_test': this.stopVideo(); this.setTestCard(); break;
      case 'ph_move': this.setDragImage(!this.dragImage); break;
      case 'ph_reset': this.resetImage(); break;
      case 'rd_seed': if (S.rd) S.seedRD(P, this.photoTex); break;
      case 'py_seed': if (S.ag) S.spawnPY(P); break;
      case 'fb_clear': this.clearFeedback(); break;
      case 'mo_play': this.togglePlay(); break;
      case 'mo_capA': this.morphA = { ...P }; this.toast('Captured A'); break;
      case 'mo_capB': this.morphB = { ...P }; this.toast('Captured B — enable Morph to animate'); break;
      case 'mo_view': Object.assign(P, { vx: 0, vy: 0, vz: 1, vr: 0 }); this.commit(); break;
      case 'mo_lfo_rand': this.addRandomLFOs(3, false); this.ui.syncMods(); this.commit(); this.toast(`${Object.keys(this.P.mod).length} LFOs active`); break;
      case 'mo_lfo_clear': this.P.mod = {}; this.ui.syncMods(); this.commit(); this.toast('All LFOs cleared'); break;
      case 'png': this.savePNG(); break;
      case 'rec_loop': this.renderLoop(); break;
      case 'rec_live': this.toggleLive(); break;
      case 'json_save': download(new Blob([JSON.stringify(P, null, 1)], { type: 'application/json' }), `entoptica_v${VERSION}_${stamp()}.json`); break;
      case 'json_load': $('jsonfile').click(); break;
    }
  }
  onKey(e) {
    const tag = (document.activeElement && document.activeElement.tagName) || '';
    const typing = tag === 'INPUT' && !['range', 'checkbox'].includes(document.activeElement.type) || tag === 'TEXTAREA';
    if (e.key === 'Enter' && this.ui.pending) {
      if (tag === 'BUTTON' || typing) return;
      e.preventDefault(); this.applyStruct(false); this.commit(); return;
    }
    if (typing || tag === 'SELECT') return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? this.redo() : this.undo(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); this.redo(); }
    else if (e.key === ' ' && tag !== 'BUTTON') { e.preventDefault(); this.togglePlay(); }
    else if (e.key === 'r' && !e.ctrlKey && !e.metaKey) this.randomizeAll();
    else if (e.key === 'm' && !e.ctrlKey && !e.metaKey) this.setDragImage(!this.dragImage);
  }
  updateNotes(ui = this.ui) {
    const S = this.sims;
    ui.note('rd', S.rdOk ? '' : 'This device can’t render float textures, so Reaction-Diffusion is unavailable.');
    ui.note('phys', S.pyOk ? '' : 'This device lacks float render targets or vertex texture fetch, so Physarum is unavailable.');
    ui.note('motion', 'Everything procedural loops seamlessly over the loop length. Feedback, Reaction-Diffusion and Physarum evolve continuously.');
    const mp4 = hasWebCodecs() ? 'MP4 via WebCodecs (frame-exact)' : pickRecorderMime('mp4') ? 'MP4 via MediaRecorder' : 'MP4 not supported in this browser';
    const webm = pickRecorderMime('webm') ? 'WebM via MediaRecorder' : 'WebM not supported';
    ui.note('out', `${mp4} · ${webm}. “Render one loop” renders a seamless loop at a fixed size.`);
  }

  // ---------- media ----------
  uploadPhoto(src) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.photoTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }
  setTestCard() {
    const c = document.createElement('canvas'); c.width = c.height = 1024;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(512, 512, 20, 512, 512, 720);
    ['#ff2d95', '#ffb000', '#28e0b0', '#2a5cff', '#9b30ff', '#ff2d95'].forEach((col, i, a) => g.addColorStop(i / (a.length - 1), col));
    x.fillStyle = g; x.fillRect(0, 0, 1024, 1024);
    for (let r = 480; r > 10; r -= 40) { x.beginPath(); x.arc(512, 512, r, 0, TAU); x.lineWidth = 14; x.strokeStyle = `hsla(${r * 1.7},100%,${r % 80 ? 60 : 15}%,.85)`; x.stroke(); }
    for (let i = 0; i < 24; i++) { x.save(); x.translate(512, 512); x.rotate(i / 24 * TAU); x.fillStyle = i % 2 ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.25)'; x.beginPath(); x.moveTo(0, 0); x.lineTo(600, -60); x.lineTo(600, 60); x.fill(); x.restore(); }
    x.beginPath(); x.arc(512, 512, 120, 0, TAU); x.fillStyle = '#fff'; x.fill();
    x.beginPath(); x.arc(512, 512, 70, 0, TAU); x.fillStyle = '#1a0040'; x.fill();
    x.beginPath(); x.arc(540, 485, 20, 0, TAU); x.fillStyle = '#fff'; x.fill();
    this.uploadPhoto(c); this.photoAsp = 1;
  }
  stopVideo() {
    if (this.camStream) { this.camStream.getTracks().forEach(t => t.stop()); this.camStream = null; }
    if (this.video) { this.video.pause(); if (this.video.src) URL.revokeObjectURL(this.video.src); this.video = null; }
  }
  loadMedia(f) {
    this.stopVideo();
    if (f.type.startsWith('video/')) {
      const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true;
      v.src = URL.createObjectURL(f);
      v.onloadeddata = () => { this.video = v; this.photoAsp = v.videoWidth / v.videoHeight; v.play(); this.ensurePhotoOn(); };
    } else {
      const img = new Image();
      img.onload = () => {
        // keep within GPU limits
        const m = Math.min(4096, this.core.caps.maxTex); let w = img.naturalWidth, h = img.naturalHeight;
        let src = img;
        if (w > m || h > m) { const s = m / Math.max(w, h); const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); src = c; }
        this.uploadPhoto(src); this.photoAsp = w / h; URL.revokeObjectURL(img.src); this.ensurePhotoOn();
      };
      img.src = URL.createObjectURL(f);
    }
  }
  ensurePhotoOn() { if (!this.P.ph_on) { this.P.ph_on = true; this.afterBigChange(false); } this.toast('Photo source loaded'); }
  async toggleCamera() {
    if (this.camStream) { this.stopVideo(); this.setTestCard(); return; }
    try {
      const st = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      this.stopVideo();
      const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.srcObject = st;
      await v.play();
      this.camStream = st; this.video = v; this.photoAsp = v.videoWidth / v.videoHeight || 16 / 9; this.ensurePhotoOn();
    } catch (e) { this.toast('Camera unavailable: ' + e.message); }
  }

  // ---------- render targets ----------
  resize() {
    if (this.live && !this.override) return; // keep size fixed during live recording
    let W, H;
    if (this.override) [W, H] = this.override;
    else {
      const r = this.view.getBoundingClientRect();
      const coarse = matchMedia('(pointer: coarse)').matches;
      const dpr = Math.min(devicePixelRatio || 1, coarse ? 1.5 : 2);
      W = Math.max(2, r.width * dpr * this.P.rs); H = Math.max(2, r.height * dpr * this.P.rs);
      const cap = Math.min(2560, this.core.caps.maxOut), s = Math.min(1, cap / Math.max(W, H));
      W *= s; H *= s;
    }
    W = Math.max(2, Math.floor(W / 2) * 2); H = Math.max(2, Math.floor(H / 2) * 2);
    if (this.T && this.T.W === W && this.T.H === H) return;
    this.canvas.width = W; this.canvas.height = H;
    this.freeTargets(this.T);
    this.T = this.makeTargets(W, H, true);
  }
  makeTargets(W, H, withFb, type) {
    const gl = this.gl, ty = type || this.core.types.color;
    const bw = Math.max(1, W >> 2), bh = Math.max(1, H >> 2);
    const T = { W, H, comp: makeTarget(gl, W, H, ty, true), pal: makeTarget(gl, W, H, ty, true), bA: makeTarget(gl, bw, bh, ty, true), bB: makeTarget(gl, bw, bh, ty, true) };
    if (withFb) { T.fb = makePingPong(gl, W, H, ty, true); this.clearTargets([T.fb.read, T.fb.write, T.pal]); }
    else T.fbOne = makeTarget(gl, W, H, ty, true);
    return T;
  }
  freeTargets(T) {
    if (!T) return; const gl = this.gl;
    for (const k of ['comp', 'pal', 'bA', 'bB', 'fbOne', 'out']) freeTarget(gl, T[k]);
    freePingPong(gl, T.fb);
  }
  clearTargets(list) {
    const gl = this.gl;
    for (const t of list) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  clearFeedback() { if (this.T) this.clearTargets([this.T.fb.read, this.T.fb.write, this.T.pal]); }

  // ---------- parameters per frame ----------
  effective() {
    const P = this.P;
    let E = P;
    if (P.mo_morph && this.morphA && this.morphB) {
      const w = .5 - .5 * Math.cos(this.tau() * P.mo_mcyc);
      const A = this.morphA, B = this.morphB;
      E = { ...P };
      for (const k in E) {
        const c = CONTROLS[k];
        if (!c || c.t !== 'range' || c.struct || NO_MORPH.test(k)) continue;
        if (typeof A[k] === 'number' && typeof B[k] === 'number') E[k] = A[k] + (B[k] - A[k]) * w;
      }
    }
    // LFO modulation: base value + depth × range × wave(loop phase), clamped to the slider range
    const mods = P.mod && Object.keys(P.mod);
    if (mods && mods.length) {
      if (E === P) E = { ...P };
      const u = this.tau() / TAU;
      for (const k of mods) {
        if (!modulatable(k) || typeof E[k] !== 'number') continue;
        const m = P.mod[k], r = rangeOf(CONTROLS[k], E);
        let v = E[k] + (m.d || 0) * (r.max - r.min) * lfoValue(m, u, k);
        v = Math.min(r.max, Math.max(r.min, v));
        if (r.step >= 1) v = Math.round(v);
        E[k] = v;
      }
    }
    return E;
  }
  addRandomLFOs(n, sourcesOnly) {
    // pick sliders from sections that are actually doing something
    const live = (k) => {
      const sec = CONTROLS[k].sec, src = Object.keys(SRC_SEC).find(s => SRC_SEC[s] === sec);
      if (src) return !!this.P[src + '_on'];
      if (sec === 'maps') return (this.P[`m${k[1]}_t`] | 0) > 0;
      if (sec === 'fb') return this.P.fb_amt > 0 || k === 'fb_amt';
      return !sourcesOnly;
    };
    const keys = Object.keys(CONTROLS).filter(k => modulatable(k) && live(k) && !/_(op|on)$/.test(k) && !this.P.mod[k]);
    for (let i = 0; i < n && keys.length; i++) { const k = keys.splice(Math.floor(Math.random() * keys.length), 1)[0]; this.P.mod[k] = randomLFO(); }
  }
  // ---------- layers ----------
  moveLayer(key, dir) {               // dir +1 = up (toward the front), −1 = down
    const o = normOrder(this.P.lay), i = o.indexOf(key), j = i + dir;
    if (i < 0 || j < 0 || j >= o.length) return;
    [o[i], o[j]] = [o[j], o[i]]; this.P.lay = o;
    this.rebuildCompose(); this.ui.renderLayers(); this.commit();
  }
  // ---------- share links ----------
  async copyLink() {
    try {
      const code = await encodeState(this.P);
      const url = location.href.split('#')[0] + '#s=' + code;
      const ok = await copyText(url);
      if (ok) this.toast(`Link copied (${url.length} chars)${this.P.ph_on ? ' — your photo isn’t included, only the settings' : ''}`);
      else window.prompt('Copy this link:', url);
    } catch (e) { this.toast('Could not make a link: ' + e.message); }
  }
  async loadFromHash() {
    const m = /^#s=(.+)$/.exec(location.hash);
    if (!m) return;
    try {
      const part = await decodeState(m[1]);
      const keep = {};
      for (const k in this.P) if (CONTROLS[k] && CONTROLS[k].sec === 'out') keep[k] = this.P[k];
      this.P = Object.assign(defaults(), part, keep);
      this.clearFeedback();
      this.afterBigChange(true);
      this.toast('Loaded shared look' + (this.P.ph_on ? ' — load your own image in Photo, or use the test card' : ''));
    } catch (e) { this.toast('Could not read that link: ' + e.message); }
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
  }
  tau() { const L = Math.max(.5, this.P.mo_loop); return ((this.time % L) / L) * TAU; }
  pal(i, off) { const p = PALETTES[i | 0] || PALETTES[0]; return [...p[1], ...p[2], ...p[3], ...p[4]].map((v, j) => j >= 9 ? v + off : v); }

  composeUniforms(u, bind, E, tau, W, H) {
    const gl = this.gl;
    gl.uniform2f(u.uRes, W, H);
    gl.uniform4f(u.uView, E.vx, E.vy, E.vz, E.vr);
    const M = new Float32Array(32);
    for (let i = 0; i < 4; i++) {
      const n = i + 1, t = this.A[`m${n}_t`] | 0, spin = E[`m${n}_spin`] * tau, a = E[`m${n}_a`], b = E[`m${n}_b`];
      let rot = spin, sh = 0;
      if (t === 1) { rot = 0; sh = E[`m${n}_spin`] * Math.log(Math.max(1.01, a)) * tau / TAU; }
      else if (t === 4) { rot = 0; sh = spin / Math.max(1, Math.round(a)); }
      else if ([11, 13, 17, 18, 19, 23, 24].includes(t)) { rot = 0; sh = spin; }   // spin drives the map's own phase (seamless per loop)
      else if (t === 12) { rot = 0; sh = E[`m${n}_spin`] * tau / Math.PI * 2; }
      M.set([E[`m${n}_sc`], E[`m${n}_rot`] * DEG, a, b, rot, sh, 0, 0], i * 8);
    }
    gl.uniform4fv(u.uM, M);
    const sm = this.A.sy_mode | 0, folds = Math.round(E.sy_n);
    const sspin = E.sy_spin * tau / ((sm === 3 || sm === 4) ? folds : 1);
    gl.uniform4f(u.uSym, folds, E.sy_rot * DEG + sspin, E.sy_cell, 0);
    gl.uniform3fv(u.uPal, new Float32Array([...this.pal(E.dw_pal, E.dw_off), ...this.pal(E.qc_pal, E.qc_off), ...this.pal(E.rd_pal, E.rd_off),
      ...this.pal(E.py_pal, E.py_off), ...this.pal(E.fr_pal, E.fr_off), ...this.pal(E.pt_pal, E.pt_off)]));
    gl.uniform4f(u.uBl, E.ph_bl, E.dw_bl, E.qc_bl, E.rd_bl);
    gl.uniform4f(u.uBl2, E.py_bl, E.fr_bl, E.pt_bl, 0);
    bind('uPhoto', this.photoTex);
    const ia = this.photoAsp || 1;
    gl.uniform2f(u.uPhAsp, ia > 1 ? 1 / ia : 1, ia > 1 ? 1 : ia);
    gl.uniform4f(u.uPh, E.ph_op, E.ph_scale, E.ph_disp, E.ph_hue);
    gl.uniform1f(u.uPhSat, E.ph_sat);
    gl.uniform1f(u.uPhEdge, E.ph_edge);
    gl.uniform4f(u.uPhT, E.ph_x, E.ph_y, E.ph_rot * DEG, 0);
    gl.uniform2f(u.uPhFlip, E.ph_fx ? -1 : 1, E.ph_fy ? -1 : 1);
    const fa = E.fr_ca * DEG + E.fr_cyc * tau;
    gl.uniform4f(u.uFr, E.fr_op, E.fr_zoom, Math.round(E.fr_iter), E.fr_den);
    gl.uniform4f(u.uFr2, E.fr_type, E.fr_trap, E.fr_cx, E.fr_cy);
    gl.uniform2f(u.uFrC, E.fr_cr * Math.cos(fa), E.fr_cr * Math.sin(fa));
    gl.uniform4f(u.uPt, E.pt_op, E.pt_scale, Math.round(E.pt_k), E.pt_sharp);
    gl.uniform4f(u.uPt2, E.pt_mode, E.pt_cyc * tau, E.pt_twist, 0);
    gl.uniform4f(u.uDw, E.dw_op, E.dw_scale, E.dw_str, E.dw_con);
    const fl = E.dw_flow * tau;
    gl.uniform2f(u.uDwFlow, 3.7 + E.dw_flowr * Math.cos(fl), 1.3 + E.dw_flowr * Math.sin(fl));
    gl.uniform4f(u.uQc, E.qc_op, E.qc_freq, E.qc_speed * tau, E.qc_con);
    gl.uniform3f(u.uQc2, Math.round(E.qc_n), E.qc_twist, E.qc_mode);
    if (this.sims.rd) bind('uRD', this.sims.rd.read.tex);
    gl.uniform4f(u.uRd, E.rd_op, E.rd_scale, E.rd_inv ? 1 : 0, E.rd_gain);
    if (this.sims.py) bind('uPY', this.sims.py.read.tex);
    gl.uniform4f(u.uPy, E.py_op, E.py_scale, E.py_gain, 0);
  }

  // Run the full chain into `out` (null = screen). prevTex = feedback history, fbOut = where feedback writes.
  // dt = seconds this frame represents; feedback is normalised to a 60 fps reference so preview and renders match at any fps
  chain(T, out, E, tau, prevTex, fbOut, dt = 1 / 60) {
    const gl = this.gl, c = this.core, W = T.W, H = T.H;
    if (!this.pComp) return;
    pass(c, this.pComp, T.comp, W, H, (u, bind) => this.composeUniforms(u, bind, E, tau, W, H));
    let src = T.comp;
    if (E.fb_amt > 0 && fbOut) {
      pass(c, this.pFb, fbOut, W, H, (u, bind) => {
        bind('uCur', T.comp.tex); bind('uPrev', prevTex);
        gl.uniform2f(u.uRes, W, H);
        const k = Math.min(4, Math.max(.05, dt * 60));
        gl.uniform4f(u.uFb, Math.pow(E.fb_amt, k), Math.pow(E.fb_zoom, k), E.fb_rot * DEG * k, E.fb_hue * k);
        gl.uniform4f(u.uFb2, E.fb_dx * k, E.fb_dy * k, E.fb_mode, E.fb_disp * k);
      });
      src = fbOut;
    }
    pass(c, this.pPal, T.pal, W, H, (u, bind) => {
      bind('uImg', src.tex); gl.uniform2f(u.uRes, W, H);
      gl.uniform4f(u.uPc, E.pc_amt, E.pc_off + E.pc_cyc * tau / TAU, E.pc_bands, E.pc_src);
      gl.uniform1f(u.uPost, E.pc_post);
      gl.uniform3fv(u.uPP, new Float32Array(this.pal(E.pc_pal, 0)));
    });
    const bw = T.bA.w, bh = T.bA.h;
    if (E.po_bloom > 0) {
      pass(c, this.pBright, T.bA, bw, bh, (u, bind) => { bind('uImg', T.pal.tex); gl.uniform2f(u.uTexel, 1 / W, 1 / H); gl.uniform1f(u.uThr, E.po_bthr); });
      const R = E.po_brad | 0;
      for (let i = 0; i < R; i++) {
        const sp = 1 + i;
        pass(c, this.pBlur, T.bB, bw, bh, (u, bind) => { bind('uImg', T.bA.tex); gl.uniform2f(u.uDir, sp / bw, 0); });
        pass(c, this.pBlur, T.bA, bw, bh, (u, bind) => { bind('uImg', T.bB.tex); gl.uniform2f(u.uDir, 0, sp / bh); });
      }
    }
    pass(c, this.pPost, out, W, H, (u, bind) => {
      bind('uImg', T.pal.tex); bind('uBloom', T.bA.tex);
      gl.uniform2f(u.uRes, W, H);
      gl.uniform4f(u.uPo, E.po_chroma, E.po_bloom, E.po_edge, E.po_sat);
      gl.uniform4f(u.uPo2, E.po_con, E.po_bri, E.po_hue, E.po_vig);
      gl.uniform4f(u.uPo3, E.po_grain, E.po_inv ? 1 : 0, this.time * 1.37, 0);
      gl.uniform4f(u.uFx, E.fx_rip, E.fx_rfreq, E.fx_rcyc * tau, E.fx_swirl);
      gl.uniform4f(u.uFx2, E.fx_glitch, Math.round(E.fx_slices), Math.floor(tau / TAU * Math.max(1, Math.round(E.fx_grate))), E.fx_liquid);
      gl.uniform4f(u.uFx3, E.fx_pix, E.fx_ht, E.fx_hts, E.fx_sol);
      gl.uniform4f(u.uFx4, E.fx_scan, E.fx_swr, E.fx_mirror ? 1 : 0, 0);
    });
  }

  advance(dt) {
    const P = this.P;
    if (this.video && this.video.readyState >= 2) this.uploadPhoto(this.video);
    if (this.playing) {
      this.time += dt * P.mo_speed;
      if (this.A.rd_on && this.sims.rd) this.sims.stepRD(P, this.photoTex, this.time);
      if (this.A.py_on && this.sims.ag) this.sims.stepPY(P, this.photoTex);
    }
  }
  renderLive(dt = 1 / 60) {
    const E = this.effective(), T = this.T, tau = this.tau();
    const prev = E.fb_loop ? T.pal.tex : T.fb.read.tex;
    this.chain(T, null, E, tau, prev, T.fb.write, dt);
    if (E.fb_amt > 0) T.fb.swap();
  }

  frame(now) {
    const dt = Math.min(.1, (now - this.last) / 1000); this.last = now;
    if (!this.offline) {
      this.advance(dt);
      this.renderLive(dt);
      if (this.live && this.live.enc) this.live.enc.addCanvasSync(this.canvas, (now - this.live.t0) * 1000, dt * 1e6);
      if ((this._mb = (this._mb || 0) + 1) % 4 === 0 && this.P.mod && Object.keys(this.P.mod).length) this.ui.updateModBars(this.effective());
      this.fpsAcc += dt; this.fpsN++;
      if (this.fpsAcc > .5) {
        $('hud').textContent = `${Math.round(this.fpsN / this.fpsAcc)} fps · ${this.canvas.width}×${this.canvas.height}${this.live ? ' · ● REC' : ''}`;
        this.fpsAcc = 0; this.fpsN = 0;
      }
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  // ---------- export ----------
  // render the current frame offscreen at a PNG size index (0 = view size) → 2D canvas
  renderCanvas(sizeIdx) {
    const gl = this.gl, sz = ['View', 2048, 4096, 8192][sizeIdx | 0];
    let W = this.T.W, H = this.T.H;
    if (sz !== 'View') { const s = Math.min(sz, this.core.caps.maxOut, 4096 * 2) / Math.max(W, H); W = Math.round(W * s / 2) * 2; H = Math.round(H * s / 2) * 2; }
    const lim = Math.min(this.core.caps.maxOut, 8192);
    if (Math.max(W, H) > lim) { const s = lim / Math.max(W, H); W = Math.floor(W * s / 2) * 2; H = Math.floor(H * s / 2) * 2; }
    let T;
    try {
      T = this.makeTargets(W, H, false, gl.UNSIGNED_BYTE);
      T.out = makeTarget(gl, W, H, gl.UNSIGNED_BYTE, false);
      const E = this.effective();
      const prev = E.fb_loop ? this.T.pal.tex : this.T.fb.read.tex;
      this.chain(T, T.out, E, this.tau(), prev, T.fbOne);
      const px = new Uint8Array(W * H * 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, T.out.fb);
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      const c = document.createElement('canvas'); c.width = W; c.height = H;
      const x = c.getContext('2d'), id = x.createImageData(W, H), row = W * 4;
      for (let y = 0; y < H; y++) id.data.set(px.subarray((H - 1 - y) * row, (H - y) * row), y * row);
      x.putImageData(id, 0, 0);
      return c;
    } finally { this.freeTargets(T); }
  }
  renderBlob(sizeIdx) {
    const c = this.renderCanvas(sizeIdx);
    return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('PNG encode failed'))), 'image/png'));
  }
  savePNG() {
    let c;
    try { c = this.renderCanvas(this.P.png_size); }
    catch (e) { this.toast('PNG export failed: ' + e.message); return; }
    const W = c.width, H = c.height;
    c.toBlob(b => { download(b, `entoptica_v${VERSION}_${W}x${H}_${stamp()}.png`); this.toast(`Saved ${W}×${H} PNG`); }, 'image/png');
  }

  busy(on, txt) { $('busy').hidden = !on; if (txt) $('busytxt').textContent = txt; }

  async renderLoop() {
    if (this.offline || this.live) return;
    const P = this.P, fps = [24, 30, 60][P.rec_fps], fmt = P.rec_fmt === 0 ? 'mp4' : 'webm';
    const sizes = [null, [1280, 720], [1920, 1080], [1080, 1080], [1080, 1920]];
    let [W, H] = sizes[P.rec_size] || [this.T.W, this.T.H];
    const lim = this.core.caps.maxOut; if (Math.max(W, H) > lim) { const s = lim / Math.max(W, H); W = Math.floor(W * s / 2) * 2; H = Math.floor(H * s / 2) * 2; }
    let enc = null, rec = null;
    if (fmt === 'mp4') {
      enc = await createH264(W, H, fps);
      if (!enc) { const m = pickRecorderMime('mp4'); if (!m) { this.toast('MP4 encoding is not supported in this browser — try WebM'); return; } rec = { mime: m }; }
    } else { const m = pickRecorderMime('webm'); if (!m) { this.toast('WebM recording is not supported in this browser'); return; } rec = { mime: m }; }
    this.offline = true; this.cancelRender = false;
    this.override = [W, H]; this.resize();
    const speed = P.mo_speed > 0 ? P.mo_speed : 1, L = Math.max(.5, P.mo_loop);
    const N = Math.max(2, Math.round(L / speed * fps)), dtT = L / N;
    const wasPlaying = this.playing; this.playing = true;
    const save = this.P.mo_speed; this.P.mo_speed = 1; // advance() multiplies dt by speed
    try {
      this.busy(true, 'Pre-roll…');
      const pre = Math.round(P.rec_pre * fps);
      for (let i = 0; i < pre && !this.cancelRender; i++) {
        this.advance(dtT); this.renderLive(1 / fps);
        if (i % 4 === 0) await new Promise(r => setTimeout(r, 0));
      }
      this.time = Math.ceil(this.time / L) * L; // start exactly at loop phase 0
      let live = null;
      if (rec) live = startMediaRecorder(this.canvas, fps, rec.mime, true);
      const t0 = performance.now();
      for (let i = 0; i < N && !this.cancelRender; i++) {
        this.renderLive(1 / fps);
        if (enc) await enc.addCanvas(this.canvas, i * 1e6 / fps, 1e6 / fps);
        else { live.frame(); const due = t0 + (i + 1) * 1000 / fps; await new Promise(r => setTimeout(r, Math.max(0, due - performance.now()))); }
        this.busy(true, `Rendering frame ${i + 1} / ${N}  (${W}×${H} @ ${fps} fps)`);
        this.advance(dtT);
        if (enc && i % 2 === 0) await new Promise(r => setTimeout(r, 0));
      }
      if (this.cancelRender) { enc?.abort(); if (live) await live.stop(); this.toast('Render cancelled'); }
      else {
        this.busy(true, 'Finalizing…');
        const blob = enc ? await enc.finish() : await live.stop();
        const ext = (enc || rec.mime.includes('mp4')) ? 'mp4' : 'webm';
        download(blob, `entoptica_v${VERSION}_loop_${W}x${H}_${fps}fps_${stamp()}.${ext}`);
        this.toast(`Saved ${N}-frame loop (${(blob.size / 1048576).toFixed(1)} MB)`);
      }
    } catch (e) { console.error(e); this.toast('Video export failed: ' + e.message); enc?.abort(); }
    finally {
      this.P.mo_speed = save; this.playing = wasPlaying;
      this.override = null; this.offline = false; this.busy(false); this.resize();
    }
  }

  async toggleLive() {
    const btn = this.ui.inputs.rec_live;
    if (this.live) {
      const L = this.live; this.live = null; btn.classList.remove('rec');
      try {
        const blob = L.enc ? await L.enc.finish() : await L.mr.stop();
        download(blob, `entoptica_v${VERSION}_live_${stamp()}.${L.ext}`);
        this.toast(`Saved recording (${(blob.size / 1048576).toFixed(1)} MB)`);
      } catch (e) { this.toast('Recording failed: ' + e.message); }
      this.resize(); return;
    }
    if (this.offline) return;
    const fps = [24, 30, 60][this.P.rec_fps], fmt = this.P.rec_fmt === 0 ? 'mp4' : 'webm';
    let L = null;
    if (fmt === 'mp4') {
      const enc = await createH264(this.canvas.width, this.canvas.height, fps);
      if (enc) L = { enc, ext: 'mp4', t0: performance.now() };
      else { const m = pickRecorderMime('mp4'); if (m) L = { mr: startMediaRecorder(this.canvas, fps, m, false), ext: 'mp4' }; }
    } else { const m = pickRecorderMime('webm'); if (m) L = { mr: startMediaRecorder(this.canvas, fps, m, false), ext: 'webm' }; }
    if (!L) { this.toast(`${fmt.toUpperCase()} recording is not supported in this browser`); return; }
    this.live = L; btn.classList.add('rec'); this.toast('Recording… press again to stop');
  }

  toast(msg) {
    const t = $('toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('on'), 2600);
  }
  onLayout() { this.resize(); }

  // ---------- base image placement ----------
  setDragImage(on) {
    this.dragImage = on;
    const b = $('dragmode'); b.textContent = on ? '✥ Moving image' : '✥ Moving view'; b.classList.toggle('on', on);
    const mv = this.ui.inputs.ph_move; if (mv) { mv.classList.toggle('on', on); mv.textContent = on ? 'Drag moves image ✓ (click for view)' : 'Drag moves image (toggle)'; }
    const coarse = matchMedia('(pointer: coarse)').matches;
    $('hint').textContent = on
      ? (coarse ? 'IMAGE: drag move · pinch scale · twist rotate · double-tap resets image' : 'IMAGE: drag move · wheel scale · right/shift-drag rotate · dbl-click resets image · M toggles')
      : (coarse ? 'drag · pinch · two fingers pan/twist · double-tap resets' : 'drag pan · wheel zoom · right/shift-drag rotate · dbl-click resets · M moves image');
  }
  resetImage() {
    Object.assign(this.P, { ph_x: 0, ph_y: 0, ph_rot: 0, ph_scale: 1, ph_fx: false, ph_fy: false });
    for (const k of ['ph_x', 'ph_y', 'ph_rot', 'ph_scale', 'ph_fx', 'ph_fy']) this.ui.sync(k);
    this.commit();
  }
  syncImage() { for (const k of ['ph_x', 'ph_y', 'ph_rot', 'ph_scale']) this.ui.sync(k); }

  // ---------- input ----------
  wireInput() {
    const cv = this.canvas, pts = new Map();
    let g = null, lastTap = 0, tapHandled = false;
    const P = () => this.P;
    const rect = () => cv.getBoundingClientRect();
    // screen pixels → world (pre-symmetry) units
    const toWorld = (dx, dy) => { const h = rect().height || 1, s = 2 / h / P().vz; const c = Math.cos(P().vr), sn = Math.sin(P().vr); const x = dx * s, y = -dy * s; return [c * x - sn * y, sn * x + c * y]; };
    const wrapDeg = (d) => ((d + 180) % 360 + 360) % 360 - 180;
    const reset = () => {
      if (this.dragImage) { this.resetImage(); return; }
      Object.assign(P(), { vx: 0, vy: 0, vz: 1, vr: 0 }); this.commit();
    };
    const pan = (dx, dy) => {
      const [wx, wy] = toWorld(dx, dy);
      if (this.dragImage) { P().ph_x = Math.max(-4, Math.min(4, P().ph_x + wx)); P().ph_y = Math.max(-4, Math.min(4, P().ph_y + wy)); }
      else { P().vx -= wx; P().vy -= wy; }
    };
    const zoom = (f) => {
      if (this.dragImage) P().ph_scale = Math.min(8, Math.max(.05, P().ph_scale * f));
      else P().vz = Math.min(200, Math.max(.02, P().vz * f));
    };
    const rotate = (rad) => {   // rad = clockwise on screen
      if (this.dragImage) P().ph_rot = wrapDeg(P().ph_rot - rad / DEG);
      else P().vr += rad;
    };
    const gest = () => {
      const a = [...pts.values()];
      if (a.length < 2) return null;
      const cx = (a[0].x + a[1].x) / 2, cy = (a[0].y + a[1].y) / 2;
      return { cx, cy, d: Math.hypot(a[1].x - a[0].x, a[1].y - a[0].y), ang: Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x) };
    };
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY, btn: e.button, shift: e.shiftKey });
      if (pts.size === 2) g = gest();
      if (e.pointerType === 'touch' && pts.size === 1) {
        const t = performance.now();
        if (t - lastTap < 300 && !tapHandled) { reset(); tapHandled = true; } else tapHandled = false;
        lastTap = t;
      }
    });
    cv.addEventListener('pointermove', (e) => {
      const p = pts.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1) {
        if (p.btn === 2 || p.shift || e.shiftKey) rotate(dx * .01);
        else pan(dx, dy);
        if (Math.abs(dx) + Math.abs(dy) > 6) lastTap = 0;
      } else if (pts.size === 2 && g) {
        const n = gest();
        pan(n.cx - g.cx, n.cy - g.cy);
        if (g.d > 10) zoom(n.d / g.d);
        let da = n.ang - g.ang; if (da > Math.PI) da -= TAU; if (da < -Math.PI) da += TAU;
        rotate(da);   // clockwise finger twist → clockwise content
        g = n; lastTap = 0;
      }
      if (this.dragImage) this.syncImage();
    });
    const up = (e) => { if (pts.delete(e.pointerId)) { g = pts.size === 2 ? gest() : null; if (!pts.size) this.commit(); } };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('dblclick', (e) => { if (e.pointerType !== 'touch' && !tapHandled) reset(); });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      zoom(Math.exp(-e.deltaY * .0015));
      if (this.dragImage) this.syncImage();
      clearTimeout(this._wc); this._wc = setTimeout(() => this.commit(), 300);
    }, { passive: false });
  }
}

window.entoptica = new App();

// shared image shelf (snicker02.github.io/shared/bridge.js)
if (window.SnickerShelf) {
  const app = window.entoptica;
  window.SnickerShelf.mount({
    app: 'Entoptica',
    button: $('shelfBtn'),
    onImage: file => app.loadMedia(file),
    getImage: () => app.renderBlob(0),
    getMeta: () => ({ name: `entoptica_v${VERSION}_${stamp()}.png` }),
  });
} else {
  $('shelfBtn').hidden = true;
}
