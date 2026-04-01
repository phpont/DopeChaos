use dc_protocol::IkedaParams;

/// Returns a log-normalized density buffer [0.0, 1.0].
pub fn scalar_buffer(width: u32, height: u32, p: &IkedaParams) -> Vec<f64> {
    let counts = density_counts(width, height, p);
    let max    = counts.iter().copied().max().unwrap_or(1) as f64;

    if max == 0.0 {
        return vec![0.0; (width * height) as usize];
    }

    counts
        .iter()
        .map(|&c| if c == 0 { 0.0 } else { (c as f64).ln() / max.ln() })
        .collect()
}

fn density_counts(width: u32, height: u32, p: &IkedaParams) -> Vec<u32> {
    let mut counts = vec![0u32; (width * height) as usize];
    let mut x = 0.1f64;
    let mut y = 0.1f64;

    for _ in 0..500 {
        (x, y) = step(x, y, p.u);
    }

    let half_w = width as f64 * 0.5;
    let half_h = height as f64 * 0.5;

    // Attractor for u≈0.9 is centered around (3.5, 0).
    // half_range=10/scale gives the visible window half-size.
    let x_center  = 3.5;
    let half_range = 10.0 / p.scale;

    for _ in 0..p.iterations {
        (x, y) = step(x, y, p.u);

        let px = ((x - x_center + p.center_x * half_range) / half_range * half_w + half_w) as i32;
        let py = (( y           + p.center_y * half_range) / half_range * half_h + half_h) as i32;

        if (0..width as i32).contains(&px) && (0..height as i32).contains(&py) {
            let idx = (py as u32 * width + px as u32) as usize;
            counts[idx] = counts[idx].saturating_add(1);
        }
    }

    counts
}

#[inline]
fn step(x: f64, y: f64, u: f64) -> (f64, f64) {
    let t = 0.4 - 6.0 / (1.0 + x * x + y * y);
    (
        1.0 + u * (x * t.cos() - y * t.sin()),
        u * (x * t.sin() + y * t.cos()),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn produces_nonzero_output() {
        let p = IkedaParams {
            iterations: 100_000,
            ..Default::default()
        };
        let buf = scalar_buffer(200, 200, &p);
        assert!(buf.iter().any(|&v| v > 0.0), "ikeda should produce visible points");
    }

    #[test]
    fn buffer_values_in_range() {
        let p = IkedaParams {
            iterations: 50_000,
            ..Default::default()
        };
        let buf = scalar_buffer(64, 64, &p);
        for v in &buf {
            assert!(*v >= 0.0 && *v <= 1.0, "out of range: {v}");
        }
    }
}
