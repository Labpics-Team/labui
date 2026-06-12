/**
 * WebGPU pipeline manager — compiles pipelines at init, reuses resources at render.
 *
 * Hot path: drawArrays / dispatchWorkgroups only. No allocations, no shader compiles.
 * Uniform buffers are written once per config change, not per frame.
 * Bind-group layout descriptors use explicit visibility flags for GPU optimisation.
 */

import lensWgsl from './lens.wgsl';
import mipmapWgsl from './mipmap.wgsl';
import penumbraWgsl from './penumbra.wgsl';

// ---- Config types --------------------------------------------------------

export interface LensConfig {
  /** Refractive index per channel [r, g, b]. BK7 glass ≈ [1.514, 1.519, 1.526]. */
  ior: [number, number, number];
  /** Apparent thickness in rem units. Higher = stronger refraction offset. */
  depth: number;
  /** Fresnel power exponent. Default 5. Higher = sharper edge reflection. */
  fresnelPower: number;
  /** Surface tint RGB, normalised 0–1. Read from --lab-glass-tint. */
  tint: [number, number, number];
  /** Chromatic aberration strength 0–1. 0 = off, 1 = full dispersion. */
  chromaticAberration: number;
}

export interface BlurConfig {
  /** Minimum blur radius in pixels. */
  fromRadius: number;
  /** Maximum blur radius in pixels. */
  toRadius: number;
  /** Radius interpolation curve. */
  curve: 'linear' | 'ease-out' | 'ease-in-out';
  /** Blur axis — separable passes reduce work from O(n²) to O(2n). */
  axis: 'x' | 'y';
}

export interface ShadowConfig {
  /** Distance between occluder and receiver in rem units. */
  depth: number;
  /** Light angle in degrees from vertical. 0 = straight down. */
  lightAngle: number;
  /** How fast blur radius grows with distance from silhouette. */
  penumbraScale: number;
}

// ---- Internal constants --------------------------------------------------

const LENS_UNIFORM_SIZE = 48; // 12 × f32 — 3×IOR + depth + fresnel + _pad + vec3 tint + ca

// ---- Main engine class ---------------------------------------------------

export class FxEngine {
  /** Static reference to the active GPU device — for providers that need GPU access without an engine reference. */
  static device: GPUDevice | null = null;

  private device: GPUDevice;

  /** Public accessor for the GPU device — needed by the texture bridge and API surfaces. */
  get gpuDevice(): GPUDevice {
    return this.device;
  }
  private lensPipeline: GPURenderPipeline;
  private mipmapDownsample: GPUComputePipeline;
  private mipmapProgressive: GPUComputePipeline;
  private penumbraPipeline: GPUComputePipeline;

  // Reusable bind-group layouts — created once, reused per dispatch.
  private lensUniformLayout: GPUBindGroupLayout;
  private textureSamplerLayout: GPUBindGroupLayout;
  private downsampleLayout: GPUBindGroupLayout;

  // Reusable resources — allocated once, written per config change.
  private lensUniformBuffer: GPUBuffer;
  private linearSampler: GPUSampler;

  constructor(device: GPUDevice) {
    this.device = device;

    // ---- Bind-group layouts (allocated once) ---------------------------
    this.lensUniformLayout = device.createBindGroupLayout({
      label: 'lens-uniform',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          buffer: { type: 'uniform' as const, hasDynamicOffset: false },
        },
      ],
    });

    this.textureSamplerLayout = device.createBindGroupLayout({
      label: 'texture-sampler',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' as const, viewDimension: '2d' as const },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' as const },
        },
      ],
    });

    this.downsampleLayout = device.createBindGroupLayout({
      label: 'downsample',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: 'float' as const, viewDimension: '2d' as const },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: 'write-only' as const,
            format: 'rgba16float' as const,
            viewDimension: '2d' as const,
          },
        },
      ],
    });

    const progressiveLayout = device.createBindGroupLayout({
      label: 'progressive-blur',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: 'float' as const, viewDimension: '2d' as const },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: 'float' as const, viewDimension: '2d' as const },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: 'write-only' as const,
            format: 'rgba16float' as const,
            viewDimension: '2d' as const,
          },
        },
        {
          binding: 3,
          visibility: GPUShaderStage.COMPUTE,
          sampler: { type: 'filtering' as const },
        },
        {
          binding: 4,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' as const, hasDynamicOffset: false },
        },
      ],
    });

    const penumbraLayout = device.createBindGroupLayout({
      label: 'penumbra',
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.COMPUTE,
          texture: { sampleType: 'float' as const, viewDimension: '2d' as const },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.COMPUTE,
          storageTexture: {
            access: 'write-only' as const,
            format: 'r16float' as const,
            viewDimension: '2d' as const,
          },
        },
        {
          binding: 2,
          visibility: GPUShaderStage.COMPUTE,
          buffer: { type: 'uniform' as const, hasDynamicOffset: false },
        },
      ],
    });

    // ---- Samplers -----------------------------------------------------
    this.linearSampler = device.createSampler({
      label: 'linear-sampler',
      magFilter: 'linear',
      minFilter: 'linear',
      mipmapFilter: 'linear',
      addressModeU: 'clamp-to-edge',
      addressModeV: 'clamp-to-edge',
    });

    // ---- Shader modules -----------------------------------------------
    const lensModule = device.createShaderModule({
      label: 'lens-shader',
      code: lensWgsl,
    });

    const mipmapModule = device.createShaderModule({
      label: 'mipmap-shader',
      code: mipmapWgsl,
    });

    const penumbraModule = device.createShaderModule({
      label: 'penumbra-shader',
      code: penumbraWgsl,
    });

    // ---- Pipelines — compiled at init, never at render -----------------

    this.lensPipeline = device.createRenderPipeline({
      label: 'lens-pipeline',
      layout: device.createPipelineLayout({
        label: 'lens-layout',
        bindGroupLayouts: [this.lensUniformLayout, this.textureSamplerLayout],
      }),
      vertex: {
        module: lensModule,
        entryPoint: 'vs_main',
      },
      fragment: {
        module: lensModule,
        entryPoint: 'fs_main',
        targets: [{ format: 'rgba16float' as const }],
      },
      primitive: {
        topology: 'triangle-list',
      },
    });

    this.mipmapDownsample = device.createComputePipeline({
      label: 'mipmap-downsample',
      layout: device.createPipelineLayout({
        label: 'downsample-layout',
        bindGroupLayouts: [this.downsampleLayout],
      }),
      compute: {
        module: mipmapModule,
        entryPoint: 'downsample',
      },
    });

    this.mipmapProgressive = device.createComputePipeline({
      label: 'mipmap-progressive',
      layout: device.createPipelineLayout({
        label: 'progressive-layout',
        bindGroupLayouts: [progressiveLayout],
      }),
      compute: {
        module: mipmapModule,
        entryPoint: 'progressive_blur',
      },
    });

    this.penumbraPipeline = device.createComputePipeline({
      label: 'penumbra-pipeline',
      layout: device.createPipelineLayout({
        label: 'penumbra-layout',
        bindGroupLayouts: [penumbraLayout],
      }),
      compute: {
        module: penumbraModule,
        entryPoint: 'penumbra',
      },
    });

    // ---- Uniform buffers — allocated once, mapped-write per config -----
    this.lensUniformBuffer = device.createBuffer({
      label: 'lens-uniforms',
      size: LENS_UNIFORM_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  // ---- Public API --------------------------------------------------------

  /** Render one glass surface: background → refracted + Fresnel-tinted output. */
  renderLens(backgroundTexture: GPUTexture, outputView: GPUTextureView, config: LensConfig): void {
    const device = this.device;

    // Write uniform — once per config change.
    const uniformData = new Float32Array(LENS_UNIFORM_SIZE / 4);
    uniformData[0] = config.ior[0]; // ior_r
    uniformData[1] = config.ior[1]; // ior_g
    uniformData[2] = config.ior[2]; // ior_b
    uniformData[3] = config.depth;
    uniformData[4] = config.fresnelPower;
    uniformData[5] = 0; // _pad (WGSL alignment before vec3<f32>)
    uniformData[6] = 0; // implicit pad
    uniformData[7] = 0; // implicit pad
    uniformData[8] = config.tint[0];
    uniformData[9] = config.tint[1];
    uniformData[10] = config.tint[2];
    uniformData[11] = config.chromaticAberration;
    device.queue.writeBuffer(this.lensUniformBuffer, 0, uniformData);

    const bindGroup = device.createBindGroup({
      label: 'lens-bindgroup',
      layout: this.lensUniformLayout,
      entries: [{ binding: 0, resource: { buffer: this.lensUniformBuffer } }],
    });

    const textureBindGroup = device.createBindGroup({
      label: 'lens-texture-bg',
      layout: this.textureSamplerLayout,
      entries: [
        { binding: 0, resource: backgroundTexture.createView() },
        { binding: 1, resource: this.linearSampler },
      ],
    });

    const commandEncoder = device.createCommandEncoder({ label: 'lens-pass' });
    const pass = commandEncoder.beginRenderPass({
      label: 'lens-render',
      colorAttachments: [
        {
          view: outputView,
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear' as const,
          storeOp: 'store' as const,
        },
      ],
    });

    pass.setPipeline(this.lensPipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setBindGroup(1, textureBindGroup);
    pass.draw(3, 1, 0, 0);
    pass.end();

    device.queue.submit([commandEncoder.finish()]);
  }

  /**
   * Build mip chain + progressive blur.
   *
   * Step 1: downsample input → mip levels (reuses pre-compiled downsample pipeline).
   * Step 2: progressive_blur samples mip chain per-pixel by radius from radiusMap.
   */
  progressiveBlur(
    inputTexture: GPUTexture,
    radiusMap: GPUTexture,
    outputTexture: GPUTexture,
    config: BlurConfig,
  ): void {
    const device = this.device;

    // Build mip chain via iterative downsample.
    const mipCount = Math.floor(Math.log2(Math.max(inputTexture.width, inputTexture.height))) + 1;
    const mipTextures: GPUTexture[] = [inputTexture];

    for (let level = 1; level < mipCount; level++) {
      const srcW = Math.max(1, inputTexture.width >> (level - 1));
      const srcH = Math.max(1, inputTexture.height >> (level - 1));
      const dstW = Math.max(1, srcW >> 1);
      const dstH = Math.max(1, srcH >> 1);

      const mipTex = device.createTexture({
        label: `mip-level-${level}`,
        size: [dstW, dstH, 1],
        format: 'rgba16float',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
      });

      const prev = mipTextures[level - 1];
      if (!prev) throw new Error(`Missing mip level ${level - 1}`);
      const bg = device.createBindGroup({
        label: `downsample-bg-${level}`,
        layout: this.downsampleLayout,
        entries: [
          { binding: 0, resource: prev.createView() },
          { binding: 1, resource: mipTex.createView() },
        ],
      });

      const encoder = device.createCommandEncoder({ label: `downsample-${level}` });
      const pass = encoder.beginComputePass({ label: `downsample-pass-${level}` });
      pass.setPipeline(this.mipmapDownsample);
      pass.setBindGroup(0, bg);
      pass.dispatchWorkgroups(Math.ceil(dstW / 8), Math.ceil(dstH / 8), 1);
      pass.end();
      device.queue.submit([encoder.finish()]);

      mipTextures.push(mipTex);
    }

    // Merge mip chain into single multi-level texture.
    const mipChainTex = device.createTexture({
      label: 'mip-chain',
      size: [inputTexture.width, inputTexture.height, 1],
      format: 'rgba16float',
      mipLevelCount: mipCount,
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    for (let level = 0; level < mipCount; level++) {
      const src = mipTextures[level];
      if (!src) throw new Error(`Missing mip level ${level}`);
      const encoder = device.createCommandEncoder({ label: `copy-mip-${level}` });
      encoder.copyTextureToTexture({ texture: src }, { texture: mipChainTex, mipLevel: level }, [
        src.width,
        src.height,
        1,
      ]);
      device.queue.submit([encoder.finish()]);
    }

    // Uniform for progressive blur (mip_count, max_radius).
    const blurUniformSize = 16;
    const blurUniform = device.createBuffer({
      label: 'blur-uniform',
      size: blurUniformSize,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    const blurData = new Float32Array(blurUniformSize / 4);
    blurData[0] = mipCount;
    blurData[1] = Math.max(config.fromRadius, config.toRadius);
    device.queue.writeBuffer(blurUniform, 0, blurData);

    const progressiveLayout = this.mipmapProgressive.getBindGroupLayout(0);
    const progressiveBg = device.createBindGroup({
      label: 'progressive-bg',
      layout: progressiveLayout,
      entries: [
        { binding: 0, resource: mipChainTex.createView() },
        { binding: 1, resource: radiusMap.createView() },
        { binding: 2, resource: outputTexture.createView() },
        { binding: 3, resource: this.linearSampler },
        { binding: 4, resource: { buffer: blurUniform } },
      ],
    });

    const outW = outputTexture.width;
    const outH = outputTexture.height;
    const blurEncoder = device.createCommandEncoder({ label: 'progressive-blur' });
    const blurPass = blurEncoder.beginComputePass({ label: 'progressive-blur-pass' });
    blurPass.setPipeline(this.mipmapProgressive);
    blurPass.setBindGroup(0, progressiveBg);
    blurPass.dispatchWorkgroups(Math.ceil(outW / 8), Math.ceil(outH / 8), 1);
    blurPass.end();
    device.queue.submit([blurEncoder.finish()]);

    // Cleanup intermediate mip textures.
    for (let level = 1; level < mipCount; level++) {
      mipTextures[level]?.destroy();
    }
  }

  /** Render progressive shadow from element mask. */
  renderPenumbra(maskTexture: GPUTexture, outputTexture: GPUTexture, config: ShadowConfig): void {
    const device = this.device;

    const lightRad = (config.lightAngle * Math.PI) / 180;
    const lightDirX = Math.sin(lightRad);
    const lightDirY = Math.cos(lightRad);

    // Shadow uniforms: 32 bytes (aligned).
    const uniformData = new Float32Array(8);
    uniformData[0] = config.depth;
    uniformData[1] = lightRad;
    uniformData[2] = config.penumbraScale;
    uniformData[3] = 0; // pad
    uniformData[4] = lightDirX;
    uniformData[5] = lightDirY;
    uniformData[6] = 0; // pad
    uniformData[7] = 0; // pad

    const shadowUniform = device.createBuffer({
      label: 'shadow-uniform',
      size: 32,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(shadowUniform, 0, uniformData);

    const penumbraLayout = this.penumbraPipeline.getBindGroupLayout(0);
    const bg = device.createBindGroup({
      label: 'penumbra-bg',
      layout: penumbraLayout,
      entries: [
        { binding: 0, resource: maskTexture.createView() },
        { binding: 1, resource: outputTexture.createView() },
        { binding: 2, resource: { buffer: shadowUniform } },
      ],
    });

    const encoder = device.createCommandEncoder({ label: 'penumbra-pass' });
    const pass = encoder.beginComputePass({ label: 'penumbra-compute' });
    pass.setPipeline(this.penumbraPipeline);
    pass.setBindGroup(0, bg);
    pass.dispatchWorkgroups(Math.ceil(maskTexture.width / 8), Math.ceil(maskTexture.height / 8), 1);
    pass.end();
    device.queue.submit([encoder.finish()]);
  }

  /** Create engine. Optional canvas for adapter selection on multi-GPU systems. */
  static async create(_canvas?: HTMLCanvasElement): Promise<FxEngine> {
    if (!('gpu' in navigator)) {
      throw new Error('WebGPU not available — use WebGL2Fallback');
    }

    const adapter = await navigator.gpu.requestAdapter({
      powerPreference: 'high-performance',
    });
    if (!adapter) {
      throw new Error('No WebGPU adapter found');
    }

    const device = await adapter.requestDevice({
      label: 'fx-engine-device',
      requiredFeatures: [],
      requiredLimits: {},
    });

    FxEngine.device = device;
    return new FxEngine(device);
  }

  destroy(): void {
    this.lensUniformBuffer.destroy();
    this.device.destroy();
    FxEngine.device = null;
  }
}
