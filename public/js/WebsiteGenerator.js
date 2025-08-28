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
    this.highlightStep(this.currentStep);
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

      fetch('https://websitegeneration.onrender.com/stripe/create-checkout-session', {
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
    if (iframe) {
      iframe.style.width = sizes[device];
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

