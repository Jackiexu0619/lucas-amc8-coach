# Lucas AMC8 Coach — Development Progress

Last updated: 2026-10-28

## v0.6.5.27 — weekend method diagnosis (review branch; not deployed)

- 2026-10-28 PR #19 direction change: `submitPrintableMockAnswers` saves original attempts and `mock_detail_history`; the weekly wrapper reads canonical `ARCHIVE_BANK` question IDs, image paths, answer keys and the real per-question answers. The browser sends at most five images per `amc8-diagnose` analyze request, then sends only answer-checked analyses and at most six unseen official candidate IDs for synthesis. The server attaches fixed image URLs from the 575-question catalog, validates the returned IDs, statuses, solution fields, method specificity and official answer letters, and returns at most three targets. Tags are optional hints, not a gate. Missing or unreadable images, answer conflicts and malformed model output remain unresolved; model failure keeps the saved rule diagnosis. The model cannot write original attempts or mastery.
- A validated AI target can replace at most one unprotected ordinary slot of the next newly generated daily paper when the candidate remains eligible under the existing cooldown and old-paper exclusions. `weekly_diagnosis_context` records the source mock, target ID, evidence IDs, candidate ID and reason. Due review and AI transfer slots remain protected. No candidate means no claimed targeted coverage. A locked daily paper stays unchanged; reopening the report does not call AI or create a task.
- Actual weekend entry has no per-question clock or reliable hint-use observation; legacy `hint_level:0` is therefore sent as unknown rather than presented as independent mastery. A correct answer with unknown hint use is not accepted as explicit positive independent evidence. AI analysis and candidate method relation remain provisional until mathematical review; answer-letter matching alone cannot prove a derivation correct.
- Isolated human-checked image samples: 2003 Q19 has 1200/1500/1800 as the three common multiples of 15, 20 and 25 in range (C); 2004 Q19 has x−2=60 and x=62 (B); 2005 Q20 has a six-turn relative cycle (A); 2006 Q23 has x=28 and remainder zero modulo 7 (A). The mocked model grouped the first two differently tagged questions under a common-multiple method, kept the third as positive evidence only when `hint_level:0`, and attached 2006 Q23 as a new training candidate. This proves the contract and test fixture, not live DeepSeek mathematical accuracy.
- New `qa_weekly_diagnosis_ai_v06527.cjs` and expanded isolated Chromium `qa_weekly_diagnosis_browser_v06526.cjs` passed locally (exit 0). The browser used normal mock submission, five intercepted image-analysis calls and one synthesis call, opened the report twice without repeated requests, then selected the candidate in a three-question daily plan; a second mock with a simulated 503 kept the rule record. No production Supabase request reached the network. Rule fallback QA passed. Existing mock assembly, mock answer interaction, review regeneration, AI transfer, learning closure, hint review, learning report, AI explanation, student print, report browser, AI explanation browser and daily history tests all passed locally (exit 0). Edited scripts passed `node --check`; `git diff --check` passed. Code commit `0b19766b1cc097600613c84addb3f3b5427dd5de` passed [weekly diagnosis](https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40691926526), [mock assembly](https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40691926464), [learning closure](https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40691926597) and [student dashboard](https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40691926493) GitHub Actions (each success). These are isolated CI results, not live DeepSeek or family-browser acceptance.
- Pending after review: deploy the new Edge Function and matching page, configure service access, verify real DeepSeek image reading and mathematical derivations against human-reviewed answers, then perform family-browser acceptance. AI new-question generation and next-weekend mastery validation are not implemented in this PR.

- PR #19 review follow-up: the diagnosis now uses its own `diagnosisTags()` adapter instead of relying on `learningTags()` being replaced by another module. It reads reviewed parent method tags, local PDF method tags, the loaded PDF tag-bank entry and explicitly reviewed question metadata in that order. Legacy `group_key` and `independent_math_verified` map to `groupKey` and `mathIndependentlyVerified`; only literal `true` confirms math verification. Placeholder or unreviewed methods remain `unknown` and unresolved. The diagnosis itself accepts only the three server-supported confidence values.
- Follow-up isolated Chromium QA uses the real page and tag-bank loader: parent, local PDF, bank PDF and unknown tags map to the expected confidence; the PDF `group_key` connects to a pending official review task; the unknown wrong-answer item stays unresolved while the other three targets survive. The request built from those actual browser candidates passes `amc8-diagnose/core.mjs` validation. A grounded model result is accepted, an invented question ID is rejected, and unit/VM cases keep the rule record on missing sync code or simulated network failure. No production Supabase request is made.

- Base: started from verified PR #18 merge `ac9cd21d4a9c2a1264edfaf20893aeea251fc4e7`. Before PR review, `main` advanced to `83c477eae142f32ccc1ef63c99eb137939aa449a` with the student-paper print fix, so this branch was rebased onto that commit and advanced to v0.6.5.27. The original local `main` checkout was not reset; this work uses `codex/weekend-method-diagnosis` in a separate worktree.
- Active chain: `submitPrintableMockAnswers()` saves 25 original attempts and mock detail; the new final wrapper derives one `weekly_method_diagnoses` record per paper ID. `renderReport()` displays the saved focus without generating tasks. `generateDailyPlan()` uses the saved focus to replace at most one ordinary eligible official question while preserving due review and AI transfer slots; `dailyPlan()` and the submitted `daily_sessions` retain the source evidence. Existing paper locks, 30-day avoidance with documented candidate fallback, and three-question cap remain in their current selectors.
- Diagnosis weighs wrong, unable, skipped, guessed, recorded hints and reliable slow-answer evidence. It accepts exact method tags, lowers confidence for PDF labels without independent math verification, keeps ambiguous or answer-inconsistent records unresolved, and counts historical independent success only with a paper ID, original answer and explicit unassisted result. Whole-paper minutes are never attributed to one method. The two production cloud archives remain separate; no merged history or inferred mastery is used.
- The new Edge Function reuses server-side sync-code verification and the existing explanation quota RPC, calls DeepSeek only for bounded candidate ranking, and rejects invented IDs/reason codes. An unavailable model or sync code leaves the rules result intact. No production function was deployed or real model request made. The new diagnosis does not write mastery or original attempts.
- Isolated `node qa_weekly_diagnosis_v06526.cjs` passed locally (exit 0), covering evidence, incomplete/duplicate answers, conservative confidence, invalid AI output, server authorization gate, fallback, protected slots, idempotent report and persisted source context. Isolated Chromium `node qa_weekly_diagnosis_browser_v06526.cjs` passed locally (exit 0): normal 25-answer submission, three grounded targets, repeat report navigation, next unplanned daily paper with three questions and source context, unchanged mock attempts and no Supabase request.
- Local regression commands `node qa_mock_assembly_v06514.cjs`, `node qa_mock_answer_interaction_v06519.cjs`, `node qa_review_queue_regeneration_v06522.cjs`, `node qa_ai_transfer_review_v066.cjs`, `node qa_learning_closure_v06514.cjs`, `node qa_hint_review_v06523.cjs`, `node qa_mock_learning_report_v06520.cjs`, and `node qa_ai_explain_v06521.cjs` each exited 0. Isolated Chromium `qa_report_review_v06525.cjs`, `qa_daily_history_v06524.cjs`, `qa_hint_review_browser_v06523.cjs`, and `qa_ai_explain_browser_v06521.cjs` each exited 0. New scripts and Edge Function passed `node --check`; all three inline scripts compiled; `git diff --check` passed.
- After rebasing onto the print fix, the new diagnosis unit/browser tests, mock assembly, answer interaction, learning closure, mock report and `qa_mock_print_v06526.cjs` all passed again locally (exit 0).
- PR #19 head `f5df65aee05843cdcacf378130c3ccd5aff4796b` CI completed successfully: [weekly diagnosis](https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40648263915), [mock assembly and browser regression](https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40648263857), [learning closure](https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40648263840), and [student dashboard](https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40648263930). These are isolated checks, not production acceptance.
- Known limits: the existing weekend UI records whole-paper time, not per-question time; most PDF method labels are not independently math verified, so their diagnosis remains low confidence. A pre-existing locked daily paper is intentionally preserved and receives no retroactive target; the next newly generated paper can use the diagnosis. AI candidate ranking needs the new Edge Function deployed after review. AI-generated new questions and next-weekend mastery validation are later phases.
- Next: obtain code review; only then consider deployment and family-browser acceptance. Do not merge cloud archives or change learner records during this review.

## Product goal

Keep the learning loop simple and evidence-based:
1. Weekend: one complete 25-question AMC8 mock.
2. Diagnose from actual answers, guesses, skips, time and error evidence.
3. Weekdays: no more than three targeted questions per day.
4. Retest weak methods with new questions and verify transfer.

## Current production baseline

- Production branch: `main`
- Production page version: `v0.6.5.25`, verified from the deployed HTML on 2026-10-28. Current `main` commit: `470f5a735c438eccb080a18f050b6eab9d3e7092`. The family Chrome state has not been used for this print fix.

## v0.6.5.26 — weekend student paper print readiness (review branch; not deployed)

- Rebased the print repair on the new `main` after PR #15 and #16 merged. The v0.6.5.25 report categories, daily review, mobile UI and AI explanation files remain present.
- Existing print flow waited for all archived question images and cropped them before calling `window.print()` asynchronously. In isolated Chromium, delaying one image 7 seconds made the print call lose the active click; failed or stalled images gave no visible status. The exact family-browser failure has not been observed directly.
- The mock student print now reports preparation, blocks incomplete image papers, and retains a prepared 25-question document for a direct second click when loading has exceeded the browser's click activation. The locked paper ID and question IDs remain unchanged; other print actions keep their original behavior.
- Isolated Chromium `qa_mock_print_v06526.cjs` passed normal one-click printing, 7-second slow-image second-click printing, failed-image protection, a nonempty browser PDF, unchanged mock ID/question IDs/draft/history/cloud request count, and the existing parent-answer print followed by another student print. The new test plus 13 existing report, daily, mock, AI and review regressions passed locally with exit code 0. CI and production Chrome acceptance remain separate.
- Next: review the hotfix PR, inspect CI, then verify the actual family-browser print dialog after deployment without regenerating the locked paper.

## v0.6.5.25 — report categories and complete daily-question review (review branch; not deployed)

- UI follow-up branch based on PR #15 (`dde253bf6d5f2648263e1e4657d5512fa00d6596`): used a task-local UI/UX Pro Max Skill search and the current Vercel Web Design Guidelines to write `UI_DESIGN_V06525.md`. Retained the native HTML/CSS/JS structure, refined the existing four report categories, and applied the same deep-blue typography, spacing, card, button and focus rules to home, daily entry, mock report and parent settings. Daily summaries now scan as individual facts; each paper shows a readable title while preserving its full paper ID. Answer, reliable solution, AI supplement and review follow-up have separate visual sections. Original archival images open at full size in a new tab on mobile. Learning logic, saved attempts, cloud sync and print rules were not changed.
- Visual acceptance: `node qa_ui_capture_v06525.cjs` ran in fresh Chromium contexts at 1440, 768 and 390px against the original PR #15 checkout and this UI branch (exit 0 both). Its 54 screenshots, linked in `UI_ACCEPTANCE_V06525.md`, cover home, daily entry controls, report categories, date/paper archive, original question, an actual 2015 Q1 existing solution, the weekend mock report and parent settings. Browser checks found no horizontal overflow, overlapping navigation controls, distorted source image ratio or uncaught JavaScript exception. A mobile entry screenshot exposed checkbox-label separation; it was fixed and recaptured. Web Design Guidelines review retained only inherited deep-link and variable-image-dimension limitations documented in the acceptance note. Function regression results are recorded separately below; final PR CI and production browser acceptance remain pending.
- UI-branch function QA: `qa_report_review_v06525.cjs` (including mobile original-image opening, broken-image fallback, category switching and no learner-state mutation) and twelve existing browser/unit regression scripts all passed locally with exit 0. Three inline scripts and edited JS parsed; `git diff --check` passed. This is a separate functional result from the 54-image visual inspection. The stack PR must still run its own CI before review.
- Scope: group the existing report into overview, daily practice, 25-question mock, and review plan. Daily practice opens by default; the selected category persists during this page session. The weekend AI explanation panel stays with the mock report, and the existing official/AI queues stay in the review plan. The source data and scoring engines are unchanged.
- Each saved daily question now expands to its archival AMC8 image, recorded answer/result, duration, error and hint evidence, existing solution material when its year and question match, and a reliably linked review status. Missing image or full solution is stated explicitly. The 2000 and 2002 sample questions have real archived images but no locally matched full solution in the existing solution bank; method tags are not presented as derivations.
- The existing `amc8-explain` client and cache key/version `0.6.5.21` are reused for an on-demand per-paper batch, progress, partial success, cached reopening and single-question retry. Independent correct questions make no model request. The Edge Function request validator now accepts the actual `hinted` result only with numeric hint level 1 or 2; no answer status is disguised. This function change must be deployed together with the page after review. Actual DeepSeek calls and family-browser acceptance are pending deployment.
- Isolated Chromium `node qa_report_review_v06525.cjs` passed (exit 0) after normal report navigation: four exclusive categories, the three 2026-10-24 original images decoded with nonzero dimensions, the saved unable/correct/wrong results, an existing-solution fixture and honest no-solution state, on-demand AI partial failure/answer conflict/single retry/cache hit, hint-level request, date filters, 25-question mock, queue panels, 390px width, no uncaught errors, no sync request and unchanged attempts/sessions/locked paper/revision. The older `qa_daily_history_v06524.cjs`, `qa_ai_explain_v06521.cjs`, `qa_ai_explain_browser_v06521.cjs`, `qa_hint_review_browser_v06523.cjs`, `qa_hint_review_v06523.cjs`, `qa_review_queue_regeneration_v06522.cjs`, `qa_ai_transfer_review_v066.cjs`, `qa_learning_closure_v06514.cjs`, `qa_mock_assembly_v06514.cjs`, `qa_mock_learning_report_v06520.cjs`, `qa_mock_answer_interaction_v06519.cjs` and `qa_student_dashboard_v06515.cjs` all passed locally (exit 0). Edited scripts and three inline scripts parsed; `git diff --check` passed. The four PR #15 workflows for the implementation commit `b71cd5df4bbe4d1e439493f1fdf2850d4ee2ef07` passed: [mock/browser QA](https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40484529656), [learning closure](https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40484529545), [AI transfer](https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40484529547), and [dashboard](https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40484529592). These are isolated checks, not production acceptance.
- No production browser or Supabase learner data was touched. Next: PR review and CI; after approval, deploy the updated Edge Function with the page, then perform real API and family-browser acceptance without changing historical answers or the locked paper.

## v0.6.5.24 — dated daily-paper history (merged and deployed)

- PR #14 review follow-up (2026-10-27): the dated-history summary now counts explicitly recorded `hint_level:1` or `2` on a correct answer as review evidence, without changing `isWeakLearningAttempt()` or review scheduling. The existing recent daily-time table shows `未记录` for a null/absent total while retaining `00:00` for a saved zero. Historical attempts, session times, and cloud state are not rewritten.
- Expanded isolated Chromium `node qa_daily_history_v06524.cjs` passed (exit 0) through normal report navigation: a three-question, all-correct hint-assisted paper shows `有待复盘/复测题` and three `提示后答对` details; the old total-time table distinguishes null and zero. Existing archive, read-only, refresh, multi-paper, filter, mobile and submission assertions still pass. `qa_hint_review_v06523.cjs`, `qa_review_queue_regeneration_v06522.cjs`, `qa_ai_transfer_review_v066.cjs`, `qa_learning_closure_v06514.cjs`, `qa_mock_assembly_v06514.cjs`, `qa_mock_learning_report_v06520.cjs`, `qa_ai_explain_v06521.cjs`, and `qa_hint_review_browser_v06523.cjs` passed locally (exit 0). Three inline scripts and the edited test parse; `git diff --check` passed. PR CI and family-browser acceptance remain separate checks.
- Fixed `submitDailyPaperResults()` to show counts separately from question positions, distinguish independently correct answers from guessed/hinted correct answers, identify the paper's original date, and count only recorded durations. New attempts store `paper_id` and `paper_question_index`; sessions store the number of timed questions. An old paper opens directly in its dated report entry after submission.
- Reused the v0.6.5.23 daily review panel, grouping sessions by date and distinct paper IDs. Added seven-day, thirty-day, all-history and exact-date filters without persisting filter state. A legacy attempt without a paper ID is shown only when date and question ID identify one session and one attempt; ambiguous answers remain marked as unreliable. Knowledge/method and review due dates appear only when supported by existing tags and queue history.
- Report-only navigation renders the report without generating a new daily paper. It does not call save or cloud push; existing revision conflict protection remains unchanged. Weekend mock reports, 25-question assembly, AI explanation cache version `0.6.5.21` and review scheduling are unchanged.
- New isolated Chromium QA `node qa_daily_history_v06524.cjs` passed locally (exit 0): the 2026-10-24 1/3 old-paper example, refresh persistence, Oct 22/23/24 sorting, two papers on one date, conservative legacy matching, reviewed method/due-date linkage, all date filters, read-only state/revision checks, mobile width, and all-correct/all-wrong/unable/skipped/guessed/hinted submission boundaries.
- Existing `qa_hint_review_v06523.cjs`, `qa_review_queue_regeneration_v06522.cjs`, `qa_ai_transfer_review_v066.cjs`, `qa_learning_closure_v06514.cjs`, `qa_mock_assembly_v06514.cjs`, `qa_mock_learning_report_v06520.cjs`, `qa_mock_answer_interaction_v06519.cjs`, `qa_ai_explain_v06521.cjs`, `qa_hint_review_browser_v06523.cjs` and `qa_ai_explain_browser_v06521.cjs` all passed locally (exit 0). Version assertions were updated to the new page release; AI explanation cache version remains `0.6.5.21`. The separate, unused `qa_ai_transfer_review_engine.cjs` fails at its pre-existing invalid-question assertion on both this branch and the v0.6.5.23 baseline; it is not part of the production module or four CI workflows and was left outside this task.
- No production browser state, Supabase learner row or historical attempt was edited. Next: submit PR, inspect CI, then obtain family-browser acceptance after review and deployment.

## v0.6.5.23 — assisted daily answers must not advance review (merged; family-browser acceptance pending)

- Root cause: daily parent entry had no hint field and wrote `hint_level:0` for every answer; the official same-method review queue ignored hint use when treating a correct answer as a pass. The AI queue already rejected positive hint levels but treated missing values as zero.
- Daily parent entry now requires an explicit 0/1/2 hint choice for each question before any attempts are saved. Assisted correct answers remain correct for the paper but are not marked independently mastered. The legacy paper-entry helper also asks rather than silently recording zero.
- Official and AI review tasks only advance on an explicitly unassisted, unguessed correct answer. Assisted correct answers reset to the existing next-training-day review cadence; genuine independent passes keep the existing 7/14/30-day progression. Missing/invalid old hint values are not rewritten or accepted as independent passes, and an otherwise correct old record alone does not invent a new weakness task.
- Isolated queue QA reproduced the original stage-1 defect before the fix and now passes for independent, hint-assisted, guessed, wrong and unknown-hint results. Isolated Chromium QA confirms that an unconfirmed hint field blocks all writes and that 1/2/0 records yield one independent answer without changing mock results. Regeneration, AI transfer, learning-closure, mock assembly, answer-interaction, learning-report, AI-explanation and explanation-browser regression scripts passed locally (exit 0); inline scripts compile, and `git diff --check` is clean. These are isolated tests, not family-browser acceptance.
- No production learner data, locked paper, Supabase row, official answer or AI explanation cache was changed. PR #13 passed code review and merged; family-browser acceptance is still required before declaring a production pass.
- PR #13 follow-up: strict numeric hint levels are `0`, `1`, `2` only. A historical `3` or `99` no longer creates an official or AI transfer task from an otherwise correct standalone answer, receives no `hint_used` reason, adds no mastery, and appears as "independence unverified" in the daily answer detail. Missing, `null`, string `"0"` and negative values follow the same conservative rule. An existing pending task remains pending on the next training day and records `independence_unverified`; raw attempts are untouched.
- Follow-up QA: `node qa_hint_review_v06523.cjs`, `node qa_ai_transfer_review_v066.cjs`, and isolated Chromium `node qa_hint_review_browser_v06523.cjs` first failed against PR #13 head `f5b079d4640a26e1ce9fb2cc74f3c4e44021b65e` at `hint_used`, AI task creation and `+0.04` mastery respectively; all passed after the range fix (exit 0). The browser test also checks rendered daily-detail labels and untouched historical attempts. The four prior business regression scripts, mock report and interaction, AI explanation unit and browser scripts, script syntax, inline syntax and `git diff --check` all passed locally (exit 0). Four PR workflows also passed on `bee7ae86726cdb223f89b82a57b33ececffab3b9`; family-browser acceptance remains pending.
- If a correct historical attempt has an invalid hint and a separate error reason such as `time_issue`, queue history preserves that reason and records `independence: unverified`. This avoids losing a real slow-answer observation while preventing stage advancement. The dedicated regression covers this combined case.
- Final review fixes on PR #13: `renderReport()` now includes the existing daily answer-history panel; repeated normal navigation renders one panel and empty history shows a clear message. An invalid hint on an otherwise correct, unguessed attempt with no separate weakness evidence cannot reopen a completed review task. Pending tasks still use conservative next-training-day scheduling; valid hints 1/2 and independent 0 retain their prior behavior. No source attempt or mock record is rewritten.
- Final review QA: expanded `node qa_hint_review_v06523.cjs` reproduces the completed-task reopen defect before the fix and passes afterwards, including completed/pending/absent tasks, valid hints and independent slow-answer evidence. Expanded isolated Chromium `node qa_hint_review_browser_v06523.cjs` reproduces the missing panel before the fix and passes after normal report navigation, repeat renders, empty state, all valid/invalid hint values and unchanged attempts, sessions and mock records. Both exit 0. Regeneration, AI transfer, learning closure, mock assembly, mock report and interaction, AI explanation unit/browser, script and inline syntax, and `git diff --check` passed locally (exit 0). Four PR workflows must rerun on the final commit; no production-browser acceptance was performed.

## v0.6.5.22 — daily regeneration keeps due reviews (deployed; family-browser acceptance pending)

- Live v0.6.5.21 state confirmed that the 2026-10-24 mock's four weak items were already present in the review queue and due on 2026-10-27. However, the locked daily paper was still dated 2026-10-24 and unsubmitted.
- Root cause: `refreshArchiveDaily()` calls `generateDailyPlan(new Set(previous))`; the review-cycle and AI-transfer exclusion branches returned the generic selector directly, bypassing due review tasks.
- Fix: explicit regeneration now applies the due same-method queue while excluding every old paper ID; the AI transfer selector also respects that exclusion set. Maximum remains three questions, with no repeated old-paper IDs.
- AI explanation cache remains reusable because its own engine version stays at v0.6.5.21; no explanation prompt or payload changed.
- Added regression coverage for the weekend review queue, regeneration exclusions, the three-question cap and AI transfer retention. PR #12 merged as `13a9fcaf86faa93abec6744001701e43f2e07caa`; Pages deployment passed: https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40193184204. Family-browser regeneration and record-preservation checks remain pending.

## v0.6.5.21 — on-demand DeepSeek mock explanations (deployed and browser-verified)

- Added a manual button to the latest complete mock report. It includes wrong, unable, skipped and guessed-correct questions, displays batch progress, preserves successful explanations if another item fails, and offers per-question retry. Independent correct responses trigger no request.
- The separate browser cache is bound to engine version, paper ID, question ID, image path, prompt, choices and official answer. It never changes attempts, scores, mastery or the locked mock.
- `amc8-explain` sends the canonical archive image to DeepSeek Vision, checks returned question ID and answer against the canonical catalog, and rejects incomplete or mismatched responses. Original solution material remains available. Only text nodes render model output.
- Server authorization checks the existing sync-code hash without reading or changing learning payload. A separate RLS-enabled quota table limits each registered code to 10 requests per minute and 30 per UTC day. No new learning-data table or migration is involved.
- Local automated QA passed for inline syntax, mock assembly, answer interaction, learning report, learning closure, AI explanation failures/cache/retry and an isolated desktop/mobile Playwright browser with mocked API responses. These tests do not spend DeepSeek credits or touch real learner data.
- PR #10 merged: https://github.com/Jackiexu0619/lucas-amc8-coach/pull/10. Final-branch GitHub Actions passed for mock assembly/browser QA (https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40188705865), learning closure (https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40188705868), and dashboard (https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40188705869).
- Supabase quota migration applied and Edge Function deployed. `DEEPSEEK_API_KEY` is configured in project Secrets; its value was never copied to the repository or chat. Unregistered sync code was rejected (403).
- Real controlled DeepSeek calls with a disposable sync row: 2000 Q1 returned a coherent, manually checked solution (42 ÷ 2 − 5 = 16, answer B); 2001 Q8, whose archive image lacks the needed kite dimensions, returned `image_insufficient`; 2000 Q6 produced an inconsistent geometric derivation in an early attempt, then an independently computed answer different from the catalog and was blocked as `answer_mismatch`. These are evidence for the guardrails, not proof that every AI solution is mathematically correct.
- Corrected the request to withhold the catalog answer from the model, use a bounded non-thinking output, and compare its computed result with the option content when both are simple numbers. The model can still make mathematical mistakes; keep original solutions visible and review AI math against the source.
- Pages deployment passed: https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40188798163. The live site returned the v0.6.5.21 build marker: https://jackiexu0619.github.io/lucas-amc8-coach/.
- The real button was exercised in a fresh Playwright context against the deployed site and Edge Function. A first Q1 response lacked required fields and failed safely; single-question retry returned the manually checked 16/B derivation. Reopening the report and pressing batch again used the cache without another API call. Mobile width had no horizontal overflow, no uncaught browser errors occurred, and locked-paper identity and attempt count stayed unchanged. The reusable live script is `qa_ai_explain_live_v06521.cjs`; it requires a disposable registered QA sync code and is intentionally excluded from CI model calls.
- The disposable QA sync row and its 11 quota rows were deleted by exact hash and marker; both remaining counts were verified as zero. No real learner records were modified.
- Next: independent mathematical review of representative AI explanations, especially diagrams. A registered existing sync code is required on the device; the feature does not create or upload one automatically. Do not treat an API 200 or answer-letter match as proof that every derivation is correct.

## v0.6.5.20 — per-question answer and solution report (historical development notes)

- This report shipped on `main` before v0.6.5.21 and remains the basis for the new AI explanation section.
- The latest complete 25-question mock report now renders each question's original image or structured stem, Lucas's recorded answer, official answer, result status, topic/skill/method metadata, and a review action.
- Incorrect, unable, skipped and guessed-correct items expand by default; independent correct answers stay collapsed for a compact report.
- The app now indexes available worked-solution HTML from the existing public AMC8 solution data source for the years present in that dataset, then attaches it to matching archive questions. The local cache key is versioned so older cache entries lacking solutions are refreshed.
- When a full worked solution is not available locally, the report explicitly says so and links to the corresponding year's full solution page. It does not fabricate a derivation from a method tag.
- Solution HTML is sanitized before display. The new `qa_mock_learning_report_v06520.cjs` tests normalization and actual rendering of a 25-question fixture, including correct answer display, inline solution display, missing-solution fallback, and default expansion of weak items.
- Mock assembly, answer-interaction and report QA PASS on the current feature branch: https://github.com/Jackiexu0619/lucas-amc8-coach/actions/runs/40163221841.
- The subsequent v0.6.5.21 acceptance above tested this report with isolated fixture data and left learner state unchanged.


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


## 2026-10-28 — production sync archive protection, stage 1 (review pending)

- Base: `470f5a735c438eccb080a18f050b6eab9d3e7092`; isolated branch `codex/amc8-sync-state-audit`. No application, sync, or learner data code changed.
- Added offline read-only snapshot/difference tool, synthetic regression, and CI workflow. The tool requires exactly two complete authorized SQL-exported rows, retains original JSONB payload, sync hash, revision and timestamps, and writes new ACL-protected local snapshot directories outside Git. It never connects to Supabase or offers a restore/write command.
- Synthetic QA: `node --check scripts/amc8_sync_state_audit.mjs`, `node --check qa_sync_state_audit.cjs`, `node qa_sync_state_audit.cjs`, and `git diff --check` passed locally. CI has not yet run at the time of this entry.
- Production read-only export: two rows obtained by `SELECT` through the authorized Supabase connection. Source counts were revision 49 / 43 attempts / 4 daily sessions / 1 mock detail, and revision 1 / 9 attempts / 1 daily session / 0 mock details. The complete local snapshot was independently re-read and verified by SHA-256; hashes and path are deliberately omitted from this public repository document.
- Difference preview has 9 cross-archive same-question candidate pairs. All are only question-ID matches; none share confirmed date, paper ID and position. Three pairs differ by date and paper ID; a field missing on both sides is reported as missing rather than confirmed equal. No automatic duplicate decision or merge was made.
- Remaining: human review of candidate pairs and backup location/checksums, then an explicitly approved retention/reconciliation rule. Do not combine the archives for adaptive diagnosis until that review is complete. Next engineering stage is the 2–3 method weekend diagnosis only after this data gate.
- PR #18 review follow-up: require `payload.attempts` to exist as an array before any export or difference computation. Keep the two optional historical arrays absent when absent; report their counts as `null` rather than zero, while present empty arrays remain zero. Synthetic QA now covers missing/invalid required arrays, missing versus empty optional arrays, no success marker or new snapshot on invalid input, and preservation of existing snapshots. This changes only the offline audit tool and its documentation/tests.
- The production revision 1 payload actually omits `mock_detail_history`; the original version 1 manifest counted that omission as zero. The original backup is preserved, but version 2 verification must reject that ambiguous legacy count. A separate version 2 snapshot is required; its protected local path and checksum are reported outside the repository.
- PR #18 final manifest-integrity follow-up: verification now cross-checks candidate count, record count, supported/equal schema versions, matching export time, and record checksum list length against the checked snapshot and diff. Synthetic tamper cases must fail without a `BACKUP_VERIFIED` marker. Existing backup files remain unchanged; no production data path is touched.
