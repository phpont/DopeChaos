#[derive(Debug, Clone, Copy, PartialEq)]
pub struct State {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl State {
    pub(crate) fn is_finite(self) -> bool {
        self.x.is_finite() && self.y.is_finite() && self.z.is_finite()
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Parameters {
    pub sigma: f64,
    pub rho: f64,
    pub beta: f64,
}

impl Parameters {
    pub(crate) fn is_finite(self) -> bool {
        self.sigma.is_finite() && self.rho.is_finite() && self.beta.is_finite()
    }
}

impl Default for Parameters {
    fn default() -> Self {
        Self {
            sigma: 10.0,
            rho: 28.0,
            beta: 8.0 / 3.0,
        }
    }
}

pub fn derivative(state: State, params: Parameters) -> State {
    State {
        x: params.sigma * (state.y - state.x),
        y: state.x * (params.rho - state.z) - state.y,
        z: state.x * state.y - params.beta * state.z,
    }
}
