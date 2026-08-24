document.addEventListener("DOMContentLoaded", () => {
  const API_BASE =
    "https://disneyos-api-dev.disneyosplanner.workers.dev/v1";

  const loading = document.getElementById("approval-loading");
  const content = document.getElementById("approval-content");
  const complete = document.getElementById("approval-complete");
  const errorBox = document.getElementById("approval-error");
  const errorCopy = document.getElementById("approval-error-copy");
  const requester = document.getElementById("approval-requester");
  const target = document.getElementById("approval-target");
  const copy = document.getElementById("approval-copy");
  const codeInput = document.getElementById("approval-code");
  const submit = document.getElementById("approval-submit");
  const status = document.getElementById("approval-status");

  const requestId =
    new URLSearchParams(window.location.search).get("request") || "";

  function showError(message) {
    loading.hidden = true;
    content.hidden = true;
    complete.hidden = true;
    errorBox.hidden = false;
    errorCopy.textContent =
      message || "The request may have expired or been cancelled.";
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
    if (!requestId) {
      showError("This approval link is incomplete.");
      return;
    }

    try {
      const data = await api(
        `/people/public-approval/${encodeURIComponent(requestId)}`
      );

      loading.hidden = true;

      if (data.status === "approved") {
        complete.hidden = false;
        return;
      }

      if (
        data.status !== "waiting_email_otp" ||
        data.approvalMethod !== "email_otp"
      ) {
        showError("This request is no longer awaiting your approval.");
        return;
      }

      requester.textContent = data.requesterName || "DisneyOS member";
      target.textContent = data.targetName || "Disney profile";
      copy.textContent =
        `${data.requesterName || "A DisneyOS member"} would like to add ` +
        `${data.targetName || "your Disney profile"} to their My People list. ` +
        `Enter the six-digit code from the same DisneyOS email to approve it.`;

      content.hidden = false;
      codeInput.focus();
    } catch (error) {
      showError(error.message);
    }
  }

  submit.addEventListener("click", async () => {
    const code = String(codeInput.value || "").trim();

    if (!/^\\d{6}$/.test(code)) {
      setStatus("Enter the six-digit approval code.", "error");
      return;
    }

    submit.disabled = true;
    submit.textContent = "Approving…";
    setStatus("Verifying your approval code…");

    try {
      await api(
        `/people/public-approval/${encodeURIComponent(requestId)}/verify`,
        {
          method: "POST",
          body: JSON.stringify({ code }),
        }
      );

      content.hidden = true;
      complete.hidden = false;
    } catch (error) {
      setStatus(error.message, "error");
    } finally {
      submit.disabled = false;
      submit.textContent = "Approve in DisneyOS";
    }
  });

  codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.replace(/\\D/g, "").slice(0, 6);
  });

  loadRequest();
});
