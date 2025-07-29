// =======================
// ✅ WebsiteGenerator CLASS
// =======================
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

    this.initializeEventListeners();
    this.initializeDeploymentButtons();
    this.initializeContactFormToggle();
    this.highlightStep(this.currentStep);
  }

  initializeContactFormToggle() {
    const contactCheckbox = document.querySelector('input[name="features"][value="contact form"]');
    const emailContainer = document.getElementById('contactEmailContainer');

    if (contactCheckbox && emailContainer) {
      contactCheckbox.addEventListener('change', () => {
        emailContainer.style.display = contactCheckbox.checked ? 'block' : 'none';
        if (!contactCheckbox.checked) {
          document.getElementById('contactEmail').value = '';
        }
      });
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
    this.updatePreview();
  }

  changePreviewDevice(device) {
    const sizes = {
      mobile: '375px',
      tablet: '768px',
      desktop: '100%'
    };

    const iframe = this.previewFrame.querySelector('iframe');
    if (iframe) iframe.style.width = sizes[device];

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

  const requiredFields = Array.from(step.querySelectorAll('[required]')).filter(f => f.offsetParent !== null);
  let isValid = true;

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
    if (checkboxes.length) {
      const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
      if (!anyChecked) {
        this.showCheckboxError(checkboxes[0], 'Select at least one option');
        isValid = false;
      } else {
        this.clearCheckboxError(checkboxes[0]);
      }
    }
  });

  return isValid;
};

WebsiteGenerator.prototype.showFieldError = function (field, message) {
  this.clearFieldError(field);
  const errorDiv = document.createElement('div');
  errorDiv.className = 'field-error';
  errorDiv.innerHTML = message;
  field.parentNode.appendChild(errorDiv);
  field.classList.add('error');
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
    errorDiv.innerHTML = message;
    group.appendChild(errorDiv);
  }
};

WebsiteGenerator.prototype.clearCheckboxError = function (field) {
  const group = field.closest('.checkbox-group');
  const errorDiv = group?.querySelector('.field-error');
  if (errorDiv) errorDiv.remove();
};

// =======================
// ✅ updatePreview Method
// =======================
WebsiteGenerator.prototype.updatePreview = function () {
  if (!this.generatedPages || this.generatedPages.length === 0) return;

  const currentPageContent = this.generatedPages[this.currentPage];
  const scrollY = window.scrollY;

  if (!this.previewFrame) {
    this.previewFrame = document.getElementById('previewFrame');
    if (!this.previewFrame) {
      console.error('❌ previewFrame not found.');
      return;
    }
  }

  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.minHeight = '600px';
  iframe.style.border = 'none';
  iframe.style.background = '#111';

  this.previewFrame.innerHTML = '';
  this.previewFrame.appendChild(iframe);

  iframe.onload = () => {
    const doc = iframe.contentDocument || iframe.contentWindow.document;

    const style = doc.createElement('style');
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
        padding: 10px 16px;
        background: #007bff;
        color: #fff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.95rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      }
    `;
    doc.head.appendChild(style);

    const panel = document.getElementById('customizationPanel');
    if (panel) panel.style.display = 'none';

    if (typeof this.initializeCustomizationPanel === 'function') {
      this.initializeCustomizationPanel();
    }
  };

  iframe.contentWindow.document.open();
  iframe.contentWindow.document.write(currentPageContent);
  iframe.contentWindow.document.close();

  this.previewFrame.classList.add('fullscreen');

  const controls = document.querySelector('.preview-controls');
  if (controls) controls.classList.add('post-gen-ui');

  this.previewFrame.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (typeof this.updatePageNavigation === 'function') {
    this.updatePageNavigation();
  }

  if (typeof this.showPostGenerationOptions === 'function') {
    this.showPostGenerationOptions();
  }

  if (typeof this.updatePageIndicator === 'function') {
    this.updatePageIndicator();
  }

  window.scrollTo({ top: scrollY, behavior: 'auto' });
};
