import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateCard, confirmCriterionBoundAttempt, executionResultPresentation, refreshPlannerState } from './lightning-lanes.mjs';

function consentDialog() {
  const elements = {
    '#execution-consent-description': { textContent: '' },
    '#accept-execution-consent': { onclick: null },
    '#cancel-execution-consent': { onclick: null }
  };
  return {
    elements,
    open: false,
    querySelector: selector => elements[selector],
    showModal() { this.open = true; },
    close() { this.open = false; this.onclose?.(); }
  };
}

test('criterion-bound in-page consent requires a second explicit action before accepting', async () => {
  const dialog = consentDialog();
  const consent = confirmCriterionBoundAttempt(dialog, { current: { experienceName: 'Expedition Everest' }, proposed: { experienceName: "Na'vi River Journey" } });
  assert.equal(dialog.open, true);
  assert.match(dialog.elements['#execution-consent-description'].textContent, /Expedition Everest to Na'vi River Journey/);
  assert.match(dialog.elements['#execution-consent-description'].textContent, /actual staged offer meets your Watch criterion/);
  dialog.elements['#accept-execution-consent'].onclick();
  assert.equal(await consent, true);
  assert.equal(dialog.open, false);
});

test('decline, dismissal, or incomplete workflow never authorizes a controlled attempt', async () => {
  const decline = consentDialog();
  const declined = confirmCriterionBoundAttempt(decline, { current: { experienceName: 'Everest' }, proposed: { experienceName: "Na'vi" } });
  decline.elements['#cancel-execution-consent'].onclick();
  assert.equal(await declined, false);
  const dismissal = consentDialog();
  const dismissed = confirmCriterionBoundAttempt(dismissal, { current: { experienceName: 'Everest' }, proposed: { experienceName: "Na'vi" } });
  dismissal.oncancel({ preventDefault() {} });
  assert.equal(await dismissed, false);
  assert.equal(await confirmCriterionBoundAttempt(consentDialog(), { current: {}, proposed: {} }), false);
});

test('production refresh uses the existing planner refresh route before reloading cards', async () => {
  const calls = [];
  await refreshPlannerState({
    local: false,
    request: async (...args) => calls.push(['request', ...args]),
    reload: async () => calls.push(['reload'])
  });
  assert.deepEqual(calls, [
    ['request', '/planner/refresh', 'POST', {}],
    ['reload']
  ]);
});

test('local refresh preserves the existing demo route', async () => {
  const calls = [];
  await refreshPlannerState({
    local: true,
    request: async (...args) => calls.push(['request', ...args]),
    reload: async () => calls.push(['reload'])
  });
  assert.deepEqual(calls, [
    ['request', '/demo/refresh', 'POST', {}],
    ['reload']
  ]);
});

test('failed refresh does not reload stale cards', async () => {
  let reloaded = false;
  await assert.rejects(refreshPlannerState({
    local: false,
    request: async () => { throw new Error('safe failure'); },
    reload: async () => { reloaded = true; }
  }), /safe failure/);
  assert.equal(reloaded, false);
});

test('target disappearance is presented as unavailable and never as a successful dry run', () => {
  const workflow = { status: 'NO_LONGER_AVAILABLE', result: { status: 'NO_LONGER_AVAILABLE', mutationAttempted: false, bookingChanged: false, finalSubmissionCount: 0 } };
  const presentation = executionResultPresentation(workflow), card = candidateCard(workflow);
  assert.equal(presentation.title, 'No longer available');
  assert.match(presentation.message, /booking was not changed/i);
  assert.match(presentation.message, /Watch is still searching/i);
  assert.match(card, /No longer available/);
  assert.doesNotMatch(card, /Dry run successful/);
});

test('bounded controlled-execution outcomes have explicit non-legacy presentation', () => {
  const expected = new Map([
    ['TARGET_NO_LONGER_AVAILABLE', 'No longer available'],
    ['REVIEW_MISMATCH', 'Change not submitted'],
    ['EXECUTION_FAILED', 'Change not completed'],
    ['VERIFIED_SUCCESS', 'Change verified'],
    ['VERIFIED_NOT_CHANGED', 'Booking unchanged'],
    ['AMBIGUOUS_OUTCOME', 'Outcome needs review'],
    ['EXECUTING', 'Change in progress']
  ]);
  for (const [status, title] of expected) {
    const result = executionResultPresentation({ status, result: { status } });
    assert.equal(result.title, title);
    assert.notEqual(result.title, 'Dry run successful');
  }
});

test('unknown bounded result fails neutral instead of claiming success', () => {
  const result = executionResultPresentation({ status: 'FAILED', result: { status: 'FUTURE_SAFE_ENUM' } });
  assert.equal(result.title, 'Execution update');
  assert.doesNotMatch(result.message, /success/i);
});

test('globally disabled AUTO match is truthful and offers no confirmation control', () => {
  const card = candidateCard({ status: 'AUTO_READY_BUT_DISABLED' });
  assert.match(card, /automatic modification is not currently enabled/i);
  assert.match(card, /No booking change was attempted/i);
  assert.doesNotMatch(card, /data-confirm|Confirm change|Dry run successful/i);
});

test('V2 candidate authorizes Watch criterion, not exact advertised minute', () => {
  const candidate = { id: 'workflow_test', status: 'READY_FOR_CONFIRMATION', expiresAt: '2099-01-01T00:00:00Z',
    current: { experienceName: 'Expedition Everest', startMinute: 975, endMinute: 1035 },
    proposed: { experienceName: "Na'vi River Journey", startMinute: 750, endMinute: null },
    evidenceLabel: 'Broad availability is not reserved.', consent: { version: 2, intentFingerprint: 'sha256:' + 'a'.repeat(64) } };
  const card = candidateCard(candidate, Date.parse('2026-09-28T00:00:00Z'));
  assert.match(card, /Currently advertised around/);
  assert.match(card, /Disney may stage a different time/);
  assert.match(card, /Authorize change if it meets my Watch/);
  assert.doesNotMatch(card, /Confirm 12:30 PM/);
  assert.doesNotMatch(card, /data-confirm="workflow_test" disabled/);
  const old = candidateCard({ ...candidate, consent: null }, Date.parse('2026-09-28T00:00:00Z'));
  assert.match(old, /data-confirm="workflow_test" disabled/);
});

test('the candidate has one criterion-bound authorization and no second staged-offer action', () => {
  const candidate = { id: 'workflow_test', status: 'READY_FOR_CONFIRMATION', expiresAt: '2099-01-01T00:00:00Z',
    current: { experienceName: 'Expedition Everest', startMinute: 975, endMinute: 1035 },
    proposed: { experienceName: "Na'vi River Journey", startMinute: 750, endMinute: null },
    evidenceLabel: 'Broad availability is not reserved.', consent: { version: 2, intentFingerprint: 'sha256:' + 'a'.repeat(64) } };
  const card = candidateCard(candidate, Date.parse('2026-09-28T15:01:00Z'));
  assert.match(card, /data-confirm="workflow_test"/);
  assert.doesNotMatch(card, /data-finalize|separate final approval|temporary selection/i);
});

test('non-qualifying staged offers are never presented as successful', () => {
  for (const code of ['NO_IMPROVEMENT', 'STAGED_CRITERION_NOT_MET', 'STAGED_OFFER_UNVERIFIED']) {
    const result = executionResultPresentation({ status: 'FAILED', result: { status: code, finalSubmissionCount: 0 } });
    assert.equal(result.title, 'Change not submitted');
    assert.doesNotMatch(result.message, /successful|changed your booking/i);
  }
});
