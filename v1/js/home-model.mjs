import {parkNow, planTime, planState} from './trip-model.mjs';

// A presentation of the authenticated P2 projection, not a second plan store.
export function homePlans(data) {
  const seen = new Set();
  return (data?.trips || []).flatMap(t => (data.itineraries?.[t.id] || []).filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id); return true;
  })).sort((a,b) => a.date.localeCompare(b.date) || (planTime(a) || '00:00').localeCompare(planTime(b) || '00:00') || String(a.id).localeCompare(String(b.id)));
}
export const todayPlans = (data, now=parkNow()) => homePlans(data).filter(p => p.date<=now.date && (p.endDate || p.date)>=now.date);
export function planPark(p) {
  for (const value of [p.park,p.destination,p.location]) {
    const name=String(value || '').toLowerCase().replaceAll('-', ' ');
    if (/magic kingdom/.test(name)) return 'Magic Kingdom';
    if (/epcot/.test(name)) return 'EPCOT';
    if (/hollywood studios/.test(name)) return 'Hollywood Studios';
    if (/animal kingdom/.test(name)) return 'Animal Kingdom';
    if (/disney springs/.test(name)) return 'Disney Springs';
  }
  return null;
}
export function defaultHomePark(data, now=parkNow()) {
  const plans=homePlans(data).filter(planPark);
  const today=plans.filter(p=>p.date===now.date);
  const current=today.filter(p=>planState(p,now)==='NOW').at(-1);
  const next=today.find(p=>!['Past','Completed'].includes(planState(p,now)) && (!planTime(p) || planTime(p)>=now.time));
  const candidate=current || next || today.at(-1) || plans.find(p=>p.date>now.date) || plans.at(-1);
  return candidate ? planPark(candidate) : 'Magic Kingdom';
}
