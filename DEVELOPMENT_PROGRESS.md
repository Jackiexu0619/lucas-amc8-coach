# Lucas AMC8 Coach — Development Progress

Last updated: 2026-10-24

## Current baseline

- Production branch: main
- Baseline version: v0.6.5.13
- Product reference: https://luminamath.top/student
- Existing core to preserve: 575-question bilingual archive, locked daily 3-question paper, weekend 25-question mock, parent answer entry, learning reports, Supabase sync, and isolated AI same-method review.

## Current phase: reliable weakness-aware weekend assembly

### Confirmed issue

The main page contained two same-named buildPrintableMockCore() functions. The later definition overrode the earlier profile-based implementation and sent production weekend assembly to buildArchiveMockCore() / archivePaperPicker(). That active picker preserved original AMC8 question positions but did not use the weekly weakness scoring helpers.

### Planned change

- Keep the existing exact-position, 25-question, cross-year official AMC8 assembly.
- Use the existing seven personalized positions only; do not change the 25-position difficulty curve.
- Prefer exact reviewed method / skill-group matches from the most recent seven days when selecting those positions.
- Continue preferring unseen questions and avoiding the last four weekend mocks and last seven weekday training days when alternatives exist.
- Persist the selected weakness matches and fallback decisions in the mock metadata.
- Keep AI-created variants outside the official weekend mock and official diagnostic scores.
- Add a pure selector module and Node regression tests so the production path can be tested without mutating browser or Supabase data.

### Acceptance gates

1. Exactly one active buildPrintableMockCore() definition.
2. 25 unique questions, each at its original AMC8 question-number position.
3. Seven personalized positions remain fixed.
4. Exact reviewed method / group / skill matches influence only personalized positions.
5. Recent/attempted questions are avoided when alternatives exist; fallback behavior is explicit.
6. No changes to the currently locked/printed paper or existing learner data.
7. Browser end-to-end and Supabase round-trip checks remain separate from code/CI QA.

## Status

- v0.6.5.14 work is being implemented on feat/weakness-aware-mock-v06514.
- Not released until selector QA and fresh-browser checks pass.
