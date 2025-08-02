document.addEventListener('DOMContentLoaded', () => {
  const customizationPanel = document.getElementById('customizationPanel');
  if (customizationPanel) {
    customizationPanel.style.display = 'none';
    const tools = customizationPanel.querySelector('.custom-tools');
    if (tools) tools.style.display = 'none';
  }

  setupDomainChecker();

  // ✅ Create global WebsiteGenerator instance
  window.generator = new WebsiteGenerator();

  // ✅ Hook up generate button
  const generateButton = document.getElementById('nextStep4');
  if (generateButton) {
    generateButton.addEventListener('click', () => {
      if (window.generator) {
        window.generator.handleSubmit();
      } else {
        console.error('❌ WebsiteGenerator not initialized');
      }
    });
  }
});
