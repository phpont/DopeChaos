// Density ramp from empty space to solid block — classic terminal aesthetic.
const CHARS: &[char] = &[' ', '.', ':', '-', '=', '+', 'x', '*', '#', '@'];
pub const FG: &str = "#b8b8b8";
pub const BG: &str = "#050505";

/// Maps each scalar value to a glyph from the density ramp.
/// Returns (chars, foreground_css, background_css).
pub fn render(buf: &[f64]) -> (Vec<char>, &'static str, &'static str) {
    let n = (CHARS.len() - 1) as f64;
    let chars = buf
        .iter()
        .map(|&t| {
            if t >= 1.0 {
                CHARS[0]
            } else {
                CHARS[(t * n) as usize]
            }
        })
        .collect();
    (chars, FG, BG)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_maps_to_space() {
        let (chars, _, _) = render(&[0.0]);
        assert_eq!(chars[0], ' ');
    }

    #[test]
    fn inside_maps_to_space() {
        let (chars, _, _) = render(&[1.0]);
        assert_eq!(chars[0], ' ');
    }

    #[test]
    fn output_length_matches_input() {
        let buf: Vec<f64> = (0..50).map(|i| i as f64 / 50.0).collect();
        let (chars, _, _) = render(&buf);
        assert_eq!(chars.len(), buf.len());
    }
}
