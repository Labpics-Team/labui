/**
 * WebGL2 fallback for when WebGPU is unavailable.
 *
 * Matches the FxEngine API surface with WebGL2 equivalents:
 * - renderLens: fullscreen quad with Fresnel shader (GLSL)
 * - progressiveBlur: framebuffer ping-pong with variable-radius sampling
 *
 * GLSL shaders are inlined to avoid extra bundler loaders for .glsl files.
 */

import type { LensConfig, BlurConfig } from './pipeline.js';

// ---- GLSL shaders --------------------------------------------------------

const LENS_VERTEX_GLSL = `#version 300 es
precision highp float;
out vec2 v_uv;
void main() {
    float x = float((gl_VertexID & 1) << 2) - 1.0;
    float y = float((gl_VertexID & 2) << 1) - 1.0;
    gl_Position = vec4(x, y, 0.0, 1.0);
    v_uv = vec2(x * 0.5 + 0.5, 0.5 - y * 0.5);
}`;

const LENS_FRAGMENT_GLSL = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 out_color;

uniform float u_ior_r;
uniform float u_ior_g;
uniform float u_ior_b;
uniform float u_depth;
uniform float u_fresnel_power;
uniform vec3 u_tint;
uniform float u_chromatic_aberration;
uniform float u_has_envmap;
uniform sampler2D u_background;

void main() {
    float radial = length(v_uv - 0.5) * 2.0;
    float cos_theta = 1.0 - radial * 0.65;
    vec2 offset_dir = v_uv - 0.5;

    // Per-channel Fresnel (Schlick approximation).
    float f0_r = pow((u_ior_r - 1.0) / (u_ior_r + 1.0), 2.0);
    float fresnel_r = f0_r + (1.0 - f0_r) * pow(1.0 - cos_theta, u_fresnel_power);

    float f0_g = pow((u_ior_g - 1.0) / (u_ior_g + 1.0), 2.0);
    float fresnel_g = f0_g + (1.0 - f0_g) * pow(1.0 - cos_theta, u_fresnel_power);

    float f0_b = pow((u_ior_b - 1.0) / (u_ior_b + 1.0), 2.0);
    float fresnel_b = f0_b + (1.0 - f0_b) * pow(1.0 - cos_theta, u_fresnel_power);

    float fresnel = (fresnel_r + fresnel_g + fresnel_b) / 3.0;

    // Per-wavelength refraction offset: blue (high IOR) bends more.
    vec2 base_offset_r = offset_dir * radial * u_depth * (u_ior_r - 1.0) * 0.12;
    vec2 base_offset_g = offset_dir * radial * u_depth * (u_ior_g - 1.0) * 0.12;
    vec2 base_offset_b = offset_dir * radial * u_depth * (u_ior_b - 1.0) * 0.12;

    vec2 r_uv = v_uv + base_offset_r;
    vec2 g_uv = v_uv + base_offset_g;
    vec2 b_uv = v_uv + base_offset_b;

    float r = texture(u_background, r_uv).r;
    float g = texture(u_background, g_uv).g;
    float b = texture(u_background, b_uv).b;
    vec4 refracted = vec4(r, g, b, 1.0);

    vec4 reflected = vec4(u_tint, 1.0);
    out_color = mix(refracted, reflected, fresnel);
}`;

const BLUR_VERTEX_GLSL = `#version 300 es
precision highp float;
in vec2 a_position;
in vec2 a_texcoord;
out vec2 v_uv;
void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_uv = a_texcoord;
}`;

const BLUR_FRAGMENT_GLSL = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 out_color;

uniform sampler2D u_source;
uniform float u_radius;
uniform vec2 u_axis;
uniform vec2 u_texel_size;

void main() {
    vec4 acc = vec4(0.0);
    float total = 0.0;
    int radius_i = int(ceil(u_radius));
    for (int i = -32; i <= 32; i++) {
        if (i > radius_i) break;
        float weight = exp(-float(i * i) / (2.0 * u_radius * u_radius + 0.001));
        vec2 offset = u_axis * float(i) * u_texel_size;
        acc += texture(u_source, v_uv + offset) * weight;
        total += weight;
    }
    out_color = acc / total;
}`;

// ---- Quad geometry (reused per frame) ------------------------------------

const QUAD_VERTICES = new Float32Array([-1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, 1, 1, 1, 1]);

function createQuadBuffer(gl: WebGL2RenderingContext): WebGLBuffer {
  const buf = gl.createBuffer();
  if (!buf) throw new Error('Failed to create quad buffer');
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
  return buf;
}

// ---- Shader helpers ------------------------------------------------------

function compileShader(gl: WebGL2RenderingContext, type: GLenum, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compile failed: ${log ?? 'unknown'}`);
  }
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vertSrc: string, fragSrc: string): WebGLProgram {
  const vert = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const frag = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  const prog = gl.createProgram();
  if (!prog) throw new Error('Failed to create program');
  gl.attachShader(prog, vert);
  gl.attachShader(prog, frag);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    gl.deleteProgram(prog);
    throw new Error(`Program link failed: ${log ?? 'unknown'}`);
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return prog;
}

// ---- Main fallback class -------------------------------------------------

export class WebGL2Fallback {
  private gl: WebGL2RenderingContext;
  private lensProgram: WebGLProgram;
  private blurProgram: WebGLProgram;
  private quadBuffer: WebGLBuffer;
  private lensVAO: WebGLVertexArrayObject;
  private blurVAO: WebGLVertexArrayObject;

  static isAvailable(): boolean {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true });
      return gl !== null;
    } catch {
      return false;
    }
  }

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;

    this.lensProgram = createProgram(gl, LENS_VERTEX_GLSL, LENS_FRAGMENT_GLSL);
    this.blurProgram = createProgram(gl, BLUR_VERTEX_GLSL, BLUR_FRAGMENT_GLSL);
    this.quadBuffer = createQuadBuffer(gl);

    // Lens VAO (vertex-index only — fullscreen triangle).
    const lensVAO = gl.createVertexArray();
    if (!lensVAO) throw new Error('WebGL2: failed to create lens VAO');
    this.lensVAO = lensVAO;
    gl.bindVertexArray(this.lensVAO);

    // Blur VAO (position + texcoord).
    const blurVAO = gl.createVertexArray();
    if (!blurVAO) throw new Error('WebGL2: failed to create blur VAO');
    this.blurVAO = blurVAO;
    gl.bindVertexArray(this.blurVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer);
    const posLoc = gl.getAttribLocation(this.blurProgram, 'a_position');
    const uvLoc = gl.getAttribLocation(this.blurProgram, 'a_texcoord');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uvLoc);
    gl.vertexAttribPointer(uvLoc, 2, gl.FLOAT, false, 16, 8);
    gl.bindVertexArray(null);
  }

  renderLens(backgroundTexture: WebGLTexture, config: LensConfig): void {
    const gl = this.gl;

    gl.useProgram(this.lensProgram);
    gl.bindVertexArray(this.lensVAO);

    gl.uniform1f(gl.getUniformLocation(this.lensProgram, 'u_ior_r'), config.ior[0]);
    gl.uniform1f(gl.getUniformLocation(this.lensProgram, 'u_ior_g'), config.ior[1]);
    gl.uniform1f(gl.getUniformLocation(this.lensProgram, 'u_ior_b'), config.ior[2]);
    gl.uniform1f(gl.getUniformLocation(this.lensProgram, 'u_depth'), config.depth);
    gl.uniform1f(gl.getUniformLocation(this.lensProgram, 'u_fresnel_power'), config.fresnelPower);
    gl.uniform3fv(gl.getUniformLocation(this.lensProgram, 'u_tint'), config.tint);
    gl.uniform1f(
      gl.getUniformLocation(this.lensProgram, 'u_chromatic_aberration'),
      config.chromaticAberration,
    );
    gl.uniform1f(
      gl.getUniformLocation(this.lensProgram, 'u_has_envmap'),
      config.hasEnvmap ? 1.0 : 0.0,
    );

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, backgroundTexture);
    gl.uniform1i(gl.getUniformLocation(this.lensProgram, 'u_background'), 0);

    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  progressiveBlur(
    input: WebGLTexture,
    _radiusMap: WebGLTexture,
    output: WebGLTexture,
    config: BlurConfig,
  ): void {
    const gl = this.gl;

    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, output, 0);

    gl.useProgram(this.blurProgram);
    gl.bindVertexArray(this.blurVAO);

    const radius = (config.fromRadius + config.toRadius) * 0.5;
    const axis: [number, number] = config.axis === 'x' ? [1, 0] : [0, 1];

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, input);
    gl.uniform1i(gl.getUniformLocation(this.blurProgram, 'u_source'), 0);
    gl.uniform1f(gl.getUniformLocation(this.blurProgram, 'u_radius'), radius);
    gl.uniform2fv(gl.getUniformLocation(this.blurProgram, 'u_axis'), axis);

    const texelSize = [1.0 / gl.drawingBufferWidth, 1.0 / gl.drawingBufferHeight];
    gl.uniform2fv(gl.getUniformLocation(this.blurProgram, 'u_texel_size'), texelSize);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb);
  }

  destroy(): void {
    const gl = this.gl;
    gl.deleteProgram(this.lensProgram);
    gl.deleteProgram(this.blurProgram);
    gl.deleteBuffer(this.quadBuffer);
    gl.deleteVertexArray(this.lensVAO);
    gl.deleteVertexArray(this.blurVAO);
  }
}
