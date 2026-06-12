//! IBL diffuse irradiance map — convolution of a cubemap with a cosine lobe.
//!
//! Computes a low-resolution (32x32 per face) irradiance atlas from a
//! higher-resolution source cubemap. The atlas is a 3x2 WebGPU cubemap
//! array (same layout as [crate::cubemap::cubemap_to_atlas]).
//!
//! # Algorithm
//!
//! For each output pixel (face, u, v):
//! 1. Convert to a world-space direction D via
//!    [crate::cubemap::uv_to_direction].
//! 2. Generate N = 1024 cosine-weighted directions on the hemisphere
//!    around D (Malley's method).
//! 3. Sample the source cubemap for each direction, accumulate
//!    `sample_RGB * max(0, dot(S, D)) / pi / N`.
//! 4. The result is the irradiance atlas (3x2, 32x32 per face, 3 channels).

use std::sync::atomic::{AtomicU64, Ordering};

// ---------------------------------------------------------------------------
// Pseudo-random number generator (lock-free LCG, no external crate)
// ---------------------------------------------------------------------------

/// Deterministic, thread-safe LCG state.
///
/// The seed is initialised to a fixed value so that repeated calls with the
/// same cubemap yield identical irradiance maps — useful for cache keys and
/// regression tests.
static RNG_STATE: AtomicU64 = AtomicU64::new(0x90E0_9B2A_3157_CD01);

/// Returns a pseudo-random float in [0, 1) using a 64-bit LCG.
///
/// Multiplier: 6364136223846793005 (from MMIX by D.E. Knuth).
/// Lock-free CAS loop — safe to call from any thread.
fn lcg() -> f64 {
    let mut old = RNG_STATE.load(Ordering::Relaxed);
    loop {
        let new = old.wrapping_mul(6364136223846793005).wrapping_add(1);
        match RNG_STATE.compare_exchange_weak(old, new, Ordering::Relaxed, Ordering::Relaxed) {
            Ok(_) => return new as f64 / u64::MAX as f64,
            Err(current) => old = current,
        }
    }
}

// ---------------------------------------------------------------------------
// Vector helpers — [f64; 3] for consistency with cubemap.rs
// ---------------------------------------------------------------------------

#[inline]
fn dot3(a: [f64; 3], b: [f64; 3]) -> f64 {
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

#[inline]
fn cross3(a: [f64; 3], b: [f64; 3]) -> [f64; 3] {
    [
        a[1] * b[2] - a[2] * b[1],
        a[2] * b[0] - a[0] * b[2],
        a[0] * b[1] - a[1] * b[0],
    ]
}

fn len3(v: [f64; 3]) -> f64 {
    (v[0] * v[0] + v[1] * v[1] + v[2] * v[2]).sqrt()
}

#[inline]
fn normalize3(v: [f64; 3]) -> [f64; 3] {
    let len = len3(v);
    if len > 0.0 {
        [v[0] / len, v[1] / len, v[2] / len]
    } else {
        v
    }
}

// ---------------------------------------------------------------------------
// Bilinear interpolation
// ---------------------------------------------------------------------------

#[inline]
fn lerp(a: f64, b: f64, t: f64) -> f64 {
    a + (b - a) * t
}

#[inline]
fn bilerp(c00: f64, c10: f64, c01: f64, c11: f64, fx: f64, fy: f64) -> f64 {
    lerp(lerp(c00, c10, fx), lerp(c01, c11, fx), fy)
}

// ---------------------------------------------------------------------------
// Tangent frame — orthonormal basis with `normal` as the Z axis
// ---------------------------------------------------------------------------

/// Returns `(tangent, bitangent)` such that `{tangent, bitangent, normal}` is
/// a right-handed orthonormal basis.
fn build_tangent_frame(n: [f64; 3]) -> ([f64; 3], [f64; 3]) {
    // Pick an up vector not parallel to n
    let up: [f64; 3] = if n[0].abs() < 0.9 {
        [1.0, 0.0, 0.0]
    } else {
        [0.0, 1.0, 0.0]
    };

    // Tangent = normalize(up x n)
    let t = normalize3(cross3(up, n));

    // Bitangent = n x tangent (already unit-length since n _|_ t)
    let b = cross3(n, t);

    (t, b)
}

// ---------------------------------------------------------------------------
// Atlas pixel addressing
// ---------------------------------------------------------------------------

/// Face (0..=5) to (col, row) in the 3x2 atlas.
const FACE_POSITIONS: [(usize, usize); 6] = [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)];

/// Reads a single RGB pixel from the cubemap atlas at a given face and
/// discrete pixel coordinates (nearest-neighbour, bounds-checked).
#[inline]
fn read_pixel(atlas: &[u8], face_size: u32, face: usize, px: u32, py: u32) -> [f64; 3] {
    let (col, row) = FACE_POSITIONS[face];
    let atlas_w = 3 * face_size;
    let channels = 3u32;

    let ax = (col as u32 * face_size + px).min(atlas_w - 1);
    let ay = (row as u32 * face_size + py).min(2 * face_size - 1);
    let idx = ((ay * atlas_w + ax) * channels) as usize;

    [
        atlas[idx] as f64 / 255.0,
        atlas[idx + 1] as f64 / 255.0,
        atlas[idx + 2] as f64 / 255.0,
    ]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Bilinear sample from a cubemap atlas.
///
/// `cubemap` — atlas data (3x2 layout, `face_size` per face, 3 RGB channels).
/// `dir` — the sampling direction; does not need to be normalised.
///
/// Returns linear RGB in [0, 1].
pub fn sample_cubemap(cubemap: &[u8], face_size: u32, dir: [f64; 3]) -> [f64; 3] {
    let (face, u, v) = crate::cubemap::direction_to_uv(dir);

    let fs = face_size as f64;

    // Continuous pixel coordinates; u,v in [0,1] map to [0, face_size).
    let x = u * fs;
    let y = v * fs;

    let x0 = (x.floor() as u32).min(face_size.saturating_sub(1));
    let x1 = (x0 + 1).min(face_size.saturating_sub(1));
    let y0 = (y.floor() as u32).min(face_size.saturating_sub(1));
    let y1 = (y0 + 1).min(face_size.saturating_sub(1));

    let fx = x - x0 as f64;
    let fy = y - y0 as f64;

    let c00 = read_pixel(cubemap, face_size, face, x0, y0);
    let c10 = read_pixel(cubemap, face_size, face, x1, y0);
    let c01 = read_pixel(cubemap, face_size, face, x0, y1);
    let c11 = read_pixel(cubemap, face_size, face, x1, y1);

    [
        bilerp(c00[0], c10[0], c01[0], c11[0], fx, fy),
        bilerp(c00[1], c10[1], c01[1], c11[1], fx, fy),
        bilerp(c00[2], c10[2], c01[2], c11[2], fx, fy),
    ]
}

/// Generate `n_samples` cosine-weighted directions on the hemisphere around
/// `normal` using Malley's method.
///
/// - u1, u2 uniform from LCG
/// - phi = 2 * pi * u2
/// - r = sqrt(u1)
/// - local dir = (r * cos(phi), r * sin(phi), sqrt(1 - u1))
///
/// The result is expressed in world space via a tangent frame.
pub fn sample_hemisphere_cosine(normal: [f64; 3], n_samples: u32) -> Vec<[f64; 3]> {
    let (tangent, bitangent) = build_tangent_frame(normal);

    let mut samples = Vec::with_capacity(n_samples as usize);
    for _ in 0..n_samples {
        let u1 = lcg();
        let u2 = lcg();

        let phi = 2.0 * std::f64::consts::PI * u2;
        let r = u1.sqrt();
        let z = (1.0 - u1).sqrt();

        let local_x = r * phi.cos();
        let local_y = r * phi.sin();
        let local_z = z;

        // Transform local (x,y,z) to world space:
        // world = local_x * tangent + local_y * bitangent + local_z * normal
        let world: [f64; 3] = [
            local_x * tangent[0] + local_y * bitangent[0] + local_z * normal[0],
            local_x * tangent[1] + local_y * bitangent[1] + local_z * normal[1],
            local_x * tangent[2] + local_y * bitangent[2] + local_z * normal[2],
        ];

        samples.push(world);
    }

    samples
}

/// Compute the diffuse irradiance map from a source cubemap atlas.
///
/// # Arguments
///
/// * `cubemap` — source atlas (3x2, `face_size` per face, 3 RGB).
/// * `face_size` — pixel width/height of one source face.
///
/// # Returns
///
/// Irradiance atlas — 3x2 layout, 32x32 per face, 3 RGB channels, 8-bit
/// gamma-encoded (values clamped to [0, 255]).
///
/// # Panics
///
/// Panics if `cubemap.len()` does not match the expected atlas size
/// (`3 * 2 * face_size * face_size * 3`).
pub fn compute_irradiance_map(cubemap: &[u8], face_size: u32) -> Vec<u8> {
    let output_face_size: u32 = 32;
    let n_samples: u32 = 1024;
    let channels: u32 = 3;

    let expected_len = (3 * 2 * face_size * face_size * channels) as usize;
    assert_eq!(
        cubemap.len(),
        expected_len,
        "cubemap atlas: expected {} bytes for face_size={} x 3 channels, got {}",
        expected_len,
        face_size,
        cubemap.len(),
    );

    let atlas_w = 3 * output_face_size;
    let atlas_h = 2 * output_face_size;
    let mut irradiance = vec![0u8; (atlas_w * atlas_h * channels) as usize];

    let inv_pi = std::f64::consts::FRAC_1_PI;
    let inv_n = 1.0 / n_samples as f64;

    for (face, &(col, row)) in FACE_POSITIONS.iter().enumerate() {
        let face_x0 = (col as u32) * output_face_size;
        let face_y0 = (row as u32) * output_face_size;

        for v_out in 0..output_face_size {
            for u_out in 0..output_face_size {
                // Pixel centre UV
                let u = (u_out as f64 + 0.5) / output_face_size as f64;
                let v = (v_out as f64 + 0.5) / output_face_size as f64;

                let dir = crate::cubemap::uv_to_direction(face, u, v);

                // Cosine-weighted hemisphere samples
                let samples = sample_hemisphere_cosine(dir, n_samples);

                let mut accum = [0.0f64; 3];
                for sample_dir in &samples {
                    let rgb = sample_cubemap(cubemap, face_size, *sample_dir);
                    let cos_theta = dot3(*sample_dir, dir).max(0.0);
                    let weight = cos_theta * inv_pi * inv_n;

                    accum[0] += rgb[0] * weight;
                    accum[1] += rgb[1] * weight;
                    accum[2] += rgb[2] * weight;
                }

                let ax = face_x0 + u_out;
                let ay = face_y0 + v_out;
                let idx = ((ay * atlas_w + ax) * channels) as usize;

                // Clamp and encode to 8-bit
                irradiance[idx] = (accum[0].clamp(0.0, 1.0) * 255.0) as u8;
                irradiance[idx + 1] = (accum[1].clamp(0.0, 1.0) * 255.0) as u8;
                irradiance[idx + 2] = (accum[2].clamp(0.0, 1.0) * 255.0) as u8;
            }
        }
    }

    irradiance
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a cubemap atlas where each face has a uniform colour.
    fn uniform_atlas(face_size: u32, colours: &[[u8; 3]; 6]) -> Vec<u8> {
        let channels = 3;
        let pixels_per_face = (face_size * face_size) as usize;
        let faces: [Vec<u8>; 6] = core::array::from_fn(|i| {
            let mut data = vec![0u8; pixels_per_face * channels];
            for p in 0..pixels_per_face {
                let off = p * channels;
                data[off] = colours[i][0];
                data[off + 1] = colours[i][1];
                data[off + 2] = colours[i][2];
            }
            data
        });
        let slices: [&[u8]; 6] = core::array::from_fn(|i| faces[i].as_slice());
        crate::cubemap::cubemap_to_atlas(&slices, face_size, channels as u32)
    }

    /// Read a single output pixel from the irradiance atlas.
    fn irradiance_pixel(atlas: &[u8], face: usize, u: u32, v: u32) -> [u8; 3] {
        let (col, row) = FACE_POSITIONS[face];
        let atlas_w = 3 * 32;
        let ax = (col as u32) * 32 + u;
        let ay = (row as u32) * 32 + v;
        let idx = ((ay * atlas_w + ax) * 3) as usize;
        [atlas[idx], atlas[idx + 1], atlas[idx + 2]]
    }

    // -----------------------------------------------------------------------
    // LCG
    // -----------------------------------------------------------------------

    #[test]
    fn lcg_has_long_period() {
        // Two consecutive calls should yield different values (period > 1).
        // We cannot reset the global seed in a multi-threaded test runner,
        // so we only verify that the LCG advances.
        let a = lcg();
        let b = lcg();
        assert!(
            (a - b).abs() > 1e-15,
            "lcg period appears to be 1: a={a}, b={b}"
        );
        assert!((0.0..1.0).contains(&a));
        assert!((0.0..1.0).contains(&b));
    }

    #[test]
    fn lcg_range_is_01() {
        for _ in 0..1000 {
            let v = lcg();
            assert!(v >= 0.0, "lcg gave {v}");
            assert!(v < 1.0, "lcg gave {v}");
        }
    }

    // -----------------------------------------------------------------------
    // sample_cubemap
    // -----------------------------------------------------------------------

    #[test]
    fn sample_cubemap_face0_centre() {
        let colours: [[u8; 3]; 6] = [
            [255, 0, 0], // +X red
            [0, 255, 0], // -X green
            [0, 0, 255], // +Y blue
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
        ];
        let atlas = uniform_atlas(16, &colours);

        let rgb = sample_cubemap(&atlas, 16, [1.0, 0.0, 0.0]);
        assert!((rgb[0] - 1.0).abs() < 0.01);
        assert!(rgb[1] < 0.01);
        assert!(rgb[2] < 0.01);
    }

    #[test]
    fn sample_cubemap_bilinear_blends() {
        // Half-white half-black face: left half (px < face_size/2) = white,
        // right half = black.
        let face_size = 4u32;
        let channels = 3;
        let pixels = (face_size * face_size) as usize;

        let mut face0 = vec![0u8; pixels * channels];
        for py in 0..face_size {
            for px in 0..face_size {
                let off = ((py * face_size + px) * channels as u32) as usize;
                if px < face_size / 2 {
                    face0[off] = 255;
                    face0[off + 1] = 255;
                    face0[off + 2] = 255;
                }
            }
        }
        let black = vec![0u8; pixels * channels];
        let faces: [&[u8]; 6] = [&face0, &black, &black, &black, &black, &black];
        let atlas = crate::cubemap::cubemap_to_atlas(&faces, face_size, channels as u32);

        // +X face, u=0.25 v=0.5: direction [2, 0, 1] (x >> z, y=0).
        //    u = (-z/x + 1)/2 = (-0.5 + 1)/2 = 0.25  ✓
        //    v = (-y/x + 1)/2 = (0 + 1)/2 = 0.5      ✓
        // x = u * 4 = 1.0 → x0=1 (white), fx=0 → full white.
        let rgb = sample_cubemap(&atlas, face_size, [2.0, 0.0, 1.0]);
        assert!((rgb[0] - 1.0).abs() < 0.01, "expected bright, got {rgb:?}");

        // u=0.625: x = 2.5 → x0=2 (black), x1=3 (black), fx=0.5 → full black.
        // Direction [2, 0, -0.5] → z/x = -0.25 → sc = z/x factor...
        // Simpler: use [2, 0, -0.5] → sc = -(-0.5)/2 = 0.25 → u = (0.25+1)/2 = 0.625  ✓
        let rgb_black = sample_cubemap(&atlas, face_size, [2.0, 0.0, -0.5]);
        assert!(
            rgb_black[0] < 0.01,
            "expected black at u=0.625, got {rgb_black:?}"
        );
    }

    // -----------------------------------------------------------------------
    // sample_hemisphere_cosine
    // -----------------------------------------------------------------------

    #[test]
    fn hemisphere_samples_are_above_plane() {
        let normal = [0.0, 1.0, 0.0]; // Y-up
        let samples = sample_hemisphere_cosine(normal, 256);
        for s in &samples {
            let d = dot3(*s, normal);
            assert!(d >= -1e-12, "sample points below plane: dot={d}, dir={s:?}");
            // Should be near unit length
            let len = len3(*s);
            assert!((len - 1.0).abs() < 1e-12, "non-unit sample: len={len}");
        }
    }

    #[test]
    fn hemisphere_samples_are_unit_vectors() {
        let normal = normalize3([1.0, 2.0, 3.0]);
        let samples = sample_hemisphere_cosine(normal, 128);
        for s in &samples {
            let len = len3(*s);
            assert!((len - 1.0).abs() < 1e-12, "len={len} for {s:?}");
        }
    }

    #[test]
    fn hemisphere_cosine_concentrated_near_pole() {
        // The average dot(normal, sample) should be > 0.5 for cosine
        // distribution (expected value = 2/3 ~ 0.667).
        let normal = [0.0, 0.0, 1.0];
        let samples = sample_hemisphere_cosine(normal, 2048);
        let sum: f64 = samples.iter().map(|s| dot3(*s, normal)).sum();
        let avg = sum / samples.len() as f64;
        assert!(
            avg > 0.55,
            "cosine-weighted avg dot too low: {avg} (expected ~0.667)"
        );
    }

    // -----------------------------------------------------------------------
    // compute_irradiance_map
    // -----------------------------------------------------------------------

    #[test]
    fn uniform_white_cubemap_yields_uniform_irradiance() {
        // All faces white (255,255,255)
        let white: [[u8; 3]; 6] = [[255; 3]; 6];
        let atlas = uniform_atlas(16, &white);

        let irr = compute_irradiance_map(&atlas, 16);

        // Every output pixel should have roughly the same value.
        let first = irradiance_pixel(&irr, 0, 0, 0);
        for face in 0..6 {
            for v in 0..32 {
                for u in 0..32 {
                    let p = irradiance_pixel(&irr, face, u, v);
                    for c in 0..3 {
                        let diff = (p[c] as i32 - first[c] as i32).abs();
                        assert!(
                            diff <= 5,
                            "non-uniform irradiance at face={face} u={u} v={v}: \
                             pixel={p:?}, first={first:?}, diff={diff}"
                        );
                    }
                }
            }
        }
    }

    #[test]
    fn only_plus_x_white_opposite_face_is_black() {
        // Only +X (face 0) is white, all others black.
        let colours: [[u8; 3]; 6] = [
            [255, 255, 255],
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
            [0, 0, 0],
        ];
        let atlas = uniform_atlas(32, &colours);

        let irr = compute_irradiance_map(&atlas, 32);

        // Face 1 (-X) should be essentially black — its hemisphere does not
        // intersect the white +X face.
        for v in 0..32 {
            for u in 0..32 {
                let p = irradiance_pixel(&irr, 1, u, v);
                assert!(
                    p[0] == 0 && p[1] == 0 && p[2] == 0,
                    "face 1 (-X) pixel ({u},{v}) = {p:?}, expected (0,0,0)"
                );
            }
        }

        // Face 0 (+X) itself should be bright (it sees the white face).
        let centre = irradiance_pixel(&irr, 0, 16, 16);
        assert!(
            centre[0] > 0 || centre[1] > 0 || centre[2] > 0,
            "face 0 (+X) centre should be lit: {centre:?}"
        );
    }

    #[test]
    fn irradiance_atlas_has_correct_dimensions() {
        let white: [[u8; 3]; 6] = [[128; 3]; 6];
        let atlas = uniform_atlas(8, &white);

        let irr = compute_irradiance_map(&atlas, 8);

        // 3x2 at 32x32 per face, 3 channels
        assert_eq!(irr.len(), (3 * 2 * 32 * 32 * 3));
    }

    #[test]
    #[should_panic(expected = "cubemap atlas: expected")]
    fn irradiance_panics_on_bad_atlas_size() {
        let bad = vec![0u8; 100];
        compute_irradiance_map(&bad, 4);
    }
}
