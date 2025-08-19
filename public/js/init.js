// =======================
// ✅ App Bootstrap (init.js)
// =======================
import { normalizePages } from './normalizePages.js';
import { injectSmartNavigation } from './navigation.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM ready');

  // ✅ Hide customization panel initially
  const customizationPanel = document.getElementById('customizationPanel');
  if (customizationPanel) {
    customizationPanel.style.display = 'none';
    const tools = customizationPanel.querySelector('.custom-tools');
    if (tools) tools.style.display = 'none';
  }

  // ✅ Setup domain checker (safe guard)
  try {
    if (typeof setupDomainChecker === 'function') {
      setupDomainChecker();
      console.log('🌍 Domain checker initialized');
    } else {
      console.warn('⚠️ setupDomainChecker not available');
    }
  } catch (err) {
    console.error('❌ Error initializing domain checker:', err);
  }

  // ✅ Initialize WebsiteGenerator
  const form = document.getElementById('websiteGeneratorForm');
  if (form) {
    window.generator = new WebsiteGenerator(form);

    // Attach normalization + navigation helpers
    window.generator.normalizePages = normalizePages;
    window.generator.injectSmartNavigation = injectSmartNavigation;

    console.log('🧠 WebsiteGenerator instance created and helpers attached');
  } else {
    console.error('❌ websiteGeneratorForm not found in DOM');
  }

  // ⚠️ Do not attach navigation button handlers here
  //    (they’re already set up in WebsiteGenerator.ui.js)
});
