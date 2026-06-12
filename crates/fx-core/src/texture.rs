/// Compute a low-resolution proxy dimension.
///
/// Returns `ceil(native / 4)`, clamped to [1, 256].
/// Used for generating proxy textures where full resolution
/// is unnecessary (e.g., blur radius maps, shadow previews).
///
/// # Examples
///
/// | native | proxy |
/// |--------|-------|
/// | 1024   | 256   |
/// | 512    | 128   |
/// | 64     | 16    |
/// | 3      | 1     |
/// | 0      | 1     |
pub fn proxy_dim(native: u32) -> u32 {
    native.div_ceil(4).clamp(1, 256)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn caps_at_256() {
        assert_eq!(proxy_dim(2048), 256);
        assert_eq!(proxy_dim(4096), 256);
        assert_eq!(proxy_dim(u32::MAX), 256);
    }

    #[test]
    fn floor_is_one() {
        assert_eq!(proxy_dim(0), 1);
        assert_eq!(proxy_dim(1), 1);
        assert_eq!(proxy_dim(3), 1);
    }

    #[test]
    fn standard_quarter_ceil() {
        assert_eq!(proxy_dim(512), 128);
        assert_eq!(proxy_dim(64), 16);
        assert_eq!(proxy_dim(5), 2); // 5/4 = 1.25 → ceil = 2
        assert_eq!(proxy_dim(8), 2); // 8/4 = 2 → exact
        assert_eq!(proxy_dim(9), 3); // 9/4 = 2.25 → ceil = 3
    }
}
