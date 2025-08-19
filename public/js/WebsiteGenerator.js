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
        this.handleSubmit();
      });
    }

    const savedPages = localStorage.getItem('generatedPages');
    if (savedPages) {
      this.generatedPages = JSON.parse(savedPages);
    }

    if (typeof this.initializeEventListeners === 'function') {
      this.initializeEventListeners();
    }

    this.initializeDeploymentButtons();
    this.initializeContactFormToggle();

    if (typeof this.highlightStep === 'function') {
      this.highlightStep(this.currentStep);
    }
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
      this.startStripeCheckout('github-instructions');
    });

    document.getElementById('deployZipOnly')?.addEventListener('click', () => {
      this.startStripeCheckout('zip-download');
    });

    document.getElementById('deployGithubHosted')?.addEventListener('click', () => {
      this.startStripeCheckout('github-hosted');
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

      this.startStripeCheckout('full-hosting');
    });
  }

  changePage(direction) {
    this.currentPage += direction;
    this.currentPage = Math.max(0, Math.min(this.currentPage, this.generatedPages.length - 1));
    this.updatePreview?.();
  }

  changePreviewDevice(device) {
    const sizes = {
      mobile: '375px',
      tablet: '768px',
      desktop: '100%'
    };

    if (!this.previewFrame) {
      this.previewFrame = document.getElementById('previewFrame');
    }

    if (!this.previewFrame) return;

    const iframe = this.previewFrame.querySelector('iframe');
    if (iframe) {
      iframe.style.width = sizes[device] || '100%';
    }

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
      // Each page may be { filename, content } or raw HTML
      const html = typeof page === 'object' && page.content ? page.content : String(page || '');
      const filename = (typeof page === 'object' && page.filename) 
        ? page.filename 
        : `page${i + 1}.html`;
      zip.file(filename, html);
    });

    zip.generateAsync({ type: 'blob' }).then(blob => {
      saveAs(blob, 'my-website.zip');
    }).catch(err => {
      console.error('❌ Failed to generate ZIP:', err);
      alert('❌ Failed to prepare website download.');
    });
  }

  // =======================
  // ✅ goToStep with Debug Tracing
  // =======================
  goToStep(stepNumber) {
    const form = this.form || document.getElementById('websiteGeneratorForm');
    if (!form) {
      console.error('❌ goToStep: #websiteGeneratorForm not found');
      return;
    }

    console.log(`➡️ goToStep(${stepNumber})`);

    // Show/hide steps
    const allSteps = form.querySelectorAll(':scope > .form-step');
    allSteps.forEach((step, index) => {
      const show = index + 1 === stepNumber;
      step.style.display = show ? 'block' : 'none';
      console.log(`   Step ${index + 1} (${step.id}): ${show ? 'SHOW' : 'HIDE'}`);
    });

    // Update step indicators
    for (let i = 1; i <= allSteps.length; i++) {
      const dot = document.getElementById(`indicator-step${i}`);
      if (dot) {
        dot.classList.toggle('active', i === stepNumber);
        dot.classList.toggle('done', i < stepNumber);
      }
    }

    this.currentStep = stepNumber;

    const visible = Array.from(form.querySelectorAll('.form-step'))
      .filter(el => window.getComputedStyle(el).display !== 'none')
      .map(el => el.id);
    console.log('👀 Currently visible step(s):', visible);
  }
}

// Expose globally
window.WebsiteGenerator = WebsiteGenerator;

/* =========================================================
   Validation & Error Display Helpers
   ========================================================= */

WebsiteGenerator.prototype.validateStep = function (stepId) {
  const step = document.getElementById(stepId);
  if (!step) return false;

  let isValid = true;

  // Check required visible fields
  const requiredFields = Array.from(step.querySelectorAll('[required]'))
    .filter(field => field.offsetParent !== null);
  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      this.showFieldError(field, 'This field is required');
      isValid = false;
    } else {
      this.clearFieldError(field);
    }
  });

  // Check checkbox groups
  const checkboxGroups = step.querySelectorAll('.checkbox-group');
  checkboxGroups.forEach(group => {
    const checkboxes = group.querySelectorAll('input[type="checkbox"]');
    const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
    if (!anyChecked) {
      this.showCheckboxError(checkboxes[0], 'Select at least one option');
      isValid = false;
    } else {
      this.clearCheckboxError(checkboxes[0]);
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


