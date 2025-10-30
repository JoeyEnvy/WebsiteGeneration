// ===========================
// webgen.preview.js — Vercel-ready
// ===========================

WebsiteGenerator.prototype.updatePreview = function () {
  if (!this.generatedPages || this.generatedPages.length === 0) return;

  const currentPageContent = this.generatedPages[this.currentPage];
  const scrollY = window.scrollY;

  // Ensure previewFrame exists
  if (!this.previewFrame) {
    this.previewFrame = document.getElementById('previewFrame');
    if (!this.previewFrame) {
      console.error('❌ previewFrame not found.');
      return;
    }
  }

  // Create and style the iframe
  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.minHeight = '600px';
  iframe.style.border = 'none';
  iframe.style.background = '#111';

  // Clear existing preview and insert iframe
  this.previewFrame.innerHTML = '';
  this.previewFrame.appendChild(iframe);

  // Inject content into iframe
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

    // Hide customization panel
    const panel = document.getElementById('customizationPanel');
    if (panel) panel.style.display = 'none';

    if (typeof this.initializeCustomizationPanel === 'function') {
      this.initializeCustomizationPanel();
    }
  };

  // Write HTML content into the iframe
  iframe.contentWindow.document.open();
  iframe.contentWindow.document.write(currentPageContent);
  iframe.contentWindow.document.close();

  // Apply full-width styling to preview
  this.previewFrame.classList.add('fullscreen');

  // Highlight control buttons visually
  const controls = document.querySelector('.preview-controls');
  if (controls) controls.classList.add('post-gen-ui');

  // Scroll preview into view
  this.previewFrame.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // ✅ Safe calls
  if (typeof this.updatePageNavigation === 'function') {
    this.updatePageNavigation();
  }

  if (typeof this.showPostGenerationOptions === 'function') {
    this.showPostGenerationOptions();
  }

  // Restore scroll position
  window.scrollTo({ top: scrollY, behavior: 'auto' });
};
