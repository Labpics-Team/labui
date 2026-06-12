/// Immutable configuration for lens-based effects (glassmorphism, refraction).
pub struct LensConfig {
    /// Index of refraction (e.g., 1.5 for crown glass, 1.33 for water).
    pub ior: f64,
    /// Perceived thickness of the lens medium in rem units.
    pub depth: f64,
    /// Schlick exponent — higher values produce sharper edge reflections.
    /// Standard Schlick uses 5.0; lower values soften the transition.
    pub fresnel_power: f64,
    /// RGB tint applied to transmitted light, each channel in [0, 1].
    pub tint: [f64; 3],
    /// Chromatic aberration intensity (0 = off, 1 = full).
    pub chromatic_aberration: f64,
}

/// Fresnel reflectance at normal incidence (θ = 0°).
///
/// Formula: F₀ = ((n₁ - n₂) / (n₁ + n₂))²
/// Assuming air (IOR ≈ 1.0) as the surrounding medium:
/// F₀ = ((ior - 1) / (ior + 1))²
///
/// | Medium       | IOR  | F₀    |
/// |-------------|------|-------|
/// | Water       | 1.33 | 0.020 |
/// | Crown glass | 1.52 | 0.043 |
/// | Diamond     | 2.42 | 0.172 |
pub fn fresnel_f0(ior: f64) -> f64 {
    let t = (ior - 1.0) / (ior + 1.0);
    t * t
}

/// Schlick Fresnel approximation — reflectance at arbitrary incidence angle.
///
/// F(θ) = F₀ + (1 − F₀) · (1 − cos θ)^power
///
/// - At θ = 0° (cos θ = 1): returns F₀ — center of lens transmits most light.
/// - At θ ≈ 90° (cos θ ≈ 0): approaches 1.0 — edges reflect fully.
///
/// The `power` parameter controls the transition curve.
/// Standard Schlick uses 5.0; glass-like materials may use 3.0–7.0.
pub fn fresnel(f0: f64, cos_theta: f64, power: f64) -> f64 {
    let cos = cos_theta.clamp(0.0, 1.0);
    f0 + (1.0 - f0) * (1.0 - cos).powf(power)
}

/// Chromatic aberration sample offsets per color channel (R, G, B).
///
/// Blue light bends more than red light in refractive media.
/// Returns signed offsets for each channel:
/// - R: negative (shift toward optical axis — less refraction)
/// - G: zero (reference position)
/// - B: positive (shift away from optical axis — more refraction)
///
/// Caller scales each offset by the pixel's radial distance from the lens center.
/// The `strength` parameter (0–1) controls overall intensity.
pub fn chromatic_offsets(ior: f64, strength: f64) -> [f64; 3] {
    // Base offset proportional to IOR deviation from air and user-controlled strength.
    // 0.008 is an empirical constant that maps IOR range 1.0–2.5 to visually plausible offsets.
    let base = (ior - 1.0) * strength * 0.008;
    [-base, 0.0, base]
}

/// Refraction displacement at a given radial distance from the lens center.
///
/// Models the bending of light as it passes through a curved transparent medium.
/// Displacement grows with:
/// - radial distance (stronger refraction at lens edges)
/// - lens depth (thicker medium bends light more)
/// - IOR (higher refractive index = stronger bending)
///
/// The constant 0.12 maps rem-based depth to pixel-space displacement
/// at the reference design density (~16px/rem).
pub fn refraction_strength(radial: f64, depth: f64, ior: f64) -> f64 {
    radial * depth * (ior - 1.0) * 0.12
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fresnel_f0_water() {
        let f0 = fresnel_f0(1.33);
        assert!((f0 - 0.02).abs() < 0.005);
    }

    #[test]
    fn fresnel_f0_glass() {
        let f0 = fresnel_f0(1.5);
        assert!((f0 - 0.04).abs() < 0.01);
    }

    #[test]
    fn fresnel_at_normal_is_f0() {
        let f0 = 0.04;
        assert!((fresnel(f0, 1.0, 5.0) - f0).abs() < 0.0001);
    }

    #[test]
    fn fresnel_at_grazing_is_one() {
        let result = fresnel(0.04, 0.0, 5.0);
        assert!((result - 1.0).abs() < 0.0001);
    }

    #[test]
    fn chromatic_red_negative_blue_positive() {
        let [r, g, b] = chromatic_offsets(1.5, 1.0);
        assert!(r < 0.0);
        assert_eq!(g, 0.0);
        assert!(b > 0.0);
    }

    #[test]
    fn chromatic_zero_strength_is_zero() {
        let offsets = chromatic_offsets(2.0, 0.0);
        assert_eq!(offsets, [0.0, 0.0, 0.0]);
    }

    #[test]
    fn refraction_zero_at_center() {
        assert_eq!(refraction_strength(0.0, 1.0, 1.5), 0.0);
    }

    #[test]
    fn refraction_grows_with_ior() {
        let low = refraction_strength(10.0, 1.0, 1.3);
        let high = refraction_strength(10.0, 1.0, 2.0);
        assert!(high > low);
    }
}
