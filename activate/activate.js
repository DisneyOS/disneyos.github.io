(() => {
  "use strict";

  const API_BASE = "https://disneyos-api-dev.disneyosplanner.workers.dev/v1";
  const SETUP_URL = "../setup/";
  const TOKEN_KEY = "disneyos-member-device-token";
  const PROFILE_KEY = "disneyos-member-profile";
  const DISPLAY_NAME_KEY = "disneyos-display-name";

  const loadingState = document.getElementById("loading-state");
  const activationState = document.getElementById("activation-state");
  const successState = document.getElementById("success-state");
  const missingCardState = document.getElementById("missing-card-state");
  const form = document.getElementById("activation-form");
  const passwordInput = document.getElementById("membership-password");
  const passwordToggle = document.getElementById("password-toggle");
  const activateButton = document.getElementById("activate-button");
  const formMessage = document.getElementById("form-message");
  const openDisneyOS = document.getElementById("open-disneyos");
  const openExisting = document.getElementById("open-existing");

  const cardCode = new URLSearchParams(window.location.search).get("card")?.trim() || "";

  function showState(target) {
    [loadingState, activationState, successState, missingCardState].forEach((state) => {
      state.hidden = state !== target;
    });
  }

  function getStoredToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch {
      return "";
    }
  }

  function storeMembership(deviceToken, membership) {
    localStorage.setItem(TOKEN_KEY, deviceToken);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(membership));
    if (membership?.displayName) {
      localStorage.setItem(DISPLAY_NAME_KEY, membership.displayName);
    }
  }

  function clearMembership() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(PROFILE_KEY);
      localStorage.removeItem(DISPLAY_NAME_KEY);
    } catch {
      // Storage may be unavailable in private browsing modes.
    }
  }

  function getDeviceName() {
    const platform = navigator.userAgent || "";
    if (/iPhone/i.test(platform)) return "iPhone";
    if (/iPad/i.test(platform)) return "iPad";
    if (/Android/i.test(platform)) return "Android device";
    if (/Macintosh/i.test(platform)) return "Mac";
    if (/Windows/i.test(platform)) return "Windows browser";
    return "DisneyOS device";
  }

  function renderSuccess(membership, alreadyActive = false) {
    document.getElementById("success-title").textContent = `Welcome${alreadyActive ? " back" : ""}, ${membership.displayName}`;
    document.getElementById("success-copy").textContent = alreadyActive
      ? "This device is already connected to your DisneyOS membership."
      : "Your device has been added to your DisneyOS membership.";
    document.getElementById("member-name").textContent = membership.displayName;
    document.getElementById("device-name").textContent = membership.deviceName || getDeviceName();
    showState(successState);
  }

  async function verifyExistingMembership() {
    const token = getStoredToken();
    if (!token) return false;

    try {
      const response = await fetch(`${API_BASE}/membership/me`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (response.status === 401 || response.status === 403) {
        clearMembership();
        return false;
      }

      const payload = await response.json();
      if (!response.ok || !payload?.success) return false;

      localStorage.setItem(PROFILE_KEY, JSON.stringify(payload.data));
      if (payload.data?.displayName) {
        localStorage.setItem(DISPLAY_NAME_KEY, payload.data.displayName);
      }
      renderSuccess(payload.data, true);
      return true;
    } catch (error) {
      console.warn("DisneyOS could not verify the stored membership.", error);
      return false;
    }
  }

  async function activateMembership(password) {
    const response = await fetch(`${API_BASE}/membership/activate`, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        cardCode,
        password,
        deviceName: getDeviceName()
      })
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.success) {
      const error = new Error(payload?.error?.message || "DisneyOS could not activate this device.");
      error.code = payload?.error?.code || "ACTIVATION_FAILED";
      throw error;
    }

    storeMembership(payload.data.deviceToken, payload.data.membership);
    return payload.data.membership;
  }

  passwordToggle.addEventListener("click", () => {
    const showing = passwordInput.type === "text";
    passwordInput.type = showing ? "password" : "text";
    passwordToggle.textContent = showing ? "Show" : "Hide";
    passwordToggle.setAttribute("aria-label", showing ? "Show password" : "Hide password");
    passwordInput.focus();
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formMessage.textContent = "";

    const password = passwordInput.value;
    if (!password) {
      formMessage.textContent = "Enter your membership password.";
      passwordInput.focus();
      return;
    }

    activateButton.disabled = true;
    activateButton.querySelector("span").textContent = "Authenticating…";

    try {
      const membership = await activateMembership(password);
      passwordInput.value = "";
      history.replaceState({}, "", window.location.pathname);
      renderSuccess(membership, false);
    } catch (error) {
      formMessage.textContent = error.message;
      passwordInput.select();
    } finally {
      activateButton.disabled = false;
      activateButton.querySelector("span").textContent = "Activate DisneyOS";
    }
  });

  openDisneyOS.addEventListener("click", () => window.location.assign(SETUP_URL));
  openExisting.addEventListener("click", () => window.location.assign(SETUP_URL));

  (async () => {
    const alreadyActive = await verifyExistingMembership();
    if (alreadyActive) return;

    if (!cardCode) {
      showState(missingCardState);
      return;
    }

    showState(activationState);
    window.setTimeout(() => passwordInput.focus(), 80);
  })();
})();
