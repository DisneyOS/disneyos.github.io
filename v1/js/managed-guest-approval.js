document.addEventListener("DOMContentLoaded", () => {
  const API_BASE =
    "https://disneyos-api-dev.disneyosplanner.workers.dev/v1";

  const params = new URLSearchParams(window.location.search);
  const batchId = params.get("batch") || "";
  const token = params.get("token") || "";

  const loading = document.getElementById("approval-loading");
  const content = document.getElementById("approval-content");
  const complete = document.getElementById("approval-complete");
  const errorBox = document.getElementById("approval-error");
  const errorCopy = document.getElementById("approval-error-copy");
  const copy = document.getElementById("approval-copy");
  const guestList = document.getElementById("guest-list");
  const approve = document.getElementById("approval-submit");
  const decline = document.getElementById("approval-decline");
  const status = document.getElementById("approval-status");
  const completeEyebrow = document.getElementById("complete-eyebrow");
  const completeTitle = document.getElementById("complete-title");
  const completeCopy = document.getElementById("complete-copy");

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showError(message) {
    loading.hidden = true;
    content.hidden = true;
    complete.hidden = true;
    errorBox.hidden = false;
    errorCopy.textContent =
      message || "The link may have expired or the request may no longer be available.";
  }

  function setStatus(message, type = "info") {
    status.textContent = message;
    status.hidden = !message;
    status.classList.toggle("error", type === "error");
  }

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
      cache: "no-store",
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.success === false) {
      throw new Error(
        payload?.error?.message ||
        `DisneyOS returned ${response.status}.`
      );
    }

    return payload?.data ?? payload;
  }

  async function loadRequest() {
    if (!batchId || !token) {
      showError("This approval link is incomplete.");
      return;
    }

    try {
      const data = await api(
        `/managed-guest-access/public-approval/${encodeURIComponent(batchId)}` +
        `?token=${encodeURIComponent(token)}`
      );

      loading.hidden = true;

      if (data.status === "approved" || data.status === "denied") {
        completeEyebrow.textContent =
          data.status === "approved" ? "APPROVED" : "DECLINED";
        completeTitle.textContent =
          data.status === "approved"
            ? "Request already approved."
            : "Request already declined.";
        completeCopy.textContent = "You can close this page.";
        complete.hidden = false;
        return;
      }

      copy.textContent =
        `${data.requesterName || "A DisneyOS member"} is requesting access ` +
        `to managed guests you control.`;

      guestList.innerHTML = (data.managedGuests || [])
        .map(
          (guest) =>
            `<li>${escapeHtml(guest.displayName || "Managed Guest")}</li>`
        )
        .join("");

      content.hidden = false;
    } catch (error) {
      showError(error.message);
    }
  }

  async function decide(decision) {
    approve.disabled = true;
    decline.disabled = true;

    setStatus(
      decision === "approve"
        ? "Approving this request…"
        : "Declining this request…"
    );

    try {
      await api(
        `/managed-guest-access/public-approval/${encodeURIComponent(batchId)}/decision`,
        {
          method: "POST",
          body: JSON.stringify({
            token,
            decision,
          }),
        }
      );

      content.hidden = true;

      if (decision === "approve") {
        completeEyebrow.textContent = "APPROVED";
        completeTitle.textContent = "Request approved.";
        completeCopy.textContent =
          "The requester can continue with the required Disney Family & Friends connection step. You can close this page.";
      } else {
        completeEyebrow.textContent = "DECLINED";
        completeTitle.textContent = "Request declined.";
        completeCopy.textContent =
          "No managed-guest authorization was granted. You can close this page.";
      }

      complete.hidden = false;
    } catch (error) {
      setStatus(error.message, "error");
      approve.disabled = false;
      decline.disabled = false;
    }
  }

  approve.addEventListener("click", () => decide("approve"));
  decline.addEventListener("click", () => decide("decline"));

  loadRequest();
});
