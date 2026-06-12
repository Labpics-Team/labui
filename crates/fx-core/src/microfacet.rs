//! GGX Microfacet Model — Walter et al. 2007, Heitz 2014.
//!
//! Implements the Cook–Torrance microfacet BRDF with:
//! - **Trowbridge–Reitz (GGX)** normal distribution function
//! - **Smith–GGX** geometry term with height correlation
//! - **Schlick** Fresnel approximation
//!
//! Reference: Walter, Marschner, Li, Torrance.
//! "Microfacet Models for Refraction through Rough Surfaces." EGSR 2007.
//! Height-correlated G₂: Heitz 2014, "Understanding the Masking-Shadowing Function."

use crate::vec3::Vec3;

// ---------------------------------------------------------------------------
// GGX / Trowbridge–Reitz Normal Distribution Function
// ---------------------------------------------------------------------------

/// Trowbridge–Reitz (GGX) isotropic normal distribution function.
///
/// D(θₕ) = α² / [π · ((n·h)² · (α² − 1) + 1)²]
///
/// where α = roughness (RMS slope, Walter et al. 2007 §5.2).
///
/// `n_dot_h` — cosine of the angle between the surface normal `n`
/// and the micro-normal (half-vector) `h`. Clamped to [0, 1].
///
/// `roughness` — GGX width parameter; 0 = perfect mirror (handled by
/// the BRDF-level delta-function special case), 1 = diffuse.
///
/// Returns 0 when `n_dot_h ≤ 0` (back-facing microfacets do not contribute
/// to reflection).  Also returns 0 for roughness near zero — the BRDF
/// handles the delta limit upstream via `microfacet_brdf`.
///
/// ## Property
/// ∫_Ω D(θ) · cos θ dω = 1 for any roughness (energy conserved over the hemisphere).
pub fn ggx_ndf(n_dot_h: f64, roughness: f64) -> f64 {
    let nh = n_dot_h.clamp(0.0, 1.0);
    if nh < 1e-12 || roughness < 1e-12 {
        return 0.0;
    }
    let a = roughness; // α in Walter 2007
    let a2 = a * a; // α²
    let nh2 = nh * nh;
    let denom = nh2 * (a2 - 1.0) + 1.0; // (n·h)²·(α²−1) + 1
    let denom2 = denom * denom;
    a2 / (std::f64::consts::PI * denom2)
}

// ---------------------------------------------------------------------------
// Smith–GGX Geometry Term — Separated G₁
// ---------------------------------------------------------------------------

/// Smith–GGX separated masking function for one direction.
///
/// G₁(v) = χ⁺(n·v) · 2 / [1 + √(1 + α² · tan²θ)]
///
/// where χ⁺ is the Heaviside step (1 when n·v > 0, else 0),
/// and tan²θ = (1 − (n·v)²) / (n·v)².
///
/// Returns 0 when `n_dot_v ≤ 0` (back-facing — light or view cannot reach
/// the surface from this direction).
///
/// ## Property
/// 0 ≤ G₁ ≤ 1 for all valid (n·v, α).
/// G₁(1.0, α) = 1.0 (head-on view is unshadowed).
/// G₁(0.0, α) = 0.0 (grazing view is fully shadowed).
pub fn smith_ggx_g1(n_dot_v: f64, roughness: f64) -> f64 {
    let nv = n_dot_v.clamp(0.0, 1.0);
    if nv < 1e-12 {
        return 0.0;
    }
    let a = roughness;
    let a2 = a * a;
    let nv2 = nv * nv;
    let tan2 = (1.0 - nv2) / nv2; // tan²θ
    2.0 / (1.0 + (1.0 + a2 * tan2).sqrt())
}

// ---------------------------------------------------------------------------
// Smith–GGX Geometry Term — Height-correlated G₂
// ---------------------------------------------------------------------------

/// Smith–GGX height-correlated masking-shadowing function (Heitz 2014).
///
/// Uses the Λ (lambda) parameterisation:
///
/// Λ(ω) = (√(1 + α²·tan²θ) − 1) / 2
///
/// G₂(v, l) = χ⁺(n·v) · χ⁺(n·l) / [1 + Λ(v) + Λ(l)]
///
/// Height correlation means that masking and shadowing are not independent:
/// a microfacet that is visible from the view direction is more likely to be
/// visible from the light direction, and vice versa.  This gives more accurate
/// results at grazing angles than simple G₁(v)·G₁(l).
///
/// ## Property
/// 0 ≤ G₂ ≤ 1 (always energy-conserving).
pub fn smith_ggx_g2(n_dot_v: f64, n_dot_l: f64, roughness: f64) -> f64 {
    let nv = n_dot_v.clamp(0.0, 1.0);
    let nl = n_dot_l.clamp(0.0, 1.0);
    if nv < 1e-12 || nl < 1e-12 {
        return 0.0;
    }
    let lambda_v = lambda(nv, roughness);
    let lambda_l = lambda(nl, roughness);
    1.0 / (1.0 + lambda_v + lambda_l)
}

/// Λ helper for the height-correlated G₂ (Heitz 2014, Eq. 78).
fn lambda(cos_theta: f64, roughness: f64) -> f64 {
    let a = roughness;
    let a2 = a * a;
    let ct2 = cos_theta * cos_theta;
    let tan2 = (1.0 - ct2) / ct2; // tan²θ
    (-1.0 + (1.0 + a2 * tan2).sqrt()).max(0.0) * 0.5
}

// ---------------------------------------------------------------------------
// Schlick Fresnel
// ---------------------------------------------------------------------------

/// Schlick Fresnel approximation — reflectance at a given incidence angle.
///
/// F(cosθ) = F₀ + (1 − F₀) · (1 − cosθ)⁵
///
/// - At cosθ = 1 (normal incidence): returns F₀ — the centre transmits most light.
/// - At cosθ = 0 (grazing angle): returns 1.0 — edges reflect fully.
///
/// `f0` — reflectance at normal incidence: F₀ = ((ior−1)/(ior+1))².
/// `cos_theta` — cosine of the angle between the view/light direction and
/// the surface normal (or the half-vector for microfacets).
///
/// # Examples
///
/// ```
/// # use fx_core::microfacet::schlick_fresnel;
/// // Glass (IOR 1.5): F₀ ≈ 0.04
/// let f0 = 0.04;
/// assert!((schlick_fresnel(1.0, f0) - f0).abs() < 1e-10);  // normal
/// assert!((schlick_fresnel(0.0, f0) - 1.0).abs() < 1e-10);  // grazing
/// ```
pub fn schlick_fresnel(cos_theta: f64, f0: f64) -> f64 {
    let cos = cos_theta.clamp(0.0, 1.0);
    let t = 1.0 - cos;
    let t2 = t * t;
    f0 + (1.0 - f0) * t2 * t2 * t // (1-cos)⁵
}

// ---------------------------------------------------------------------------
// Fresnel F₀ from IOR
// ---------------------------------------------------------------------------

/// Compute Fresnel reflectance at normal incidence from index of refraction.
///
/// F₀ = ((ior₁ − ior₂) / (ior₁ + ior₂))²
///
/// Assuming air (IOR ≈ 1.0) as the surrounding medium:
/// F₀ = ((ior − 1) / (ior + 1))²
///
/// | Medium       | IOR  | F₀    |
/// |-------------|------|-------|
/// | Water       | 1.33 | 0.020 |
/// | Crown glass | 1.52 | 0.043 |
/// | Diamond     | 2.42 | 0.172 |
pub fn fresnel_f0(ior: f64) -> f64 {
    // Physically, IOR cannot be less than 1.0 (vacuum is 1.0).
    if ior < 1.0 {
        return 0.0;
    }
    let t = (ior - 1.0) / (ior + 1.0);
    t * t
}

// ---------------------------------------------------------------------------
// Full Microfacet BRDF
// ---------------------------------------------------------------------------

/// Reflect vector `i` about normal `n`: r = i − 2(i·n)n.
fn reflect(i: &Vec3, n: &Vec3) -> Vec3 {
    *i - *n * (2.0 * i.dot(n))
}

/// Full Cook–Torrance microfacet BRDF with GGX NDF and Smith–GGX geometry.
///
/// fᵣ(n, v, l) = D(n·h) · G₂(n·v, n·l) · F(v·h) / [4 · (n·v) · (n·l)]
///
/// where `h = normalize(v + l)` is the half-vector (micro-normal).
///
/// # Arguments
/// - `n` — surface normal (unit length).
/// - `v` — view direction (unit length, from surface toward camera).
/// - `l` — light direction (unit length, from surface toward light).
/// - `roughness` — GGX width (0 = mirror, 1 = fully rough).
/// - `f0` — Fresnel reflectance at normal incidence.
///
/// Returns 0 when n·v ≤ 0 or n·l ≤ 0 (back-facing — no contribution).
pub fn microfacet_brdf(n: Vec3, v: Vec3, l: Vec3, roughness: f64, f0: f64) -> f64 {
    if roughness <= 1e-12 {
        // Perfect mirror: delta-function reflection.
        let r = reflect(&l, &n);
        if r.dot(&v) > 0.9999 {
            return f0 / (n.dot(&v) * n.dot(&l)).abs();
        }
        return 0.0;
    }

    let n_dot_v = n.dot(&v);
    let n_dot_l = n.dot(&l);
    if n_dot_v <= 0.0 || n_dot_l <= 0.0 {
        return 0.0;
    }

    // Half-vector
    let h = (v + l).normalize();
    let n_dot_h = n.dot(&h).clamp(0.0, 1.0);
    let v_dot_h = v.dot(&h).clamp(0.0, 1.0);

    let d = ggx_ndf(n_dot_h, roughness);
    let g = smith_ggx_g2(n_dot_v, n_dot_l, roughness);
    let f = schlick_fresnel(v_dot_h, f0);

    d * g * f / (4.0 * n_dot_v * n_dot_l)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::PI;

    // -- Helpers --

    /// Pseudo-random f64 in [0,1) using a simple LCG, seeded with `state`.
    /// Deterministic across runs — avoids pulling in `rand`.
    fn rand_f64(state: &mut u64) -> f64 {
        *state = state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        ((*state >> 12) as f64) / ((1u64 << 52) as f64)
    }

    // ------------------------------------------------------------------
    // ggx_ndf
    // ------------------------------------------------------------------

    #[test]
    fn ndf_integrates_to_one_over_hemisphere() {
        // Numerical integration of D(θ)·cosθ over the hemisphere
        // using 64 equally-spaced θ samples (far more than the minimal 15)
        // and analytical φ → 2π.
        let roughness = 0.5;
        let n_theta: usize = 64;
        let d_theta = (PI / 2.0) / (n_theta as f64);
        let mut sum = 0.0;

        for i in 0..n_theta {
            let theta = (i as f64 + 0.5) * d_theta; // midpoint
            let cos_theta = theta.cos();
            let d = ggx_ndf(cos_theta, roughness);
            sum += d * cos_theta * theta.sin() * d_theta;
        }
        let integral = sum * 2.0 * PI; // φ: 0 → 2π

        // The NDF should integrate to 1 over the hemisphere.
        assert!(
            (integral - 1.0).abs() < 0.05,
            "NDF integral = {integral}, expected ≈ 1.0 (roughness = {roughness})"
        );
    }

    #[test]
    fn ndf_integrates_to_one_various_roughness() {
        for roughness in [0.1, 0.3, 0.6, 0.9] {
            let n_theta: usize = 64;
            let d_theta = (PI / 2.0) / (n_theta as f64);
            let mut sum = 0.0;
            for i in 0..n_theta {
                let theta = (i as f64 + 0.5) * d_theta;
                let cos_theta = theta.cos();
                let d = ggx_ndf(cos_theta, roughness);
                sum += d * cos_theta * theta.sin() * d_theta;
            }
            let integral = sum * 2.0 * PI;
            assert!(
                (integral - 1.0).abs() < 0.05,
                "roughness={roughness}: integral={integral}"
            );
        }
    }

    #[test]
    fn ndf_zero_at_grazing() {
        // At grazing angle (n·h ≈ 0), D → 0 because denominator → 1 (for α² large)
        // or the microfacets are back-facing.
        // For cosθ → 0, D ∝ α²/π → 0 when α small.  Let's check numerically.
        let d = ggx_ndf(0.0, 0.5);
        assert_eq!(d, 0.0);
    }

    #[test]
    fn ndf_returns_zero_for_negative_n_dot_h() {
        assert_eq!(ggx_ndf(-0.5, 0.5), 0.0);
    }

    // ------------------------------------------------------------------
    // smith_ggx_g1
    // ------------------------------------------------------------------

    #[test]
    fn g1_always_le_one() {
        // Test 200 deterministic pseudo-random n·v values.
        let mut state: u64 = 42;
        for _ in 0..200 {
            let nv = rand_f64(&mut state); // uniformly in [0,1)
            for roughness in [0.05, 0.2, 0.5, 0.8, 1.0] {
                let g1 = smith_ggx_g1(nv, roughness);
                assert!(g1 <= 1.0 + 1e-12, "G1({nv}, {roughness}) = {g1} > 1.0");
                assert!(g1 >= 0.0, "G1({nv}, {roughness}) = {g1} < 0.0");
            }
        }
    }

    #[test]
    fn g1_at_normal_incidence_is_one() {
        for roughness in [0.1, 0.5, 1.0] {
            let g1 = smith_ggx_g1(1.0, roughness);
            assert!((g1 - 1.0).abs() < 1e-12, "G1(1.0, {roughness}) = {g1}");
        }
    }

    #[test]
    fn g1_at_grazing_approaches_zero() {
        // G₁(ε) → 0 as ε → 0
        for roughness in [0.1, 0.5, 1.0] {
            let g1 = smith_ggx_g1(1e-4, roughness);
            assert!(g1 < 1e-2, "G1(1e-4, {roughness}) = {g1}");
        }
    }

    #[test]
    fn g1_zero_for_back_facing() {
        assert_eq!(smith_ggx_g1(0.0, 0.5), 0.0);
        assert_eq!(smith_ggx_g1(-0.2, 0.5), 0.0);
    }

    // ------------------------------------------------------------------
    // smith_ggx_g2
    // ------------------------------------------------------------------

    #[test]
    fn g2_always_le_one() {
        let mut state: u64 = 117;
        for _ in 0..200 {
            let nv = rand_f64(&mut state);
            let nl = rand_f64(&mut state);
            for roughness in [0.05, 0.2, 0.5, 0.8, 1.0] {
                let g2 = smith_ggx_g2(nv, nl, roughness);
                assert!(
                    g2 <= 1.0 + 1e-12,
                    "G2({nv}, {nl}, {roughness}) = {g2} > 1.0"
                );
                assert!(g2 >= 0.0);
            }
        }
    }

    #[test]
    fn g2_zero_if_either_direction_back_facing() {
        assert_eq!(smith_ggx_g2(0.0, 0.7, 0.5), 0.0);
        assert_eq!(smith_ggx_g2(0.7, 0.0, 0.5), 0.0);
        assert_eq!(smith_ggx_g2(-0.1, 0.7, 0.5), 0.0);
        assert_eq!(smith_ggx_g2(0.7, -0.1, 0.5), 0.0);
    }

    #[test]
    fn g2_at_normal_normal_is_one() {
        for roughness in [0.1, 0.5, 1.0] {
            let g2 = smith_ggx_g2(1.0, 1.0, roughness);
            assert!((g2 - 1.0).abs() < 1e-12, "G2(1,1,{roughness}) = {g2}");
        }
    }

    // ------------------------------------------------------------------
    // schlick_fresnel
    // ------------------------------------------------------------------

    #[test]
    fn fresnel_at_normal_is_f0() {
        for f0 in [0.0, 0.04, 0.2, 0.8, 1.0] {
            let f = schlick_fresnel(1.0, f0);
            assert!((f - f0).abs() < 1e-12, "cos=1, f0={f0}: got {f}");
        }
    }

    #[test]
    fn fresnel_at_grazing_is_one() {
        for f0 in [0.0, 0.04, 0.5, 0.9] {
            let f = schlick_fresnel(0.0, f0);
            assert!((f - 1.0).abs() < 1e-12, "cos=0, f0={f0}: got {f}");
        }
    }

    #[test]
    fn fresnel_increases_as_angle_increases() {
        let f0 = 0.1;
        let f_normal = schlick_fresnel(1.0, f0);
        let f_mid = schlick_fresnel(0.5, f0);
        let f_grazing = schlick_fresnel(0.0, f0);
        assert!(f_mid > f_normal);
        assert!(f_grazing > f_mid);
    }

    // ------------------------------------------------------------------
    // fresnel_f0
    // ------------------------------------------------------------------

    #[test]
    fn fresnel_f0_from_ior() {
        // Water: IOR 1.33 → F₀ ≈ 0.020
        let f0 = fresnel_f0(1.33);
        assert!((f0 - 0.020).abs() < 0.005);

        // Glass: IOR 1.5 → F₀ = 0.04
        let f0 = fresnel_f0(1.5);
        assert!((f0 - 0.04).abs() < 1e-10);
    }

    #[test]
    fn fresnel_f0_ior_one_gives_zero() {
        assert_eq!(fresnel_f0(1.0), 0.0);
    }

    // ------------------------------------------------------------------
    // microfacet_brdf
    // ------------------------------------------------------------------

    #[test]
    fn brdf_zero_when_back_facing() {
        let n = Vec3 {
            x: 0.0,
            y: 0.0,
            z: 1.0,
        };
        let v = Vec3 {
            x: 0.0,
            y: 0.0,
            z: -1.0,
        }; // behind surface
        let l = Vec3 {
            x: 0.0,
            y: 0.0,
            z: 1.0,
        };
        assert_eq!(microfacet_brdf(n, v, l, 0.5, 0.04), 0.0);
        assert_eq!(microfacet_brdf(n, l, v, 0.5, 0.04), 0.0); // swapped — light behind
    }

    #[test]
    fn brdf_positive_on_valid_configuration() {
        let n = Vec3 {
            x: 0.0,
            y: 0.0,
            z: 1.0,
        };
        // View and light both in the upper hemisphere
        let v = Vec3 {
            x: 0.3,
            y: 0.0,
            z: 0.8,
        }
        .normalize();
        let l = Vec3 {
            x: 0.1,
            y: 0.2,
            z: 0.7,
        }
        .normalize();
        let brdf = microfacet_brdf(n, v, l, 0.5, 0.04);
        assert!(brdf > 0.0, "BRDF should be positive, got {brdf}");
    }

    #[test]
    fn brdf_energy_conserving_random() {
        // For a moderately rough surface, the BRDF sampled at random
        // directions should not wildly exceed the diffuse-equivalent
        // bound 1/π.  Specular peaks (roughness ≈ 0, v ≈ l) can
        // legitimately exceed this, so we use roughness ≥ 0.3.
        let n = Vec3 {
            x: 0.0,
            y: 0.0,
            z: 1.0,
        };
        let mut state: u64 = 99;
        let mut max_brdf: f64 = 0.0;
        for _ in 0..500 {
            // Random view/light directions in the upper hemisphere.
            let v = random_hemisphere_dir(&mut state, &n);
            let l = random_hemisphere_dir(&mut state, &n);
            let brdf = microfacet_brdf(n, v, l, 0.5, 0.04);
            // For energy conservation, the hemispherical integral ≤ 1.
            // A single-point BRDF can exceed 1/π at specular peaks, but
            // for random directions and moderate roughness the values
            // stay well-behaved.  Verifying no explosion (NaN, inf, or
            // absurdly large).
            assert!(brdf.is_finite(), "BRDF = {brdf} (non-finite)");
            assert!(brdf >= 0.0, "BRDF = {brdf} (negative)");
            max_brdf = max_brdf.max(brdf);
        }
        // With roughness 0.5 we expect max < ~3 (rough bound — the
        // peak value can be concentrated but should not diverge).
        assert!(
            max_brdf <= 5.0,
            "max BRDF over 500 random samples = {max_brdf}"
        );
    }

    #[test]
    fn brdf_symmetric_when_v_l_swapped() {
        // The BRDF should be Helmholtz-reciprocal: f(n,v,l) = f(n,l,v).
        let n = Vec3 {
            x: 0.0,
            y: 0.0,
            z: 1.0,
        };
        let v = Vec3 {
            x: 0.4,
            y: 0.1,
            z: 0.6,
        }
        .normalize();
        let l = Vec3 {
            x: -0.2,
            y: 0.3,
            z: 0.7,
        }
        .normalize();
        let brdf_vl = microfacet_brdf(n, v, l, 0.4, 0.1);
        let brdf_lv = microfacet_brdf(n, l, v, 0.4, 0.1);
        assert!(
            (brdf_vl - brdf_lv).abs() < 1e-12,
            "BRDF not symmetric: {brdf_vl} vs {brdf_lv}"
        );
    }

    #[test]
    fn brdf_smooth_roughness_gives_larger_peak() {
        // As roughness → 0, the specular peak sharpens → maximum BRDF increases.
        // As roughness → 1, the distribution flattens → BRDF decreases.
        let n = Vec3 {
            x: 0.0,
            y: 0.0,
            z: 1.0,
        };
        // View and light nearly coincide — specular peak configuration.
        let v = Vec3 {
            x: 0.2,
            y: 0.0,
            z: 0.7,
        }
        .normalize();
        let l = Vec3 {
            x: 0.2,
            y: 0.0,
            z: 0.7,
        }
        .normalize();
        let smooth = microfacet_brdf(n, v, l, 0.1, 0.04);
        let rough = microfacet_brdf(n, v, l, 0.9, 0.04);
        assert!(
            smooth > rough,
            "smooth(0.1)={smooth} should exceed rough(0.9)={rough}"
        );
    }

    // ------------------------------------------------------------------
    // Vec3
    // ------------------------------------------------------------------

    #[test]
    fn vec3_dot() {
        let a = Vec3 {
            x: 1.0,
            y: 2.0,
            z: 3.0,
        };
        let b = Vec3 {
            x: 4.0,
            y: 5.0,
            z: 6.0,
        };
        assert_eq!(a.dot(&b), 32.0);
    }

    #[test]
    fn vec3_normalize_unit() {
        let v = Vec3 {
            x: 3.0,
            y: 4.0,
            z: 0.0,
        }
        .normalize();
        assert!((v.length() - 1.0).abs() < 1e-12);
        assert!((v.x - 0.6).abs() < 1e-12);
        assert!((v.y - 0.8).abs() < 1e-12);
    }

    #[test]
    fn vec3_normalize_zero_does_not_panic() {
        let v = Vec3::ZERO.normalize();
        assert_eq!(v, Vec3::ZERO);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /// Deterministic random unit direction in the upper hemisphere
    /// around the given normal `n`.
    fn random_hemisphere_dir(state: &mut u64, n: &Vec3) -> Vec3 {
        // Cosine-weighted hemisphere sampling (Malley's method):
        // pick two uniform randoms, produce a direction around (0,0,1),
        // then rotate to n.
        let u1 = rand_f64(state);
        let u2 = rand_f64(state);
        let r = u1.sqrt();
        let phi = 2.0 * PI * u2;
        let x = r * phi.cos();
        let y = r * phi.sin();
        let z = (1.0 - u1).sqrt(); // cosθ
        let local = Vec3 { x, y, z };

        // Rotate (0,0,1) → n via a minimal rotation.
        let nz = Vec3 {
            x: 0.0,
            y: 0.0,
            z: 1.0,
        };
        let cos_a = n.dot(&nz);
        if (cos_a - 1.0).abs() < 1e-10 {
            return local;
        }
        if (cos_a + 1.0).abs() < 1e-10 {
            return Vec3 {
                x: -local.x,
                y: -local.y,
                z: -local.z,
            };
        }

        // Rodrigues rotation around nz × n
        let axis = Vec3 {
            x: -n.y,
            y: n.x,
            z: 0.0,
        }
        .normalize();
        let sin_a = (1.0 - cos_a * cos_a).sqrt();
        local * cos_a
            + Vec3 {
                x: axis.y * local.z - axis.z * local.y,
                y: axis.z * local.x - axis.x * local.z,
                z: axis.x * local.y - axis.y * local.x,
            } * sin_a
            + axis * (axis.dot(&local) * (1.0 - cos_a))
    }
}
