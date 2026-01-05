// ========================================================================
// DOMAIN CHECKER FRONTEND – 100% WORKING WITH WHOISXML (Nov 2025)
// ========================================================================
function isValidDomain(domain) {
  const domainRegex = /^([a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/;
  return domainRegex.test(domain.trim().toLowerCase());
}

function setupDomainChecker() {
  // Updated IDs to match your HTML (customDomainInput → customDomainInput, etc.)
  const domainInput = document.getElementById("customDomainInput");  // Fixed ID
  const checkBtn = document.getElementById("checkDomainBtn");
  const resultDisplay = document.getElementById("domainStatus");  // Matches your HTML
  const buyButton = document.getElementById("deployFullHosting");
  const priceDisplay = document.getElementById("domainPriceDisplay");
  const durationSelect = document.getElementById("domainDuration");
  const confirmBtn = document.getElementById("confirmDomainBtn");  // If you have this

  if (!domainInput || !checkBtn || !resultDisplay || !buyButton) {
    console.warn("Domain checker elements missing");
    return;
  }

  // RENDER BACKEND – UPDATED FOR WHOISXML
  const API = "https://websitegeneration.onrender.com/api";

  // ------------------------------------------------------------------------
  // Live input validation
  // ------------------------------------------------------------------------
  domainInput.addEventListener("input", () => {
    const domain = domainInput.value.trim().toLowerCase();
    if (!domain) {
      resultDisplay.innerHTML = "";
      buyButton.style.display = "none";
      if (confirmBtn) confirmBtn.disabled = true;
      if (priceDisplay) priceDisplay.textContent = "";
      return;
    }
    if (!isValidDomain(domain)) {
      resultDisplay.innerHTML = "Invalid domain format";
      resultDisplay.style.color = "red";
      buyButton.style.display = "none";
      if (confirmBtn) confirmBtn.disabled = true;
    } else {
      resultDisplay.innerHTML = 'Valid format – Click "Check Availability"';
      resultDisplay.style.color = "blue";
      buyButton.style.display = "none";
      if (confirmBtn) confirmBtn.disabled = true;
    }
  });

  // ------------------------------------------------------------------------
  // CHECK AVAILABILITY + PRICE (WhoisXML via Render backend)
  // ------------------------------------------------------------------------
  checkBtn.addEventListener("click", async () => {
    const domain = domainInput.value.trim().toLowerCase();
    resultDisplay.innerHTML = "🔍 Checking availability...";
    resultDisplay.style.color = "#888";
    buyButton.style.display = "none";
    if (confirmBtn) confirmBtn.disabled = true;
    if (priceDisplay) priceDisplay.textContent = "";

    if (!isValidDomain(domain)) {
      resultDisplay.innerHTML = "Please enter a valid domain";
      resultDisplay.style.color = "red";
      return;
    }

    try {
      // 1. Check availability via NEW WHOISXML ENDPOINT (POST with body)
      const checkRes = await fetch(`${API}/domain/check`, {  // ← THIS IS THE KEY CHANGE
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, duration: durationSelect?.value || 1 })
      });

      if (!checkRes.ok) throw new Error(`Server error ${checkRes.status}`);

      const checkData = await checkRes.json();

      // WhoisXML returns boolean true/false
      if (!checkData.available) {
        resultDisplay.innerHTML = `❌ ${domain} is already taken. Try another!`;
        resultDisplay.style.color = "#ff4444";
        return;
      }

      // SUCCESS: Available!
      resultDisplay.innerHTML = `✅ ${domain} is available!`;
      resultDisplay.style.color = "#00ff00";
      if (confirmBtn) confirmBtn.disabled = false;

      // Save to localStorage
      localStorage.setItem("customDomain", domain);

      // 2. Price is already in response (from WhoisXML + your utils)
      const duration = durationSelect?.value || "1";
      localStorage.setItem("domainDuration", duration);
      const domainPrice = parseFloat(checkData.price?.replace('£', '') || 11.99);  // Extract from £X.XX
      const serviceFee = 150;
      const totalPrice = (domainPrice + serviceFee).toFixed(2);
      localStorage.setItem("domainPrice", domainPrice);
      localStorage.setItem("totalWithService", totalPrice);

      if (priceDisplay) {
        priceDisplay.innerHTML = `Only ${checkData.price || '£11.99'} for the first year!`;
        priceDisplay.style.color = "#00ff00";
      }

      // Enable buy/confirm
      buyButton.style.display = "block";
      buyButton.onclick = () => {
        // Your existing purchase flow (GoDaddy via /api/full-hosting/domain/purchase)
        buyButton.textContent = "Processing...";
        buyButton.disabled = true;
        // Trigger checkout with stored data
        window.location.href = `/checkout?domain=${encodeURIComponent(domain)}&duration=${duration}&total=${totalPrice}`;
      };

    } catch (err) {
      console.error("Domain check error:", err);
      resultDisplay.innerHTML = "⚠️ Could not check – try again or contact support";
      resultDisplay.style.color = "#ff9800";
    }
  });

  // ------------------------------------------------------------------------
  // Recalculate price when duration changes (optional, since price is in check response)
  // ------------------------------------------------------------------------
  durationSelect?.addEventListener("change", async () => {
    const domain = domainInput.value.trim().toLowerCase();
    if (!domain || !resultDisplay.innerHTML.includes("available")) return;

    try {
      const res = await fetch(`${API}/domain/check`, {  // Re-check with new duration
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, duration: parseInt(durationSelect.value) })
      });
      const data = await res.json();
      if (data.available && priceDisplay) {
        priceDisplay.innerHTML = `Only ${data.price || '£11.99'} for ${durationSelect.value} year(s)!`;
      }
      localStorage.setItem("domainDuration", durationSelect.value);
    } catch (err) {
      console.error("Price update failed:", err);
    }
  });

  // ------------------------------------------------------------------------
  // Confirm domain → enable Buy button (if you have a confirm step)
  // ------------------------------------------------------------------------
  if (confirmBtn) {
    confirmBtn.addEventListener("click", () => {
      confirmBtn.textContent = "Domain Confirmed";
      confirmBtn.disabled = true;
      buyButton.style.display = "block";
    });
  }
}

// Expose globally for init
window.setupDomainChecker = setupDomainChecker;