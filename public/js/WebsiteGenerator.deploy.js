// ===========================
// Deployment buttons
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

    fetch(`${API}/api/stripe/create-checkout-session`, {
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
};
