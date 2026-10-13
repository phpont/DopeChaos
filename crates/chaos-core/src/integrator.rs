use crate::lorenz::{Parameters, State, derivative};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StepError {
    InvalidStep,
    NonFiniteState,
    NonFiniteParameters,
    NonFiniteResult,
}

fn add_scaled(state: State, rate: State, scale: f64) -> State {
    State {
        x: state.x + rate.x * scale,
        y: state.y + rate.y * scale,
        z: state.z + rate.z * scale,
    }
}

/// Advances the Lorenz system by one fixed RK4 step.
///
/// The caller controls the timestep. This method does not estimate
/// numerical error or guarantee accuracy over long chaotic trajectories.
pub fn rk4_step(state: State, params: Parameters, dt: f64) -> Result<State, StepError> {
    if !dt.is_finite() || dt <= 0.0 {
        return Err(StepError::InvalidStep);
    }

    if !state.is_finite() {
        return Err(StepError::NonFiniteState);
    }

    if !params.is_finite() {
        return Err(StepError::NonFiniteParameters);
    }

    let k1 = derivative(state, params);
    let k2 = derivative(add_scaled(state, k1, dt * 0.5), params);
    let k3 = derivative(add_scaled(state, k2, dt * 0.5), params);
    let k4 = derivative(add_scaled(state, k3, dt), params);

    let average = State {
        x: (k1.x + 2.0 * k2.x + 2.0 * k3.x + k4.x) / 6.0,
        y: (k1.y + 2.0 * k2.y + 2.0 * k3.y + k4.y) / 6.0,
        z: (k1.z + 2.0 * k2.z + 2.0 * k3.z + k4.z) / 6.0,
    };

    let next = add_scaled(state, average, dt);

    if !next.is_finite() {
        return Err(StepError::NonFiniteResult);
    }

    Ok(next)
}
