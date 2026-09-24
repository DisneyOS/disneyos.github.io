import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateCard, executionResultPresentation, refreshPlannerState } from './lightning-lanes.mjs';

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
