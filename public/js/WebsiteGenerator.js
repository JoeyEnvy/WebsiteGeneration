// ===========================
// WebsiteGenerator.js — Vercel/Render-ready (Full Fixed Version – Nov 2025)
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
    this.initializeDeploymentButtons();
    this.initializeDomainChecker(); // NEW: Wire domain check on load
  }

  // ===========================
  // NEW: Domain Availability Check (Integrated with Backend)
  // ===========================
  async checkDomainAvailability(domain) {
    if (!domain || !domain.includes(".")) {
      alert("Please enter a valid domain");
      return false;
    }

    const button = document.getElementById("checkDomainBtn");
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = "Checking...";

    try {
      const res = await fetch(`${window.API_BASE}/full-hosting/domain/check?domain=${domain.toLowerCase().trim()}`, {
        method: "GET",  // Matches your route (GET)
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json();

      if (data.available) {
        const price = data.price || 9.88;
        const duration = 1; // Default 1 year
        localStorage.setItem("customDomain", domain.toLowerCase().trim());
        localStorage.setItem("domainPrice", price.toString());
        localStorage.setItem("domainDuration", duration.toString());
        alert(`✅ ${domain} is AVAILABLE! Price: $${price}/year`);
        document.getElementById("domainStatus").innerHTML = `
          <strong style="color:green">✓ ${domain} is available!</strong><br>
          <small>Price: $${price}/first year (1 year)</small>
        `;
        document.getElementById("deployFullHosting").style.display = "block"; // Show button
        return true;
      } else {
        alert(`❌ ${domain} is already taken. Try another!`);
        document.getElementById("domainStatus").innerHTML = `<strong style="color:red">✗ ${domain} is taken</strong>`;
        return false;
      }
    } catch (err) {
      console.error("Domain check error:", err);
      alert("Domain check failed. Ensure backend is running and keys are set.");
      document.getElementById("domainStatus").textContent = "Check failed – try again";
      return false;
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
  }

  // NEW: Initialize Domain Checker (Wires button + input)
  initializeDomainChecker() {
    document.getElementById("checkDomainBtn")?.addEventListener("click", () => {
      const input = document.getElementById("customDomainInput");
      const domain = input.value.trim();
      if (!domain) return alert("Enter a domain first (e.g., mybusiness.com)");
      if (!domain.includes(".")) return alert("Include TLD like .com or .store");
      this.checkDomainAvailability(domain);
    });

    // Optional: Enter key on input
    document.getElementById("customDomainInput")?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.checkDomainAvailability(e.target.value.trim());
    });

    // Hide full hosting button initially if no domain saved
    if (!localStorage.getItem("customDomain")) {
      document.getElementById("deployFullHosting").style.display = "none";
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
  // Deployment Buttons (Updated with Full Hosting)
  // ===========================
  initializeDeploymentButtons() {
    const API = window.API_BASE; // ✅ use global API base
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
      fetch(`${API}/stripe/create-checkout-session`, {
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

    // FIXED FULL HOSTING: Requires confirmed domain
    document.getElementById("deployFullHosting")?.addEventListener("click", () => {
      const domain = localStorage.getItem("customDomain");
      const duration = localStorage.getItem("domainDuration") || "1";
      const businessName = localStorage.getItem("businessName") || "Website";

      if (!domain) {
        alert("⚠️ Please check and confirm your domain first (Step 4).");
        this.goToStep(4); // Redirect to domain step
        return;
      }

      // Optional: Fetch fresh price before checkout
      fetch(`${window.API_BASE}/full-hosting/domain/price`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, duration: parseInt(duration) })
      })
        .then(res => res.json())
        .then(priceData => {
          localStorage.setItem("domainPrice", priceData.domainPrice.toString()); // Update price
          this.startStripeCheckout("full-hosting", { domain, duration, price: priceData.domainPrice });
        })
        .catch(err => {
          console.error("Price fetch failed:", err);
          this.startStripeCheckout("full-hosting", { domain, duration }); // Fallback
        });
    });
  }

  // ===========================
  // Stripe Checkout (Updated to Pass Domain/Price)
  // ===========================
  startStripeCheckout(type, extra = {}) {
    const API = window.API_BASE; // ✅ use global API base
    const businessName = localStorage.getItem("businessName") || "Website";
    let sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem("sessionId", sessionId);
    }
    const payload = { type, sessionId, businessName, ...extra }; // Includes domain/price if full-hosting
    fetch(`${API}/stripe/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.url) window.location.href = data.url;
        else {
          alert("⚠️ Failed to create checkout session.");
          console.error(data);
        }
      })
      .catch((err) => {
        alert("❌ Error creating Stripe session.");
        console.error("Stripe error:", err);
      });
  }
}

window.WebsiteGenerator = WebsiteGenerator;