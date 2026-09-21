const API='https://disneyos-api-dev.disneyosplanner.workers.dev/v1';
const PUBLIC='https://disneyos-api.disneyosplanner.workers.dev/v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={dining:'Dining',extras:'Enchanting Extras',wait:'Wait Time',back_up:'Ride Back Up'};
const states={watching:'Watching',paused:'Paused',completed:'Completed',expired:'Expired',monitoring_issue:'Monitoring Issue'};
const types={WatchCreated:'Watch created',WatchCriteriaChanged:'Criteria changed',WatchPaused:'Paused',WatchResumed:'Resumed',MatchFound:'Match available',MatchUpdated:'Availability updated',MatchExpired:'No longer available',WaitThresholdReached:'Wait threshold reached',RideBackUp:'Ride reporting operational',BookingObserved:'Matching reservation booked. Stop watching?',WatchCompleted:'Completed',WatchExpired:'Expired',MonitoringIssue:'Monitoring issue',WatchRecovered:'Monitoring recovered',UserActionRequired:'Action required',BookingAcknowledged:'Keep watching'};
const parks={'magic-kingdom':'Magic Kingdom',epcot:'EPCOT','hollywood-studios':'Hollywood Studios','animal-kingdom':'Animal Kingdom','disney-springs':'Disney Springs'};
const finite=w=>['dining','extras'].includes(w.category);
const day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const root=document.getElementById('alerts-content'),dialog=document.getElementById('alert-editor'),status=document.getElementById('alerts-status');
let data=null,editing=null,draft=null,selected=new Set(),month=day().slice(0,7),targets=[],generation=0,busy=false,loaded=0,proposals=[],proposalIndex=null;
document.addEventListener('disneyos:genie-context',e=>{if(e.detail.screen==='alerts'){const id=document.querySelector('#alerts-content details[open]')?.id?.replace(/^watch-/,'')||new URL(location.href).searchParams.get('watch');const w=data?.watches.find(w=>w.id===id);Object.assign(e.detail,{watchId:w?.id,park:w?.park,date:w?.dates?.[0]||day()});}});
document.addEventListener('disneyos:genie-saved',()=>refresh());
const btn=(action,text,id='')=>`<button type="button" data-alert-action="${action}" data-id="${esc(id)}">${text}</button>`;
async function request(path,options={}){
 const token=localStorage.getItem('disneyos-member-device-token');if(!token)throw Error('Active membership is required.');
 const r=await fetch(API+path,{...options,cache:'no-store',headers:{Authorization:`Bearer ${token}`,Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})}});
 const p=await r.json();if(!r.ok||!p.success)throw Error(p?.error?.message||'Alerts is temporarily unavailable.');return p.data;
}
function criteriaText(w){return [finite(w)?w.dates.join(', '):parks[w.park],finite(w)?`Party ${w.partySizes.join('/')}`:w.category==='wait'?`${w.threshold} minutes or less`:'When operation resumes',w.timeMode==='range'?`${w.startTime}–${w.endTime}`:finite(w)?'Any time':w.activation==='dates'?w.dates.join(', '):'On itinerary days'].filter(Boolean).join(' · ');}
function matchHTML(w){
 if(!w.match)return '';
 const m=w.match,groups=new Map();
 for(const s of m.slots||[]){const k=`${s.date} · ${s.time}`;if(!groups.has(k))groups.set(k,new Set());groups.get(k).add(s.partySize);}
 return `<div class="alert-match"><strong>${m.status==='stale'?'Last-known availability':'Match Available'}</strong>${[...groups].map(([k,v])=>`<p>${esc(k)} · Party ${[...v].sort((a,b)=>a-b).join('/')}</p>`).join('')}${m.waitMinutes!==undefined?`<p>${esc(m.waitMinutes)} minute wait</p>`:''}<small>Last confirmed ${esc(new Date(m.lastConfirmedAt).toLocaleString())}${m.status==='stale'?' · May no longer be available':''}</small></div>`;
}
function card(w){
 const historic=['completed','expired'].includes(w.state),history=data.events.filter(e=>e.watchId===w.id);
 const label=w.state==='watching'&&!finite(w)?w.activeToday===null?'Enabled / Itinerary unavailable':w.activeToday?'Enabled / Active today':'Enabled / Not active today':states[w.state];
 return `<details class="alert-card" id="watch-${esc(w.id)}"><summary><span><strong>${esc(w.targetName)}</strong><small>${esc(criteriaText(w))}</small></span><span class="alert-state">${esc(label)}${w.capability==='awaiting_source'&&!historic?' · Monitoring unavailable':''}${w.match?(w.match.status==='stale'?' · Last-known match':' · Match Available'):''}</span></summary><div class="alert-detail">${matchHTML(w)}${w.actionRequired?`<p class="alert-attention">${esc(w.actionRequired)}</p>${w.actionRequired.startsWith('Matching')?btn('complete','Stop Watching',w.id)+btn('keep','Keep Watching',w.id):''}`:''}${w.capability==='awaiting_source'&&!historic?'<p class="alert-notice">Criteria saved. Live availability monitoring is not available yet.</p>':''}${w.state==='monitoring_issue'?'<p>Monitoring is temporarily interrupted. We will keep trying.</p>':''}<p>${esc(labels[w.category])} · ${esc(criteriaText(w))}</p>${w.note?`<p>${esc(w.note)}</p>`:''}<div class="alert-actions">${historic?btn('again','Watch Again',w.id):btn('edit','Edit',w.id)+btn(w.state==='paused'?'resume':'pause',w.state==='paused'?'Resume':'Pause',w.id)+btn('ai-edit','Ask AI to edit',w.id)}${btn('delete','Delete',w.id)}</div><details><summary>Watch history (${history.length})</summary>${history.map(e=>`<p>${esc(types[e.type]||e.type)} <small>${esc(new Date(e.createdAt).toLocaleString())}</small></p>`).join('')}</details></div></details>`;
}
function render(){
 if(!data)return;
 const opened=[...root.querySelectorAll('details[open]')].map(x=>x.id).filter(Boolean);
 const w=data.watches,active=w.filter(x=>!['completed','expired'].includes(x.state));
 root.innerHTML=`<section><h3>Action Required</h3>${active.filter(w=>w.actionRequired).map(card).join('')||'<p class="secondary-detail">Nothing needs your attention.</p>'}</section><section><h3>Watching</h3>${active.filter(w=>finite(w)&&!w.actionRequired).map(card).join('')||'<p class="secondary-detail">Create a Dining or Enchanting Extras Watch.</p>'}</section><section><h3>Daily Alerts</h3>${active.filter(w=>!finite(w)&&!w.actionRequired).map(card).join('')||'<p class="secondary-detail">Watch for a shorter wait or a ride returning to operation.</p>'}</section><details id="alerts-history"><summary>History (${w.length-active.length})</summary>${w.filter(w=>!active.includes(w)).map(card).join('')}</details>`;
 for(const id of opened){const el=document.getElementById(id);if(el)el.open=true;}
 const badge=document.getElementById('alerts-badge');badge.textContent=data.actionCount;badge.hidden=!data.actionCount;document.dispatchEvent(new CustomEvent('disneyos:actions',{detail:data.actionCount}));
 const home=document.getElementById('home-alerts');home.hidden=!data.home.length;home.innerHTML=data.home.map(e=>`<a href="?view=alerts&watch=${encodeURIComponent(e.watchId)}">${esc(types[e.type]||e.type)} · ${esc(e.targetName)}</a>`).join('')+(data.more?`<a href="?view=alerts">${data.more} more alerts</a>`:'');
 document.getElementById('alerts-activity-list').innerHTML=data.recent.map(e=>`<a data-alert-event="${esc(e.id)}" href="?view=alerts&watch=${encodeURIComponent(e.watchId)}">${esc(types[e.type]||e.type)} · ${esc(e.targetName)}${e.readAt?'':' · New'}</a>`).join('')||'<p>No recent Watch activity.</p>';
 const focus=new URL(location.href).searchParams.get('watch');if(focus){const el=document.getElementById('watch-'+focus);if(el){el.open=true;const w=data.watches.find(w=>w.id===focus);if(w&&!w.match&&!w.actionRequired)el.querySelector('.alert-detail').insertAdjacentHTML('afterbegin','<p>That availability is no longer available. Check the current Watch status below.</p>');}else{root.insertAdjacentHTML('afterbegin','<p>This Watch is no longer available. Your other Watches are below.</p>');}}
 document.dispatchEvent(new CustomEvent('disneyos:activity-rendered'));
}
async function refresh(){if(busy)return;busy=true;try{const incoming=await request('/alerts');if(!incoming||!['watches','events','recent','home'].every(key=>Array.isArray(incoming[key]))||!incoming.capabilities)throw Error('Alerts returned an incomplete response. Try Refresh.');data=incoming;loaded=Date.now();render();status.textContent='';}catch(e){if(data){data.home=[];for(const w of data.watches)if(w.match)w.match.status='stale';render();}status.textContent=e.message;document.getElementById('alerts-activity-list').textContent='Activity is temporarily unavailable.';const home=document.getElementById('home-alerts');home.hidden=true;if(!data)root.innerHTML='<p>Your Watches could not be loaded. Try Refresh.</p>';}finally{busy=false;}}
function calendar(){
 const [y,m]=month.split('-').map(Number),days=new Date(Date.UTC(y,m,0)).getUTCDate(),offset=new Date(Date.UTC(y,m-1,1)).getUTCDay();
 document.getElementById('alert-calendar').innerHTML=`<div class="alert-calendar-heading">${btn('prev','←')}<strong>${esc(new Date(month+'-15T12:00:00Z').toLocaleDateString('en-US',{month:'long',year:'numeric',timeZone:'UTC'}))}</strong>${btn('next','→')}</div><div class="alert-calendar-grid">${['S','M','T','W','T','F','S'].map(d=>`<small>${d}</small>`).join('')}${'<span></span>'.repeat(offset)}${Array.from({length:days},(_,i)=>{const d=`${month}-${String(i+1).padStart(2,'0')}`;return `<button type="button" data-date="${d}" aria-label="${d}" aria-pressed="${selected.has(d)}" ${d<day()?'disabled':''}>${i+1}</button>`;}).join('')}</div><p class="alert-selected">Selected: ${esc([...selected].sort().join(', ')||'Tap all applicable dates')}</p>`;
}
function showEditor(w=null,proposal=null,again=false){
 if(!proposal){proposals=[];proposalIndex=null;}
 editing=again?null:w;draft=proposal?{...w,...proposal,targetId:proposal.targetQuery===w?.targetName?w.targetId:'',targetName:proposal.targetQuery||w?.targetName||''}:w?{...w}:{category:'wait',park:'magic-kingdom',activation:'itinerary',threshold:30,dates:[],partySizes:[2],timeMode:'any',notify:true};
 selected=new Set(draft.dates||[]);month=[...selected].find(d=>d>=day())?.slice(0,7)||day().slice(0,7);
 dialog.innerHTML=`<form id="alert-form"><div class="alert-editor-heading"><h2>${editing?'Edit alert':'Create an Alert'}</h2>${btn('close','Close')}</div>${proposal?'<p class="alert-notice">AI proposal — review every field, select the target and confirm before saving.</p>':''}<label>Category<select name="category" ${editing?'disabled':''}>${Object.entries(labels).map(([k,v])=>`<option value="${k}" ${draft.category===k?'selected':''}>${v}</option>`).join('')}</select></label><div id="alert-fields"></div><p id="alert-form-status" role="status"></p><div class="alert-actions"><button type="submit" class="primary-button">${editing?'Confirm changes':'Confirm and create'}</button>${btn('close','Cancel')}</div></form>`;
 fields();if(!dialog.open)dialog.showModal();
}
function fields(){
 const w=draft,fin=finite(w);
 document.getElementById('alert-fields').innerHTML=`${fin?'<p class="alert-notice">Live availability monitoring is not available yet. You can save criteria for a future source.</p>':''}<label>Destination<select name="park">${Object.entries(parks).filter(([k])=>fin||k!=='disney-springs').map(([k,v])=>`<option value="${k}" ${w.park===k?'selected':''}>${v}</option>`).join('')}</select></label><label>Search ${fin?'restaurant or experience':'attractions'}<input name="targetSearch" type="search" value="${esc(w.targetName||'')}" placeholder="Start typing a name" autocomplete="off"></label><div id="alert-targets" class="alert-targets"></div><p id="alert-target-status" role="status"></p>${w.category==='dining'?'<details><summary>Restaurant not listed?</summary><label>Intended restaurant name<input name="unlistedName" maxlength="200" value="'+esc(w.targetId?.startsWith('unmapped-dining:')?w.targetName:'')+'"></label><p>Save a named criterion. It will need a verified restaurant identity when availability connects.</p></details>':''}${w.category==='extras'?'<label>Experience name<input name="experienceName" value="'+esc(w.targetName||'')+'" maxlength="200" placeholder="Name of one intended experience"></label><p>Experience catalogue and session-specific timing are not connected. This saves a named criterion only.</p>':''}${fin?`<label>Acceptable party sizes<input name="partySizes" value="${esc((w.partySizes||[2]).join(', '))}" inputmode="numeric" placeholder="2, 4, 6"></label>`:`<label>Active on<select name="activation"><option value="itinerary" ${w.activation==='itinerary'?'selected':''}>Days this park is in My Trip</option><option value="dates" ${w.activation==='dates'?'selected':''}>Selected dates (regardless of itinerary)</option></select></label>`}<div id="alert-dates" ${!fin&&w.activation!=='dates'?'hidden':''}><p>Select all acceptable dates</p><div id="alert-calendar"></div></div>${w.category==='dining'?`<label>Time<select name="timeMode"><option value="any">Any Time</option><option value="range" ${w.timeMode==='range'?'selected':''}>Custom Range</option></select></label><div id="alert-time-range" ${w.timeMode==='range'?'':'hidden'}><label>From<input name="startTime" type="time" value="${esc(w.startTime||'')}"></label><label>To<input name="endTime" type="time" value="${esc(w.endTime||'')}"></label></div>`:fin?'<p>Any available session · experience-specific timing will follow the booking source.</p>':''}${w.category==='wait'?`<label>Notify at this wait or less (minutes)<input name="threshold" type="number" min="0" max="300" value="${esc(w.threshold??30)}"></label><p class="secondary-detail">Below Typical is unavailable until a reliable baseline exists.</p>`:''}${w.category==='back_up'?'<p>Alert when the ride resumes reporting operation after a non-operating observation. The feed does not identify the reason it stopped.</p>':''}<details><summary>Optional note</summary><textarea name="note" maxlength="2000">${esc(w.note||'')}</textarea></details><label class="alert-check"><input name="notify" type="checkbox" ${w.notify!==false?'checked':''}> Notify me</label><small>Activity appears in DisneyOS. Enable background delivery in Settings → Notifications.</small>`;
 calendar();loadTargets();
}
async function loadTargets(){
 const mine=++generation,category=draft.category,park=dialog.querySelector('[name=park]').value;targets=[];
 const message=document.getElementById('alert-target-status');if(category==='extras'){message.textContent='Enter the intended experience name below.';return;}
 message.textContent='Loading targets…';
 try{const path=category==='dining'?`/park-explorer?park=${park}&date=${day()}`:`/wait-times?park=${park}`;const r=await fetch(PUBLIC+path,{cache:'no-store'}),p=await r.json();if(!r.ok||!p.success)throw Error();if(mine!==generation)return;
 targets=(category==='dining'?p.data.dining?.items:p.data.attractions||[]).map(t=>({id:category==='dining'?String(t.id):`queue-times:${t.id}`,name:t.name}));message.textContent=targets.length?'Choose one target.':'No targets available from this source.';renderTargets();
 }catch{if(mine===generation)message.textContent='Target list unavailable. Try another destination or reopen the form.';}
}
function renderTargets(){const q=dialog.querySelector('[name=targetSearch]').value.toLowerCase();document.getElementById('alert-targets').innerHTML=targets.filter(t=>t.name.toLowerCase().includes(q)).slice(0,12).map(t=>`<button type="button" data-target-id="${esc(t.id)}" aria-pressed="${t.id===draft.targetId}">${esc(t.name)}</button>`).join('');}
async function change(w,action){if(action==='delete'&&!confirm('Delete this Watch and remove it from your history?'))return;try{await request('/alerts/watches/'+encodeURIComponent(w.id),{method:'PATCH',body:JSON.stringify({action,revision:w.revision})});await refresh();}catch(e){status.textContent=e.message;}}
async function ai(w=null){
 editing=w;proposals=[];proposalIndex=null;dialog.innerHTML=`<form id="alert-ai-form"><div class="alert-editor-heading"><h2>${w?'Propose an edit':'Ask the AI assistant'}</h2>${btn('close','Close')}</div><p>Describe one or more alerts. You will review and confirm each separately.</p><label>Your request<textarea name="text" maxlength="1200" required placeholder="Let me know when Space Mountain is 30 minutes or less."></textarea></label><p id="alert-form-status" role="status"></p><button type="submit" class="primary-button">Propose criteria</button></form>`;dialog.showModal();
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-alert-action]');if(!b)return;const a=b.dataset.alertAction,w=data?.watches.find(w=>w.id===b.dataset.id);
 if(a==='refresh')return refresh();if(a==='new')return showEditor();if(a==='ai'||a==='ai-edit')return ai(w);
 if(a==='close'){dialog.close();generation++;return;}
 if(a==='edit'||a==='again')return showEditor(w,null,a==='again');
 if(a==='prev'||a==='next'){const d=new Date(month+'-15T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+(a==='next'?1:-1));month=d.toISOString().slice(0,7);calendar();return;}
 if(a==='proposal'){proposalIndex=Number(b.dataset.id);const proposal=proposals[proposalIndex];return showEditor(editing,proposal);}
 if(w)return change(w,a);
});
dialog.addEventListener('click',e=>{
 const d=e.target.closest('[data-date]');if(d){selected.has(d.dataset.date)?selected.delete(d.dataset.date):selected.add(d.dataset.date);calendar();}
 const t=e.target.closest('[data-target-id]');if(t){const target=targets.find(tg=>tg.id===t.dataset.targetId);draft.targetId=target.id;draft.targetName=target.name;dialog.querySelector('[name=targetSearch]').value=target.name;renderTargets();}
});
dialog.addEventListener('input',e=>{if(e.target.name==='targetSearch'){draft.targetId='';draft.targetName=e.target.value;renderTargets();}});
dialog.addEventListener('change',e=>{
 const n=e.target.name;
 if(n==='category'){draft.category=e.target.value;draft.targetId='';draft.targetName='';fields();}
 if(n==='park'){draft.park=e.target.value;draft.targetId='';draft.targetName='';dialog.querySelector('[name=targetSearch]').value='';loadTargets();}
 if(n==='activation')document.getElementById('alert-dates').hidden=e.target.value!=='dates';
 if(n==='timeMode')document.getElementById('alert-time-range').hidden=e.target.value!=='range';
});
dialog.addEventListener('submit',async e=>{
 e.preventDefault();const form=e.target,button=form.querySelector('[type=submit]'),message=document.getElementById('alert-form-status'),f=new FormData(form);button.disabled=true;
 try{
  if(form.id==='alert-ai-form'){
   const result=await request('/alerts/propose',{method:'POST',body:JSON.stringify({text:f.get('text'),watchId:editing?.id})});proposals=result.proposals;
   dialog.innerHTML=`<div class="alert-editor-heading"><h2>Review proposals</h2>${btn('close','Close')}</div><p>${esc(result.explanation)}</p>${proposals.map((p,i)=>`<article class="alert-card"><h3>${esc(p.targetQuery)}</h3><p>${esc(labels[p.category])} · ${esc((p.dates||[]).join(', '))}</p>${btn('proposal','Review criteria',String(i))}</article>`).join('')||'<p>Try a more specific request.</p>'}`;return;
  }
  const w={...draft,dates:[...selected].sort(),park:f.get('park'),activation:f.get('activation')||'dates',partySizes:String(f.get('partySizes')||'').split(',').map(v=>Number(v.trim())),threshold:Number(f.get('threshold')),timeMode:f.get('timeMode')||'any',startTime:f.get('startTime'),endTime:f.get('endTime'),note:f.get('note'),notify:f.has('notify')};
  if(w.category==='dining'&&String(f.get('unlistedName')||'').trim()){w.targetName=String(f.get('unlistedName')).trim();w.targetId=draft.targetId?.startsWith('unmapped-dining:')?draft.targetId:'unmapped-dining:'+crypto.randomUUID();}
  if(w.category==='extras'){w.targetName=String(f.get('experienceName')||'').trim();w.targetId=draft.targetId||'unmapped-extra:'+crypto.randomUUID();}
  if(!w.targetId||!w.targetName)throw Error('Select one target from the list.');
  await request(editing?'/alerts/watches/'+encodeURIComponent(editing.id):'/alerts',{method:editing?'PATCH':'POST',body:JSON.stringify(editing?{action:'edit',revision:editing.revision,criteria:w}:w)});dialog.close();await refresh();if(!editing)document.dispatchEvent(new CustomEvent('disneyos:watch-created'));if(proposalIndex!==null){proposals.splice(proposalIndex,1);proposalIndex=null;if(proposals.length){editing=null;dialog.innerHTML=`<div class="alert-editor-heading"><h2>Remaining proposals</h2>${btn('close','Close')}</div><p>Your alert was saved. Review each alternative separately.</p>${proposals.map((p,i)=>`<article class="alert-card"><h3>${esc(p.targetQuery)}</h3>${btn('proposal','Review criteria',String(i))}</article>`).join('')}`;dialog.showModal();}}
 }catch(error){message.textContent=error.message;}finally{button.disabled=false;}
});
document.getElementById('alerts-activity-list').addEventListener('click',e=>{const a=e.target.closest('[data-alert-event]');if(a)request('/alerts/events/'+encodeURIComponent(a.dataset.alertEvent)+'/read',{method:'POST',keepalive:true}).catch(()=>{});});
document.addEventListener('disneyos:page',e=>{if(['alerts','home','shortcuts'].includes(e.detail)&&Date.now()-loaded>30000)refresh();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-loaded>60000)refresh();});
refresh();

// Refresh persisted results only; provider checks remain exclusively backend-controlled.
setInterval(()=>{if(!document.hidden&&!dialog.open&&Date.now()-loaded>=60000)refresh();},60000);
