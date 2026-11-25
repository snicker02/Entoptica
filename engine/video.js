// Entoptica — video export: WebCodecs H.264 + minimal MP4 muxer, MediaRecorder WebM/MP4
const enc = new TextEncoder();
function u32(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]; }
function u16(n) { return [(n >>> 8) & 255, n & 255]; }
function box(type, ...parts) {
  let len = 8; const bufs = parts.map(p => p instanceof Uint8Array ? p : new Uint8Array(p));
  for (const b of bufs) len += b.length;
  const out = new Uint8Array(len);
  out.set(u32(len), 0); out.set(enc.encode(type), 4);
  let o = 8; for (const b of bufs) { out.set(b, o); o += b.length; }
  return out;
}
const full = (type, v, flags, ...parts) => box(type, [v, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255], ...parts);
const MATRIX = [...u32(0x10000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x10000), ...u32(0), ...u32(0), ...u32(0), ...u32(0x40000000)];

export class Mp4Muxer {
  constructor(w, h) { this.w = w; this.h = h; this.samples = []; this.avcC = null; this.timescale = 90000; }
  add(chunk, meta) {
    if (meta && meta.decoderConfig && meta.decoderConfig.description && !this.avcC) {
      const d = meta.decoderConfig.description;
      this.avcC = new Uint8Array(d instanceof ArrayBuffer ? d : d.buffer.slice(d.byteOffset, d.byteOffset + d.byteLength));
    }
    const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
    this.samples.push({ data, key: chunk.type === 'key', ts: chunk.timestamp, dur: chunk.duration || 0 });
  }
  finish() {
    const S = this.samples; if (!S.length || !this.avcC) throw new Error('No encoded frames');
    const ts = this.timescale;
    const durs = S.map((s, i) => {
      const us = i + 1 < S.length ? S[i + 1].ts - s.ts : (s.dur || (S.length > 1 ? (S[S.length - 1].ts - S[0].ts) / (S.length - 1) : 33333));
      return Math.max(1, Math.round(us * ts / 1e6));
    });
    const total = durs.reduce((a, b) => a + b, 0);
    // stts run-length
    const stts = []; for (const d of durs) { const l = stts[stts.length - 1]; if (l && l[1] === d) l[0]++; else stts.push([1, d]); }
    const keys = []; S.forEach((s, i) => { if (s.key) keys.push(i + 1); });
    let mdatLen = 0; for (const s of S) mdatLen += s.data.length;
    const ftyp = box('ftyp', enc.encode('isom'), u32(512), enc.encode('isomiso2avc1mp41'));
    const dataOffset = ftyp.length + 8;
    const msDur = Math.round(total / ts * 1000);
    const mvhd = full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(msDur), u32(0x10000), u16(0x100), new Array(10).fill(0), MATRIX, new Array(24).fill(0), u32(2));
    const tkhd = full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(msDur), new Array(8).fill(0), u16(0), u16(0), u16(0), u16(0), MATRIX, u32(this.w * 65536), u32(this.h * 65536));
    const mdhd = full('mdhd', 0, 0, u32(0), u32(0), u32(ts), u32(total), u16(0x55c4), u16(0));
    const hdlr = full('hdlr', 0, 0, u32(0), enc.encode('vide'), new Array(12).fill(0), enc.encode('EntopticaVideo\0'));
    const vmhd = full('vmhd', 0, 1, new Array(8).fill(0));
    const dinf = box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1)));
    const name = new Array(32).fill(0);
    const avc1 = box('avc1', new Array(6).fill(0), u16(1), u16(0), u16(0), new Array(12).fill(0), u16(this.w), u16(this.h),
      u32(0x480000), u32(0x480000), u32(0), u16(1), name, u16(0x18), u16(0xffff), box('avcC', this.avcC));
    const stsd = full('stsd', 0, 0, u32(1), avc1);
    const sttsB = full('stts', 0, 0, u32(stts.length), ...stts.map(([c, d]) => [...u32(c), ...u32(d)]));
    const stss = full('stss', 0, 0, u32(keys.length), ...keys.map(k => u32(k)));
    const stsc = full('stsc', 0, 0, u32(1), u32(1), u32(S.length), u32(1));
    const szs = new Uint8Array(S.length * 4); S.forEach((s, i) => szs.set(u32(s.data.length), i * 4));
    const stsz = full('stsz', 0, 0, u32(0), u32(S.length), szs);
    const stco = full('stco', 0, 0, u32(1), u32(dataOffset));
    const stbl = box('stbl', stsd, sttsB, stss, stsc, stsz, stco);
    const moov = box('moov', mvhd, box('trak', tkhd, box('mdia', mdhd, hdlr, box('minf', vmhd, dinf, stbl))));
    const mdatHead = new Uint8Array([...u32(mdatLen + 8), ...enc.encode('mdat')]);
    return new Blob([ftyp, mdatHead, ...S.map(s => s.data), moov], { type: 'video/mp4' });
  }
}

export const hasWebCodecs = () => typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';

export async function createH264(w, h, fps) {
  if (!hasWebCodecs()) return null;
  const bitrate = Math.min(60e6, Math.round(w * h * fps * 0.28));
  const codecs = ['avc1.640034', 'avc1.640033', 'avc1.4d0033', 'avc1.640028', 'avc1.4d0028', 'avc1.42e01f', 'avc1.42001f'];
  for (const codec of codecs) {
    const cfg = { codec, width: w, height: h, bitrate, framerate: fps, avc: { format: 'avc' }, latencyMode: 'quality' };
    try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return makeEnc(cfg, w, h, fps); } catch (e) { /* next */ }
  }
  return null;
}

function makeEnc(cfg, w, h, fps) {
  const mux = new Mp4Muxer(w, h);
  let err = null;
  const encoder = new VideoEncoder({ output: (c, m) => mux.add(c, m), error: (e) => { err = e; } });
  encoder.configure(cfg);
  let n = 0; const gop = Math.max(1, Math.round(fps * 2));
  return {
    async addCanvas(canvas, tsUs, durUs) {
      if (err) throw err;
      // Grab the frame synchronously, before yielding: a WebGL canvas without
      // preserveDrawingBuffer is cleared once the browser composites it, and
      // capturing after an await produced black frames (strobing) in v0.1.1.
      const f = new VideoFrame(canvas, { timestamp: Math.round(tsUs), duration: Math.round(durUs) });
      while (encoder.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 4));
      encoder.encode(f, { keyFrame: n % gop === 0 }); f.close(); n++;
    },
    addCanvasSync(canvas, tsUs, durUs) {
      if (err) throw err;
      if (encoder.encodeQueueSize > 30) return false; // drop rather than stall live view
      const f = new VideoFrame(canvas, { timestamp: Math.round(tsUs), duration: Math.round(durUs) });
      encoder.encode(f, { keyFrame: n % gop === 0 }); f.close(); n++;
      return true;
    },
    async finish() { await encoder.flush(); if (err) throw err; encoder.close(); return mux.finish(); },
    abort() { try { encoder.close(); } catch (e) { /* closed */ } },
  };
}

export function pickRecorderMime(fmt) {
  if (typeof MediaRecorder === 'undefined') return null;
  const list = fmt === 'mp4'
    ? ['video/mp4;codecs=avc1.640028', 'video/mp4;codecs=avc1', 'video/mp4']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return list.find(m => MediaRecorder.isTypeSupported(m)) || null;
}

export function startMediaRecorder(canvas, fps, mime, manual) {
  const stream = canvas.captureStream(manual ? 0 : fps);
  const track = stream.getVideoTracks()[0];
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: Math.min(40e6, canvas.width * canvas.height * fps * 0.2) });
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const done = new Promise(res => { rec.onstop = () => res(new Blob(chunks, { type: mime.split(';')[0] })); });
  rec.start(250);
  return { rec, track, stop() { rec.stop(); stream.getTracks().forEach(t => t.stop()); return done; }, frame() { if (track.requestFrame) track.requestFrame(); } };
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
