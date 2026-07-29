/**
 * DisneyOS v1.0
 * Core application behavior
 */

document.addEventListener("DOMContentLoaded", () => {
  const navButtons = document.querySelectorAll(".nav-button");
  const pages = document.querySelectorAll(".page");
  const tripButtons = document.querySelectorAll('[data-action="open-trip"]');

  const greetingElement = document.getElementById("greeting");
  const dateElement = document.getElementById("current-date");

  /**
   * Display the requested page and update the navigation state.
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
      button.setAttribute(
        "aria-current",
        isActive ? "page" : "false"
      );
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    try {
      window.localStorage.setItem(
        "disneyos-active-page",
        targetPage
      );
    } catch (error) {
      console.warn(
        "DisneyOS could not save the active page.",
        error
      );
    }
  }

  /**
   * Update the greeting and date using the device's local time.
   */
  function updateDateAndGreeting() {
    const now = new Date();
    const hour = now.getHours();

    let greeting = "Good evening";

    if (hour < 12) {
      greeting = "Good morning";
    } else if (hour < 17) {
      greeting = "Good afternoon";
    }

    if (greetingElement) {
      greetingElement.textContent = `${greeting}, Kyle`;
    }

    if (dateElement) {
      dateElement.textContent = new Intl.DateTimeFormat(
        "en-US",
        {
          weekday: "long",
          month: "long",
          day: "numeric"
        }
      ).format(now);
    }
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

  updateDateAndGreeting();

  let initialPage = "home";

  try {
    const savedPage = window.localStorage.getItem(
      "disneyos-active-page"
    );

    if (
      savedPage &&
      document.querySelector(`[data-page="${savedPage}"]`)
    ) {
      initialPage = savedPage;
    }
  } catch (error) {
    console.warn(
      "DisneyOS could not restore the active page.",
      error
    );
  }

  showPage(initialPage);
});
