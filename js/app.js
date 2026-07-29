/**
 * DisneyOS v1.0
 * Core application behavior and local profile settings
 */

document.addEventListener("DOMContentLoaded", () => {
  const navButtons = document.querySelectorAll(".nav-button");
  const pages = document.querySelectorAll(".page");
  const tripButtons = document.querySelectorAll('[data-action="open-trip"]');

  const greetingElement = document.getElementById("greeting");
  const dateElement = document.getElementById("current-date");
  const currentParkElement = document.getElementById("current-park");
  const profileInitialElement = document.getElementById("profile-initial");

  const settingsNameElement = document.getElementById("settings-name");
  const settingsParkElement = document.getElementById("settings-park");

  const editNameButton = document.getElementById("edit-name-button");
  const editParkButton = document.getElementById("edit-park-button");

  const storageKeys = {
    activePage: "disneyos-active-page",
    displayName: "disneyos-display-name",
    preferredPark: "disneyos-preferred-park"
  };

  const parkOptions = [
    "Magic Kingdom",
    "EPCOT",
    "Hollywood Studios",
    "Animal Kingdom"
  ];

  const defaultProfile = {
    displayName: "",
    preferredPark: "Magic Kingdom"
  };

  let profile = {
    displayName: getStoredValue(
      storageKeys.displayName,
      defaultProfile.displayName
    ),
    preferredPark: getStoredValue(
      storageKeys.preferredPark,
      defaultProfile.preferredPark
    )
  };

  /**
   * Retrieve a saved value from local storage.
   *
   * @param {string} key
   * @param {string} fallbackValue
   * @returns {string}
   */
  function getStoredValue(key, fallbackValue) {
    try {
      const storedValue = window.localStorage.getItem(key);

      if (storedValue === null) {
        return fallbackValue;
      }

      return storedValue;
    } catch (error) {
      console.warn(
        `DisneyOS could not read local setting: ${key}`,
        error
      );

      return fallbackValue;
    }
  }

  /**
   * Save a value to local storage.
   *
   * @param {string} key
   * @param {string} value
   */
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

  /**
   * Display the requested page and update navigation state.
   *
   * @param {string} targetPage
   */
  function showPage(targetPage) {
    const requestedPage = document.querySelector(
      `[data-page="${targetPage}"]`
    );

    if (!requestedPage) {
      console.warn(`DisneyOS page not found: ${targetPage}`);
      return;
    }

    pages.forEach((page) => {
      page.classList.toggle(
        "active",
        page.dataset.page === targetPage
      );
    });

    navButtons.forEach((button) => {
      const isActive = button.dataset.target === targetPage;

      button.classList.toggle("active", isActive);

      if (isActive) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    saveStoredValue(storageKeys.activePage, targetPage);
  }

  /**
   * Determine the greeting based on the device's local time.
   *
   * @returns {string}
   */
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

  /**
   * Update the date, greeting, profile initial, and selected park.
   */
  function renderProfile() {
    const greeting = getTimeBasedGreeting();
    const cleanName = profile.displayName.trim();

    if (greetingElement) {
      greetingElement.textContent = cleanName
        ? `${greeting}, ${cleanName}`
        : greeting;
    }

    if (dateElement) {
      dateElement.textContent = new Intl.DateTimeFormat(
        "en-US",
        {
          weekday: "long",
          month: "long",
          day: "numeric"
        }
      ).format(new Date());
    }

    if (settingsNameElement) {
      settingsNameElement.textContent = cleanName || "Not set";
    }

    if (profileInitialElement) {
      profileInitialElement.textContent = cleanName
        ? cleanName.charAt(0).toUpperCase()
        : "D";
    }

    if (settingsParkElement) {
      settingsParkElement.textContent = profile.preferredPark;
    }

    if (currentParkElement) {
      currentParkElement.textContent = profile.preferredPark;
    }
  }

  /**
   * Ask the user for a display name.
   */
  function editDisplayName() {
    const currentName = profile.displayName.trim();

    const enteredName = window.prompt(
      "Enter the name DisneyOS should display:",
      currentName
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
      profile.displayName
    );

    renderProfile();
  }

  /**
   * Ask the user to choose a preferred park.
   */
  function editPreferredPark() {
    const parkList = parkOptions
      .map((park, index) => `${index + 1}. ${park}`)
      .join("\n");

    const currentParkNumber =
      parkOptions.indexOf(profile.preferredPark) + 1;

    const enteredChoice = window.prompt(
      `Choose your preferred park:\n\n${parkList}\n\nEnter 1 through 4:`,
      String(currentParkNumber > 0 ? currentParkNumber : 1)
    );

    if (enteredChoice === null) {
      return;
    }

    const selectedIndex = Number.parseInt(
      enteredChoice.trim(),
      10
    ) - 1;

    if (
      Number.isNaN(selectedIndex) ||
      !parkOptions[selectedIndex]
    ) {
      window.alert(
        "Please enter a number from 1 through 4."
      );

      return;
    }

    profile.preferredPark = parkOptions[selectedIndex];

    saveStoredValue(
      storageKeys.preferredPark,
      profile.preferredPark
    );

    renderProfile();
  }

  navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      showPage(button.dataset.target);
    });
  });

  tripButtons.forEach((button) => {
    button.addEventListener("click", () => {
      showPage("trip");
    });
  });

  if (editNameButton) {
    editNameButton.addEventListener(
      "click",
      editDisplayName
    );
  }

  if (editParkButton) {
    editParkButton.addEventListener(
      "click",
      editPreferredPark
    );
  }

  renderProfile();

  let initialPage = "home";

  const savedPage = getStoredValue(
    storageKeys.activePage,
    "home"
  );

  if (
    savedPage &&
    document.querySelector(`[data-page="${savedPage}"]`)
  ) {
    initialPage = savedPage;
  }

  showPage(initialPage);
});
