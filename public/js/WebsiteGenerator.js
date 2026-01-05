// ===========================
// WebsiteGenerator.js — class + constructor
// ===========================

class WebsiteGenerator {
  constructor() {
    this.form = document.getElementById("websiteGeneratorForm");
    this.previewFrame = document.getElementById("previewFrame");
    this.currentPage = 0;
    this.generatedPages = [];
    this.currentStep = 1;
    this.userHasPaid = false;

    // Restore saved pages from previous session if available
    const savedPages = localStorage.getItem("generatedPages");
    if (savedPages) {
      try {
        this.generatedPages = JSON.parse(savedPages);
      } catch {
        console.warn("⚠️ Could not parse saved pages from localStorage");
      }
    }

    if (!window.API_BASE) {
      window.API_BASE = "https://websitegeneration.onrender.com";
    }

    this.initializeDeploymentButtons();
    // initializeDomainChecker() deliberately NOT called here
  }
}

window.WebsiteGenerator = WebsiteGenerator;
