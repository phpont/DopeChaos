pub mod ascii;
pub mod density;
pub mod pixel;

use dc_protocol::RenderFamily;

/// Dispatch: scalar buffer → RGBA pixel data.
/// Used for Pixel and Density families.
pub fn render_to_pixels(buf: &[f64], family: &RenderFamily, template: &str) -> Vec<u8> {
    match (family, template) {
        (RenderFamily::Pixel, "monochrome_ink") => pixel::monochrome_ink::render(buf),
        (RenderFamily::Density, "cosmic_dust")  => density::cosmic_dust::render(buf),
        (RenderFamily::Density, "soft_bloom")   => density::soft_bloom::render(buf),
        // Default pixel (Pixel/neon_glow + any unrecognised template)
        _ => pixel::neon_glow::render(buf),
    }
}

/// Dispatch: scalar buffer → (char grid, fg color css string, bg color css string).
pub fn render_to_ascii(
    buf: &[f64],
    template: &str,
) -> (Vec<char>, &'static str, &'static str) {
    match template {
        "amber_monitor" => ascii::amber_monitor::render(buf),
        _ => ascii::terminal_noir::render(buf),
    }
}
