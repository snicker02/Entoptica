// Entoptica — panel builder, dual sidebars (desktop), phone tabs, confirm-before-apply
import { SCHEMA, CONTROLS, rangeOf, modulatable, LFO_WAVES, LAYER_INFO, BLENDS, normOrder, normPP, PP_INFO, ROUTES, SYM_TYPES, MAP_TYPES } from './params.js';

const LS = 'entoptica.';
const fmt = (v, step) => step >= 1 ? String(Math.round(v)) : (+v).toFixed(step < .001 ? 4 : step < .01 ? 3 : 2);

// Sections that live in the left sidebar on wide screens (the sources)
export const LEFT_SECTIONS = ['layers', 'photo', 'warp', 'quasi', 'fractal', 'pattern', 'rd', 'phys'];
// Below this width both sidebars would crush the view, so everything merges into the right one
const SPLIT_MQ = '(min-width: 1100px)';
const TAB_MQ = '(max-width: 760px), (max-height: 500px) and (orientation: landscape)';

export class UI {
  constructor(panel, app) {
    this.panel = panel;                                   // right panel (also the merged panel)
    this.panelL = document.getElementById('panelL');      // left panel
    this.app = app;
    this.inputs = {}; this.locks = {}; this.sections = {};
    this.pending = false;
    this.build();
    this.initLayout();
  }

  allSections() { return SCHEMA.map(s => this.sections[s.id]).filter(Boolean); }

  build() {
    this.panel.innerHTML = ''; if (this.panelL) this.panelL.innerHTML = '';
    for (const sec of SCHEMA) {
      const el = document.createElement('section');
      el.className = 'sec'; el.dataset.sec = sec.id;
      const h = document.createElement('h2');
      h.innerHTML = `<span class="ttl">${sec.title}</span>`;
      if (!['motion', 'out'].includes(sec.id)) {
        const tools = document.createElement('span'); tools.className = 'sectools';
        const dice = document.createElement('button'); dice.className = 'mini'; dice.textContent = '🎲'; dice.title = 'Randomize this section';
        dice.onclick = (e) => { e.stopPropagation(); this.app.randomizeSection(sec.id); };
        const lk = document.createElement('label'); lk.className = 'lock'; lk.title = 'Lock: global randomize skips this section';
        const cb = document.createElement('input'); cb.type = 'checkbox';
        cb.checked = localStorage.getItem(LS + 'lock.' + sec.id) === '1';
        cb.onchange = () => localStorage.setItem(LS + 'lock.' + sec.id, cb.checked ? '1' : '0');
        lk.append(cb, document.createTextNode('lock'));
        this.locks[sec.id] = cb;
        tools.append(dice, lk); h.append(tools);
      }
      el.append(h);
      const note = document.createElement('div'); note.className = 'note'; note.dataset.note = sec.id; el.append(note);
      let row = null;
      for (const c of sec.ctl) {
        if (c.hidden) continue;
        if (c.t === 'button') {
          if (!row || !row.classList.contains('btnrow')) { row = document.createElement('div'); row.className = 'btnrow'; el.append(row); }
          const b = document.createElement('button'); b.textContent = c.label; b.dataset.k = c.k;
          b.onclick = () => this.app.action(c.k, b);
          row.append(b); this.inputs[c.k] = b;
          continue;
        }
        row = null;
        const wrap = document.createElement('div'); wrap.className = 'ctl ' + c.t; wrap.dataset.k = c.k;
        if (c.t === 'range') {
          const lab = document.createElement('label'); const nm = document.createElement('span'); const val = document.createElement('span'); val.className = 'val';
          if (modulatable(c.k)) {
            const tl = document.createElement('button'); tl.className = 'lfo'; tl.textContent = '~'; tl.title = 'Add / edit an LFO on this slider';
            tl.onclick = (e) => { e.preventDefault(); this.toggleLFO(c.k); };
            const right = document.createElement('span'); right.className = 'lright'; right.append(val, tl);
            lab.append(nm, right);
          } else lab.append(nm, val);
          const inp = document.createElement('input'); inp.type = 'range';
          wrap.append(lab, inp);
          if (modulatable(c.k)) {
            const bar = document.createElement('div'); bar.className = 'modbar'; const fill = document.createElement('i'); bar.append(fill);
            const ed = document.createElement('div'); ed.className = 'lfoed'; ed.hidden = true;
            wrap.append(bar, ed);
            Object.assign(this.inputs[c.k] || (this.inputs[c.k] = {}), { bar, fill, ed });
          }
          inp.addEventListener('input', () => this.onInput(c, +inp.value));
          inp.addEventListener('change', () => this.app.commit());
          inp.addEventListener('dblclick', () => { this.onInput(c, c.v); this.sync(c.k); this.app.commit(); });
          this.inputs[c.k] = Object.assign(this.inputs[c.k] || {}, { inp, val, nm });
        } else if (c.t === 'select') {
          const lab = document.createElement('label'); lab.textContent = c.label;
          const sel = document.createElement('select');
          c.opts.forEach((o, i) => { const op = document.createElement('option'); op.value = i; op.textContent = o; sel.append(op); });
          sel.addEventListener('change', () => { this.onInput(c, +sel.value); this.app.commit(); });
          wrap.append(lab, sel);
          this.inputs[c.k] = { inp: sel };
        } else if (c.t === 'check') {
          const lab = document.createElement('label'); lab.className = 'chk';
          const cb = document.createElement('input'); cb.type = 'checkbox';
          cb.addEventListener('change', () => { this.onInput(c, cb.checked); this.app.commit(); });
          lab.append(cb, document.createTextNode(' ' + c.label));
          wrap.append(lab);
          this.inputs[c.k] = { inp: cb };
        }
        if (c.struct) wrap.classList.add('struct');
        el.append(wrap);
      }
      this.sections[sec.id] = el;
    }
    this.place(false);
    this.syncAll();
  }

  // Put every section into its sidebar. merged = one panel (phones / narrow windows).
  place(merged) {
    this.merged = merged;
    for (const sec of SCHEMA) {
      const el = this.sections[sec.id];
      const target = (!merged && this.panelL && LEFT_SECTIONS.includes(sec.id)) ? this.panelL : this.panel;
      target.append(el); // append in schema order keeps the original ordering
    }
    document.body.classList.toggle('split', !merged);
  }

  onInput(c, v) {
    if (/^(dw|ph|qc|rd|py|fr|pt)_(on|op|bl)$/.test(c.k)) queueMicrotask(() => this.renderLayers());
    const P = this.app.P;
    P[c.k] = v;
    if (c.t === 'range') { const r = rangeOf(c, P); this.inputs[c.k].val.textContent = fmt(v, r.step); }
    if (/^m\d_t$/.test(c.k)) this.app.mapTypeChanged(c.k[1]);
    if (c.struct) {
      if (this.app.confirm) this.setPending(true);
      else this.app.applyStruct();
    }
    this.app.paramsChanged(c.k);
  }

  setPending(on) {
    this.pending = on;
    document.body.classList.toggle('pending', on);
  }

  sync(k) {
    const c = CONTROLS[k], P = this.app.P, I = this.inputs[k];
    if (!c || !I || c.t === 'button') return;
    if (c.t === 'range') {
      const r = rangeOf(c, P);
      I.inp.min = r.min; I.inp.max = r.max; I.inp.step = r.step;
      I.inp.value = P[k]; I.nm.textContent = r.label; I.val.textContent = fmt(P[k], r.step);
    } else if (c.t === 'select') I.inp.value = P[k];
    else if (c.t === 'check') I.inp.checked = !!P[k];
  }

  syncAll() { for (const k in CONTROLS) this.sync(k); this.refreshNotes(); this.renderLayers(); this.syncMods(); }

  // ---------- layers panel ----------
  // Pipeline panel: Coordinates → Layers → Image chain → Post
  renderLayers() {
    const sec = this.sections.layers; if (!sec) return;
    let box = sec.querySelector('.layers'); if (!box) { box = document.createElement('div'); box.className = 'layers'; sec.append(box); }
    const P = this.app.P, A = this.app.A || P;
    box.innerHTML = '';
    const group = (title, hint) => {
      const g = document.createElement('div'); g.className = 'lgroup';
      const h = document.createElement('div'); h.className = 'lgtitle'; h.textContent = title; g.append(h);
      if (hint) { const d = document.createElement('div'); d.className = 'lhint'; d.textContent = hint; g.append(d); }
      box.append(g); return g;
    };
    const row = (g, { name, info, off, up, down, onUp, onDown, check, onCheck, jump, fixed, cls }) => {
      const r = document.createElement('div'); r.className = 'lrow' + (off ? ' off' : '') + (cls ? ' ' + cls : '');
      if (fixed) { const sp = document.createElement('span'); sp.className = 'lfixed'; sp.textContent = fixed; r.append(sp); }
      else {
        const u = document.createElement('button'); u.className = 'mini'; u.textContent = '▲'; u.disabled = !up; u.title = 'Move up'; u.onclick = onUp;
        const d = document.createElement('button'); d.className = 'mini'; d.textContent = '▼'; d.disabled = !down; d.title = 'Move down'; d.onclick = onDown;
        r.append(u, d);
      }
      if (onCheck) { const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!check; cb.title = 'Enable'; cb.onchange = () => onCheck(cb.checked); r.append(cb); }
      else { const sp = document.createElement('span'); r.append(sp); }
      const nm = document.createElement('button'); nm.className = 'lname'; nm.textContent = name; nm.title = 'Open settings'; nm.onclick = () => this.jumpTo(jump);
      const inf = document.createElement('span'); inf.className = 'linfo'; inf.textContent = info || '';
      r.append(nm, inf); g.append(r); return r;
    };

    // --- Coordinates ---
    const gc = group('Coordinates', 'Bend the space the layers are sampled from. Order matters: kaleidoscope-then-warp ≠ warp-then-kaleidoscope.');
    const nMaps = [1, 2, 3, 4].filter(i => (P[`m${i}_t`] | 0) > 0).length;
    const coRows = [
      { key: 'sym', name: 'Symmetry', info: SYM_TYPES[P.sy_mode | 0], off: !(P.sy_mode | 0), jump: 'sym' },
      { key: 'maps', name: 'Maps', info: nMaps ? `${nMaps} active` : 'none', off: !nMaps, jump: 'maps' },
    ];
    const coOrd = P.co ? [coRows[1], coRows[0]] : coRows;
    coOrd.forEach((c, idx) => row(gc, { ...c, up: idx > 0, down: idx < 1, onUp: () => this.app.swapCoords(), onDown: () => this.app.swapCoords() }));
    const gm = document.createElement('div'); gm.className = 'lsub'; gc.append(gm);
    for (let i = 1; i <= 4; i++) {
      const t = P[`m${i}_t`] | 0;
      row(gm, { name: `Map ${i}`, info: MAP_TYPES[t], off: !t, up: i > 1, down: i < 4, onUp: () => this.app.moveMap(i, -1), onDown: () => this.app.moveMap(i, +1), jump: 'maps', cls: 'small' });
    }

    // --- Layers ---
    const gl = group('Layers', 'Top of the list is drawn last (in front). Each layer blends onto everything below it.');
    const order = normOrder(P.lay);
    [...order].reverse().forEach((k, idx, arr) => {
      const [name, secId] = LAYER_INFO[k];
      const rt = P[k + '_route'] | 0;
      row(gl, {
        name, jump: secId, off: !P[k + '_on'], check: P[k + '_on'],
        info: `${BLENDS[P[k + '_bl'] | 0]} · ${Math.round((P[k + '_op'] ?? 1) * 100)}%` + (rt ? ` · ${['', 'sym only', 'maps only', 'straight'][rt]}` : ''),
        up: idx > 0, down: idx < arr.length - 1,
        onUp: () => this.app.moveLayer(k, +1), onDown: () => this.app.moveLayer(k, -1),
        onCheck: (v) => { this.onInput(CONTROLS[k + '_on'], v); this.sync(k + '_on'); this.app.commit(); },
      });
    });

    // --- Image chain ---
    const gi = group('Image chain', 'Applied to the finished stack, top to bottom. Post is always last.');
    const pp = normPP(P.pp);
    const stInfo = {
      fb: () => P.fb_amt > 0 ? `${Math.round(P.fb_amt * 100)}%${P.fb_loop ? ' · loops chain' : ''}` : 'off',
      pal: () => P.pc_amt > 0 || P.pc_post > .5 ? `${Math.round(P.pc_amt * 100)}%` : 'off',
      fx: () => { const n = ['fx_rip', 'fx_swirl', 'fx_glitch', 'fx_liquid', 'fx_pix', 'fx_ht', 'fx_sol', 'fx_scan'].filter(k => k === 'fx_pix' ? P[k] > 1 : P[k] !== 0).length + (P.fx_mirror ? 1 : 0); return n ? `${n} active` : 'off'; },
    };
    pp.forEach((k, idx) => {
      const inf = stInfo[k]();
      row(gi, { name: PP_INFO[k][0], info: inf, off: inf === 'off', jump: PP_INFO[k][1], up: idx > 0, down: idx < pp.length - 1, onUp: () => this.app.movePP(k, -1), onDown: () => this.app.movePP(k, +1) });
    });
    row(gi, { name: 'Post', info: 'always last', jump: 'post', fixed: '⤓' });
  }
  jumpTo(secId) {
    if (document.body.classList.contains('tabbed')) { this.openTab(secId); return; }
    const el = this.sections[secId]; if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- LFO editors ----------
  toggleLFO(k) {
    const P = this.app.P, I = this.inputs[k]; if (!I || !I.ed) return;
    if (!P.mod) P.mod = {};
    if (!P.mod[k]) { P.mod[k] = { w: 0, c: 1, d: .1, p: 0 }; I.ed.hidden = false; this.app.commit(); }
    else I.ed.hidden = !I.ed.hidden;
    this.syncMods();
  }
  buildEditor(k) {
    const I = this.inputs[k], ed = I.ed, P = this.app.P;
    ed.innerHTML = '';
    const m = P.mod[k];
    const row = (label, el, out) => { const r = document.createElement('div'); r.className = 'lfrow'; const l = document.createElement('span'); l.textContent = label; r.append(l, el); if (out) r.append(out); ed.append(r); };
    const wave = document.createElement('select'); LFO_WAVES.forEach((w, i) => { const o = document.createElement('option'); o.value = i; o.textContent = w; wave.append(o); });
    wave.value = m.w; wave.onchange = () => { m.w = +wave.value; this.app.commit(); };
    row('Wave', wave);
    const mk = (min, max, step, val, fmtf, set) => {
      const inp = document.createElement('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = val;
      const out = document.createElement('span'); out.className = 'val'; out.textContent = fmtf(val);
      inp.oninput = () => { const v = set(+inp.value); out.textContent = fmtf(v); if (v !== +inp.value) inp.value = v; };
      inp.onchange = () => this.app.commit();
      return [inp, out];
    };
    const [cyc, cyco] = mk(-8, 8, 1, m.c, v => `${v}×/loop`, v => { if (v === 0) v = m.c > 0 ? -1 : 1; m.c = v; return v; });
    row('Cycles', cyc, cyco);
    const [dep, depo] = mk(0, 1, .01, m.d, v => `${Math.round(v * 100)}%`, v => (m.d = v));
    row('Depth', dep, depo);
    const [ph, pho] = mk(0, 1, .01, m.p, v => `${Math.round(v * 360)}°`, v => (m.p = v));
    row('Phase', ph, pho);
    const rm = document.createElement('button'); rm.textContent = 'Remove LFO'; rm.className = 'mini';
    rm.onclick = () => { delete P.mod[k]; this.syncMods(); this.app.commit(); };
    const r = document.createElement('div'); r.className = 'lfrow end'; r.append(rm); ed.append(r);
  }
  syncMods() {
    const P = this.app.P, mods = P.mod || {};
    for (const k in this.inputs) {
      const I = this.inputs[k]; if (!I || !I.ed) continue;
      const on = !!mods[k];
      I.ed.parentElement.classList.toggle('modded', on);
      if (!on) { I.ed.hidden = true; I.ed.innerHTML = ''; I.bar.style.display = 'none'; continue; }
      I.bar.style.display = '';
      if (!I.ed.hidden || !I.ed.childElementCount) this.buildEditor(k);
    }
  }
  updateModBars(E) {
    const P = this.app.P;
    for (const k in P.mod || {}) {
      const I = this.inputs[k]; if (!I || !I.fill) continue;
      const r = rangeOf(CONTROLS[k], E), t = (E[k] - r.min) / ((r.max - r.min) || 1);
      I.fill.style.left = `${Math.max(0, Math.min(1, t)) * 100}%`;
    }
  }

  note(sec, html) {
    const el = this.sections[sec]; const n = el && el.querySelector(`[data-note="${sec}"]`);
    if (n) { n.innerHTML = html || ''; n.style.display = html ? '' : 'none'; }
  }
  refreshNotes() { this.app.updateNotes?.(this); }

  // ---------- layout: split sidebars on wide screens, merged + tabs on phones ----------
  initLayout() {
    this.tabbar = document.getElementById('tabstrip');
    const tabMQ = window.matchMedia(TAB_MQ), splitMQ = window.matchMedia(SPLIT_MQ);
    const upd = () => {
      const tabbed = tabMQ.matches;
      document.body.classList.toggle('tabbed', tabbed);
      const merged = tabbed || !splitMQ.matches;
      if (merged !== this.merged) this.place(merged);
      this.buildTabs();
      this.app.onLayout?.();
    };
    for (const mq of [tabMQ, splitMQ]) mq.addEventListener ? mq.addEventListener('change', upd) : mq.addListener(upd);
    this.merged = null;
    upd();
  }
  buildTabs() {
    const bar = this.tabbar; if (!bar) return;
    bar.innerHTML = '';
    const secs = this.allSections().filter(s => s.style.display !== 'none');
    let cur = localStorage.getItem(LS + 'tab');
    if (!secs.some(s => s.dataset.sec === cur)) cur = secs[0]?.dataset.sec;
    for (const s of secs) {
      const b = document.createElement('button'); b.className = 'tabpill';
      b.textContent = s.querySelector('h2 .ttl').textContent;
      b.dataset.sec = s.dataset.sec;
      b.onclick = () => this.openTab(s.dataset.sec);
      bar.append(b);
    }
    this.openTab(cur, true);
  }
  openTab(id, quiet) {
    for (const s of this.allSections()) s.classList.toggle('tabon', s.dataset.sec === id);
    for (const b of this.tabbar.querySelectorAll('.tabpill')) {
      const on = b.dataset.sec === id; b.classList.toggle('on', on);
      if (on && !quiet) b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    localStorage.setItem(LS + 'tab', id);
    if (document.body.classList.contains('tabbed')) this.panel.scrollTop = 0;
  }
}
