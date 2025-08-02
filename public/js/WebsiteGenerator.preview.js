// =======================
// ✅ Preview Functions
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

