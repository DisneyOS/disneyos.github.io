/**
 * DisneyOS Wait Times
 * Retrieves and displays live Queue-Times attraction data.
 */

document.addEventListener("DOMContentLoaded", () => {
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
      id: 6,
      name: "Magic Kingdom"
    },
    epcot: {
      id: 5,
      name: "EPCOT"
    },
    "hollywood-studios": {
      id: 7,
      name: "Hollywood Studios"
    },
    "animal-kingdom": {
      id: 8,
      name: "Animal Kingdom"
    }
  };

  let currentRides = [];
  let currentParkKey = "magic-kingdom";

  /**
   * Read the selected park from the page URL.
   *
   * Example:
   * wait-times.html?park=epcot
   *
   * @returns {string}
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
   * Update the browser URL without reloading the page.
   *
   * @param {string} parkKey
   */
  function updateParkUrl(parkKey) {
    const newUrl = new URL(window.location.href);

    newUrl.searchParams.set("park", parkKey);

    window.history.replaceState(
      {},
      "",
      newUrl
    );
  }

  /**
   * Display loading information.
   *
   * @param {string} parkName
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
   * Display an error message.
   *
   * @param {string} message
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
   * Convert the Queue-Times land structure into one ride list.
   *
   * @param {object} responseData
   * @returns {Array}
   */
  function flattenRideData(responseData) {
    if (
      !responseData ||
      !Array.isArray(responseData.lands)
    ) {
      return [];
    }

    return responseData.lands.flatMap((land) => {
      const rides = Array.isArray(land.rides)
        ? land.rides
        : [];

      return rides.map((ride) => ({
        id: ride.id,
        name: ride.name || "Unnamed attraction",
        land: land.name || "Park attraction",
        isOpen: Boolean(ride.is_open),
        waitTime: Number.isFinite(
          Number(ride.wait_time)
        )
          ? Number(ride.wait_time)
          : 0,
        lastUpdated: ride.last_updated || null
      }));
    });
  }

  /**
   * Sort ride data according to the current selection.
   *
   * Closed attractions always appear after open attractions.
   *
   * @param {Array} rides
   * @returns {Array}
   */
  function sortRides(rides) {
    const selectedSort = sortSelect.value;

    return [...rides].sort((rideA, rideB) => {
      if (rideA.isOpen !== rideB.isOpen) {
        return rideA.isOpen ? -1 : 1;
      }

      if (selectedSort === "low-high") {
        return (
          rideA.waitTime - rideB.waitTime ||
          rideA.name.localeCompare(rideB.name)
        );
      }

      if (selectedSort === "alphabetical") {
        return rideA.name.localeCompare(rideB.name);
      }

      return (
        rideB.waitTime - rideA.waitTime ||
        rideA.name.localeCompare(rideB.name)
      );
    });
  }

  /**
   * Convert an ISO timestamp into a readable local time.
   *
   * @param {string|null} timestamp
   * @returns {string}
   */
  function formatUpdatedTime(timestamp) {
    if (!timestamp) {
      return "Update time unavailable";
    }

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "Update time unavailable";
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
   * Find the newest timestamp contained in the ride data.
   *
   * @param {Array} rides
   * @returns {string|null}
   */
  function getNewestTimestamp(rides) {
    const timestamps = rides
      .map((ride) => {
        if (!ride.lastUpdated) {
          return null;
        }

        const timestamp = new Date(
          ride.lastUpdated
        ).getTime();

        return Number.isNaN(timestamp)
          ? null
          : timestamp;
      })
      .filter((timestamp) => timestamp !== null);

    if (timestamps.length === 0) {
      return null;
    }

    return new Date(
      Math.max(...timestamps)
    ).toISOString();
  }

  /**
   * Create one attraction card.
   *
   * @param {object} ride
   * @returns {HTMLElement}
   */
  function createRideCard(ride) {
    const article = document.createElement("article");
    article.className = "ride-card";

    const rideInformation = document.createElement("div");

    const rideName = document.createElement("h2");
    rideName.className = "ride-name";
    rideName.textContent = ride.name;

    const rideLand = document.createElement("p");
    rideLand.className = "ride-land";

    rideLand.textContent = ride.isOpen
      ? ride.land
      : `${ride.land} · Currently closed`;

    rideInformation.append(
      rideName,
      rideLand
    );

    const waitDisplay = document.createElement("div");
    waitDisplay.className = "wait-display";

    if (ride.isOpen) {
      const waitNumber = document.createElement("span");
      waitNumber.className = "wait-number";
      waitNumber.textContent = String(ride.waitTime);

      const waitUnit = document.createElement("span");
      waitUnit.className = "wait-unit";
      waitUnit.textContent =
        ride.waitTime === 1 ? "minute" : "minutes";

      waitDisplay.append(
        waitNumber,
        waitUnit
      );
    } else {
      const closedLabel = document.createElement("span");
      closedLabel.className = "closed-label";
      closedLabel.textContent = "Closed";

      waitDisplay.append(closedLabel);
    }

    article.append(
      rideInformation,
      waitDisplay
    );

    return article;
  }

  /**
   * Update the summary cards.
   *
   * @param {Array} rides
   */
  function renderSummary(rides) {
    const openRides = rides.filter(
      (ride) => ride.isOpen
    );

    const waits = openRides.map(
      (ride) => ride.waitTime
    );

    const totalWait = waits.reduce(
      (total, wait) => total + wait,
      0
    );

    const calculatedAverage = waits.length
      ? Math.round(totalWait / waits.length)
      : 0;

    const calculatedLongest = waits.length
      ? Math.max(...waits)
      : 0;

    openCount.textContent = String(openRides.length);
    averageWait.textContent = `${calculatedAverage}m`;
    longestWait.textContent = `${calculatedLongest}m`;

    summaryRow.classList.remove("hidden");
  }

  /**
   * Render the attraction list and status information.
   */
  function renderWaitTimes() {
    const sortedRides = sortRides(currentRides);
    const selectedPark =
      parkConfiguration[currentParkKey];

    waitList.innerHTML = "";

    sortedRides.forEach((ride) => {
      waitList.appendChild(createRideCard(ride));
    });

    renderSummary(currentRides);

    const openRideCount = currentRides.filter(
      (ride) => ride.isOpen
    ).length;

    const newestTimestamp =
      getNewestTimestamp(currentRides);

    statusMain.textContent =
      `${openRideCount} attractions currently open`;

    statusDetail.textContent =
      `Latest reported update: ${
        formatUpdatedTime(newestTimestamp)
      }`;

    parkTitle.textContent = selectedPark.name;

    refreshButton.disabled = false;
    refreshButton.textContent = "Refresh";

    errorPanel.classList.add("hidden");
  }

  /**
   * Retrieve live wait times from Queue-Times.
   *
   * @param {string} parkKey
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
      `https://queue-times.com/parks/` +
      `${selectedPark.id}/queue_times.json`;

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

      if (!response.ok) {
        throw new Error(
          `The data service returned status ${response.status}.`
        );
      }

      const responseData = await response.json();

      currentRides = flattenRideData(responseData);

      if (currentRides.length === 0) {
        throw new Error(
          "No attraction information was returned for this park."
        );
      }

      renderWaitTimes();
    } catch (error) {
      console.error(
        "DisneyOS wait-time request failed:",
        error
      );

      showError(
        "Check your internet connection, then tap Try Again."
      );
    }
  }

  /**
   * Attempt to dismiss the page.
   *
   * When displayed through Apple Shortcuts, the Shortcut's
   * native Done button may still be the primary close control.
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
    if (currentRides.length > 0) {
      renderWaitTimes();
    }
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
