document.addEventListener('DOMContentLoaded', () => {
  console.log('✅ DOM ready');

  // ✅ Hide customization panel on load
  const customizationPanel = document.getElementById('customizationPanel');
  if (customizationPanel) {
    customizationPanel.style.display = 'none';
    const tools = customizationPanel.querySelector('.custom-tools');
    if (tools) tools.style.display = 'none';
  }

  // ✅ Setup domain checker
  if (typeof setupDomainChecker === 'function') {
    setupDomainChecker();
  }

  // ✅ Initialize WebsiteGenerator
  const form = document.getElementById('websiteGeneratorForm');
  if (form) {
    window.generator = new WebsiteGenerator(form);
    console.log('🧠 WebsiteGenerator instance created');
  } else {
    console.error('❌ websiteGeneratorForm not found in DOM');
  }

  // ✅ DO NOT manually add a click listener to nextStep4 here.
});
