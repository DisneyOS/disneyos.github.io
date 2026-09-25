import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eligibleExperiences, searchTypeLabel, fetchCurrentState, evaluateSelectedSearch, installResumeRefresh } from '../v1/js/lightning-lanes.mjs';

const rows = [
  { id: 'safaris', name: 'Kilimanjaro Safaris', parkId: 'animal-kingdom', productTypes: ['MULTI_PASS'] },
  { id: 'navi', name: "Na'vi River Journey", parkId: 'animal-kingdom', productTypes: ['MULTI_PASS'] },
  { id: 'flight', name: 'Avatar Flight of Passage', parkId: 'animal-kingdom', productTypes: ['SINGLE_PASS'] },
  { id: 'tron', name: 'TRON Lightcycle / Run', parkId: 'magic-kingdom', productTypes: ['SINGLE_PASS'] },
];

test('selector filters canonical catalog by park and product, not availability', () => {
  assert.deepEqual(eligibleExperiences(rows, 'animal-kingdom', 'MULTI_PASS').map(x => x.id), ['safaris', 'navi']);
  assert.deepEqual(eligibleExperiences(rows, 'animal-kingdom', 'SINGLE_PASS').map(x => x.id), ['flight']);
  assert.deepEqual(eligibleExperiences(rows, 'magic-kingdom', 'MULTI_PASS'), []);
});

test('new-selection Watch is enabled and purchase work remains disabled', () => {
  const html = readFileSync(new URL('../v1/lightning-lanes.html', import.meta.url), 'utf8');
  assert.match(html, /<option value="NEW_BOOKING">Watch for a new selection<\/option>/);
  assert.match(html, /<option value="PURCHASE_MULTI" disabled>/);
  assert.match(html, /name="serviceDate" required/);
  assert.match(html, /name="parkId" required/);
  assert.equal(searchTypeLabel({ searchType: 'NEW_BOOKING' }), 'Watch for a new selection');
});

test('client submits new-selection Watch without a current-availability gate', () => {
  const source = readFileSync(new URL('../v1/js/lightning-lanes.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /!editing && field\('searchType'\)\.value === 'NEW_BOOKING'/);
  assert.match(source, /WAITING_FOR_AVAILABILITY/);
  assert.match(source, /eligibleExperiences/);
});

test('initial load reads plans and searches without evaluating', async () => {
  const source = readFileSync(new URL('../v1/js/lightning-lanes.mjs', import.meta.url), 'utf8');
  const html = readFileSync(new URL('../v1/lightning-lanes.html', import.meta.url), 'utf8');
  assert.match(html, /js\/lightning-lanes\.mjs\?r25k-visibility=2/);
  const load = source.slice(source.indexOf('async function load()'), source.indexOf('const options ='));
  assert.match(source, /load\(\)\.then\(refreshWorkflowReview\)/);
  assert.match(load, /fetchCurrentState\(api\)/);
  assert.doesNotMatch(load, /\/evaluate|POST/);
  const requests = [];
  await fetchCurrentState((path, method = 'GET') => { requests.push([method, path]); return Promise.resolve([]); });
  assert.deepEqual(requests, [['GET', '/lightning-lane/current-plans'], ['GET', '/lightning-lane/searches']]);
});

test('passive viewing has no recurring interval or automatic evaluation', async () => {
  const source = readFileSync(new URL('../v1/js/lightning-lanes.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /setInterval\s*\(/);
  const events = {};
  const doc = { hidden: false, addEventListener: (type, fn) => { events[type] = fn; } };
  const win = { addEventListener: (type, fn) => { events[type] = fn; } };
  const requests = [];
  installResumeRefresh(doc, win, () => fetchCurrentState((path, method = 'GET') => { requests.push([method, path]); return Promise.resolve([]); }));
  assert.deepEqual(requests, []);
  assert.equal(events.visibilitychange instanceof Function, true);
  assert.equal(events.focus instanceof Function, true);
  doc.hidden = true;
  events.visibilitychange();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, []);
  doc.hidden = false;
  events.visibilitychange();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, [['GET', '/lightning-lane/current-plans'], ['GET', '/lightning-lane/searches']]);
  events.focus();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests.length, 4);
  assert.equal(requests.some(([method, path]) => method === 'POST' || path.endsWith('/evaluate')), false);
});

test('Search again evaluates only the selected search', async () => {
  const source = readFileSync(new URL('../v1/js/lightning-lanes.mjs', import.meta.url), 'utf8');
  assert.match(source, /data-evaluate="\$\{esc\(s\.id\)\}"[^>]*>Search again<\/button>/);
  assert.match(source, /if \(a\.evaluate\) await evaluateSelectedSearch\(api, a\.evaluate\)/);
  const requests = [];
  await evaluateSelectedSearch((...args) => { requests.push(args); }, 'search-123');
  assert.deepEqual(requests, [['/lightning-lane/searches/search-123/evaluate', 'POST', {}]]);
});
