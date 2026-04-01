/// Monochrome Ink — white paper aesthetic.
/// Interior of the set is solid white; exterior fades to deep black with high contrast.
pub fn render(buf: &[f64]) -> Vec<u8> {
    let mut rgba = vec![0u8; buf.len() * 4];

    for (i, &t) in buf.iter().enumerate() {
        let v = if t >= 1.0 {
            255u8 // inside = white (ink on paper inversion)
        } else {
            // High-contrast curve that keeps deep exterior near black
            let t = 1.0 - t.powf(0.35);
            (t * 235.0) as u8
        };

        let base = i * 4;
        rgba[base]     = v;
        rgba[base + 1] = v;
        rgba[base + 2] = v;
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
    fn inside_is_white() {
        let rgba = render(&[1.0]);
        assert_eq!(&rgba[..4], &[255, 255, 255, 255]);
    }
}
