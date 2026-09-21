import test from 'node:test';
import assert from 'node:assert/strict';
import {directionsUrl, resolveDirectionsDestination} from './directions.mjs';
import {directionsLocationForPlan} from './my-trip.mjs';

const coordinates = {name: 'Haunted Mansion', park: 'Magic Kingdom', latitude: 28.4202, longitude: -81.5812};
test('uses Apple Maps for iOS coordinates', () => assert.equal(directionsUrl(coordinates, 'ios'), 'https://maps.apple.com/?daddr=28.4202%2C-81.5812'));
test('uses Google Maps for Android coordinates', () => assert.equal(directionsUrl(coordinates, 'android'), 'https://www.google.com/maps/dir/?api=1&destination=28.4202%2C-81.5812'));
test('uses Google Maps for desktop coordinates', () => assert.equal(directionsUrl(coordinates, 'desktop'), 'https://www.google.com/maps/dir/?api=1&destination=28.4202%2C-81.5812'));
test('falls back to a specific address', () => assert.equal(resolveDirectionsDestination({address: '1180 Seven Seas Drive, Lake Buena Vista, FL 32830'}), '1180 Seven Seas Drive, Lake Buena Vista, FL 32830'));
test('uses a specific canonical attraction name without over-qualifying it', () => assert.equal(resolveDirectionsDestination({canonicalName: "A Pirate's Adventure ~ Treasures of the Seven Seas", park: 'Magic Kingdom'}), "A Pirate's Adventure ~ Treasures of the Seven Seas"));
test('uses a normal unique attraction name without over-qualifying it', () => assert.equal(resolveDirectionsDestination({name: 'Haunted Mansion', park: 'Magic Kingdom'}), 'Haunted Mansion'));
test('normalizes the Topolino’s My Trip facility and resort objects before resolving directions', () => {
  const plan={type:'dining',title:'Dining reservation',facility:{name:'Topolino’s Terrace'},location:{name:'Disney’s Riviera Resort'}};
  assert.deepEqual(directionsLocationForPlan(plan),{...plan,canonicalName:'Topolino’s Terrace',location:'Disney’s Riviera Resort',resort:'Disney’s Riviera Resort'});
  assert.equal(resolveDirectionsDestination(directionsLocationForPlan(plan)), 'Topolino’s Terrace');
});
test('adds trusted park context only when a record explicitly requires it', () => assert.equal(resolveDirectionsDestination({name: 'Cinderella Castle', park: 'Magic Kingdom', requiresContext: true}), 'Cinderella Castle, Magic Kingdom, Walt Disney World Resort'));
test('rejects generic and conflicting locations', () => {
  assert.equal(resolveDirectionsDestination({name: 'Restrooms', park: 'Magic Kingdom'}), null);
  assert.equal(resolveDirectionsDestination({latitude: 28.4, longitude: -81.5, coordinates: {latitude: 28.5, longitude: -81.5}}), null);
});
