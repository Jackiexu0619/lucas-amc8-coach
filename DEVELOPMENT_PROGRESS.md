# Lucas AMC8 Coach — Development Progress

Last updated: 2026-10-25

## Product goal

Keep the learning loop simple and evidence-based:
1. Weekend: one complete 25-question AMC8 mock.
2. Diagnose from actual answers, guesses, skips, time and error evidence.
3. Weekdays: no more than three targeted questions per day.
4. Retest weak methods with new questions and verify transfer.

## Current production baseline

- Production branch: `main`
- Production page version: `v0.6.5.14`
- Reference product: https://luminamath.top/student
- Preserve the current locked/printed weekend paper and all existing learner/cloud records.
- AI-created transfer questions remain separate from official AMC8 weekend mocks and official diagnostic scores.

## This work branch: `fix/weekly-weakness-mainline-v06514`

### Confirmed defect

The current production path was not fully using the reviewed weekly weakness selector:
- `index.html` contained duplicate same-named `buildPrintableMockCore()` declarations.
- The later `coach_v064.js` override controlled the real personalized-mock entry point.
- A change to the earlier inline function alone could not repair the live selector.

### Implemented on the branch

- Added `coach_mock_assembly_v06514.js`, a pure, testable position-preserving selector.
- Routed the actual `coach_v064.js` personalized-mock override through the selector.
- Added method/group/skill-aware scoring at the existing seven personalized positions only.
- Kept the original Q1–Q25 positions, unique-question requirement, cross-year balance, reserved full-year diagnostic years, and recent/attempted-question avoidance with explicit fallback metadata.
- Added traceable weakness matches and fallback reasons to new mock metadata.
- Renamed the shadowed inline legacy declaration so only one active `buildPrintableMockCore()` remains.
- Did not modify the already locked/printed paper, answer key, historical attempts, or cloud records.

### Automated validation

- Mock assembly workflow: PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40109403103
- Learning closure workflow: PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40109349102
- Install-engine workflow: PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40109403029

### Not yet accepted / release gates

1. Review the branch diff against current `main`.
2. Fresh-browser verification that the new-paper flow calls the reviewed selector and displays correct match metadata.
3. Confirm the locked existing paper remains unchanged in the browser.
4. Safe Supabase upload/download round-trip using an isolated test record; no production data clearing.
5. Confirm GitHub Pages deployment and the actual online version after merge.

## Next priority

Finish browser-level integration review, then open/review the release PR. Do not claim the production site has the fix until it is merged and deployed.
