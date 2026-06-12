// Glass refraction shader — fullscreen quad with Fresnel + chromatic dispersion.
// Per-wavelength IOR (R/G/B) produces true physical dispersion: blue bends more
// than green, green more than red — no artificial multiplier needed.
// Fresnel power governs edge-reflect vs center-transmit balance.

struct LensUniforms {
    ior_r: f32,    // 650nm (red)
    ior_g: f32,    // 550nm (green)
    ior_b: f32,    // 450nm (blue)
    depth: f32,
    fresnel_power: f32,
    _pad: f32,     // alignment — vec3<f32> needs 16-byte stride
    tint: vec3<f32>,
    chromatic_aberration: f32,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@group(0) @binding(0) var<uniform> lens: LensUniforms;
@group(1) @binding(0) var background: texture_2d<f32>;
@group(1) @binding(1) var bg_sampler: sampler;

// Fullscreen triangle — 3 vertices covering clip space without a vertex buffer.
// Standard WebGPU pattern: avoids the seam of a two-triangle quad.
@vertex
fn vs_main(@builtin(vertex_index) vid: u32) -> VertexOutput {
    let positions = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 3.0, -1.0),
        vec2<f32>(-1.0,  3.0),
    );
    let uvs = array<vec2<f32>, 3>(
        vec2<f32>(0.0, 1.0),
        vec2<f32>(2.0, 1.0),
        vec2<f32>(0.0, -1.0),
    );
    var output: VertexOutput;
    output.position = vec4<f32>(positions[vid], 0.0, 1.0);
    output.uv = uvs[vid];
    return output;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let uv = in.uv;

    // Radial distance from centre as proxy for view angle off normal.
    // Centre = straight-on (cos_theta ≈ 1), corners = grazing angle.
    let radial = length(uv - vec2<f32>(0.5, 0.5)) * 2.0;
    let cos_theta = 1.0 - radial * 0.65;
    let offset_dir = uv - vec2<f32>(0.5, 0.5);

    // Per-channel Fresnel (Schlick approximation).
    let f0_r = pow((lens.ior_r - 1.0) / (lens.ior_r + 1.0), 2.0);
    let fresnel_r = f0_r + (1.0 - f0_r) * pow(1.0 - cos_theta, lens.fresnel_power);

    let f0_g = pow((lens.ior_g - 1.0) / (lens.ior_g + 1.0), 2.0);
    let fresnel_g = f0_g + (1.0 - f0_g) * pow(1.0 - cos_theta, lens.fresnel_power);

    let f0_b = pow((lens.ior_b - 1.0) / (lens.ior_b + 1.0), 2.0);
    let fresnel_b = f0_b + (1.0 - f0_b) * pow(1.0 - cos_theta, lens.fresnel_power);

    // Average Fresnel for reflection amount (single value for mix).
    let fresnel = (fresnel_r + fresnel_g + fresnel_b) / 3.0;

    // Per-wavelength refraction offset: blue (high IOR) bends more.
    let base_offset_r = offset_dir * radial * lens.depth * (lens.ior_r - 1.0) * 0.12;
    let base_offset_g = offset_dir * radial * lens.depth * (lens.ior_g - 1.0) * 0.12;
    let base_offset_b = offset_dir * radial * lens.depth * (lens.ior_b - 1.0) * 0.12;

    // Sample background at per-channel UV offsets.
    let r_uv = uv + base_offset_r;
    let g_uv = uv + base_offset_g;
    let b_uv = uv + base_offset_b;

    let r = textureSample(background, bg_sampler, r_uv).r;
    let g = textureSample(background, bg_sampler, g_uv).g;
    let b = textureSample(background, bg_sampler, b_uv).b;
    let refracted = vec4<f32>(r, g, b, 1.0);

    // Edge reflection: tint dominates at grazing angles.
    let reflected = vec4<f32>(lens.tint, 1.0);

    // Mix: centre transmits (refracted), edge reflects (tint).
    return mix(refracted, reflected, fresnel);
}
