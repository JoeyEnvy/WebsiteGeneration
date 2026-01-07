// ===========================
// Deployment buttons (FIXED)
// ===========================

WebsiteGenerator.prototype.initializeDeploymentButtons = function () {
  const API = window.API_BASE;

  document.getElementById("deployGithubSelf")?.addEventListener("click", () =>
    this.startStripeCheckout("github-instructions")
  );

  document.getElementById("deployZipOnly")?.addEventListener("click", () =>
    this.startStripeCheckout("zip-download")
  );

  document.getElementById("deployGithubHosted")?.addEventListener("click", () =>
    this.startStripeCheckout("github-hosted")
  );

  document.getElementById("deployNetlifyOnly")?.addEventListener("click", () => {
    const businessName = localStorage.getItem("businessName");
    let sessionId = localStorage.getItem("sessionId") || crypto.randomUUID();
    localStorage.setItem("sessionId", sessionId);

    fetch(`${API}/stripe/create-checkout-session`, {

      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "netlify-hosted",
        sessionId,
        businessName
      })
    })
      .then((r) => r.json())
      .then((d) => d.url && (window.location.href = d.url));
  });

  // ===========================
  // ✅ FULL HOSTING + DOMAIN (THIS WAS MISSING)
  // ===========================
  document.getElementById("deployFullHosting")?.addEventListener("click", () => {
    const domain = localStorage.getItem("customDomain");
    const durationYears =
      parseInt(localStorage.getItem("domainDuration"), 10) || 1;

    if (!domain) {
      alert("No domain selected");
      return;
    }

    let sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem("sessionId", sessionId);
    }

    this.startStripeCheckout("full-hosting", {
      domain,
      durationYears
    });
  });
};
