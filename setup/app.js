(() => {
  "use strict";
  const C = window.DISNEYOS_CONFIG;
  const app = document.getElementById("app");
  const defaults = { step:"welcome", installed:false, shortcuts:{}, focus:false, homescreen:false, wallpaper:false, completedVersion:null };
  let state = load();

  function load(){
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(C.storageKey) || "{}") }; }
    catch { return { ...defaults }; }
  }
  function save(){ localStorage.setItem(C.storageKey, JSON.stringify(state)); }
  function set(patch){ state={...state,...patch}; save(); render(); }
  function goto(step){ state.step=step; save(); render(); scrollTo({top:0,behavior:"smooth"}); }
  function standalone(){ return matchMedia("(display-mode: standalone)").matches || navigator.standalone===true; }
  function iphone(){ return /iPhone/i.test(navigator.userAgent || ""); }
  function complete(){ return !!localStorage.getItem(C.completionKey) || !!state.completedVersion; }
  function updateAvailable(){ return complete() && state.completedVersion && state.completedVersion !== C.latestVersion; }
  function progress(step){ return ({install:20,shortcuts:40,focus:60,homescreen:80,wallpaper:100})[step] || 0; }

  function previousStep(step){
    return ({
      install:"welcome",
      shortcuts:"install",
      focus:"shortcuts",
      homescreen:"focus",
      wallpaper:"homescreen"
    })[step] || "welcome";
  }

  function shell({step,title,copy,body,label="Continue",disabled=false,next}){
    app.innerHTML=`<section class="screen card flow">
      <header class="topbar">
        <button id="back" class="back-button" type="button" aria-label="Go back">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg>
        </button>
        <div class="progress-track"><div class="progress-fill" style="width:${progress(step)}%"></div></div>
      </header>
      <div class="flow-body"><p class="eyebrow">DisneyOS Setup</p><h2>${title}</h2><p class="flow-copy">${copy}</p>${body}</div>
      <div class="actions bottom-actions"><button id="continue" class="button button-primary" ${disabled?"disabled":""}>${label}</button></div>
    </section>`;
    document.getElementById("back")?.addEventListener("click",()=>goto(previousStep(step)));
    document.getElementById("continue")?.addEventListener("click", next);
  }

  function welcome(){
    app.innerHTML=`<section class="screen card center">
      <img src="assets/disneyos-logo-transparent.png" class="brand-logo" alt="DisneyOS">
      <h1>Welcome to DisneyOS</h1>
      <p class="subtitle">Transform your iPhone into the ultimate Disney companion.</p>
      <div class="feature-grid"><div class="feature-chip">DisneyOS</div><div class="feature-chip">Apple Shortcuts</div><div class="feature-chip">Disney Mode</div><div class="feature-chip">DisneyOS Home Screen</div></div>
      <div class="actions" style="width:100%"><button id="begin" class="button button-primary">Begin Setup</button></div>
      <div class="footer-note">DisneyOS Setup v${C.setupVersion}</div>
    </section>`;
    document.getElementById("begin").onclick=()=>goto("install");
  }

  function install(){
    if(standalone() && !state.installed){ state.installed=true; save(); }
    const done=standalone() || state.installed;
    shell({step:"install",title:"Install DisneyOS",copy:"Add DisneyOS to your Home Screen for the best experience.",body:`
      <div class="step-list">
        <div class="step-card"><div class="step-number">1</div><div><strong>Open DisneyOS in Safari</strong><span>Use the button below, then return here.</span></div></div>
        <div class="step-card"><div class="step-number">2</div><div><strong>Tap Share</strong><span>Use Safari's Share button.</span></div></div>
        <div class="step-card"><div class="step-number">3</div><div><strong>Add to Home Screen</strong><span>Select Add to Home Screen, then tap Add.</span></div></div>
      </div>
      <div class="actions"><button id="openApp" class="button button-secondary">Open DisneyOS</button></div>
      ${standalone()?`<div class="status-card"><div class="status-dot">✓</div><div><strong>Already Installed</strong><p>DisneyOS is running from your Home Screen.</p></div></div>`:`<div class="confirm-card"><label class="confirm-label"><input id="confirmInstall" type="checkbox" ${state.installed?"checked":""}><span>DisneyOS has been added to my Home Screen.</span></label></div>`}`,
      disabled:!done,next:()=>goto("shortcuts")
    });
    document.getElementById("openApp").onclick=()=>open(C.appUrl,"_blank","noopener");
    document.getElementById("confirmInstall")?.addEventListener("change",e=>set({installed:e.target.checked}));
  }

  function shortcuts(){
    const cards=C.shortcuts.map((item,i)=>{
      const done=!!state.shortcuts[item.id];
      const unlocked=i===0 || !!state.shortcuts[C.shortcuts[i-1].id] || done;
      return `<article class="shortcut-card ${!unlocked?"locked":""} ${done?"complete":""}">
        <div><h3>${item.name}</h3><p>${done?"Installed":unlocked?"Ready to install.":"Complete the shortcut above first."}</p></div>
        <div class="shortcut-actions"><button class="mini-button install" data-open="${item.id}" ${!unlocked||done?"disabled":""}>Install</button><button class="mini-button ${done?"confirmed":""}" data-done="${item.id}" ${!unlocked?"disabled":""}>${done?"Installed ✓":"Installed"}</button></div>
      </article>`;
    }).join("");
    const all=C.shortcuts.every(x=>state.shortcuts[x.id]);
    shell({step:"shortcuts",title:"Install Apple Shortcuts",copy:"Install each shortcut below.",body:`<div class="shortcut-list">${cards}</div>`,disabled:!all,next:()=>goto("focus")});
    app.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>{ const x=C.shortcuts.find(s=>s.id===b.dataset.open); open(x.url,"_blank","noopener"); });
    app.querySelectorAll("[data-done]").forEach(b=>b.onclick=()=>{ state.shortcuts={...state.shortcuts,[b.dataset.done]:!state.shortcuts[b.dataset.done]}; save(); render(); });
  }

  function focus(){
    shell({step:"focus",title:"Configure Disney Mode",copy:"Create a new Focus named Disney Mode.",body:`
      <div class="check-list">
        ${["Name it Disney Mode.","Choose the blue color.","Choose the castle icon.","Allow all people and all apps.","Assign your DisneyOS Home Screen page."].map(x=>`<div class="check-row"><div class="check-icon">✓</div><strong>${x}</strong></div>`).join("")}
      </div>
      <div class="confirm-card"><label class="confirm-label"><input id="focusDone" type="checkbox" ${state.focus?"checked":""}><span>Disney Mode is configured.</span></label></div>`,disabled:!state.focus,next:()=>goto("homescreen")});
    document.getElementById("focusDone").onchange=e=>set({focus:e.target.checked});
  }

  function homescreen(){
    const items=["Create a new blank Home Screen page if needed.","Add DisneyOS to the page.","Add Wait Times and Vehicle.","Add the currently supported DisneyOS widgets.","Assign the page to Disney Mode."];
    shell({step:"homescreen",title:"Build Your DisneyOS Home Screen",copy:"Create a dedicated page for the DisneyOS experience.",body:`
      <div class="check-list">${items.map((x,i)=>`<div class="check-row"><div class="check-icon">${i+1}</div><strong>${x}</strong></div>`).join("")}</div>
      <div class="confirm-card"><label class="confirm-label"><input id="homeDone" type="checkbox" ${state.homescreen?"checked":""}><span>My DisneyOS Home Screen is ready.</span></label></div>`,disabled:!state.homescreen,next:()=>goto("wallpaper")});
    document.getElementById("homeDone").onchange=e=>set({homescreen:e.target.checked});
  }

  function wallpaper(){
    shell({step:"wallpaper",title:"Choose Your Wallpaper",copy:"Choose a favorite Disney family photo and apply it to your DisneyOS Home Screen.",body:`
      <div class="check-list"><div class="check-row"><div class="check-icon">1</div><strong>Choose a Disney family photo from Photos.</strong></div><div class="check-row"><div class="check-icon">2</div><strong>Set it as your Home Screen wallpaper.</strong></div></div>
      <div class="confirm-card"><label class="confirm-label"><input id="wallDone" type="checkbox" ${state.wallpaper?"checked":""}><span>Wallpaper applied.</span></label></div>`,label:"Finish Setup",disabled:!state.wallpaper,next:finish});
    document.getElementById("wallDone").onchange=e=>set({wallpaper:e.target.checked});
  }

  function finish(){ state.completedVersion=C.latestVersion; state.step="complete"; localStorage.setItem(C.completionKey,"true"); save(); render(); }
  function completion(){
    app.innerHTML=`<section class="screen card center"><img src="assets/disneyos-mark.png" class="completion-logo" alt="DisneyOS"><div class="success-mark">✓</div><p class="eyebrow">Setup Complete</p><h1>DisneyOS is Ready</h1><p class="subtitle">Your iPhone is now configured with DisneyOS.</p><div class="actions" style="width:100%;margin-top:34px"><button id="launch" class="button button-primary">Launch DisneyOS</button><button id="again" class="button button-secondary">Run Setup Again</button></div><div class="footer-note">DisneyOS Setup v${C.setupVersion}</div></section>`;
    document.getElementById("launch").onclick=()=>location.href=C.appUrl;
    document.getElementById("again").onclick=resetDialog;
  }

  function returning(){
    const upd=updateAvailable();
    app.innerHTML=`<section class="screen card center"><img src="assets/disneyos-logo-transparent.png" class="brand-logo" alt="DisneyOS"><p class="eyebrow">${upd?"Update Available":"Setup Complete"}</p><h1>${upd?"Update DisneyOS":"DisneyOS is already configured"}</h1><p class="subtitle">${upd?"A newer DisneyOS setup version is available.":"Your setup has already been completed on this iPhone."}</p>
      ${upd?`<div class="release-card"><div class="version-grid"><div class="version-item"><span>Current Version</span><strong>${state.completedVersion||C.setupVersion}</strong></div><div class="version-item"><span>Latest Version</span><strong>${C.latestVersion}</strong></div></div><h3>What's New</h3><ul class="release-notes">${C.releaseNotes.map(x=>`<li>${x}</li>`).join("")}</ul></div>`:""}
      <div class="actions" style="width:100%;margin-top:28px"><button id="launch" class="button button-primary">Launch DisneyOS</button><button id="secondary" class="button button-secondary">${upd?"Update DisneyOS":"Run Setup Again"}</button></div><div class="footer-note">DisneyOS Setup v${C.setupVersion}</div></section>`;
    document.getElementById("launch").onclick=()=>location.href=C.appUrl;
    document.getElementById("secondary").onclick=upd?()=>{ localStorage.removeItem(C.completionKey); state={...defaults,step:"install"}; save(); render(); }:resetDialog;
  }

  function resetDialog(){
    const d=document.createElement("div"); d.className="dialog-backdrop"; d.id="resetDialog";
    d.innerHTML=`<div class="dialog" role="dialog" aria-modal="true"><h3>Run setup again?</h3><p>This clears saved setup progress and starts from the beginning.</p><div class="actions"><button id="confirmReset" class="button button-danger">Start Over</button><button id="cancelReset" class="button button-secondary">Cancel</button></div></div>`;
    document.body.appendChild(d);
    document.getElementById("confirmReset").onclick=()=>{ localStorage.removeItem(C.storageKey); localStorage.removeItem(C.completionKey); state={...defaults}; d.remove(); render(); };
    document.getElementById("cancelReset").onclick=()=>d.remove();
  }

  function offline(){ app.innerHTML=`<section class="screen card center"><div class="offline-icon">⌁</div><p class="eyebrow">Connection Required</p><h1>You're Offline</h1><p class="subtitle">Connect to the internet to continue DisneyOS Setup.</p><div class="actions" style="width:100%;margin-top:30px"><button id="retry" class="button button-primary">Try Again</button></div></section>`; document.getElementById("retry").onclick=render; }
  function unsupported(){ app.innerHTML=`<section class="screen card center"><div class="device-icon">⌁</div><p class="eyebrow">iPhone Required</p><h1>Continue on iPhone</h1><p class="subtitle">DisneyOS Setup is designed specifically for iPhone and Safari.</p><div class="footer-note">DisneyOS Setup v${C.setupVersion}</div></section>`; }

  function render(){
    if(!navigator.onLine) return offline();
    if(!iphone()) return unsupported();
    if(complete() && state.step!=="complete") return returning();
    ({welcome,install,shortcuts,focus,homescreen,wallpaper,complete:completion}[state.step] || welcome)();
  }

  addEventListener("online",render); addEventListener("offline",render); addEventListener("pageshow",render); render();
})();
