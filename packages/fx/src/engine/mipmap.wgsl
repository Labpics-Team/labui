// Mip-map chain builder + progressive blur.
//
// downsample: 4×4 box-average reduce — each workgroup thread averages a block
//   and writes to the next mip level at half resolution.
//
// progressive_blur: per-pixel variable-radius blur. Reads a radius-map texture
//   (single-channel f32, 0–1 normalised) and samples the appropriate mip level.
//   Lerps between adjacent mips for smooth radius transitions, avoiding visible
//   banding at mip boundaries.
//   Input: full mip-chain texture + radius map. Output: single-level blurred texture.

struct BlurUniforms {
    mip_count: f32,
    max_radius: f32,
    _pad0: f32,
    _pad1: f32,
}

// ---- downsample ----------------------------------------------------------

@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var dst: texture_storage_2d<rgba16float, write>;

@compute @workgroup_size(8, 8, 1)
fn downsample(@builtin(global_invocation_id) gid: vec3<u32>) {
    let x = gid.x * 2u;
    let y = gid.y * 2u;

    // 4-sample box average (no weights → cheap, hardware-friendly).
    let p00 = textureLoad(src, vec2<u32>(x,     y),     0);
    let p10 = textureLoad(src, vec2<u32>(x + 1u, y),     0);
    let p01 = textureLoad(src, vec2<u32>(x,     y + 1u), 0);
    let p11 = textureLoad(src, vec2<u32>(x + 1u, y + 1u), 0);

    let avg = (p00 + p10 + p01 + p11) * 0.25;
    textureStore(dst, gid.xy, avg);
}

// ---- progressive_blur ----------------------------------------------------

@group(0) @binding(0) var mip_source: texture_2d<f32>;
@group(0) @binding(1) var radius_map: texture_2d<f32>;
@group(0) @binding(2) var blur_out: texture_storage_2d<rgba16float, write>;
@group(0) @binding(3) var mip_sampler: sampler;
@group(0) @binding(4) var<uniform> blur: BlurUniforms;

@compute @workgroup_size(8, 8, 1)
fn progressive_blur(@builtin(global_invocation_id) gid: vec3<u32>) {
    let dims = vec2<f32>(textureDimensions(mip_source, 0));
    let uv = (vec2<f32>(gid.xy) + 0.5) / dims;

    let radius_norm = textureLoad(radius_map, gid.xy, 0).r;
    let radius = radius_norm * blur.max_radius;

    // Map radius to mip level: level 0 = sharp (max detail), higher = blurrier.
    // log2 maps radius doubling to one mip step.
    let mip_f = clamp(log2(max(radius, 1.0)), 0.0, blur.mip_count - 1.0);
    let mip_lo = u32(floor(mip_f));
    let mip_hi = min(mip_lo + 1u, u32(blur.mip_count) - 1u);
    let mip_frac = mip_f - f32(mip_lo);

    // Sample adjacent mip levels and lerp for smooth radius transitions.
    let sample_lo = textureSampleLevel(mip_source, mip_sampler, uv, f32(mip_lo));
    let sample_hi = textureSampleLevel(mip_source, mip_sampler, uv, f32(mip_hi));

    textureStore(blur_out, gid.xy, mix(sample_lo, sample_hi, mip_frac));
}
