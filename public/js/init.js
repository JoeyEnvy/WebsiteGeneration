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
  const form = document.getElementById('generatorForm');
  if (form) {
    window.generator = new WebsiteGenerator(form);
    console.log('🧠 WebsiteGenerator instance created');
  } else {
    console.error('❌ generatorForm not found');
  }

  // ✅ Hook up "Generate" button
  const generateButton = document.getElementById('nextStep4');
  if (generateButton) {
    generateButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.generator && typeof window.generator.handleSubmit === 'function') {
        console.log('📨 Triggering handleSubmit()');
        window.generator.handleSubmit();
      } else {
        console.error('❌ handleSubmit not available');
      }
    });
  } else {
    console.error('❌ nextStep4 button not found');
  }
});
