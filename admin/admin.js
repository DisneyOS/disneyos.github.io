(() => {
  "use strict";

  const API_BASE = "https://disneyos-api-dev.disneyosplanner.workers.dev/v1";
  const TOKEN_KEY = "disneyos-member-device-token";
  const PROFILE_KEY = "disneyos-member-profile";
  const loadingState = document.getElementById("loading-state");
  const unauthorizedState = document.getElementById("unauthorized-state");
  const adminContent = document.getElementById("admin-content");
  const memberList = document.getElementById("member-list");
  const template = document.getElementById("member-template");
  const message = document.getElementById("message");

  function token() { return localStorage.getItem(TOKEN_KEY) || ""; }
  function profile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || "null"); }
    catch { return null; }
  }
  function headers(json = false) {
    return {
      Accept: "application/json",
      Authorization: `Bearer ${token()}`,
      ...(json ? { "Content-Type": "application/json" } : {})
    };
  }
  function showMessage(text, error = false) {
    message.textContent = text;
    message.classList.toggle("error", error);
    message.hidden = !text;
  }
  function friendlyDate(value) {
    if (!value) return "Never";
    const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
    if (Number.isNaN(parsed.valueOf())) return value;
    const now = new Date(), yesterday = new Date(); yesterday.setDate(now.getDate() - 1);
    if (parsed.toDateString() === now.toDateString()) return `Today at ${new Intl.DateTimeFormat("en-US", { timeStyle:"short" }).format(parsed)}`;
    if (parsed.toDateString() === yesterday.toDateString()) return "Yesterday";
    return new Intl.DateTimeFormat("en-US", { dateStyle:"medium", timeStyle:"short" }).format(parsed);
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      ...options,
      headers: { ...headers(Boolean(options.body)), ...(options.headers || {}) }
    });
    const payload = await response.json().catch(() => null);
    if (response.status === 401 || response.status === 403) throw Object.assign(new Error("Administrator access required."), { unauthorized:true });
    if (!response.ok || !payload?.success) throw new Error(payload?.error?.message || "DisneyOS could not complete the request.");
    return payload.data;
  }

  let overview;
  function renderOverview(data) {
    overview = data;
    document.getElementById("member-count").textContent = data.summary.members;
    document.getElementById("device-count").textContent = data.summary.activeDevices;
    document.getElementById("card-count").textContent = data.summary.activeCards;
    memberList.innerHTML = "";

    const query = document.getElementById('member-search').value.trim().toLowerCase();
    data.members.filter(m => [m.displayName,m.memberNumber,m.email].some(v => String(v || '').toLowerCase().includes(query))).forEach((member) => {
      const node = template.content.cloneNode(true);
      const card = node.querySelector(".member-card");
      card.dataset.memberId = member.id;
      node.querySelector(".avatar").textContent = (member.displayName || "D").charAt(0).toUpperCase();
      node.querySelector("h2").textContent = member.displayName;
      node.querySelector(".member-id").textContent = member.memberNumber || member.id;
      const status = node.querySelector(".member-status");
      status.textContent = member.status === "active" ? "Active" : "Disabled";
      status.classList.toggle("inactive", member.status !== "active");

      node.querySelector(".member-detail").addEventListener("click", () => openDetail(member.id));
      const toggleMember = node.querySelector(".toggle-member");
      toggleMember.textContent = member.status === "active" ? "Disable member" : "Enable member";
      toggleMember.addEventListener("click", () => updateMemberStatus(member.id, member.status === "active" ? "disabled" : "active", toggleMember));

      const cardList = node.querySelector(".card-list");
      if (!member.cards.length) cardList.innerHTML = '<div class="empty-row">No membership cards.</div>';
      member.cards.forEach((membershipCard) => {
        const row = document.createElement("div");
        row.className = "card-row";
        row.innerHTML = `<div class="row-copy"><strong></strong><small></small></div><button class="secondary-button" type="button"></button>`;
        row.querySelector("strong").textContent = membershipCard.label || "Membership Card";
        row.querySelector("small").textContent = `Status: ${membershipCard.status}`;
        const button = row.querySelector("button");
        button.disabled = Boolean(membershipCard.replacedAt);
        button.textContent = membershipCard.status === "active" ? "Disable" : "Enable";
        button.addEventListener("click", () => updateCardStatus(membershipCard.id, membershipCard.status === "active" ? "disabled" : "active", button));
        cardList.appendChild(row);
      });

      const deviceList = node.querySelector(".device-list");
      if (!member.devices.length) deviceList.innerHTML = '<div class="empty-row">No trusted devices.</div>';
      member.devices.forEach((device) => {
        const row = document.createElement("div");
        row.className = "device-row";
        row.innerHTML = `<div class="row-copy"><strong></strong><small></small></div><button class="danger-button" type="button">Revoke</button>`;
        row.querySelector("strong").textContent = device.deviceName || "DisneyOS device";
        row.querySelector("small").textContent = `${device.deviceType || "Unknown Device"} · Authorized ${friendlyDate(device.createdAt)} · Last used ${friendlyDate(device.lastSeenAt)}`;
        row.querySelector("button").addEventListener("click", () => revokeDevice(device.id, row.querySelector("button")));
        deviceList.appendChild(row);
      });
      memberList.appendChild(node);
    });
  }

  async function load() {
    showMessage("");
    try {
      if (!token() || profile()?.role !== "admin") throw Object.assign(new Error(), { unauthorized:true });
      const data = await api("/admin/overview");
      renderOverview(data);
      loadingState.hidden = true;
      unauthorizedState.hidden = true;
      adminContent.hidden = false;
    } catch (error) {
      loadingState.hidden = true;
      if (error.unauthorized) { adminContent.hidden = true; memberList.replaceChildren(); overview = null; closeDetail(); unauthorizedState.hidden = false; }
      else { adminContent.hidden = false; showMessage(error.message, true); }
    }
  }

  async function mutate(path, body, button, successText) {
    const previous = button.textContent;
    button.disabled = true;
    button.textContent = "Working…";
    try {
      await api(path, { method:"POST", body:JSON.stringify(body) });
      showMessage(successText);
      await load();
    } catch (error) {
      button.disabled = false;
      button.textContent = previous;
      showMessage(error.message, true);
    }
  }
  function revokeDevice(id, button) {
    if (!confirm("Revoke this device? It will be sent back to membership activation the next time DisneyOS opens.")) return;
    mutate(`/admin/devices/${encodeURIComponent(id)}/revoke`, {}, button, "Device revoked.");
  }
  function updateMemberStatus(id, status, button) {
    if (!confirm(`${status === "disabled" ? "Disable" : "Enable"} this member?`)) return;
    mutate(`/admin/members/${encodeURIComponent(id)}/status`, { status }, button, `Member ${status}.`);
  }
  function updateCardStatus(id, status, button) {
    mutate(`/admin/cards/${encodeURIComponent(id)}/status`, { status }, button, `Membership card ${status}.`);
  }

  const dialog = document.getElementById('member-dialog');
  const detailContent = document.getElementById('detail-content');
  const detailMessage = document.getElementById('detail-message');
  let detailGeneration = 0;
  function closeDetail() {
    detailGeneration++;
    dialog.close();
    detailContent.replaceChildren();
    detailMessage.textContent = '';
  }
  document.getElementById('close-detail').addEventListener('click', closeDetail);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeDetail(); });
  function element(tag, text, parent, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    parent.appendChild(node);
    return node;
  }
  function actionButton(parent, text, action, danger = false) {
    const button = element('button',text,parent,danger ? 'danger-button' : 'secondary-button');
    button.type = 'button';
    button.addEventListener('click', async () => {
      button.disabled = true;
      detailMessage.textContent = '';
      try { await action(); }
      catch (error) {
        if (error.unauthorized) { closeDetail(); await load(); }
        else detailMessage.textContent = error.message;
      } finally { button.disabled = false; }
    });
    return button;
  }
  async function openDetail(id) {
    const generation = ++detailGeneration;
    detailContent.textContent = 'Loading member…';
    detailMessage.textContent = '';
    if (!dialog.open) dialog.showModal();
    try {
      const member = await api(`/admin/members/${encodeURIComponent(id)}`);
      if (generation !== detailGeneration || !dialog.open) return;
      detailContent.replaceChildren();
      const base = `/admin/members/${encodeURIComponent(id)}`;
      const post = async (path, body = {}) => api(path,{method:'POST',body:JSON.stringify(body)});
      const refresh = async () => { await load(); if (dialog.open) await openDetail(id); };
      const fullName = [member.first_name,member.last_name].filter(Boolean).join(' ') || member.display_name;
      element('h2',fullName,detailContent);
      element('p',`${member.member_number || member.id} · ${member.status === 'active' ? 'Active' : 'Disabled'}`,detailContent);
      const activeCards = member.cards.filter(c => c.status === 'active');
      element('p',`Card: ${activeCards.length ? (member.status === 'active' ? 'Active' : 'Suspended') : 'No active card'} · ${member.devices.length} Authorized Devices`,detailContent);
      element('h3','Member Information',detailContent);
      const info = element('dl','',detailContent,'detail-info');
      for (const [label,value] of [['Member ID',member.member_number || member.id],['First Name',member.first_name],['Last Name',member.last_name],['Email',member.email],['Disney Account Email',member.disney_account_email],['Account Status',member.status]]) {
        element('dt',label,info); element('dd',value || 'Not recorded',info);
      }
      element('h3','Enrollment',detailContent);
      const secret = element('p','',detailContent,'secret-result');
      if (!member.passphraseRetrievable) secret.textContent = 'The existing passphrase cannot be viewed until replaced.';
      const reveal = actionButton(detailContent,'View Enrollment Passphrase',async () => {
        if (reveal.textContent === 'Hide Enrollment Passphrase') { secret.textContent = ''; reveal.textContent = 'View Enrollment Passphrase'; return; }
        const result = await api(`${base}/passphrase`);
        if (generation !== detailGeneration) return;
        secret.textContent = result.passphrase;
        reveal.textContent = 'Hide Enrollment Passphrase';
      });
      reveal.disabled = !member.passphraseRetrievable;
      const form = element('form','',detailContent,'member-form');
      const label = element('label','New Enrollment Passphrase',form);
      const input = element('input','',label);
      input.type = 'password'; input.minLength = 8; input.maxLength = 200; input.required = true; input.autocomplete = 'new-password';
      element('p','Existing devices remain authorized when you replace the passphrase.',form);
      const replace = element('button','Replace Passphrase',form,'secondary-button'); replace.type = 'submit';
      form.addEventListener('submit',async event => {
        event.preventDefault(); replace.disabled = true;
        try { await post(`${base}/passphrase`,{passphrase:input.value}); input.value = ''; await refresh(); detailMessage.textContent = 'Enrollment passphrase replaced.'; }
        catch (error) { if (error.unauthorized) { closeDetail(); await load(); } else detailMessage.textContent = error.message; }
        finally { replace.disabled = false; }
      });
      element('h3','Member Card',detailContent);
      for (const card of member.cards) {
        const row = element('div','',detailContent,'card-row');
        element('span',`${card.replaced_at ? 'Replaced' : card.status} · Issued ${friendlyDate(card.created_at)}`,row);
        if (!card.replaced_at) actionButton(row,card.status === 'active' ? 'Disable Card' : 'Enable Card',async () => {
          await post(`/admin/cards/${encodeURIComponent(card.id)}/status`,{status:card.status === 'active' ? 'disabled' : 'active'}); await refresh();
        });
      }
      const cardControls = element('div','',detailContent,'detail-controls');
      const issue = async reissue => {
        if (reissue && !confirm('Replace this member’s card? All previous card links will stop working. Existing devices and the passphrase stay unchanged.')) return;
        const result = await post(`${base}/cards/${reissue ? 'reissue' : 'issue'}`);
        await refresh();
        if (!dialog.open) return;
        detailMessage.textContent = 'Card issued. Copy this activation URL now; it is shown only once.';
        const label = element('label','Activation URL',detailContent);
        const url = element('input','',label); url.readOnly = true; url.value = result.activationUrl;
        url.addEventListener('focus',() => url.select());
        url.focus(); url.select();
      };
      if (!activeCards.length) actionButton(cardControls,'Issue Card',() => issue(false));
      if (member.cards.length) actionButton(cardControls,'Reissue Card',() => issue(true));
      element('h3','Authorized Devices',detailContent);
      if (!member.devices.length) element('p','No authorized devices.',detailContent);
      for (const device of member.devices) {
        const row = element('div','',detailContent,'device-row');
        const copy = element('div','',row,'row-copy');
        element('strong',device.device_name || 'Unknown Device',copy);
        const dates = element('small',`${device.device_type || 'Unknown Device'} · Authorized ${friendlyDate(device.created_at)} · Last used ${friendlyDate(device.last_seen_at)}`,copy);
        dates.title = `Authorized: ${device.created_at} UTC; Last used: ${device.last_seen_at} UTC`;
        actionButton(row,'Revoke',async () => {
          if (!confirm('Revoke this device? It must enroll again to regain access.')) return;
          await post(`/admin/devices/${encodeURIComponent(device.id)}/revoke`); await refresh();
        },true);
      }
      if (member.devices.length) actionButton(detailContent,'Revoke All Devices',async () => {
        if (!confirm('Revoke all devices for this member? The card, passphrase, and member status stay unchanged.')) return;
        await post(`${base}/devices/revoke-all`); await refresh();
      },true);
      element('h3','Account Controls',detailContent);
      actionButton(detailContent,member.status === 'active' ? 'Disable Member' : 'Re-enable Member',async () => {
        if (!confirm(`${member.status === 'active' ? 'Disable' : 'Re-enable'} this member?`)) return;
        await post(`${base}/status`,{status:member.status === 'active' ? 'disabled' : 'active'}); await refresh();
      },member.status === 'active');
    } catch (error) {
      if (error.unauthorized) { closeDetail(); await load(); }
      else if (generation === detailGeneration) { detailContent.textContent = ''; detailMessage.textContent = error.message; }
    }
  }
  document.getElementById('create-member-form').addEventListener('submit',async event => {
    event.preventDefault();
    const form = event.currentTarget, button = form.querySelector('button'); button.disabled = true;
    try {
      const result = await api('/admin/members',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(form)))});
      form.reset(); form.closest('details').open = false;
      await load(); await openDetail(result.memberId);
    } catch (error) { if (error.unauthorized) await load(); else showMessage(error.message,true); }
    finally { button.disabled = false; }
  });
  document.getElementById('member-search').addEventListener('input', () => { if (overview) renderOverview(overview); });
  document.getElementById("refresh-button").addEventListener("click", load);
  load();
})();
