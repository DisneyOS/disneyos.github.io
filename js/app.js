/**
 * DisneyOS v1.3
 * Home dashboard, park selection, expandable schedules, and profile settings.
 */

document.addEventListener("DOMContentLoaded", () => {
  const navButtons = document.querySelectorAll(".nav-button");
  const pages = document.querySelectorAll(".page");
  const greetingElement = document.getElementById("greeting");
  const dateElement = document.getElementById("current-date");
  const currentParkElement = document.getElementById("current-park");
  const profileInitialElement = document.getElementById("profile-initial");
  const settingsNameElement = document.getElementById("settings-name");
  const settingsParkElement = document.getElementById("settings-park");
  const editNameButton = document.getElementById("edit-name-button");
  const editParkButton = document.getElementById("edit-park-button");
  const waitTimesShortcut = document.getElementById("wait-times-shortcut");
  const openWaitTimesButtons = document.querySelectorAll('[data-action="open-wait-times"]');
  const waitTimesButtons = document.querySelectorAll("[data-wait-park]");
  const homeParkSelector = document.getElementById("home-park-selector");
  const parkSelectorPanel = document.getElementById("park-selector-panel");
  const homeParkButtons = document.querySelectorAll("[data-home-park]");
  const parkMapButton = document.getElementById("park-map-button");

  const storageKeys = {
    activePage: "disneyos-active-page",
    displayName: "disneyos-display-name",
    preferredPark: "disneyos-preferred-park",
    todaysPark: "disneyos-todays-park"
  };

  const parkOptions = [
    "Magic Kingdom",
    "EPCOT",
    "Hollywood Studios",
    "Animal Kingdom"
  ];

  const parkSlugs = {
    "Magic Kingdom": "magic-kingdom",
    "EPCOT": "epcot",
    "Hollywood Studios": "hollywood-studios",
    "Animal Kingdom": "animal-kingdom"
  };

  // These values establish the v1 home-page structure. Live park-hours,
  // entertainment, crowd, and capacity feeds can replace them independently.
  const parkData = {
    "Magic Kingdom": {
      hours: "Schedule feed pending",
      crowd: "Calculating…",
      capacity: "Status unavailable",
      transportation: "Monorail, ferryboat, and Disney bus service",
      mapUrl: "https://disneyworld.disney.go.com/maps/magic-kingdom/",
      schedules: [
        { title: "Stage-show schedule", times: [] },
        { title: "Parade schedule", times: [] },
        { title: "Nighttime spectacular", times: [] }
      ]
    },
    "EPCOT": {
      hours: "Schedule feed pending",
      crowd: "Calculating…",
      capacity: "Status unavailable",
      transportation: "Monorail, Disney Skyliner, boats, and bus service",
      mapUrl: "https://disneyworld.disney.go.com/maps/epcot/",
      schedules: [
        { title: "Stage-show schedule", times: [] },
        { title: "Festival entertainment", times: [] },
        { title: "Nighttime spectacular", times: [] }
      ]
    },
    "Hollywood Studios": {
      hours: "Schedule feed pending",
      crowd: "Calculating…",
      capacity: "Status unavailable",
      transportation: "Disney Skyliner, boats, and Disney bus service",
      mapUrl: "https://disneyworld.disney.go.com/maps/hollywood-studios/",
      schedules: [
        { title: "Stage-show schedule", times: [] },
        { title: "Character and street entertainment", times: [] },
        { title: "Nighttime spectacular", times: [] }
      ]
    },
    "Animal Kingdom": {
      hours: "Schedule feed pending",
      crowd: "Calculating…",
      capacity: "Status unavailable",
      transportation: "Disney bus service and parking trams",
      mapUrl: "https://disneyworld.disney.go.com/maps/animal-kingdom/",
      schedules: [
        { title: "Stage-show schedule", times: [] },
        { title: "Animal and street entertainment", times: [] },
        { title: "Evening entertainment", times: [] }
      ]
    }
  };

  let profile = {
    displayName: getStoredValue(storageKeys.displayName, ""),
    preferredPark: getStoredValue(storageKeys.preferredPark, "Magic Kingdom"),
    todaysPark: getStoredValue(storageKeys.todaysPark, "")
  };

  function getStoredValue(key, fallbackValue) {
    try {
      return window.localStorage.getItem(key) ?? fallbackValue;
    } catch (error) {
      console.warn(`DisneyOS could not read local setting: ${key}`, error);
      return fallbackValue;
    }
  }

  function saveStoredValue(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn(`DisneyOS could not save local setting: ${key}`, error);
    }
  }

  function getActivePark() {
    return parkOptions.includes(profile.todaysPark)
      ? profile.todaysPark
      : profile.preferredPark;
  }

  function showPage(targetPage) {
    const requestedPage = document.querySelector(`[data-page="${targetPage}"]`);
    if (!requestedPage) return;

    pages.forEach((page) => page.classList.toggle("active", page.dataset.page === targetPage));
    navButtons.forEach((button) => {
      const isActive = button.dataset.target === targetPage;
      button.classList.toggle("active", isActive);
      isActive ? button.setAttribute("aria-current", "page") : button.removeAttribute("aria-current");
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
    saveStoredValue(storageKeys.activePage, targetPage);
  }

  function getTimeBasedGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  }

  function renderProfile() {
    const cleanName = profile.displayName.trim();
    const activePark = getActivePark();

    if (greetingElement) greetingElement.textContent = cleanName ? `${getTimeBasedGreeting()}, ${cleanName}` : getTimeBasedGreeting();
    if (dateElement) dateElement.textContent = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
    if (settingsNameElement) settingsNameElement.textContent = cleanName || "Not set";
    if (profileInitialElement) profileInitialElement.textContent = cleanName ? cleanName.charAt(0).toUpperCase() : "D";
    if (settingsParkElement) settingsParkElement.textContent = profile.preferredPark;
    if (currentParkElement) currentParkElement.textContent = activePark;

    renderHomePark(activePark);
  }

  function renderHomePark(parkName) {
    const data = parkData[parkName] || parkData["Magic Kingdom"];
    setText("park-hours", data.hours);
    setText("current-crowd", data.crowd);
    setText("park-capacity", data.capacity);
    setText("transportation-title", `${parkName} transportation`);
    setText("transportation-detail", data.transportation);

    const scheduleCards = document.querySelectorAll(".schedule-card");
    scheduleCards.forEach((card, index) => {
      const schedule = data.schedules[index];
      if (!schedule) return;
      const title = card.querySelector("[data-schedule-title]");
      const next = card.querySelector("[data-schedule-next]");
      const times = card.querySelector("[data-schedule-times]");
      if (title) title.textContent = schedule.title;
      if (next) next.textContent = schedule.times.length ? `Next: ${schedule.times[0]}` : "Schedule feed is being connected";
      if (times) times.innerHTML = schedule.times.length
        ? schedule.times.map((time) => `<span class="schedule-time-pill">${time}</span>`).join("")
        : '<p class="schedule-empty-state">No verified remaining times are available yet.</p>';
    });

    updateCrowdFromWaitTimes(parkName);
    updateWeather();
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  async function updateCrowdFromWaitTimes(parkName) {
    const slug = parkSlugs[parkName];
    if (!slug) return;

    try {
      const response = await fetch(`https://disneyos-api.disneyosplanner.workers.dev/v1/wait-times?park=${encodeURIComponent(slug)}`);
      if (!response.ok) throw new Error(`Wait-time request failed: ${response.status}`);
      const payload = await response.json();
      const rides = extractRideRows(payload).filter((ride) => Number.isFinite(ride.wait_time) && ride.is_open !== false);
      if (!rides.length) throw new Error("No open ride waits returned");
      const average = rides.reduce((sum, ride) => sum + ride.wait_time, 0) / rides.length;
      let crowd = "Light";
      if (average >= 45) crowd = "Very busy";
      else if (average >= 30) crowd = "Busy";
      else if (average >= 18) crowd = "Moderate";
      setText("current-crowd", crowd);
    } catch (error) {
      console.warn("DisneyOS could not calculate crowd conditions.", error);
      setText("current-crowd", "Unavailable");
    }
  }

  function extractRideRows(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.rides)) return payload.rides;
    if (Array.isArray(payload.lands)) return payload.lands.flatMap((land) => Array.isArray(land.rides) ? land.rides : []);
    if (payload.data) return extractRideRows(payload.data);
    return [];
  }

  async function updateWeather() {
    try {
      const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=28.3772&longitude=-81.5707&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&timezone=America%2FNew_York&forecast_days=1");
      if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);
      const weather = await response.json();
      const temp = Math.round(weather.current.temperature_2m);
      const high = Math.round(weather.daily.temperature_2m_max[0]);
      const low = Math.round(weather.daily.temperature_2m_min[0]);
      const rain = weather.daily.precipitation_probability_max[0];
      setText("hero-temperature", `${temp}°`);
      setText("hero-weather-icon", getWeatherIcon(weather.current.weather_code));
      setText("weather-summary-title", `${temp}° now · High ${high}°`);
      setText("weather-summary-detail", `Low ${low}° · ${rain}% chance of rain today`);
    } catch (error) {
      console.warn("DisneyOS could not load weather.", error);
      setText("hero-temperature", "--°");
      setText("weather-summary-title", "Forecast unavailable");
      setText("weather-summary-detail", "Check your connection and try again.");
    }
  }

  function getWeatherIcon(code) {
    if (code === 0) return "☀️";
    if ([1, 2].includes(code)) return "🌤️";
    if (code === 3) return "☁️";
    if ([45, 48].includes(code)) return "🌫️";
    if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
    if ([95, 96, 99].includes(code)) return "⛈️";
    return "🌦️";
  }

  function editDisplayName() {
    const enteredName = window.prompt("Enter the name DisneyOS should display:", profile.displayName.trim());
    if (enteredName === null) return;
    const cleanName = enteredName.trim();
    if (cleanName.length > 40) return window.alert("Please use a display name with 40 characters or fewer.");
    profile.displayName = cleanName;
    saveStoredValue(storageKeys.displayName, cleanName);
    renderProfile();
  }

  function editPreferredPark() {
    const parkList = parkOptions.map((park, index) => `${index + 1}. ${park}`).join("\n");
    const currentNumber = Math.max(1, parkOptions.indexOf(profile.preferredPark) + 1);
    const enteredChoice = window.prompt(`Choose your preferred park:\n\n${parkList}\n\nEnter 1 through 4:`, String(currentNumber));
    if (enteredChoice === null) return;
    const selectedPark = parkOptions[Number.parseInt(enteredChoice.trim(), 10) - 1];
    if (!selectedPark) return window.alert("Please enter a number from 1 through 4.");
    profile.preferredPark = selectedPark;
    saveStoredValue(storageKeys.preferredPark, selectedPark);
    renderProfile();
  }

  navButtons.forEach((button) => button.addEventListener("click", () => showPage(button.dataset.target)));
  editNameButton?.addEventListener("click", editDisplayName);
  editParkButton?.addEventListener("click", editPreferredPark);
  waitTimesShortcut?.addEventListener("click", () => window.location.href = "wait-times-menu.html");
  openWaitTimesButtons.forEach((button) => button.addEventListener("click", () => {
    const slug = parkSlugs[getActivePark()];
    window.location.href = slug ? `wait-times.html?park=${encodeURIComponent(slug)}` : "wait-times-menu.html";
  }));
  waitTimesButtons.forEach((button) => button.addEventListener("click", () => {
    if (button.dataset.waitPark) window.location.href = `wait-times.html?park=${encodeURIComponent(button.dataset.waitPark)}`;
  }));

  homeParkSelector?.addEventListener("click", () => {
    const isHidden = parkSelectorPanel.hasAttribute("hidden");
    isHidden ? parkSelectorPanel.removeAttribute("hidden") : parkSelectorPanel.setAttribute("hidden", "");
  });

  homeParkButtons.forEach((button) => button.addEventListener("click", () => {
    profile.todaysPark = button.dataset.homePark;
    saveStoredValue(storageKeys.todaysPark, profile.todaysPark);
    parkSelectorPanel.setAttribute("hidden", "");
    renderProfile();
  }));

  document.querySelectorAll(".schedule-card-toggle").forEach((button) => button.addEventListener("click", () => {
    const card = button.closest(".schedule-card");
    const details = card.querySelector(".schedule-card-details");
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    details.hidden = expanded;
    card.classList.toggle("expanded", !expanded);
  }));

  parkMapButton?.addEventListener("click", () => {
    window.open(parkData[getActivePark()].mapUrl, "_blank", "noopener,noreferrer");
  });

  renderProfile();
  const savedPage = getStoredValue(storageKeys.activePage, "home");
  showPage(document.querySelector(`[data-page="${savedPage}"]`) ? savedPage : "home");
});
