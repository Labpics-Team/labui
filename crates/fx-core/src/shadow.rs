/// Immutable configuration for penumbra shadow computation.
pub struct ShadowConfig {
    /// Perceived elevation of the element in rem units.
    pub depth: f64,
    /// Direction of the light source in degrees (0 = directly above, 90 = from the right).
    pub light_angle_deg: f64,
    /// Softness of the penumbra edge (0 = hard, 1 = maximum softness).
    pub penumbra_scale: f64,
    /// Width of the alpha mask in pixels.
    pub mask_width: u32,
    /// Height of the alpha mask in pixels.
    pub mask_height: u32,
}

/// Compute per-pixel occlusion intensities from an alpha mask.
///
/// For each pixel inside the mask (alpha ≥ 128), traces toward the light source
/// to count how many consecutive mask pixels lie between it and the light-facing edge.
/// This "occlusion distance" determines how deeply the pixel is buried inside the shape
/// relative to the light direction — the foundation for penumbra width calculation.
///
/// # Output
///
/// `Vec<f32>` of length `width * height`, row-major.
/// - `0.0` — fully lit (at the light-facing edge, or outside the mask)
/// - `1.0` — fully occluded (deep inside the shape, far from any light-facing edge)
///
/// The scale parameter (`depth * penumbra_scale`) controls how quickly occlusion
/// accumulates: larger values produce darker, more gradual shadows.
///
/// Returns an empty `Vec` if dimensions are zero or the mask length mismatches.
pub fn compute_penumbra(
    mask: &[u8],
    width: u32,
    height: u32,
    light_angle_rad: f64,
    depth: f64,
    penumbra_scale: f64,
) -> Vec<f32> {
    let expected_len = (width as usize) * (height as usize);
    if width == 0 || height == 0 || mask.len() != expected_len {
        return Vec::new();
    }

    let mut result = vec![0.0f32; expected_len];

    // Trace toward the light source (opposite to light ray direction).
    // angle 0 (vertical) → light source is above, so trace upward (dy < 0).
    let dx = -light_angle_rad.sin();
    let dy = -light_angle_rad.cos();

    let w = width as f64;
    let h = height as f64;
    // Maximum diagonal steps — bound the trace to avoid infinite loops
    let max_steps = ((w * w + h * h).sqrt().ceil() as u32).max(1);
    // Normalization factor: larger depth/scale → more gradual occlusion accumulation
    let norm_factor = (depth * 8.0 * penumbra_scale + 1.0).max(1.0);

    for y in 0..height {
        for x in 0..width {
            let idx = (y * width + x) as usize;
            // Outside the mask — leave at 0.0 (fully lit)
            if mask[idx] < 128 {
                continue;
            }
            // Count consecutive mask pixels from this pixel toward the light source.
            // Starts at 1 because this pixel itself is in the mask.
            let mut dist: u32 = 1;
            let mut cx = x as f64 + 0.5;
            let mut cy = y as f64 + 0.5;
            for _ in 0..max_steps {
                cx += dx;
                cy += dy;
                // Left the image boundary → edge found
                if cx < 0.0 || cy < 0.0 || cx >= w || cy >= h {
                    break;
                }
                let si = (cy as u32 * width + cx as u32) as usize;
                // Hit a transparent pixel → edge found
                if mask[si] < 128 {
                    break;
                }
                dist += 1;
            }
            // Normalize: 1 pixel from edge → near 0; many pixels → near 1
            let occlusion = ((dist.saturating_sub(1)) as f64 / norm_factor).min(1.0);
            result[idx] = occlusion as f32;
        }
    }

    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::FRAC_PI_4;

    #[test]
    fn empty_on_zero_width() {
        let mask = [255u8; 4];
        assert!(compute_penumbra(&mask, 0, 4, 0.0, 1.0, 1.0).is_empty());
    }

    #[test]
    fn empty_on_zero_height() {
        let mask = [255u8; 4];
        assert!(compute_penumbra(&mask, 4, 0, 0.0, 1.0, 1.0).is_empty());
    }

    #[test]
    fn empty_on_size_mismatch() {
        let mask = [255u8; 4];
        // mask has 4 elements but 3×3 requires 9
        assert!(compute_penumbra(&mask, 3, 3, 0.0, 1.0, 1.0).is_empty());
    }

    #[test]
    fn correct_output_size() {
        let mask = vec![255u8; 9];
        let result = compute_penumbra(&mask, 3, 3, 0.0, 1.0, 1.0);
        assert_eq!(result.len(), 9);
    }

    #[test]
    fn pixels_outside_mask_are_zero() {
        let mask = vec![0u8; 9];
        let result = compute_penumbra(&mask, 3, 3, 0.0, 1.0, 1.0);
        assert!(result.iter().all(|&v| v == 0.0));
    }

    #[test]
    fn center_of_large_mask_is_occluded() {
        // 5×5 solid mask with light from above-left
        let mask = vec![255u8; 25];
        let result = compute_penumbra(&mask, 5, 5, FRAC_PI_4, 1.0, 1.0);
        let center = result[12]; // (2,2) in a 5×5 grid
                                 // Center should have non-zero occlusion (it's inside the shape)
        assert!(
            center > 0.0,
            "center pixel should be occluded, got {center}"
        );
    }

    #[test]
    fn edge_pixel_faces_light_is_lit() {
        // 3×3 solid mask, light from directly above (angle = 0).
        let mask = [255u8; 9];
        let result = compute_penumbra(&mask, 3, 3, 0.0, 1.0, 1.0);
        // Top-center pixel (0, 1): tracing upward goes out of bounds immediately → dist=1
        // occlusion = (1-1)/norm = 0 → fully lit
        let top_center = result[1];
        assert_eq!(top_center, 0.0, "top edge facing light should be lit");
    }

    #[test]
    fn deeper_pixel_more_occluded_than_edge() {
        // 5×5 solid mask, light from directly above (angle = 0).
        let mask = vec![255u8; 25];
        let result = compute_penumbra(&mask, 5, 5, 0.0, 1.0, 1.0);
        let top = result[2]; // row 0, near edge
        let mid = result[7]; // row 1
        let bot = result[22]; // row 4, deep inside
                              // Deeper rows should have higher occlusion
        assert!(mid >= top, "mid-row should be >= top row occlusion");
        assert!(bot >= mid, "bottom row should be >= mid-row occlusion");
    }

    #[test]
    fn scale_dampens_occlusion() {
        let mask = vec![255u8; 25];
        let soft = compute_penumbra(&mask, 5, 5, FRAC_PI_4, 2.0, 1.0);
        let hard = compute_penumbra(&mask, 5, 5, FRAC_PI_4, 0.1, 0.1);
        // Larger depth+scale means smaller occlusion values (slower accumulation)
        let soft_max = soft.iter().cloned().fold(0.0f32, f32::max);
        let hard_max = hard.iter().cloned().fold(0.0f32, f32::max);
        assert!(
            soft_max <= hard_max,
            "larger depth/scale should dampen occlusion"
        );
    }
}
