WebsiteGenerator.prototype.updatePreview = function () {
  if (!Array.isArray(this.generatedPages) || this.generatedPages.length === 0) {
    console.error('❌ No generatedPages available.');
    return;
  }

  if (
    typeof this.currentPage !== 'number' ||
    this.currentPage < 0 ||
    this.currentPage >= this.generatedPages.length
  ) {
    console.error('❌ currentPage index is out of bounds:', this.currentPage);
    return;
  }

  const currentPage = this.generatedPages[this.currentPage];
  const currentPageContent =
    typeof currentPage === 'object' && currentPage?.content
      ? currentPage.content
      : (typeof currentPage === 'string' ? currentPage : '');

  if (!currentPageContent || currentPageContent.length < 30) {
    console.warn('⚠️ Empty or invalid page content at index', this.currentPage, currentPageContent);
  }

  if (!this.previewFrame) {
    this.previewFrame = document.getElementById('previewFrame');
    if (!this.previewFrame) {
      console.error('❌ previewFrame element not found in DOM.');
      return;
    }
  }

  this.previewFrame.innerHTML = '';

  const isFallbackError =
    typeof currentPageContent === 'string' &&
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

  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.minHeight = '600px';
  iframe.style.border = 'none';
  iframe.style.background = '#111';
  this.previewFrame.appendChild(iframe);

  iframe.onload = () => {
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      console.error('❌ Failed to access iframe document.');
      return;
    }

    const isHtmlValid =
      typeof currentPageContent === 'string' &&
      currentPageContent.trim().startsWith('<html') &&
      currentPageContent.trim().endsWith('</html>') &&
      currentPageContent.includes('<body');

    if (isHtmlValid) {
      doc.open();
      doc.write(currentPageContent);
      doc.close();
    } else {
      console.warn('⚠️ Invalid or incomplete HTML detected. Injecting fallback preview page.');
      doc.open();
      doc.write(`
        <html>
          <head><title>Preview Error</title></head>
          <body style="background: #111; color: red; font-family: sans-serif; padding: 2rem;">
            <h1>⚠️ Failed to load preview</h1>
            <p>The generated HTML was invalid or incomplete.</p>
          </body>
        </html>
      `);
      doc.close();
    }

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

  this.previewFrame.classList.add('fullscreen');

  const controls = document.querySelector('.preview-controls');
  if (controls) controls.classList.add('post-gen-ui');

  this.previewFrame.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (typeof this.updatePageNavigation === 'function') this.updatePageNavigation();
  if (typeof this.showPostGenerationOptions === 'function') this.showPostGenerationOptions();
  if (typeof this.updatePageIndicator === 'function') this.updatePageIndicator();
};
