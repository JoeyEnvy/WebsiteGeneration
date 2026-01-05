// ===========================
// Domain Availability + Pricing (FINAL, BACKEND-ALIGNED)
// WHOISXML check + Namecheap pricing
// ===========================

WebsiteGenerator.prototype.checkDomainAvailability = async function (domain) {
  if (!domain || !domain.includes(".")) {
    alert("Please enter a valid domain (e.g. mybusiness.com)");
    return false;
  }

  const button = document.getElementById("checkDomainBtn");
  const statusEl = document.getElementById("domainStatus");

  if (!button) {
    console.error("checkDomainBtn not found");
    return false;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Checking…";
  if (statusEl) statusEl.textContent = "Checking domain availability…";

  try {
    // ✅ BACKEND SUPPORTS POST (preferred)
    const res = await fetch(window.API_BASE + "/api/domain/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain: domain.trim().toLowerCase() })
    });

    if (!res.ok) {
      throw new Error("Domain check failed (" + res.status + ")");
    }

    const data = await res.json();

    if (data.success !== true) {
      throw new Error(data.error || "Domain check error");
    }

    if (data.available !== true) {
      if (statusEl) {
        statusEl.innerHTML =
          "<strong style='color:red'>✗ " +
          domain +
          " is not available</strong>";
      }
      alert(domain + " is not available");
      return false;
    }

    // ✅ DOMAIN AVAILABLE
    const duration =
      parseInt(document.getElementById("domainDuration")?.value || "1", 10) || 1;

    localStorage.setItem("customDomain", domain.toLowerCase());
    localStorage.setItem("domainDuration", String(duration));

    if (statusEl) {
      statusEl.innerHTML =
        "<strong style='color:green'>✓ " +
        domain +
        " is available</strong><br><small>Fetching price…</small>";
    }

    // ===========================
    // PRICE LOOKUP (NAMECHEAP PRICING ROUTE)
    // ===========================
    const priceRes = await fetch(window.API_BASE + "/api/domain/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: domain.toLowerCase(),
        duration
      })
    });

    if (!priceRes.ok) {
      throw new Error("Price lookup failed");
    }

    const priceData = await priceRes.json();

    if (priceData.success !== true) {
      throw new Error(priceData.error || "Invalid price response");
    }

    const price = Number(priceData.domainPrice);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("Invalid domain price");
    }

    localStorage.setItem("domainPrice", String(price));

    if (statusEl) {
      statusEl.innerHTML =
        "<strong style='color:green'>✓ " +
        domain +
        " is available</strong><br>" +
        "<small>Price: £" +
        price.toFixed(2) +
        " for " +
        duration +
        " year" +
        (duration > 1 ? "s" : "") +
        "</small>";
    }

    const deployBtn = document.getElementById("deployFullHosting");
    if (deployBtn) {
      deployBtn.style.display = "block";
    }

    return true;

  } catch (err) {
    console.error("DOMAIN CHECK ERROR:", err);
    if (statusEl) statusEl.textContent = err.message;
    alert("Domain check failed: " + err.message);
    return false;
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
};

// ===========================
// Wire UI → Domain Logic
// ===========================
WebsiteGenerator.prototype.initializeDomainChecker = function () {
  const input = document.getElementById("customDomainInput");
  const checkBtn = document.getElementById("checkDomainBtn");
  const durationSelect = document.getElementById("domainDuration");

  if (!input || !checkBtn) {
    console.warn("Domain checker elements not found");
    return;
  }

  checkBtn.addEventListener("click", () => {
    const domain = input.value.trim();
    if (!domain) return alert("Enter a domain first");
    this.checkDomainAvailability(domain);
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      this.checkDomainAvailability(input.value.trim());
    }
  });

  if (durationSelect) {
    durationSelect.addEventListener("change", (e) => {
      const duration = parseInt(e.target.value, 10) || 1;
      localStorage.setItem("domainDuration", String(duration));

      const savedDomain = localStorage.getItem("customDomain");
      if (savedDomain) {
        this.fetchFreshPrice(savedDomain, duration);
      }
    });
  }
};

// ===========================
// Refresh price when duration changes
// ===========================
WebsiteGenerator.prototype.fetchFreshPrice = async function (domain, duration) {
  try {
    const res = await fetch(window.API_BASE + "/api/domain/price", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, duration })
    });

    if (!res.ok) throw new Error("Price fetch failed");

    const data = await res.json();
    if (data.success !== true) throw new Error("Bad price response");

    const price = Number(data.domainPrice);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error("Invalid price");
    }

    localStorage.setItem("domainPrice", String(price));

    const statusEl = document.getElementById("domainStatus");
    if (statusEl) {
      statusEl.innerHTML =
        "<strong style='color:green'>✓ " +
        domain +
        " is available</strong><br>" +
        "<small>Price: £" +
        price.toFixed(2) +
        " for " +
        duration +
        " year" +
        (duration > 1 ? "s" : "") +
        "</small>";
    }

  } catch (err) {
    console.error("PRICE REFRESH FAILED:", err);
  }
};
