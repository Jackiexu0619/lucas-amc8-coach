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
- Production page version: `v0.6.5.17` (Pages deployment and deployed-browser smoke confirmed successful on 2026-10-25); release candidate `v0.6.5.18` is on branch `fix/learning-loop-integration-v06518` and is not yet deployed.

## v0.6.5.18 release candidate — learning-loop integration fixes

- Confirmed by script load-order inspection: the final coach_learning_closure_v06514.js override of buildArchiveMockCore() discarded the filtered archive and reserved-year options passed by coach_v064.js. The active override now preserves and records the filter.
- Correct-but-slow weekday attempts now remain eligible for targeted retesting; parent-marked time_issue on a correct weekend answer is saved and enters the review queue.
- AI transfer review now treats correct-but-slow source attempts as a reason to start a same-method transfer, and correct-but-slow AI answers do not advance mastery.
- Skill evidence no longer labels repeated slow performance as stable.
- Regression coverage added for reserved-year exclusion through the final active override and for weekday/weekend/AI correct-but-slow paths.
- QA: mock assembly PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40153030047; learning closure PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40153017475; AI transfer review PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40152914249; dashboard QA PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40153017472.
- Release gate still open: review/merge PR, confirm GitHub Pages deploys v0.6.5.18, then rerun deployed-browser smoke against that exact live build. No learner records or Supabase data were changed by these tests.

- Reference product: https://luminamath.top/student
- Preserve the current locked/printed weekend paper and all existing learner/cloud records.
- AI-created transfer questions remain separate from official AMC8 weekend mocks and official diagnostic scores.

## Completed: v0.6.5.14 selector fix

- Merged PR #3; the active production override now calls the reviewed weekly-weakness selector.
- Mock assembly regression QA and learning-closure QA passed before merge.
- Browser-level paper-lock check and isolated cloud round-trip remain unverified.

## Completed: v0.6.5.15 guided dashboard

- Merged PR #4; the home page now has a read-only guided learning path and next-step suggestion.
- The dashboard detects the active locked 25-question paper by identity/signature and does not confuse an older paper with this week's test.
- An unsubmitted older daily paper takes priority so the system does not silently replace a printed task.
- Dashboard QA, learning-closure QA and mock-assembly QA all passed on the merged commit.
- GitHub Pages deployment is running; online deployment still needs final confirmation.

## Next acceptance work

- Adds a read-only guided learning path to the existing home page.
- Prioritizes an already locked but unsubmitted daily paper over generating a new task.
- Dashboard model tests and learning-closure tests passed on the feature branch before reapplying it to the current mainline; revalidation is running.

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


## Live cloud sync round-trip QA — 2026-10-25

- Result: PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40111616475
- Exercised the production `amc8-sync` Edge Function with a random one-time test sync code.
- Verified ping, first upload, pull and exact JSON equality, stale revision rejection (HTTP 409), no overwrite after conflict, valid revision increment, and a second exact pull.
- Confirmed the isolated test row existed with revision 2, deleted only the row matching the exact test hash and QA marker, then queried again: remaining test rows = 0.
- No real learner state was used or changed.
- GitHub Pages deployment for v0.6.5.15: PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40110075753
- Remaining acceptance item: visual/interactive browser check of the deployed home page and locked-paper flow. Static regression tests pass; this is not yet claimed as completed end-to-end browser testing.


## Browser acceptance and cooldown-scope audit — 2026-10-25

- Read-only inspection of the deployed v0.6.5.15 page confirms the guided dashboard renders, shows the currently locked weekend paper (`2026-W43-01`), and preserves the unsubmitted daily paper dated `2026-10-24`; no paper was regenerated and no learner data was changed.
- Deployed-browser navigation smoke test on v0.6.5.15: PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40149286925. It checked the deployed title, guided dashboard, all six navigation destinations, return-home rendering and zero uncaught page errors. The same smoke test must be rerun against v0.6.5.16 after deployment.
- Next logic-audit item: `eligibleDailyBank()` enforces a 30-day cooldown using `S.attempts`, but does not visibly include `mock_detail_history` or the currently locked `printable_mock_ids`. Verify against the requirement that weekday training avoid recently used questions; if confirmed, add regression coverage and extend the cooldown without altering the current locked paper.


## v0.6.5.16 — weekday 30-day cooldown fix (merged to main)

- Confirmed gap: `eligibleDailyBank()` only considered `S.attempts`; recent weekend mock history and currently locked papers were not consistently blocked.
- Added a pure `dailyQuestionCooldownIds` helper used by the production daily-bank selector.
- The cooldown now includes attempts and recent mock history within the chosen window, plus always-protected current locked weekend IDs and any unsubmitted daily paper.
- Relaxation remains 30 → 14 → 7 days only if fewer than three candidates remain. The last-resort fallback still never reuses locked paper IDs.
- Added regression cases for the 30-day boundary, 31-day expiry, recent/old mock history, locked mock, pending daily paper, and submitted daily-plan expiry.
- Deployed-browser navigation smoke QA: PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40149286925
- Cloud sync round-trip QA remains PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40111616475
- PR #5 merged as `163a10854cffcdf9244bba2769bd532ba8e0a31a`.
- Final-main QA: learning closure PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40150195597; dashboard PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40150195602; mock assembly PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40150195648.
- GitHub Pages deployment: PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40150250628.
- Deployed-browser smoke test on v0.6.5.16: PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40150268611. Verified build title, guided learning path, all six navigation destinations, return-home rendering and zero uncaught page errors.


## v0.6.5.17 — report record integrity fix (merged and deployed)

- Audit found that the report selected the last non-empty mock-detail record, even if it contained fewer than 25 question rows, while labeling it a complete mock.
- Audit also found that the closure panel preferred the currently locked paper's selection metadata even when showing a different historical mock score, which could mix evidence across papers.
- Added `latestCompleteMockDetail` and `selectionEvidenceFor` helpers: reports require exactly 25 per-question rows, and selection evidence must belong to the reported completed mock. Current locked-paper evidence is shown only before any complete mock exists.
- Added regression tests for partial latest records, no complete record, legacy complete mock without saved evidence, and current paper evidence isolation.
- PR #6 merged as `15e429cf3759c2ecf4317e92ed390308916b96d4`.
- Final-main learning closure QA: PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40150675427; dashboard QA: PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40150675441; mock assembly QA: PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40150675398.
- GitHub Pages deployment: PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40150675348.
- Deployed browser smoke on v0.6.5.17: PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40150728712. Verified page version, guided dashboard, all six navigation destinations, return-home rendering and zero uncaught page errors.
