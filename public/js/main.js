// WebsiteGenerator class handles all the main functionality of the website generator using a secure backend API
class WebsiteGenerator {
    constructor() {
        this.form = document.getElementById('websiteGeneratorForm');
        this.previewFrame = document.getElementById('previewFrame');
        this.currentPage = 0;
        this.generatedPages = [];
        this.currentStep = 1;
        this.userHasPaid = false;

        // Load any cached site from localStorage
        const savedPages = localStorage.getItem('generatedPages');
        if (savedPages) {
            this.generatedPages = JSON.parse(savedPages);
            this.updatePreview();
        }

        this.initializeEventListeners();
        this.highlightStep(this.currentStep);
    }

    initializeEventListeners() {
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

        document.querySelectorAll('.preview-controls button').forEach(button => {
            button.addEventListener('click', () => {
                this.changePreviewDevice(button.id.replace('Preview', ''));
            });
        });

        document.getElementById('prevPage').addEventListener('click', () => this.changePage(-1));
        document.getElementById('nextPage').addEventListener('click', () => this.changePage(1));

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

    goToStep(stepNumber) {
        document.querySelectorAll('.form-step').forEach(step => step.style.display = 'none');
        document.getElementById(`step${stepNumber}`).style.display = 'block';
        this.currentStep = stepNumber;
        this.highlightStep(stepNumber);
    }

    highlightStep(stepNumber) {
        document.querySelectorAll('.step-progress-bar .step').forEach((el, index) => {
            el.classList.toggle('active', index === stepNumber - 1);
        });
    }

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
Now finalize and generate the full website.

Instructions:
- Expand the design with more visual detail, layout structure, and styling.
- Add icons, interactive JavaScript (e.g., tab switching, transitions).
- Include appropriate placeholder or sourced images.
- Return one full HTML document per page, each starting with <!DOCTYPE html> and ending with </html>.
- DO NOT explain the code. Just output the full code content only.

Take multiple inputs if needed to ensure you reply in full.

Details:
- This is a "${websiteType}" website called "${businessName}", which is a "${businessType}" business.
- It should have ${pageCount} pages: ${pages}.
- Business Description: "${businessDescription}".
- Extra features to include: ${features}.
- Design style: ${colorScheme} theme, ${fontStyle} fonts, ${layoutPreference} layout.
        `.trim();
    }

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

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    new WebsiteGenerator();
});

