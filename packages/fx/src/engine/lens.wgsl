// Glass refraction shader — fullscreen quad with Fresnel + chromatic aberration.
// Uniform ior controls refractive index; higher = more bending at edges.
// Fresnel power governs edge-reflect vs center-transmit balance.
// Chromatic aberration mimics real lens dispersion: R/G/B sample at different offsets.

struct LensUniforms {
    ior: f32,
    depth: f32,
    fresnel_power: f32,
    _pad0: f32, // WGSL struct alignment — vec3<f32> needs 16-byte stride
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

    // Fresnel reflectance at normal incidence (Schlick approximation).
    let f0 = pow((lens.ior - 1.0) / (lens.ior + 1.0), 2.0);
    let fresnel = f0 + (1.0 - f0) * pow(1.0 - cos_theta, lens.fresnel_power);

    // Refraction offset: stronger toward edges, scaled by depth and ior.
    let refraction_strength = radial * lens.depth * (lens.ior - 1.0) * 0.12;
    let offset_dir = uv - vec2<f32>(0.5, 0.5);
    let base_offset = offset_dir * refraction_strength;

    // Chromatic aberration: per-channel offset differences.
    // Shorter wavelengths (blue) refract more → larger offset.
    // R = 0.97x, G = 1.0x, B = 1.03x of base offset (relative dispersion).
    let ca = lens.chromatic_aberration;
    let r_uv = uv + base_offset * (1.0 - ca * 0.03);
    let g_uv = uv + base_offset;
    let b_uv = uv + base_offset * (1.0 + ca * 0.03);

    let r = textureSample(background, bg_sampler, r_uv).r;
    let g = textureSample(background, bg_sampler, g_uv).g;
    let b = textureSample(background, bg_sampler, b_uv).b;
    let refracted = vec4<f32>(r, g, b, 1.0);

    // Edge reflection: tint dominates at grazing angles.
    let reflected = vec4<f32>(lens.tint, 1.0);

    // Mix: centre transmits (refracted), edge reflects (tint).
    return mix(refracted, reflected, fresnel);
}
