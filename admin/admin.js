const GATE12_SAFE_STAGES = new Set([
  "PREFLIGHT", "FIXTURE_SETUP", "BROAD_FIRST", "BROAD_DUPLICATE", "BROAD_CHANGE", "BROAD_ASSERTIONS",
  "DETAILED_FIRST", "DETAILED_CHANGE", "DETAILED_ASSERTIONS", "HISTORY_ASSERTIONS", "TARGET_CREATE",
  "TARGET_EVALUATE", "EXPIRED_INGEST", "EXPIRED_SUPPRESSION", "CLEANUP", "COMPLETE",
]);
const GATE12_SAFE_MESSAGES = Object.freeze({
  GATE12_ALREADY_EXECUTED: "Controlled smoke authorization has already been consumed.",
  SMOKE_PASS: "Controlled smoke completed.",
  SMOKE_PREFLIGHT_FAILED: "Controlled smoke preflight failed.",
  SMOKE_INGESTION_FAILED: "Controlled smoke ingestion step failed.",
  SMOKE_ASSERTION_FAILED: "Controlled smoke assertion failed.",
  SMOKE_STAGE_FAILED: "Controlled smoke stage failed.",
  SMOKE_CLEANUP_FAILED: "Controlled smoke cleanup failed.",
  SMOKE_AND_CLEANUP_FAILED: "Controlled smoke and cleanup failed.",
  SMOKE_DIAGNOSTIC_UNAVAILABLE: "Controlled smoke returned no usable diagnostic evidence.",
});
const GATE12_SAFE_ASSERTIONS = new Set([
  "broad_current", "duplicate_idempotent", "detailed_current", "history_change",
  "receipt_duplicate_count", "target_4pm_semantics", "expired_inventory_suppression",
]);

function sanitizeGate12Diagnostic(payload) {
  const code = Object.hasOwn(GATE12_SAFE_MESSAGES, payload?.code) ? payload.code : "SMOKE_DIAGNOSTIC_UNAVAILABLE";
  const stage = GATE12_SAFE_STAGES.has(payload?.stage) ? payload.stage : null;
  const lastCompletedStage = GATE12_SAFE_STAGES.has(payload?.lastCompletedStage) ? payload.lastCompletedStage : null;
  const requestId = /^phase4_gate12_[0-9a-f-]{36}$/.test(payload?.requestId || "") ? payload.requestId : null;
  const cleanupStatus = ["PASS", "FAIL", "NOT_RUN"].includes(payload?.cleanupStatus) ? payload.cleanupStatus : "FAIL";
  const cleanupRemainingRows = Number.isInteger(payload?.cleanupRemainingRows) && payload.cleanupRemainingRows >= 0 && payload.cleanupRemainingRows <= 1000000 ? payload.cleanupRemainingRows : null;
  const assertions = Array.isArray(payload?.assertions) ? payload.assertions.slice(0, 7).flatMap((item) => {
    if (!GATE12_SAFE_ASSERTIONS.has(item?.name) || !["PASS", "FAIL"].includes(item?.status)) return [];
    const count = Number.isInteger(item.count) && item.count >= 0 && item.count <= 1000000 ? item.count : undefined;
    return [{ name: item.name, status: item.status, ...(count === undefined ? {} : { count }) }];
  }) : [];
  return {
    ok: payload?.ok === true && code === "SMOKE_PASS",
    stage,
    code,
    message: GATE12_SAFE_MESSAGES[code],
    requestId,
    lastCompletedStage,
    cleanupStatus,
    cleanupRemainingRows,
    assertions,
  };
}

if (typeof module !== "undefined" && module.exports) module.exports = { sanitizeGate12Diagnostic };

(() => {
  "use strict";

  if (typeof document === "undefined") return;

  const API_BASE = "https://disneyos-api-dev.disneyosplanner.workers.dev/v1";
  const TOKEN_KEY = "disneyos-member-device-token";
  const PROFILE_KEY = "disneyos-member-profile";
  const loadingState = document.getElementById("loading-state");
  const unauthorizedState = document.getElementById("unauthorized-state");
  const adminContent = document.getElementById("admin-content");
  const memberList = document.getElementById("member-list");
  const template = document.getElementById("member-template");
  const message = document.getElementById("message");
  const gate12Button = document.getElementById("gate12-smoke-button");
  const gate12Result = document.getElementById("gate12-smoke-result");
  let gate12Confirmed = false;

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

  async function gate12Api() {
    const response = await fetch(`${API_BASE}/admin/availability/phase4-smoke`, {
      method: "POST",
      cache: "no-store",
      headers: headers(true),
      body: JSON.stringify({ confirmation: "RUN_PHASE4_GATE12_V1" })
    });
    const payload = await response.json().catch(() => null);
    if (response.status === 401 || response.status === 403) throw Object.assign(new Error("Administrator access required."), { unauthorized:true });
    return sanitizeGate12Diagnostic(payload);
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

  async function runGate12Smoke() {
    if (!gate12Confirmed) {
      gate12Confirmed = true;
      gate12Button.textContent = "Confirm and run controlled Gate 12 test";
      gate12Result.textContent = "Confirm the one-time controlled production verification using the button again.";
      gate12Result.hidden = false;
      return;
    }
    gate12Button.disabled = true;
    gate12Button.textContent = "Running controlled test…";
    gate12Result.hidden = true;
    try {
      const result = await gate12Api();
      const completed = result.lastCompletedStage || "NONE";
      gate12Result.textContent = `${result.code}: ${result.message} Stage ${result.stage || "UNKNOWN"}; last completed ${completed}; cleanup ${result.cleanupStatus}.`;
      gate12Result.hidden = false;
      showMessage(result.ok ? "Controlled Gate 12 verification completed." : "Controlled Gate 12 verification returned safe diagnostic evidence.", !result.ok);
    } catch (error) {
      gate12Result.textContent = "No safe Gate 12 diagnostic response was available.";
      gate12Result.hidden = false;
      showMessage(error.unauthorized ? "Administrator access required." : "DisneyOS could not complete the request.", true);
    } finally {
      gate12Button.disabled = true;
      gate12Button.textContent = "Controlled Gate 12 test completed";
    }
  }

  document.getElementById("refresh-button").addEventListener("click", load);
  gate12Button.addEventListener("click", runGate12Smoke);
  load();
})();
