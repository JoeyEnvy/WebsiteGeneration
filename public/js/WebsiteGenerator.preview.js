/* =========================================================
   WebsiteGenerator.preview.js
   Handles injecting generated HTML into the live preview
   ========================================================= */

WebsiteGenerator.prototype.updatePreview = function () {
  // --- Guards ---
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

  // --- Debugging ---
  console.log('🧪 updatePreview() called');
  console.log('🧪 this.currentPage:', this.currentPage);
  console.log('🧪 this.generatedPages:', this.generatedPages);

  const currentPage = this.generatedPages[this.currentPage];
  const currentPageContent =
    typeof currentPage === 'object' && currentPage?.content
      ? currentPage.content
      : (typeof currentPage === 'string' ? currentPage : '');

  if (!currentPageContent || currentPageContent.length < 30) {
    console.warn('⚠️ Empty or very short page content at index', this.currentPage);
  }

  // --- Find preview container ---
  if (!this.previewFrame) {
    this.previewFrame = document.getElementById('previewFrame');
  }
  if (!this.previewFrame) {
    console.error('❌ previewFrame element not found in DOM.');
    return;
  }

  // Clear placeholder
  const placeholder = document.getElementById('previewPlaceholder');
  if (placeholder) placeholder.style.display = 'none';

  // --- Inject content into iframe ---
  const iframe = this.previewFrame;
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

  doc.open();
  if (isHtmlValid) {
    doc.write(currentPageContent);
  } else {
    console.warn('⚠️ Invalid or incomplete HTML detected. Injecting fallback preview page.');
    doc.write(`
      <html>
        <head><title>Preview Error</title></head>
        <body style="background: #111; color: red; font-family: sans-serif; padding: 2rem;">
          <h1>⚠️ Failed to load preview</h1>
          <p>The generated HTML was invalid or incomplete.</p>
          <pre style="white-space: pre-wrap; font-size: 0.8rem; margin-top: 1rem; color: #aaa;">
${currentPageContent.replace(/</g, '&lt;')}
          </pre>
        </body>
      </html>
    `);
  }
  doc.close();

  // --- Inject extra styling into iframe ---
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

  // --- UI Hooks after generation ---
  const controls = document.querySelector('.preview-controls');
  if (controls) controls.classList.add('post-gen-ui');

  // Scroll into view
  this.previewFrame.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Run optional hooks if present
  if (typeof this.updatePageNavigation === 'function') this.updatePageNavigation();
  if (typeof this.showPostGenerationOptions === 'function') this.showPostGenerationOptions();
  if (typeof this.updatePageIndicator === 'function') this.updatePageIndicator();

  console.log('✅ Preview updated successfully.');
};

/* =========================================================
   Helpers (Page Navigation, Indicator)
   ========================================================= */

WebsiteGenerator.prototype.updatePageNavigation = function () {
  const indicator = document.getElementById('pageIndicator');
  if (!indicator) return;

  const total = this.generatedPages?.length || 0;
  const current = (this.currentPage || 0) + 1;
  indicator.textContent = `Page ${current} of ${total}`;
};

WebsiteGenerator.prototype.changePage = function (direction) {
  if (!Array.isArray(this.generatedPages) || this.generatedPages.length === 0) return;
  this.currentPage = Math.max(
    0,
    Math.min(this.currentPage + direction, this.generatedPages.length - 1)
  );
  console.log(`📄 Changed to page index ${this.currentPage}`);
  this.updatePreview();
};

