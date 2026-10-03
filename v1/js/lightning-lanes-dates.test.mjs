import test from 'node:test';
import assert from 'node:assert/strict';
import {groupLaneDates,parkToday,serviceDateLabel,broadAvailabilityText,candidateCard,watchPartyInput} from './lightning-lanes.mjs';
const today='2026-10-03';
const booking=(id,date,startMinute=600)=>({id,serviceDate:date,startMinute});
const watch=(id,date,status='ACTIVE')=>({id,serviceDate:date,status});
test('all three October 5 bookings survive per-profile duplication and sort by booked time',()=>{
  const bookings=['Barnstormer','Pirates','Big Thunder'].flatMap((id,i)=>[booking(id,'2026-10-05',600+i*60),booking(id,'2026-10-05',600+i*60)]);
  const groups=groupLaneDates(bookings,[],today);
  assert.deepEqual(groups[0].plans.map(p=>p.id),['Barnstormer','Pirates','Big Thunder']);
  assert.equal(groups[0].defaultOpen,true);
});
test('source ID reuse never merges bookings across dates and only nearest relevant date opens',()=>{
  const groups=groupLaneDates([booking('same','2026-10-08'),booking('same','2026-10-05'),booking('past','2026-10-01')],[],today);
  assert.equal(groups.length,3); assert.equal(groups.filter(g=>g.defaultOpen).length,1);
  assert.equal(groups.find(g=>g.defaultOpen).date,'2026-10-05');
  assert.equal(groups[0].historical,true);assert.equal(groups[0].defaultOpen,false);
});
test('past confirmed dry-run records and cancelled records remain in history',()=>{
  const rows=[watch('Kali','2026-10-01','CONFIRMED_AWAITING_EXECUTION'),watch('Safaris','2026-09-24','CONFIRMED_AWAITING_EXECUTION'),watch('cancelled','2026-10-05','CANCELLED')];
  const groups=groupLaneDates([],rows,today);
  assert.equal(groups.flatMap(g=>g.watches).length,0);assert.equal(groups.flatMap(g=>g.history).length,3);
});
test('active waiting and current confirmation stay prominent; lifecycle inactive rows go to history',()=>{
  const rows=['ACTIVE','READY_FOR_CONFIRMATION','CONFIRMED_AWAITING_EXECUTION','ELIGIBILITY_BLOCKED','PAUSED','SUCCESS','EXPIRED','STALE','FAILED','CANCELLED'].map(status=>watch(status,'2026-10-05',status));
  const [g]=groupLaneDates([],rows,today);
  assert.deepEqual(g.watches.map(s=>s.status),['ACTIVE','READY_FOR_CONFIRMATION','CONFIRMED_AWAITING_EXECUTION','ELIGIBILITY_BLOCKED']);
  assert.equal(g.history.length,6);assert.equal(g.defaultOpen,true);
});
test('explicit future dry-run result is history without rewriting status or deleting',()=>{
  const s={...watch('dry','2026-10-05'),workflows:[{result:{dryRun:true}}]}, original=structuredClone(s);
  assert.equal(groupLaneDates([],[s],today)[0].history.length,1);assert.deepEqual(s,original);
});
test('unknown service dates fail closed into historical grouping',()=>{
  const groups=groupLaneDates([booking('unknown','2026-02-30')],[watch('missing',null)],today);
  assert.equal(groups.length,1);assert.equal(groups[0].historical,true);assert.equal(groups[0].watches.length,0);
});
test('park date uses Eastern time and labels do not shift across UTC date boundaries',()=>{
  assert.equal(parkToday(new Date('2026-10-04T01:00:00Z')),'2026-10-03');
  assert.equal(serviceDateLabel('2026-10-05'),'October 5, 2026');
});
test('known availability does not imply exhaustive inventory or alter criteria/party',()=>{
  const card=candidateCard({id:'fixture',status:'READY_FOR_CONFIRMATION',expiresAt:'2099-01-01',current:{experienceName:'Held',startMinute:800},proposed:{experienceName:'Target',startMinute:700},consent:{version:2,intentFingerprint:'sha256:'+'a'.repeat(64)}},0);
  assert.ok(card.includes(broadAvailabilityText));assert.match(card,/Earliest known availability/);assert.match(card,/other times may exist/);
  assert.deepEqual(watchPartyInput({isNew:true,partyId:'saved',profileIds:['A','B','C','D']}),{partyId:'saved',profileIds:['A','B','C','D']});
});
