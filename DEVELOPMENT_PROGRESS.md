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
- Production page version verified before this change: `v0.6.5.20` on 2026-10-25. The v0.6.5.21 source is on a separate branch until merged and deployed.

## v0.6.5.21 — on-demand DeepSeek mock explanations (release in progress)

- Added a manual button to the latest complete mock report. It includes wrong, unable, skipped and guessed-correct questions, displays batch progress, preserves successful explanations if another item fails, and offers per-question retry. Independent correct responses trigger no request.
- The separate browser cache is bound to engine version, paper ID, question ID, image path, prompt, choices and official answer. It never changes attempts, scores, mastery or the locked mock.
- `amc8-explain` sends the canonical archive image to DeepSeek Vision, checks returned question ID and answer against the canonical catalog, and rejects incomplete or mismatched responses. Original solution material remains available. Only text nodes render model output.
- Server authorization checks the existing sync-code hash without reading or changing learning payload. A separate RLS-enabled quota table limits each registered code to 10 requests per minute and 30 per UTC day. No new learning-data table or migration is involved.
- Local automated QA passed for inline syntax, mock assembly, answer interaction, learning report, learning closure, AI explanation failures/cache/retry and an isolated Playwright browser with mocked API responses. These tests do not spend DeepSeek credits or touch real learner data.
- Supabase quota migration applied and Edge Function version 1 deployed. Live endpoint rejected malformed JSON. At this writing, `DEEPSEEK_API_KEY` is not configured, so real model output has **not** been tested. GitHub CI, Pages deployment and deployed-browser acceptance remain pending.
- Next: configure `DEEPSEEK_API_KEY` in project `dfwojiefseopguoqugzs` Secrets without sharing it in chat; run one controlled live-image explanation and inspect answer consistency; then complete CI, Pages and browser acceptance. Do not infer mathematical correctness from a successful API response.

## v0.6.5.20 — per-question answer and solution report (PR pending; not deployed)

- Production remains `v0.6.5.19`; this work is isolated on `feature/full-mock-learning-report-v06520`.
- The latest complete 25-question mock report now renders each question's original image or structured stem, Lucas's recorded answer, official answer, result status, topic/skill/method metadata, and a review action.
- Incorrect, unable, skipped and guessed-correct items expand by default; independent correct answers stay collapsed for a compact report.
- The app now indexes available worked-solution HTML from the existing public AMC8 solution data source for the years present in that dataset, then attaches it to matching archive questions. The local cache key is versioned so older cache entries lacking solutions are refreshed.
- When a full worked solution is not available locally, the report explicitly says so and links to the corresponding year's full solution page. It does not fabricate a derivation from a method tag.
- Solution HTML is sanitized before display. The new `qa_mock_learning_report_v06520.cjs` tests normalization and actual rendering of a 25-question fixture, including correct answer display, inline solution display, missing-solution fallback, and default expansion of weak items.
- Mock assembly, answer-interaction and report QA PASS on the current feature branch: https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40163221841.
- Remaining release gates: open PR, verify all required CI checks, merge, confirm Pages deployment, and run a deployed-browser smoke that checks the report with isolated fixture data. No real learner state is modified by QA.


## v0.6.5.19 — deployed and browser-verified

- PR #8 merged to main: https://github.com/Jackiexu0619/lucas-amc8-coach/pull/8.
- Image-based archive questions now use one compact clickable A–E row instead of the duplicate non-clickable “A. A / B. B” list plus a second answer-entry section.
- Structured questions render actual answer choice text as clickable buttons. Clicking A–E saves the existing paper draft and automatically advances to the next question.
- The “这题是猜的” checkbox remains available before selection. “不会” and “未做” remain separate actions and also advance; Q25 stays visible with a clear completion instruction.
- The expanded 25-question preview uses the same interactive controls.
- Interactive QA PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40159365810. Existing mock assembly, learning-closure and dashboard QA also PASS on main: https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40159433852 ; https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40159433842 ; https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40159433874.
- GitHub Pages deployment PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40159433556.
- Exact v0.6.5.19 deployed-browser smoke PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40159596497. In isolated storage, clicking A on Q1 advanced to Q2, saved the answer and preserved the guess marker; it did not submit attempts/results, and the locked weekend and pending daily paper identities/question lists remained unchanged. All six navigation destinations worked and no uncaught JavaScript errors were reported.
- The smoke test uses a disposable browser context; no real learner records or production Supabase data were modified. Release gate closed for v0.6.5.19.

## v0.6.5.18 — deployed and browser-verified

- Confirmed by script load-order inspection: the final coach_learning_closure_v06514.js override of buildArchiveMockCore() discarded the filtered archive and reserved-year options passed by coach_v064.js. The active override now preserves and records the filter.
- Correct-but-slow weekday attempts now remain eligible for targeted retesting; parent-marked time_issue on a correct weekend answer is saved and enters the review queue.
- AI transfer review now treats correct-but-slow source attempts as a reason to start a same-method transfer, and correct-but-slow AI answers do not advance mastery.
- Skill evidence no longer labels repeated slow performance as stable.
- Regression coverage added for reserved-year exclusion through the final active override and for weekday/weekend/AI correct-but-slow paths.
- Main-branch QA PASS: mock assembly — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40153636344; learning closure — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40153636665; AI transfer review — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40153636277; dashboard — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40153636326.
- GitHub Pages deployment PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40153636102.
- Exact v0.6.5.18 deployed-browser smoke PASS — https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40154046896. In isolated browser storage, all six navigation destinations preserved the locked 25-question weekend paper ID/list and pending daily paper ID/list; no attempts, mock results, or daily sessions were written; no uncaught JavaScript errors occurred.
- Release gate closed for v0.6.5.18. Tests used isolated synthetic data; no real learner records or Supabase data were changed.

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
