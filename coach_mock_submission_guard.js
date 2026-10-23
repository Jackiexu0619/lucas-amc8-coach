/* Lucas AMC8 Coach v0.6.4.2 — prevent duplicate weekend mock submissions.
 * Loads AFTER coach_v0641.js. Additive: does not change existing saved records.
 * If historical duplicates exist, do not auto-delete them.
 */
(function () {
  'use strict';
  if (window.__amcMockSubmitGuardInstalled) return;
  if (typeof submitPrintableMockAnswers !== 'function') {
    console.error('AMC8 weekend submit guard: submit function missing');
    return;
  }
  const originalSubmit = submitPrintableMockAnswers;
  let submitting = false;
  const hasSubmitted = (id) => {
    if (!id || !S || typeof S !== 'object') return false;
    const historical = (S.mock_detail_history || []).some(r => r && (r.paper_id === id || r.mock_key === id));
    const summary = (S.mock_history || []).some(r => r && r.paper_id === id);
    const individual = (S.attempts || []).some(r => r && r.source === 'weekend_mock' && r.paper_id === id);
    return historical || summary || individual;
  };
  submitPrintableMockAnswers = function () {
    const id = S && S.printable_mock_id;
    if (submitting) { alert('试卷正在提交，请勿重复点击。'); return; }
    if (hasSubmitted(id)) {
      alert(`卷号 ${id} 已提交过。系统已阻止重复记分；如需更正，请先核对历史记录。`);
      return;
    }
    submitting = true;
    try { return originalSubmit.apply(this, arguments); }
    finally { submitting = false; }
  };
  window.__amcMockSubmitGuardInstalled = true;
  window.amcMockSubmitted = hasSubmitted;
})();
