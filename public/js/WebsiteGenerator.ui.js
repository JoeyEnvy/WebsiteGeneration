/* =========================================================
   WebsiteGenerator.ui.js
   Binds all UI interactions (buttons, modals, preview controls)
   ========================================================= */

(function () {
  // Small utility to guard double-clicks on async actions
  function setBusy(btn, on, labelIdle, labelBusy) {
    if (!btn) return;
    if (on) {
      btn.dataset.busy = '1';
      btn.disabled = true;
      if (labelBusy) btn.textContent = labelBusy;
    } else {
      btn.dataset.busy = '0';
      btn.disabled = false;
      if (labelIdle) btn.textContent = labelIdle;
    }
  }

  // Attach to WebsiteGenerator prototype
  if (typeof WebsiteGenerator === 'undefined') {
    console.error('❌ WebsiteGenerator class not found before ui.js loaded.');
    return;
  }

  // =======================
  // ✅ initializeEventListeners (FINAL)
  // =======================
  WebsiteGenerator.prototype.initializeEventListeners = function () {
    // Prevent double-binding
    if (this._uiBound) {
      console.warn('⚠️ initializeEventListeners() already ran — skipping rebind.');
      return;
    }
    this._uiBound = true;

    // Cache form reference
    this.form = this.form || document.getElementById('websiteGeneratorForm');
    if (!this.form) {
      console.error('❌ #websiteGeneratorForm not found at init');
    }

    // ---------- STEP BUTTONS ----------
    const stepButtons = [
      { id: 'nextStep1', step: 'step1', goTo: 2 },
      { id: 'nextStep2', step: 'step2', goTo: 3 },
      { id: 'nextStep3', step: 'step3', goTo: 4 },
      { id: 'nextStep4', step: 'step4', goTo: 5 }, // async generate, then move
      { id: 'prevStep2', goTo: 1 },
      { id: 'prevStep3', goTo: 2 },
      { id: 'prevStep4', goTo: 3 }
    ];

    stepButtons.forEach(({ id, step, goTo }) => {
      const btn = document.getElementById(id);
      if (!btn) {
        console.warn(`⚠️ Button with id "${id}" not found in DOM.`);
        return;
      }

      btn.addEventListener('click', async () => {
        console.log(`🟦 Clicked: ${id} → Requested goToStep(${goTo})`);

        // Validate the current step if provided
        const isValid = step ? (this.validateStep?.(step) !== false) : true;
        if (!isValid) {
          console.warn(`❌ Validation failed for ${step}. Staying on current step.`);
          return;
        }

        // Step 4: Generate site, then navigate
        if (id === 'nextStep4' && typeof this.handleSubmit === 'function') {
          // double-click guard
          if (btn.dataset.busy === '1') {
            console.log('⏳ Already generating… ignoring extra click');
            return;
          }

          try {
            setBusy(btn, true, 'Generate Website', 'Generating…');
            this.showLoading?.();
            console.log('🚀 Step 4: starting handleSubmit()…');
            await this.handleSubmit(); // wait for /generate to finish
            console.log('✅ Generation finished, moving to Step 5');
            this.goToStep?.(goTo);
          } catch (err) {
            console.error('❌ Generation failed:', err);
            alert('Generation failed. Please try again.');
          } finally {
            this.hideLoading?.();
            setBusy(btn, false, 'Generate Website');
          }
          return; // do not run generic navigation
        }

        // Generic navigation for other next/prev buttons
        this.goToStep?.(goTo);
        console.log(`✅ Navigated to step ${goTo}`);
      });
    });

    // ---------- PREVIEW DEVICE BUTTONS ----------
    const previewButtons = document.querySelectorAll('.preview-controls button');
    previewButtons.forEach(button => {
      button.addEventListener('click', () => {
        const device = button.id.replace('Preview', '');
        console.log(`🖥️ Switching preview device to: ${device}`);
        this.changePreviewDevice?.(device);
      });
    });

    // ---------- PAGE NAVIGATION (Preview) ----------
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');

    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', () => {
        console.log('⬅️ Previous Page clicked');
        this.changePage?.(-1);
      });
    }
    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', () => {
        console.log('➡️ Next Page clicked');
        this.changePage?.(1);
      });
    }

    // ---------- PREVENT NATIVE FORM SUBMIT ----------
    if (this.form) {
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('📝 Form submit prevented; use step buttons.');
      });
    } else {
      console.warn('⚠️ Form element not found.');
    }

    // ---------- CONTACT FORM CHECKBOX TOGGLE ----------
    // Makes contactEmail required + visible only when "contact form" feature is checked
    const contactCheckbox = document.getElementById('contactFormCheckbox');
    const contactEmail = document.getElementById('contactEmail');
    const contactContainer = document.getElementById('contactEmailContainer');

    if (contactCheckbox && contactEmail && contactContainer) {
      contactCheckbox.addEventListener('change', () => {
        if (contactCheckbox.checked) {
          contactContainer.style.display = 'block';
          contactEmail.setAttribute('required', 'required');
        } else {
          contactContainer.style.display = 'none';
          contactEmail.removeAttribute('required');
          contactEmail.value = '';
        }
        console.log(`📮 Contact form toggled: ${contactCheckbox.checked ? 'ON' : 'OFF'}`);
      });
    }

    // ---------- SIMULATED PURCHASE + DOWNLOAD ----------
    const purchaseBtn = document.getElementById('purchaseBtn');
    const downloadBtn = document.getElementById('downloadSiteBtn');

    if (purchaseBtn) {
      purchaseBtn.addEventListener('click', () => {
        const confirmed = confirm('Simulated payment: Proceed to pay £X?');
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
        this.downloadGeneratedSite?.();
      });
    }

    // ---------- MODALS: Close buttons ----------
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

    // ---------- POST-GENERATION OPTIONS (hook up) ----------
    // These buttons are inside the "postGenerationModal"
    const postGenModal = document.getElementById('postGenerationModal');
    if (postGenModal) {
      const customizationModal = document.getElementById('customizationModal');
      const brandingModal = document.getElementById('brandingModal');
      const deploymentModal = document.getElementById('deploymentModal');

      // Buttons are often controlled by onclick in HTML; also bind here defensively
      const customizeBtn = postGenModal.querySelector('[data-open="customizationModal"]');
      const brandingBtn = postGenModal.querySelector('[data-open="brandingModal"]');
      const deployBtn = postGenModal.querySelector('[data-open="deploymentModal"]');

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
    }

    // ---------- DEBUG: Step 4 visibility ----------
    const step4 = document.getElementById('step4');
    console[step4 ? 'log' : 'error'](
      step4 ? '✅ Step 4 detected in DOM' : '❌ Step 4 (#step4) NOT found in the DOM.'
    );

    console.log('✅ UI bound successfully.');
  };

  // =======================
  // (Optional) UI helpers you may want to call elsewhere
  // =======================
  WebsiteGenerator.prototype.showPostGenerationOptions = function () {
    const modal = document.getElementById('postGenerationModal');
    if (!modal) return;
    modal.style.display = 'flex';
  };

  WebsiteGenerator.prototype.initializeCustomizationPanel = function () {
    const panel = document.getElementById('customizationModal');
    if (!panel) return;
    const tools = panel.querySelector('.custom-tools');
    if (tools) {
      console.log('🔧 Customization panel tools displayed');
      tools.style.display = 'flex';
    }
  };
})();

