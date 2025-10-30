// ===========================
// main.js — Global bootstrap, UI logic, API calls (Vercel)
// ===========================

// ✅ Clear previous site data on hard refresh
window.addEventListener('beforeunload', () => {
  localStorage.removeItem('generatedPages');
});

// ✅ Global backend base (Vercel)
const API_BASE = "https://website-generation.vercel.app/api";
window.API_BASE = API_BASE;

// Debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// ===========================
// Domain utilities
// ===========================
function isValidDomain(domain) {
  const d = String(domain || '').trim().toLowerCase();
  const domainRegex = /^(?!-)(?!.*--)([a-z0-9-]{1,63}\.)+[a-z]{2,}$/i;
  return (
    domainRegex.test(d) &&
    d.length <= 253 &&
    !d.includes(' ') &&
    !d.startsWith('.') &&
    !d.endsWith('.')
  );
}

// ===========================
// WebsiteGenerator class
// ===========================
class WebsiteGenerator {
  constructor() {
    this.form = document.getElementById('websiteGeneratorForm');
    this.previewFrame = document.getElementById('previewFrame');
    this.currentPage = 0;
    this.generatedPages = [];
    this.currentStep = 1;
    this.userHasPaid = false;

    // Restore saved pages from previous session if available
    const savedPages = localStorage.getItem('generatedPages');
    if (savedPages) {
      try {
        this.generatedPages = JSON.parse(savedPages);
      } catch {
        console.warn('⚠️ Could not parse saved pages from localStorage');
      }
    }

    this.initializeEventListeners();
    this.initializeDeploymentButtons();
    this.highlightStep(this.currentStep);
  }

  // ===========================
  // Event bindings
  // ===========================
  initializeEventListeners() {
    const nextStep4Btn = document.getElementById('nextStep4');
    if (nextStep4Btn) {
      nextStep4Btn.addEventListener('click', () => {
        if (this.validateStep('step4')) this.goToStep(5);
      });
    }

    document.getElementById('nextStep1')?.addEventListener('click', () => {
      if (this.validateStep('step1')) this.goToStep(2);
    });

    document.getElementById('nextStep2')?.addEventListener('click', () => {
      if (this.validateStep('step2')) this.goToStep(3);
    });

    document.getElementById('nextStep3')?.addEventListener('click', () => {
      if (this.validateStep('step3')) this.goToStep(4);
    });

    document.getElementById('prevStep2')?.addEventListener('click', () => this.goToStep(1));
    document.getElementById('prevStep3')?.addEventListener('click', () => this.goToStep(2));
    document.getElementById('prevStep4')?.addEventListener('click', () => this.goToStep(3));

    document.querySelectorAll('.preview-controls button')?.forEach(button => {
      button.addEventListener('click', () => {
        this.changePreviewDevice(button.id.replace('Preview', ''));
      });
    });

    document.getElementById('prevPage')?.addEventListener('click', () => this.changePage(-1));
    document.getElementById('nextPage')?.addEventListener('click', () => this.changePage(1));

    this.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });

    const purchaseBtn = document.getElementById('purchaseBtn');
    const downloadBtn = document.getElementById('downloadSiteBtn');

    if (purchaseBtn) {
      purchaseBtn.addEventListener('click', () => {
        const confirmed = confirm("Simulated payment: Proceed to pay £X?");
        if (confirmed) {
          this.userHasPaid = true;
          purchaseBtn.style.display = 'none';
          if (downloadBtn) downloadBtn.style.display = 'inline-block';
          alert('Payment successful. You can now download your website.');
        }
      });
    }

    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => this.downloadGeneratedSite());
    }
  }

  // ===========================
  // Deployment buttons
  // ===========================
  initializeDeploymentButtons() {
    document.getElementById('deployGithubSelf')?.addEventListener('click', () => {
      this.startStripeCheckout?.('github-instructions');
    });

    document.getElementById('deployZipOnly')?.addEventListener('click', () => {
      this.startStripeCheckout?.('zip-download');
    });

    document.getElementById('deployGithubHosted')?.addEventListener('click', () => {
      this.startStripeCheckout?.('github-hosted');
    });

    document.getElementById('deployFullHosting')?.addEventListener('click', () => {
      const domain = localStorage.getItem('customDomain');
      const duration = localStorage.getItem('domainDuration');
      const businessName = this.form?.querySelector('[name="businessName"]')?.value || localStorage.getItem('businessName');

      if (!domain || !duration || !businessName) {
        alert('⚠️ Missing domain, duration, or business name. Please confirm domain first.');
        return;
      }

      this.startStripeCheckout?.('full-hosting');
    });
  }

  // ===========================
  // Form submission → Generate site
  // ===========================
  async handleSubmit() {
    this.goToStep(5);
    this.showLoading();

    try {
      const formData = new FormData(this.form);
      const finalPrompt = this.buildFinalPrompt(formData);

      // Ensure sessionId exists
      if (!localStorage.getItem('sessionId')) {
        localStorage.setItem('sessionId', (crypto.randomUUID?.() || String(Date.now())));
      }
      const sessionId = localStorage.getItem('sessionId');

      // Call /generate
      const genRes = await fetch(`${API_BASE}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: finalPrompt,
          pageCount: formData.get('pageCount') || '1'
        })
      });

      if (!genRes.ok) {
        const text = await genRes.text();
        throw new Error(`Generate failed: ${genRes.status} ${genRes.statusText} — ${text.slice(0, 200)}`);
      }

      const data = await genRes.json();

      if (data?.success && Array.isArray(data.pages)) {
        this.generatedPages = data.pages;
        localStorage.setItem('generatedPages', JSON.stringify(this.generatedPages));
        this.currentPage = 0;

        // Persist pages to backend for the session
        await fetch(`${API_BASE}/store-step`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId,
            step: 'pages',
            content: data.pages
          })
        }).catch(() => { /* non-fatal */ });

        this.updatePreview();
        this.showSuccess('Website generated successfully!');
      } else {
        throw new Error(data?.error || 'Unknown error from server.');
      }
    } catch (error) {
      this.showError('Failed to generate website: ' + (error.message || error));
    } finally {
      this.hideLoading();
    }
  }

  // ===========================
  // Prompt builder
  // ===========================
  buildFinalPrompt(formData) {
    const websiteType = formData.get('websiteType');
    const pageCount = formData.get('pageCount');
    const pages = Array.from(formData.getAll('pages')).join(', ');
    const businessName = formData.get('businessName');
    const businessType = formData.get('businessType');
    const businessDescription = formData.get('businessDescription');
    const features = Array.from(formData.getAll('features')).join(', ');
    const colorScheme = formData.get('colorScheme');
    const fontStyle = formData.get('fontStyle');
    const layoutPreference = formData.get('layoutPreference');
    const enhancements = Array.from(formData.getAll('enhancements')).join(', ');

    // Store business name for later flows
    if (businessName) localStorage.setItem('businessName', businessName);

    return `
You are a professional website developer.

Generate exactly ${pageCount} fully standalone HTML pages: ${pages}.
Each page must be a complete HTML5 document using embedded <style> and <script> only.
Do not explain or comment anything.

✅ Design Requirements:
- Use a clean, modern, professional layout.
- Use responsive design with media queries for 1024px, 768px, 480px, and 320px breakpoints.
- Structure pages using semantic HTML5 elements: <header>, <nav>, <main>, <section>, <footer>.
- Use grid or flex layout systems to organize content into responsive rows and columns.
- Prioritize good spacing, font hierarchy, and visual balance.
- Style all images with soft shadows, borders, and proper padding.

📦 Details:
- Website Type: ${websiteType}
- Business: "${businessName}" (${businessType})
- Pages: ${pages}
- Features: ${features}
- Design: ${colorScheme} theme, ${fontStyle} font, ${layoutPreference} layout
- Enhancements: ${enhancements}

📝 Business Description:
"${businessDescription}" — expand this into 2–3 rich paragraphs (300–500 words total) that describe the business purpose, audience, and mission. Also include 4–6 bullet points in one or more columns.

📐 Section Structure:
- Each page must include at least 5 clearly labeled sections such as:
  1. Hero Section
  2. About/Description
  3. Services Grid
  4. Testimonials
  5. Contact Section
- Randomize some page layouts: e.g. navbar on top or side, hero image left or right, or full-width banner.

🎨 Visuals & Variation:
- Use different font pairings for headers and body text.
- Mix content alignment (left-aligned, centered, or justified)
- Add alternating section backgrounds for visual rhythm.

🖼️ Images & Icons:
- Pull at least 2–3 relevant images per page from public sources online (Unsplash, Pexels, Pixabay).
- Include at least 3 icons per page using FontAwesome CDN.
- Style images with borders, drop shadows, and spacing.

📋 Content Notes:
- Never use "Lorem Ipsum".
- Use context-aware, realistic, varied content.
- Include clear CTAs, subheadings, bullet lists, and quotes.
    `.trim();
  }

  // ===========================
  // Loading and alerts
  // ===========================
  showLoading() {
    const loader = document.createElement('div');
    loader.className = 'loader';
    loader.innerHTML = 'Generating website...';
    this.form.appendChild(loader);

    const submitBtn = this.form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
  }

  hideLoading() {
    const loader = this.form.querySelector('.loader');
    if (loader) loader.remove();

    const submitBtn = this.form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = false;
  }

  showSuccess(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-success';
    alert.innerHTML = message;
    this.form.insertBefore(alert, this.form.firstChild);
    setTimeout(() => alert.remove(), 5000);
  }

  showError(message) {
    const alert = document.createElement('div');
    alert.className = 'alert alert-error';
    alert.innerHTML = message;
    this.form.insertBefore(alert, this.form.firstChild);
    setTimeout(() => alert.remove(), 5000);
  }

  // ===========================
  // Preview rendering
  // ===========================
  updatePreview() {
    if (!this.generatedPages.length) {
      this.previewFrame.innerHTML = `<div class="preview-placeholder">No preview available yet.</div>`;
      return;
    }

    const currentPageContent = this.generatedPages[this.currentPage];
    const scrollY = window.scrollY;

    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '500px';
    iframe.style.border = 'none';

    this.previewFrame.innerHTML = '';
    this.previewFrame.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(currentPageContent);
    doc.close();

    iframe.onload = () => {
      const idoc = iframe.contentDocument || iframe.contentWindow.document;

      // Inject dynamic style
      const style = idoc.createElement('style');
      style.innerHTML = `
        .single-column {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 32px !important;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          box-sizing: border-box;
        }
        #backToTop {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 10px;
          background: #007bff;
          color: #fff;
          border: none;
          border-radius: 5px;
          cursor: pointer;
        }
      `;
      idoc.head.appendChild(style);

      // Hide customization panel by default on update
      const panel = document.getElementById('customizationPanel');
      if (panel) panel.style.display = 'none';
    };

    window.scrollTo({ top: scrollY, behavior: 'auto' });
    this.updatePageNavigation();
    this.showPostGenerationOptions();
  }

  updatePageNavigation() {
    const prevButton = document.getElementById('prevPage');
    const nextButton = document.getElementById('nextPage');
    const pageIndicator = document.getElementById('pageIndicator');

    if (prevButton) prevButton.disabled = this.currentPage === 0;
    if (nextButton) nextButton.disabled = this.currentPage === this.generatedPages.length - 1;
    if (pageIndicator) pageIndicator.textContent = `Page ${this.currentPage + 1} of ${this.generatedPages.length}`;
  }

  // ===========================
  // Step navigation
  // ===========================
  goToStep(stepNumber) {
    document.querySelectorAll('.form-step').forEach(step => step.style.display = 'none');
    const el = document.getElementById(`step${stepNumber}`);
    if (el) el.style.display = 'block';
    this.currentStep = stepNumber;
    this.highlightStep(stepNumber);
  }

  highlightStep(stepNumber) {
    document.querySelectorAll('.step-progress-bar .step').forEach((el, index) => {
      el.classList.toggle('active', index === stepNumber - 1);
    });
  }

  // ===========================
  // Step validation
  // ===========================
  validateStep(stepId) {
    const step = document.getElementById(stepId);
    if (!step) return true;

    const requiredFields = step.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
      if (!String(field.value || '').trim()) {
        this.showFieldError(field, 'This field is required');
        isValid = false;
      } else {
        this.clearFieldError(field);
      }
    });

    const checkboxes = step.querySelectorAll('input[type="checkbox"]');
    if (checkboxes.length) {
      const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
      if (!anyChecked) {
        this.showCheckboxError(checkboxes[0], 'Select at least one option');
        isValid = false;
      } else {
        this.clearCheckboxError(checkboxes[0]);
      }
    }

    return isValid;
  }

  showFieldError(field, message) {
    this.clearFieldError(field);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.innerHTML = message;
    field.parentNode.appendChild(errorDiv);
    field.classList.add('error');
  }

  clearFieldError(field) {
    const errorDiv = field.parentNode.querySelector('.field-error');
    if (errorDiv) errorDiv.remove();
    field.classList.remove('error');
  }

  showCheckboxError(field, message) {
    const group = field.closest('.checkbox-group');
    if (group && !group.querySelector('.field-error')) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'field-error';
      errorDiv.innerHTML = message;
      group.appendChild(errorDiv);
    }
  }

  clearCheckboxError(field) {
    const group = field.closest('.checkbox-group');
    const errorDiv = group?.querySelector('.field-error');
    if (errorDiv) errorDiv.remove();
  }

  // ===========================
  // Preview navigation + sizing
  // ===========================
  changePage(direction) {
    this.currentPage += direction;
    this.currentPage = Math.max(0, Math.min(this.currentPage, this.generatedPages.length - 1));
    this.updatePreview();
  }

  changePreviewDevice(device) {
    const sizes = {
      mobile: '375px',
      tablet: '768px',
      desktop: '100%'
    };

    const iframe = this.previewFrame?.querySelector('iframe');
    if (iframe) {
      iframe.style.width = sizes[device] || '100%';
    }

    document.querySelectorAll('.preview-controls button').forEach(button => {
      button.classList.toggle('active', button.id === `${device}Preview`);
    });
  }

  // ===========================
  // Download
  // ===========================
  downloadGeneratedSite() {
    if (!this.userHasPaid) {
      alert('Please purchase access to download your website.');
      return;
    }

    if (!this.generatedPages.length) {
      alert('No website generated yet.');
      return;
    }

    const zip = new JSZip();
    this.generatedPages.forEach((html, i) => {
      zip.file(`page${i + 1}.html`, html);
    });

    zip.generateAsync({ type: 'blob' }).then(blob => {
      saveAs(blob, "my-website.zip");
    });
  }

  // ===========================
  // Post-generation UI
  // ===========================
  showPostGenerationOptions() {
    const previewControls = document.querySelector('.preview-controls');
    if (!previewControls || document.getElementById('postGenActions')) return;

    const panel = document.createElement('div');
    panel.id = 'postGenActions';
    panel.className = 'post-gen-panel';
    panel.innerHTML = `
      <h3>✅ Your site is ready! What would you like to do next?</h3>
      <div class="action-buttons">
        <button class="btn btn-outline" id="editPagesBtn">🛠️ Edit Pages</button>
        <button class="btn btn-outline" id="addBrandingBtn">✏️ Add Branding</button>
        <button class="btn btn-outline" id="deploymentHelpBtn">🌍 Deployment Instructions</button>
      </div>
    `;

    previewControls.appendChild(panel);

    // Edit Pages toggle
    const editBtn = document.getElementById('editPagesBtn');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        const customizationPanel = document.getElementById('customizationPanel');
        const brandingPanel = document.getElementById('brandingPanel');

        if (!customizationPanel || !brandingPanel) return;

        brandingPanel.style.display = 'none';

        const isHidden = (customizationPanel.style.display === 'none' || customizationPanel.style.display === '');
        customizationPanel.style.display = isHidden ? 'block' : 'none';

        const tools = customizationPanel.querySelector('.custom-tools');
        if (tools) tools.style.display = isHidden ? 'flex' : 'none';
      });
    }

    // Branding toggle
    document.getElementById('addBrandingBtn')?.addEventListener('click', () => {
      const panel = document.getElementById('brandingPanel');
      const customPanel = document.getElementById('customizationPanel');

      if (customPanel) customPanel.style.display = 'none';
      if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
      }
    });

    // Deployment modal toggle
    const deployBtn = document.getElementById('deploymentHelpBtn');
    const deployModal = document.getElementById('deploymentModal');
    const closeDeploy = document.getElementById('closeDeploymentModal');

    if (deployBtn && deployModal && closeDeploy) {
      deployBtn.addEventListener('click', () => {
        deployModal.style.display = 'block';
      });

      closeDeploy.addEventListener('click', () => {
        deployModal.style.display = 'none';
      });
    }
  }
}

// ===========================
// Domain Checker Frontend (Porkbun-compatible endpoints on Vercel)
// ===========================
function setupDomainChecker() {
  const domainInput = document.getElementById('customDomain');
  const checkBtn = document.getElementById('checkDomainBtn');
  const resultDisplay = document.getElementById('domainCheckResult');
  const buyButton = document.getElementById('deployFullHosting');
  const priceDisplay = document.getElementById('domainPriceDisplay');
  const durationSelect = document.getElementById('domainDuration');
  const confirmBtn = document.getElementById('confirmDomainBtn');

  if (!domainInput || !checkBtn || !resultDisplay || !buyButton) return;

  domainInput.addEventListener('input', () => {
    const domain = domainInput.value.trim().toLowerCase();
    if (!domain) {
      resultDisplay.textContent = '';
      buyButton.disabled = true;
      confirmBtn && (confirmBtn.disabled = true);
      return;
    }

    if (!isValidDomain(domain)) {
      resultDisplay.textContent = '❌ Invalid domain format';
      resultDisplay.style.color = 'red';
      buyButton.disabled = true;
      confirmBtn && (confirmBtn.disabled = true);
    } else {
      resultDisplay.textContent = '✅ Valid format. Click "Check Availability"';
      resultDisplay.style.color = 'blue';
      buyButton.disabled = true;
      confirmBtn && (confirmBtn.disabled = true);
    }
  });

  // Check availability + price
  checkBtn.addEventListener('click', async () => {
    const domain = domainInput.value.trim().toLowerCase();
    resultDisplay.textContent = '';
    resultDisplay.style.color = 'black';
    buyButton.disabled = true;
    if (confirmBtn) confirmBtn.disabled = true;
    if (priceDisplay) priceDisplay.textContent = '';

    if (!isValidDomain(domain)) {
      resultDisplay.textContent = '❌ Please enter a valid domain name.';
      resultDisplay.style.color = 'red';
      return;
    }

    resultDisplay.textContent = '🔍 Checking availability...';

    try {
      const checkRes = await fetch(`${API_BASE}/full-hosting/domain/check?domain=${encodeURIComponent(domain)}`);
      if (!checkRes.ok) throw new Error(`Server responded with ${checkRes.status}`);
      const { available } = await checkRes.json();

      if (!available) {
        resultDisplay.textContent = `❌ "${domain}" is not available.`;
        resultDisplay.style.color = 'red';
        return;
      }

      resultDisplay.textContent = `✅ "${domain}" is available!`;
      resultDisplay.style.color = 'green';
      if (confirmBtn) confirmBtn.disabled = false;

      localStorage.setItem('customDomain', domain);

      const duration = durationSelect?.value || '1';
      localStorage.setItem('domainDuration', duration);

      const priceRes = await fetch(`${API_BASE}/full-hosting/domain/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, duration })
      });

      if (!priceRes.ok) throw new Error('Price fetch failed');
      const priceData = await priceRes.json();
      const base = parseFloat(priceData.domainPrice || 0);
      localStorage.setItem('domainPrice', String(base));
      const final = (base + 150).toFixed(2);

      if (priceDisplay) {
        priceDisplay.textContent = `💷 Estimated Price: £${base.toFixed(2)} + £150 service = £${final}`;
        priceDisplay.style.color = 'black';
      }
    } catch (err) {
      console.error('❌ Domain check error:', err);
      resultDisplay.textContent = '⚠️ Error checking domain. Please try again.';
      resultDisplay.style.color = 'orange';
      buyButton.disabled = true;
      if (confirmBtn) confirmBtn.disabled = true;
    }
  });

  // Recalculate price on duration change
  durationSelect?.addEventListener('change', async () => {
    const domain = domainInput.value.trim().toLowerCase();
    if (!isValidDomain(domain)) return;
    localStorage.setItem('domainDuration', durationSelect.value);

    if (!resultDisplay.textContent.includes('available')) return;

    try {
      const res = await fetch(`${API_BASE}/full-hosting/domain/price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain, duration: durationSelect.value })
      });

      if (!res.ok) throw new Error('Estimate failed');
      const data = await res.json();
      const base = parseFloat(data.domainPrice || 0);
      localStorage.setItem('domainPrice', String(base));
      const final = (base + 150).toFixed(2);

      if (priceDisplay) {
        priceDisplay.textContent = `💷 Estimated Price: £${base.toFixed(2)} + £150 service = £${final}`;
        priceDisplay.style.color = 'black';
      }
    } catch (err) {
      console.error('⚠️ Price recheck error:', err);
      if (priceDisplay) {
        priceDisplay.textContent = '⚠️ Could not re-estimate price.';
        priceDisplay.style.color = 'orange';
      }
    }
  });

  // Confirm domain
  confirmBtn?.addEventListener('click', () => {
    confirmBtn.textContent = '✅ Domain Confirmed';
    confirmBtn.disabled = true;
    buyButton.disabled = false;
  });
}

// ===========================
// Bootstrap
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  // Hide customization panel by default
  const customizationPanel = document.getElementById('customizationPanel');
  if (customizationPanel) {
    customizationPanel.style.display = 'none';
    const tools = customizationPanel.querySelector('.custom-tools');
    if (tools) tools.style.display = 'none';
  }

  // Domain checker
  setupDomainChecker();

  // Start generator
  new WebsiteGenerator();
});
