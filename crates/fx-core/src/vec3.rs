/// Minimal 3D vector with zero dependencies — x, y, z plus dot, cross,
/// normalize, length. Used by the refraction engine and lens shader math.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Vec3 {
    pub const ZERO: Self = Self {
        x: 0.0,
        y: 0.0,
        z: 0.0,
    };

    pub const fn new(x: f64, y: f64, z: f64) -> Self {
        Self { x, y, z }
    }

    pub fn dot(&self, other: &Vec3) -> f64 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }

    pub fn cross(&self, other: &Vec3) -> Vec3 {
        Vec3 {
            x: self.y * other.z - self.z * other.y,
            y: self.z * other.x - self.x * other.z,
            z: self.x * other.y - self.y * other.x,
        }
    }

    pub fn length(&self) -> f64 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }

    /// Returns a normalized copy. Zero-length vectors silently return the
    /// zero vector (no NaN propagation from division by zero).
    pub fn normalize(&self) -> Vec3 {
        let len = self.length();
        if len > 0.0 {
            Vec3 {
                x: self.x / len,
                y: self.y / len,
                z: self.z / len,
            }
        } else {
            *self
        }
    }

    pub fn negate(&self) -> Vec3 {
        Vec3 {
            x: -self.x,
            y: -self.y,
            z: -self.z,
        }
    }
}

impl std::ops::Add<Vec3> for Vec3 {
    type Output = Vec3;

    fn add(self, rhs: Vec3) -> Vec3 {
        Vec3 {
            x: self.x + rhs.x,
            y: self.y + rhs.y,
            z: self.z + rhs.z,
        }
    }
}

impl std::ops::Sub<Vec3> for Vec3 {
    type Output = Vec3;

    fn sub(self, rhs: Vec3) -> Vec3 {
        Vec3 {
            x: self.x - rhs.x,
            y: self.y - rhs.y,
            z: self.z - rhs.z,
        }
    }
}

impl std::ops::Mul<f64> for Vec3 {
    type Output = Vec3;

    fn mul(self, rhs: f64) -> Vec3 {
        Vec3 {
            x: self.x * rhs,
            y: self.y * rhs,
            z: self.z * rhs,
        }
    }
}

impl std::ops::Neg for Vec3 {
    type Output = Vec3;

    fn neg(self) -> Vec3 {
        self.negate()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dot_orthogonal_is_zero() {
        let a = Vec3::new(1.0, 0.0, 0.0);
        let b = Vec3::new(0.0, 1.0, 0.0);
        assert_eq!(a.dot(&b), 0.0);
    }

    #[test]
    fn dot_parallel_is_product_of_lengths() {
        let a = Vec3::new(2.0, 0.0, 0.0);
        let b = Vec3::new(3.0, 0.0, 0.0);
        assert_eq!(a.dot(&b), 6.0);
    }

    #[test]
    fn cross_orthogonal_unit_axes() {
        let x = Vec3::new(1.0, 0.0, 0.0);
        let y = Vec3::new(0.0, 1.0, 0.0);
        assert_eq!(x.cross(&y), Vec3::new(0.0, 0.0, 1.0));
        assert_eq!(y.cross(&x), Vec3::new(0.0, 0.0, -1.0));
    }

    #[test]
    fn length_unit_vector_is_one() {
        assert!((Vec3::new(1.0, 0.0, 0.0).length() - 1.0).abs() < 1e-12);
    }

    #[test]
    fn normalize_preserves_direction() {
        let v = Vec3::new(3.0, 4.0, 0.0);
        let n = v.normalize();
        assert!((n.length() - 1.0).abs() < 1e-12);
        // Check direction: n should be parallel to v
        let cross = v.cross(&n);
        assert!(cross.length() < 1e-12);
    }

    #[test]
    fn normalize_zero_vector_is_zero() {
        let z = Vec3::new(0.0, 0.0, 0.0);
        assert_eq!(z.normalize(), z);
    }

    #[test]
    fn negate_flips_signs() {
        let v = Vec3::new(1.0, -2.0, 3.0);
        assert_eq!(v.negate(), Vec3::new(-1.0, 2.0, -3.0));
    }
}
