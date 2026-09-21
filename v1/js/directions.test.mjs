import test from 'node:test';
import assert from 'node:assert/strict';
import {directionsUrl, resolveDirectionsDestination} from './directions.mjs';

const coordinates = {name: 'Haunted Mansion', park: 'Magic Kingdom', latitude: 28.4202, longitude: -81.5812};
test('uses Apple Maps for iOS coordinates', () => assert.equal(directionsUrl(coordinates, 'ios'), 'https://maps.apple.com/?daddr=28.4202%2C-81.5812'));
test('uses Google Maps for Android coordinates', () => assert.equal(directionsUrl(coordinates, 'android'), 'https://www.google.com/maps/dir/?api=1&destination=28.4202%2C-81.5812'));
test('uses Google Maps for desktop coordinates', () => assert.equal(directionsUrl(coordinates, 'desktop'), 'https://www.google.com/maps/dir/?api=1&destination=28.4202%2C-81.5812'));
test('falls back to a specific address', () => assert.equal(resolveDirectionsDestination({address: '1180 Seven Seas Drive, Lake Buena Vista, FL 32830'}), '1180 Seven Seas Drive, Lake Buena Vista, FL 32830'));
test('falls back to a trusted contextual Disney name', () => assert.equal(resolveDirectionsDestination({name: 'Haunted Mansion', park: 'Magic Kingdom'}), 'Haunted Mansion, Magic Kingdom, Walt Disney World Resort'));
test('rejects incomplete and conflicting locations', () => {
  assert.equal(resolveDirectionsDestination({name: 'Haunted Mansion'}), null);
  assert.equal(resolveDirectionsDestination({latitude: 28.4, longitude: -81.5, coordinates: {latitude: 28.5, longitude: -81.5}}), null);
});
