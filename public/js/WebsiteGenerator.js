class WebsiteGenerator {
  constructor(form) {
    this.form = form || document.getElementById('websiteGeneratorForm');
    this.previewFrame = document.getElementById('previewFrame');
    this.currentPage = 0;
    this.generatedPages = [];
    this.currentStep = 1;
    this.userHasPaid = false;

    if (this.form) {
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSubmit && this.handleSubmit();
      });
    }

    const savedPages = localStorage.getItem('generatedPages');
    if (savedPages) {
      try { this.generatedPages = JSON.parse(savedPages) || []; } catch {}
    }

    // Bind UI
    this.initializeDeploymentButtons();
    this.initializeContactFormToggle();

    // Bind step nav (added)
    this.initializeEventListeners();

    // Show first step (idempotent)
    this.goToStep(1);

    if (typeof this.highlightStep === 'function') {
      this.highlightStep(this.currentStep);
    }
  }

  /* ----------------- NEW/UPDATED: step listeners ----------------- */
  initializeEventListeners() {
    if (!this.form) {
      console.error('❌ initializeEventListeners: form not found');
      return;
    }
    console.log('[GEN] initializeEventListeners()');

    const plan = [
      { id: 'nextStep1', to: 2, validate: 'step1' },
      { id: 'nextStep2', to: 3, validate: 'step2' },
      { id: 'nextStep3', to: 4, validate: 'step3' },
      { id: 'nextStep4', to: 5 }, // generate step (handled below)
      { id: 'prevStep2', to: 1 },
      { id: 'prevStep3', to: 2 },
      { id: 'prevStep4', to: 3 },
    ];

    plan.forEach(({ id, to, validate }) => {
      const btn = document.getElementById(id);
      if (!btn) { console.warn(`[GEN] Button not found: #${id}`); return; }
      btn.type = btn.type || 'button';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        console.log(`[GEN] Click ${id} -> ${to}${validate ? ` (validate ${validate})` : ''}`);
        if (validate && !this.validateStep(validate)) return;
        this.goToStep(to);
        if (to === 5 && typeof this.handleSubmit === 'function') {
          this.handleSubmit();
        }
      });
    });

    // Safety net: delegated handler (works even if buttons are re-rendered)
    this.form.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;

      if (/^nextStep/.test(btn.id)) {
        e.preventDefault();
        const cur = this.getVisibleStepNumber();
        const validateId = `step${cur}`;
        if (!this.validateStep(validateId)) return;
        const target = Math.min(cur + 1, 5);
        this.goToStep(target);
        if (target === 5 && typeof this.handleSubmit === 'function') this.handleSubmit();
      }
      if (/^prevStep/.test(btn.id)) {
        e.preventDefault();
        const cur = this.getVisibleStepNumber();
        this.goToStep(Math.max(cur - 1, 1));
      }
    });
  }

  /* ------------- helper to get current visible step number ----------- */
  getVisibleStepNumber() {
    if (!this.form) return 1;
    const steps = Array.from(this.form.querySelectorAll('.form-step'));
    const visible = steps.find(s => getComputedStyle(s).display !== 'none');
    if (!visible) return 1;
    const num = Number((visible.id || '').replace(/\D+/g, '')) || 1;
    return num;
  }

  initializeContactFormToggle() {
    const contactCheckbox = document.querySelector('input[name="features"][value="contact form"]');
    const emailContainer = document.getElementById('contactEmailContainer');
    const emailInput = document.getElementById('contactEmail');

    if (contactCheckbox && emailContainer && emailInput) {
      const toggleVisibility = () => {
        const isChecked = contactCheckbox.checked;
        emailContainer.style.display = isChecked ? 'block' : 'none';
        emailInput.required = isChecked;
        if (!isChecked) emailInput.value = '';
      };

      toggleVisibility();
      contactCheckbox.addEventListener('change', toggleVisibility);
    }
  }

  initializeDeploymentButtons() {
    document.getElementById('deployGithubSelf')?.addEventListener('click', () => {
      this.startStripeCheckout && this.startStripeCheckout('github-instructions');
    });

    document.getElementById('deployZipOnly')?.addEventListener('click', () => {
      this.startStripeCheckout && this.startStripeCheckout('zip-download');
    });

    document.getElementById('deployGithubHosted')?.addEventListener('click', () => {
      this.startStripeCheckout && this.startStripeCheckout('github-hosted');
    });

    document.getElementById('deployNetlifyOnly')?.addEventListener('click', () => {
      const businessName = localStorage.getItem('businessName');
      let sessionId = localStorage.getItem('sessionId');

      if (!businessName) {
        alert('⚠️ Please complete business info first.');
        return;
      }
      if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem('sessionId', sessionId);
      }

      fetch('https://websitegeneration.onrender.com/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'netlify-hosted', sessionId, businessName })
      })
        .then(res => res.json())
        .then(data => {
          if (data.url) {
            window.location.href = data.url;
          } else {
            alert('⚠️ Failed to create Netlify checkout session.');
            console.error(data);
          }
        })
        .catch(err => {
          alert('❌ Error creating Netlify Stripe session.');
          console.error('Netlify Stripe error:', err);
        });
    });

    document.getElementById('deployFullHosting')?.addEventListener('click', () => {
      const domain = localStorage.getItem('customDomain');
      const duration = localStorage.getItem('domainDuration');
      const businessName = localStorage.getItem('businessName');

      if (!domain || !duration || !businessName) {
        alert('⚠️ Missing domain, duration, or business name. Please confirm domain first.');
        return;
      }

      this.startStripeCheckout && this.startStripeCheckout('full-hosting');
    });
  }

  changePage(direction) {
    this.currentPage += direction;
    this.currentPage = Math.max(0, Math.min(this.currentPage, this.generatedPages.length - 1));
    this.updatePreview && this.updatePreview();
  }

  changePreviewDevice(device) {
    const sizes = { mobile: '375px', tablet: '768px', desktop: '100%' };

    if (!this.previewFrame) this.previewFrame = document.getElementById('previewFrame');
    if (!this.previewFrame) return;

    const iframe = this.previewFrame.querySelector('iframe');
    if (iframe) iframe.style.width = sizes[device] || '100%';

    document.querySelectorAll('.preview-controls button').forEach(button => {
      button.classList.toggle('active', button.id === `${device}Preview`);
    });
  }

  // =======================
  // ✅ Download Generated Site
  // =======================
  downloadGeneratedSite() {
    if (!this.userHasPaid) {
      alert('⚠️ Please purchase access to download your website.');
      return;
    }
    if (!this.generatedPages || !this.generatedPages.length) {
      alert('⚠️ No website generated yet.');
      return;
    }

    const zip = new JSZip();
    this.generatedPages.forEach((page, i) => {
      const html = typeof page === 'object' && page.content ? page.content : String(page || '');
      const filename = (typeof page === 'object' && page.filename) ? page.filename : `page${i + 1}.html`;
      zip.file(filename, html);
    });

    zip.generateAsync({ type: 'blob' })
      .then(blob => saveAs(blob, 'my-website.zip'))
      .catch(err => {
        console.error('❌ Failed to generate ZIP:', err);
        alert('❌ Failed to prepare website download.');
      });
  }

  // =======================
  // ✅ goToStep with Debug Tracing (updated)
  // =======================
  goToStep(stepNumber) {
    const form = this.form || document.getElementById('websiteGeneratorForm');
    if (!form) {
      console.error('❌ goToStep: #websiteGeneratorForm not found');
      return;
    }

    // Use robust selector; steps don’t have to be direct children
    const allSteps = Array.from(form.querySelectorAll('.form-step'));
    if (!allSteps.length) {
      console.error('❌ goToStep: no .form-step elements found');
      return;
    }

    const total = allSteps.length;
    const target = Math.min(Math.max(parseInt(stepNumber, 10) || 1, 1), total);

    console.log(`➡️ goToStep(${target})`);

    allSteps.forEach((step, index) => {
      const show = index + 1 === target;
      step.style.display = show ? 'block' : 'none';
      console.log(`   Step ${index + 1} (${step.id || 'no-id'}): ${show ? 'SHOW' : 'HIDE'}`);
    });

    // Update indicators if present
    for (let i = 1; i <= total; i++) {
      const dot = document.getElementById(`indicator-step${i}`);
      if (dot) {
        dot.classList.toggle('active', i === target);
        dot.classList.toggle('done', i < target);
      }
    }

    this.currentStep = target;

    const visible = allSteps.filter(el => getComputedStyle(el).display !== 'none').map(el => el.id);
    console.log('👀 Currently visible step(s):', visible);
  }
}

// Expose globally
window.WebsiteGenerator = WebsiteGenerator;

/* =========================================================
   Validation & Error Display Helpers (accept id or number)
   ========================================================= */
WebsiteGenerator.prototype.validateStep = function (stepRef) {
  let stepEl = null;

  if (typeof stepRef === 'number') {
    stepEl = document.getElementById(`step${stepRef}`);
  } else if (typeof stepRef === 'string') {
    stepEl = document.getElementById(stepRef) || document.getElementById(`step${stepRef.replace(/\D+/g, '')}`);
  }

  if (!stepEl) {
    console.warn('validateStep: step not found for', stepRef);
    return false;
  }

  let isValid = true;

  // required fields that are visible
  const requiredFields = Array.from(stepEl.querySelectorAll('[required]'))
    .filter(field => field.offsetParent !== null);
  requiredFields.forEach(field => {
    if (!String(field.value || '').trim()) {
      this.showFieldError(field, 'This field is required');
      isValid = false;
    } else {
      this.clearFieldError(field);
    }
  });

  // checkbox groups (if any)
  const checkboxGroups = stepEl.querySelectorAll('.checkbox-group');
  checkboxGroups.forEach(group => {
    const checkboxes = group.querySelectorAll('input[type="checkbox"]');
    const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
    if (!anyChecked) {
      if (checkboxes[0]) this.showCheckboxError(checkboxes[0], 'Select at least one option');
      isValid = false;
    } else {
      if (checkboxes[0]) this.clearCheckboxError(checkboxes[0]);
    }
  });

  return isValid;
};

WebsiteGenerator.prototype.showFieldError = function (field, message) {
  this.clearFieldError(field);
  const errorDiv = document.createElement('div');
  errorDiv.className = 'field-error';
  errorDiv.textContent = message;
  field.parentNode.appendChild(errorDiv);
  field.classList.add('error');
  field.scrollIntoView({ behavior: 'smooth', block: 'center' });
};

WebsiteGenerator.prototype.clearFieldError = function (field) {
  const errorDiv = field.parentNode.querySelector('.field-error');
  if (errorDiv) errorDiv.remove();
  field.classList.remove('error');
};

WebsiteGenerator.prototype.showCheckboxError = function (field, message) {
  const group = field.closest('.checkbox-group');
  if (group && !group.querySelector('.field-error')) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    group.appendChild(errorDiv);
  }
};

WebsiteGenerator.prototype.clearCheckboxError = function (field) {
  const group = field.closest('.checkbox-group');
  const errorDiv = group?.querySelector('.field-error');
  if (errorDiv) errorDiv.remove();
};

