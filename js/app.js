/**
 * DisneyOS v1.4
 * Dynamic home dashboard powered by the DisneyOS API.
 */

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE =
    "https://disneyos-api.disneyosplanner.workers.dev/v1";

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
  const openWaitTimesButtons =
    document.querySelectorAll('[data-action="open-wait-times"]');
  const waitTimesButtons =
    document.querySelectorAll("[data-wait-park]");
  const homeParkSelector =
    document.getElementById("home-park-selector");
  const parkSelectorPanel =
    document.getElementById("park-selector-panel");
  const homeParkButtons =
    document.querySelectorAll("[data-home-park]");
  const parkMapButton =
    document.getElementById("park-map-button");

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
    EPCOT: "epcot",
    "Hollywood Studios": "hollywood-studios",
    "Animal Kingdom": "animal-kingdom"
  };

  const parkMaps = {
    "Magic Kingdom":
      "https://disneyworld.disney.go.com/maps/magic-kingdom/",
    EPCOT:
      "https://disneyworld.disney.go.com/maps/epcot/",
    "Hollywood Studios":
      "https://disneyworld.disney.go.com/maps/hollywood-studios/",
    "Animal Kingdom":
      "https://disneyworld.disney.go.com/maps/animal-kingdom/"
  };

  const entertainmentMeta = {
    nighttime: {
      label: "Nighttime spectacular",
      icon: "🎆",
      order: 1
    },
    parade: {
      label: "Parades & cavalcades",
      icon: "🎉",
      order: 2
    },
    show: {
      label: "Shows & entertainment",
      icon: "🎭",
      order: 3
    },
    character: {
      label: "Character experiences",
      icon: "👋",
      order: 4
    }
  };

  let loadSequence = 0;

  let profile = {
    displayName:
      getStoredValue(storageKeys.displayName, ""),
    preferredPark:
      getStoredValue(
        storageKeys.preferredPark,
        "Magic Kingdom"
      ),
    todaysPark:
      getStoredValue(storageKeys.todaysPark, "")
  };

  function getStoredValue(key, fallbackValue) {
    try {
      return (
        window.localStorage.getItem(key) ??
        fallbackValue
      );
    } catch (error) {
      console.warn(
        `DisneyOS could not read local setting: ${key}`,
        error
      );
      return fallbackValue;
    }
  }

  function saveStoredValue(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      console.warn(
        `DisneyOS could not save local setting: ${key}`,
        error
      );
    }
  }

  function getActivePark() {
    return parkOptions.includes(profile.todaysPark)
      ? profile.todaysPark
      : profile.preferredPark;
  }

  function getActiveParkSlug() {
    return parkSlugs[getActivePark()];
  }

  function setText(id, value) {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  }

  function showPage(targetPage) {
    const requestedPage = document.querySelector(
      `[data-page="${targetPage}"]`
    );

    if (!requestedPage) {
      return;
    }

    pages.forEach((page) => {
      page.classList.toggle(
        "active",
        page.dataset.page === targetPage
      );
    });

    navButtons.forEach((button) => {
      const isActive =
        button.dataset.target === targetPage;

      button.classList.toggle("active", isActive);

      if (isActive) {
        button.setAttribute(
          "aria-current",
          "page"
        );
      } else {
        button.removeAttribute("aria-current");
      }
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    saveStoredValue(
      storageKeys.activePage,
      targetPage
    );
  }

  function getTimeBasedGreeting() {
    const hour = new Date().getHours();

    if (hour < 12) {
      return "Good morning";
    }

    if (hour < 17) {
      return "Good afternoon";
    }

    return "Good evening";
  }

  function renderProfile() {
    const cleanName = profile.displayName.trim();
    const activePark = getActivePark();

    if (greetingElement) {
      greetingElement.textContent = cleanName
        ? `${getTimeBasedGreeting()}, ${cleanName}`
        : getTimeBasedGreeting();
    }

    if (dateElement) {
      dateElement.textContent =
        new Intl.DateTimeFormat("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric"
        }).format(new Date());
    }

    if (settingsNameElement) {
      settingsNameElement.textContent =
        cleanName || "Not set";
    }

    if (profileInitialElement) {
      profileInitialElement.textContent =
        cleanName
          ? cleanName.charAt(0).toUpperCase()
          : "D";
    }

    if (settingsParkElement) {
      settingsParkElement.textContent =
        profile.preferredPark;
    }

    if (currentParkElement) {
      currentParkElement.textContent =
        activePark;
    }

    loadDynamicHome(activePark);
  }

  function setLoadingState(parkName) {
    setText("park-hours", "Checking…");
    setText("current-crowd", "Checking…");
    setText("park-status", "Checking…");
    setText(
      "transportation-title",
      `${parkName} transportation`
    );
    setText(
      "transportation-detail",
      "Checking routes for this park"
    );

    const list =
      document.getElementById(
        "schedule-card-list"
      );

    if (list) {
      list.innerHTML = `
        <article class="schedule-loading-card">
          <div class="loading-spinner" aria-hidden="true"></div>
          <div>
            <strong>Loading today’s entertainment</strong>
            <p>Checking remaining showtimes for ${escapeHtml(
              parkName
            )}.</p>
          </div>
        </article>
      `;
    }
  }

  async function loadDynamicHome(parkName) {
    const slug = parkSlugs[parkName];

    if (!slug) {
      return;
    }

    const requestId = ++loadSequence;
    setLoadingState(parkName);

    const [parkDayResult, weatherResult] =
      await Promise.allSettled([
        fetchParkDay(slug),
        fetchWeather()
      ]);

    if (requestId !== loadSequence) {
      return;
    }

    if (parkDayResult.status === "fulfilled") {
      renderParkDay(parkDayResult.value);
    } else {
      console.warn(
        "DisneyOS could not load park-day data.",
        parkDayResult.reason
      );
      renderParkDayError(parkName);
    }

    if (weatherResult.status === "fulfilled") {
      renderWeather(weatherResult.value);
    } else {
      console.warn(
        "DisneyOS could not load weather.",
        weatherResult.reason
      );
      renderWeatherError();
    }
  }

  async function fetchParkDay(slug) {
    const response = await fetch(
      `${API_BASE}/park-day?park=${encodeURIComponent(
        slug
      )}`,
      {
        headers: {
          Accept: "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Park-day request failed: ${response.status}`
      );
    }

    const payload = await response.json();

    if (!payload?.success || !payload?.data) {
      throw new Error(
        "Park-day response did not contain data."
      );
    }

    return payload.data;
  }

  async function fetchWeather() {
    const response = await fetch(
      "https://api.open-meteo.com/v1/forecast" +
        "?latitude=28.3772" +
        "&longitude=-81.5707" +
        "&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m" +
        "&hourly=precipitation_probability" +
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max" +
        "&temperature_unit=fahrenheit" +
        "&wind_speed_unit=mph" +
        "&timezone=America%2FNew_York" +
        "&forecast_days=1"
    );

    if (!response.ok) {
      throw new Error(
        `Weather request failed: ${response.status}`
      );
    }

    return response.json();
  }

  function renderParkDay(data) {
    const hours = data.hours || {};
    const park = data.park || {};

    setText(
      "park-hours",
      formatHours(hours.open, hours.close)
    );

    setText(
      "current-crowd",
      data.crowd?.label || "Unavailable"
    );

    setText(
      "park-status",
      park.status || "Scheduled"
    );

    renderSpecialHours(hours.entries || []);
    renderEntertainment(
      data.entertainment || []
    );
    renderTransportation(
      park.name || getActivePark(),
      data.transportation || []
    );
  }

  function renderSpecialHours(entries) {
    const hero = document.querySelector(
      ".home-hero-card"
    );

    if (!hero) {
      return;
    }

    let strip =
      document.getElementById(
        "special-hours-strip"
      );

    const specialEntries = entries.filter(
      (entry) => {
        const description =
          String(
            entry.description || ""
          ).toLowerCase();

        return (
          description.includes("early entry") ||
          description.includes(
            "extended evening"
          )
        );
      }
    );

    if (!specialEntries.length) {
      strip?.remove();
      return;
    }

    if (!strip) {
      strip = document.createElement("div");
      strip.id = "special-hours-strip";
      strip.className =
        "special-hours-strip";

      const selectorPanel =
        document.getElementById(
          "park-selector-panel"
        );

      hero.insertBefore(
        strip,
        selectorPanel || null
      );
    }

    strip.innerHTML = specialEntries
      .map((entry) => {
        const label =
          escapeHtml(
            entry.description ||
              "Special hours"
          );

        const time =
          formatHours(
            entry.openingTime,
            entry.closingTime
          );

        return `
          <div class="special-hours-item">
            <span>${label}</span>
            <strong>${escapeHtml(time)}</strong>
          </div>
        `;
      })
      .join("");
  }

  function renderEntertainment(items) {
    const container =
      document.getElementById(
        "schedule-card-list"
      );

    if (!container) {
      return;
    }

    const groups = groupEntertainment(items);
    const groupEntries = Object.entries(groups)
      .filter(([, groupItems]) =>
        groupItems.some(
          (item) =>
            getRemainingShowtimes(item)
              .length > 0
        )
      )
      .sort(
        ([categoryA], [categoryB]) =>
          entertainmentMeta[categoryA].order -
          entertainmentMeta[categoryB].order
      );

    if (!groupEntries.length) {
      container.innerHTML = `
        <article class="schedule-empty-card">
          <span class="schedule-card-icon">✨</span>
          <div>
            <strong>No remaining entertainment today</strong>
            <p>All scheduled performances for this park have ended.</p>
          </div>
        </article>
      `;
      return;
    }

    container.innerHTML = groupEntries
      .map(([category, groupItems]) =>
        createEntertainmentCard(
          category,
          groupItems
        )
      )
      .join("");

    attachExpandableCardHandlers(container);
  }

  function groupEntertainment(items) {
    return items.reduce((groups, item) => {
      const category =
        entertainmentMeta[item.category]
          ? item.category
          : "show";

      if (!groups[category]) {
        groups[category] = [];
      }

      groups[category].push(item);
      return groups;
    }, {});
  }

  function createEntertainmentCard(
    category,
    items
  ) {
    const meta =
      entertainmentMeta[category];

    const remainingItems = items
      .map((item) => ({
        ...item,
        remaining:
          getRemainingShowtimes(item)
      }))
      .filter(
        (item) =>
          item.remaining.length > 0
      )
      .sort(
        (a, b) =>
          new Date(
            a.remaining[0].startTime
          ) -
          new Date(
            b.remaining[0].startTime
          )
      );

    const nextItem = remainingItems[0];
    const nextTime =
      nextItem?.remaining?.[0]
        ?.startTime;

    return `
      <article class="schedule-card">
        <button
          class="schedule-card-toggle"
          type="button"
          aria-expanded="false"
        >
          <span class="schedule-card-icon">
            ${meta.icon}
          </span>

          <span class="schedule-card-copy">
            <span class="card-label">
              ${escapeHtml(meta.label)}
            </span>

            <strong>
              ${escapeHtml(
                nextItem?.name ||
                  "No remaining events"
              )}
            </strong>

            <small>
              ${
                nextTime
                  ? `Next at ${escapeHtml(
                      formatTime(nextTime)
                    )}`
                  : "No remaining times"
              }
            </small>
          </span>

          <span class="schedule-chevron">›</span>
        </button>

        <div
          class="schedule-card-details"
          hidden
        >
          <div class="event-list">
            ${remainingItems
              .map(
                (item) => `
                  <div class="event-row">
                    <div>
                      <strong>${escapeHtml(
                        item.name
                      )}</strong>
                      <small>${escapeHtml(
                        getEventSubtitle(item)
                      )}</small>
                    </div>

                    <div class="schedule-time-list">
                      ${item.remaining
                        .map(
                          (showtime) => `
                            <span class="schedule-time-pill">
                              ${escapeHtml(
                                formatShowtime(
                                  showtime
                                )
                              )}
                            </span>
                          `
                        )
                        .join("")}
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
        </div>
      </article>
    `;
  }

  function getRemainingShowtimes(item) {
    const now = Date.now();

    return (item.showtimes || []).filter(
      (showtime) => {
        const start = new Date(
          showtime.startTime
        ).getTime();

        const end = new Date(
          showtime.endTime ||
            showtime.startTime
        ).getTime();

        const isOperatingWindow =
          String(
            showtime.type || ""
          ).toLowerCase() ===
          "operating";

        if (isOperatingWindow) {
          return end >= now;
        }

        return start >= now - 5 * 60 * 1000;
      }
    );
  }

  function getEventSubtitle(item) {
    const first =
      item.remaining?.[0];

    if (
      first &&
      String(
        first.type || ""
      ).toLowerCase() === "operating"
    ) {
      return "Available during this operating window";
    }

    const count =
      item.remaining?.length || 0;

    return `${count} remaining ${
      count === 1 ? "time" : "times"
    } today`;
  }

  function formatShowtime(showtime) {
    const type = String(
      showtime.type || ""
    ).toLowerCase();

    if (
      type === "operating" &&
      showtime.endTime
    ) {
      return formatHours(
        showtime.startTime,
        showtime.endTime
      );
    }

    return formatTime(showtime.startTime);
  }

  function renderTransportation(
    parkName,
    options
  ) {
    setText(
      "transportation-title",
      `${parkName} transportation`
    );

    const detail =
      options.length === 1
        ? options[0].name
        : `${options.length} transportation options`;

    setText(
      "transportation-detail",
      options.length
        ? detail
        : "Transportation information unavailable"
    );

    const list =
      document.getElementById(
        "transportation-list"
      );

    if (!list) {
      return;
    }

    list.innerHTML = options.length
      ? options
          .map(
            (option) => `
              <div class="transportation-row">
                <span class="transportation-dot" aria-hidden="true"></span>
                <div>
                  <strong>${escapeHtml(
                    option.name
                  )}</strong>
                  <p>${escapeHtml(
                    option.description
                  )}</p>
                </div>
              </div>
            `
          )
          .join("")
      : `
          <p class="schedule-empty-state">
            Transportation information is not available right now.
          </p>
        `;
  }

  function renderParkDayError(parkName) {
    setText(
      "park-hours",
      "Unavailable"
    );
    setText(
      "current-crowd",
      "Unavailable"
    );
    setText(
      "park-status",
      "Unavailable"
    );
    setText(
      "transportation-title",
      `${parkName} transportation`
    );
    setText(
      "transportation-detail",
      "Unable to load transportation options"
    );

    const container =
      document.getElementById(
        "schedule-card-list"
      );

    if (container) {
      container.innerHTML = `
        <article class="schedule-empty-card error-state">
          <span class="schedule-card-icon">⚠️</span>
          <div>
            <strong>Schedule temporarily unavailable</strong>
            <p>DisneyOS could not reach the park-day feed. Pull down or refresh to try again.</p>
          </div>
        </article>
      `;
    }
  }

  function renderWeather(weather) {
    const current =
      weather.current || {};
    const daily =
      weather.daily || {};

    const temperature =
      Math.round(
        current.temperature_2m
      );
    const feelsLike =
      Math.round(
        current.apparent_temperature
      );
    const high =
      Math.round(
        daily.temperature_2m_max?.[0]
      );
    const low =
      Math.round(
        daily.temperature_2m_min?.[0]
      );
    const rain =
      daily
        .precipitation_probability_max?.[0] ??
      0;
    const wind =
      Math.round(
        current.wind_speed_10m || 0
      );
    const icon =
      getWeatherIcon(
        current.weather_code
      );
    const condition =
      getWeatherDescription(
        current.weather_code
      );

    setText(
      "hero-temperature",
      `${temperature}°`
    );
    setText(
      "hero-weather-icon",
      icon
    );
    setText(
      "weather-card-icon",
      icon
    );
    setText(
      "weather-summary-title",
      `${temperature}° · ${condition}`
    );
    setText(
      "weather-summary-detail",
      `High ${high}° · ${rain}% chance of rain`
    );

    const grid =
      document.getElementById(
        "weather-detail-grid"
      );

    if (grid) {
      grid.innerHTML = `
        ${weatherMetric(
          "Feels like",
          `${feelsLike}°`
        )}
        ${weatherMetric(
          "Today’s high",
          `${high}°`
        )}
        ${weatherMetric(
          "Tonight’s low",
          `${low}°`
        )}
        ${weatherMetric(
          "Rain chance",
          `${rain}%`
        )}
        ${weatherMetric(
          "Wind",
          `${wind} mph`
        )}
      `;
    }
  }

  function weatherMetric(label, value) {
    return `
      <div class="weather-metric">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `;
  }

  function renderWeatherError() {
    setText("hero-temperature", "--°");
    setText("hero-weather-icon", "🌦️");
    setText(
      "weather-card-icon",
      "🌦️"
    );
    setText(
      "weather-summary-title",
      "Forecast unavailable"
    );
    setText(
      "weather-summary-detail",
      "Check your connection and try again"
    );

    const grid =
      document.getElementById(
        "weather-detail-grid"
      );

    if (grid) {
      grid.innerHTML = `
        <p class="schedule-empty-state">
          Current weather details could not be loaded.
        </p>
      `;
    }
  }

  function formatHours(start, end) {
    if (!start || !end) {
      return "Schedule unavailable";
    }

    return `${formatTime(start)} – ${formatTime(
      end
    )}`;
  }

  function formatTime(value) {
    if (!value) {
      return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "America/New_York",
        hour: "numeric",
        minute: "2-digit"
      }
    ).format(date);
  }

  function getWeatherIcon(code) {
    if (code === 0) return "☀️";
    if ([1, 2].includes(code)) return "🌤️";
    if (code === 3) return "☁️";
    if ([45, 48].includes(code)) return "🌫️";

    if (
      [
        51, 53, 55, 61, 63, 65,
        80, 81, 82
      ].includes(code)
    ) {
      return "🌧️";
    }

    if ([95, 96, 99].includes(code)) {
      return "⛈️";
    }

    return "🌦️";
  }

  function getWeatherDescription(code) {
    if (code === 0) return "Clear";
    if (code === 1) return "Mostly clear";
    if (code === 2) return "Partly cloudy";
    if (code === 3) return "Cloudy";
    if ([45, 48].includes(code)) return "Foggy";
    if ([51, 53, 55].includes(code)) return "Drizzle";
    if ([61, 63, 65].includes(code)) return "Rain";
    if ([80, 81, 82].includes(code)) return "Rain showers";
    if ([95, 96, 99].includes(code)) return "Thunderstorms";
    return "Current conditions";
  }

  function attachExpandableCardHandlers(
    root = document
  ) {
    root
      .querySelectorAll(
        ".schedule-card-toggle, .info-card-toggle"
      )
      .forEach((button) => {
        if (button.dataset.bound === "true") {
          return;
        }

        button.dataset.bound = "true";

        button.addEventListener(
          "click",
          () => {
            const card = button.closest(
              ".schedule-card, .expandable-info-card"
            );
            const details =
              card?.querySelector(
                ".schedule-card-details, .info-card-details"
              );

            if (!card || !details) {
              return;
            }

            const expanded =
              button.getAttribute(
                "aria-expanded"
              ) === "true";

            button.setAttribute(
              "aria-expanded",
              String(!expanded)
            );

            details.hidden = expanded;
            card.classList.toggle(
              "expanded",
              !expanded
            );
          }
        );
      });
  }

  function editDisplayName() {
    const enteredName = window.prompt(
      "Enter the name DisneyOS should display:",
      profile.displayName.trim()
    );

    if (enteredName === null) {
      return;
    }

    const cleanName = enteredName.trim();

    if (cleanName.length > 40) {
      window.alert(
        "Please use a display name with 40 characters or fewer."
      );
      return;
    }

    profile.displayName = cleanName;

    saveStoredValue(
      storageKeys.displayName,
      cleanName
    );

    renderProfile();
  }

  function editPreferredPark() {
    const parkList = parkOptions
      .map(
        (park, index) =>
          `${index + 1}. ${park}`
      )
      .join("\n");

    const currentNumber = Math.max(
      1,
      parkOptions.indexOf(
        profile.preferredPark
      ) + 1
    );

    const enteredChoice = window.prompt(
      `Choose your preferred park:\n\n${parkList}\n\nEnter 1 through 4:`,
      String(currentNumber)
    );

    if (enteredChoice === null) {
      return;
    }

    const selectedPark =
      parkOptions[
        Number.parseInt(
          enteredChoice.trim(),
          10
        ) - 1
      ];

    if (!selectedPark) {
      window.alert(
        "Please enter a number from 1 through 4."
      );
      return;
    }

    profile.preferredPark = selectedPark;

    saveStoredValue(
      storageKeys.preferredPark,
      selectedPark
    );

    renderProfile();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      showPage(button.dataset.target);
    });
  });

  editNameButton?.addEventListener(
    "click",
    editDisplayName
  );

  editParkButton?.addEventListener(
    "click",
    editPreferredPark
  );

  waitTimesShortcut?.addEventListener(
    "click",
    () => {
      window.location.href =
        "wait-times-menu.html";
    }
  );

  openWaitTimesButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const slug = getActiveParkSlug();

      window.location.href = slug
        ? `wait-times.html?park=${encodeURIComponent(
            slug
          )}`
        : "wait-times-menu.html";
    });
  });

  waitTimesButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.waitPark) {
        window.location.href =
          `wait-times.html?park=${encodeURIComponent(
            button.dataset.waitPark
          )}`;
      }
    });
  });

  homeParkSelector?.addEventListener(
    "click",
    () => {
      const isHidden =
        parkSelectorPanel.hasAttribute(
          "hidden"
        );

      if (isHidden) {
        parkSelectorPanel.removeAttribute(
          "hidden"
        );
      } else {
        parkSelectorPanel.setAttribute(
          "hidden",
          ""
        );
      }
    }
  );

  homeParkButtons.forEach((button) => {
    button.addEventListener("click", () => {
      profile.todaysPark =
        button.dataset.homePark;

      saveStoredValue(
        storageKeys.todaysPark,
        profile.todaysPark
      );

      parkSelectorPanel.setAttribute(
        "hidden",
        ""
      );

      renderProfile();
    });
  });

  parkMapButton?.addEventListener(
    "click",
    () => {
      window.open(
        parkMaps[getActivePark()],
        "_blank",
        "noopener,noreferrer"
      );
    }
  );

  attachExpandableCardHandlers();

  renderProfile();

  const savedPage = getStoredValue(
    storageKeys.activePage,
    "home"
  );

  showPage(
    document.querySelector(
      `[data-page="${savedPage}"]`
    )
      ? savedPage
      : "home"
  );
});
