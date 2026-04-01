// Organic, low-contrast glyph ramp that feels like a phosphor display.
const CHARS: &[char] = &[' ', '·', '·', ':', '¦', '|', 'i', 'l', 'I', 'H'];
pub const FG: &str = "#e8a020";
pub const BG: &str = "#080400";

/// Amber phosphor monitor aesthetic — warm, slightly bloomy glyph render.
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
    fn output_length_matches_input() {
        let buf = vec![0.0, 0.25, 0.5, 0.75, 1.0];
        let (chars, _, _) = render(&buf);
        assert_eq!(chars.len(), 5);
    }
}
