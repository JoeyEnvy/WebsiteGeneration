// ===========================
// Domain Availability + Pricing
// ===========================

WebsiteGenerator.prototype.checkDomainAvailability = async function (domain) {
  if (!domain || !domain.includes(".")) {
    alert("Please enter a valid domain (e.g., mybusiness.com)");
    return false;
  }

  const button = document.getElementById("checkDomainBtn");
  if (!button) {
    console.error("Check button not found – add <button id='checkDomainBtn'> to HTML");
    return false;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Checking...";

  const statusEl = document.getElementById("domainStatus");
  if (statusEl) statusEl.textContent = "Checking...";

  try {
    const res = await fetch(
      `${window.API_BASE}/api/domain/check?domain=${encodeURIComponent(domain.toLowerCase().trim())}`,
      { method: "GET" }
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

    const data = await res.json();
    if (data?.success !== true) throw new Error(data?.error || "Domain check failed");

    if (data.available === false) {
      if (statusEl) {
        statusEl.innerHTML = `<strong style="color:red">✗ ${domain} is taken</strong>`;
      }
      alert(`❌ ${domain} is already taken.`);
      return false;
    }

    const duration =
      parseInt(document.getElementById("domainDuration")?.value || "1", 10) || 1;

    localStorage.setItem("customDomain", domain.toLowerCase().trim());
    localStorage.setItem("domainDuration", String(duration));

    if (statusEl) {
      statusEl.innerHTML = `
        <strong style="color:green">✓ ${domain} is available!</strong><br>
        <small>Fetching price…</small>
      `;
    }

    const priceRes = await fetch(`${window.API_BASE}/api/domain/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, duration })
    });

    if (!priceRes.ok) throw new Error("Price lookup failed");

    const priceData = await priceRes.json();
    if (priceData?.success !== true) throw new Error(priceData?.error);

    const price = Number(priceData.domainPrice);
    if (!Number.isFinite(price) || price <= 0) throw new Error("Invalid price");

    localStorage.setItem("domainPrice", String(price));

    if (statusEl) {
      statusEl.innerHTML = `
        <strong style="color:green">✓ ${domain} is available!</strong><br>
        <small>Price: £${price.toFixed(2)} for ${duration} year${duration > 1 ? "s" : ""}</small>
      `;
    }

    document.getElementById("deployFullHosting")?.style.display = "block";
    return true;

  } catch (err) {
    console.error("Domain check error:", err);
    if (statusEl) statusEl.textContent = err.message;
    alert(`❌ Domain check failed: ${err.message}`);
    return false;
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
};

WebsiteGenerator.prototype.initializeDomainChecker = function () {
  const checkBtn = document.getElementById("checkDomainBtn");
  const input = document.getElementById("customDomainInput");
  if (!checkBtn || !input) return;

  checkBtn.addEventListener("click", () => {
    this.checkDomainAvailability(input.value.trim());
  });

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") this.checkDomainAvailability(input.value.trim());
  });

  document.getElementById("domainDuration")?.addEventListener("change", (e) => {
    const duration = e.target.value;
    localStorage.setItem("domainDuration", duration);
    const domain = localStorage.getItem("customDomain");
    if (domain) this.fetchFreshPrice(domain, parseInt(duration, 10));
  });
};

WebsiteGenerator.prototype.fetchFreshPrice = async function (domain, duration) {
  try {
    const res = await fetch(`${window.API_BASE}/api/domain/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, duration })
    });
    const data = await res.json();
    const price = Number(data.domainPrice);
    localStorage.setItem("domainPrice", String(price));
    alert(`Updated price: £${price.toFixed(2)}`);
  } catch {
    alert("Price update failed – using last known value");
  }
};
