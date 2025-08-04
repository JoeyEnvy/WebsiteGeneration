// =======================
// ✅ updatePreview (with fallback + iframe injection)
// =======================
WebsiteGenerator.prototype.updatePreview = function () {
  if (!this.generatedPages || this.generatedPages.length === 0) {
    console.error('❌ No generatedPages available.');
    return;
  }

  const currentPage = this.generatedPages[this.currentPage];
  const currentPageContent = typeof currentPage === 'object' && currentPage.content
    ? currentPage.content
    : currentPage;

  const scrollY = window.scrollY;

  if (!this.previewFrame) {
    this.previewFrame = document.getElementById('previewFrame');
    if (!this.previewFrame) {
      console.error('❌ previewFrame not found.');
      return;
    }
  }

  this.previewFrame.innerHTML = '';

  // ✅ Detect fallback error page
  const isFallbackError = typeof currentPageContent === 'string' &&
    currentPageContent.includes('failed to generate') &&
    currentPageContent.toLowerCase().includes('try simplifying');

  if (isFallbackError) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'preview-placeholder error';
    errorDiv.style.padding = '40px';
    errorDiv.style.textAlign = 'center';
    errorDiv.style.color = 'white';
    errorDiv.style.background = '#1a1a1a';
    errorDiv.innerHTML = `
      <h2>❌ Website generation failed</h2>
      <p>Please try again with a simpler description or fewer features selected.</p>
    `;
    this.previewFrame.appendChild(errorDiv);
    return;
  }

  // ✅ Create and inject iframe
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.minHeight = '600px';
  iframe.style.border = 'none';
  iframe.style.background = '#111';
  this.previewFrame.appendChild(iframe);

  iframe.onload = () => {
    const doc = iframe.contentDocument || iframe.contentWindow.document;

    console.log('📄 Injecting into iframe:', { currentPageContent });

    if (typeof currentPageContent === 'string' && currentPageContent.includes('<html')) {
      doc.open();
      doc.write(currentPageContent);
      doc.close();
    } else {
      console.warn('⚠️ Invalid or empty page content:', currentPageContent);
      doc.open();
      doc.write(`
        <html>
          <body style="background: #111; color: red; font-family: sans-serif; padding: 2rem;">
            <h1>⚠️ Failed to load generated page preview.</h1>
          </body>
        </html>
      `);
      doc.close();
    }

    // ✅ Inject local styles
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

    // ✅ Hide customization panel
    const panel = document.getElementById('customizationPanel');
    if (panel) panel.style.display = 'none';

    // ✅ Init customization logic
    if (typeof this.initializeCustomizationPanel === 'function') {
      this.initializeCustomizationPanel();
    }
  };

  // ✅ Preview container styling and scrolling
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

// =======================
// ✅ updatePageNavigation
// =======================
WebsiteGenerator.prototype.updatePageNavigation = function () {
  const prevBtn = document.getElementById('prevPage');
  const nextBtn = document.getElementById('nextPage');

  if (!prevBtn || !nextBtn || !Array.isArray(this.generatedPages)) return;

  prevBtn.disabled = this.currentPage === 0;
  nextBtn.disabled = this.currentPage >= this.generatedPages.length - 1;

  prevBtn.onclick = () => {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.updatePreview();
    }
  };

  nextBtn.onclick = () => {
    if (this.currentPage < this.generatedPages.length - 1) {
      this.currentPage++;
      this.updatePreview();
    }
  };
};

// =======================
// ✅ updatePageIndicator
// =======================
WebsiteGenerator.prototype.updatePageIndicator = function () {
  const indicator = document.getElementById('pageIndicator');
  if (!indicator || !Array.isArray(this.generatedPages)) return;

  const total = this.generatedPages.length;
  const current = this.currentPage + 1;
  indicator.textContent = `Page ${current} of ${total}`;
};

