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

  // Create instance
  const gen = new WebsiteGenerator();       // if your constructor accepts a form, pass formEl
  window.generator = gen;

  // Ensure gen.form exists for helpers that use this.form
  if (!gen.form) gen.form = formEl;

  // Bind UI + go to step 1
  try { gen.initializeEventListeners?.(); } catch (e) { console.error(e); }
  gen.goToStep?.(1);
});
