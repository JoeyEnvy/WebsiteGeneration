// ===========================
// WebsiteGenerator.ui.js — Vercel-ready
// ===========================

// Attach all event listeners (steps, preview controls, submit, purchase/download)
WebsiteGenerator.prototype.initializeEventListeners = function() {
  const form = document.getElementById('websiteGeneratorForm');

  // ---- Step Navigation ----
  document.getElementById('nextStep1')?.addEventListener('click', () => {
    if (this.validateStep?.('step1')) this.goToStep(2);
  });

  document.getElementById('nextStep2')?.addEventListener('click', () => {
    if (this.validateStep?.('step2')) this.goToStep(3);
  });

  document.getElementById('nextStep3')?.addEventListener('click', () => {
    if (this.validateStep?.('step3')) this.goToStep(4);
  });

  document.getElementById('nextStep4')?.addEventListener('click', () => {
    if (this.validateStep?.('step4')) this.goToStep(5);
  });

  document.getElementById('prevStep2')?.addEventListener('click', () => this.goToStep(1));
  document.getElementById('prevStep3')?.addEventListener('click', () => this.goToStep(2));
  document.getElementById('prevStep4')?.addEventListener('click', () => this.goToStep(3));

  // ---- Preview Device Controls ----
  document.querySelectorAll('.preview-controls button')?.forEach(button => {
    button.addEventListener('click', () => {
      this.changePreviewDevice?.(button.id.replace('Preview', ''));
    });
  });

  // ---- Preview Page Navigation ----
  document.getElementById('prevPage')?.addEventListener('click', () => this.changePage?.(-1));
  document.getElementById('nextPage')?.addEventListener('click', () => this.changePage?.(1));

  // ---- Form Submit ----
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    this.handleSubmit?.();
  });

  // ---- Purchase / Download (demo payment flow) ----
  const purchaseBtn = document.getElementById('purchaseBtn');
  const downloadBtn = document.getElementById('downloadSiteBtn');

  if (purchaseBtn) {
    purchaseBtn.addEventListener('click', () => {
      const confirmed = confirm("Simulated payment: Proceed to pay £X?");
      if (confirmed) {
        this.userHasPaid = true;
        purchaseBtn.style.display = 'none';
        if (downloadBtn) downloadBtn.style.display = 'inline-block';
        alert('Payment successful. You can now download your website.');
      }
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => this.downloadGeneratedSite?.());
  }
};

// ===========================
// Post-Generation Panel
// ===========================
WebsiteGenerator.prototype.showPostGenerationOptions = function() {
  const previewControls = document.querySelector('.preview-controls');
  if (!previewControls || document.getElementById('postGenActions')) return;

  const panel = document.createElement('div');
  panel.id = 'postGenActions';
  panel.className = 'post-gen-panel';
  panel.innerHTML = `
    <h3>✅ Your site is ready! What would you like to do next?</h3>
    <div class="action-buttons">
      <button class="btn btn-outline" id="editPagesBtn">🛠️ Edit Pages</button>
      <button class="btn btn-outline" id="addBrandingBtn">✏️ Add Branding</button>
      <button class="btn btn-outline" id="deploymentHelpBtn">🌍 Deployment Instructions</button>
    </div>
  `;

  previewControls.appendChild(panel);

  // ---- Edit Pages Toggle ----
  document.getElementById('editPagesBtn')?.addEventListener('click', () => {
    const customizationPanel = document.getElementById('customizationPanel');
    const brandingPanel = document.getElementById('brandingPanel');

    if (!customizationPanel || !brandingPanel) return;
    brandingPanel.style.display = 'none';

    const isHidden = (customizationPanel.style.display === 'none' || customizationPanel.style.display === '');
    customizationPanel.style.display = isHidden ? 'block' : 'none';

    const tools = customizationPanel.querySelector('.custom-tools');
    if (tools) tools.style.display = isHidden ? 'flex' : 'none';
  });

  // ---- Branding Toggle ----
  document.getElementById('addBrandingBtn')?.addEventListener('click', () => {
    const brandingPanel = document.getElementById('brandingPanel');
    const customPanel = document.getElementById('customizationPanel');

    if (customPanel) customPanel.style.display = 'none';
    if (brandingPanel) {
      brandingPanel.style.display = brandingPanel.style.display === 'none' ? 'block' : 'none';
    }
  });

  // ---- Deployment Modal ----
  const deployBtn = document.getElementById('deploymentHelpBtn');
  const deployModal = document.getElementById('deploymentModal');
  const closeDeploy = document.getElementById('closeDeploymentModal');

  if (deployBtn && deployModal && closeDeploy) {
    deployBtn.addEventListener('click', () => { deployModal.style.display = 'block'; });
    closeDeploy.addEventListener('click', () => { deployModal.style.display = 'none'; });
  }
};

// ===========================
// Customization Panel Init
// ===========================
WebsiteGenerator.prototype.initializeCustomizationPanel = function() {
  const panel = document.getElementById('customizationPanel');
  if (!panel) return;

  const tools = panel.querySelector('.custom-tools');
  if (tools) tools.style.display = 'flex';

  // Add any additional setup for editor tools here
};
