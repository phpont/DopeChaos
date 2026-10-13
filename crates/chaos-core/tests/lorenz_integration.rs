use chaos_core::{Parameters, State, StepError, derivative, rk4_step};

const INITIAL: State = State {
    x: 1.0,
    y: 1.0,
    z: 1.0,
};

// Independent numerical reference, computed with SciPy 1.17.0:
// solve_ivp(method="DOP853", rtol=3e-14, atol=1e-14,
//           max_step=0.002), evaluated at t=0.1.
const REFERENCE_T_01: State = State {
    x: 2.1331076186445137,
    y: 4.471420177185414,
    z: 1.1138988857786365,
};

fn integrate(steps: usize, dt: f64) -> State {
    let mut state = INITIAL;

    for _ in 0..steps {
        state = rk4_step(state, Parameters::default(), dt).expect("valid integration step");
    }

    state
}

fn max_error(actual: State, expected: State) -> f64 {
    (actual.x - expected.x)
        .abs()
        .max((actual.y - expected.y).abs())
        .max((actual.z - expected.z).abs())
}

#[test]
fn classical_derivative() {
    let result = derivative(INITIAL, Parameters::default());

    assert_eq!(result.x, 0.0);
    assert_eq!(result.y, 26.0);
    assert!((result.z + 5.0 / 3.0).abs() < 1e-12);
}

#[test]
fn origin_remains_at_equilibrium() {
    let origin = State {
        x: 0.0,
        y: 0.0,
        z: 0.0,
    };

    assert_eq!(rk4_step(origin, Parameters::default(), 0.01), Ok(origin));
}

#[test]
fn nonzero_equilibria_have_negligible_derivatives() {
    let params = Parameters::default();
    let coordinate = (params.beta * (params.rho - 1.0)).sqrt();

    for sign in [-1.0, 1.0] {
        let state = State {
            x: sign * coordinate,
            y: sign * coordinate,
            z: params.rho - 1.0,
        };

        let rate = derivative(state, params);
        let zero = State {
            x: 0.0,
            y: 0.0,
            z: 0.0,
        };

        assert!(max_error(rate, zero) < 1e-12);
    }
}

#[test]
fn matches_independent_short_horizon_reference() {
    let actual = integrate(20, 0.005);
    let error = max_error(actual, REFERENCE_T_01);

    assert!(error < 1e-6, "RK4 reference error: {error:e}");
}

#[test]
fn fourth_order_convergence() {
    let coarse = integrate(10, 0.01);
    let fine = integrate(20, 0.005);

    let coarse_error = max_error(coarse, REFERENCE_T_01);
    let fine_error = max_error(fine, REFERENCE_T_01);

    assert!(fine_error > 0.0);
    assert!(
        coarse_error / fine_error > 12.0,
        "Unexpected convergence: coarse={coarse_error:e}, fine={fine_error:e}"
    );
}

#[test]
fn identical_inputs_are_reproducible() {
    assert_eq!(integrate(100, 0.01), integrate(100, 0.01));
}

#[test]
fn rejects_invalid_timesteps() {
    for dt in [0.0, -0.01, f64::NAN, f64::INFINITY] {
        assert_eq!(
            rk4_step(INITIAL, Parameters::default(), dt),
            Err(StepError::InvalidStep)
        );
    }
}

#[test]
fn rejects_nonfinite_inputs() {
    let invalid_state = State {
        x: f64::NAN,
        ..INITIAL
    };

    assert_eq!(
        rk4_step(invalid_state, Parameters::default(), 0.01),
        Err(StepError::NonFiniteState)
    );

    let invalid_params = Parameters {
        beta: f64::INFINITY,
        ..Parameters::default()
    };

    assert_eq!(
        rk4_step(INITIAL, invalid_params, 0.01),
        Err(StepError::NonFiniteParameters)
    );
}

#[test]
fn detects_nonfinite_result() {
    let extreme = State {
        x: f64::MAX,
        y: f64::MAX,
        z: f64::MAX,
    };

    assert_eq!(
        rk4_step(extreme, Parameters::default(), 1.0),
        Err(StepError::NonFiniteResult)
    );
}
