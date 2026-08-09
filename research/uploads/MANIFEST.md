# IntentSpider Delivery Manifest

**Commit**: `853b2b842fee9b89f2b4abcc3e17308e63ec197a`
**Date**: 2026-08-08

## Deliverables

| File | Description |
|---|---|
| `STATUS.md` | High-level campaign status summary. |
| `RESULTS.md` | Detailed experiment results and Phase 0 failure verdicts. |
| `BLOCKERS.md` | In-depth breakdown of critical execution failures. |
| `DEVIATIONS.md` | Documentation of schema changes and protocol amendments. |
| `REPRODUCTION.md` | Guide to verifying audit findings in the target environment. |
| `phase0_gate.csv` | Summary of Phase 0 experiment statuses. |
| `experiment_status.csv` | Full registry of all 56 experiments (E01–E56). |
| `hypothesis_status.csv` | Status of all 8 hypotheses (H1–H8). |
| `artifact_checksums.csv` | Integrity registry for all delivered files. |

## Evidence Directory (`evidence/`)
Contains validated results from the clean-rebuild of Phase 0.
- `E01_mechanism_audit.csv`
- `E02_determinism.csv`
- `E03_centrality_spread.csv`
- `E03_generator_validation.csv`
- `E04_splits.csv`
- `E05_metric_unit_tests.csv`
- `E06_cadence_baseline.csv`
- `E07_retired_symbol_check.csv`
- `params.csv`

## Quarantine Directory (`evidence/quarantine/`)
Contains 80+ records produced by Phase 1 variants (B0–B6) during clean-rebuild. These are explicitly excluded from the final results due to Phase 0 gate failure.
