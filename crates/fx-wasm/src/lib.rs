use fx_core::blur::{generate_radius_map, Axis, Curve};
use fx_core::shadow::compute_penumbra;
use fx_core::texture::proxy_dim;
use wasm_bindgen::prelude::*;

/// Compute a low-resolution proxy dimension from a native pixel count.
///
/// Returns `ceil(native / 4)`, clamped to [1, 256].
/// Free function — no instance required.
#[wasm_bindgen]
pub fn fx_proxy_dim(native: u32) -> u32 {
    proxy_dim(native)
}

/// WASM entry point for the LabUI effects engine.
///
/// Stateless wrapper — all computation is delegated to `fx-core`
/// pure functions. Construct once, call methods as needed.
#[wasm_bindgen]
pub struct FxWasm {}

#[wasm_bindgen]
impl FxWasm {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Self {
        Self {}
    }

    /// Generate a per-pixel blur radius map for upload to GPU.
    ///
    /// `curve`: 0 = Linear, 1 = EaseOut, 2 = EaseInOut
    /// `axis`: 0 = X (horizontal), 1 = Y (vertical)
    ///
    /// Returns a `Float32Array` of length `width * height` in row-major order.
    pub fn generate_radius_map(
        &self,
        width: u32,
        height: u32,
        from: f64,
        to: f64,
        curve: u8,
        axis: u8,
    ) -> Vec<f32> {
        let curve = match curve {
            0 => Curve::Linear,
            1 => Curve::EaseOut,
            _ => Curve::EaseInOut,
        };
        let axis = match axis {
            0 => Axis::X,
            _ => Axis::Y,
        };
        generate_radius_map(width, height, from, to, curve, axis)
    }

    /// Compute per-pixel occlusion intensities from an alpha mask.
    ///
    /// `mask` — `Uint8Array` of alpha values (0 = transparent, 255 = opaque).
    /// `light_angle_deg` — light direction in degrees (0 = directly above).
    /// `depth` — element elevation in rem.
    /// `penumbra_scale` — edge softness (0 = hard, 1 = maximum softness).
    ///
    /// Returns a `Float32Array` where 0 = lit, 1 = fully occluded.
    pub fn compute_penumbra(
        &self,
        mask: &[u8],
        width: u32,
        height: u32,
        light_angle_deg: f64,
        depth: f64,
        penumbra_scale: f64,
    ) -> Vec<f32> {
        let light_angle_rad = light_angle_deg.to_radians();
        compute_penumbra(mask, width, height, light_angle_rad, depth, penumbra_scale)
    }

    /// Schlick Fresnel approximation — reflectance at a given angle.
    ///
    /// `f0` — reflectance at normal incidence (use `fresnel_f0(ior)` to compute).
    /// `cos_theta` — cosine of the angle between view direction and surface normal.
    /// `power` — Schlick exponent (standard is 5.0, lower = softer transition).
    ///
    /// Returns reflectance in [f0, 1.0].
    #[allow(clippy::should_implement_trait)]
    pub fn fresnel(f0: f64, cos_theta: f64, power: f64) -> f64 {
        fx_core::lens::fresnel(f0, cos_theta, power)
    }
}

impl Default for FxWasm {
    fn default() -> Self {
        Self::new()
    }
}
