WebsiteGenerator.prototype.initializeEventListeners = function () {
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

  // General modal close behavior
  document.querySelectorAll('.modal .close')?.forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) modal.style.display = 'none';
    });
  });
};
WebsiteGenerator.prototype.showPostGenerationOptions = function () {
  const modal = document.getElementById('postGenerationModal');
  if (!modal) return;

  modal.style.display = 'flex';

  const customizationModal = document.getElementById('customizationModal');
  const brandingModal = document.getElementById('brandingModal');
  const deploymentModal = document.getElementById('deploymentModal');

  // Button triggers inside modal
  const customizeBtn = modal.querySelector('button[onclick*="customizationModal"]');
  const brandingBtn = modal.querySelector('button[onclick*="brandingModal"]');
  const deployBtn = modal.querySelector('button[onclick*="deploymentModal"]');

  customizeBtn?.addEventListener('click', () => {
    if (customizationModal) customizationModal.style.display = 'flex';
  });

  brandingBtn?.addEventListener('click', () => {
    if (brandingModal) brandingModal.style.display = 'flex';
  });

  deployBtn?.addEventListener('click', () => {
    if (deploymentModal) deploymentModal.style.display = 'flex';
  });
};
WebsiteGenerator.prototype.initializeCustomizationPanel = function () {
  const panel = document.getElementById('customizationModal');
  if (!panel) return;

  const tools = panel.querySelector('.custom-tools');
  if (tools) tools.style.display = 'flex';
};


