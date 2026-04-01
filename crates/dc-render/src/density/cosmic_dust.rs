/// Cosmic Dust — deep space long-exposure aesthetic.
/// Empty space is near-black; dense regions bloom toward blue-white.
pub fn render(buf: &[f64]) -> Vec<u8> {
    let mut rgba = vec![0u8; buf.len() * 4];

    for (i, &t) in buf.iter().enumerate() {
        let (r, g, b) = if t == 0.0 {
            (2u8, 4u8, 10u8) // deep space background
        } else {
            let t = t.powf(0.55);
            let r = (t * t * 190.0 + (1.0 - t) * 15.0) as u8;
            let g = (t * 155.0 + (1.0 - t) * 25.0) as u8;
            let b = (t * 255.0 + (1.0 - t) * 90.0) as u8;
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
        // Background should be dark (all channels < 20)
        assert!(rgba[0] < 20 && rgba[1] < 20 && rgba[2] < 20);
    }
}
