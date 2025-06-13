WebsiteGenerator.prototype.updatePreview = function() {
  if (this.generatedPages.length === 0) return;

  const currentPageContent = this.generatedPages[this.currentPage];
  const scrollY = window.scrollY;

  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = '500px';
  iframe.style.border = 'none';

  this.previewFrame.innerHTML = '';
  this.previewFrame.appendChild(iframe);

  iframe.contentWindow.document.open();
  iframe.contentWindow.document.write(currentPageContent);
  iframe.contentWindow.document.close();

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
        padding: 10px;
        background: #007bff;
        color: #fff;
        border: none;
        border-radius: 5px;
        cursor: pointer;
      }
    `;
    doc.head.appendChild(style);

    const panel = document.getElementById('customizationPanel');
    if (panel) panel.style.display = 'none';
    this.initializeCustomizationPanel();
  };

  window.scrollTo({ top: scrollY, behavior: 'auto' });
  this.updatePageNavigation();
  this.showPostGenerationOptions();
};

WebsiteGenerator.prototype.updatePageNavigation = function() {
  const prevButton = document.getElementById('prevPage');
  const nextButton = document.getElementById('nextPage');
  const pageIndicator = document.getElementById('pageIndicator');

  prevButton.disabled = this.currentPage === 0;
  nextButton.disabled = this.currentPage === this.generatedPages.length - 1;
  pageIndicator.textContent = `Page ${this.currentPage + 1} of ${this.generatedPages.length}`;
};
