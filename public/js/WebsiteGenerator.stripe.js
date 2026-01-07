// ===========================
// Stripe checkout (FIXED + HARDENED)
// ===========================

WebsiteGenerator.prototype.startStripeCheckout = function (type, extra = {}) {
  const API = window.API_BASE;
  const businessName = localStorage.getItem("businessName") || "Website";
  let sessionId = localStorage.getItem("sessionId");

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("sessionId", sessionId);
  }

  fetch(`${API}/stripe/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      sessionId,
      businessName,
      ...extra
    })
  })
    .then(async (res) => {
      // Handle non-JSON (e.g. 404 HTML)
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Stripe endpoint error (${res.status})`);
      }
    })
    .then((data) => {
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || "Checkout session failed");
      }
    })
    .catch((err) => {
      console.error("STRIPE CHECKOUT ERROR:", err);
      alert("Stripe error: " + err.message);
    });
};
