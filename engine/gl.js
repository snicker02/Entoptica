// Entoptica — WebGL1 core helpers
export function createGL(canvas) {
  const gl = canvas.getContext('webgl', {
    alpha: false, antialias: false, depth: false, stencil: false,
    premultipliedAlpha: false, preserveDrawingBuffer: false,
  });
  if (!gl) throw new Error('WebGL is not available in this browser.');
  const ext = {
    float: gl.getExtension('OES_texture_float'),
    floatLinear: gl.getExtension('OES_texture_float_linear'),
    half: gl.getExtension('OES_texture_half_float'),
    halfLinear: gl.getExtension('OES_texture_half_float_linear'),
    cbFloat: gl.getExtension('WEBGL_color_buffer_float'),
    cbHalf: gl.getExtension('EXT_color_buffer_half_float'),
    floatBlend: gl.getExtension('EXT_float_blend'),
    deriv: gl.getExtension('OES_standard_derivatives'),
  };
  const caps = {
    maxTex: gl.getParameter(gl.MAX_TEXTURE_SIZE),
    maxRB: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
    maxVP: gl.getParameter(gl.MAX_VIEWPORT_DIMS),
    vtf: gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0,
    highp: (() => { const f = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT); return f && f.precision > 0; })(),
  };
  caps.maxOut = Math.min(caps.maxTex, caps.maxRB, caps.maxVP[0], caps.maxVP[1]);

  // fullscreen triangle-pair
  const quad = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

  // probe renderable texture types
  function testRenderable(type, blend) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 4, 0, gl.RGBA, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    let ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    if (ok) {
      gl.viewport(0, 0, 4, 4);
      gl.clearColor(0.5, 0.25, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (blend) { gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.clear(gl.COLOR_BUFFER_BIT); gl.disable(gl.BLEND); }
      ok = gl.getError() === gl.NO_ERROR;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb); gl.deleteTexture(t);
    return ok;
  }
  while (gl.getError() !== gl.NO_ERROR) { /* clear */ }
  const types = { byte: gl.UNSIGNED_BYTE };
  if (ext.float && testRenderable(gl.FLOAT)) types.float = gl.FLOAT;
  if (ext.half && testRenderable(ext.half.HALF_FLOAT_OES)) types.half = ext.half.HALF_FLOAT_OES;
  // precise state texture (agents / RD)
  types.state = types.float || types.half || null;
  types.stateLinear = types.float ? !!ext.floatLinear : (types.half ? !!ext.halfLinear : false);
  // blendable accumulation texture (physarum trail)
  types.accum = (types.half && testRenderable(types.half, true)) ? types.half
    : (types.float && ext.floatBlend && testRenderable(types.float, true)) ? types.float : null;
  types.accumLinear = types.accum === types.half ? !!ext.halfLinear : !!ext.floatLinear;
  // smooth color texture for feedback
  types.color = (types.half && ext.halfLinear) ? types.half : gl.UNSIGNED_BYTE;
  types.colorLinear = true;

  return { gl, ext, caps, quad, types };
}

export function compile(gl, vsSrc, fsSrc, label = 'shader') {
  const mk = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s);
      gl.deleteShader(s);
      throw new Error(label + (type === gl.VERTEX_SHADER ? ' VS' : ' FS') + ': ' + log);
    }
    return s;
  };
  const vs = mk(gl.VERTEX_SHADER, vsSrc), fs = mk(gl.FRAGMENT_SHADER, fsSrc);
  const p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs);
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  gl.deleteShader(vs); gl.deleteShader(fs);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(label + ' link: ' + gl.getProgramInfoLog(p));
  const u = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    u[name] = gl.getUniformLocation(p, info.name);
  }
  return { prog: p, u };
}

export function makeTex(gl, w, h, type, linear, repeat = false, data = null) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, data);
  const f = linear ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  const wr = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wr);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wr);
  return t;
}

export function makeTarget(gl, w, h, type, linear, repeat = false) {
  const tex = makeTex(gl, w, h, type, linear, repeat);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fb, w, h, type };
}

export function freeTarget(gl, t) {
  if (!t) return;
  gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb);
}

export function makePingPong(gl, w, h, type, linear, repeat = false) {
  const a = makeTarget(gl, w, h, type, linear, repeat), b = makeTarget(gl, w, h, type, linear, repeat);
  return { read: a, write: b, w, h, swap() { const t = this.read; this.read = this.write; this.write = t; } };
}

export function freePingPong(gl, pp) { if (pp) { freeTarget(gl, pp.read); freeTarget(gl, pp.write); } }

// Draw fullscreen with program into target (null = screen)
export function pass(core, prog, target, w, h, setup) {
  const { gl, quad } = core;
  gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
  gl.viewport(0, 0, w, h);
  gl.useProgram(prog.prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  let unit = 0;
  const bind = (name, tex) => {
    if (prog.u[name] === undefined) return;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(prog.u[name], unit);
    unit++;
  };
  if (setup) setup(prog.u, bind);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
}
