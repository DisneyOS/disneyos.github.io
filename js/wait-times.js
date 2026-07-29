/**
 * DisneyOS Wait Times
 *
 * Loads normalized live attraction data from the DisneyOS API.
 */

document.addEventListener("DOMContentLoaded", () => {
  const API_BASE_URL =
    "https://disneyos-api.disneyosplanner.workers.dev";

  const parkTitle = document.getElementById("park-title");
  const parkSelect = document.getElementById("park-select");
  const sortSelect = document.getElementById("sort-select");
  const refreshButton = document.getElementById("refresh-button");
  const closeButton = document.getElementById("close-button");

  const statusMain = document.getElementById("status-main");
  const statusDetail = document.getElementById("status-detail");

  const summaryRow = document.getElementById("summary-row");
  const openCount = document.getElementById("open-count");
  const averageWait = document.getElementById("average-wait");
  const longestWait = document.getElementById("longest-wait");

  const waitList = document.getElementById("wait-list");

  const errorPanel = document.getElementById("error-panel");
  const errorMessage = document.getElementById("error-message");

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
  let currentAttractions = [];

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

    const requestedPark = parameters.get("park");

    if (
      requestedPark &&
      parkConfiguration[requestedPark]
    ) {
      return requestedPark;
    }

    return "magic-kingdom";
  }

  /**
   * Update the park parameter without reloading the page.
   */
  function updateParkUrl(parkKey) {
    const newUrl = new URL(window.location.href);

    newUrl.searchParams.set("park", parkKey);

    window.history.replaceState({}, "", newUrl);
  }

  /**
   * Display the loading state.
   */
  function showLoadingState(parkName) {
    refreshButton.disabled = true;
    refreshButton.textContent = "Loading…";

    statusMain.textContent =
      `Loading ${parkName} wait times…`;

    statusDetail.textContent =
      "Retrieving the latest attraction information.";

    waitList.innerHTML = "";

    summaryRow.classList.add("hidden");
    errorPanel.classList.add("hidden");
  }

  /**
   * Display an error state.
   */
  function showError(message) {
    refreshButton.disabled = false;
    refreshButton.textContent = "Try again";

    statusMain.textContent =
      "Live data is temporarily unavailable.";

    statusDetail.textContent =
      "DisneyOS could not retrieve the current wait times.";

    summaryRow.classList.add("hidden");
    waitList.innerHTML = "";

    errorMessage.textContent = message;
    errorPanel.classList.remove("hidden");
  }

  /**
   * Format an ISO timestamp using the device's local time.
   */
  function formatUpdatedTime(timestamp) {
    if (!timestamp) {
      return "Update time unavailable";
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "Update time unavailable";
    }

    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  /**
   * Create one attraction card.
   */
  function createAttractionCard(attraction) {
    const article = document.createElement("article");
    article.className = "ride-card";

    const attractionInformation =
      document.createElement("div");

    const attractionName =
      document.createElement("h2");

    attractionName.className = "ride-name";
    attractionName.textContent = attraction.name;

    const attractionLand =
      document.createElement("p");

    attractionLand.className = "ride-land";

    attractionLand.textContent = attraction.isOpen
      ? attraction.land
      : `${attraction.land} · Currently closed`;

    attractionInformation.append(
      attractionName,
      attractionLand
    );

    const waitDisplay = document.createElement("div");
    waitDisplay.className = "wait-display";

    if (attraction.isOpen) {
      const waitNumber =
        document.createElement("span");

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

      waitDisplay.append(waitNumber, waitUnit);
    } else {
      const closedLabel =
        document.createElement("span");

      closedLabel.className = "closed-label";
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
   * Render the wait-time summary.
   */
  function renderSummary(summary) {
    openCount.textContent = String(
      summary.openAttractions ?? 0
    );

    averageWait.textContent =
      `${summary.averageWaitMinutes ?? 0}m`;

    longestWait.textContent =
      `${summary.longestWaitMinutes ?? 0}m`;

    summaryRow.classList.remove("hidden");
  }

  /**
   * Render the normalized DisneyOS API response.
   */
  function renderWaitTimes(data) {
    currentAttractions = Array.isArray(
      data.attractions
    )
      ? data.attractions
      : [];

    waitList.innerHTML = "";

    currentAttractions.forEach((attraction) => {
      waitList.appendChild(
        createAttractionCard(attraction)
      );
    });

    renderSummary(data.summary || {});

    const selectedPark =
      parkConfiguration[currentParkKey];

    parkTitle.textContent =
      data.park?.name ||
      selectedPark.name;

    statusMain.textContent =
      `${data.summary?.openAttractions ?? 0} attractions currently open`;

    statusDetail.textContent =
      `Latest reported update: ${
        formatUpdatedTime(data.updated)
      }`;

    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh";

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

    parkSelect.value = parkKey;
    parkTitle.textContent = selectedPark.name;

    updateParkUrl(parkKey);
    showLoadingState(selectedPark.name);

    const endpoint =
      `${API_BASE_URL}/v1/wait-times` +
      `?park=${encodeURIComponent(parkKey)}`;

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json"
        },
        cache: "no-store"
      });

      const responseData = await response.json();

      if (!response.ok || !responseData.success) {
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

      renderWaitTimes(responseData.data);
    } catch (error) {
      console.error(
        "DisneyOS wait-time request failed:",
        error
      );

      showError(
        error.message ||
        "Check your internet connection, then tap Try Again."
      );
    }
  }

  /**
   * Attempt to dismiss the page.
   */
  function closeWaitTimes() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.close();
  }

  parkSelect.addEventListener("change", () => {
    loadWaitTimes(parkSelect.value);
  });

  sortSelect.addEventListener("change", () => {
    /*
     * Sorting is now performed by the DisneyOS API.
     * This temporary control will be removed next.
     */
  });

  refreshButton.addEventListener("click", () => {
    loadWaitTimes(currentParkKey);
  });

  closeButton.addEventListener(
    "click",
    closeWaitTimes
  );

  currentParkKey = getParkFromUrl();

  loadWaitTimes(currentParkKey);
});
