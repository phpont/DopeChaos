use dc_protocol::JuliaParams;

/// Computes a normalized scalar buffer [0.0, 1.0] for the Julia set.
/// 1.0 means the point is inside the set; lower values encode the smooth escape time.
pub fn scalar_buffer(width: u32, height: u32, p: &JuliaParams) -> Vec<f64> {
    let w = width as f64;
    let h = height as f64;
    let aspect = w / h;

    (0..height)
        .flat_map(|py| {
            (0..width).map(move |px| {
                let x = (px as f64 / w - 0.5) * 2.0 * aspect / p.zoom + p.center_x;
                let y = (py as f64 / h - 0.5) * 2.0 / p.zoom + p.center_y;
                escape_time(x, y, p.cx, p.cy, p.max_iter)
            })
        })
        .collect()
}

/// Returns smooth normalized escape time in [0.0, 1.0].
/// Uses the "continuous dwell" formula to avoid hard banding.
fn escape_time(x0: f64, y0: f64, cx: f64, cy: f64, max_iter: u32) -> f64 {
    let mut zr = x0;
    let mut zi = y0;

    for i in 0..max_iter {
        let zr2 = zr * zr;
        let zi2 = zi * zi;

        if zr2 + zi2 > 4.0 {
            let log_zn = (zr2 + zi2).ln() * 0.5;
            let nu = (log_zn / std::f64::consts::LN_2).ln() / std::f64::consts::LN_2;
            return ((i as f64 + 1.0 - nu) / max_iter as f64).clamp(0.0, 0.9999);
        }

        let tmp = zr2 - zi2 + cx;
        zi = 2.0 * zr * zi + cy;
        zr = tmp;
    }

    1.0 // inside the set
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn origin_is_inside_default_set() {
        let p = JuliaParams::default();
        // z=0 iterates as 0 → c → c²+c → ... which stays bounded for these default params
        let t = escape_time(0.0, 0.0, p.cx, p.cy, p.max_iter);
        assert_eq!(t, 1.0, "origin should be inside the set");
    }

    #[test]
    fn far_point_escapes_immediately() {
        let p = JuliaParams::default();
        let t = escape_time(100.0, 0.0, p.cx, p.cy, p.max_iter);
        assert!(t < 1.0, "point at magnitude 100 should escape");
    }

    #[test]
    fn buffer_length_matches_dimensions() {
        let p = JuliaParams::default();
        let buf = scalar_buffer(64, 48, &p);
        assert_eq!(buf.len(), 64 * 48);
    }

    #[test]
    fn buffer_values_in_range() {
        let p = JuliaParams::default();
        let buf = scalar_buffer(64, 48, &p);
        for v in &buf {
            assert!(*v >= 0.0 && *v <= 1.0, "value out of [0,1]: {v}");
        }
    }
}
