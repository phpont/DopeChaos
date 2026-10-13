use chaos_core::{LorenzPair, PairStates, Parameters, State, StepError, rk4_step};

const INITIAL: PairStates = PairStates {
    reference: State {
        x: 1.0,
        y: 1.0,
        z: 1.0,
    },
    perturbed: State {
        x: 1.000_000_001,
        y: 1.0,
        z: 1.0,
    },
};

const DT: f64 = 0.01;

fn new_pair() -> LorenzPair {
    LorenzPair::new(INITIAL, Parameters::default(), DT).expect("valid initial conditions")
}

#[test]
fn starts_at_initial_conditions() {
    let pair = new_pair();
    assert_eq!(pair.states(), INITIAL);
}

#[test]
fn matches_independent_integrations() {
    let mut pair = new_pair();
    let params = Parameters::default();

    let mut reference = INITIAL.reference;
    let mut perturbed = INITIAL.perturbed;

    for _ in 0..200 {
        reference = rk4_step(reference, params, DT).unwrap();
        perturbed = rk4_step(perturbed, params, DT).unwrap();

        let expected = PairStates {
            reference,
            perturbed,
        };

        assert_eq!(pair.step(), Ok(expected));
        assert_eq!(pair.states(), expected);
    }
}

#[test]
fn reset_restores_and_replays_initial_conditions() {
    let mut pair = new_pair();
    let first = pair.step().unwrap();

    for _ in 0..100 {
        pair.step().unwrap();
    }

    assert_ne!(pair.states(), INITIAL);

    pair.reset();

    assert_eq!(pair.states(), INITIAL);
    assert_eq!(pair.step(), Ok(first));
}

#[test]
fn identical_initial_conditions_remain_identical() {
    let initial = PairStates {
        reference: INITIAL.reference,
        perturbed: INITIAL.reference,
    };

    let mut pair = LorenzPair::new(initial, Parameters::default(), DT).unwrap();

    for _ in 0..200 {
        let states = pair.step().unwrap();
        assert_eq!(states.reference, states.perturbed);
    }
}

#[test]
fn rejects_invalid_timesteps() {
    for dt in [0.0, -0.01, f64::NAN, f64::INFINITY] {
        assert_eq!(
            LorenzPair::new(INITIAL, Parameters::default(), dt).err(),
            Some(StepError::InvalidStep)
        );
    }
}

#[test]
fn rejects_nonfinite_initial_conditions() {
    let invalid = State {
        x: f64::NAN,
        ..INITIAL.reference
    };

    let cases = [
        PairStates {
            reference: invalid,
            perturbed: INITIAL.perturbed,
        },
        PairStates {
            reference: INITIAL.reference,
            perturbed: invalid,
        },
    ];

    for initial in cases {
        assert_eq!(
            LorenzPair::new(initial, Parameters::default(), DT).err(),
            Some(StepError::NonFiniteState)
        );
    }
}

#[test]
fn rejects_nonfinite_parameters() {
    let params = Parameters {
        sigma: f64::INFINITY,
        ..Parameters::default()
    };

    assert_eq!(
        LorenzPair::new(INITIAL, params, DT).err(),
        Some(StepError::NonFiniteParameters)
    );
}

#[test]
fn step_is_atomic_when_either_trajectory_fails() {
    let extreme = State {
        x: f64::MAX,
        y: f64::MAX,
        z: f64::MAX,
    };

    let cases = [
        PairStates {
            reference: extreme,
            perturbed: INITIAL.perturbed,
        },
        PairStates {
            reference: INITIAL.reference,
            perturbed: extreme,
        },
    ];

    for initial in cases {
        let mut pair = LorenzPair::new(initial, Parameters::default(), DT).unwrap();

        assert_eq!(pair.step(), Err(StepError::NonFiniteResult));
        assert_eq!(pair.states(), initial);
    }
}
