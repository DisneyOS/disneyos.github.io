export function parkNow(now=new Date()) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
  return {date:`${parts.year}-${parts.month}-${parts.day}`,time:`${parts.hour}:${parts.minute}`};
}
export const tripState=(t,today)=>t.endDate<today?'past':t.startDate>today?'upcoming':'current';
export function orderedTrips(trips,today) {
  const rank={current:0,upcoming:1,past:2};
  return [...trips].sort((a,b)=>rank[tripState(a,today)]-rank[tripState(b,today)] || (tripState(a,today)==='past'?b.endDate.localeCompare(a.endDate):a.startDate.localeCompare(b.startDate)) || a.id.localeCompare(b.id));
}
export function selectedTrip(trips,today,selected) {return trips.find(t=>t.id===selected) || orderedTrips(trips,today)[0] || null;}
export function tripDates(t) {
  const dates=[];
  for(let ms=Date.parse(t.startDate),end=Date.parse(t.endDate);ms<=end && dates.length<=731;ms+=86400000) dates.push(new Date(ms).toISOString().slice(0,10));
  return dates;
}
export const multiDay=p=>['resort','hotel','lodging'].includes(p.type) || p.endDate && p.endDate>p.date;
export const planTime=p=>p.time || p.startTime || p.opens || '';
export function sortPlans(plans) {return [...plans].sort((a,b)=>Number(['park_reservation','park_entry'].includes(b.type))-Number(['park_reservation','park_entry'].includes(a.type)) || (planTime(a)||'99').localeCompare(planTime(b)||'99') || String(a.id).localeCompare(String(b.id)));}
export function destinations(plans) {return [...new Set(sortPlans(plans).map(p=>p.park || p.destination || p.location).filter(v=>typeof v==='string' && v))].join(' → ');}
export function practicalRange(p) {
  if (!['fastpass','lightning_lane'].includes(p.type)) return null;
  // Only consume explicit normalized timing; never invent allowances.
  const r=p.practicalWindow;
  return r?.startTime && r?.endTime ? r : null;
}
export function planState(p,now=parkNow()) {
  if (p.used===true || p.completed===true || ['used','completed'].includes(String(p.status).toLowerCase())) return 'Completed';
  if ((p.endDate || p.date)<now.date) return 'Past';
  if (p.date>now.date) return '';
  const start=practicalRange(p)?.startTime || planTime(p), end=practicalRange(p)?.endTime || p.endTime || p.closes;
  if (end && end<now.time) return 'Past';
  if (start && start<=now.time && end && now.time<=end) return 'NOW';
  if (start && !end && start<now.time) return 'Past';
  return '';
}
export function defaultDay(t,plans,today) {
  if (tripState(t,today)==='current') return today;
  return tripDates(t).find(d=>d>=today && plans.some(p=>p.date===d && !multiDay(p))) || t.startDate;
}
export function suggestions(plans,parties,trips) {
  const dates=[...new Set(plans.map(p=>p.date))].sort(), groups=[];
  for(const date of dates) {
    const last=groups.at(-1);
    if (!last || Date.parse(date)-Date.parse(last.at(-1))>3*86400000) groups.push([date]); else last.push(date);
  }
  return groups.flatMap(group=>{
    const ids=new Set(plans.filter(p=>group.includes(p.date)).flatMap(p=>p.participantIds || []));
    const candidates=parties.map(p=>({p,score:p.members.filter(m=>ids.has(m.disneyGuestId)).length / new Set([...ids,...p.members.map(m=>m.disneyGuestId)]).size})).sort((a,b)=>b.score-a.score);
    if (!candidates[0]?.score) return [];
    const party=candidates[0].p,startDate=group[0],endDate=group.at(-1);
    const existing=trips.find(t=>t.partyId===party.id && Date.parse(t.startDate)<=Date.parse(endDate)+86400000 && Date.parse(t.endDate)>=Date.parse(startDate)-86400000);
    if (existing && existing.startDate<=startDate && existing.endDate>=endDate) return [];
    return [{...(existing || {}),name:existing?.name || `${party.displayName} · ${startDate}`,partyId:party.id,startDate:existing && existing.startDate<startDate?existing.startDate:startDate,endDate:existing && existing.endDate>endDate?existing.endDate:endDate,exact:candidates[0].score===1}];
  });
}
