export const DESTINATIONS = {
  'magic-kingdom':'Magic Kingdom', epcot:'EPCOT', 'hollywood-studios':'Hollywood Studios',
  'animal-kingdom':'Animal Kingdom', 'disney-springs':'Disney Springs'
};
export const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value && value >= today();
}
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function rideStatus(ride, future=false) {
  if (future) return 'Reference information';
  const status = String(ride.status || '').toUpperCase();
  if (/CLOSED|REFURB/.test(status)) return 'Closed';
  // Queue-Times is_open=false alone does not distinguish closure from downtime.
  if (ride.isOpen === false || /DOWN|UNAVAILABLE/.test(status)) return 'Unavailable';
  const raw = ride.waitMinutes ?? ride.waitTime;
  return raw !== null && raw !== undefined && raw !== '' && Number.isFinite(Number(raw)) && Number(raw)>=0 ? `${Number(raw)} min` : 'Unavailable';
}
export function sortRides(rows) {
  return [...rows].sort((a,b)=>Number(!rideStatus(a).endsWith(' min'))-Number(!rideStatus(b).endsWith(' min')) || a.name.localeCompare(b.name));
}
export function freshness(value, failed=false, now=Date.now()) {
  const stamp = Date.parse(value);
  if (!Number.isFinite(stamp)) return 'Update time unavailable';
  const minutes = Math.max(0,Math.floor((now-stamp)/60000));
  return `${failed || minutes>10 ? 'Last reported' : 'Updated'} ${minutes} min ago`;
}
export function scheduleText(item, date, now=Date.now()) {
  const slots = (item.showtimes || []).filter(t=>t.startTime?.slice(0,10)===date).sort((a,b)=>a.startTime.localeCompare(b.startTime));
  if (!slots.length) return date === today() ? 'Schedule unavailable' : 'Schedule not published yet';
  if (date !== today()) return `Published · ${slots.map(t=>time(t.startTime)).join(' · ')}`;
  const remaining = slots.filter(t=>Date.parse(t.endTime || t.startTime)>now);
  if (!remaining.length) return 'No more performances today';
  const next = remaining[0];
  if (String(next.type).toUpperCase()==='OPERATING') return `${time(next.startTime)}–${time(next.endTime)}`;
  return `${time(next.startTime)}${remaining.length>1 ? ` · ${remaining.length-1} more today` : ''}`;
}
export const time = value => value && Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat(undefined,{timeZone:'America/New_York',hour:'numeric',minute:'2-digit'}).format(new Date(value)) : '';
const normalize = value => String(value).toLowerCase().replace(/bathrooms?|toilets?/g,'restroom').replace(/medical/g,'first aid').replace(/fireworks/g,'nighttime').replace(/[^a-z0-9]+/g,' ').trim();
function distance(a,b) {
  if(a.length===b.length){const changed=[...a].map((c,i)=>c===b[i]?-1:i).filter(i=>i>=0);if(changed.length===2 && changed[1]===changed[0]+1 && a[changed[0]]===b[changed[1]] && a[changed[1]]===b[changed[0]])return 1;}
  const row=Array.from({length:b.length+1},(_,i)=>i);
  for(let i=1;i<=a.length;i++){let last=row[0];row[0]=i;for(let j=1;j<=b.length;j++){const old=row[j];row[j]=Math.min(row[j]+1,row[j-1]+1,last+(a[i-1]!==b[j-1]));last=old;}}
  return row[b.length];
}
export function matches(item, query) {
  const hay=normalize([item.name,item.land,item.description,item.category,item.cuisine,item.serviceType].join(' '));
  return normalize(query).split(' ').every(word=>hay.includes(word) || (word.length>=5 && hay.split(' ').some(w=>distance(word,w)<=1)));
}
export function mapUrl(park, mobile=false) {
  if (park==='disney-springs') return 'https://www.disneysprings.com/disney-springs-map/';
  return `https://disneyworld.disney.go.com/${mobile?'attractions':'destinations'}/${park}/`;
}
export function diningHours(item,date){
  const rows=(item.hours || []).filter(h=>h.date===date);
  if(!rows.length)return date===today()?'Hours unavailable':'Hours not published yet';
  const clock=value=>{if(!/^\d{2}:\d{2}:\d{2}$/.test(value || ''))return '';const [h,m]=value.split(':').map(Number);return `${h%12 || 12}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;};
  return `${date===today()?'':'Published · '}${rows.map(h=>h.isClosed?`${h.type || 'Operating'}: Closed`:`${h.type || 'Hours'} ${clock(h.startTime)}–${clock(h.endTime)}`).join(' · ')}`;
}
export function diningCategory(item,category){
  return !category || (category==='Mobile Order'?item.mobileOrder===true:(item.serviceTypes || [item.serviceType]).includes(category));
}
export function diningIndicators(item){return [item.mobileOrder===true?'Mobile Order':null,item.reservationsAccepted===true?'Reservations':null,item.priceRange].filter(Boolean).join(' · ');}
