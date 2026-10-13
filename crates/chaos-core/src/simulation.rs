use crate::{Parameters, State, StepError, rk4_step};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct PairStates {
    pub reference: State,
    pub perturbed: State,
}

#[derive(Debug)]
pub struct LorenzPair {
    initial: PairStates,
    current: PairStates,
    params: Parameters,
    dt: f64,
}

impl LorenzPair {
    pub fn new(initial: PairStates, params: Parameters, dt: f64) -> Result<Self, StepError> {
        if !dt.is_finite() || dt <= 0.0 {
            return Err(StepError::InvalidStep);
        }

        if !initial.reference.is_finite() || !initial.perturbed.is_finite() {
            return Err(StepError::NonFiniteState);
        }

        if !params.is_finite() {
            return Err(StepError::NonFiniteParameters);
        }

        Ok(Self {
            initial,
            current: initial,
            params,
            dt,
        })
    }

    pub fn states(&self) -> PairStates {
        self.current
    }

    pub fn step(&mut self) -> Result<PairStates, StepError> {
        let reference = rk4_step(self.current.reference, self.params, self.dt)?;
        let perturbed = rk4_step(self.current.perturbed, self.params, self.dt)?;

        self.current = PairStates {
            reference,
            perturbed,
        };

        Ok(self.current)
    }

    pub fn reset(&mut self) {
        self.current = self.initial;
    }
}
