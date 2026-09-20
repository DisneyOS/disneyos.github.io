import {freshness, today} from './parks-model.mjs';
(() => {
  "use strict";

  const API_BASE = "https://disneyos-api.disneyosplanner.workers.dev/v1";
  const PARK_NAMES = {
    "magic-kingdom": "Magic Kingdom",
    epcot: "EPCOT",
    "hollywood-studios": "Hollywood Studios",
    "animal-kingdom": "Animal Kingdom",
    "disney-springs": "Disney Springs"
  };

  let sourceUpdated = null;
  let refreshFailed = false;
  const params = new URLSearchParams(window.location.search);
  const requestedPark = params.get("park");
  const park = PARK_NAMES[requestedPark] ? requestedPark : "magic-kingdom";

  const title = document.getElementById("park-title");
  const select = document.getElementById("park-select");
  const list = document.getElementById("wait-list");
  const updated = document.getElementById("updated-time");
  const refresh = document.getElementById("refresh-button");
  const errorPanel = document.getElementById("error-panel");
  const errorMessage = document.getElementById("error-message");

  title.textContent = `${PARK_NAMES[park]} Wait Times`;
  if(park==='disney-springs')select.add(new Option('Disney Springs','disney-springs'));
  select.value = park;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalize(data) {
    const rows = data?.attractions || data?.rides || data?.waitTimes || data?.items || data?.liveData || [];
    if (!Array.isArray(rows)) return [];
    return rows.map(item => {
      const name = item.name || item.attractionName || item.rideName || item.title || "Attraction";
      const rawWait = item.waitTime ?? item.wait_time ?? item.wait ?? item.minutes ?? item.waitMinutes;
      const wait = Number(rawWait);
      const status = String(item.status || item.state || (item.isOpen === false ? "UNAVAILABLE" : "OPERATING")).toUpperCase();
      return {
        id: item.id ?? name,
        name: String(name).trim(),
        land: String(item.land || item.area || item.landName || "").trim(),
        wait: rawWait !== null && rawWait !== undefined && rawWait !== "" && Number.isFinite(wait) ? wait : null,
        status
      };
    }).filter(item => item.name).sort((a,b) => {
      const aClosed = a.status.includes("CLOSED") || a.status.includes("DOWN") || a.status.includes("UNAVAILABLE") || a.wait === null;
      const bClosed = b.status.includes("CLOSED") || b.status.includes("DOWN") || b.status.includes("UNAVAILABLE") || b.wait === null;
      if (aClosed !== bClosed) return aClosed ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }

  function render(rows) {
    if (!rows.length) {
      list.innerHTML = '<article class="error-panel"><strong>No wait times are currently available.</strong><p>Try refreshing in a moment.</p></article>';
      return;
    }
    list.innerHTML = rows.map(ride => {
      const unavailable = ride.status.includes("CLOSED") || ride.status.includes("DOWN") || ride.status.includes("UNAVAILABLE") || ride.status.includes("REFURB") || ride.wait === null;
      const waitMarkup = unavailable
        ? `<span class="closed-label">${ride.status.includes('CLOSED') || ride.status.includes('REFURB') ? 'Closed' : 'Unavailable'}</span>`
        : `<span class="wait-number">${ride.wait}</span><span class="wait-unit">minutes</span>`;
      return `<article class="ride-card"><div><h2 class="ride-name"><a style="color:inherit" href="index.html?view=parks&amp;destination=${encodeURIComponent(park)}&amp;parksDate=${today()}&amp;area=rides&amp;item=${encodeURIComponent(ride.id)}">${escapeHtml(ride.name)}</a></h2>${ride.land ? `<p class="ride-land">${escapeHtml(ride.land)}</p>` : ""}</div><div class="wait-display">${waitMarkup}</div></article>`;
    }).join("");
  }

  async function load() {
    if(park==='disney-springs') {
      list.innerHTML='<article class="error-panel"><strong>Wait times are not available for Disney Springs.</strong><p>Choose a theme park to see attraction waits.</p></article>';
      updated.textContent='Disney Springs';return;
    }
    refresh.disabled = true;
    errorPanel.classList.add("hidden");
    updated.textContent = "Updating…";
    try {
      const response = await fetch(`${API_BASE}/wait-times?park=${encodeURIComponent(park)}&refresh=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const payload = await response.json();
      if (!payload?.success || !payload?.data) throw new Error("The live feed returned no data.");
      render(normalize(payload.data));
      sourceUpdated = payload.data.updated;
      refreshFailed = false;
      updated.textContent = freshness(sourceUpdated);
    } catch (error) {
      errorMessage.textContent = error?.message || "Check your connection and try again.";
      errorPanel.classList.remove("hidden");
      refreshFailed = true;
      updated.textContent = sourceUpdated ? freshness(sourceUpdated,true) : "Update failed";
    } finally {
      refresh.disabled = false;
    }
  }

  refresh.addEventListener("click", load);
  load();
  setInterval(() => { if(sourceUpdated)updated.textContent=freshness(sourceUpdated,refreshFailed); },60000);
})();
