// ===========================
// Stripe checkout (FINAL FIX)
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
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Stripe route error (${res.status})`);
      }
    })
    .then((data) => {
      if (!data?.url) throw new Error("No checkout URL returned");
      window.location.href = data.url;
    })
    .catch((err) => {
      console.error("STRIPE CHECKOUT ERROR:", err);
      alert("Stripe error: " + err.message);
    });
};
s