use dc_protocol::PeterDeJongParams;

/// Returns a log-normalized density buffer [0.0, 1.0].
/// 0.0 = no points landed here; 1.0 = maximum density cell.
pub fn scalar_buffer(width: u32, height: u32, p: &PeterDeJongParams) -> Vec<f64> {
    let counts = density_counts(width, height, p);
    let max = counts.iter().copied().max().unwrap_or(1) as f64;

    if max == 0.0 {
        return vec![0.0; (width * height) as usize];
    }

    counts
        .iter()
        .map(|&c| if c == 0 { 0.0 } else { (c as f64).ln() / max.ln() })
        .collect()
}

fn density_counts(width: u32, height: u32, p: &PeterDeJongParams) -> Vec<u32> {
    let mut counts = vec![0u32; (width * height) as usize];
    let mut x = 0.1f64;
    let mut y = 0.1f64;

    // Burn-in to reach the attractor before accumulating
    for _ in 0..500 {
        (x, y) = step(x, y, p);
    }

    let iw = width as f64;
    let ih = height as f64;

    for _ in 0..p.iterations {
        (x, y) = step(x, y, p);

        // Attractor is naturally bounded in [-2, 2] for reasonable params
        let px = ((x + 2.0) * 0.25 * iw) as i32;
        let py = ((y + 2.0) * 0.25 * ih) as i32;

        if (0..width as i32).contains(&px) && (0..height as i32).contains(&py) {
            let idx = (py as u32 * width + px as u32) as usize;
            counts[idx] = counts[idx].saturating_add(1);
        }
    }

    counts
}

#[inline]
fn step(x: f64, y: f64, p: &PeterDeJongParams) -> (f64, f64) {
    (
        (p.a * y).sin() - (p.b * x).cos(),
        (p.c * x).sin() - (p.d * y).cos(),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn produces_nonzero_output() {
        let p = PeterDeJongParams {
            iterations: 50_000,
            ..Default::default()
        };
        let buf = scalar_buffer(64, 64, &p);
        assert!(buf.iter().any(|&v| v > 0.0), "should have nonzero density");
    }

    #[test]
    fn buffer_values_in_range() {
        let p = PeterDeJongParams {
            iterations: 50_000,
            ..Default::default()
        };
        let buf = scalar_buffer(64, 64, &p);
        for v in &buf {
            assert!(*v >= 0.0 && *v <= 1.0, "value out of [0,1]: {v}");
        }
    }

    #[test]
    fn step_is_bounded() {
        let p = PeterDeJongParams::default();
        let mut x = 0.1;
        let mut y = 0.1;
        for _ in 0..10_000 {
            (x, y) = step(x, y, &p);
            assert!(x.abs() <= 3.0 && y.abs() <= 3.0, "attractor escaped bounds");
        }
    }
}
