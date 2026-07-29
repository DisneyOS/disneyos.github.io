/**
 * DisneyOS Wait Times
 *
 * Loads normalized live attraction data from the DisneyOS API.
 */

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE_URL =
    "https://disneyos-api.disneyosplanner.workers.dev";

  const parkTitle =
    document.getElementById("park-title");

  const parkSelect =
    document.getElementById("park-select");

  const refreshButton =
    document.getElementById("refresh-button");

  const updatedTime =
    document.getElementById("updated-time");

  const waitList =
    document.getElementById("wait-list");

  const errorPanel =
    document.getElementById("error-panel");

  const errorMessage =
    document.getElementById("error-message");

  const parkConfiguration = {
    "magic-kingdom": {
      name: "Magic Kingdom"
    },

    epcot: {
      name: "EPCOT"
    },

    "hollywood-studios": {
      name: "Hollywood Studios"
    },

    "animal-kingdom": {
      name: "Animal Kingdom"
    }
  };

  let currentParkKey = "magic-kingdom";

  /**
   * Read the selected park from the page URL.
   *
   * Example:
   * wait-times.html?park=epcot
   */
  function getParkFromUrl() {
    const parameters = new URLSearchParams(
      window.location.search
    );

    const requestedPark =
      parameters.get("park");

    if (
      requestedPark &&
      parkConfiguration[requestedPark]
    ) {
      return requestedPark;
    }

    return "magic-kingdom";
  }

  /**
   * Keep the selected park in the page URL.
   */
  function updateParkUrl(parkKey) {
    const newUrl =
      new URL(window.location.href);

    newUrl.searchParams.set(
      "park",
      parkKey
    );

    window.history.replaceState(
      {},
      "",
      newUrl
    );
  }

  /**
   * Format an ISO timestamp using the device's local time.
   */
  function formatUpdatedTime(timestamp) {
    if (!timestamp) {
      return "Time unavailable";
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "Time unavailable";
    }

    return new Intl.DateTimeFormat(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit"
      }
    ).format(date);
  }

  /**
   * Display the loading state.
   */
  function showLoadingState(parkName) {
    refreshButton.disabled = true;
    refreshButton.textContent = "…";

    parkTitle.textContent = parkName;

    if (updatedTime) {
      updatedTime.textContent =
        "Updating…";
    }

    waitList.innerHTML = "";

    errorPanel.classList.add("hidden");
  }

  /**
   * Display an error state.
   */
  function showError(message) {
    refreshButton.disabled = false;
    refreshButton.textContent = "↻";

    if (updatedTime) {
      updatedTime.textContent =
        "Update unavailable";
    }

    waitList.innerHTML = "";

    errorMessage.textContent = message;

    errorPanel.classList.remove("hidden");
  }

  /**
   * Create one attraction card.
   */
  function createAttractionCard(attraction) {
    const article =
      document.createElement("article");

    article.className = "ride-card";

    const attractionInformation =
      document.createElement("div");

    const attractionName =
      document.createElement("h2");

    attractionName.className = "ride-name";
    attractionName.textContent =
      attraction.name;

    const attractionLand =
      document.createElement("p");

    attractionLand.className = "ride-land";

    attractionLand.textContent =
      attraction.isOpen
        ? attraction.land
        : `${attraction.land} · Currently closed`;

    attractionInformation.append(
      attractionName,
      attractionLand
    );

    const waitDisplay =
      document.createElement("div");

    waitDisplay.className = "wait-display";

    if (attraction.isOpen) {
      const waitNumber =
        document.createElement("span");

      /*
       * Wait times remain neutral until DisneyOS
       * has attraction-specific historical averages.
       */
      waitNumber.className = "wait-number";

      waitNumber.textContent = String(
        attraction.waitMinutes
      );

      const waitUnit =
        document.createElement("span");

      waitUnit.className = "wait-unit";

      waitUnit.textContent =
        attraction.waitMinutes === 1
          ? "minute"
          : "minutes";

      waitDisplay.append(
        waitNumber,
        waitUnit
      );
    } else {
      const closedLabel =
        document.createElement("span");

      closedLabel.className =
        "closed-label";

      closedLabel.textContent = "Closed";

      waitDisplay.append(closedLabel);
    }

    article.append(
      attractionInformation,
      waitDisplay
    );

    return article;
  }

  /**
   * Render the normalized DisneyOS API response.
   */
  function renderWaitTimes(data) {
    const attractions =
      Array.isArray(data.attractions)
        ? data.attractions
        : [];

    waitList.innerHTML = "";

    attractions.forEach((attraction) => {
      waitList.appendChild(
        createAttractionCard(attraction)
      );
    });

    const selectedPark =
      parkConfiguration[currentParkKey];

    parkTitle.textContent =
      data.park?.name ||
      selectedPark.name;

    if (updatedTime) {
      updatedTime.textContent =
        `Updated ${formatUpdatedTime(
          data.updated
        )}`;
    }

    refreshButton.disabled = false;
    refreshButton.textContent = "↻";

    errorPanel.classList.add("hidden");
  }

  /**
   * Retrieve live data from the DisneyOS API.
   */
  async function loadWaitTimes(parkKey) {
    const selectedPark =
      parkConfiguration[parkKey];

    if (!selectedPark) {
      showError(
        "The selected park is not currently supported."
      );

      return;
    }

    currentParkKey = parkKey;

    if (parkSelect) {
      parkSelect.value = parkKey;
    }

    updateParkUrl(parkKey);
    showLoadingState(selectedPark.name);

    const endpoint =
      `${API_BASE_URL}/v1/wait-times` +
      `?park=${encodeURIComponent(parkKey)}`;

    try {
      const response = await fetch(
        endpoint,
        {
          method: "GET",
          headers: {
            Accept: "application/json"
          },
          cache: "no-store"
        }
      );

      const responseData =
        await response.json();

      if (
        !response.ok ||
        !responseData.success
      ) {
        const apiMessage =
          responseData?.error?.message;

        throw new Error(
          apiMessage ||
          `DisneyOS API returned status ${response.status}.`
        );
      }

      if (
        !responseData.data ||
        !Array.isArray(
          responseData.data.attractions
        )
      ) {
        throw new Error(
          "DisneyOS returned an unexpected response."
        );
      }

      renderWaitTimes(
        responseData.data
      );
    } catch (error) {
      console.error(
        "DisneyOS wait-time request failed:",
        error
      );

      showError(
        error.message ||
        "Check your internet connection and try again."
      );
    }
  }

  if (parkSelect) {
    parkSelect.addEventListener(
      "change",
      () => {
        loadWaitTimes(
          parkSelect.value
        );
      }
    );
  }

  refreshButton.addEventListener(
    "click",
    () => {
      loadWaitTimes(
        currentParkKey
      );
    }
  );

  currentParkKey =
    getParkFromUrl();

  loadWaitTimes(currentParkKey);
});
