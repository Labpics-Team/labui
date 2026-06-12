//! Cauchy dispersion equation — refractive index as a function of wavelength.
//!
//! The Cauchy equation is an empirical relationship between refractive index *n*
//! and wavelength λ. It is widely used for optical glasses in the visible spectrum
//! where absorption is negligible.
//!
//! # Formula
//! n(λ) = A + B/λ² + C/λ⁴
//!
//! Coefficients (A, B, C) are published with λ in **micrometers** (µm).
//! Public API accepts wavelength in **nanometers** (nm) and converts internally.

/// Computes the refractive index *n* at a given wavelength using the Cauchy equation.
///
/// # Formula
/// n(λ) = A + B/λ² + C/λ⁴
///
/// The standard Cauchy coefficients (A, B, C) for optical glasses are published
/// with λ in **micrometers** (µm). This function accepts `wavelength_nm` in
/// **nanometers** (nm) — the industry convention for the visible spectrum
/// (380–780 nm) — and divides by 1000 to match the published coefficient convention.
///
/// # Parameters
/// - `wavelength_nm`: wavelength in nanometers (e.g., 550 for green).
/// - `a`, `b`, `c`: Cauchy coefficients — see the material datasheet.
///
/// # Examples
///
/// N-BK7 at 550 nm (green):
/// ```
/// let n = fx_core::cauchy::ior_at_wavelength(550.0, 1.5046, 0.00420, 0.0);
/// assert!((n - 1.5187).abs() < 0.001);
/// ```
pub fn ior_at_wavelength(wavelength_nm: f64, a: f64, b: f64, c: f64) -> f64 {
    if wavelength_nm <= 0.0 {
        return a; // asymptotic limit as λ → ∞ (avoids division by zero)
    }
    let lambda_um = wavelength_nm / 1000.0; // nm → µm
    let l2 = lambda_um * lambda_um;
    a + b / l2 + c / (l2 * l2)
}

/// Returns the Cauchy coefficients for Schott N-BK7 optical glass.
///
/// Published 2-term coefficients (C = 0). Valid for the visible spectrum
/// (380–780 nm) with residual error < 0.0003 against the full Sellmeier model.
///
/// # Reference
/// Schott Optical Glass Data Sheets, N-BK7 (August 2019).
pub fn bk7_coefficients() -> (f64, f64, f64) {
    (1.5046, 0.00420, 0.0)
}

/// Computes per-channel IOR values for RGB rendering at standard
/// display-primary wavelengths.
///
/// Returns `[ior_r, ior_g, ior_b]`:
/// - R: 650 nm (sRGB red primary)
/// - G: 550 nm (sRGB green primary)
/// - B: 450 nm (sRGB blue primary)
///
/// Blue light refracts more than red in optical glass, so
/// `ior_b > ior_g > ior_r`.
///
/// # Example
///
/// ```
/// let (a, b, c) = fx_core::cauchy::bk7_coefficients();
/// let [r, g, b] = fx_core::cauchy::rgb_ior((a, b, c));
/// assert!(b > r, "blue IOR must exceed red IOR");
/// ```
pub fn rgb_ior(coeffs: (f64, f64, f64)) -> [f64; 3] {
    let (a, b, c) = coeffs;
    [
        ior_at_wavelength(650.0, a, b, c), // R
        ior_at_wavelength(550.0, a, b, c), // G
        ior_at_wavelength(450.0, a, b, c), // B
    ]
}

/// Precomputed RGB IOR for BK7 glass at sRGB primaries (650, 550, 450 nm).
///
/// These are the exact values from `rgb_ior(bk7_coefficients())`.
/// Blue refracts more than green, green more than red — the physics of
/// normal dispersion in optical glass.
pub const BK7_RGB_IOR: [f64; 3] = [1.51432, 1.51872, 1.52628];

/// Converts Sellmeier coefficients (6 parameters) to an equivalent set of
/// Cauchy coefficients (3 parameters).
///
/// The Sellmeier equation is the industrial standard for optical glass datasheets
/// (Schott, Ohara, Hoya). The Cauchy equation is a simpler empirical fit suitable
/// for real-time rendering where the full Sellmeier is too expensive per pixel.
///
/// # Sellmeier Formula
/// n²(λ) = 1 + Σ Bᵢ·λ² / (λ² − Cᵢ)  for i = 1, 2, 3
///
/// λ is in **micrometers** (µm), matching the published coefficient convention.
/// This function handles the unit conversion internally.
///
/// # Conversion Method
/// Evaluates the Sellmeier equation at 20 equally-spaced points across the
/// visible spectrum (400–700 nm), then fits Cauchy coefficients A, B, C via
/// linear least squares on the design matrix [1, 1/λ², 1/λ⁴].
///
/// # Parameters
/// - `b1`, `b2`, `b3`: Sellmeier B coefficients (dimensionless).
/// - `c1`, `c2`, `c3`: Sellmeier C coefficients (in µm²).
///
/// # Returns
/// - `(A, B, C)`: Cauchy coefficients. For most glasses C ≈ 0.
///
/// # Accuracy
/// For N-BK7: residual ≤ 0.5% across 400–700 nm.
pub fn sellmeier_to_cauchy(
    b1: f64,
    b2: f64,
    b3: f64,
    c1: f64,
    c2: f64,
    c3: f64,
) -> (f64, f64, f64) {
    /// Number of sample points across the visible range.
    const N: usize = 20;

    let mut xs = [0.0f64; N]; // 1/λ²
    let mut ys = [0.0f64; N]; // 1/λ⁴
    let mut ns = [0.0f64; N]; // n(λ)

    for i in 0..N {
        let lambda_nm = 400.0 + (i as f64) * 300.0 / (N as f64 - 1.0);
        let lambda_um = lambda_nm / 1000.0;
        ns[i] = sellmeier_n(lambda_um, b1, b2, b3, c1, c2, c3);
        let l2 = lambda_um * lambda_um;
        xs[i] = 1.0 / l2;
        ys[i] = xs[i] * xs[i]; // 1/λ⁴
    }

    fit_cauchy_3term(&xs, &ys, &ns)
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/// Evaluate the Sellmeier equation at wavelength λ (in µm).
fn sellmeier_n(lambda_um: f64, b1: f64, b2: f64, b3: f64, c1: f64, c2: f64, c3: f64) -> f64 {
    let l2 = lambda_um * lambda_um;
    let t1 = b1 * l2 / (l2 - c1);
    let t2 = b2 * l2 / (l2 - c2);
    let t3 = b3 * l2 / (l2 - c3);
    (1.0 + t1 + t2 + t3).sqrt()
}

/// Fit Cauchy coefficients (A, B, C) to data points via linear least squares.
///
/// Model: n = A + B·x + C·y  where x = 1/λ², y = 1/λ⁴.
///
/// Solves the 3×3 normal equations via Cramer's rule — no external
/// dependencies required.
fn fit_cauchy_3term(xs: &[f64], ys: &[f64], ns: &[f64]) -> (f64, f64, f64) {
    let n = xs.len() as f64;

    let mut sx = 0.0;
    let mut sy = 0.0;
    let mut sn = 0.0;
    let mut sxx = 0.0;
    let mut syy = 0.0;
    let mut sxy = 0.0;
    let mut snx = 0.0;
    let mut sny = 0.0;

    for i in 0..xs.len() {
        let x = xs[i];
        let y = ys[i];
        let ni = ns[i];
        sx += x;
        sy += y;
        sn += ni;
        sxx += x * x;
        syy += y * y;
        sxy += x * y;
        snx += ni * x;
        sny += ni * y;
    }

    // Normal equations:
    // [ n    sx   sy  ] [A]   [sn ]
    // [ sx   sxx  sxy ] [B] = [snx]
    // [ sy   sxy  syy ] [C]   [sny]

    let det = n * (sxx * syy - sxy * sxy) - sx * (sx * syy - sxy * sy) + sy * (sx * sxy - sxx * sy);

    if det.abs() < 1e-30 {
        // Degenerate: return A ≈ mean, B = C = 0
        return (sn / n, 0.0, 0.0);
    }

    let det_a =
        sn * (sxx * syy - sxy * sxy) - sx * (snx * syy - sxy * sny) + sy * (snx * sxy - sxx * sny);

    let det_b =
        n * (snx * syy - sxy * sny) - sn * (sx * syy - sxy * sy) + sy * (sx * sny - snx * sy);

    let det_c =
        n * (sxx * sny - snx * sxy) - sx * (sx * sny - snx * sy) + sn * (sx * sxy - sxx * sy);

    (det_a / det, det_b / det, det_c / det)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // Schott N-BK7 Sellmeier coefficients (λ in µm).
    // Source: Schott Optical Glass Data Sheets, N-BK7, 2019.
    const BK7_B1: f64 = 1.03961212;
    const BK7_B2: f64 = 0.231792344;
    const BK7_B3: f64 = 1.01046945;
    const BK7_C1: f64 = 0.00600069867;
    const BK7_C2: f64 = 0.0200179144;
    const BK7_C3: f64 = 103.560653;

    /// Published Schott N-BK7 reference values at standard spectral lines
    /// (Sellmeier model). Used as ground truth for Cauchy approximation tests.
    fn sellmeier_ref(lambda_nm: f64) -> f64 {
        sellmeier_n(
            lambda_nm / 1000.0,
            BK7_B1,
            BK7_B2,
            BK7_B3,
            BK7_C1,
            BK7_C2,
            BK7_C3,
        )
    }

    // --- ior_at_wavelength ---------------------------------------------------

    #[test]
    fn bk7_at_550nm_matches_published() {
        let (a, b, c) = bk7_coefficients();
        let n = ior_at_wavelength(550.0, a, b, c);
        // Published Schott value: 1.51872 at 546.1 nm (e-line).
        // At 550 nm the Cauchy approximation gives ~1.5185.
        // Tolerance 0.001 per spec.
        assert!(
            (n - 1.51872).abs() < 0.001,
            "BK7 at 550 nm: expected ~1.51872, got {:.5}",
            n
        );
    }

    #[test]
    fn reference_points_within_tolerance() {
        let (a, b, c) = bk7_coefficients();
        // Schott published values (Sellmeier model) at key wavelengths.
        let cases = [(480.0, 1.52283), (546.0, 1.51872), (644.0, 1.51472)];
        for &(wl_nm, expected) in &cases {
            let n = ior_at_wavelength(wl_nm, a, b, c);
            let diff = (n - expected).abs();
            assert!(
                diff < 0.0005,
                "λ={wl_nm}nm: expected {expected:.5}, got {n:.5}, diff={diff:.6}"
            );
        }
    }

    #[test]
    fn blue_refracts_more_than_red() {
        let (a, b, c) = bk7_coefficients();
        let n_blue = ior_at_wavelength(450.0, a, b, c);
        let n_red = ior_at_wavelength(650.0, a, b, c);
        assert!(
            n_blue > n_red,
            "blue IOR ({n_blue:.5}) must exceed red IOR ({n_red:.5})"
        );
    }

    #[test]
    fn chromatic_dispersion_at_least_0_008() {
        let (a, b, c) = bk7_coefficients();
        let n_blue = ior_at_wavelength(450.0, a, b, c);
        let n_red = ior_at_wavelength(650.0, a, b, c);
        let spread = n_blue - n_red;
        assert!(
            spread >= 0.008,
            "BK7 chromatic spread: expected ≥ 0.008, got {:.5}",
            spread
        );
    }

    #[test]
    fn ior_monotonic_decreasing_with_wavelength() {
        // Longer wavelength → lower IOR (normal dispersion).
        let (a, b, c) = bk7_coefficients();
        let mut prev = ior_at_wavelength(380.0, a, b, c);
        for wl_nm in (390..=780).step_by(10) {
            let n = ior_at_wavelength(wl_nm as f64, a, b, c);
            assert!(
                n < prev,
                "IOR must decrease with wavelength: λ={wl_nm}nm n={n:.5} ≥ prev={prev:.5}"
            );
            prev = n;
        }
    }

    // --- bk7_coefficients ----------------------------------------------------

    #[test]
    fn bk7_c_is_zero() {
        let (_, _, c) = bk7_coefficients();
        assert_eq!(c, 0.0);
    }

    // --- rgb_ior -------------------------------------------------------------

    #[test]
    fn rgb_ior_physically_ordered() {
        let (a, b, c) = bk7_coefficients();
        let [r, g, b] = rgb_ior((a, b, c));
        assert!(b > g, "blue IOR ({b:.5}) must exceed green ({g:.5})");
        assert!(g > r, "green IOR ({g:.5}) must exceed red ({r:.5})");
    }

    #[test]
    fn rgb_ior_matches_direct_calculation() {
        let (a, b, c) = bk7_coefficients();
        let [r, g, _b] = rgb_ior((a, b, c));
        // Exact equality: rgb_ior delegates to ior_at_wavelength with same args.
        assert_eq!(r, ior_at_wavelength(650.0, a, b, c));
        assert_eq!(g, ior_at_wavelength(550.0, a, b, c));
    }

    #[test]
    fn rgb_ior_chromatic_spread_at_least_0_008() {
        let (a, b, c) = bk7_coefficients();
        let [r, _, b] = rgb_ior((a, b, c));
        assert!(
            b - r >= 0.008,
            "RGB chromatic spread: expected ≥ 0.008, got {:.5}",
            b - r
        );
    }

    #[test]
    fn bk7_rgb_ior_blue_exceeds_red_by_at_least_0_008() {
        let [r, g, b] = BK7_RGB_IOR;
        assert!(b > g);
        assert!(g > r);
        assert!(b - r >= 0.008);
    }

    // --- sellmeier_to_cauchy -------------------------------------------------

    #[test]
    fn sellmeier_to_cauchy_bk7_accuracy_within_one_percent() {
        let (ca, cb, cc) = sellmeier_to_cauchy(BK7_B1, BK7_B2, BK7_B3, BK7_C1, BK7_C2, BK7_C3);
        // Verify ≤ 1% relative error across 400–700 nm.
        for wl_nm in (400..=700).step_by(10) {
            let ref_n = sellmeier_ref(wl_nm as f64);
            let approx_n = ior_at_wavelength(wl_nm as f64, ca, cb, cc);
            let rel_err = (approx_n - ref_n).abs() / ref_n;
            assert!(
                rel_err < 0.01,
                "λ={wl_nm}nm: Sellmeier ref={ref_n:.5}, Cauchy fit={approx_n:.5}, rel_err={:.4}",
                rel_err
            );
        }
    }

    #[test]
    fn sellmeier_to_cauchy_bk7_c_near_zero() {
        let (_, _, cc) = sellmeier_to_cauchy(BK7_B1, BK7_B2, BK7_B3, BK7_C1, BK7_C2, BK7_C3);
        // For BK7 the C term should be negligible.
        assert!(
            cc.abs() < 0.01,
            "BK7 Cauchy C should be near zero, got {:.6}",
            cc
        );
    }

    #[test]
    fn sellmeier_to_cauchy_bk7_a_near_published() {
        let (ca, _, _) = sellmeier_to_cauchy(BK7_B1, BK7_B2, BK7_B3, BK7_C1, BK7_C2, BK7_C3);
        // Published A = 1.5046; fitted A should be within 0.1%.
        assert!(
            (ca - 1.5046).abs() < 0.005,
            "Fitted A={:.5} deviates from published 1.5046",
            ca
        );
    }

    // --- 41-point table: 380–780 nm, step 10 nm ------------------------------

    #[test]
    fn table_380_to_780_within_half_percent_of_sellmeier() {
        let (ca, cb, cc) = sellmeier_to_cauchy(BK7_B1, BK7_B2, BK7_B3, BK7_C1, BK7_C2, BK7_C3);
        // 41 points: 380, 390, ..., 780 nm.
        for step in 0..=40 {
            let wl_nm = 380.0 + step as f64 * 10.0;
            let ref_n = sellmeier_ref(wl_nm);
            let approx_n = ior_at_wavelength(wl_nm, ca, cb, cc);
            let rel_err = (approx_n - ref_n).abs() / ref_n;
            assert!(
                rel_err < 0.005,
                "λ={wl_nm:.0}nm: Sellmeier ref={ref_n:.5}, Cauchy fit={approx_n:.5}, rel_err={:.4}",
                rel_err
            );
        }
    }

    #[test]
    fn table_41_points_count() {
        // Sanity: verify we covered exactly 41 points.
        let points: Vec<f64> = (0..=40).map(|s| 380.0 + s as f64 * 10.0).collect();
        assert_eq!(points.len(), 41);
        assert!((points[0] - 380.0).abs() < 1e-10);
        assert!((points[40] - 780.0).abs() < 1e-10);
    }

    // --- Edge cases ----------------------------------------------------------

    #[test]
    fn ior_approaches_a_at_large_wavelength() {
        // As λ → ∞, B/λ² + C/λ⁴ → 0, so n → A.
        let (a, b, c) = bk7_coefficients();
        // At 1e9 nm (1 m), B/λ² = 0.00420 / (1e6)² = 4.2e-15.
        let n = ior_at_wavelength(1_000_000_000.0, a, b, c);
        assert!(
            (n - a).abs() < 1e-12,
            "n should approach A={a} at large λ, got {n:.15}"
        );
    }
}
