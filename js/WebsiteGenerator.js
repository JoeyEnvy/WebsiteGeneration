// ===========================
// WebsiteGenerator.js
// ===========================

const API_BASE = "https://website-generation.vercel.app/api";

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
      } catch (e) {
        console.warn('⚠️ Could not parse saved pages from localStorage');
      }
    }

    // Only deployment buttons are bound here
    this.initializeDeploymentButtons();
  }

  // ===========================
  // Step Navigation
  // ===========================
  goToStep(stepNumber) {
    document.querySelectorAll('.form-step').forEach(step => {
      step.style.display = 'none';
    });

    const target = document.getElementById(`step${stepNumber}`);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.step').forEach(indicator => {
      indicator.classList.remove('active');
    });
    const active = document.getElementById(`indicator-step${stepNumber}`);
    if (active) active.classList.add('active');

    this.currentStep = stepNumber;
  }

  // ===========================
  // Form Submission
  // ===========================
  handleSubmit() {
    const formData = new FormData(this.form);
    const data = Object.fromEntries(formData.entries());

    if (data.businessName) {
      localStorage.setItem('businessName', data.businessName);
    }

    data.pages = formData.getAll('pages');
    data.features = formData.getAll('features');
    data.enhancements = formData.getAll('enhancements');

    console.log('🚀 Submitting generator form:', data);

    this.generatedPages = [
      `<html><body><h1>${data.businessName || 'My Website'}</h1><p>Home Page</p></body></html>`,
      `<html><body><h1>About ${data.businessName || 'Us'}</h1><p>About Page</p></body></html>`
    ];

    localStorage.setItem('generatedPages', JSON.stringify(this.generatedPages));

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
      this.previewFrame.innerHTML = `<div class="preview-placeholder">No preview available yet.</div>`;
      return;
    }

    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '500px';
    iframe.style.border = '1px solid #ccc';

    this.previewFrame.innerHTML = '';
    this.previewFrame.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(this.generatedPages[this.currentPage] || '<h1>Page not found</h1>');
    doc.close();

    const indicator = document.getElementById('pageIndicator');
    if (indicator) {
      indicator.textContent = `Page ${this.currentPage + 1} of ${this.generatedPages.length}`;
    }
  }

  // ===========================
  // Preview Navigation
  // ===========================
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

    const iframe = this.previewFrame?.querySelector('iframe');
    if (iframe) {
      iframe.style.width = sizes[device];
    }

    document.querySelectorAll('.preview-controls button').forEach(button => {
      button.classList.toggle('active', button.id === `${device}Preview`);
    });
  }

  // ===========================
  // Download as ZIP
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
      saveAs(blob, 'my-website.zip');
    });
  }

  // ===========================
  // Deployment Buttons
  // ===========================
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

      fetch(`${API_BASE}/stripe/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'netlify-hosted',
          sessionId,
          businessName
        })
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

  // ===========================
  // Stripe Checkout
  // ===========================
  startStripeCheckout(type) {
    const businessName = localStorage.getItem('businessName') || 'Website';
    let sessionId = localStorage.getItem('sessionId');

    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('sessionId', sessionId);
    }

    fetch(`${API_BASE}/stripe/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        sessionId,
        businessName
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.url) {
          window.location.href = data.url;
        } else {
          alert('⚠️ Failed to create checkout session.');
          console.error(data);
        }
      })
      .catch(err => {
        alert('❌ Error creating Stripe session.');
        console.error('Stripe error:', err);
      });
  }
}

window.WebsiteGenerator = WebsiteGenerator;
