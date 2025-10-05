// ===========================
// init.js
// ===========================

document.addEventListener('DOMContentLoaded', () => {
  // Grab the form element
  const formEl = document.getElementById('websiteGeneratorForm');
  if (!formEl) {
    console.error('⛔ Missing #websiteGeneratorForm in DOM');
    return;
  }

  // Ensure WebsiteGenerator class is loaded
  if (typeof WebsiteGenerator !== 'function') {
    console.error('⛔ WebsiteGenerator class not loaded before init.js');
    return;
  }

  // ✅ Create instance
  const gen = new WebsiteGenerator(formEl);  
  window.generator = gen;

  // Ensure gen.form exists for helper methods
  if (!gen.form) gen.form = formEl;

  // Bind UI events + start wizard at step 1
  try {
    gen.initializeEventListeners?.();
    gen.goToStep?.(1);
    gen.highlightStep?.(1);
  } catch (e) {
    console.error('❌ Init error:', e);
  }

  // ✅ Setup Domain Checker (attaches event listeners for checkAvailability)
  if (typeof window.setupDomainChecker === 'function') {
    window.setupDomainChecker();
    console.log('✅ Domain checker initialized');
  } else {
    console.warn('⚠️ setupDomainChecker not found — check domainChecker.js inclusion order');
  }

  console.log('✅ WebsiteGenerator initialized and ready');
});
