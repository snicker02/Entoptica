// Entoptica — GLSL (WebGL1 / GLSL ES 1.00)
export const PREC = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

export const VS = `attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }
`;

export const COMMON = `
#define TAU 6.28318530718
#define PI 3.14159265359
vec2 cmul(vec2 a, vec2 b){ return vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x); }
vec2 cdiv(vec2 a, vec2 b){ float d = dot(b,b)+1e-9; return vec2(a.x*b.x+a.y*b.y, a.y*b.x-a.x*b.y)/d; }
vec2 cconj(vec2 a){ return vec2(a.x,-a.y); }
vec2 cexp(vec2 z){ float e = exp(clamp(z.x,-30.0,30.0)); return e*vec2(cos(z.y), sin(z.y)); }
vec2 clog(vec2 z){ return vec2(log(length(z)+1e-9), atan(z.y, z.x)); }
vec2 crot(vec2 z, float a){ float c = cos(a), s = sin(a); return vec2(c*z.x-s*z.y, s*z.x+c*z.y); }
float csh(float x){ return 0.5*(exp(x)-exp(-x)); }
float cch(float x){ return 0.5*(exp(x)+exp(-x)); }
vec2 csin(vec2 z){ z.y = clamp(z.y,-12.0,12.0); return vec2(sin(z.x)*cch(z.y), cos(z.x)*csh(z.y)); }
vec2 ccos(vec2 z){ z.y = clamp(z.y,-12.0,12.0); return vec2(cos(z.x)*cch(z.y), -sin(z.x)*csh(z.y)); }
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float luma(vec3 c){ return dot(c, vec3(0.299,0.587,0.114)); }
vec2 mirror(vec2 uv){ return 1.0 - abs(1.0 - mod(uv, 2.0)); }
vec3 hueShift(vec3 c, float h){
  const mat3 toY = mat3(0.299,0.596,0.211, 0.587,-0.274,-0.523, 0.114,-0.322,0.312);
  const mat3 toR = mat3(1.0,1.0,1.0, 0.956,-0.272,-1.106, 0.621,-0.647,1.703);
  vec3 y = toY*c; float a = h*TAU; float cs = cos(a), sn = sin(a);
  y.yz = vec2(cs*y.y - sn*y.z, sn*y.y + cs*y.z);
  return toR*y;
}
vec3 rgb2hsv(vec3 c){
  vec4 K = vec4(0.0,-1.0/3.0,2.0/3.0,-1.0);
  vec4 p = mix(vec4(c.bg,K.wz), vec4(c.gb,K.xy), step(c.b,c.g));
  vec4 q = mix(vec4(p.xyw,c.r), vec4(c.r,p.yzx), step(p.x,c.r));
  float d = q.x-min(q.w,q.y); float e = 1.0e-10;
  return vec3(abs(q.z+(q.w-q.y)/(6.0*d+e)), d/(q.x+e), q.x);
}
vec3 cosPal(float t, vec3 a, vec3 b, vec3 c, vec3 d){ return a + b*cos(TAU*(c*t+d)); }
`;

// ---------- compose (sources → maps → symmetry) ----------
function mapCode(type, i) {
  const P = `uM[${2 * i}]`, Q = `uM[${2 * i + 1}]`;
  const pre = `z = crot(z, ${P}.y + ${Q}.x) * ${P}.x;\n`;
  switch (type) {
    case 1: return pre + `{ float L = log(max(${P}.z,1.01)); vec2 w = clog(z);
  w = cmul(w, vec2(1.0, -${P}.w*L/TAU)); w.x = mod(w.x + ${Q}.y, L); z = cexp(w) / max(${P}.z,1.01) * 1.6; }\n`;
    case 2: return pre + `{ float r = length(z), t = atan(z.y,z.x); float n = ${P}.z; z = pow(r+1e-6, n) * vec2(cos(t*n+${P}.w), sin(t*n+${P}.w)); }\n`;
    case 3: return pre + `{ vec2 c = vec2(${P}.z, ${P}.w); float l = length(c); if (l > 0.97) c *= 0.97/l;
  z = cdiv(z - c, vec2(1.0,0.0) - cmul(cconj(c), z)); }\n`;
    case 4: return pre + `{ vec2 acc = vec2(1.0,0.0); float n = floor(${P}.z+0.5);
  for (int k=0;k<8;k++){ if (float(k) >= n) break; float an = TAU*float(k)/n + ${Q}.y; vec2 a = ${P}.w*vec2(cos(an),sin(an));
    acc = cmul(acc, cdiv(z - a, vec2(1.0,0.0) - cmul(cconj(a), z))); } z = acc; }\n`;
    case 5: return pre + `z = cexp(z*${P}.z + vec2(0.0, ${P}.w));\n`;
    case 6: return pre + `z = cmul(clog(z), vec2(${P}.z, ${P}.w)) * 0.5;\n`;
    case 7: return pre + `z = csin(z*${P}.z) * ${P}.w;\n`;
    case 8: return pre + `z = cdiv(csin(z*${P}.z), ccos(z*${P}.z)) * ${P}.w;\n`;
    case 9: return pre + `{ vec2 c = vec2(${P}.z, ${P}.w); z = 0.5*(z + cdiv(cmul(c,c), z)); }\n`;
    case 10: return pre + `{ vec2 o = vec2(${P}.w, 0.0); vec2 q = z - o; z = ${P}.z*${P}.z*q/(dot(q,q)+1e-6) + o; }\n`;
    case 11: return pre + `{ float r = length(z); z = crot(z, ${P}.z*r) * (1.0 + ${P}.w*sin(12.0*r - ${Q}.y)); }\n`;
    case 12: return pre + `{ float r = length(z); z = vec2(atan(z.y,z.x)/PI, ${P}.z/(r+0.03) + ${P}.w + ${Q}.y); }\n`;
    case 13: return pre + `{ vec2 c = 0.7885*vec2(cos(${P}.w + ${Q}.y), sin(${P}.w + ${Q}.y)); float n = floor(${P}.z+0.5);
  for (int k=0;k<6;k++){ if (float(k) >= n) break; z = cmul(z,z) + c; if (dot(z,z) > 1e4) break; } z *= 0.5; }\n`;
    case 14: return pre + `{ vec2 w = z*${P}.z; w.x = clamp(w.x,-12.0,12.0); z = vec2(csh(w.x)*cos(w.y), cch(w.x)*sin(w.y)) * ${P}.w; }\n`;
    case 15: return pre + `{ vec2 w = z*${P}.z; w.x = clamp(w.x,-12.0,12.0);
  vec2 sh = vec2(csh(w.x)*cos(w.y), cch(w.x)*sin(w.y)), ch = vec2(cch(w.x)*cos(w.y), csh(w.x)*sin(w.y)); z = cdiv(sh, ch) * ${P}.w; }\n`;
    case 16: return pre + `{ float r = length(z); z *= pow(r/max(${P}.w,0.05) + 1e-4, ${P}.z - 1.0); }\n`;
    case 17: return pre + `{ float t = atan(z.y, z.x); z *= 1.0 + ${P}.w*cos(floor(${P}.z+0.5)*t + ${Q}.y); }\n`;
    case 18: return pre + `z += ${P}.w*vec2(sin(${P}.z*z.y + ${Q}.y), sin(${P}.z*z.x - ${Q}.y));\n`;
    case 19: return pre + `{ vec2 c = ${P}.w*vec2(cos(0.6 + ${Q}.y), sin(0.6 + ${Q}.y)); float n = floor(${P}.z+0.5);
  for (int k=0;k<8;k++){ if (float(k) >= n) break; z = abs(z)/max(dot(z,z), 1e-3) - c; } }\n`;
    case 20: return pre + `{ vec2 f = vec2(${P}.z, 0.0); z = clog(cdiv(z + f, z - f)) * ${P}.w; }\n`;
    case 21: return pre + `{ float n = floor(${P}.z+0.5);
  for (int k=0;k<8;k++){ if (float(k) >= n) break; vec2 z2 = cmul(z,z); z -= ${P}.w*cdiv(cmul(z2,z) - vec2(1.0,0.0), 3.0*z2); } }\n`;
    case 22: return pre + `{ float n = floor(${P}.z+0.5); float r = length(z), t = atan(z.y, z.x);
  vec2 zn = pow(r+1e-6, n)*vec2(cos(n*t), sin(n*t)); z = zn + cdiv(vec2(${P}.w, 0.0), zn); }\n`;
    case 23: return pre + `{ float r = length(z) + 1e-6; z = crot(z, ${P}.z*log(r) + ${Q}.y) * pow(r, ${P}.w - 1.0); }\n`;
    case 24: return pre + `{ vec2 w = cdiv(z - vec2(1.0,0.0), z + vec2(1.0,0.0));
  w = cmul(w, cexp(vec2(${P}.z, ${P}.w + ${Q}.y))); z = cdiv(vec2(1.0,0.0) + w, vec2(1.0,0.0) - w); }\n`;
    default: return '';
  }
}

function symCode(mode) {
  const kale = (mirror) => `{ float r = length(z); float a = atan(z.y,z.x) + uSym.y; float seg = TAU/max(uSym.x,1.0);
  a = mod(a, seg); ${mirror ? 'a = abs(a - 0.5*seg);' : ''} z = r*vec2(cos(a), sin(a)); }\n`;
  switch (mode) {
    case 1: return `z = crot(z, uSym.y); z.x = abs(z.x);\n`;
    case 2: return `z = crot(z, uSym.y); z = abs(z);\n`;
    case 3: return kale(true);
    case 4: return kale(false);
    case 5: return `z = crot(z, uSym.y); z = abs(mod(z/uSym.z + 1.0, 2.0) - 1.0)*uSym.z - 0.5*uSym.z;\n`;
    case 6: return `{ z = crot(z, uSym.y); vec2 s = vec2(1.0, 1.7320508); vec2 p = z/uSym.z;
  vec4 hc = floor(vec4(p, p - vec2(0.5,1.0))/s.xyxy) + 0.5;
  vec4 h = vec4(p - hc.xy*s, p - (hc.zw + 0.5)*s);
  z = (dot(h.xy,h.xy) < dot(h.zw,h.zw) ? h.xy : h.zw) * uSym.z * 2.0;
  float r = length(z); float a = atan(z.y,z.x); float seg = TAU/6.0; a = abs(mod(a,seg) - 0.5*seg); z = r*vec2(cos(a),sin(a)); }\n`;
    case 7: return `{ z = crot(z, uSym.y); float q = dot(z,z); float R = uSym.z*uSym.z; if (q > R) z = z*R/q; z.x = abs(z.x); }\n`;
    default: return '';
  }
}

// Per-source layer code, emitted bottom → top in the user's layer order
const LAYER_CODE = {
  dw: `  {
    vec3 s = cosPal(dwv*uDw.w + length(dwo)*0.6, uPal[0], uPal[1], uPal[2], uPal[3]) * (0.35 + 0.9*dwv);
    col = layer(col, s, uDw.x, uBl.y);
  }
`,
  ph: `  {
    vec2 zp = crot(z - uPhT.xy, -uPhT.z) / uPh.y * uPhFlip;
    vec2 uv = (zp + wv*uPh.z*2.0) * uPhAsp * 0.5 + 0.5;
    float inside = 1.0;
    vec2 tuv = mirror(uv);
    if (uPhEdge > 1.5) { inside = step(0.0, uv.x)*step(uv.x, 1.0)*step(0.0, uv.y)*step(uv.y, 1.0); tuv = clamp(uv, 0.0, 1.0); }
    else if (uPhEdge > 0.5) tuv = fract(uv);
    vec3 s = texture2D(uPhoto, tuv).rgb;
    s = hueShift(s, uPh.w);
    s = mix(vec3(luma(s)), s, uPhSat);
    col = layer(col, s, uPh.x*inside, uBl.x);
  }
`,
  qc: `  {
    float sum = 0.0; int n = int(uQc2.x);
    float ph = uQc.z + uQc2.y*length(z);
    for (int i=0;i<16;i++){
      if (i >= n) break;
      float a = float(i)*PI/uQc2.x;
      sum += cos(dot(z, vec2(cos(a), sin(a)))*uQc.y + ph);
    }
    sum /= uQc2.x;
    float v = sum*uQc.w;
    if (uQc2.z > 1.5) v = smoothstep(-0.05, 0.05, sum)*0.5 + sum*0.1;
    else if (uQc2.z > 0.5) v = abs(sum)*uQc.w;
    float lum = 0.55 + 0.45*clamp(sum*1.5 + 0.3, -1.0, 1.0);
    vec3 s = cosPal(v*0.5, uPal[4], uPal[5], uPal[6], uPal[7]) * lum;
    col = layer(col, s, uQc.x, uBl.z);
  }
`,
  rd: `  {
    vec2 uv = mirror(z/uRd.y*0.5 + 0.5 + wv*0.05);
    float v = texture2D(uRD, uv).g;
    v = clamp(v*2.5, 0.0, 1.0);
    if (uRd.z > 0.5) v = 1.0 - v;
    vec3 s = cosPal(v*uRd.w*0.5, uPal[8], uPal[9], uPal[10], uPal[11]) * smoothstep(0.0, 0.35, v);
    col = layer(col, s, uRd.x, uBl.w);
  }
`,
  py: `  {
    vec2 uv = mirror(z/uPy.y*0.5 + 0.5 + wv*0.05);
    float t = texture2D(uPY, uv).r;
    float v = 1.0 - exp(-t*uPy.z);
    vec3 s = cosPal(v*0.85, uPal[12], uPal[13], uPal[14], uPal[15]) * v * 1.2;
    col = layer(col, s, uPy.x, uBl2.x);
  }
`,
  fr: `  {
    // escape-time fractal with orbit traps. uFr: op, zoom, iters, density. uFr2: type, trap, cx, cy
    vec2 p = z / uFr.y + uFr2.zw;
    vec2 c = uFrC, w = p;
    if (uFr2.x > 0.5 && uFr2.x < 1.5) { c = p; w = vec2(0.0); }
    float trap = 1e9, n = 0.0, m2 = 0.0, esc = 0.0;
    for (int i=0;i<200;i++){
      if (float(i) >= uFr.z) break;
      if (uFr2.x > 1.5) w = abs(w);
      w = cmul(w, w) + c;
      m2 = dot(w, w);
      float t = uFr2.y < 1.5 ? m2 : (uFr2.y < 2.5 ? abs(sqrt(m2) - 0.7) : min(abs(w.x), abs(w.y)));
      trap = min(trap, t);
      if (m2 > 256.0) { esc = 1.0; break; }
      n += 1.0;
    }
    float v, lum;
    if (uFr2.y < 0.5) {
      float sn = n - log2(max(log2(max(m2, 1.0001)), 1e-4)) + 4.0;
      v = sn * 0.035 * uFr.w; lum = esc * (0.25 + 0.75*smoothstep(0.0, 6.0, sn));
    } else {
      float st = sqrt(trap);
      v = st * 1.6 * uFr.w + n * 0.015;
      lum = 0.28 + 0.95*exp(-st * 2.5);
    }
    vec3 s = cosPal(v, uPal[16], uPal[17], uPal[18], uPal[19]) * lum;
    col = layer(col, s, uFr.x, uBl2.y);
  }
`,
  pt: `  {
    // op-art patterns. uPt: op, scale, count, sharp. uPt2: mode, phase, twist, _
    vec2 q = z * uPt.y;
    float r = length(q), a = atan(q.y, q.x), v = 0.0, edge = 1.0;
    float ph = uPt2.y, k = uPt.z, sh = uPt.w;
    if (uPt2.x < 0.5) {                      // hypnotic spiral
      float sw = sin(k*a + uPt2.z*log(r + 1e-3)*6.0 - ph);
      v = 0.5 + 0.5*clamp(sw*sh, -1.0, 1.0);
    } else if (uPt2.x < 1.5) {               // moire rings
      vec2 o = 0.35*vec2(cos(ph), sin(ph));
      float m = sin(length(q - o)*k*3.0) * sin(length(q + o)*k*3.0 + uPt2.z*a);
      v = 0.5 + 0.5*clamp(m*sh, -1.0, 1.0);
    } else if (uPt2.x < 2.5) {               // voronoi cells
      vec2 g = floor(q*k*0.5), f = fract(q*k*0.5);
      float d1 = 8.0, d2 = 8.0; float id = 0.0;
      for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++){
        vec2 b = vec2(float(x), float(y));
        float h = hash12(g + b);
        vec2 o = 0.5 + 0.4*sin(ph + TAU*vec2(h, hash12(g + b + 17.3)));
        float d = length(b + o - f);
        if (d < d1) { d2 = d1; d1 = d; id = h; } else if (d < d2) d2 = d;
      }
      v = id + uPt2.z*d1;
      edge = smoothstep(0.0, 0.08/max(sh*0.25, 0.05), d2 - d1);
    } else if (uPt2.x < 3.5) {               // truchet arcs
      vec2 g = floor(q*k*0.5), f = fract(q*k*0.5) - 0.5;
      if (hash12(g) > 0.5) f.x = -f.x;
      float d = min(abs(length(f - 0.5) - 0.5), abs(length(f + 0.5) - 0.5));
      float band = 0.5 + 0.5*sin(d*TAU*2.0 - ph + uPt2.z*r);
      v = band + hash12(g)*0.3;
      edge = smoothstep(0.02, 0.02 + 0.3/max(sh, 0.2), 0.25 - d) * 0.8 + 0.2;
    } else {                                 // warped checker
      vec2 w = q*k*0.5 + 0.35*vec2(sin(q.y*2.0 + ph), sin(q.x*2.0 - ph)) + uPt2.z*vec2(-q.y, q.x)*0.2;
      float c = sin(w.x*PI)*sin(w.y*PI);
      v = 0.5 + 0.5*clamp(c*sh, -1.0, 1.0);
      v += 0.15*r;
    }
    vec3 s = cosPal(v, uPal[20], uPal[21], uPal[22], uPal[23]) * edge;
    col = layer(col, s, uPt.x, uBl2.z);
  }
`,
};
export const DEFAULT_ORDER = ['dw', 'ph', 'qc', 'rd', 'py', 'fr', 'pt'];
// Coordinate routes per layer: 0 = Symmetry + Maps, 1 = Symmetry only, 2 = Maps only, 3 = straight (view only)
export const ROUTE_NAMES = ['Symmetry + Maps', 'Symmetry only', 'Maps only', 'Straight (no warp)'];
function layerCode(order, routes) {
  const seen = new Set(), list = [];
  for (const k of [...(order || []), ...DEFAULT_ORDER]) if (LAYER_CODE[k] && !seen.has(k)) { seen.add(k); list.push(k); }
  return list.map(k => `#ifdef SRC_${k.toUpperCase()}\n  { vec2 z = zR${(routes && routes[k]) | 0};\n${LAYER_CODE[k]}  }\n#endif\n`).join('');
}
// Emit only the coordinate variants that enabled layers actually use
function coordCode(S) {
  const R = S.routes || {}, used = new Set();
  for (const k of DEFAULT_ORDER) if (S[k]) used.add((R[k] | 0));
  if (S.dw) used.add(R.dw | 0);
  if (!used.size) used.add(0);
  let maps = '';
  S.maps.forEach((t, i) => { maps += mapCode(t, i); });
  const sym = symCode(S.sym);
  const guard = '  if (!(abs(z.x) < 1e4)) z.x = 1e4; if (!(abs(z.y) < 1e4)) z.y = 1e4;\n';
  const body = { 0: S.co ? maps + sym : sym + maps, 1: sym, 2: maps, 3: '' };
  let out = '';
  for (const r of [0, 1, 2, 3]) out += `  vec2 zR${r} = z0;\n` + (used.has(r) ? `  { vec2 z = z0;\n${body[r]}${guard}  zR${r} = z; }\n` : '');
  return out;
}

export function composeFS(S) {
  // S: { ph, dw, qc, rd, py, dwOct, dwIter, maps:[t1..t4], sym }
  const D = [];
  if (S.ph) D.push('#define SRC_PH');
  if (S.dw) D.push('#define SRC_DW');
  if (S.qc) D.push('#define SRC_QC');
  if (S.rd) D.push('#define SRC_RD');
  if (S.py) D.push('#define SRC_PY');
  if (S.fr) D.push('#define SRC_FR');
  if (S.pt) D.push('#define SRC_PT');
  D.push(`#define DW_OCT ${S.dwOct | 0}`, `#define DW_ITER ${S.dwIter | 0}`, `#define DW_BASIS ${S.dwBasis | 0}`);
  return PREC + D.join('\n') + '\n' + COMMON + `
varying vec2 vUv;
uniform vec2 uRes;
uniform vec4 uView;     // pan x, pan y, zoom, rot
uniform vec4 uM[8];
uniform vec4 uSym;      // folds, rot, cell
uniform vec3 uPal[24];  // dw, qc, rd, py, fr, pt palettes (a,b,c,d)
uniform vec4 uBl;       // blend modes ph, dw, qc, rd
uniform vec4 uBl2;      // blend modes py, fr, pt
uniform sampler2D uPhoto; uniform vec2 uPhAsp; uniform vec4 uPh; uniform float uPhSat; uniform float uPhEdge;
uniform vec4 uPhT;      // image offset x, y, rotation, _
uniform vec2 uPhFlip;   // ±1 per axis
uniform vec4 uFr; uniform vec4 uFr2; uniform vec2 uFrC;  // fractal
uniform vec4 uPt; uniform vec4 uPt2;                     // pattern
uniform vec4 uDw; uniform vec2 uDwFlow;
uniform vec4 uQc; uniform vec3 uQc2;
uniform sampler2D uRD; uniform vec4 uRd;
uniform sampler2D uPY; uniform vec4 uPy;

vec3 blendMode(vec3 c, vec3 s, float m){
  if (m < 0.5) return s;
  if (m < 1.5) return c + s;
  if (m < 2.5) return 1.0 - (1.0-clamp(c,0.0,1.0))*(1.0-clamp(s,0.0,1.0));
  if (m < 3.5) return c*s;
  if (m < 4.5) return abs(c - s);
  if (m < 5.5) return max(c, s);
  if (m < 6.5) { vec3 cc = clamp(c,0.0,1.0); return mix(2.0*cc*s, 1.0-2.0*(1.0-cc)*(1.0-s), step(0.5, cc)); }
  return c + s - 2.0*c*s;
}
vec3 layer(vec3 c, vec3 s, float op, float m){ return mix(c, blendMode(c, s, m), op); }

float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  float a = hash12(i), b = hash12(i+vec2(1.0,0.0)), c = hash12(i+vec2(0.0,1.0)), d = hash12(i+vec2(1.0,1.0));
  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
}
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(0.1031,0.1030,0.0973)); p3 += dot(p3, p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float gnoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  float a = dot(hash22(i)*2.0-1.0, f), b = dot(hash22(i+vec2(1.0,0.0))*2.0-1.0, f-vec2(1.0,0.0));
  float c = dot(hash22(i+vec2(0.0,1.0))*2.0-1.0, f-vec2(0.0,1.0)), d = dot(hash22(i+vec2(1.0,1.0))*2.0-1.0, f-vec2(1.0,1.0));
  return clamp(0.5 + 0.9*mix(mix(a,b,u.x), mix(c,d,u.x), u.y), 0.0, 1.0);
}
vec2 worley(vec2 p){
  vec2 g = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++){
    vec2 b = vec2(float(x), float(y)); vec2 o = hash22(g + b);
    float d = length(b + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return vec2(d1, d2);
}
float tri(float x){ return abs(fract(x) - 0.5)*2.0; }
// Warp basis ("wave type") — every option returns roughly [0,1]
float basis(vec2 p){
#if DW_BASIS == 1
  return gnoise(p);
#elif DW_BASIS == 2
  float g = 1.0 - abs(2.0*gnoise(p) - 1.0); return g*g;
#elif DW_BASIS == 3
  return abs(2.0*gnoise(p) - 1.0);
#elif DW_BASIS == 4
  return 0.5 + 0.5*sin(p.x*PI)*sin(p.y*PI);
#elif DW_BASIS == 5
  return 0.5*(tri(p.x*0.5) + tri(p.y*0.5));
#elif DW_BASIS == 6
  float sx = smoothstep(0.12, 0.38, abs(fract(p.x*0.5) - 0.5)), sy = smoothstep(0.12, 0.38, abs(fract(p.y*0.5) - 0.5));
  return sx*sy + (1.0-sx)*(1.0-sy);
#elif DW_BASIS == 7
  return clamp(worley(p).x, 0.0, 1.0);
#elif DW_BASIS == 8
  vec2 w = worley(p); return clamp((w.y - w.x)*2.0, 0.0, 1.0);
#elif DW_BASIS == 9
  return 0.5 + (sin(p.x*2.0) + sin(dot(p, vec2(-1.0, 1.7320508))) + sin(dot(p, vec2(-1.0, -1.7320508))))/6.0;
#elif DW_BASIS == 10
  return 0.5 + 0.5*cos(length(fract(p*0.5) - 0.5)*TAU*1.2);
#elif DW_BASIS == 11
  vec2 q = fract(p*0.5) - 0.5; float a = atan(q.y, q.x); float r = length(q);
  return 0.5 + 0.5*sin(a + r*8.0) * smoothstep(0.0, 0.15, r);
#else
  return vnoise(p);
#endif
}
float fbm(vec2 p){
  float f = 0.0, a = 0.5, n = 0.0;
  for (int i=0;i<DW_OCT;i++){ f += a*basis(p); n += a; p = mat2(1.6,1.2,-1.2,1.6)*p + vec2(3.1,1.7); a *= 0.5; }
  return f/n;
}

void main(){
  vec2 z0 = (vUv - 0.5) * vec2(uRes.x/uRes.y, 1.0) * 2.0;
  z0 = crot(z0, uView.w) / uView.z + uView.xy;
${coordCode(S)}
  vec3 col = vec3(0.0);
  // warp field is computed up front so photo/RD/physarum displacement works whatever the layer order
  vec2 wv = vec2(0.0);
#ifdef SRC_DW
  vec2 dwo = vec2(0.0); float dwv = 0.0;
  { vec2 z = zR${(S.routes && S.routes.dw) | 0};
    vec2 q = z*uDw.y + uDwFlow;
    for (int i=0;i<DW_ITER;i++){
      float fi = float(i+1);
      dwo = vec2(fbm(q + uDw.z*dwo + vec2(1.7,9.2)*fi), fbm(q + uDw.z*dwo + vec2(8.3,2.8)*fi));
    }
    dwv = fbm(q + uDw.z*dwo);
    wv = dwo - 0.5;
  }
#endif
${layerCode(S.order, S.routes)}  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;
}

// ---------- feedback ----------
export const FEEDBACK_FS = PREC + COMMON + `
varying vec2 vUv;
uniform sampler2D uCur, uPrev; uniform vec2 uRes;
uniform vec4 uFb;  // amt, zoom, rot(rad), hue
uniform vec4 uFb2; // dx, dy, mode, disp
void main(){
  vec3 cur = texture2D(uCur, vUv).rgb;
  float asp = uRes.x/uRes.y;
  vec2 c = vUv - 0.5; c.x *= asp; c = crot(c, uFb.z) / uFb.y; c.x /= asp; c += 0.5 + uFb2.xy;
  if (abs(uFb2.w) > 0.0) {
    vec2 e = 1.0/uRes;
    vec2 g = vec2(luma(texture2D(uCur, vUv+vec2(e.x,0.0)).rgb) - luma(texture2D(uCur, vUv-vec2(e.x,0.0)).rgb),
                  luma(texture2D(uCur, vUv+vec2(0.0,e.y)).rgb) - luma(texture2D(uCur, vUv-vec2(0.0,e.y)).rgb));
    c += vec2(-g.y, g.x)*uFb2.w*20.0 + g*uFb2.w*8.0;
  }
  vec3 p = texture2D(uPrev, mirror(c)).rgb;
  p = max(hueShift(p, uFb.w), 0.0);
  vec3 o;
  float a = uFb.x;
  if (uFb2.z < 0.5) o = mix(cur, p, a);
  else if (uFb2.z < 1.5) o = max(cur*(1.0-a*0.3), p*a);
  else if (uFb2.z < 2.5) o = mix(cur, abs(cur - p), a);
  else o = 1.0 - (1.0 - clamp(cur,0.0,1.0))*(1.0 - clamp(p*a,0.0,1.0));
  gl_FragColor = vec4(clamp(o, 0.0, 4.0), 1.0);
}
`;

// ---------- palette cycling ----------
export const PALETTE_FS = PREC + COMMON + `
varying vec2 vUv;
uniform sampler2D uImg; uniform vec2 uRes;
uniform vec4 uPc;   // amt, phase, bands, src
uniform float uPost;
uniform vec3 uPP[4];
void main(){
  vec3 c = texture2D(uImg, vUv).rgb;
  if (uPc.x > 0.0) {
    float l = luma(c); vec3 hsv = rgb2hsv(clamp(c,0.0,1.0)); float t;
    if (uPc.w < 0.5) t = l;
    else if (uPc.w < 1.5) t = hsv.x;
    else if (uPc.w < 2.5) t = hsv.x + l;
    else { vec2 q = (vUv-0.5)*vec2(uRes.x/uRes.y,1.0); t = length(q) + l; }
    if (uPost > 0.5) t = floor(t*uPost)/uPost;
    vec3 p = cosPal(t*uPc.z + uPc.y, uPP[0], uPP[1], uPP[2], uPP[3]);
    p *= mix(1.0, smoothstep(0.0, 0.25, l) , 0.6);
    c = mix(c, p, uPc.x);
  } else if (uPost > 0.5) { c = floor(c*uPost)/uPost; }
  gl_FragColor = vec4(c, 1.0);
}
`;

// ---------- bloom ----------
export const BRIGHT_FS = PREC + COMMON + `
varying vec2 vUv; uniform sampler2D uImg; uniform vec2 uTexel; uniform float uThr;
void main(){
  vec3 c = vec3(0.0);
  c += texture2D(uImg, vUv + uTexel*vec2(-1.0,-1.0)).rgb; c += texture2D(uImg, vUv + uTexel*vec2(1.0,-1.0)).rgb;
  c += texture2D(uImg, vUv + uTexel*vec2(-1.0,1.0)).rgb;  c += texture2D(uImg, vUv + uTexel*vec2(1.0,1.0)).rgb;
  c *= 0.25;
  float l = luma(c);
  gl_FragColor = vec4(c * smoothstep(uThr, uThr + 0.25, l), 1.0);
}
`;
export const BLUR_FS = PREC + `
varying vec2 vUv; uniform sampler2D uImg; uniform vec2 uDir;
void main(){
  vec3 c = texture2D(uImg, vUv).rgb*0.227027;
  c += texture2D(uImg, vUv + uDir*1.384615).rgb*0.316216; c += texture2D(uImg, vUv - uDir*1.384615).rgb*0.316216;
  c += texture2D(uImg, vUv + uDir*3.230769).rgb*0.070270; c += texture2D(uImg, vUv - uDir*3.230769).rgb*0.070270;
  gl_FragColor = vec4(c, 1.0);
}
`;

// ---------- FX (screen-space distortion + stylize) — its own pass so it can be reordered in the image chain ----------
export const FX_FS = PREC + COMMON + `
varying vec2 vUv;
uniform sampler2D uImg; uniform vec2 uRes;
uniform vec4 uFx;  // ripple amp, ripple freq, ripple phase, swirl
uniform vec4 uFx2; // glitch, slices, glitch step, liquid rgb
uniform vec4 uFx3; // pixelate px, halftone amt, halftone px, solarize
uniform vec4 uFx4; // scanlines, swirl radius, mirror, _
vec2 fxUv(vec2 uv){
  float asp = uRes.x/uRes.y, unit = uRes.y/1080.0;
  if (uFx3.x > 1.0) { vec2 px = vec2(uFx3.x*unit)/uRes; uv = (floor(uv/px) + 0.5)*px; }
  if (uFx.x > 0.0) uv += uFx.x*0.02*vec2(sin(uv.y*uFx.y*TAU + uFx.z), cos(uv.x*uFx.y*TAU*asp + uFx.z*1.3));
  if (uFx.w != 0.0) {
    vec2 q = (uv - 0.5)*vec2(asp, 1.0); float r = length(q);
    float t = max(0.0, 1.0 - r/max(uFx4.y, 0.01)); q = crot(q, uFx.w*t*t*4.0);
    uv = q/vec2(asp, 1.0) + 0.5;
  }
  if (uFx4.z > 0.5) { uv.x = 0.5 - abs(uv.x - 0.5); }
  if (uFx2.x > 0.0) {
    float band = floor(uv.y*uFx2.y);
    float h = hash12(vec2(band, uFx2.z)), h2 = hash12(vec2(band*1.7 + 3.1, uFx2.z + 9.0));
    if (h > 1.0 - uFx2.x*0.6) uv.x += (h2 - 0.5)*uFx2.x*0.35;
  }
  return uv;
}
void main(){
  vec2 uv = fxUv(vUv);
  vec2 off = vec2(0.0);
  if (uFx2.w > 0.0) {
    vec2 e = 6.0/uRes;
    vec2 g = vec2(luma(texture2D(uImg, uv+vec2(e.x,0.0)).rgb) - luma(texture2D(uImg, uv-vec2(e.x,0.0)).rgb),
                  luma(texture2D(uImg, uv+vec2(0.0,e.y)).rgb) - luma(texture2D(uImg, uv-vec2(0.0,e.y)).rgb));
    vec2 sw = vec2(sin(uv.y*9.0 + uFx.z), cos(uv.x*7.0 - uFx.z));   // slow liquid drift so flat areas move too
    off += (g*0.05 + sw*0.004*luma(texture2D(uImg, uv).rgb)) * uFx2.w;
  }
  vec3 c = vec3(texture2D(uImg, uv + off).r, texture2D(uImg, uv).g, texture2D(uImg, uv - off).b);
  if (uFx2.x > 0.0) {
    float band = floor(uv.y*uFx2.y*0.5);
    if (hash12(vec2(band + 5.0, uFx2.z)) > 1.0 - uFx2.x*0.3) c = c.gbr;
  }
  if (uFx3.w > 0.0) { vec3 cl = clamp(c, 0.0, 1.0); vec3 so = mix(cl, 1.0 - cl, step(0.5, cl)) * 2.0; c = mix(c, so, uFx3.w); }
  if (uFx3.y > 0.0) {
    float cs = max(2.0, uFx3.z*uRes.y/1080.0);
    vec2 rc = crot(gl_FragCoord.xy, 0.785398);
    vec2 cell = (floor(rc/cs) + 0.5)*cs;
    vec2 ctr = crot(cell, -0.785398);
    vec3 cc = texture2D(uImg, fxUv(ctr/uRes)).rgb;
    float rad = sqrt(clamp(luma(cc), 0.0, 1.0)) * cs * 0.72;
    float dotm = 1.0 - smoothstep(rad - 1.0, rad + 1.0, length(rc - cell));
    c = mix(c, cc*1.15*dotm, uFx3.y);
  }
  if (uFx4.x > 0.0) c *= 1.0 - uFx4.x*0.6*(0.5 + 0.5*sin(gl_FragCoord.y*PI*(1080.0/uRes.y)*0.5));
  gl_FragColor = vec4(clamp(c, 0.0, 4.0), 1.0);
}
`;

// ---------- post (always last: chroma, edge glow, bloom, color, vignette, tone, grain) ----------
export const POST_FS = PREC + COMMON + `
varying vec2 vUv;
uniform sampler2D uImg, uBloom; uniform vec2 uRes;
uniform vec4 uPo;  // chroma, bloom, edge, sat
uniform vec4 uPo2; // con, bri, hue, vig
uniform vec4 uPo3; // grain, invert, time, _
void main(){
  vec2 uv = vUv;
  vec2 q = vUv - 0.5;
  vec2 off = q * uPo.x * 4.0;
  vec3 c = vec3(texture2D(uImg, uv + off).r, texture2D(uImg, uv).g, texture2D(uImg, uv - off).b);
  if (uPo.z > 0.0) {
    vec2 e = 1.0/uRes;
    float tl = luma(texture2D(uImg, uv+e*vec2(-1.0,1.0)).rgb), t = luma(texture2D(uImg, uv+e*vec2(0.0,1.0)).rgb), tr = luma(texture2D(uImg, uv+e*vec2(1.0,1.0)).rgb);
    float l = luma(texture2D(uImg, uv+e*vec2(-1.0,0.0)).rgb), r = luma(texture2D(uImg, uv+e*vec2(1.0,0.0)).rgb);
    float bl = luma(texture2D(uImg, uv+e*vec2(-1.0,-1.0)).rgb), b = luma(texture2D(uImg, uv+e*vec2(0.0,-1.0)).rgb), br = luma(texture2D(uImg, uv+e*vec2(1.0,-1.0)).rgb);
    float gx = tr + 2.0*r + br - tl - 2.0*l - bl, gy = tl + 2.0*t + tr - bl - 2.0*b - br;
    c += normalize(c + 0.05) * length(vec2(gx, gy)) * uPo.z;
  }
  c += texture2D(uBloom, uv).rgb * uPo.y;
  c = hueShift(c, uPo2.z);
  float L = luma(c);
  c = mix(vec3(L), c, uPo.w);
  c = (c - 0.5)*uPo2.x + 0.5 + uPo2.y;
  c *= 1.0 - uPo2.w*dot(q,q)*2.0;
  c = c / (1.0 + max(c - 1.0, 0.0)*0.5);
  if (uPo3.y > 0.5) c = 1.0 - c;
  c += (hash12(gl_FragCoord.xy + fract(uPo3.z)*977.0) - 0.5) * uPo3.x;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

export const COPY_FS = PREC + `varying vec2 vUv; uniform sampler2D uImg; void main(){ gl_FragColor = texture2D(uImg, vUv); }`;
