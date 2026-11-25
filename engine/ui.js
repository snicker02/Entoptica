// Entoptica — panel builder, dual sidebars (desktop), phone tabs, confirm-before-apply
import { SCHEMA, CONTROLS, rangeOf } from './params.js';

const LS = 'entoptica.';
const fmt = (v, step) => step >= 1 ? String(Math.round(v)) : (+v).toFixed(step < .001 ? 4 : step < .01 ? 3 : 2);

// Sections that live in the left sidebar on wide screens (the sources)
export const LEFT_SECTIONS = ['photo', 'warp', 'quasi', 'fractal', 'pattern', 'rd', 'phys'];
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
          lab.append(nm, val);
          const inp = document.createElement('input'); inp.type = 'range';
          wrap.append(lab, inp);
          inp.addEventListener('input', () => this.onInput(c, +inp.value));
          inp.addEventListener('change', () => this.app.commit());
          inp.addEventListener('dblclick', () => { this.onInput(c, c.v); this.sync(c.k); this.app.commit(); });
          this.inputs[c.k] = { inp, val, nm };
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

  syncAll() { for (const k in CONTROLS) this.sync(k); this.refreshNotes(); }

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
