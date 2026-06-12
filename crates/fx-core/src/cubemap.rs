//! Cubemap utilities — assemble 6 faces into a 3×2 WebGPU atlas
//! and convert between 3D directions and per-face UV coordinates.
//!
//! Atlas layout (3 columns × 2 rows, Vulkan / WebGPU convention):
//!
//! ```text
//! Row 0: +X (right)  | -X (left)  | +Y (top)
//! Row 1: -Y (bottom) | +Z (front) | -Z (back)
//! ```
//!
//! Face indices: 0 = +X, 1 = -X, 2 = +Y, 3 = -Y, 4 = +Z, 5 = -Z.

// ---------------------------------------------------------------------------
// Atlas assembly
// ---------------------------------------------------------------------------

/// Assembles 6 square face slices into a single 3×2 cubemap atlas.
///
/// Each slice is `face_size × face_size × channels` bytes, row-major.
/// Face order matches the atlas layout: `[+X, -X, +Y, -Y, +Z, -Z]`.
///
/// # Panics
///
/// Panics if any face slice length does not equal `face_size * face_size * channels`.
pub fn cubemap_to_atlas(faces: &[&[u8]; 6], face_size: u32, channels: u32) -> Vec<u8> {
    let face_pixels = (face_size * face_size) as usize;
    let expected_byte_len = face_pixels * channels as usize;

    // Validate all faces upfront — precondition violation is a caller bug.
    for (i, face) in faces.iter().enumerate() {
        assert_eq!(
            face.len(),
            expected_byte_len,
            "face {i}: expected {expected_byte_len} bytes, got {}",
            face.len(),
        );
    }

    let atlas_width = 3 * face_size as usize;
    let atlas_height = 2 * face_size as usize;
    let atlas_row_stride = atlas_width * channels as usize;
    let face_row_stride = face_size as usize * channels as usize;

    let mut atlas = vec![0u8; atlas_width * atlas_height * channels as usize];

    // Face positions in the atlas: (col, row)
    //   face 0 (+X) → (0,0)   face 1 (-X) → (1,0)   face 2 (+Y) → (2,0)
    //   face 3 (-Y) → (0,1)   face 4 (+Z) → (1,1)   face 5 (-Z) → (2,1)
    let positions: [(usize, usize); 6] = [(0, 0), (1, 0), (2, 0), (0, 1), (1, 1), (2, 1)];

    for (face_idx, (col, row)) in positions.iter().enumerate() {
        let src = faces[face_idx];
        let dst_x = col * face_size as usize;
        let dst_y = row * face_size as usize;

        for y in 0..face_size as usize {
            let src_offset = y * face_row_stride;
            let src_row = &src[src_offset..src_offset + face_row_stride];

            let dst_offset = (dst_y + y) * atlas_row_stride + dst_x * channels as usize;
            let dst_row = &mut atlas[dst_offset..dst_offset + face_row_stride];

            dst_row.copy_from_slice(src_row);
        }
    }

    atlas
}

// ---------------------------------------------------------------------------
// Direction ↔ UV mapping
// ---------------------------------------------------------------------------

/// Maps a 3D direction vector to a cubemap face index and UV coordinates.
///
/// Returns `(face_index, u, v)` where:
/// - `face_index` is 0..=5 (matching the atlas layout above)
/// - `u, v` are in [0, 1] range, with (0.5, 0.5) at face centre
///
/// The direction vector does NOT need to be normalised — only its orientation
/// matters. A zero-length direction returns face 0 centre as a safe fallback.
///
/// # Verification
///
/// - `direction_to_uv([1, 0, 0])` → `(0, 0.5, 0.5)` (+X centre)
/// - `direction_to_uv([-1, 0, 0])` → `(1, 0.5, 0.5)` (-X centre)
pub fn direction_to_uv(dir: [f64; 3]) -> (usize, f64, f64) {
    let [x, y, z] = dir;
    let ax = x.abs();
    let ay = y.abs();
    let az = z.abs();

    // Zero vector — degenerate, return a safe fallback.
    #[allow(clippy::float_cmp)]
    if ax + ay + az == 0.0 {
        return (0, 0.5, 0.5);
    }

    let (face, sc, tc) = if ax >= ay && ax >= az {
        // ±X major
        if x >= 0.0 {
            // +X — u runs right (-z), v runs down (-y)
            (0, -z / ax, -y / ax)
        } else {
            // -X — u runs left (+z), v runs down (-y)
            (1, z / ax, -y / ax)
        }
    } else if ay >= ax && ay >= az {
        // ±Y major
        if y >= 0.0 {
            // +Y — u runs right (+x), v runs up (+z)
            (2, x / ay, z / ay)
        } else {
            // -Y — u runs right (+x), v runs down (-z)
            (3, x / ay, -z / ay)
        }
    } else {
        // ±Z major
        if z >= 0.0 {
            // +Z — u runs right (+x), v runs down (-y)
            (4, x / az, -y / az)
        } else {
            // -Z — u runs left (-x), v runs down (-y)
            (5, -x / az, -y / az)
        }
    };

    // Map from [-1, 1] to [0, 1]
    let u = (sc + 1.0) * 0.5;
    let v = (tc + 1.0) * 0.5;

    (face, u, v)
}

/// Inverse of `direction_to_uv`: converts a face index + UV back to a unit
/// direction vector.
///
/// The returned vector is guaranteed to be normalised (length ≈ 1.0).
/// UV values outside [0, 1] are accepted and produce directions beyond the
/// face boundary (useful for seamless filtering).
///
/// # Panics
///
/// Panics if `face >= 6` (caller bug — face index must be 0..=5).
pub fn uv_to_direction(face: usize, u: f64, v: f64) -> [f64; 3] {
    // Map UV from [0, 1] to signed coordinates in [-1, 1]
    let sc = 2.0 * u - 1.0;
    let tc = 2.0 * v - 1.0;

    let dir = match face {
        0 => [1.0, -tc, -sc],  // +X
        1 => [-1.0, -tc, sc],  // -X
        2 => [sc, 1.0, tc],    // +Y
        3 => [sc, -1.0, -tc],  // -Y
        4 => [sc, -tc, 1.0],   // +Z
        5 => [-sc, -tc, -1.0], // -Z
        _ => panic!("uv_to_direction: invalid face index {face}, expected 0..=5"),
    };

    // Normalise to a unit vector.
    let len = (dir[0] * dir[0] + dir[1] * dir[1] + dir[2] * dir[2]).sqrt();
    if len > 0.0 {
        [dir[0] / len, dir[1] / len, dir[2] / len]
    } else {
        dir
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // -- cubemap_to_atlas ---------------------------------------------------

    #[test]
    fn atlas_size_is_3x2_times_face() {
        let size = 4u32;
        let pixel_count = (size * size) as usize;
        // Each face filled with its index as a byte value for tracing.
        let faces: [Vec<u8>; 6] = core::array::from_fn(|i| vec![i as u8; pixel_count]);
        let slices: [&[u8]; 6] = core::array::from_fn(|i| faces[i].as_slice());

        let atlas = cubemap_to_atlas(&slices, size, 1);
        assert_eq!(atlas.len(), (3 * size * 2 * size) as usize);

        // Face 0 (+X) at (0,0) — top-left corner should be 0.
        assert_eq!(atlas[0], 0);
        // Face 2 (+Y) at (2,0) — top-right corner of row 0 should be 2.
        let col2_x = (2 * size) as usize;
        assert_eq!(atlas[col2_x], 2);
        // Face 4 (+Z) at (1,1) — middle of row 1 should be 4.
        let row1_y = size as usize;
        let col1_x = size as usize;
        assert_eq!(atlas[row1_y * (3 * size as usize) + col1_x], 4);
    }

    #[test]
    fn atlas_preserves_face_data() {
        let size = 3u32;
        let pixel_count = (size * size) as usize;
        // Face 0: all 0xAA, Face 1: all 0xBB, …
        let values: [u8; 6] = [0xAA, 0xBB, 0xCC, 0xDD, 0xEE, 0xFF];
        let faces: [Vec<u8>; 6] = core::array::from_fn(|i| vec![values[i]; pixel_count]);
        let slices: [&[u8]; 6] = core::array::from_fn(|i| faces[i].as_slice());

        let atlas = cubemap_to_atlas(&slices, size, 1);

        // Face 0 region: rows 0..size-1, cols 0..size-1 → all 0xAA
        for y in 0..size as usize {
            for x in 0..size as usize {
                let idx = y * (3 * size as usize) + x;
                assert_eq!(atlas[idx], 0xAA, "face 0 mismatch at ({x},{y})");
            }
        }
        // Face 5 (-Z) at (2,1): rows size..2*size-1, cols 2*size..3*size-1 → all 0xFF
        for y in size as usize..2 * size as usize {
            for x in (2 * size as usize)..(3 * size as usize) {
                let idx = y * (3 * size as usize) + x;
                assert_eq!(atlas[idx], 0xFF, "face 5 mismatch at ({x},{y})");
            }
        }
    }

    #[test]
    fn atlas_multi_channel() {
        let size = 2u32;
        let channels = 4u32; // RGBA
        let pixel_count = (size * size) as usize;
        // Each face has a distinct first-channel value.
        let faces: [Vec<u8>; 6] = core::array::from_fn(|i| {
            let mut data = vec![0u8; pixel_count * channels as usize];
            for p in 0..pixel_count {
                data[p * channels as usize] = (10 * (i + 1)) as u8;
            }
            data
        });
        let slices: [&[u8]; 6] = core::array::from_fn(|i| faces[i].as_slice());

        let atlas = cubemap_to_atlas(&slices, size, channels);

        // Face 0 first pixel R channel = 10
        assert_eq!(atlas[0], 10);
        // Face 1 first pixel R channel at column size (pixel 2)
        assert_eq!(atlas[(size * channels) as usize], 20);
        // Face 2 first pixel R channel at column 2*size
        assert_eq!(atlas[(2 * size * channels) as usize], 30);
    }

    #[test]
    #[should_panic(expected = "face 1: expected")]
    fn atlas_panics_on_wrong_face_size() {
        let good = vec![0u8; 16]; // 4×4×1
        let bad = vec![0u8; 12]; // wrong
        cubemap_to_atlas(&[&good, &bad, &good, &good, &good, &good], 4, 1);
    }

    // -- direction_to_uv ----------------------------------------------------

    #[test]
    fn direction_to_uv_plus_x_is_face0_center() {
        let (face, u, v) = direction_to_uv([1.0, 0.0, 0.0]);
        assert_eq!(face, 0);
        assert!((u - 0.5).abs() < 1e-12);
        assert!((v - 0.5).abs() < 1e-12);
    }

    #[test]
    fn direction_to_uv_minus_x_is_face1_center() {
        let (face, u, v) = direction_to_uv([-1.0, 0.0, 0.0]);
        assert_eq!(face, 1);
        assert!((u - 0.5).abs() < 1e-12);
        assert!((v - 0.5).abs() < 1e-12);
    }

    #[test]
    fn direction_to_uv_plus_y_is_face2_center() {
        let (face, u, v) = direction_to_uv([0.0, 1.0, 0.0]);
        assert_eq!(face, 2);
        assert!((u - 0.5).abs() < 1e-12);
        assert!((v - 0.5).abs() < 1e-12);
    }

    #[test]
    fn direction_to_uv_minus_y_is_face3_center() {
        let (face, u, v) = direction_to_uv([0.0, -1.0, 0.0]);
        assert_eq!(face, 3);
        assert!((u - 0.5).abs() < 1e-12);
        assert!((v - 0.5).abs() < 1e-12);
    }

    #[test]
    fn direction_to_uv_plus_z_is_face4_center() {
        let (face, u, v) = direction_to_uv([0.0, 0.0, 1.0]);
        assert_eq!(face, 4);
        assert!((u - 0.5).abs() < 1e-12);
        assert!((v - 0.5).abs() < 1e-12);
    }

    #[test]
    fn direction_to_uv_minus_z_is_face5_center() {
        let (face, u, v) = direction_to_uv([0.0, 0.0, -1.0]);
        assert_eq!(face, 5);
        assert!((u - 0.5).abs() < 1e-12);
        assert!((v - 0.5).abs() < 1e-12);
    }

    #[test]
    fn direction_to_uv_zero_vector_safe_fallback() {
        let (face, u, v) = direction_to_uv([0.0, 0.0, 0.0]);
        assert_eq!(face, 0);
        assert!((u - 0.5).abs() < 1e-12);
        assert!((v - 0.5).abs() < 1e-12);
    }

    #[test]
    fn direction_to_uv_corners() {
        // +X face corners
        {
            let (face, u, v) = direction_to_uv([1.0, -1.0, 1.0]);
            assert_eq!(face, 0);
            assert!((u - 0.0).abs() < 1e-12, "u={u}"); // -z/x = -1 → sc=-1 → u=0
            assert!((v - 1.0).abs() < 1e-12, "v={v}"); // -y/x = 1 → tc=1 → v=1
        }
        {
            let (face, u, v) = direction_to_uv([1.0, 1.0, -1.0]);
            assert_eq!(face, 0);
            assert!((u - 1.0).abs() < 1e-12); // -z/x = 1 → sc=1 → u=1
            assert!((v - 0.0).abs() < 1e-12); // -y/x = -1 → tc=-1 → v=0
        }
    }

    #[test]
    fn direction_to_uv_works_with_unnormalized() {
        // Scaling should not change the face or UV.
        let (f1, u1, v1) = direction_to_uv([2.0, 0.0, 0.0]);
        let (f2, u2, v2) = direction_to_uv([1.0, 0.0, 0.0]);
        assert_eq!(f1, f2);
        assert!((u1 - u2).abs() < 1e-12);
        assert!((v1 - v2).abs() < 1e-12);
    }

    // -- uv_to_direction ----------------------------------------------------

    #[test]
    fn uv_to_direction_face0_center_is_unit_plus_x() {
        let d = uv_to_direction(0, 0.5, 0.5);
        assert!((d[0] - 1.0).abs() < 1e-12, "x={}", d[0]);
        assert!(d[1].abs() < 1e-12, "y={}", d[1]);
        assert!(d[2].abs() < 1e-12, "z={}", d[2]);
    }

    #[test]
    fn uv_to_direction_face1_center_is_unit_minus_x() {
        let d = uv_to_direction(1, 0.5, 0.5);
        assert!((d[0] + 1.0).abs() < 1e-12);
        assert!(d[1].abs() < 1e-12);
        assert!(d[2].abs() < 1e-12);
    }

    #[test]
    fn uv_to_direction_all_faces_unit_vectors() {
        for face in 0..6 {
            let d = uv_to_direction(face, 0.5, 0.5);
            let len = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt();
            assert!(
                (len - 1.0).abs() < 1e-12,
                "face {face}: length = {len}, dir = {d:?}"
            );
        }
    }

    #[test]
    fn uv_to_direction_non_center_are_unit() {
        // Deterministic grid of UVs — no external dependency needed.
        let uvs: [f64; 7] = [0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0];
        for face in 0..6 {
            for &u in &uvs {
                for &v in &uvs {
                    let d = uv_to_direction(face, u, v);
                    let len = (d[0] * d[0] + d[1] * d[1] + d[2] * d[2]).sqrt();
                    assert!(
                        (len - 1.0).abs() < 1e-12,
                        "face {face} u={u} v={v}: length = {len}"
                    );
                }
            }
        }
    }

    #[test]
    #[should_panic(expected = "invalid face index 6")]
    fn uv_to_direction_panics_on_invalid_face() {
        uv_to_direction(6, 0.5, 0.5);
    }

    #[test]
    #[should_panic(expected = "invalid face index 99")]
    fn uv_to_direction_panics_on_large_face() {
        uv_to_direction(99, 0.5, 0.5);
    }

    // -- round-trip: direction → face+uv → direction -----------------------

    #[test]
    fn roundtrip_direction_to_uv_to_direction_is_identity() {
        let directions: [[f64; 3]; 6] = [
            [1.0, 0.0, 0.0],
            [-1.0, 0.0, 0.0],
            [0.0, 1.0, 0.0],
            [0.0, -1.0, 0.0],
            [0.0, 0.0, 1.0],
            [0.0, 0.0, -1.0],
        ];
        for dir in &directions {
            let (face, u, v) = direction_to_uv(*dir);
            let back = uv_to_direction(face, u, v);
            for comp in 0..3 {
                assert!(
                    (back[comp] - dir[comp]).abs() < 1e-12,
                    "dir={dir:?} → face={face} u={u} v={v} → {back:?}"
                );
            }
        }
    }

    #[test]
    fn roundtrip_diverse_directions() {
        // Hand-picked unit vectors hitting all faces, edges, and interiors.
        let dirs: [[f64; 3]; 30] = [
            // ±X face interior
            [1.0, 0.3, -0.4],
            [1.0, -0.7, 0.2],
            [-1.0, 0.1, 0.5],
            [-1.0, -0.6, -0.8],
            // ±Y face interior
            [0.2, 1.0, -0.3],
            [-0.8, 1.0, 0.1],
            [0.6, -1.0, -0.7],
            [-0.1, -1.0, 0.9],
            // ±Z face interior
            [0.3, -0.4, 1.0],
            [-0.5, 0.7, 1.0],
            [0.9, -0.2, -1.0],
            [-0.7, 0.3, -1.0],
            // Near face boundaries (still within faces)
            [1.0, 0.99, 0.0],
            [-1.0, 0.99, 0.0],
            [0.99, 1.0, 0.0],
            [0.0, 1.0, 0.99],
            // Exact diagonals — any face is valid, roundtrip must hold.
            [1.0, 1.0, 0.0],
            [-1.0, 1.0, 0.0],
            [1.0, 0.0, 1.0],
            [0.0, 1.0, 1.0],
            [1.0, -1.0, 0.0],
            [0.0, 1.0, -1.0],
            // Arbitrary unit vectors
            [0.57735, 0.57735, 0.57735],
            [0.267261, 0.534522, 0.801784],
            [0.801784, 0.267261, 0.534522],
            [0.534522, 0.801784, 0.267261],
            [-0.57735, -0.57735, -0.57735],
            [-0.267261, 0.534522, -0.801784],
            [
                std::f64::consts::FRAC_1_SQRT_2,
                std::f64::consts::FRAC_1_SQRT_2,
                0.0,
            ],
            [0.0, 0.0, 1.0],
        ];
        for &raw in &dirs {
            let len = (raw[0] * raw[0] + raw[1] * raw[1] + raw[2] * raw[2]).sqrt();
            let dir = [raw[0] / len, raw[1] / len, raw[2] / len];

            let (face, u, v) = direction_to_uv(dir);
            let back = uv_to_direction(face, u, v);

            // The reconstructed direction should be parallel to the original.
            let dot = dir[0] * back[0] + dir[1] * back[1] + dir[2] * back[2];
            assert!(
                (dot - 1.0).abs() < 1e-10,
                "dir={dir:?} → face={face} u={u} v={v} → back={back:?}, dot={dot}"
            );
        }
    }

    // -- equality tests (checksum-style) -----------------------------------

    #[test]
    fn known_direction_maps_to_expected_face() {
        // All 6 axis-aligned directions map to the correct face.
        let cases: [([f64; 3], usize); 6] = [
            ([1.0, 0.0, 0.0], 0),
            ([-1.0, 0.0, 0.0], 1),
            ([0.0, 1.0, 0.0], 2),
            ([0.0, -1.0, 0.0], 3),
            ([0.0, 0.0, 1.0], 4),
            ([0.0, 0.0, -1.0], 5),
        ];
        for (dir, expected) in &cases {
            let (face, _, _) = direction_to_uv(*dir);
            assert_eq!(
                face, *expected,
                "dir={dir:?} → face {face}, expected {expected}"
            );
        }
    }
}
