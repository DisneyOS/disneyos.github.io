const TRUSTED_PARKS = new Map([
  ['magic kingdom', 'Magic Kingdom'],
  ['magic-kingdom', 'Magic Kingdom'],
  ['epcot', 'EPCOT'],
  ['hollywood studios', 'Hollywood Studios'],
  ['hollywood-studios', 'Hollywood Studios'],
  ["disney's hollywood studios", 'Hollywood Studios'],
  ['animal kingdom', 'Animal Kingdom'],
  ['animal-kingdom', 'Animal Kingdom'],
  ["disney's animal kingdom theme park", 'Animal Kingdom'],
  ['disney springs', 'Disney Springs'],
  ['disney-springs', 'Disney Springs'],
]);

const text = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const valueAt = (source, names) => names.map(name => source?.[name]).filter(value => value !== undefined && value !== null && value !== '');
const coordinatePair = source => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const latitudes = valueAt(source, ['latitude', 'lat']);
  const longitudes = valueAt(source, ['longitude', 'lng', 'lon']);
  if (latitudes.length !== 1 || longitudes.length !== 1) return null;
  const latitude = Number(latitudes[0]), longitude = Number(longitudes[0]);
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180 ? {latitude, longitude} : null;
};

function coordinates(location) {
  const candidates = [coordinatePair(location), coordinatePair(location?.coordinates), coordinatePair(location?.location)];
  if (Array.isArray(location?.coordinates) && location.coordinates.length === 2) {
    const [latitude, longitude] = location.coordinates.map(Number);
    if (Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180) candidates.push({latitude, longitude});
  }
  const valid = candidates.filter(Boolean);
  if (!valid.length || valid.some(pair => pair.latitude !== valid[0].latitude || pair.longitude !== valid[0].longitude)) return null;
  return valid[0];
}

function specificAddress(location) {
  const address = text(location?.address || (typeof location?.location === 'string' ? location.location : location?.location?.address));
  return address.length <= 300 && /\b(?:\d{1,6}\s+\S+|street|st\.?|road|rd\.?|drive|dr\.?|avenue|ave\.?|boulevard|blvd\.?|lane|ln\.?|way|parkway|pkwy\.?|highway|hwy\.?)\b/i.test(address) ? address : '';
}

function contextualName(location) {
  const name = text(location?.canonicalName || location?.name || location?.title || location?.locationName);
  const park = TRUSTED_PARKS.get(text(location?.park || location?.parkName || location?.destination).toLowerCase());
  return name && park ? `${name}, ${park}, Walt Disney World Resort` : '';
}

export function resolveDirectionsDestination(location) {
  const pair = coordinates(location);
  if (pair) return `${pair.latitude},${pair.longitude}`;
  return specificAddress(location) || contextualName(location) || null;
}

export function platformFor(userAgent = globalThis.navigator?.userAgent || '', maxTouchPoints = globalThis.navigator?.maxTouchPoints || 0) {
  const agent = String(userAgent);
  return /iPhone|iPad|iPod/i.test(agent) || (/Macintosh/i.test(agent) && Number(maxTouchPoints) > 1) ? 'ios' : /Android/i.test(agent) ? 'android' : 'desktop';
}

export function directionsUrl(location, platform = platformFor()) {
  const destination = resolveDirectionsDestination(location);
  if (!destination) return null;
  const encoded = encodeURIComponent(destination);
  return platform === 'ios' ? `https://maps.apple.com/?daddr=${encoded}` : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}

export function openDirections(location, {platform, open = globalThis.open} = {}) {
  const url = directionsUrl(location, platform);
  if (!url || typeof open !== 'function') return false;
  open(url, '_blank', 'noopener,noreferrer');
  return true;
}
