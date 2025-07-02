WebsiteGenerator.prototype.updatePreview = function () {
  if (this.generatedPages.length === 0) return;

  const currentPageContent = this.generatedPages[this.currentPage];
  const scrollY = window.scrollY;

  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.minHeight = '600px';
  iframe.style.border = 'none';
  iframe.style.background = '#111';

  // Clear preview container and append iframe
  this.previewFrame.innerHTML = '';
  this.previewFrame.appendChild(iframe);

  // Write content to iframe
  iframe.contentWindow.document.open();
  iframe.contentWindow.document.write(currentPageContent);
  iframe.contentWindow.document.close();

  iframe.onload = () => {
    const doc = iframe.contentDocument || iframe.contentWindow.document;

    // Inject dynamic styles into preview content
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

    // Hide customization panel if visible
    const panel = document.getElementById('customizationPanel');
    if (panel) panel.style.display = 'none';

    this.initializeCustomizationPanel();
  };

  // Apply fullscreen styling to preview container
  this.previewFrame.classList.add('fullscreen');

  // Boost button styling (applied via CSS modifier class)
  const controls = document.querySelector('.preview-controls');
  if (controls) controls.classList.add('post-gen-ui');

  // Scroll to preview smoothly
  this.previewFrame.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Update page navigation and show action buttons
  this.updatePageNavigation();
  this.showPostGenerationOptions();
};
