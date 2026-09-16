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
    return Number.isNaN(parsed.valueOf()) ? value : new Intl.DateTimeFormat("en-US", { dateStyle:"medium", timeStyle:"short" }).format(parsed);
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

  function renderOverview(data) {
    document.getElementById("member-count").textContent = data.summary.members;
    document.getElementById("device-count").textContent = data.summary.activeDevices;
    document.getElementById("card-count").textContent = data.summary.activeCards;
    memberList.innerHTML = "";

    data.members.forEach((member) => {
      const node = template.content.cloneNode(true);
      const card = node.querySelector(".member-card");
      card.dataset.memberId = member.id;
      node.querySelector(".avatar").textContent = (member.displayName || "D").charAt(0).toUpperCase();
      node.querySelector("h2").textContent = member.displayName;
      node.querySelector(".member-id").textContent = member.memberNumber || member.id;
      const status = node.querySelector(".member-status");
      status.textContent = member.status === "active" ? "Active" : "Disabled";
      status.classList.toggle("inactive", member.status !== "active");

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
        row.querySelector("small").textContent = `Last seen ${friendlyDate(device.lastSeenAt)}`;
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
      if (error.unauthorized) unauthorizedState.hidden = false;
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

  document.getElementById("refresh-button").addEventListener("click", load);
  load();
})();
