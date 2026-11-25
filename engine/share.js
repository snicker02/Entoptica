// Entoptica — shareable links: settings diffed against defaults, deflated, base64url in the URL hash.
// Format:  #s=z<base64url(deflate-raw(json))>   or   #s=j<base64url(json)> when CompressionStream is unavailable.
import { CONTROLS, defaults, normOrder, modulatable } from './params.js';

// Device / output preferences are not part of a "look"
const SKIP = (k) => CONTROLS[k] && CONTROLS[k].sec === 'out';

const b64url = (bytes) => {
  let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (str) => {
  const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
  const out = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i); return out;
};
async function pipe(bytes, stream) {
  const r = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(r).arrayBuffer());
}
const round = (v) => typeof v === 'number' && isFinite(v) ? +v.toPrecision(6) : v;

export function diffState(P) {
  const D = defaults(), out = {};
  for (const k in P) {
    if (!(k in D) || SKIP(k)) continue;
    if (k === 'mod') {
      const m = {};
      for (const key in P.mod || {}) if (modulatable(key)) { const o = P.mod[key]; m[key] = { w: o.w | 0, c: o.c | 0, d: round(o.d), p: round(o.p) }; }
      if (Object.keys(m).length) out.mod = m;
      continue;
    }
    if (k === 'lay') { const o = normOrder(P.lay); if (o.join() !== D.lay.join()) out.lay = o; continue; }
    const v = round(P[k]);
    if (JSON.stringify(v) !== JSON.stringify(D[k])) out[k] = v;
  }
  return out;
}

export async function encodeState(P) {
  const bytes = new TextEncoder().encode(JSON.stringify(diffState(P)));
  if (typeof CompressionStream !== 'undefined') {
    try { return 'z' + b64url(await pipe(bytes, new CompressionStream('deflate-raw'))); } catch (e) { /* fall through */ }
  }
  return 'j' + b64url(bytes);
}

// Returns a sanitized partial state (only known keys with matching types) or throws
export async function decodeState(code) {
  let bytes;
  if (code[0] === 'z') {
    if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot read compressed links');
    bytes = await pipe(unb64url(code.slice(1)), new DecompressionStream('deflate-raw'));
  } else if (code[0] === 'j') bytes = unb64url(code.slice(1));
  else throw new Error('Unknown link format');
  const raw = JSON.parse(new TextDecoder().decode(bytes));
  if (!raw || typeof raw !== 'object') throw new Error('Empty link');
  const D = defaults(), out = {};
  for (const k in raw) {
    if (!(k in D) || SKIP(k)) continue;
    const v = raw[k];
    if (k === 'lay') { out.lay = normOrder(v); continue; }
    if (k === 'mod') {
      out.mod = {};
      if (v && typeof v === 'object') for (const key in v) {
        const m = v[key];
        if (modulatable(key) && m && typeof m === 'object') out.mod[key] = { w: Math.max(0, m.w | 0), c: (m.c | 0) || 1, d: Math.max(0, Math.min(1, +m.d || 0)), p: (+m.p || 0) % 1 };
      }
      continue;
    }
    if (typeof v === typeof D[k] && (typeof v !== 'number' || isFinite(v))) out[k] = v;
  }
  return out;
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* fallback */ }
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.append(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); if (ok) return true;
  } catch (e) { /* fallback */ }
  return false;
}
