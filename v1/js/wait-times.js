(() => {
  "use strict";

  const API_BASE = "https://disneyos-api.krookstool89.workers.dev/v1";
  const PARK_NAMES = {
    "magic-kingdom": "Magic Kingdom",
    epcot: "EPCOT",
    "hollywood-studios": "Hollywood Studios",
    "animal-kingdom": "Animal Kingdom"
  };

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
      const status = String(item.status || item.state || (item.isOpen === false ? "CLOSED" : "OPERATING")).toUpperCase();
      return {
        name: String(name).trim(),
        land: String(item.land || item.area || item.landName || "").trim(),
        wait: Number.isFinite(wait) ? wait : null,
        status
      };
    }).filter(item => item.name).sort((a,b) => {
      const aClosed = a.status.includes("CLOSED") || a.status.includes("DOWN") || a.wait === null;
      const bClosed = b.status.includes("CLOSED") || b.status.includes("DOWN") || b.wait === null;
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
      const unavailable = ride.status.includes("CLOSED") || ride.status.includes("DOWN") || ride.status.includes("REFURB") || ride.wait === null;
      const waitMarkup = unavailable
        ? '<span class="closed-label">Unavailable</span>'
        : `<span class="wait-number">${ride.wait}</span><span class="wait-unit">minutes</span>`;
      return `<article class="ride-card"><div><h2 class="ride-name">${escapeHtml(ride.name)}</h2>${ride.land ? `<p class="ride-land">${escapeHtml(ride.land)}</p>` : ""}</div><div class="wait-display">${waitMarkup}</div></article>`;
    }).join("");
  }

  async function load() {
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
      updated.textContent = `Updated ${new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(new Date())}`;
    } catch (error) {
      errorMessage.textContent = error?.message || "Check your connection and try again.";
      errorPanel.classList.remove("hidden");
      updated.textContent = "Update failed";
    } finally {
      refresh.disabled = false;
    }
  }

  refresh.addEventListener("click", load);
  load();
})();
