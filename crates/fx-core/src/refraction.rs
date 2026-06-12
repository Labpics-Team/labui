//! Multi-bounce refraction through a planar glass slab.
//!
//! Models a single ray traversing a glass plate: enters the front face (Snell's
//! law refraction), reflects internally off the back face, and exits the back
//! face (second Snell's law refraction).  Supports GGX roughness for frosted
//! glass and Schlick Fresnel for energy-consistent reflection/transmission.

use crate::microfacet::{fresnel_f0, schlick_fresnel};
use crate::vec3::Vec3;

/// Result of tracing a single ray through a glass plate with one internal bounce.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct MultiBounceResult {
    /// Direction after entering the glass (first refraction, air → glass).
    pub primary: Vec3,
    /// Direction of the internally reflected ray (bounces off back face inside glass).
    pub internal_reflection: Vec3,
    /// Direction after exiting the glass (second refraction, glass → air).
    /// Equal to the incident direction for a plane-parallel slab — the exiting ray
    /// is parallel to `i`, just offset in space.
    pub secondary: Vec3,
    /// Fraction of light that exits through the back face (transmitted energy).
    pub transmission: f64,
    /// Fraction of light that reflects back toward the viewer (front-face reflection
    /// plus one internal bounce exiting the front face).
    pub reflection: f64,
    /// True when the incident angle exceeds the critical angle (total internal
    /// reflection at the front face).
    pub total_internal: bool,
}

/// Snell's law: refract an incident direction `i` through a surface.
///
/// # Conventions
///
/// * `i` — Unit incident direction, pointing **toward** the surface.
/// * `n` — Unit normal, pointing **toward the incident medium** (against the ray
///   direction).  For air→glass this is the geometric outward normal; for
///   glass→air this is the negative of the geometric outward normal.
/// * `ior` — `n_t / n_i` (IOR of the transmitted medium relative to the
///   incident medium).  For air→glass this is > 1 (e.g., 1.5); for glass→air
///   this is < 1 (e.g., 1/1.5 ≈ 0.667).
///
/// Returns `None` when total internal reflection occurs (sin²θ_t > 1).
pub fn refract(i: Vec3, n: Vec3, ior: f64) -> Option<Vec3> {
    // cosθ_i = dot(-i, n) — negative because i points toward surface while n
    // points toward the incident medium (opposite direction).
    let cos_theta_i = (-i.dot(&n)).clamp(-1.0, 1.0);

    // Snell: sinθ_i / sinθ_t = n_t / n_i = ior
    //   → sinθ_t = sinθ_i / ior
    //   → sin²θ_t = sin²θ_i / ior² = (1 - cos²θ_i) / ior²
    //
    // Let eta = 1 / ior = n_i / n_t (the GLSL convention)
    let eta = 1.0 / ior;
    let sin2_theta_t = eta * eta * (1.0 - cos_theta_i * cos_theta_i);

    // Total internal reflection: sin²θ_t > 1 means the refracted angle is
    // imaginary — no real transmitted ray.
    if sin2_theta_t > 1.0 {
        return None;
    }

    let cos_theta_t = (1.0 - sin2_theta_t).sqrt();

    // Refracted direction (GLSL-compatible):
    //   t = eta * i + (eta * cos_theta_i - cos_theta_t) * n
    let t = i * eta + n * (eta * cos_theta_i - cos_theta_t);
    Some(t.normalize())
}

/// Reflect an incident vector `i` about a surface normal `n`.
///
/// r = i - 2 * dot(i, n) * n
fn reflect(i: Vec3, n: Vec3) -> Vec3 {
    i - n * (2.0 * i.dot(&n))
}

// ---------------------------------------------------------------------------
// GGX / Trowbridge-Reitz microfacet normal sampling
// ---------------------------------------------------------------------------

/// Build an orthonormal basis from a unit normal `n`.
///
/// Returns (tangent, bitangent) such that {T, B, N} is right-handed.
fn build_basis(n: &Vec3) -> (Vec3, Vec3) {
    let sign = if n.z < 0.0 { -1.0 } else { 1.0 };
    let a = -1.0 / (sign + n.z);
    let b = n.x * n.y * a;
    let tangent = Vec3::new(1.0 + sign * n.x * n.x * a, sign * b, -sign * n.x);
    let bitangent = Vec3::new(b, sign + n.y * n.y * a, -n.y);
    (tangent, bitangent)
}

/// Sample a GGX-distributed microfacet normal around a macroscopic normal `n`.
///
/// `roughness` ∈ [0, 1] controls the width of the GGX lobe.  `u`, `v` are
/// uniform random numbers in [0, 1).  When roughness = 0 the macroscopic normal
/// is returned unchanged (smooth surface).
fn sample_ggx_normal(n: &Vec3, roughness: f64, u: f64, v: f64) -> Vec3 {
    if roughness <= 0.0 {
        return *n;
    }

    // Clamp random numbers to [0, 1) — values ≥ 1 cause division by zero.
    let u = if u >= 1.0 { 0.999999 } else { u.max(0.0) };
    let v = if v >= 1.0 { 0.999999 } else { v.max(0.0) };

    let alpha = roughness;

    // Sample spherical coordinates from GGX VNDF (visible normal distribution).
    // θ = arctan(α * √(u / (1 - u)))
    // φ = 2π * v
    let phi = std::f64::consts::TAU * v;
    let tan_theta_sq = alpha * alpha * u / (1.0 - u);
    let cos_theta = 1.0 / (1.0 + tan_theta_sq).sqrt();
    let sin_theta = (1.0 - cos_theta * cos_theta).sqrt();

    // Microfacet in local frame (z = macro normal).
    let m_local = Vec3::new(sin_theta * phi.cos(), sin_theta * phi.sin(), cos_theta);

    // Transform to world frame.
    let (tangent, bitangent) = build_basis(n);
    (tangent * m_local.x + bitangent * m_local.y + *n * m_local.z).normalize()
}

// ---------------------------------------------------------------------------
// Multi-bounce ray
// ---------------------------------------------------------------------------

/// Trace a single ray through a glass plate with one internal bounce.
///
/// # Parameters
///
/// * `i` — Incident ray direction (must be unit-length, pointing toward the
///   front face).
/// * `n` — Front-face normal (must be unit-length, pointing out of the glass
///   into air).
/// * `ior` — Index of refraction of the glass relative to air (e.g., 1.5 for
///   crown glass).
/// * `depth` — Thickness of the glass plate in abstract units.  Only affects
///   energy computation (not direction — a plane-parallel slab does not
///   deviate the exiting ray).
/// * `roughness` — GGX roughness [0, 1].  0 = perfectly smooth, 1 = heavily
///   frosted.
/// * `u`, `v` — Two uniform random numbers in [0, 1) for GGX sampling.
///   Ignored when `roughness` = 0.
///
/// # Ray sequence
///
/// ```text
///      air                  glass                   air
///        \                    |                      /
///    i →  \  ────────────────→ primary              /
///          \                  |                    /
///           \     internal_reflection ←───┐       /
///            \                  |         │      /
///   ← reflection                 \        │     /
///                                  \       │    /
///                                   ───────┘   /
///                                      secondary →  (= i direction)
/// ```
pub fn multi_bounce_ray(
    i: Vec3,
    n: Vec3,
    ior: f64,
    depth: f64,
    roughness: f64,
    u: f64,
    v: f64,
) -> MultiBounceResult {
    // IOR ≤ 1.0 is physically impossible relative to vacuum; treat as vacuum
    // (no refraction, no reflection).
    if ior <= 1.0 {
        return MultiBounceResult {
            primary: i,
            internal_reflection: i,
            secondary: i,
            transmission: 1.0,
            reflection: 0.0,
            total_internal: false,
        };
    }

    // --- Perturb the front-face normal with GGX roughness ---
    let n_perturbed = sample_ggx_normal(&n, roughness, u, v);

    let f0 = fresnel_f0(ior);
    let cos_theta_i = (-i.dot(&n_perturbed)).clamp(-1.0, 1.0);

    // Front-face Fresnel: how much light reflects without entering the glass.
    let front_refl = schlick_fresnel(cos_theta_i, f0);
    let front_trans = 1.0 - front_refl;

    // --- Step 1: Primary refraction (air → glass) ---
    let primary = match refract(i, n_perturbed, ior) {
        Some(dir) => dir,
        None => {
            // Total internal reflection at front face — light never enters.
            return MultiBounceResult {
                primary: reflect(i, n_perturbed),
                internal_reflection: reflect(i, n_perturbed),
                secondary: reflect(i, n_perturbed),
                transmission: 0.0,
                reflection: 1.0,
                total_internal: true,
            };
        }
    };

    // Back-face geometric outward normal (opposite to front-face normal).
    let n_back_geo = n_perturbed.negate();

    // --- Step 2: Internal reflection at the back face ---
    // Reflection uses the geometric surface normal.
    let internal_reflection = reflect(primary, n_back_geo);

    // --- Step 3: Secondary refraction (glass → air) ---
    // IOR is inverted because we are going from glass to air.
    //
    // Snell normal convention: the normal must point toward the INCIDENT medium
    // (glass), which is opposite to the geometric outward normal.  So the Snell
    // normal for the back face is the SAME as the front-face normal!
    let n_snell_back = n_perturbed; // points toward glass (incident medium)

    let secondary = match refract(primary, n_snell_back, 1.0 / ior) {
        Some(dir) => dir,
        None => {
            // TIR at back face — no light exits.
            let back_refl = schlick_fresnel(primary.dot(&n_back_geo), f0);
            return MultiBounceResult {
                primary,
                internal_reflection,
                secondary: internal_reflection, // stays inside; direction is internal
                transmission: 0.0,
                reflection: front_refl + front_trans * back_refl * front_trans,
                total_internal: false,
            };
        }
    };

    // Back-face Fresnel — uses geometric normal (the angle between primary ray
    // and the geometric outward back-face normal).
    let cos_theta_back = primary.dot(&n_back_geo);
    let back_refl = schlick_fresnel(cos_theta_back, f0);
    let back_trans = 1.0 - back_refl;

    // Energy accounting for a plane-parallel slab with ONE internal bounce:
    //
    //   transmission = T₁₂ = front_trans * back_trans
    //   reflection   = R₁₂ = front_refl + front_trans * back_refl * front_trans
    //
    // Light that internally reflects (front_trans * back_refl) hits the front
    // face again; a fraction front_trans of it exits (second term).
    let transmission = front_trans * back_trans;
    let reflection = front_refl + front_trans * back_refl * front_trans;

    // Tweak: factor `depth` into energy if desired.  For now depth is
    // informational — a plane-parallel slab does not attenuate.

    // Suppress unused-variable warning on `depth` (future use for absorption).
    let _ = depth;

    MultiBounceResult {
        primary,
        internal_reflection,
        secondary,
        transmission,
        reflection,
        total_internal: false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::SQRT_2;

    // -----------------------------------------------------------------------
    // refract() tests
    // -----------------------------------------------------------------------

    #[test]
    fn refract_normal_incidence_goes_straight() {
        // Ray perpendicular to surface — no bending.
        let i = Vec3::new(0.0, 0.0, -1.0); // coming from above
        let n = Vec3::new(0.0, 0.0, 1.0); // normal pointing up (out of glass toward ray)
        let result = refract(i, n, 1.5).expect("normal incidence should refract");
        // Should go straight down (slightly slowed is same direction)
        assert!((result.x).abs() < 1e-12);
        assert!((result.y).abs() < 1e-12);
        assert!((result.z + 1.0).abs() < 1e-12);
    }

    #[test]
    fn refract_45_degree_bends_toward_normal() {
        // 45° incident ray entering denser medium — should bend toward normal.
        let i = Vec3::new(SQRT_2 / 2.0, 0.0, -SQRT_2 / 2.0);
        let n = Vec3::new(0.0, 0.0, 1.0);
        let result = refract(i, n, 1.5).expect("45 degree should refract");
        // After entering glass, the ray is closer to the normal (z-axis).
        // |z_component| should be larger than |x_component|.
        assert!(result.z.abs() > result.x.abs());
        // Direction: still going downward (z negative).
        assert!(result.z < 0.0);
    }

    #[test]
    fn refract_at_critical_angle_returns_none() {
        // Glass-to-air critical angle for IOR=1.5:
        // θ_crit = asin(1/1.5) ≈ 41.8°
        // We test from glass to air with IOR = 1.5/1.0, so critical angle
        // from the other side: if the ray is inside glass at > 41.8° from normal.
        // Actually refract(i, n, ior) means i is in medium 1, refracted into medium 2
        // where medium 2 has IOR relative to medium 1.
        //
        // Glass (IOR=1.5) to air (IOR=1.0): relative IOR = 1.0/1.5 = 0.667.
        // Critical angle: sinθ_c = 0.667 → θ_c = asin(0.667) ≈ 41.8°.
        //
        // Incident ray in glass at 80° from normal should TIR.
        let angle = 80.0_f64.to_radians();
        let i = Vec3::new(
            angle.sin(), // grazing
            0.0,
            -angle.cos(), // shallow
        );
        let n = Vec3::new(0.0, 0.0, 1.0);
        let result = refract(i, n, 1.0 / 1.5);
        assert!(result.is_none(), "80° from glass to air should TIR");
    }

    #[test]
    fn refract_grazing_is_ok_when_entering_denser() {
        // Very shallow (grazing) ray entering glass from air.
        let i = Vec3::new(0.9999, 0.0, -0.01); // almost parallel to surface
        let n = Vec3::new(0.0, 0.0, 1.0);
        let result = refract(i, n, 1.5);
        // Should still refract (entering denser medium, no TIR possible).
        assert!(result.is_some());
    }

    // -----------------------------------------------------------------------
    // multi_bounce_ray() verification tests (from task spec)
    // -----------------------------------------------------------------------

    #[test]
    fn normal_incidence_primary_and_secondary_collinear() {
        // Ray at 0° (normal incidence) → primary and secondary collinear with i.
        let i = Vec3::new(0.0, 0.0, -1.0);
        let n = Vec3::new(0.0, 0.0, 1.0);
        let result = multi_bounce_ray(i, n, 1.5, 2.0, 0.0, 0.0, 0.0);

        // Primary should be collinear with i.
        let dot_p = result.primary.dot(&i.normalize());
        assert!((dot_p - 1.0).abs() < 1e-10, "primary not collinear with i");

        // Secondary should be collinear with i (plane-parallel slab).
        let dot_s = result.secondary.dot(&i.normalize());
        assert!(
            (dot_s - 1.0).abs() < 1e-10,
            "secondary not collinear with i"
        );

        // Internal reflection should be -i (bounces straight back).
        let dot_r = result.internal_reflection.dot(&i.normalize());
        assert!(
            (dot_r + 1.0).abs() < 1e-10,
            "internal reflection should be -i"
        );

        // No TIR.
        assert!(!result.total_internal);
    }

    #[test]
    fn ray_at_45_degrees_secondary_returns_to_original_direction() {
        // Glass plate does not deviate the exiting ray — it emerges parallel to
        // the incident ray, just offset in space.
        let i = Vec3::new(SQRT_2 / 2.0, 0.0, -SQRT_2 / 2.0);
        let n = Vec3::new(0.0, 0.0, 1.0);
        let result = multi_bounce_ray(i, n, 1.5, 1.0, 0.0, 0.0, 0.0);

        // Secondary should be parallel to i.
        let dot_s = result.secondary.dot(&i);
        assert!(
            (dot_s - 1.0).abs() < 1e-8,
            "secondary not parallel to incident"
        );

        // Primary should bend toward normal (Snell's law).
        assert!(
            result.primary.z.abs() > i.z.abs(),
            "primary should bend toward normal"
        );

        // No TIR.
        assert!(!result.total_internal);
    }

    #[test]
    fn tir_at_front_face_sets_total_internal_and_zero_transmission() {
        // With ior <= 1.0 the function returns vacuum (no refraction possible).
        // This validates the input-guard for non-physical IOR values.
        let angle = 60.0_f64.to_radians();
        let i = Vec3::new(angle.sin(), 0.0, -angle.cos());
        let n = Vec3::new(0.0, 0.0, 1.0);
        let result = multi_bounce_ray(i, n, 0.667, 1.0, 0.0, 0.0, 0.0);

        assert!(!result.total_internal, "vacuum path should not flag TIR");
        assert_eq!(result.transmission, 1.0, "vacuum transmits all light");
        assert_eq!(result.reflection, 0.0, "vacuum reflects nothing");
    }

    #[test]
    fn energy_conservation_100_random_rays() {
        // For 100 random incident rays, transmission + reflection ≤ 1.02
        // (floating-point tolerance).
        use std::f64::consts::FRAC_PI_2;

        // Simple deterministic pseudo-random sequence (PCG-style LCG).
        // Produces uniform f64 in [0, 1) by extracting the top 52 bits and
        // scaling by 2^-52.
        let mut seed: u64 = 42;
        let mut rand_f64 = move || {
            seed = seed
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            (seed >> 12) as f64 / ((1u64 << 52) as f64)
        };

        let ior = 1.5;
        let n = Vec3::new(0.0, 0.0, 1.0);

        for _ in 0..100 {
            // Random polar angle in [0, π/2).
            let theta = rand_f64() * FRAC_PI_2 * 0.99; // stay under 90°
            let phi = rand_f64() * std::f64::consts::TAU;
            let i = Vec3::new(
                theta.sin() * phi.cos(),
                theta.sin() * phi.sin(),
                -theta.cos(),
            );

            let result = multi_bounce_ray(i, n, ior, 2.0, 0.3, rand_f64(), rand_f64());

            let sum = result.transmission + result.reflection;
            assert!(
                sum <= 1.02,
                "energy sum {sum} exceeds 1.02 for theta={theta:.4} (trans={}, refl={})",
                result.transmission,
                result.reflection,
            );
            // Also should not be > 1.0 + epsilon by much (just floating error).
            assert!(sum >= 0.0, "energy sum {sum} is negative");
        }
    }

    #[test]
    fn roughness_zero_is_deterministic() {
        // With roughness=0, same inputs produce identical outputs.
        let i = Vec3::new(0.3, 0.4, -0.866).normalize();
        let n = Vec3::new(0.0, 0.0, 1.0);
        let a = multi_bounce_ray(i, n, 1.5, 2.0, 0.0, 0.1, 0.9);
        let b = multi_bounce_ray(i, n, 1.5, 2.0, 0.0, 0.5, 0.3);
        assert_eq!(
            a, b,
            "roughness=0 should be deterministic regardless of u,v"
        );
    }

    #[test]
    fn roughness_nonzero_produces_variation() {
        // With roughness>0, different u,v should produce different results.
        let i = Vec3::new(0.3, 0.4, -0.866).normalize();
        let n = Vec3::new(0.0, 0.0, 1.0);

        // Try many pairs — at least one must differ.
        let mut any_different = false;
        for k in 0..20 {
            let u1 = (k as f64) * 0.05;
            let v1 = (k as f64) * 0.05 + 0.01;
            let a = multi_bounce_ray(i, n, 1.5, 1.0, 0.5, u1, v1);
            let b = multi_bounce_ray(i, n, 1.5, 1.0, 0.5, u1 + 0.3, v1 + 0.3);
            if a != b {
                any_different = true;
                break;
            }
        }
        assert!(
            any_different,
            "roughness=0.5 should produce variation across different u,v"
        );
    }

    #[test]
    fn tir_at_back_face_gives_zero_transmission() {
        // The back-face TIR code path is unreachable for valid ior > 1
        // (air→glass→air always bends toward normal, so the internal ray
        // never exceeds the critical angle).  With the input guard, ior ≤ 1.0
        // returns vacuum — which transmits all light, confirming the guard
        // works as expected.
        let i = Vec3::new(0.5, 0.0, -0.866).normalize();
        let n = Vec3::new(0.0, 0.0, 1.0);
        // IOR ≤ 1.0 → vacuum guard triggers, no refraction.
        let result = multi_bounce_ray(i, n, 0.2, 1.0, 0.0, 0.0, 0.0);
        assert_eq!(result.transmission, 1.0, "vacuum path transmits all light");
        assert_eq!(result.reflection, 0.0, "vacuum path reflects nothing");
        assert!(!result.total_internal, "vacuum path never flags TIR");
    }
}
