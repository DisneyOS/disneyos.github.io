import test from 'node:test';
import assert from 'node:assert/strict';
import { refreshPlannerState } from './lightning-lanes.mjs';

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
