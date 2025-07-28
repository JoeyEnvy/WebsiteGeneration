WebsiteGenerator.prototype.initializeEventListeners = function () {
  // ===== Step Button Logic =====
  const stepButtons = [
    { id: 'nextStep1', step: 'step1', goTo: 2 },
    { id: 'nextStep2', step: 'step2', goTo: 3 },
    { id: 'nextStep3', step: 'step3', goTo: 4 },
    { id: 'nextStep4', step: 'step4', goTo: 5 },
    { id: 'prevStep2', goTo: 1 },
    { id: 'prevStep3', goTo: 2 },
    { id: 'prevStep4', goTo: 3 }
  ];

  stepButtons.forEach(({ id, step, goTo }) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.addEventListener('click', () => {
        if (!step || this.validateStep(step)) this.goToStep(goTo);
      });
    }
  });

  // ===== Preview Device Buttons =====
  const previewButtons = document.querySelectorAll('.preview-controls button');
  previewButtons.forEach(button => {
    button.addEventListener('click', () => {
      this.changePreviewDevice(button.id.replace('Preview', ''));
    });
  });

  // ===== Page Navigation =====
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => this.changePage(-1));
  }
  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => this.changePage(1));
  }

  // ===== Form Submission =====
  if (this.form) {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
  }

  // ===== Purchase + Download Buttons =====
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

  // ===== Modal Close Logic =====
  const modalCloseButtons = document.querySelectorAll('.modal .close');
  modalCloseButtons.forEach(btn => {
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

  const customizeBtn = modal.querySelector('button[onclick*="customizationModal"]');
  const brandingBtn = modal.querySelector('button[onclick*="brandingModal"]');
  const deployBtn = modal.querySelector('button[onclick*="deploymentModal"]');

  if (customizeBtn && customizationModal) {
    customizeBtn.addEventListener('click', () => {
      customizationModal.style.display = 'flex';
    });
  }

  if (brandingBtn && brandingModal) {
    brandingBtn.addEventListener('click', () => {
      brandingModal.style.display = 'flex';
    });
  }

  if (deployBtn && deploymentModal) {
    deployBtn.addEventListener('click', () => {
      deploymentModal.style.display = 'flex';
    });
  }
};

WebsiteGenerator.prototype.initializeCustomizationPanel = function () {
  const panel = document.getElementById('customizationModal');
  if (!panel) return;

  const tools = panel.querySelector('.custom-tools');
  if (tools) tools.style.display = 'flex';
};


