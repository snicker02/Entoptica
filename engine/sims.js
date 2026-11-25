// Entoptica — stateful simulations: Gray-Scott reaction-diffusion + Physarum agents
import { PREC, COMMON, VS } from './shaders.js';
import { compile, makePingPong, freePingPong, pass } from './gl.js';

const RD_STEP = PREC + COMMON + `
varying vec2 vUv;
uniform sampler2D uS, uPhoto; uniform vec2 uTexel;
uniform vec4 uP;  // feed, kill, var, advect
uniform vec2 uP2; // modMode, time
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
void main(){
  vec2 uv = vUv;
  if (uP.w > 0.0) {
    float e = 0.01; vec2 p = uv*4.0 + uP2.y*0.05;
    vec2 g = vec2(vn(p+vec2(e,0.0)) - vn(p-vec2(e,0.0)), vn(p+vec2(0.0,e)) - vn(p-vec2(0.0,e)))/(2.0*e);
    uv -= vec2(g.y, -g.x) * uP.w * uTexel * 0.6;
  }
  vec2 c = texture2D(uS, uv).rg;
  vec2 l = -c;
  l += 0.2*(texture2D(uS, uv+vec2(uTexel.x,0.0)).rg + texture2D(uS, uv-vec2(uTexel.x,0.0)).rg
          + texture2D(uS, uv+vec2(0.0,uTexel.y)).rg + texture2D(uS, uv-vec2(0.0,uTexel.y)).rg);
  l += 0.05*(texture2D(uS, uv+uTexel).rg + texture2D(uS, uv-uTexel).rg
          + texture2D(uS, uv+vec2(uTexel.x,-uTexel.y)).rg + texture2D(uS, uv+vec2(-uTexel.x,uTexel.y)).rg);
  float m = 0.5;
  if (uP2.x > 1.5) m = luma(texture2D(uPhoto, vUv).rgb);
  else if (uP2.x > 0.5) m = vn(vUv*5.0)*0.6 + vn(vUv*13.0)*0.4;
  float f = uP.x + uP.z*(m-0.5)*0.03;
  float k = uP.y + uP.z*(m-0.5)*0.008;
  float u = c.r, v = c.g, uvv = u*v*v;
  u += (1.0*l.r - uvv + f*(1.0-u));
  v += (0.5*l.g + uvv - (k+f)*v);
  gl_FragColor = vec4(clamp(u,0.0,1.0), clamp(v,0.0,1.0), 0.0, 1.0);
}
`;

const RD_SEED = PREC + COMMON + `
varying vec2 vUv; uniform sampler2D uPhoto; uniform float uMode; uniform float uSeed;
void main(){
  float v = 0.0;
  if (uMode < 0.5) {
    vec2 g = vUv*14.0; vec2 i = floor(g); vec2 f = fract(g) - 0.5;
    float h = hash12(i + uSeed);
    vec2 o = vec2(hash12(i*1.7+uSeed+3.0), hash12(i*2.3+uSeed+7.0)) - 0.5;
    if (h > 0.72 && length(f - o*0.5) < 0.18) v = 1.0;
  } else if (uMode < 1.5) {
    float r = length(vUv - 0.5); v = step(abs(r - 0.06), 0.02) + step(r, 0.015);
  } else if (uMode < 2.5) {
    float l = luma(texture2D(uPhoto, vUv).rgb);
    v = step(0.55, l) * step(0.6, hash12(vUv*512.0 + uSeed));
  } else {
    v = step(0.93, hash12(floor(vUv*128.0) + uSeed));
  }
  gl_FragColor = vec4(1.0 - v*0.5, v*0.25 + 0.0, 0.0, 1.0);
}
`;

const PY_STEP = PREC + COMMON + `
varying vec2 vUv;
uniform sampler2D uAg, uTr, uPhoto;
uniform vec4 uP;  // sensorAngle, sensorDist(px), turn, speed(px)
uniform vec4 uP2; // attract, seed, trailSize, _
float sense(vec2 pos, float ang){
  vec2 q = pos + vec2(cos(ang), sin(ang)) * uP.y / uP2.z;
  return texture2D(uTr, q).r + uP2.x * luma(texture2D(uPhoto, fract(q)).rgb);
}
void main(){
  vec4 a = texture2D(uAg, vUv);
  vec2 pos = a.xy; float ang = a.z;
  float F = sense(pos, ang), L = sense(pos, ang + uP.x), Rr = sense(pos, ang - uP.x);
  float rnd = hash12(vUv*1024.0 + uP2.y);
  if (F > L && F > Rr) { }
  else if (F < L && F < Rr) ang += (rnd - 0.5) * 2.0 * uP.z;
  else if (L > Rr) ang += uP.z * (0.7 + 0.6*rnd);
  else ang -= uP.z * (0.7 + 0.6*rnd);
  pos = fract(pos + vec2(cos(ang), sin(ang)) * uP.w / uP2.z);
  ang = mod(ang, TAU);
  gl_FragColor = vec4(pos, ang, 1.0);
}
`;

const PY_SPAWN = PREC + COMMON + `
varying vec2 vUv; uniform float uMode; uniform float uSeed;
void main(){
  float h1 = hash12(vUv*917.0 + uSeed), h2 = hash12(vUv*613.0 + uSeed + 11.0), h3 = hash12(vUv*331.0 + uSeed + 23.0);
  vec2 pos; float ang;
  if (uMode < 0.5) { pos = vec2(h1, h2); ang = h3*TAU; }
  else if (uMode < 1.5) { float r = sqrt(h1)*0.08; float a = h2*TAU; pos = 0.5 + r*vec2(cos(a),sin(a)); ang = a; }
  else if (uMode < 2.5) { float r = 0.35 + (h1-0.5)*0.04; float a = h2*TAU; pos = 0.5 + r*vec2(cos(a),sin(a)); ang = a + PI; }
  else { float t = h1; float a = t*TAU*5.0; float r = 0.03 + t*0.42; pos = 0.5 + r*vec2(cos(a),sin(a)) + (h3-0.5)*0.01; ang = a + PI*0.5; }
  gl_FragColor = vec4(fract(pos), mod(ang, TAU), 1.0);
}
`;

const PY_DEP_VS = `
attribute vec2 aPos;
uniform sampler2D uAg;
void main(){ vec4 a = texture2D(uAg, aPos); gl_Position = vec4(a.xy*2.0-1.0, 0.0, 1.0); gl_PointSize = 1.0; }
`;
const PY_DEP_FS = PREC + `uniform float uDep; void main(){ gl_FragColor = vec4(uDep, 0.0, 0.0, 1.0); }`;

const PY_DIFF = PREC + `
varying vec2 vUv; uniform sampler2D uTr; uniform vec2 uTexel; uniform vec2 uP; // decay, diffuse
void main(){
  float c = texture2D(uTr, vUv).r; float s = 0.0;
  for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++) s += texture2D(uTr, vUv + vec2(float(x),float(y))*uTexel).r;
  gl_FragColor = vec4(mix(c, s/9.0, uP.y)*uP.x, 0.0, 0.0, 1.0);
}
`;

export class Sims {
  constructor(core) {
    this.core = core;
    const gl = core.gl, T = core.types;
    this.rdOk = !!T.state;
    this.pyOk = !!T.state && !!T.accum && core.caps.vtf;
    this.rd = null; this.py = null; this.ag = null; this.idxBuf = null;
    if (this.rdOk) {
      this.pRdStep = compile(gl, VS, RD_STEP, 'rd-step');
      this.pRdSeed = compile(gl, VS, RD_SEED, 'rd-seed');
    }
    if (this.pyOk) {
      this.pPyStep = compile(gl, VS, PY_STEP, 'py-step');
      this.pPySpawn = compile(gl, VS, PY_SPAWN, 'py-spawn');
      this.pPyDep = compile(gl, PY_DEP_VS, PY_DEP_FS, 'py-dep');
      this.pPyDiff = compile(gl, VS, PY_DIFF, 'py-diff');
    }
    this.frame = 0;
  }
  ensureRD(size, P, photo) {
    if (!this.rdOk) return;
    if (this.rd && this.rd.w === size) return;
    freePingPong(this.core.gl, this.rd);
    this.rd = makePingPong(this.core.gl, size, size, this.core.types.state, this.core.types.stateLinear, true);
    this.seedRD(P, photo);
  }
  seedRD(P, photo) {
    if (!this.rd) return;
    pass(this.core, this.pRdSeed, this.rd.read, this.rd.w, this.rd.h, (u, bind) => {
      bind('uPhoto', photo); this.core.gl.uniform1f(u.uMode, P.rd_seedm); this.core.gl.uniform1f(u.uSeed, Math.random() * 100);
    });
  }
  stepRD(P, photo, time) {
    if (!this.rd) return;
    const gl = this.core.gl, n = P.rd_steps | 0, t = 1 / this.rd.w;
    for (let i = 0; i < n; i++) {
      pass(this.core, this.pRdStep, this.rd.write, this.rd.w, this.rd.h, (u, bind) => {
        bind('uS', this.rd.read.tex); bind('uPhoto', photo);
        gl.uniform2f(u.uTexel, t, t);
        gl.uniform4f(u.uP, P.rd_feed, P.rd_kill, P.rd_var, P.rd_adv);
        gl.uniform2f(u.uP2, P.rd_mod, time);
      });
      this.rd.swap();
    }
  }
  ensurePY(agentSide, trail, P) {
    if (!this.pyOk) return;
    const gl = this.core.gl, T = this.core.types;
    if (!this.ag || this.ag.w !== agentSide) {
      freePingPong(gl, this.ag);
      this.ag = makePingPong(gl, agentSide, agentSide, T.state, false, false);
      const n = agentSide * agentSide, idx = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { idx[i * 2] = ((i % agentSide) + .5) / agentSide; idx[i * 2 + 1] = (Math.floor(i / agentSide) + .5) / agentSide; }
      if (!this.idxBuf) this.idxBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.idxBuf);
      gl.bufferData(gl.ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      this.agentCount = n;
      this.spawnPY(P);
    }
    if (!this.py || this.py.w !== trail) {
      freePingPong(gl, this.py);
      this.py = makePingPong(gl, trail, trail, T.accum, T.accumLinear, true);
      this.clearPY();
    }
  }
  clearPY() {
    const gl = this.core.gl;
    for (const t of [this.py.read, this.py.write]) { gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  spawnPY(P) {
    if (!this.ag) return;
    pass(this.core, this.pPySpawn, this.ag.read, this.ag.w, this.ag.h, (u) => {
      this.core.gl.uniform1f(u.uMode, P.py_spawn); this.core.gl.uniform1f(u.uSeed, Math.random() * 100);
    });
    if (this.py) this.clearPY();
  }
  stepPY(P, photo) {
    if (!this.ag || !this.py) return;
    const gl = this.core.gl, D = Math.PI / 180, ts = this.py.w;
    const scale = ts / 512; // keep behaviour roughly resolution independent
    for (let s = 0; s < (P.py_steps | 0); s++) {
      this.frame++;
      pass(this.core, this.pPyStep, this.ag.write, this.ag.w, this.ag.h, (u, bind) => {
        bind('uAg', this.ag.read.tex); bind('uTr', this.py.read.tex); bind('uPhoto', photo);
        gl.uniform4f(u.uP, P.py_sa * D, P.py_sd * scale, P.py_ra * D, P.py_speed * scale);
        gl.uniform4f(u.uP2, P.py_att, (this.frame % 997) * 0.731, ts, 0);
      });
      this.ag.swap();
      // deposit
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.py.read.fb);
      gl.viewport(0, 0, ts, ts);
      gl.useProgram(this.pPyDep.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.idxBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.ag.read.tex);
      gl.uniform1i(this.pPyDep.u.uAg, 0);
      const density = (512 * 512) / this.agentCount; // fewer agents → stronger deposit
      gl.uniform1f(this.pPyDep.u.uDep, P.py_dep * Math.min(4, Math.max(.25, density)) * (ts / 512) * (ts / 512));
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.POINTS, 0, this.agentCount);
      gl.disable(gl.BLEND);
      // diffuse + decay
      pass(this.core, this.pPyDiff, this.py.write, ts, ts, (u, bind) => {
        bind('uTr', this.py.read.tex);
        gl.uniform2f(u.uTexel, 1 / ts, 1 / ts);
        gl.uniform2f(u.uP, P.py_decay, P.py_diff);
      });
      this.py.swap();
    }
  }
  release() {
    const gl = this.core.gl;
    freePingPong(gl, this.rd); freePingPong(gl, this.ag); freePingPong(gl, this.py);
    this.rd = this.ag = this.py = null;
  }
}

export const SIM_SHADERS = { RD_STEP, RD_SEED, PY_STEP, PY_SPAWN, PY_DEP_FS, PY_DIFF, PY_DEP_VS };
