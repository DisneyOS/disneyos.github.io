import {todayPlans} from './home-model.mjs';
import {parkNow,tripState,orderedTrips,selectedTrip,tripDates,multiDay,sortPlans,destinations,practicalRange,planState,defaultDay,suggestions,planTime} from './trip-model.mjs';
import {directionsUrl, openDirections} from './directions.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateLabel=d=>new Intl.DateTimeFormat('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(new Date(d+'T12:00:00Z'));
const timeLabel=t=>{if(!t)return '';const [h,m]=t.split(':');return `${+h%12||12}:${m} ${+h>=12?'PM':'AM'}`;};
const statusTime=value=>{if(!value)return '';const formatted=new Intl.DateTimeFormat('en-US',{month:'2-digit',day:'2-digit',hour:'numeric',minute:'2-digit'}).format(new Date(value));return formatted.replace(',',' ·');};
const statusMessage=cache=>{const time=statusTime(cache?.updatedAt);if(cache?.status==='fresh')return `Using recent plan data${time?' · '+time:''}`;if(cache?.status==='unavailable')return `Using saved plan data${time?' · '+time:''}`;return `Updating plan data${time?' · '+time:''}`;};
const safeUrl=v=>{try {const u=new URL(v);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}};
const button=(action,label,extra='')=>`<button type="button" class="party-secondary-button" data-trip-action="${action}" ${extra}>${label}</button>`;
const locationText=value=>typeof value==='string'?value:typeof value?.name==='string'?value.name:typeof value?.title==='string'?value.title:'';
export function directionsLocationForPlan(plan) {
  const facility=locationText(plan?.facility), location=locationText(plan?.location);
  return {...plan,canonicalName:plan?.canonicalName || facility || undefined,location,resort:locationText(plan?.resort) || locationText(plan?.resortName) || location};
}
export function createMyTrip({request,getToken,showPage,openParties,icon,onHomeData=()=>{}}) {
  const root=document.getElementById('my-trip-content'), status=document.getElementById('trip-status-text');
  const dialog=document.getElementById('trip-editor');
  let homeExpanded=null,lastLoadSucceeded=false;
  let data=null, selected=null, expanded=null, pending=null, credential=null, target=null;
  const days=new Map();
  function message(text){status.textContent=text;const homeStatus=document.getElementById('home-trip-status');if(homeStatus)homeStatus.textContent=text;}
  function saveSession() {try {sessionStorage.setItem('disneyos-trip-session',JSON.stringify({selected,days:[...days].map(([k,v])=>[k,[...v]])}));}catch{}}
  try {const saved=JSON.parse(sessionStorage.getItem('disneyos-trip-session'));selected=saved?.selected;for(const [k,v] of saved?.days || [])days.set(k,new Set(v));}catch{}
  function current(){return data?.trips.find(t=>t.id===selected);}
  function planDetails(p) {
    const state=planState(p), practical=practicalRange(p), end=p.endTime;
    const published=[timeLabel(planTime(p)),timeLabel(end)].filter(Boolean).join('–');
    const details=[];
    const field=(label,value)=>{if(value!==undefined && value!==null && value!=='')details.push(`<div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`);};
    const participants=p.participants || [];
    field('Participants',participants.map(v=>v.name || 'Name unavailable').join(', '));
    const count=p.partySize ?? p.guestCount;
    field('Party size',count);
    if (Number(count)>participants.length)field('Additional guests',`+${Number(count)-participants.length} guests`);
    field('Booking owner',p.ownerName);field('Confirmation',p.confirmationNumber);field('Location',[p.facility,p.area,p.location].filter(Boolean).join(' · '));
    field('Status',state || p.status);field('Stay dates',multiDay(p)?`${p.date}${p.endDate?' – '+p.endDate:''}`:null);
    field('Park opens',timeLabel(p.opens));field('Park closes',timeLabel(p.closes));field('Early Entry',p.earlyEntry);field('Extended Evening Hours',p.extendedEveningHours);
    field('Cancellation details',p.cancellationDetails);field('Notes',p.notes);
    field('Last seen in source',p.observedAt?new Date(p.observedAt).toLocaleString():null);
    if(practical){field('Published window',published);field('Practical range',`${timeLabel(practical.startTime)}–${timeLabel(practical.endTime)}`);field('Timing guidance',practical.explanation || (practical.unofficial?'Includes unofficial extended-use guidance.':'Provided arrival allowance.'));field('Official allowance',p.officialAllowance?.description);}
    let conflicts='';
    if(p.conflicts?.length) conflicts=`<aside class="trip-conflict"><strong>Source information differs</strong><p>These reported versions have not been reconciled.</p>${p.conflicts.map(v=>`<p>${esc([v.title,v.date,timeLabel(planTime(v)),timeLabel(v.endTime),v.location,v.status].filter(Boolean).join(' · '))}</p>`).join('')}</aside>`;
    const link=(url,label)=>safeUrl(url)?`<a href="${esc(safeUrl(url))}" target="_blank" rel="noopener noreferrer">${label}</a>`:'';
    return {state,practical,published,details:details.join(''),conflicts,link};
  }
  function planCard(p) {
    const {state,practical,published,details,conflicts,link}=planDetails(p);
    const directions=directionsUrl(directionsLocationForPlan(p))?button('directions','Directions',`data-id="${esc(p.id)}"`):'';
    return `<article class="trip-item ${['Past','Completed'].includes(state)?'is-past':''}"><button type="button" class="trip-item-toggle" data-trip-action="plan" data-id="${esc(p.id)}" aria-expanded="${expanded===p.id}"><span class="trip-plan-icon" aria-hidden="true">${icon(p.type)}</span><span class="trip-item-copy"><span class="trip-time">${esc(published || 'Date only')}${practical?` <span class="trip-practical">(${esc(timeLabel(practical.startTime))}–${esc(timeLabel(practical.endTime))})</span>`:''}</span><strong>${esc(p.title || 'Disney plan')}</strong><span>${esc(p.location || p.area || '')}</span>${p.manual?'<small>Manually Entered</small>':''}${state?`<small class="trip-state">${esc(state)}</small>`:''}${p.conflicts?.length?'<small>Source information differs</small>':''}</span><span aria-hidden="true">${expanded===p.id?'−':'+'}</span></button><div class="trip-item-details" ${expanded===p.id?'':'hidden'}><dl>${details}</dl>${conflicts}<div class="trip-actions">${link(p.detailsUrl,'View Details')}${directions}${p.phone?`<a href="tel:${esc(String(p.phone).replace(/[^+0-9]/g,''))}">Call</a>`:''}${p.manual?button('edit-plan','Edit',`data-id="${esc(p.id)}"`)+button('delete-plan','Delete',`data-id="${esc(p.id)}"`):''}</div></div></article>`;
  }
  function renderHome() {
    const home=document.getElementById('home-trip-plans');if(!home || !data)return;
    const focused=home.contains(document.activeElement)?document.activeElement.closest('[data-home-plan]')?.dataset.homePlan:null;
    home.innerHTML=todayPlans(data).map(p=>{
      const {state,published,details,conflicts,link}=planDetails(p),open=homeExpanded===p.id;
      return `<article class="home-plan ${['Past','Completed'].includes(state)?'is-past':''} ${state==='NOW'?'is-current':''}"><button class="home-plan-toggle" type="button" data-home-plan="${esc(p.id)}" aria-expanded="${open}" aria-label="${esc([p.title,published,p.location,state].filter(Boolean).join(' · '))}"><span aria-hidden="true">${icon(p.type)}</span><strong>${esc(p.title || 'Disney plan')}</strong><span class="home-plan-time">${esc(published || 'Today')}</span><span class="home-plan-location">${esc(p.location || p.park || '')}</span><span aria-hidden="true">${state==='Completed'?'✓':open?'−':'+'}</span></button><div class="trip-item-details" ${open?'':'hidden'}><strong>${esc(p.title || 'Disney plan')}</strong><p>${esc(published || 'Today')}${p.manual?' · Manually Entered':''}</p><dl>${details}</dl>${conflicts}<div class="trip-actions">${link(p.detailsUrl,'View Details')}${link(p.directionsUrl,'Directions')}</div></div></article>`;
    }).join('') || '<p class="secondary-detail">No plans for today.</p>';
    if(focused)[...home.querySelectorAll('[data-home-plan]')].find(b=>b.dataset.homePlan===focused)?.focus({preventScroll:true});
  }
  document.getElementById('home-trip-plans')?.addEventListener('click',event=>{
    const b=event.target.closest('[data-home-plan]');if(!b)return;
    homeExpanded=homeExpanded===b.dataset.homePlan?null:b.dataset.homePlan;renderHome();
  });
  function render() {
    if(!data)return;
    const today=parkNow().date,t=selectedTrip(data.trips,today,selected); selected=t?.id || null;
    const ordered=orderedTrips(data.trips,today);
    const selector=trip=>button('select',`<strong>${esc(trip.name)}</strong><span>${esc(trip.startDate)} – ${esc(trip.endDate)}</span><small>${esc(data.parties.find(p=>p.id===trip.partyId)?.displayName || 'Saved Party')}</small>`,`data-id="${esc(trip.id)}" aria-pressed="${trip.id===selected}"`);
    const ideas=suggestions(data.discovery || [],data.parties,data.trips);
    let html=`<div class="trip-actions">${button('new-trip','New Trip')}${button('parties','Manage Saved Parties')}</div><div class="trip-selectors" aria-label="Trips">${ordered.filter(t=>tripState(t,today)!=='past').map(selector).join('')}</div>`;
    const past=ordered.filter(t=>tripState(t,today)==='past');
    if(past.length)html+=`<details class="trip-past" ${t && tripState(t,today)==='past'?'open':''}><summary>Past Trips (${past.length})</summary><div class="trip-selectors">${past.map(selector).join('')}</div></details>`;
    if(ideas.length)html+=`<details class="trip-suggestions"><summary>Suggested Trips (${ideas.length})</summary>${ideas.map((v,i)=>`<p>${esc(v.name)} · ${esc(v.startDate)} – ${esc(v.endDate)}${v.exact?'':' · Closest Saved Party'} ${button('suggestion',v.id?'Review Trip extension':'Review suggestion',`data-index="${i}"`)}</p>`).join('')}</details>`;
    if(!t) html+='<article class="trip-summary-card"><h3>Create your first Trip</h3><p>Select a Saved Party and dates to organize your itinerary. Trips can include days with no plans.</p></article>';
    else {
      const plans=data.itineraries[t.id] || [];
      if(!days.has(t.id))days.set(t.id,new Set([defaultDay(t,plans,today)]));
      if(target?.tripId===t.id){days.get(t.id).add(target.date);expanded=target.planId;target=null;}
      html+=`<section class="trip-summary-card"><p class="card-label">${esc(tripState(t,today))} Trip</p><h3>${esc(t.name)}</h3><p>${esc(data.parties.find(p=>p.id===t.partyId)?.displayName || '')} · ${esc(t.startDate)} – ${esc(t.endDate)}</p><div class="trip-actions">${button('add-plan','Add Plan')}${button('edit-trip','Edit Trip')}${button('delete-trip','Delete Trip')}</div></section>`;
      const stays=plans.filter(multiDay);if(stays.length)html+=`<section class="trip-information"><h3>Trip information</h3>${stays.map(planCard).join('')}</section>`;
      html+=tripDates(t).map(date=>{const list=sortPlans(plans.filter(p=>p.date===date && !multiDay(p))),open=days.get(t.id).has(date);return `<section class="trip-day ${date<today?'is-past-day':''}"><button type="button" class="trip-day-toggle" data-trip-action="day" data-date="${date}" aria-expanded="${open}"><span><strong>${esc(dateLabel(date))}</strong><small>${esc(destinations(list) || (list.length?`${list.length} plans`:'No Plans'))}</small></span><span aria-hidden="true">${open?'−':'+'}</span></button><div class="trip-day-plans" ${open?'':'hidden'}>${list.map(planCard).join('') || '<p class="trip-no-plans">No Plans</p>'}</div></section>`;}).join('');
    }
    const focused=root.contains(document.activeElement)?document.activeElement.closest('[data-trip-action]'):null;
    const focus=focused?{action:focused.dataset.tripAction,id:focused.dataset.id,date:focused.dataset.date}:null;
    root.innerHTML=html;saveSession();renderHome();
    if(focus) [...root.querySelectorAll('[data-trip-action]')].find(b=>b.dataset.tripAction===focus.action && b.dataset.id===focus.id && b.dataset.date===focus.date)?.focus({preventScroll:true});
  }
  async function load() {
    lastLoadSucceeded=false;
    const token=getToken();
    if(pending)return credential===token?pending:pending.then(()=>load());
    if(credential!==token){data=null;expanded=null;credential=token;homeExpanded=null;root.replaceChildren();document.getElementById('home-trip-plans')?.replaceChildren();}
    pending=(async()=>{
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
      const key='disneyos-trip-cache-v2:'+hash;
      try {
        if(!data) {try {const saved=JSON.parse(localStorage.getItem(key));if(saved?.trips && saved?.itineraries && saved?.parties){data=saved;render();}}catch{}}
        message(data?'Using saved plan data · updating…':'Loading Trips…');
        const result=await request('/trips');
        if(token!==getToken())return;
        data=result;lastLoadSucceeded=true;try{localStorage.setItem(key,JSON.stringify(data));}catch{}
        render();message(statusMessage(result.cache));
      }catch(error){
        if(token!==getToken())return;
        if([401,403].includes(error.status)){data=null;try{localStorage.removeItem(key);}catch{}document.getElementById('home-trip-plans')?.replaceChildren();}
        message(`${error.message}${data?' · showing saved plans':''}`);
        if(!data)root.innerHTML='<p>Trips could not be loaded. Use Refresh to try again.</p>';
      }
    })().finally(()=>{pending=null;onHomeData(data);if(!data)document.getElementById('home-trip-plans').innerHTML='<p class="secondary-detail">Today’s plans unavailable.</p>';});
    return pending;
  }
  function editor(title,fields,onSave) {
    dialog.innerHTML=`<form method="dialog" class="trip-form"><h2>${esc(title)}</h2>${fields}<p class="trip-form-error" role="alert"></p><div class="trip-actions"><button type="submit" class="party-primary-button">Save</button><button type="button" class="party-secondary-button" data-cancel>Cancel</button></div></form>`;
    dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
    dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const submit=e.target.querySelector('[type=submit]');submit.disabled=true;try {await onSave(new FormData(e.target));dialog.close();await load();}catch(error){dialog.querySelector('[role=alert]').textContent=error.message;}finally{submit.disabled=false;}};
    dialog.showModal();
  }
  const input=(name,label,value='',type='text',extra='')=>`<label><span>${esc(label)}</span><input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  function editTrip(value={}) {
    if(!data.parties.length){message('Create a Saved Party first, then return to make your Trip.');openParties();return;}
    editor(value.id?'Edit Trip':'New Trip',input('name','Trip name',value.name,'text','required maxlength="200"')+input('startDate','Start date',value.startDate,'date','required')+input('endDate','End date',value.endDate,'date','required')+`<label><span>Saved Party</span><select name="partyId">${data.parties.map(p=>`<option value="${esc(p.id)}" ${p.id===value.partyId?'selected':''}>${esc(p.displayName)}</option>`).join('')}</select></label><p>Saved Party membership applies live to this Trip. Create another Saved Party for a different group. Date changes immediately change which plans appear.</p>`,async form=>{const result=await request(`/trips${value.id?'/'+encodeURIComponent(value.id):''}`,{method:value.id?'PATCH':'POST',body:JSON.stringify(Object.fromEntries(form))});selected=result.id;});
  }
  function editPlan(p={}) {
    const t=current(),party=data.parties.find(v=>v.id===t.partyId),ids=p.profileIds || (party.members.some(m=>m.disneyProfileId===data.selfProfileId)?[data.selfProfileId]:[]);
    editor(p.id?'Edit manual plan':'Add Plan',input('title','Title',p.title,'text','required maxlength="200"')+input('date','Date',p.date || t.startDate,'date',`required min="${t.startDate}" max="${t.endDate}"`)+input('startTime','Start time',p.startTime,'time','required')+input('endTime','End time (optional)',p.endTime,'time')+input('location','Location (optional)',p.location)+`<label><span>Notes (optional)</span><textarea name="notes" maxlength="4000">${esc(p.notes)}</textarea></label><label><span>Plan type</span><select name="type">${['experience','dining','lightning_lane','park_reservation','entertainment','transportation'].map(type=>`<option value="${type}" ${p.type===type?'selected':''}>${esc(type.replaceAll('_',' '))}</option>`).join('')}</select></label><fieldset><legend>Participants</legend>${!ids.length && !p.id?'<p>Your linked profile is not in this Saved Party. Choose participants, or leave unassigned.</p>':''}${party.members.map(m=>`<label class="trip-check"><input type="checkbox" name="profileIds" value="${esc(m.disneyProfileId)}" ${ids.includes(m.disneyProfileId)?'checked':''}>${esc(m.displayName)}</label>`).join('')}</fieldset>`,async form=>{await request(`/trips/${encodeURIComponent(t.id)}/plans${p.id?'/'+encodeURIComponent(p.id):''}`,{method:p.id?'PATCH':'POST',body:JSON.stringify({...Object.fromEntries(form),profileIds:form.getAll('profileIds')})});});
  }
  root.addEventListener('click',async event=>{
    const b=event.target.closest('[data-trip-action]');if(!b || !data)return;
    const action=b.dataset.tripAction,t=current();
    try {
      if(action==='select'){selected=b.dataset.id;expanded=null;render();}
      if(action==='day'){const set=days.get(t.id);set.has(b.dataset.date)?set.delete(b.dataset.date):set.add(b.dataset.date);render();}
      if(action==='plan'){expanded=expanded===b.dataset.id?null:b.dataset.id;render();}
      if(action==='directions'){const plan=data.itineraries[t.id].find(p=>p.id===b.dataset.id);if(plan)openDirections(directionsLocationForPlan(plan));}
      if(action==='new-trip')editTrip();if(action==='edit-trip')editTrip(t);
      if(action==='suggestion')editTrip(suggestions(data.discovery,data.parties,data.trips)[Number(b.dataset.index)]);
      if(action==='add-plan')editPlan();
      if(action==='edit-plan')editPlan(data.itineraries[t.id].find(p=>p.id===b.dataset.id));
      if(action==='parties')openParties();
      if(action==='delete-trip' && confirm(`Delete “${t.name}” and its manual plans? The Saved Party and sourced reservations will remain.`)){await request('/trips/'+encodeURIComponent(t.id),{method:'DELETE'});selected=null;await load();}
      if(action==='delete-plan' && confirm('Delete this manually entered plan?')){await request(`/trips/${encodeURIComponent(t.id)}/plans/${encodeURIComponent(b.dataset.id)}`,{method:'DELETE'});expanded=null;await load();}
    }catch(error){message(error.message);}
  });
  document.addEventListener('click',event=>{const link=event.target.closest('[data-trip-link]');if(link)open({tripId:link.dataset.tripLink,date:link.dataset.date,planId:link.dataset.plan});});
  async function open(link){
    selected=link.tripId;target=link;showPage('trip');await load();if(data)render();
    const plan=data?.itineraries[link.tripId]?.find(p=>p.id===link.planId);
    if(lastLoadSucceeded&&!plan)message('This plan is no longer in this Trip. Your current plans are shown below.');
    if(plan&&new URL(location.href).searchParams.get('workflow')==='lightning-lane'){
      const a=document.createElement('a');a.href='./lightning-lanes.html?from='+encodeURIComponent(location.pathname+location.search);a.textContent='Open Lightning Lane';a.className='party-secondary-button';root.prepend(a);
    }
    if(link.planId)root.querySelector(`[data-trip-action="plan"][data-id="${CSS.escape(link.planId)}"]`)?.scrollIntoView({block:'center'});
  }
  document.addEventListener('disneyos:page',event=>{if(event.detail!=='trip'){expanded=null;if(data)render();}});
  window.setInterval(()=>{
    if(!data || dialog.open)return;
    if(document.getElementById('trip-page')?.classList.contains('active'))render();
    else if(document.getElementById('home-page')?.classList.contains('active'))renderHome();
  },60000);
  function editParty(party,membership,onSaved) {
    const selectedIds=party.members.map(m=>m.disneyProfileId);
    const profiles=new Map([...(membership.profileAccess || []),...party.members].map(p=>[p.disneyProfileId,p]));
    const owned=party.createdByMemberId===membership.memberId;
    editor('Edit Saved Party',input('displayName','Party name',party.displayName,'text',`required ${owned?'':'readonly'}`)+`<fieldset><legend>People</legend>${[...profiles.values()].map(p=>`<label class="trip-check"><input name="profileIds" type="checkbox" value="${esc(p.disneyProfileId)}" ${selectedIds.includes(p.disneyProfileId)?'checked':''}>${esc(p.displayName)}</label>`).join('')}</fieldset><p>Membership updates apply to every linked Trip.</p>`,async form=>{
      const profileIds=form.getAll('profileIds');
      const removed=selectedIds.some(id=>!profileIds.includes(id));
      let confirmTripImpact=false;
      if(removed && party.tripReferences?.length){confirmTripImpact=confirm('Removing people affects linked Trips. Plans qualifying only through them may disappear. Apply this change?');if(!confirmTripImpact)throw Error('No changes saved.');}
      await request(`/parties/${encodeURIComponent(party.id)}/members`,{method:'POST',body:JSON.stringify({profileIds,confirmTripImpact})});
      if(owned && form.get('displayName')!==party.displayName)await request(`/parties/${encodeURIComponent(party.id)}`,{method:'PATCH',body:JSON.stringify({displayName:form.get('displayName')})});
      await onSaved();
    });
  }
  return {load,open,editParty,context:()=>{const t=current(),p=data?.itineraries[t?.id]?.find(p=>p.id===expanded),party=data?.parties.find(p=>p.id===t?.partyId);return {tripId:t?.id,tripName:t?.name,date:p?.date||[...(days.get(t?.id)||[])].at(-1),planId:expanded,partySize:party?.members.length};}};
}
