/// Specifies how the blur radius transitions across pixels.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Curve {
    /// Constant rate of change — `t` maps linearly.
    Linear,
    /// Decelerating toward the end — fast start, slow finish (CSS `ease-out`).
    EaseOut,
    /// Acceleration then deceleration — slow start, fast middle, slow end (CSS `ease-in-out`).
    EaseInOut,
}

/// Direction along which the blur radius varies.
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Axis {
    /// Blur radius varies horizontally (left to right).
    X,
    /// Blur radius varies vertically (top to bottom).
    Y,
}

/// Immutable configuration for a progressive blur effect.
pub struct BlurConfig {
    /// Radius at the start of the gradient (pixels).
    pub from_radius: f64,
    /// Radius at the end of the gradient (pixels).
    pub to_radius: f64,
    /// Easing curve for the transition.
    pub curve: Curve,
    /// Axis along which the blur varies.
    pub axis: Axis,
    /// Texture width in pixels.
    pub width: u32,
    /// Texture height in pixels.
    pub height: u32,
}

/// Generate a per-pixel radius map as a flat `Vec<f32>`.
///
/// Each pixel gets a blur radius value between `from` and `to`,
/// interpolated along `axis` with the specified `curve`.
///
/// The returned `Vec<f32>` has `width * height` elements in row-major order;
/// upload it to a GPU data texture for the blur shader to sample.
///
/// Returns an empty `Vec` if `width` or `height` is zero.
pub fn generate_radius_map(
    width: u32,
    height: u32,
    from: f64,
    to: f64,
    curve: Curve,
    axis: Axis,
) -> Vec<f32> {
    if width == 0 || height == 0 {
        return Vec::new();
    }
    let size = (width * height) as usize;
    let mut map = Vec::with_capacity(size);
    let range = to - from;
    let denom = match axis {
        Axis::X => (width - 1).max(1) as f64,
        Axis::Y => (height - 1).max(1) as f64,
    };
    for row in 0..height {
        for col in 0..width {
            let t = match axis {
                Axis::X => col as f64 / denom,
                Axis::Y => row as f64 / denom,
            };
            let curved = apply_curve(t, &curve);
            map.push((from + range * curved) as f32);
        }
    }
    map
}

/// Select the mip level to sample based on the desired blur radius.
///
/// Larger radii → higher mip levels (smaller, pre-blurred textures).
/// Returns a floating-point level for trilinear filtering in the shader.
///
/// Returns `0.0` if `mip_count` is ≤ 1 or `max_radius` is ≤ 0.
pub fn mip_level_for_radius(radius: f64, mip_count: u32, max_radius: f64) -> f32 {
    if mip_count <= 1 || max_radius <= 0.0 {
        return 0.0;
    }
    let t = (radius / max_radius).clamp(0.0, 1.0);
    (t * (mip_count - 1) as f64) as f32
}

fn apply_curve(t: f64, curve: &Curve) -> f64 {
    let t = t.clamp(0.0, 1.0);
    match curve {
        Curve::Linear => t,
        Curve::EaseOut => {
            // 1 - (1-t)² — quadratic ease-out
            let u = 1.0 - t;
            1.0 - u * u
        }
        Curve::EaseInOut => {
            // Piecewise: accelerate first half, decelerate second half
            if t < 0.5 {
                2.0 * t * t
            } else {
                let u = -2.0 * t + 2.0;
                1.0 - 0.5 * u * u
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn radius_map_empty_on_zero_width() {
        assert!(generate_radius_map(0, 100, 0.0, 10.0, Curve::Linear, Axis::X).is_empty());
    }

    #[test]
    fn radius_map_empty_on_zero_height() {
        assert!(generate_radius_map(100, 0, 0.0, 10.0, Curve::Linear, Axis::Y).is_empty());
    }

    #[test]
    fn radius_map_correct_size() {
        let map = generate_radius_map(4, 3, 0.0, 10.0, Curve::Linear, Axis::X);
        assert_eq!(map.len(), 12);
    }

    #[test]
    fn radius_map_x_gradient_monotonic() {
        let map = generate_radius_map(5, 2, 0.0, 10.0, Curve::Linear, Axis::X);
        for row in 0..2u32 {
            let base = (row * 5) as usize;
            for col in 1..5u32 {
                assert!(
                    map[base + col as usize] >= map[base + col as usize - 1],
                    "row {row}, col {col}: not monotonic"
                );
            }
        }
    }

    #[test]
    fn radius_map_x_uniform_columns() {
        // X axis: all rows should have identical values per column
        let map = generate_radius_map(4, 3, 5.0, 15.0, Curve::Linear, Axis::X);
        for col in 0..4u32 {
            let v0 = map[col as usize];
            let v1 = map[(4 + col) as usize];
            let v2 = map[(8 + col) as usize];
            assert_eq!(v0, v1);
            assert_eq!(v1, v2);
        }
    }

    #[test]
    fn mip_level_first_is_zero() {
        assert_eq!(mip_level_for_radius(0.0, 4, 12.0), 0.0);
    }

    #[test]
    fn mip_level_last_is_max() {
        let level = mip_level_for_radius(12.0, 4, 12.0);
        assert!((level - 3.0).abs() < 0.001);
    }

    #[test]
    fn mip_zero_count_returns_zero() {
        assert_eq!(mip_level_for_radius(5.0, 0, 10.0), 0.0);
    }

    #[test]
    fn ease_out_starts_faster_than_linear() {
        let eo = apply_curve(0.2, &Curve::EaseOut);
        let lin = apply_curve(0.2, &Curve::Linear);
        assert!(eo > lin, "ease-out should be ahead of linear at t=0.2");
    }

    #[test]
    fn ease_in_out_symmetric() {
        let left = apply_curve(0.25, &Curve::EaseInOut);
        let right = 1.0 - apply_curve(0.75, &Curve::EaseInOut);
        assert!(
            (left - right).abs() < 0.001,
            "ease-in-out should be symmetric"
        );
    }

    #[test]
    fn curve_endpoints() {
        for curve in [Curve::Linear, Curve::EaseOut, Curve::EaseInOut] {
            assert_eq!(apply_curve(0.0, &curve), 0.0);
            assert_eq!(apply_curve(1.0, &curve), 1.0);
        }
    }
}
