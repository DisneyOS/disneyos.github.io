const API='https://disneyos-api-dev.disneyosplanner.workers.dev/v1';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dialog=document.getElementById('notifications-dialog');
let state=null,registration=null,subscription=null,busy=false;
const capable=()=>isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const permission=()=>capable()?Notification.permission:'unsupported';
const keyBytes=v=>Uint8Array.from(atob(v.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
async function request(path,options={}){
 const token=localStorage.getItem('disneyos-member-device-token');if(!token)throw Error('Authorize this device first.');
 const response=await fetch(API+'/notifications/'+path,{...options,cache:'no-store',headers:{Authorization:`Bearer ${token}`,Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})}});
 const result=await response.json();if(!response.ok||!result.success)throw Error(result?.error?.message||'Notifications are temporarily unavailable.');return result.data;
}
async function badge(count){try{if('setAppBadge' in navigator){if(count>0)await navigator.setAppBadge(count);else await navigator.clearAppBadge();}}catch{}}
function deviceState(){
 if(!capable())return ['Unsupported','Notifications are unavailable here. On iPhone, add DisneyOS to your Home Screen and open it there.'];
 if(permission()==='denied')return ['Permission Denied','Allow notifications for DisneyOS in your browser or device Settings, then return here.'];
 if(!state?.configured)return ['Not Available','Notification delivery is not configured yet.'];
 if(state.device.state==='invalid'||state.device.state==='active'&&!subscription)return ['Needs Re-enable','Reconnect notifications on this device.'];
 if(state.device.state==='active'&&subscription&&permission()==='granted')return ['Enabled','This device receives eligible account notifications.'];
 return ['Not Enabled','Your Watches keep monitoring while notifications are off.'];
}
function render(education=false){
 const [label,help]=deviceState();
 dialog.innerHTML=`<div class="notification-heading"><h2>${education?'Stay in the loop':'Notifications'}</h2><button type="button" data-push="close" aria-label="Close notifications">Close</button></div>${education?'<p>Enable notifications so DisneyOS can tell you when an alert matches, something needs your attention, or an important plan is approaching.</p>':''}<section><h3>This Device</h3><p>${esc(state?.deviceName||'This authorized device')} · <strong>${esc(label)}</strong></p><p>${esc(help)}</p><div class="notification-actions"><button type="button" data-push="enable" ${!state?.configured||!capable()||permission()==='denied'?'disabled':''}>${label==='Enabled'?'Reconnect Notifications':'Enable Notifications'}</button>${label==='Enabled'?'<button type="button" data-push="disable">Turn Off on This Device</button>':''}${education?'<button type="button" data-push="later">Not Now</button>':''}</div></section>${!education&&state?`<section><h3>Account Notifications</h3><p>These choices apply to all your enabled devices.</p>${Object.entries({master:'Notifications',alerts:'Alerts & Availability',plans:'Trip & Plans',disneyos:'DisneyOS'}).map(([key,label])=>`<label class="notification-toggle"><span>${label}</span><input type="checkbox" data-preference="${key}" ${state.preferences[key]?'checked':''}></label>`).join('')}</section>`:''}<p id="push-status" role="status"></p>`;
}
function open(education=false){render(education);if(!dialog.open)dialog.showModal();}
async function reconcile(){
 const incoming=await request('push');
 if(!incoming?.deviceId||!incoming.device||!incoming.preferences)throw Error('Notification settings are temporarily unavailable.');
 state=incoming;
 if(capable()){
  registration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('App update is still loading. Try again.')),8000))]);
  subscription=await registration.pushManager.getSubscription();
  if(state.device.state==='active'){
   if(permission()!=='granted'||!subscription){await request('push',{method:'DELETE',body:JSON.stringify({invalid:true,permission:permission()})});state.device.state='invalid';}
   else await request('push',{method:'PUT',body:JSON.stringify({permission:'granted',subscription:subscription.toJSON()})});
  }
 }else if(state.device.state==='active'){
  await request('push',{method:'DELETE',body:JSON.stringify({invalid:true,permission:'unsupported'})});state.device.state='invalid';
 }
 await badge(state.actionCount);
 document.getElementById('notification-setting-state').textContent=deviceState()[0];
}
document.getElementById('notification-settings-button').addEventListener('click',()=>{open();reconcile().then(()=>render()).catch(e=>document.getElementById('push-status').textContent=e.message);});
dialog.addEventListener('click',async event=>{
 const action=event.target.closest('[data-push]')?.dataset.push;if(!action||busy)return;
 if(action==='close'||action==='later'){if(state)localStorage.setItem('disneyos-push-education:'+state.deviceId,'seen');dialog.close();return;}
 busy=true;const button=event.target.closest('button');button.disabled=true;
 try{
  if(action==='enable'){
   // Permission request is the first asynchronous operation in the user's click handler.
   const granted=permission()==='default'?await Notification.requestPermission():permission();
   if(granted!=='granted')throw Error('Notifications are not allowed. You can change this in device or browser Settings.');
   registration ||= await navigator.serviceWorker.ready;
   subscription=await registration.pushManager.getSubscription();
   if(subscription&&(state.device.state==='invalid'||String(new Uint8Array(subscription.options.applicationServerKey||[]))!==String(keyBytes(state.publicKey)))){await subscription.unsubscribe();subscription=null;}
   subscription ||= await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(state.publicKey)});
   await request('push',{method:'PUT',body:JSON.stringify({permission:'granted',subscription:subscription.toJSON()})});
   localStorage.setItem('disneyos-push-education:'+state.deviceId,'seen');
  }else if(action==='disable'){
   // Disable server targeting first, even if browser unsubscribe fails.
   await request('push',{method:'DELETE',body:JSON.stringify({permission:permission()})});
   if(subscription)await subscription.unsubscribe();subscription=null;
  }
  await reconcile();render();
 }catch(error){document.getElementById('push-status').textContent=error.message;}finally{busy=false;button.disabled=false;}
});
dialog.addEventListener('cancel',()=>{if(state)localStorage.setItem('disneyos-push-education:'+state.deviceId,'seen');});
dialog.addEventListener('change',async event=>{
 const key=event.target.dataset.preference;if(!key)return;const input=event.target;input.disabled=true;
 try{state.preferences=await request('preferences',{method:'PATCH',body:JSON.stringify({[key]:input.checked})});}catch(error){input.checked=!input.checked;document.getElementById('push-status').textContent=error.message;}finally{input.disabled=false;}
});
document.addEventListener('disneyos:watch-created',()=>{if(state?.configured&&deviceState()[0]!=='Enabled'&&!document.querySelector('dialog[open]'))open(true);});
document.addEventListener('disneyos:actions',event=>badge(event.detail));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)reconcile().catch(()=>{});});
async function start(){
 try{await reconcile();
  if(new URL(location.href).searchParams.has('notifications'))open();
  else if(state.configured&&localStorage.getItem('disneyosSetupComplete')&&!localStorage.getItem('disneyos-push-education:'+state.deviceId)&&deviceState()[0]!=='Enabled'&&!document.querySelector('dialog[open]'))open(true);
 }catch{document.getElementById('notification-setting-state').textContent='Temporarily unavailable';}
}
if(document.readyState==='complete')start();else window.addEventListener('load',start,{once:true});

async function activity(){
 try{const data=await request('activity');const list=document.getElementById('alerts-activity-list');list.querySelectorAll('[data-push-activity]').forEach(n=>n.remove());for(const e of data.events){const a=document.createElement('a');a.dataset.pushActivity=e.id;const q=new URLSearchParams({view:e.destination.type==='settings'?'settings':'trip'});if(e.destination.entityId)q.set('plan',e.destination.entityId);if(e.destination.tripId)q.set('trip',e.destination.tripId);if(e.destination.date)q.set('date',e.destination.date);a.href='/v1/?'+q;a.textContent=e.title+' · '+e.body;list.append(a);}await badge(data.actionCount);}catch{}
}
document.addEventListener('disneyos:activity-rendered',activity);
