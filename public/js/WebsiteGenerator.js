class WebsiteGenerator {
  constructor() {
    this.form = document.getElementById('websiteGeneratorForm');
    this.previewFrame = document.getElementById('previewFrame');
    this.currentPage = 0;
    this.generatedPages = [];
    this.currentStep = 1;
    this.userHasPaid = false;

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
    if (typeof this.updatePreview === 'function') {
      this.updatePreview();
    }
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
}

window.WebsiteGenerator = WebsiteGenerator;

// =======================
// ✅ Validation Methods
// =======================

WebsiteGenerator.prototype.validateStep = function (stepId) {
  const step = document.getElementById(stepId);
  if (!step) return false;

  let isValid = true;

  const requiredFields = Array.from(step.querySelectorAll('[required]')).filter(field => field.offsetParent !== null);
  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      this.showFieldError(field, 'This field is required');
      isValid = false;
    } else {
      this.clearFieldError(field);
    }
  });

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

// =======================
// ✅ handleSubmit (skeleton)
// =======================
WebsiteGenerator.prototype.handleSubmit = async function () {
  this.goToStep?.(5);
  this.showLoading?.();

  try {
    if (!this.form) return;

    const formData = new FormData(this.form);
    const selectedFeatures = formData.getAll('features');
    let contactEmail = null;

    if (selectedFeatures.includes('contact form')) {
      contactEmail = formData.get('contactEmail')?.trim();
      if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        this.showFieldError(document.getElementById('contactEmail'), 'Enter a valid email address');
        return;
      }
    }

    // 🔧 You can now safely call this.updatePreview() later
  } catch (err) {
    console.error('❌ Submission failed:', err);
    alert('An error occurred while generating your website.');
  } finally {
    this.hideLoading?.();
  }
};

