// ===========================
// init.js
// ===========================

document.addEventListener('DOMContentLoaded', () => {
  const formEl = document.getElementById('websiteGeneratorForm');
  if (!formEl) {
    console.error('⛔ Missing #websiteGeneratorForm in DOM');
    return;
  }

  if (typeof WebsiteGenerator !== 'function') {
    console.error('⛔ WebsiteGenerator class not loaded before init.js');
    return;
  }

  // ✅ Create instance
  const gen = new WebsiteGenerator(formEl);  // pass formEl for clarity
  window.generator = gen;

  // Ensure gen.form exists for helpers
  if (!gen.form) gen.form = formEl;

  // ✅ Bind UI + start wizard at step 1
  try {
    gen.initializeEventListeners?.();
    gen.goToStep?.(1);
    gen.highlightStep?.(1);
  } catch (e) {
    console.error('❌ Init error:', e);
  }

  console.log('✅ WebsiteGenerator initialized and ready');
});
