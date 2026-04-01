use serde::{Deserialize, Serialize};

// ── System parameters ──────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct JuliaParams {
    /// Real part of the constant c
    pub cx: f64,
    /// Imaginary part of the constant c
    pub cy: f64,
    pub zoom: f64,
    pub center_x: f64,
    pub center_y: f64,
    pub max_iter: u32,
}

impl Default for JuliaParams {
    fn default() -> Self {
        Self {
            cx: -0.7269,
            cy: 0.1889,
            zoom: 1.0,
            center_x: 0.0,
            center_y: 0.0,
            max_iter: 200,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct PeterDeJongParams {
    pub a: f64,
    pub b: f64,
    pub c: f64,
    pub d: f64,
    pub iterations: u64,
}

impl Default for PeterDeJongParams {
    fn default() -> Self {
        Self {
            a: 1.4,
            b: -2.3,
            c: 2.4,
            d: -2.1,
            iterations: 3_000_000,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct IkedaParams {
    /// Nonlinearity parameter — values near 0.918 produce rich chaos
    pub u: f64,
    pub iterations: u64,
    pub scale: f64,
    pub center_x: f64,
    pub center_y: f64,
}

impl Default for IkedaParams {
    fn default() -> Self {
        Self {
            u: 0.918,
            iterations: 1_500_000,
            scale: 1.0,
            center_x: 0.0,
            center_y: 0.0,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum SystemParams {
    Julia(JuliaParams),
    PeterDeJong(PeterDeJongParams),
    Ikeda(IkedaParams),
}

// ── Render config ──────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub enum RenderFamily {
    Pixel,
    Ascii,
    Density,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct RenderRequest {
    pub id: u64,
    pub width: u32,
    pub height: u32,
    pub system: SystemParams,
    pub family: RenderFamily,
    pub template: String,
}

// ── Worker protocol ────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub enum WorkerResponse {
    Ready,
    Complete { id: u64, elapsed_ms: f64 },
    Error { id: u64, message: String },
}

// ── Template registry (static metadata) ───────────────────────────────────

#[derive(Debug, Clone)]
pub struct TemplateInfo {
    pub id: &'static str,
    pub label: &'static str,
    pub family: RenderFamily,
}

pub fn templates_for(family: &RenderFamily) -> &'static [TemplateInfo] {
    match family {
        RenderFamily::Pixel => &[
            TemplateInfo { id: "neon_glow",       label: "Neon Glow",       family: RenderFamily::Pixel },
            TemplateInfo { id: "monochrome_ink",   label: "Monochrome Ink",  family: RenderFamily::Pixel },
        ],
        RenderFamily::Ascii => &[
            TemplateInfo { id: "terminal_noir",   label: "Terminal Noir",   family: RenderFamily::Ascii },
            TemplateInfo { id: "amber_monitor",   label: "Amber Monitor",   family: RenderFamily::Ascii },
        ],
        RenderFamily::Density => &[
            TemplateInfo { id: "cosmic_dust",     label: "Cosmic Dust",     family: RenderFamily::Density },
            TemplateInfo { id: "soft_bloom",      label: "Soft Bloom",      family: RenderFamily::Density },
        ],
    }
}

pub fn default_template(family: &RenderFamily) -> &'static str {
    templates_for(family)[0].id
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_request_roundtrip() {
        let req = RenderRequest {
            id: 42,
            width: 800,
            height: 600,
            system: SystemParams::Julia(JuliaParams::default()),
            family: RenderFamily::Pixel,
            template: "neon_glow".to_string(),
        };
        let json = serde_json::to_string(&req).unwrap();
        let decoded: RenderRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(decoded.id, 42);
        assert_eq!(decoded.width, 800);
    }

    #[test]
    fn worker_response_roundtrip() {
        let resp = WorkerResponse::Complete { id: 7, elapsed_ms: 123.4 };
        let json = serde_json::to_string(&resp).unwrap();
        let decoded: WorkerResponse = serde_json::from_str(&json).unwrap();
        if let WorkerResponse::Complete { id, elapsed_ms } = decoded {
            assert_eq!(id, 7);
            assert!((elapsed_ms - 123.4).abs() < 0.01);
        } else {
            panic!("wrong variant");
        }
    }
}
