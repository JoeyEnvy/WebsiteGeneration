// ===========================
// WebsiteGenerator.js — Vercel/Render-ready (Full Fixed Version – Nov 2025)
// Handles null elements, CORS-friendly fetches, duration for GoDaddy purchase
// ===========================
class WebsiteGenerator {
  constructor() {
    this.form = document.getElementById("websiteGeneratorForm");
    this.previewFrame = document.getElementById("previewFrame");
    this.currentPage = 0;
    this.generatedPages = [];
    this.currentStep = 1;
    this.userHasPaid = false;
    // Restore saved pages from previous session if available
    const savedPages = localStorage.getItem("generatedPages");
    if (savedPages) {
      try {
        this.generatedPages = JSON.parse(savedPages);
      } catch {
        console.warn("⚠️ Could not parse saved pages from localStorage");
      }
    }
  if (!window.API_BASE) {
    window.API_BASE = 'https://websitegeneration.onrender.com';
  }
  this.initializeDeploymentButtons();
  // initializeDomainChecker() deliberately NOT called here
  // → it runs only from the bottom of index.html after DOM is ready
}

  // ===========================
  // FIXED: Domain Availability Check (Null-Safe, Duration-Aware)
  // ===========================
  async checkDomainAvailability(domain) {
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
      const res = await fetch(`${window.API_BASE}/api/full-hosting/domain/check?domain=${domain.toLowerCase().trim()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

      const data = await res.json();

      if (data.available) {
        const price = data.price || 9.88;
        const duration = parseInt(document.getElementById("domainDuration")?.value || 1); // From selector
        localStorage.setItem("customDomain", domain.toLowerCase().trim());
        localStorage.setItem("domainPrice", price.toString());
        localStorage.setItem("domainDuration", duration.toString());
        if (statusEl) {
          statusEl.innerHTML = `
            <strong style="color:green">✓ ${domain} is available!</strong><br>
            <small>Price: $${price}/first year (${duration} year${duration > 1 ? 's' : ''})</small>
          `;
        }
        alert(`✅ ${domain} is AVAILABLE! Price: $${price} for ${duration} year${duration > 1 ? 's' : ''}`);
        const hostingBtn = document.getElementById("deployFullHosting");
        if (hostingBtn) hostingBtn.style.display = "block";
        return true;
      } else {
        if (statusEl) statusEl.innerHTML = `<strong style="color:red">✗ ${domain} is taken</strong>`;
        alert(`❌ ${domain} is already taken. Try another!`);
        return false;
      }
    } catch (err) {
      console.error("Domain check error:", err);
      if (statusEl) statusEl.textContent = "Check failed – try again (CORS/backend issue?)";
      alert(`❌ Domain check failed: ${err.message}. Check console/backend.`);
      return false;
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = originalText;
      }
    }
  }

  // FIXED: Initialize Domain Checker (Null-Safe Event Wiring)
  initializeDomainChecker() {
    const checkBtn = document.getElementById("checkDomainBtn");
    const input = document.getElementById("customDomainInput");
    if (!checkBtn || !input) {
      console.error("Domain elements missing – add <input id='customDomainInput'> and <button id='checkDomainBtn'> to HTML");
      return;
    }

    checkBtn.addEventListener("click", () => {
      const domain = input.value.trim();
      if (!domain) return alert("Enter a domain first");
      if (!domain.includes(".")) return alert("Include TLD like .com or .store");
      this.checkDomainAvailability(domain);
    });

    // Enter key on input
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.checkDomainAvailability(e.target.value.trim());
    });

    // Duration change updates localStorage
    const durationSel = document.getElementById("domainDuration");
    if (durationSel) {
      durationSel.addEventListener("change", (e) => {
        const duration = e.target.value;
        localStorage.setItem("domainDuration", duration);
        // Re-check price if domain saved
        const savedDomain = localStorage.getItem("customDomain");
        if (savedDomain) {
          this.fetchFreshPrice(savedDomain, parseInt(duration));
        }
      });
    }

    // Hide full hosting button initially if no domain saved
    if (!localStorage.getItem("customDomain")) {
      const hostingBtn = document.getElementById("deployFullHosting");
      if (hostingBtn) hostingBtn.style.display = "none";
    }
  }

  // NEW: Fetch Fresh Price (For Duration Changes)
  async fetchFreshPrice(domain, duration) {
    try {
      const res = await fetch(`${window.API_BASE}/api/full-hosting/domain/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, duration })
      });
      const priceData = await res.json();
      localStorage.setItem("domainPrice", priceData.domainPrice.toString());
      alert(`Updated: ${duration} years = $${priceData.domainPrice}`);
    } catch (err) {
      console.error("Price fetch failed:", err);
      alert("Price update failed – using saved price");
    }
  }

  // ===========================
  // Step Navigation
  // ===========================
  goToStep(stepNumber) {
    document.querySelectorAll(".form-step").forEach((step) => {
      step.style.display = "none";
    });
    const target = document.getElementById(`step${stepNumber}`);
    if (target) target.style.display = "block";
    document.querySelectorAll(".step").forEach((indicator) =>
      indicator.classList.remove("active")
    );
    const active = document.getElementById(`indicator-step${stepNumber}`);
    if (active) active.classList.add("active");
    this.currentStep = stepNumber;
  }

  // ===========================
  // Form Submission (demo)
  // ===========================
  handleSubmit() {
    const formData = new FormData(this.form);
    const data = Object.fromEntries(formData.entries());
    if (data.businessName) {
      localStorage.setItem("businessName", data.businessName);
    }
    data.pages = formData.getAll("pages");
    data.features = formData.getAll("features");
    data.enhancements = formData.getAll("enhancements");
    console.log("🚀 Submitting generator form:", data);
    this.generatedPages = [
      `<html><body><h1>${data.businessName || "My Website"}</h1><p>Home Page</p></body></html>`,
      `<html><body><h1>About ${data.businessName || "Us"}</h1><p>About Page</p></body></html>`
    ];
    localStorage.setItem("generatedPages", JSON.stringify(this.generatedPages));
    this.goToStep(5);
    setTimeout(() => {
      this.updatePreview();
      this.showPostGenerationOptions?.();
    }, 1500);
  }

  // ===========================
  // Preview Rendering
  // ===========================
  updatePreview() {
    if (!this.generatedPages.length) {
      this.previewFrame.innerHTML =
        `<div class="preview-placeholder">No preview available yet.</div>`;
      return;
    }
    const iframe = document.createElement("iframe");
    iframe.style.width = "100%";
    iframe.style.height = "500px";
    iframe.style.border = "1px solid #ccc";
    this.previewFrame.innerHTML = "";
    this.previewFrame.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(
      this.generatedPages[this.currentPage] || "<h1>Page not found</h1>"
    );
    doc.close();
    const indicator = document.getElementById("pageIndicator");
    if (indicator) {
      indicator.textContent = `Page ${this.currentPage + 1} of ${
        this.generatedPages.length
      }`;
    }
  }

  // ===========================
  // Preview Navigation
  // ===========================
  changePage(direction) {
    this.currentPage += direction;
    this.currentPage = Math.max(
      0,
      Math.min(this.currentPage, this.generatedPages.length - 1)
    );
    this.updatePreview?.();
  }

  changePreviewDevice(device) {
    const sizes = { mobile: "375px", tablet: "768px", desktop: "100%" };
    const iframe = this.previewFrame?.querySelector("iframe");
    if (iframe) iframe.style.width = sizes[device];
    document.querySelectorAll(".preview-controls button").forEach((b) =>
      b.classList.toggle("active", b.id === `${device}Preview`)
    );
  }

  // ===========================
  // Download as ZIP
  // ===========================
  downloadGeneratedSite() {
    if (!this.userHasPaid) {
      alert("Please purchase access to download your website.");
      return;
    }
    if (!this.generatedPages.length) {
      alert("No website generated yet.");
      return;
    }
    const zip = new JSZip();
    this.generatedPages.forEach((html, i) => {
      zip.file(`page${i + 1}.html`, html);
    });
    zip.generateAsync({ type: "blob" }).then((blob) => {
      saveAs(blob, "my-website.zip");
    });
  }

  // ===========================
  // Deployment Buttons (Updated with Duration/Stripe Extras)
  // ===========================
  initializeDeploymentButtons() {
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
      let sessionId = localStorage.getItem("sessionId");
      if (!businessName) {
        alert("⚠️ Please complete business info first.");
        return;
      }
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem("sessionId", sessionId);
      }
      fetch(`${API}/api/stripe/create-checkout-session`, {  // Note: /api prefix if needed
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "netlify-hosted",
          sessionId,
          businessName
        })
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.url) window.location.href = data.url;
          else {
            alert("⚠️ Failed to create Netlify checkout session.");
            console.error(data);
          }
        })
        .catch((err) => {
          alert("❌ Error creating Netlify Stripe session.");
          console.error("Netlify Stripe error:", err);
        });
    });

    // FIXED FULL HOSTING: Validates domain/duration, fetches price, passes to Stripe (your markup here)
    const hostingBtn = document.getElementById("deployFullHosting");
    if (hostingBtn) {
      hostingBtn.addEventListener("click", async () => {
        const domain = localStorage.getItem("customDomain");
        let duration = parseInt(localStorage.getItem("domainDuration") || "1");
        const businessName = localStorage.getItem("businessName") || "Website";
        const basePrice = parseFloat(localStorage.getItem("domainPrice") || "9.88");

        if (!domain) {
          alert("⚠️ Please check and confirm your domain first (Step 4).");
          this.goToStep(4);
          return;
        }

        // Fetch fresh price for duration (GoDaddy scales linearly)
        try {
          const priceRes = await fetch(`${API}/api/full-hosting/domain/price`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ domain, duration })
          });
          const priceData = await priceRes.json();
          const totalDomainPrice = priceData.domainPrice; // e.g., base * duration
          const extraMarkup = totalDomainPrice * 0.20; // Your 20% fee example – adjust in Stripe backend
          const stripeAmount = totalDomainPrice + extraMarkup; // "Slap extra money on top"

          this.startStripeCheckout("full-hosting", { 
            domain, 
            duration, 
            businessName,
            amount: stripeAmount, // Passes to backend for Stripe session
            metadata: { domain, duration } // For GoDaddy purchase post-payment
          });
        } catch (err) {
          console.error("Price fetch failed:", err);
          // Fallback to saved
          const fallbackAmount = basePrice * duration * 1.20; // 20% markup
          this.startStripeCheckout("full-hosting", { 
            domain, 
            duration, 
            businessName,
            amount: fallbackAmount
          });
        }
      });
    }
  }

  // ===========================
  // Stripe Checkout (Passes Domain/Duration/Amount for GoDaddy + Markup)
  // ===========================
  startStripeCheckout(type, extra = {}) {
    const API = window.API_BASE;
    const businessName = localStorage.getItem("businessName") || "Website";
    let sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem("sessionId", sessionId);
    }
    const payload = { type, sessionId, businessName, ...extra }; // Includes domain/duration/amount
    fetch(`${API}/api/stripe/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.url) window.location.href = data.url;
        else {
          alert("⚠️ Failed to create checkout session.");
          console.error(data);
        }
      })
      .catch((err) => {
        console.error("Stripe error:", err);
        alert(`❌ Error creating Stripe session: ${err.message}. Check CORS/backend.`);
      });
  }
}

window.WebsiteGenerator = WebsiteGenerator;