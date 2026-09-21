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
const GENERIC_DESTINATIONS = new Set(['adventureland', 'area', 'entrance', 'exit', 'fantasyland', 'frontierland', 'guest services', 'lobby', 'main street', 'parking', 'restroom', 'restrooms', 'transportation', 'tomorrowland', 'world showcase']);

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

function resortContext(location) {
  const values = [location?.resort, location?.resortName, location?.destination, location?.area, location?.location].filter(value => typeof value === 'string').map(text);
  const embedded = values.flatMap(value => value.match(/\bat\s+(Disney['’]?s\s+.+?\s+Resort)\s*$/i)?.[1] || []);
  return [...values, ...embedded].find(value => /^Disney['’]?s\s+.+?\s+Resort$/i.test(value)) || '';
}

function trustedContext(location) {
  const parks = [location?.park, location?.parkName, location?.destination].map(text);
  const park = parks.map(value => TRUSTED_PARKS.get(value.toLowerCase())).find(Boolean);
  if (park) return `${park}, Walt Disney World Resort`;
  const resort = resortContext(location);
  return resort ? `${resort}, Walt Disney World Resort` : '';
}

function isSpecificName(value) {
  const name = text(value), words = name.toLowerCase().match(/[a-z0-9]+/g) || [];
  return name.length >= 8 && !GENERIC_DESTINATIONS.has(name.toLowerCase()) && words.filter(word => !['a', 'an', 'and', 'at', 'of', 'the', 'to'].includes(word)).length >= 2;
}

function nameDestination(location) {
  const context = trustedContext(location);
  const resort = resortContext(location);
  const canonical = text(location?.canonicalName);
  if (isSpecificName(canonical)) return canonical;
  const candidates = [location?.name, location?.locationName, location?.facility, location?.title, location?.location].filter(value => typeof value === 'string').map(text).filter(value => value !== resort);
  const name = candidates.find(isSpecificName);
  if (!name || !context) return '';
  // Existing source records can explicitly require context; never append it by default.
  return location?.requiresContext === true ? `${name}, ${context}` : name;
}

export function resolveDirectionsDestination(location) {
  const pair = coordinates(location);
  if (pair) return `${pair.latitude},${pair.longitude}`;
  return specificAddress(location) || nameDestination(location) || null;
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
