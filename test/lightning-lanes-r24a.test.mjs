import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { eligibleExperiences, searchTypeLabel } from '../v1/js/lightning-lanes.mjs';

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
