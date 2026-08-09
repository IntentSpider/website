# Evaluation Blockers

## Critical Path Blockers

### 1. Non-Deterministic Engine (E02)
- **Status**: Critical Failure.
- **Evidence**: `evidence/E02_determinism.csv`
- **Detail**: Running variant B4 twice with `seed=1` resulted in 59,734 mismatches out of 60,000 predictions. Scientific reproducibility is impossible under current implementation.

### 2. Incomplete Synthetic Generation (E03)
- **Status**: Structural Failure.
- **Evidence**: `evidence/E03_generator_validation.csv`
- **Detail**: The generator only records D1-B (rejection/context) and D1-G (reconvergence). It fails to produce D1-A, C, D, E, or F data points required for valence-conflict, shock-event, and distractor nearness validation.

### 3. Sampling Insufficiency (E04)
- **Status**: Statistical Failure.
- **Evidence**: `evidence/E04_splits.csv`
- **Detail**: The chronological 90/10 split for Seed 1 resulted in 0 cold-start held-out sequences (n_coldstart=0). Minimum power requirements for H1/H3 cannot be met.

### 4. Metric Harness Gaps (E05)
- **Status**: Validity Failure.
- **Evidence**: `evidence/E05_metric_unit_tests.csv`
- **Detail**: The unit test harness for metrics lacks coverage for M3 (Suppression correctness), M5 (Sustained engagement), M6 (Shock rates), and M9 (Instrumentation cost).

### 5. Parameter Registry Incompleteness (E07)
- **Status**: Compliance Failure.
- **Evidence**: `evidence/params.csv`
- **Detail**: The registry contains only 7 parameters using noncanonical aliases (e.g., `eta_tf` instead of `eta_TF`). It is missing 32 of the 39 parameters required by the protocol (e.g., `tau_seed`, `gamma`, `beta1-3`, `emotional engine suite`).

## Data Blockers

### 6. Participant Corpus (D2)
- **Status**: DATA_UNAVAILABLE.
- **Detail**: D2 streams required for E16 and cross-participant replication were not provided in the environment.
