// init.js (ESM single entry)

import './core.js';
import './WebsiteGenerator.js';
import './WebsiteGenerator.helpers.js';
import './WebsiteGenerator.validation.js';
import './WebsiteGenerator.preview.js';
import './WebsiteGenerator.prompt.js';
import './WebsiteGenerator.navigation.js';
import './utils/normalizePages.js';
import './WebsiteGenerator.submit.js';
import './WebsiteGenerator.ui.js';
import './domainChecker.js';
import './deployFullHosting.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM ready');

  // Show Step 1, hide others (CSS safety)
  document.querySelectorAll('#websiteGeneratorForm > .form-step')
    .forEach((el, i) => el.style.display = i === 0 ? 'block' : 'none');

  // Hide customization panel on load
  const customizationPanel = document.getElementById('customizationPanel');
  if (customizationPanel) {
    customizationPanel.style.display = 'none';
    const tools = customizationPanel.querySelector('.custom-tools');
    if (tools) tools.style.display = 'none';
  }

  // Domain checker (safe)
  try {
    if (typeof setupDomainChecker === 'function') setupDomainChecker();
  } catch (e) {
    console.warn('Domain checker init skipped:', e);
  }

  // Create the generator instance and bind UI
  const form = document.getElementById('websiteGeneratorForm');
  if (!form) return console.error('❌ websiteGeneratorForm not found in DOM');

  // WebsiteGenerator must be attached to window in WebsiteGenerator.js
  if (!window.WebsiteGenerator) {
    console.error('❌ WebsiteGenerator class not found on window');
    return;
  }

  window.generator = new window.WebsiteGenerator(form);
  console.log('🧠 WebsiteGenerator instance created');

  // Ensure UI events are bound once
  if (typeof generator.initializeEventListeners === 'function') {
    generator.initializeEventListeners();
    console.log('🔗 UI event listeners bound');
  } else {
    console.error('❌ initializeEventListeners missing');
  }

  // Force step 1 highlight/state (safety)
  if (typeof generator.goToStep === 'function') {
    generator.goToStep(1);
  }

  // Debug hook to quickly inspect bindings
  window.__webgenDebug = () => ({
    next1: !!document.getElementById('nextStep1')?._hasClick,
    generatorKeys: Object.keys(generator || {}),
    currentStep: generator?.currentStep,
  });
});

// Patch: mark click listeners to confirm they exist (dev-only)
(function markClicks() {
  const ids = ['nextStep1','nextStep2','nextStep3','nextStep4','prevStep2','prevStep3','prevStep4'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const origAdd = el.addEventListener.bind(el);
    el.addEventListener = (type, fn, opts) => {
      if (type === 'click') el._hasClick = true;
      return origAdd(type, fn, opts);
    };
  });
})();
