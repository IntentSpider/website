# IntentSpider Evaluation Results

## Phase 0: Instrumentation & Validity (FAILED)

| ID | Name | Result | Verified Fact |
|---|---|---|---|
| E01 | Mechanism Audit | PASS | 12/12 Mechanisms located in `version1/` |
| E02 | Determinism | FAIL | 59,734 / 60,000 mismatches on identical seed |
| E03 | Generator Validation | FAIL | Only D1-B and D1-G recorded; others missing |
| E04 | Split Construction | FAIL | Seed 1: n_coldstart = 0 |
| E05 | Metric Unit Tests | FAIL | Lacks M3, M5, M6, M9 tests |
| E06 | Valence Baseline | BLOCKED | Dependent on E03 |
| E07 | Parameter Registry | FAIL | Missing 32/39 canonical parameters; registry incomplete |

## Phase 1: Baseline & System Runs (NOT_EVALUATED)
- **Status**: BLOCKED_BY_PHASE0
- **Note**: Technical artifacts produced during clean-rebuild are quarantined in `evidence/quarantine/` and are NOT considered valid results due to Phase 0 gate failure.

## Phase 2: Hypothesis Testing (NOT_EVALUATED)
- **Hypotheses H1–H8**: All NOT_EVALUATED.
- **Reason**: Dependencies on Phase 1 records were never met.

## Data Availability (D2)
- **Status**: DATA_UNAVAILABLE. Participant corpus D2 was not supplied for E16/E47.
