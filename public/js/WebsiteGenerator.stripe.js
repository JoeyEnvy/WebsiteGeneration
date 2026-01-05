// ===========================
// Stripe checkout
// ===========================

WebsiteGenerator.prototype.startStripeCheckout = function (type, extra = {}) {
  const API = window.API_BASE;
  const businessName = localStorage.getItem("businessName") || "Website";
  let sessionId = localStorage.getItem("sessionId");

  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("sessionId", sessionId);
  }

  fetch(`${API}/api/stripe/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, sessionId, businessName, ...extra })
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.url) window.location.href = data.url;
      else alert("Checkout session failed");
    })
    .catch((err) => {
      alert(`Stripe error: ${err.message}`);
    });
};
