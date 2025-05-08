// ========================================================================
// WebsiteGenerator class handles all functionality of the website generator
// ========================================================================
class WebsiteGenerator {
    constructor() {
        // ================================
        // Initialize core variables
        // ================================
        this.form = document.getElementById('websiteGeneratorForm');
        this.previewFrame = document.getElementById('previewFrame');
        this.currentPage = 0;
        this.generatedPages = []; // holds the full generated HTML from GPT
        this.currentStep = 1;
        this.userHasPaid = false; // payment flag for download control

        // ================================
        // Load saved pages from localStorage if available
        // ================================
        const savedPages = localStorage.getItem('generatedPages');
        if (savedPages) {
            this.generatedPages = JSON.parse(savedPages);
            this.updatePreview();
        }

        this.initializeEventListeners();
        this.highlightStep(this.currentStep);
    }

    // ========================================================================
    // Set up all button and event listeners
    // ========================================================================
    initializeEventListeners() {
        // Step navigation buttons
        document.getElementById('nextStep1').addEventListener('click', () => {
            if (this.validateStep('step1')) this.goToStep(2);
        });
        document.getElementById('nextStep2').addEventListener('click', () => {
            if (this.validateStep('step2')) this.goToStep(3);
        });
        document.getElementById('nextStep3').addEventListener('click', () => {
            if (this.validateStep('step3')) this.handleSubmit();
        });
        document.getElementById('prevStep2').addEventListener('click', () => this.goToStep(1));
        document.getElementById('prevStep3').addEventListener('click', () => this.goToStep(2));

        // Preview device scaling buttons
        document.querySelectorAll('.preview-controls button').forEach(button => {
            button.addEventListener('click', () => {
                this.changePreviewDevice(button.id.replace('Preview', ''));
            });
        });

        // Navigation through generated pages
        document.getElementById('prevPage').addEventListener('click', () => this.changePage(-1));
        document.getElementById('nextPage').addEventListener('click', () => this.changePage(1));

        // Purchase + download button events
        const purchaseBtn = document.getElementById('purchaseBtn');
        const downloadBtn = document.getElementById('downloadSiteBtn');

        if (purchaseBtn) {
            purchaseBtn.addEventListener('click', () => {
                const confirmed = confirm("Simulated payment: Proceed to pay £X?");
                if (confirmed) {
                    this.userHasPaid = true;
                    purchaseBtn.style.display = 'none';
                    if (downloadBtn) downloadBtn.style.display = 'inline-block';
                    alert('Payment successful. You can now download your website.');
                }
            });
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadGeneratedSite());
        }
    }

    // ========================================================================
    // Navigate to a specific step in the form
    // ========================================================================
    goToStep(stepNumber) {
        document.querySelectorAll('.form-step').forEach(step => step.style.display = 'none');
        document.getElementById(`step${stepNumber}`).style.display = 'block';
        this.currentStep = stepNumber;
        this.highlightStep(stepNumber);
    }

    // ========================================================================
    // Visually highlight the current step in progress bar
    // ========================================================================
    highlightStep(stepNumber) {
        document.querySelectorAll('.step-progress-bar .step').forEach((el, index) => {
            el.classList.toggle('active', index === stepNumber - 1);
        });
    }

    // ========================================================================
    // Submit the form and request GPT website generation
    // ========================================================================
    async handleSubmit() {
        this.goToStep(4);
        this.showLoading();

        try {
            const formData = new FormData(this.form);
            const finalPrompt = this.buildFinalPrompt(formData);

            const response = await fetch('https://websitegeneration.onrender.com/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: finalPrompt })
            });

            const data = await response.json();

            if (data.success) {
                this.generatedPages = data.pages;
                localStorage.setItem('generatedPages', JSON.stringify(this.generatedPages));
                this.updatePreview();
                this.showSuccess('Website generated successfully!');
            } else {
                throw new Error(data.error || 'Unknown error from server.');
            }
        } catch (error) {
            this.showError('Failed to generate website: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // ========================================================================
    // Download generated HTML pages as a .zip file (after payment)
    // ========================================================================
    downloadGeneratedSite() {
        if (!this.userHasPaid) {
            alert('Please purchase access to download your website.');
            return;
        }

        if (!this.generatedPages.length) {
            alert('No website generated yet.');
            return;
        }

        const zip = new JSZip();
        this.generatedPages.forEach((html, i) => {
            zip.file(`page${i + 1}.html`, html);
        });

        zip.generateAsync({ type: 'blob' }).then(blob => {
            saveAs(blob, "my-website.zip");
        });
    }













  // ========================================================================
// Build a detailed prompt for GPT using all form fields
// ========================================================================
buildFinalPrompt(formData) {
    const websiteType = formData.get('websiteType');
    const pageCount = formData.get('pageCount');
    const pages = Array.from(formData.getAll('pages')).join(', ');
    const businessName = formData.get('businessName');
    const businessType = formData.get('businessType');
    const businessDescription = formData.get('businessDescription');
    const features = Array.from(formData.getAll('features')).join(', ');
    const colorScheme = formData.get('colorScheme');
    const fontStyle = formData.get('fontStyle');
    const layoutPreference = formData.get('layoutPreference');

    return `
You are a professional website developer.

Generate exactly ${pageCount} fully standalone HTML pages: ${pages}.
Each page must be a complete HTML5 document using embedded <style> and <script> only.
Do not include any external links to CSS, JS, or images. Do not explain or comment anything.

✅ Design Requirements:
- Use a clean, modern, professional layout.
- Use responsive design with media queries for 1024px, 768px, 480px, and 320px breakpoints.
- Structure pages using semantic HTML5 elements: <header>, <nav>, <main>, <section>, <footer>.
- Use grid or flex layout systems to organize content into responsive rows and columns.
- Prioritize good spacing, font hierarchy, and visual balance.
- All code should be fully embedded — no CDN, no \`\`\` markdown blocks, no explanation.

📦 Details:
- Website Type: ${websiteType}
- Business: "${businessName}" (${businessType})
- Pages: ${pages}
- Features: ${features}
- Design: ${colorScheme} theme, ${fontStyle} font, ${layoutPreference} layout

📝 Business Description:
"${businessDescription}" — expand this into 1–2 well-written paragraphs that describe the business purpose, audience, and mission.
Also provide 4–6 bullet points summarizing key offerings, goals, or services.
    `.trim();
}














    // ========================================================================
    // Validate each step's required fields before moving forward
    // ========================================================================
    validateStep(stepId) {
        const step = document.getElementById(stepId);
        const requiredFields = step.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                this.showFieldError(field, 'This field is required');
                isValid = false;
            } else {
                this.clearFieldError(field);
            }
        });

        if (stepId === 'step1') {
            const checkedPages = step.querySelectorAll('input[name="pages"]:checked');
            if (checkedPages.length === 0) {
                this.showCheckboxError(step.querySelector('input[name="pages"]'), 'Select at least one page');
                isValid = false;
            } else {
                this.clearCheckboxError(step.querySelector('input[name="pages"]'));
            }
        }

        if (stepId === 'step3') {
            const checkedFeatures = step.querySelectorAll('input[name="features"]:checked');
            if (checkedFeatures.length === 0) {
                this.showCheckboxError(step.querySelector('input[name="features"]'), 'Select at least one feature');
                isValid = false;
            } else {
                this.clearCheckboxError(step.querySelector('input[name="features"]'));
            }
        }

        return isValid;
    }

    // ========================================================================
    // Show error messages on missing input
    // ========================================================================
    showFieldError(field, message) {
        this.clearFieldError(field);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.innerHTML = message;
        field.parentNode.appendChild(errorDiv);
        field.classList.add('error');
    }

    clearFieldError(field) {
        const errorDiv = field.parentNode.querySelector('.field-error');
        if (errorDiv) errorDiv.remove();
        field.classList.remove('error');
    }

    showCheckboxError(field, message) {
        const group = field.closest('.checkbox-group');
        if (group && !group.querySelector('.field-error')) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'field-error';
            errorDiv.innerHTML = message;
            group.appendChild(errorDiv);
        }
    }

    clearCheckboxError(field) {
        const group = field.closest('.checkbox-group');
        const errorDiv = group?.querySelector('.field-error');
        if (errorDiv) errorDiv.remove();
    }

    // ========================================================================
    // Render the current generated page into iframe preview
    // ========================================================================
    updatePreview() {
        if (this.generatedPages.length === 0) return;

        const currentPageContent = this.generatedPages[this.currentPage];
        const scrollY = window.scrollY;

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '500px';
        iframe.style.border = 'none';

        this.previewFrame.innerHTML = '';
        this.previewFrame.appendChild(iframe);

        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write(currentPageContent);
        iframe.contentWindow.document.close();

        window.scrollTo({ top: scrollY, behavior: 'auto' });
        this.updatePageNavigation();
    }

    updatePageNavigation() {
        const prevButton = document.getElementById('prevPage');
        const nextButton = document.getElementById('nextPage');
        const pageIndicator = document.getElementById('pageIndicator');

        prevButton.disabled = this.currentPage === 0;
        nextButton.disabled = this.currentPage === this.generatedPages.length - 1;
        pageIndicator.textContent = `Page ${this.currentPage + 1} of ${this.generatedPages.length}`;
    }

    changePage(direction) {
        this.currentPage += direction;
        this.currentPage = Math.max(0, Math.min(this.currentPage, this.generatedPages.length - 1));
        this.updatePreview();
    }

    // ========================================================================
    // Adjust iframe preview size for selected device
    // ========================================================================
    changePreviewDevice(device) {
        const sizes = {
            mobile: '375px',
            tablet: '768px',
            desktop: '100%'
        };

        const iframe = this.previewFrame.querySelector('iframe');
        if (iframe) {
            iframe.style.width = sizes[device];
        }

        document.querySelectorAll('.preview-controls button').forEach(button => {
            button.classList.toggle('active', button.id === `${device}Preview`);
        });
    }

    // ========================================================================
    // Show / Hide loading animation
    // ========================================================================
    showLoading() {
        const loader = document.createElement('div');
        loader.className = 'loader';
        loader.innerHTML = 'Generating website...';
        this.form.appendChild(loader);
        this.form.querySelector('button[type="submit"], #nextStep3').disabled = true;
    }

    hideLoading() {
        const loader = this.form.querySelector('.loader');
        if (loader) loader.remove();
        this.form.querySelector('button[type="submit"], #nextStep3').disabled = false;
    }

    // ========================================================================
    // Notification banners (success or error)
    // ========================================================================
    showSuccess(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-success';
        alert.innerHTML = message;
        this.form.insertBefore(alert, this.form.firstChild);
        setTimeout(() => alert.remove(), 5000);
    }

    showError(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-error';
        alert.innerHTML = message;
        this.form.insertBefore(alert, this.form.firstChild);
        setTimeout(() => alert.remove(), 5000);
    }
}

// ========================================================================
// Utility: debounce to limit input frequency
// ========================================================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// ========================================================================
// Bootstrapping the Website Generator when page loads
// ========================================================================
document.addEventListener('DOMContentLoaded', () => {
    new WebsiteGenerator();
});

