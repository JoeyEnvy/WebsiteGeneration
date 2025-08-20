WebsiteGenerator.prototype.initializeEventListeners = function() {
  const nextStep4Btn = document.getElementById('nextStep4');
  if (nextStep4Btn) {
    nextStep4Btn.addEventListener('click', () => {
      if (this.validateStep('step4')) this.goToStep(5);
    });
  }

  document.getElementById('nextStep1')?.addEventListener('click', () => {
    if (this.validateStep('step1')) this.goToStep(2);
  });

  document.getElementById('nextStep2')?.addEventListener('click', () => {
    if (this.validateStep('step2')) this.goToStep(3);
  });

  document.getElementById('nextStep3')?.addEventListener('click', () => {
    if (this.validateStep('step3')) this.goToStep(4);
  });

  document.getElementById('prevStep2')?.addEventListener('click', () => this.goToStep(1));
  document.getElementById('prevStep3')?.addEventListener('click', () => this.goToStep(2));
  document.getElementById('prevStep4')?.addEventListener('click', () => this.goToStep(3));

  document.querySelectorAll('.preview-controls button')?.forEach(button => {
    button.addEventListener('click', () => {
      this.changePreviewDevice(button.id.replace('Preview', ''));
    });
  });

  document.getElementById('prevPage')?.addEventListener('click', () => this.changePage(-1));
  document.getElementById('nextPage')?.addEventListener('click', () => this.changePage(1));

  this.form?.addEventListener('submit', (e) => {
    e.preventDefault();
    this.handleSubmit();
  });

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
    downloadBtn.addEventListener('click', () => this.downloadGeneratedSite());
  }
};

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

  const editBtn = document.getElementById('editPagesBtn');
  if (editBtn) {
    editBtn.addEventListener('click', () => {
      const customizationPanel = document.getElementById('customizationPanel');
      const brandingPanel = document.getElementById('brandingPanel');

      if (!customizationPanel || !brandingPanel) return;

      brandingPanel.style.display = 'none';

      const isHidden = (customizationPanel.style.display === 'none' || customizationPanel.style.display === '');
      customizationPanel.style.display = isHidden ? 'block' : 'none';

      const tools = customizationPanel.querySelector('.custom-tools');
      if (tools) tools.style.display = isHidden ? 'flex' : 'none';
    });
  }

  document.getElementById('addBrandingBtn')?.addEventListener('click', () => {
    const panel = document.getElementById('brandingPanel');
    const customPanel = document.getElementById('customizationPanel');

    if (customPanel) customPanel.style.display = 'none';
    if (panel) {
      panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    }
  });

  const deployBtn = document.getElementById('deploymentHelpBtn');
  const deployModal = document.getElementById('deploymentModal');
  const closeDeploy = document.getElementById('closeDeploymentModal');

  if (deployBtn && deployModal && closeDeploy) {
    deployBtn.addEventListener('click', () => {
      deployModal.style.display = 'block';
    });

    closeDeploy.addEventListener('click', () => {
      deployModal.style.display = 'none';
    });
  }
};


WebsiteGenerator.prototype.initializeCustomizationPanel = function() {
  const panel = document.getElementById('customizationPanel');
  if (!panel) return;

  const tools = panel.querySelector('.custom-tools');
  if (tools) tools.style.display = 'flex';

  // Optionally add any default state setup here
};
