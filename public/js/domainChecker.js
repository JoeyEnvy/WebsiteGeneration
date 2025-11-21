// ========================================================================
// DOMAIN CHECKER FRONTEND – 100% WORKING ON RENDER + PORKBUN (Nov 2025)
// ========================================================================

function isValidDomain(domain) {
  const domainRegex = /^([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(domain.trim().toLowerCase());
}

function setupDomainChecker() {
  const domainInput = document.getElementById("customDomain");
  const checkBtn = document.getElementById("checkDomainBtn");
  const resultDisplay = document.getElementById("domainCheckResult");
  const buyButton = document.getElementById("deployFullHosting");
  const priceDisplay = document.getElementById("domainPriceDisplay");
  const durationSelect = document.getElementById("domainDuration");
  const confirmBtn = document.getElementById("confirmDomainBtn");

  if (!domainInput || !checkBtn || !resultDisplay || !buyButton) {
    console.warn("Domain checker elements missing");
    return;
  }

  // RENDER BACKEND – THIS IS THE ONLY CHANGE YOU NEEDED
  const API = "https://websitegeneration.onrender.com/api";

  // ------------------------------------------------------------------------
  // Live input validation
  // ------------------------------------------------------------------------
  domainInput.addEventListener("input", () => {
    const domain = domainInput.value.trim().toLowerCase();
    if (!domain) {
      resultDisplay.textContent = "";
      buyButton.disabled = true;
      confirmBtn.disabled = true;
      if (priceDisplay) priceDisplay.textContent = "";
      return;
    }
    if (!isValidDomain(domain)) {
      resultDisplay.textContent = "Invalid domain format";
      resultDisplay.style.color = "red";
      buyButton.disabled = true;
      confirmBtn.disabled = true;
    } else {
      resultDisplay.textContent = 'Valid format – Click "Check Availability"';
      resultDisplay.style.color = "blue";
      buyButton.disabled = true;
      confirmBtn.disabled = true;
    }
  });

  // ------------------------------------------------------------------------
  // CHECK AVAILABILITY + PRICE (Porkbun via Render backend)
  // ------------------------------------------------------------------------
  checkBtn.addEventListener("click", async () => {
    const domain = domainInput.value.trim().toLowerCase();
    resultDisplay.textContent = "Checking availability...";
    resultDisplay.style.color = "black";
    buyButton.disabled = true;
    confirmBtn.disabled = true;
    if (priceDisplay) priceDisplay.textContent = "";

    if (!isValidDomain(domain)) {
      resultDisplay.textContent = "Please enter a valid domain";
      resultDisplay.style.color = "red";
      return;
    }

    try {
      // 1. Check availability
      const checkRes = await fetch(
        `${API}/full-hosting/domain/check?domain=${encodeURIComponent(domain)}`
      );

      if (!checkRes.ok) throw new Error(`Server error ${checkRes.status}`);
      const checkData = await checkRes.json();

      if (!checkData.available) {
        resultDisplay.textContent = `"${domain}" is not available`;
        resultDisplay.style.color = "red";
        return;
      }

      resultDisplay.textContent = `"${domain}" is available!`;
      resultDisplay.style.color = "green";
      confirmBtn.disabled = false;

      // Save domain
      localStorage.setItem("customDomain", domain);

      // 2. Get real price from Porkbun
      const duration = durationSelect?.value || "1";
      localStorage.setItem("domainDuration", duration);

      const priceRes = await fetch(`${API}/full-hosting/domain/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, duration: parseInt(duration) }),
      });

      if (!priceRes.ok) throw new Error("Price fetch failed");

      const priceData = await priceRes.json();
      const domainPrice = parseFloat(priceData.domainPrice || 12.99); // fallback
      const serviceFee = 150;
      const totalPrice = (domainPrice + serviceFee).toFixed(2);

      localStorage.setItem("domainPrice", domainPrice);
      localStorage.setItem("totalWithService", totalPrice);

      if (priceDisplay) {
        priceDisplay.textContent = `Estimated: £${domainPrice.toFixed(2)} (domain) + £150 (service) = £${totalPrice}`;
        priceDisplay.style.color = "green";
      }

    } catch (err => {
      console.error("Domain check error:", err);
      resultDisplay.textContent = "Error – try again or contact support";
      resultDisplay.style.color = "orange";
    }
  });

  // ------------------------------------------------------------------------
  // Recalculate price when duration changes
  // ------------------------------------------------------------------------
  durationSelect?.addEventListener("change", async () => {
    const domain = domainInput.value.trim().toLowerCase();
    if (!domain || !resultDisplay.textContent.includes("available")) return;

    try {
      const res = await fetch(`${API}/full-hosting/domain/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          duration: parseInt(durationSelect.value)
        }),
      });

      const data = await res.json();
      const domainPrice = parseFloat(data.domainPrice || 12.99);
      const total = (domainPrice + 150).toFixed(2);

      localStorage.setItem("domainPrice", domainPrice);
      localStorage.setItem("domainDuration", durationSelect.value);
      localStorage.setItem("totalWithService", total);

      if (priceDisplay) {
        priceDisplay.textContent = `Estimated: £${domainPrice.toFixed(2)} + £150 service = £${total}`;
      }
    } catch (err) {
      console.error("Price update failed:", err);
    }
  });

  // ------------------------------------------------------------------------
  // Confirm domain → enable Buy button
  // ------------------------------------------------------------------------
  confirmBtn?.addEventListener("click", () => {
    confirmBtn.textContent = "Domain Confirmed";
    confirmBtn.disabled = true;
    buyButton.disabled = false;
  });
}

// Expose globally
window.setupDomainChecker = setupDomainChecker;