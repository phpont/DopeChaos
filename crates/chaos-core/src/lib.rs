#![forbid(unsafe_code)]

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct State {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Parameters {
    pub sigma: f64,
    pub rho: f64,
    pub beta: f64,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classical_parameters_derivative() {
        let state = State {
            x: 1.0,
            y: 1.0,
            z: 1.0,
        };

        let result = derivative(state, Parameters::default());

        assert_eq!(result.x, 0.0);
        assert_eq!(result.y, 26.0);
        assert!((result.z + 5.0 / 3.0).abs() < 1e-12);
    }
}
