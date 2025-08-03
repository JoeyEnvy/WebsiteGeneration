// =======================
// ✅ initializeEventListeners
// =======================
WebsiteGenerator.prototype.initializeEventListeners = function () {
  // ===== Step Button Logic with Full Logging =====
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
        console.log(`🟦 Clicked: ${id} → Requested goToStep(${goTo})`);
        if (!step || this.validateStep(step)) {
          console.log(`✅ Validation passed for ${step} → Navigating to step ${goTo}`);
          this.goToStep(goTo);

          // ✅ Trigger generation after step 4
          if (id === 'nextStep4' && typeof this.handleSubmit === 'function') {
            console.log('🚀 Triggering handleSubmit() after Step 4...');
            this.handleSubmit();
          }
        } else {
          console.warn(`❌ Validation failed for ${step}. Staying on current step.`);
        }
      });
    } else {
      console.warn(`⚠️ Button with id "${id}" not found in DOM.`);
    }
  });

  // ===== Preview Device Buttons =====
  const previewButtons = document.querySelectorAll('.preview-controls button');
  previewButtons.forEach(button => {
    button.addEventListener('click', () => {
      const device = button.id.replace('Preview', '');
      console.log(`🖥️ Switching preview device to: ${device}`);
      this.changePreviewDevice(device);
    });
  });

  // ===== Page Navigation Buttons =====
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      console.log('⬅️ Previous Page clicked');
      this.changePage(-1);
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      console.log('➡️ Next Page clicked');
      this.changePage(1);
    });
  }

  // ===== Form Submission (not used directly, kept as fallback) =====
  if (this.form) {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      console.log('📝 Form submitted');
      if (typeof this.handleSubmit === 'function') {
        this.handleSubmit();
      } else {
        console.warn('❌ this.handleSubmit is not a function');
      }
    });
  } else {
    console.warn('⚠️ Form element not found.');
  }

  // ===== Simulated Purchase + Download Button =====
  const purchaseBtn = document.getElementById('purchaseBtn');
  const downloadBtn = document.getElementById('downloadSiteBtn');

  if (purchaseBtn) {
    purchaseBtn.addEventListener('click', () => {
      const confirmed = confirm("Simulated payment: Proceed to pay £X?");
      if (confirmed) {
        this.userHasPaid = true;
        purchaseBtn.style.display = 'none';
        if (downloadBtn) downloadBtn.style.display = 'inline-block';
        alert('✅ Payment successful. You can now download your website.');
      }
    });
  }

  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      console.log('⬇️ Download Site button clicked');
      this.downloadGeneratedSite();
    });
  }

  // ===== Modal Close Buttons =====
  const modalCloseButtons = document.querySelectorAll('.modal .close');
  modalCloseButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) {
        console.log(`❌ Closing modal: ${modal.id}`);
        modal.style.display = 'none';
      }
    });
  });

  // ===== DEBUG: Step 4 Visibility Check =====
  const step4 = document.getElementById('step4');
  if (step4) {
    console.log('✅ Step 4 detected in DOM');
  } else {
    console.error('❌ Step 4 (#step4) NOT found in the DOM.');
  }
};

// =======================
// ✅ goToStep with Debug Tracing
// =======================
WebsiteGenerator.prototype.goToStep = function (stepNumber) {
  const allSteps = document.querySelectorAll('.form-step');
  console.log(`➡️ goToStep(${stepNumber})`);

  allSteps.forEach((step, index) => {
    const show = index + 1 === stepNumber;
    step.style.display = show ? 'block' : 'none';
    console.log(`   Step ${index + 1} (${step.id}): ${show ? 'SHOW' : 'HIDE'}`);
  });

  const visible = Array.from(document.querySelectorAll('.form-step'))
    .filter(el => window.getComputedStyle(el).display !== 'none')
    .map(el => el.id);
  console.log('👀 Currently visible step(s):', visible);
};

// =======================
// ✅ showPostGenerationOptions
// =======================
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
      console.log('🎨 Opening customization modal');
      customizationModal.style.display = 'flex';
    });
  }

  if (brandingBtn && brandingModal) {
    brandingBtn.addEventListener('click', () => {
      console.log('🖊️ Opening branding modal');
      brandingModal.style.display = 'flex';
    });
  }

  if (deployBtn && deploymentModal) {
    deployBtn.addEventListener('click', () => {
      console.log('🌍 Opening deployment modal');
      deploymentModal.style.display = 'flex';
    });
  }
};

// =======================
// ✅ initializeCustomizationPanel
// =======================
WebsiteGenerator.prototype.initializeCustomizationPanel = function () {
  const panel = document.getElementById('customizationModal');
  if (!panel) return;

  const tools = panel.querySelector('.custom-tools');
  if (tools) {
    console.log('🔧 Customization panel tools displayed');
    tools.style.display = 'flex';
  }
};

