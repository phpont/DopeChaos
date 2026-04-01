use std::f64::consts::TAU;

/// Neon Glow — cycling RGB palette on a black field.
/// Inside-set points are pure black; escape regions cycle through vivid hues.
pub fn render(buf: &[f64]) -> Vec<u8> {
    let mut rgba = vec![0u8; buf.len() * 4];

    for (i, &t) in buf.iter().enumerate() {
        let (r, g, b) = if t >= 1.0 {
            (0u8, 0u8, 0u8)
        } else {
            // Gamma lift for visual punch, then map to hue cycle
            let t = t.powf(0.45);
            let angle = t * TAU * 2.5;
            let r = ((0.5 + 0.5 * angle.sin()) * 255.0) as u8;
            let g = ((0.5 + 0.5 * (angle + 2.094).sin()) * 255.0) as u8;
            let b = ((0.5 + 0.5 * (angle + 4.189).sin()) * 255.0) as u8;
            (r, g, b)
        };

        let base = i * 4;
        rgba[base]     = r;
        rgba[base + 1] = g;
        rgba[base + 2] = b;
        rgba[base + 3] = 255;
    }

    rgba
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn output_length() {
        let buf = vec![0.0, 0.5, 1.0];
        assert_eq!(render(&buf).len(), 12);
    }

    #[test]
    fn inside_is_black() {
        let rgba = render(&[1.0]);
        assert_eq!(&rgba[..4], &[0, 0, 0, 255]);
    }
}
