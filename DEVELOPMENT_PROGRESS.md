# Lucas AMC8 Coach — Development Progress

Last updated: 2026-10-25

## Production baseline

- Main baseline: v0.6.5.14
- Reference product: https://luminamath.top/student
- Preserve the 575-question bilingual AMC8 archive, daily three-question lock, weekend 25-question mock, parent answer entry, learning reports, Supabase sync, and isolated AI same-method review.
- Current production mode switch is implemented by coach_v064.js; coach_learning_closure_v06514.js supplies reviewed tag matching and selection evidence.

## Current phase: v0.6.5.15 production wiring and failure safety

### Root cause

The adaptive learning-closure module already existed, but the later-loaded coach_v064.js reassigned buildPrintableMockCore and continued calling the legacy pickPersonalized function. As a result, the active personalized mode could bypass the reviewed adaptive selector even though the selector and report code existed.

### Changes

- Route personalized mixed-year papers through buildArchiveMockCore and the existing adaptive selector.
- Pass only non-reserved archive years to personalized mode; preserve the six reserved complete years for the separate unseen full-year diagnostic mode.
- Extend the existing selector to accept a filtered bank and persist the reserved-year list, actual weakness-match evidence, source-year counts, and recent-exclusion fallback positions.
- Require 25 unique questions in original AMC8 Q1–Q25 positions before writing a new paper.
- Return false on loading/selection failure and guard buildPrintableMock so a failed build cannot allocate a new paper ID over an existing paper.
- Keep AI-created variants outside official weekend papers and official diagnostic scores.
- Remove the duplicate reviewed-tag-bank fetch at closure startup.

### Acceptance gates

1. Personalized mode calls the active adaptive selector, not the legacy picker.
2. Personalized mode never consumes the six reserved full-year diagnostic years.
3. Diagnostic mode still selects an unseen complete reserved year and preserves its original order.
4. Every generated mixed paper has 25 unique questions in their original positions.
5. A matching method/group/skill influences only the seven configured personalized positions.
6. Recent exclusion fallback is recorded; no-data/unmapped cases do not claim a match.
7. A failed selection leaves existing paper IDs and state untouched.
8. GitHub Actions QA passes; fresh-browser and Supabase round-trip are checked separately after deployment.

## Status

- Production selector wiring: `fix/amc8-production-selector-v06515`; focused selector CI passed after correcting the test to match the actual function-assignment form.
- Integrated review branch: `feat/guided-student-dashboard-v06516`; learning-closure and dashboard regression workflows passed.
- Draft PR: https://github.com/Jackiexu0619/lucas-amc8-coach/pull/2
- Fresh-browser and Supabase round-trip acceptance remain pending; do not deploy until these are checked.
- PR #1 contains a competing selector implementation and is superseded. Do not merge PR #1; review the integrated PR #2 instead.


## Follow-on phase: v0.6.5.16 guided student dashboard

- Add a four-step student journey: weekend full mock → weakness diagnosis → weekday three-question practice → same-method transfer review.
- The next-action card respects a locked paper first, then the weekday three-question routine, then the pending review/report queue.
- The home panel is presentation-only: it reads existing state and does not alter attempts, mastery, mock IDs, Supabase rows, or printed questions.
- Keep the reference product's guided flow without faking a live LLM chat. A true free-form coach requires a separately configured and secured model backend.
- Added `qa_student_dashboard_v06516.cjs` for weekend/weekday priority, current-paper protection, and no-state-mutation checks.
- Combined implementation branch: `feat/guided-student-dashboard-v06516`; CI and live-browser verification remain acceptance gates.
