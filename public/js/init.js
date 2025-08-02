document.addEventListener('DOMContentLoaded', () => {
  // Hide customization tools initially
  const customizationPanel = document.getElementById('customizationPanel');
  if (customizationPanel) {
    customizationPanel.style.display = 'none';
    const tools = customizationPanel.querySelector('.custom-tools');
    if (tools) tools.style.display = 'none';
  }

  // Start domain checker if needed
  setupDomainChecker();

  // ✅ Create global WebsiteGenerator instance
  window.generator = new WebsiteGenerator();

  // ✅ Hook up the generate button safely
  const generateButton = document.getElementById('nextStep4');
  if (generateButton) {
    generateButton.addEventListener('click', (e) => {
      e.preventDefault();
      if (window.generator && typeof window.generator.handleSubmit === 'function') {
        window.generator.handleSubmit();
      } else {
        console.error('❌ WebsiteGenerator or handleSubmit is missing');
      }
    });
  }
});
