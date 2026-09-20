import {DESTINATIONS, today, validDate, escapeHtml as esc, rideStatus, sortRides, freshness, scheduleText, time, matches, mapUrl, diningHours, diningCategory, diningIndicators} from './parks-model.mjs';

const root=document.getElementById('parks-page');
const API='https://disneyos-api.disneyosplanner.workers.dev/v1';
const labels={rides:'Wait Times',entertainment:'Entertainment',dining:'Dining',transportation:'Transportation',services:'Guest Services'};
const icons={rides:'◷',entertainment:'♫',dining:'♨',transportation:'⇄',services:'✚'};
const notes={unsupported:'Not available yet',unavailable:'Information unavailable', 'not-published':'Not published yet'};
const storage={get(key){try{return JSON.parse(sessionStorage.getItem(key));}catch{return null;}},set(key,value){try{sessionStorage.setItem(key,JSON.stringify(value));}catch{}}};
let context=storage.get('disneyos-parks-context') || {}, area='', itemKey='', query='', scope='park', diningFilter='', detailReturn=null;
let park=DESTINATIONS[context.park]?context.park:'', date=validDate(context.date)?context.date:today();
const records=new Map(), pending=new Map(), detailRecords=new Map(), detailPending=new Set();
// Official directory reference links. These are resort-wide references, not an invented facility inventory.
const serviceReferences=[['Restrooms','restrooms'],['First Aid','first-aid'],['Baby Care Centers','baby-care-centers'],
  ['Guest Relations','guest-relations'],['Lockers','locker-rentals'],['Accessibility','guests-with-disabilities'],
  ['Service Animals','service-animals'],['Smoking Areas','designated-smoking-areas'],['Lost & Found','lost-and-found'],
  ['Charging / Portable Phone Chargers','portable-phone-chargers']];
const services=serviceReferences.map(([name,slug])=>({id:slug,name,description:'Walt Disney World reference. Check Disney’s directory for locations and availability.',url:`https://disneyworld.disney.go.com/guest-services/${slug}/`}));
const anchor=(url,text)=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(text)} ↗</a>`;
const key=(p=park,d=date)=>`${p}:${d}`;
function current(p=park){return records.get(key(p)) || storage.get('disneyos-parks-data:'+key(p));}
function route(read=false,replace=false) {
  const url=new URL(location.href);
  if(read){
    if(url.searchParams.has('destination')) park=DESTINATIONS[url.searchParams.get('destination')]?url.searchParams.get('destination'):'';
    date=validDate(url.searchParams.get('parksDate'))?url.searchParams.get('parksDate'):date;
    area=labels[url.searchParams.get('area')]?url.searchParams.get('area'):'';
    itemKey=url.searchParams.get('item') || '';
    if(park==='disney-springs' && area==='rides')area='';
  } else {
    url.searchParams.set('view','parks');
    for(const [name,value] of Object.entries({destination:park,parksDate:date,area,item:itemKey}))value?url.searchParams.set(name,value):url.searchParams.delete(name);
    // An empty destination explicitly represents the selector when using browser Back.
    if(!park)url.searchParams.set('destination','');
    history[replace?'replaceState':'pushState']({},'',url);
  }
  storage.set('disneyos-parks-context',{park,date});
}
async function load(p=park,force=false) {
  if(!p)return;
  const d=date, cacheKey=key(p,d);
  if(pending.has(cacheKey))return pending.get(cacheKey);
  const saved=records.get(cacheKey) || storage.get('disneyos-parks-data:'+cacheKey);
  if(saved)records.set(cacheKey,saved);
  if(!force && saved && Date.now()-saved.fetched<60000)return;
  const request=(async()=>{
    try {
      const response=await fetch(`${API}/park-explorer?park=${encodeURIComponent(p)}&date=${d}`,{cache:'no-store',signal:AbortSignal.timeout(20000)});
      const payload=await response.json();
      if(!response.ok || !payload.success || payload.data?.park!==p || payload.data?.date!==d)throw new Error('Unavailable');
      const data=payload.data;
      for(const name of ['hours','rides','entertainment','dining','transportation'])if(!data[name] || !Array.isArray(data[name].items))data[name]={state:'unavailable',items:[]};
      for(const name of ['hours','rides','entertainment','dining','transportation']) {
        if(data[name]?.state==='unavailable' && saved?.[name]?.items?.length)data[name]={...saved[name],failed:true};
      }
      if(data.dining.enrichmentState==='unavailable' && saved?.dining?.items?.length){
        const old=new Map(saved.dining.items.map(x=>[String(x.id),x]));
        data.dining.items=data.dining.items.map(x=>({...old.get(String(x.id)),...x}));
        if(!data.dining.items.length)data.dining.items=saved.dining.items;
        data.dining.failed=true;
      }
      data.fetched=Date.now();records.set(cacheKey,data);storage.set('disneyos-parks-data:'+cacheKey,data);
    }catch{
      const data=saved?{...saved}: {park:p,date:d};
      for(const name of ['hours','rides','entertainment','dining','transportation'])data[name]=data[name]?{...data[name],failed:true}:{state:'unavailable',items:[]};
      data.failed=true;records.set(cacheKey,data);
    }finally{pending.delete(cacheKey);if(date===d && (park===p || scope==='all'))renderContent();}
  })();
  pending.set(cacheKey,request);return request;
}
function navigate(next={}){
  ({park,date,area,itemKey}={park,date,area,itemKey,...next});query='';diningFilter='';route();render();void load();
}
function render(){
  if(!park){
    root.innerHTML=`<div class="page-title-block"><p class="eyebrow">Explore</p><h2>Parks</h2><p>Choose a destination. Explore today or plan ahead.</p></div><div class="park-list">${Object.entries(DESTINATIONS).map(([id,name])=>`<article class="park-card"><div class="park-card-overlay"><h3>${esc(name)}</h3><button class="park-live-button" data-destination="${id}">Explore ${esc(name)}</button></div></article>`).join('')}</div>`;
    return;
  }
  root.innerHTML=`<div class="parks-explorer"><div class="parks-context"><button data-back aria-label="${itemKey?'Back to '+(labels[area] || 'Search'):area?'Back to Explorer':'Back to destinations'}">‹ Back</button><label class="parks-destination"><span class="parks-sr">Destination</span><select id="parks-destination">${Object.entries(DESTINATIONS).map(([id,name])=>`<option value="${id}" ${id===park?'selected':''}>${esc(name)}</option>`).join('')}</select></label><label class="parks-date"><span>▦ ${date===today()?'Today · ':''}${new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'))}</span><input id="parks-date" type="date" aria-label="Explore date" min="${today()}" value="${date}"></label></div><div id="parks-hours" class="parks-hours" aria-live="polite"></div><div id="parks-snapshot"></div><div class="parks-search"><input id="parks-query" type="search" placeholder="Search this destination" aria-label="Search Parks" value="${esc(query)}"><select id="parks-scope" aria-label="Search scope"><option value="park">This destination</option><option value="all" ${scope==='all'?'selected':''}>All Walt Disney World</option></select></div><div id="parks-content" aria-live="polite"></div><p class="parks-source">Waits: Queue-Times · Schedules: ThemeParks.wiki · Dining: Disney<br>Times shown in Walt Disney World local time.</p></div>`;
  renderContent();
}
function dataNote(part,empty='No entries available.'){return part?.failed?'Saved information · refresh unavailable':notes[part?.state] || (!part?.items?.length?empty:'');}
function rideLabel(ride,part){return `${rideStatus(ride,date!==today())}${date===today()?' · '+freshness(ride.lastUpdated || part?.updated,part?.failed):''}`;}
function row(item,type,p=park){
  const detail=[DESTINATIONS[p],item.land,type==='rides'?rideLabel(item,current(p)?.rides):type==='entertainment'?scheduleText(item,date):type==='transportation'?'Static reference':type==='dining'?[diningHours(item,date),diningIndicators(item)].filter(Boolean).join(' · '):item.description].filter(Boolean).join(' · ');
  return `<button class="parks-row" data-item="${esc(item.id || item.name)}" data-type="${type}" data-park="${p}"><span><strong>${esc(item.name)}</strong><small>${esc(detail)}</small></span><span aria-hidden="true">›</span></button>`;
}
function items(p,type){return type==='services'?services:current(p)?.[type]?.items || [];}
function renderContent(){
  if(!park || !document.getElementById('parks-content'))return;
  const data=current(), content=document.getElementById('parks-content');
  const hours=data?.hours, entries=hours?.items || [];
  document.getElementById('parks-hours').textContent=!data?'Loading park information…':entries.length?`${hours.failed?'Saved · ':''}${date===today()?'':'Published · '}${entries.map(x=>`${x.description || x.type || 'Hours'} ${time(x.openingTime)}–${time(x.closingTime)}`).join(' · ')}`:(hours?.state==='not-published'?'Hours not published yet':hours?.state==='unsupported'?'Hours not available yet':'Hours unavailable');
  const regular=entries.find(x=>/^(operating|regular|park hours)$/i.test(x.type || ''));
  if(date===today() && regular?.openingTime && regular?.closingTime){
    const open=Date.parse(regular.openingTime),close=Date.parse(regular.closingTime);
    if(Number.isFinite(open) && Number.isFinite(close))document.getElementById('parks-hours').textContent=`${Date.now()>=open && Date.now()<close?'Scheduled open':'Scheduled closed'} · `+document.getElementById('parks-hours').textContent;
  }
  const snapshot=document.getElementById('parks-snapshot');
  snapshot.innerHTML='';
  if(!area && !query && !itemKey && park!=='disney-springs') {
    const operating=sortRides(items(park,'rides')).filter(r=>rideStatus(r).endsWith(' min'));
    const headliner=/seven dwarfs|tron|space mountain|rise of the resistance|slinky|flight of passage|everest|cosmic rewind|remy|test track/i;
    operating.sort((a,b)=>Number(headliner.test(b.name))-Number(headliner.test(a.name)));
    snapshot.innerHTML=date!==today()?'<p class="parks-note">Predictive wait data not yet available. Browse ride references in Wait Times.</p>':`<div class="parks-snapshot">${operating.slice(0,3).map(r=>`<button data-area="rides"><strong>${esc(r.name)}</strong><span>${esc(rideStatus(r))}</span><small>${esc(freshness(r.lastUpdated || data?.rides?.updated,data?.rides?.failed))}</small></button>`).join('')}</div>${!operating.length?`<p class="parks-note">${data?esc(dataNote(data.rides,'No operating waits available.')):'Loading waits…'}</p>`:''}`;
  }
  if(itemKey){renderDetail(content);return;}
  if(query.trim()){
    const parks=scope==='all'?Object.keys(DESTINATIONS):[park];
    content.innerHTML=Object.entries(labels).map(([type,label])=>{
      const hits=(type==='services'?[park]:parks).flatMap(p=>items(p,type).filter(i=>matches(i,query)).map(i=>row(i,type,p)));
      return hits.length?`<h3>${label}</h3>${hits.join('')}`:'';
    }).join('') || '<p class="parks-note">No matches in available reference data.</p>';
    content.innerHTML+='<p class="parks-note">Search covers available reference data. Some destination information and restaurant metadata may be unavailable.</p>';
    if(parks.some(p=>pending.has(key(p))))content.innerHTML+='<p>Searching destinations…</p>';
    if(parks.some(p=>current(p)?.failed))content.innerHTML+='<p>Some destination information is unavailable.</p>';
    return;
  }
  if(!area){
    const types=park==='disney-springs'?['dining','transportation','services']:['rides','entertainment','dining','transportation','services'];
    content.innerHTML=`<div class="parks-grid">${anchor(mapUrl(park,matchMedia('(max-width:767px), (hover:none) and (pointer:coarse)').matches),'⌖ Map')}${types.map(type=>`<button data-area="${type}"><span aria-hidden="true">${icons[type]}</span>${labels[type]}</button>`).join('')}</div>`;return;
  }
  let list=items(park,area);if(area==='rides')list=date===today()?sortRides(list):[...list].sort((a,b)=>a.name.localeCompare(b.name));
  else list=[...list].sort((a,b)=>a.name.localeCompare(b.name));
  content.innerHTML=`<div class="parks-section-title"><h3>${labels[area]}</h3><button data-refresh ${pending.has(key())?'disabled':''}>Refresh</button></div>`;
  if(!data && area!=='services'){content.innerHTML+='<p>Loading…</p>';return;}
  if(area==='rides' && date!==today())content.innerHTML+='<p class="parks-note">Predictive wait data not yet available. These are static ride references.</p>';
  const note=dataNote(data?.[area]);if(note && area!=='services')content.innerHTML+=`<p class="parks-note">${esc(note)}</p>`;
  if(area==='dining'){
    content.innerHTML+=`<div class="parks-shortcuts">${['','Quick Service','Table Service','Snacks / Other','Mobile Order'].map(x=>`<button data-dining="${x}" aria-pressed="${diningFilter===x}">${x || 'All'}</button>`).join('')}</div><p>${data?.dining?.enrichmentState==='available'?'Alphabetical restaurants · Disney reference information.':list.length?'Alphabetical restaurant references. Some dining metadata is unavailable.':'Dining directory not available yet.'} Browse Disney’s official directory for details.</p>${anchor('https://disneyworld.disney.go.com/dining/','Official dining directory')}`;
    if(diningFilter){
      const classified=data?.dining?.enrichmentState==='available' || list.some(x=>diningFilter==='Mobile Order'?typeof x.mobileOrder==='boolean':x.serviceType);
      if(classified){list=list.filter(x=>diningCategory(x,diningFilter));if(!list.length)content.innerHTML+='<p>No matching restaurants in the available data.</p>';}
      else content.innerHTML+='<p class="parks-note">Category information not available yet. Showing all known restaurants.</p>';
    }
  }
  if(area==='entertainment'){
    if(date!==today())content.innerHTML+='<p class="parks-note">Published times are shown when available. The schedule may be incomplete; missing times are not published yet.</p>';
    content.innerHTML+=list.filter(x=>x.category!=='character').map(x=>row(x,area)).join('');
    content.innerHTML+='<h4>Characters</h4>'+(list.filter(x=>x.category==='character').map(x=>row(x,area)).join('') || '<p>Character reference information not available yet.</p>');return;
  }
  content.innerHTML+=list.map(x=>row(x,area)).join('');
  if(area==='transportation')content.innerHTML+='<p class="parks-note">Transportation Planner — Coming Soon</p>';
  if(area==='services')content.innerHTML+='<p class="parks-note">These are resort-wide references. Disney’s directory identifies which services are available at each destination.</p>';
}
async function loadDiningDetail(item){
  const id=item.disneyId,saved=detailRecords.get(id) || storage.get('disneyos-dining-detail:'+id);
  if(detailPending.has(id) || (saved && Date.now()-saved.fetched<(saved.failed?60000:86400000)))return;
  if(saved)detailRecords.set(id,saved);
  detailPending.add(id);
  try{
    const response=await fetch(API+'/parks-dining-detail?'+new URLSearchParams({id,slug:item.officialSlug,date}),{cache:'no-store',signal:AbortSignal.timeout(8000)});
    const payload=await response.json();
    if(!response.ok || !payload.success || payload.data?.disneyId!==id)throw Error('Unavailable');
    const value={...payload.data,fetched:Date.now()};detailRecords.set(id,value);storage.set('disneyos-dining-detail:'+id,value);
  }catch{detailRecords.set(id,{...saved,failed:true,fetched:Date.now()});}
  finally{detailPending.delete(id);if(area==='dining' && itemKey===String(item.id))renderContent();}
}
function renderDetail(content){
  const item=items(park,area).find(x=>String(x.id || x.name)===itemKey);
  if(!item){content.innerHTML=`<p>${pending.has(key())?'Loading detail…':'Item information unavailable.'}</p>`;return;}
  let html=`<article class="parks-detail"><p class="eyebrow">${labels[area]}</p><h3>${esc(item.name)}</h3>${item.land?`<p>${esc(item.land)}</p>`:''}`;
  const part=current()?.[area];
  if(area==='rides')html+=`<p>${esc(rideLabel(item,part))}</p>${date!==today()?'<p>Predictive wait data not yet available.</p>':''}`;
  if(area==='entertainment'){
    html+=`<p>${esc(scheduleText(item,date))}</p>`;
    const remaining=(item.showtimes || []).filter(t=>t.startTime?.slice(0,10)===date && (date!==today() || Date.parse(t.endTime || t.startTime)>Date.now()));
    html+=remaining.map(t=>`<p>${esc(time(t.startTime))}${t.endTime?'–'+esc(time(t.endTime)):''}</p>`).join('');
  }
  if(part?.failed)html+='<p>Saved information · refresh unavailable</p>';
  for(const field of ['description','cuisine','serviceType','heightRequirement','accessibility','duration','priceRange','phone'])if(item[field] && !(area==='dining' && field==='priceRange'))html+=`<p>${esc(({description:'Description',cuisine:'Cuisine',serviceType:'Service type',heightRequirement:'Height requirement',accessibility:'Accessibility',duration:'Duration',priceRange:'Price range',phone:'Phone'})[field])}: ${esc(item[field])}</p>`;
  if(item.lightningLane==='MULTI_PASS' || item.lightningLane==='SINGLE_PASS')html+=`<p>${item.lightningLane==='MULTI_PASS'?'ϟϟ Multi Pass':'ϟ Single Pass'}</p>`;
  if(area==='services')html+=anchor(item.url,'Official service information');
  if(area==='dining'){
    if(item.disneyId && item.officialSlug)void loadDiningDetail(item);
    const extra=detailRecords.get(item.disneyId) || storage.get('disneyos-dining-detail:'+item.disneyId);
    html+=`<p>${esc(diningHours(item,date))}</p><p>${esc(diningIndicators(item))}</p>`;
    if(item.characterDining)html+='<p>Character Dining</p>';
    if(item.reservationsRecommended)html+='<p>Reservations strongly recommended</p>';
    if(extra?.description)html+=`<p>${esc(extra.description)}</p>`;
    if(extra?.phone)html+=`<p>Phone: ${esc(extra.phone)}</p>`;
    if(extra?.menuUrl)html+=`<p>${anchor(extra.menuUrl,'Official menu')}</p>`;
    if(extra?.failed)html+='<p class="parks-note">Additional restaurant details unavailable.</p>';
    if(detailPending.has(item.disneyId))html+='<p class="parks-note">Loading restaurant details…</p>';
    html+=`<p>${anchor(item.detailUrl || 'https://disneyworld.disney.go.com/dining/',item.detailUrl?'Official Disney restaurant page':'Official dining directory')}</p>`;
  }
  const url=mapUrl(park,matchMedia('(max-width:767px), (hover:none) and (pointer:coarse)').matches);
  html+=`<p>${anchor(area==='services' && item.id==='restrooms'?'https://disneyworld.disney.go.com/guest-services/restrooms/':url,'View on Disney Map')}</p><p class="parks-note">${area==='services' && item.id==='restrooms'?'Use Disney’s restroom finder and map controls.':'Opens the destination map/reference page. A direct link to this specific location is not available.'}</p>`;
  content.innerHTML=html+'</article>';
}
root.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-destination'))navigate({park:b.dataset.destination,area:'',itemKey:''});
  else if(b.hasAttribute('data-area'))navigate({area:b.dataset.area,itemKey:''});
  else if(b.hasAttribute('data-back')){if(itemKey && detailReturn){({park,area,query,scope}=detailReturn);itemKey='';detailReturn=null;route();render();}else if(itemKey)navigate({itemKey:''});else if(area)navigate({area:''});else navigate({park:'',area:''});}
  else if(b.hasAttribute('data-item')){detailReturn={park,area,query,scope};navigate({park:b.dataset.park,area:b.dataset.type,itemKey:b.dataset.item});}
  else if(b.hasAttribute('data-refresh')){void load(park,true);renderContent();}
  else if(b.hasAttribute('data-dining')){diningFilter=b.dataset.dining;renderContent();}
});
root.addEventListener('change',event=>{
  if(event.target.id==='parks-destination')navigate({park:event.target.value,itemKey:'',area:event.target.value==='disney-springs' && area==='rides'?'':area});
  if(event.target.id==='parks-date'){if(validDate(event.target.value))navigate({date:event.target.value});else event.target.value=date;}
  if(event.target.id==='parks-scope'){scope=event.target.value;if(scope==='all')for(const p of Object.keys(DESTINATIONS))void load(p);renderContent();}
});
root.addEventListener('input',event=>{if(event.target.id==='parks-query'){query=event.target.value;itemKey='';if(scope==='all')for(const p of Object.keys(DESTINATIONS))void load(p);renderContent();}});
window.addEventListener('popstate',()=>{route(true);query='';render();void load();});
document.addEventListener('disneyos:page',event=>{if(event.detail==='parks'){if(!validDate(date))date=today();render();void load();}});
setInterval(()=>{if(root.classList.contains('active')){if(!validDate(date)){date=today();route(false,true);render();void load();}else renderContent();}},60000);
route(true);if(new URL(location.href).searchParams.get('view')==='parks')route(false,true);render();if(park)void load();
