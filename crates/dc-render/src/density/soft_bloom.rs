/// Soft Bloom — warm crimson/rose gradient with atmospheric glow.
/// Dense regions burn toward white through a red-orange path.
pub fn render(buf: &[f64]) -> Vec<u8> {
    let mut rgba = vec![0u8; buf.len() * 4];

    for (i, &t) in buf.iter().enumerate() {
        let (r, g, b) = if t == 0.0 {
            (6u8, 2u8, 5u8) // deep purple-black
        } else {
            let t = t.powf(0.5);
            let r = (t * 255.0) as u8;
            let g = (t * t * 160.0) as u8;
            let b = ((1.0 - t) * t * 120.0) as u8;
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
        assert_eq!(render(&[0.0, 0.5, 1.0]).len(), 12);
    }

    #[test]
    fn zero_density_is_dark() {
        let rgba = render(&[0.0]);
        assert!(rgba[0] < 15 && rgba[1] < 15 && rgba[2] < 15);
    }
}
