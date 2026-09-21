const API='https://disneyos-api-dev.disneyosplanner.workers.dev/v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={'magic-kingdom':'Magic Kingdom',epcot:'EPCOT','hollywood-studios':'Hollywood Studios','animal-kingdom':'Animal Kingdom','disney-springs':'Disney Springs'};
const lamp='<img class="genie-lamp" src="assets/genie-lamp.svg" alt="">';
const dialog=document.createElement('dialog');dialog.id='genie-dialog';dialog.setAttribute('aria-labelledby','genie-title');
dialog.innerHTML=`<header><div class="genie-brand">${lamp}<div><small>DisneyOS</small><h2 id="genie-title">Genie</h2></div></div><div class="genie-controls"><button data-genie="new">New conversation</button><button data-genie="close" aria-label="Close Genie">Close</button></div></header><div id="genie-context"></div><div id="genie-thread" role="log" aria-live="polite"></div><div id="genie-prompts"></div><form id="genie-form"><label for="genie-input">Ask Genie</label><textarea id="genie-input" maxlength="2000" rows="2" placeholder="What should we do next?"></textarea><div class="genie-composer-actions"><button type="submit" id="genie-send">Send</button></div><p id="genie-status" role="status"></p></form>`;
document.body.append(dialog);
document.querySelector('[data-target="genie"] .nav-icon').innerHTML=lamp;
const $=id=>document.getElementById(id);
let messages=[],launch={},overrides={},sources=[],busy=false,credential='',returnFocus=null,controller=null,generation=0;
const nowDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function screenContext(){const c={screen:document.getElementById('alerts-activity')?.open?'notifications':document.querySelector('.page.active')?.dataset.page||'home',date:nowDay()};document.dispatchEvent(new CustomEvent('disneyos:genie-context',{detail:c}));if(!c.date)c.date=nowDay();return c;}
function activeContext(){const c={...launch,...overrides};if(overrides.tripId&&overrides.tripId!==launch.tripId){delete c.tripName;delete c.partySize;}return c;}
function renderContext(){const c=activeContext();$('genie-context').innerHTML=`<div class="genie-chips">${[names[c.park],c.date===nowDay()?'Today':c.date,c.tripName,c.partySize?'Party of '+c.partySize:null].filter(Boolean).map(v=>`<span>${esc(v)}</span>`).join('')}</div><details><summary>Context</summary><p>Defaults from ${esc(launch.screen)}. Tell Genie to use a different park, date or Trip.</p>${Object.keys(overrides).length?'<p>Conversation overrides: '+esc([names[overrides.park],overrides.date,overrides.tripId].filter(Boolean).join(' · '))+'</p>':''}${sources.map(s=>`<p>From ${esc(s.source)} · ${esc(s.date||'')} · Read ${esc(new Date(s.readAt).toLocaleTimeString())}</p>`).join('')}</details>`;}
function prompts(){const c=activeContext();const values=c.screen==='notifications'?['Explain these notifications','What needs my attention?','Open Settings']:c.screen==='alerts'?['Explain this Match','Is this worth taking?','Change this Watch']:c.screen==='trip'?['Help with this gap','Compare options','Plan this day']:['What should we do next?',"What’s our next plan?",'Help plan tonight'];$('genie-prompts').innerHTML=values.map(p=>`<button type="button" data-prompt="${esc(p)}">${esc(p)}</button>`).join('');}
const destinationButton=(d,label='Open')=>d?`<button type="button" data-destination="${esc(JSON.stringify(d))}">${esc(label)}</button>`:'';
function render(){
 $('genie-thread').innerHTML=messages.length?messages.map((m,mi)=>`<article class="genie-message ${m.role}"><strong>${m.role==='user'?'You':'Genie'}</strong><p>${esc(m.content)}</p>${(m.cards||[]).map(c=>`<section class="genie-card"><h3>${esc(c.title)}</h3><p>${esc(c.detail)}</p><small>${esc(c.source)}</small>${destinationButton(c.destination,'View')}</section>`).join('')}${(m.confirmations||[]).map((c,ci)=>`<section class="genie-card ${c.destructive?'destructive':''}" data-confirmation="${esc(c.id)}"><h3>${esc(c.title)}</h3><p>${esc(c.detail)}</p>${c.state==='pending'?`<p><small>${c.destructive?'This permanently deletes the item. ':''}Review before confirming · Expires ${esc(new Date(c.expiresAt).toLocaleTimeString())}</small></p><div class="genie-card-actions"><button data-confirm="${mi}:${ci}">${c.destructive?'Confirm deletion':'Confirm'}</button><button data-change="${mi}:${ci}">Change</button><button data-cancel="${mi}:${ci}">Cancel</button></div>`:`<strong>${esc(c.state==='succeeded'?'Saved':c.state==='running'?'Checking result…':c.state==='uncertain'?'Check the owning feature':c.state)}</strong>${c.state==='uncertain'?`<button data-confirm="${mi}:${ci}">Check result</button>`:''}${destinationButton(c.destination,'View in '+(c.destination?.view==='trip'?'My Trip':'Alerts'))}`}</section>`).join('')}${(m.confirmations||[]).filter(c=>c.state==='pending'&&!c.destructive).length>1?`<button data-confirm-all="${mi}">Confirm all non-destructive actions</button>`:''}${(m.issues||[]).map(v=>`<p class="genie-error">${esc(v)}</p>`).join('')}</article>`).join(''):'<div class="genie-welcome"><h3>A little magic for your day.</h3><p>Let’s find what fits your plans. Ask a question or choose a prompt.</p></div>';
 messages.forEach((m,mi)=>{
  if(m.retry){const b=document.createElement('button');b.textContent='Retry';b.dataset.retry=m.retry;$('genie-thread').children[mi]?.append(b);}
  for(const c of m.confirmations||[])if(c.state==='failed'){const b=document.createElement('button');b.textContent='Prepare a new proposal';b.dataset.retry='Prepare the failed action again for my review: '+c.title;dialog.querySelector(`[data-confirmation="${CSS.escape(c.id)}"]`)?.append(b);}
 });
 $('genie-send').disabled=busy;$('genie-input').disabled=busy;
 dialog.querySelectorAll('[data-confirm],[data-change],[data-cancel],[data-confirm-all],[data-prompt],[data-genie="new"]').forEach(b=>b.disabled=busy);
 $('genie-thread').scrollTop=$('genie-thread').scrollHeight;
}
async function request(path,body,signal){const token=localStorage.getItem('disneyos-member-device-token');if(!token)throw Error('Authorize this device first.');if(token!==credential)throw Error('Your authorized session changed. Close and reopen Genie.');const response=await fetch(API+'/genie/'+path,{method:'POST',signal,cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();if(token!==localStorage.getItem('disneyos-member-device-token'))throw Error('Your authorized session changed. Close and reopen Genie.');if(!response.ok||!result.success)throw Error(result.error?.message||'Genie is temporarily unavailable.');return result.data;}
function open(extra={}){
 const token=localStorage.getItem('disneyos-member-device-token');if(token!==credential){messages=[];overrides={};sources=[];credential=token;}
 launch={...screenContext(),...extra};renderContext();prompts();render();returnFocus=document.activeElement;
 if(!dialog.open)dialog.showModal();document.querySelector('[data-target="genie"]').classList.add('genie-open');
}
function close(){dialog.close();document.querySelector('[data-target="genie"]').classList.remove('genie-open');returnFocus?.focus();}
function navigate(d){
 if(!['home','trip','parks','alerts','settings','notifications','shortcuts'].includes(d?.view))return;
 close();
 if(d.view==='notifications'){document.getElementById('alerts-activity').open=true;document.querySelector('#alerts-activity summary').focus();return;}
 const url=new URL(location.href);url.search='';url.searchParams.set('view',d.view);
 for(const [key,value] of Object.entries({destination:d.park,parksDate:d.view==='parks'?d.date:null,date:d.view==='trip'?d.date:null,trip:d.tripId,plan:d.planId,watch:d.watchId,item:d.itemId,area:d.area}))if(value)url.searchParams.set(key,value);
 history.pushState({},'',url);document.dispatchEvent(new CustomEvent('disneyos:genie-navigate',{detail:d}));window.dispatchEvent(new PopStateEvent('popstate'));
}
async function send(text){
 if(busy||!text.trim())return;
 if(localStorage.getItem('disneyos-member-device-token')!==credential){open();$('genie-status').textContent='Your session changed. Start a new conversation.';return;}
 busy=true;const mine=++generation;controller=new AbortController();const history=messages.map(m=>({role:m.role,content:[m.content,...(m.cards||[]).map(c=>c.title+': '+c.detail),...(m.confirmations||[]).map(c=>c.title+' ['+c.state+']: '+c.detail+' '+JSON.stringify(c.destination))].join('\n')}));messages.push({role:'user',content:text});$('genie-input').value='';$('genie-status').textContent='Genie is thinking…';render();
 try{const result=await request('message',{text,history,context:activeContext()},controller.signal);if(mine!==generation)return;
  if(result.context)for(const key of ['park','date','tripId'])if(result.context[key])overrides[key]=result.context[key];
  sources=result.sources||[];messages.push({role:'assistant',content:result.answer,...result});if(result.navigation)navigate(result.navigation);renderContext();
  $('genie-status').textContent='';
 }catch(e){if(mine===generation){messages.push({role:'assistant',content:e.message,retry:text,cards:[{title:'Keep exploring',detail:'Your DisneyOS features remain available.',destination:{view:launch.screen==='trip'?'trip':launch.screen==='alerts'?'alerts':'parks'}}]});$('genie-status').textContent='You can try again or open the feature.';}}
 finally{if(mine===generation){busy=false;render();$('genie-input').focus();}}
}
async function apply(mi,ci){const c=messages[mi].confirmations[ci];if(!['pending','uncertain'].includes(c.state))return;c.state='running';render();try{const result=await request('confirmations/'+c.id+'/confirm',{confirmed:true,destructiveConfirmed:!!c.destructive});Object.assign(c,result);if(result.state==='succeeded')document.dispatchEvent(new CustomEvent('disneyos:genie-saved',{detail:c.destination}));}catch(e){c.state='uncertain';c.detail=e.message;}render();}
async function cancel(mi,ci){const c=messages[mi].confirmations[ci];await request('confirmations/'+c.id+'/cancel',{});c.state='cancelled';render();}
dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
$('genie-form').addEventListener('submit',e=>{e.preventDefault();send($('genie-input').value);});
dialog.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.prompt)return send(b.dataset.prompt);
 if(b.dataset.retry)return send(b.dataset.retry);
 if(b.dataset.destination)return navigate(JSON.parse(b.dataset.destination));
 const action=b.dataset.genie;
 if(action==='close')return close();
 if(action==='new'){
  // Cancel pending receipts before discarding their UI, without cancelling running writes.
  busy=true;render();try{for(let mi=0;mi<messages.length;mi++)for(let ci=0;ci<(messages[mi].confirmations||[]).length;ci++)if(messages[mi].confirmations[ci].state==='pending')await cancel(mi,ci);messages=[];overrides={};sources=[];launch=screenContext();$('genie-input').value='';renderContext();prompts();}catch(e){$('genie-status').textContent=e.message;}finally{busy=false;render();}return;
 }
 if(b.dataset.confirm||b.dataset.cancel||b.dataset.change||b.dataset.confirmAll!==undefined){if(busy)return;busy=true;render();try{
  if(b.dataset.confirmAll!==undefined){const mi=+b.dataset.confirmAll;for(let ci=0;ci<messages[mi].confirmations.length;ci++){const c=messages[mi].confirmations[ci];if(c.state==='pending'&&!c.destructive)await apply(mi,ci);}}
  else{const [mi,ci]=(b.dataset.confirm||b.dataset.cancel||b.dataset.change).split(':').map(Number);if(b.dataset.confirm)await apply(mi,ci);else{await cancel(mi,ci);if(b.dataset.change){$('genie-input').value='Change the proposed '+messages[mi].confirmations[ci].title+': ';$('genie-input').focus();}}}
 }catch(e){$('genie-status').textContent=e.message;}finally{busy=false;render();}}
});
document.addEventListener('disneyos:open-genie',e=>open(e.detail||{}));
document.addEventListener('click',e=>{const b=e.target.closest('[data-ask-genie]');if(b)open({screen:b.dataset.screen||screenContext().screen,...(b.dataset.watchId?{watchId:b.dataset.watchId}:{})});});
let actionCount=0;
document.addEventListener('disneyos:actions',e=>{actionCount=Number(e.detail)||0;});
document.addEventListener('disneyos:activity-rendered',()=>{
 const list=$('alerts-activity-list');if(actionCount){const a=document.createElement('a');a.className='notification-attention';a.href='?view=alerts';a.textContent=actionCount+' Action Required';list.prepend(a);}
 document.querySelector('#alerts-activity summary').classList.toggle('has-recent',!!list.querySelector('[data-alert-event]'));
});
