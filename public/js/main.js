// ========================================================================
// WebsiteGenerator class handles all functionality of the website generator
// ========================================================================
class WebsiteGenerator {
    constructor() {
        this.form = document.getElementById('websiteGeneratorForm');
        this.previewFrame = document.getElementById('previewFrame');
        this.currentPage = 0;
        this.generatedPages = [];
        this.currentStep = 1;
        this.userHasPaid = false;

        const savedPages = localStorage.getItem('generatedPages');
        if (savedPages) {
            this.generatedPages = JSON.parse(savedPages);
            this.updatePreview();
        }

        this.initializeEventListeners();
        this.highlightStep(this.currentStep);
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

    initializeEventListeners() {
        document.getElementById('nextStep1').addEventListener('click', () => {
            if (this.validateStep('step1')) this.goToStep(2);
        });
        document.getElementById('nextStep2').addEventListener('click', () => {
            if (this.validateStep('step2')) this.goToStep(3);
        });
        document.getElementById('nextStep3').addEventListener('click', () => {
            if (this.validateStep('step3')) this.goToStep(4);
        });
        document.getElementById('nextStep4')?.addEventListener('click', () => {
            if (this.validateStep('step4')) this.goToStep(5);
        });

        document.getElementById('prevStep2').addEventListener('click', () => this.goToStep(1));
        document.getElementById('prevStep3').addEventListener('click', () => this.goToStep(2));
        document.getElementById('prevStep4')?.addEventListener('click', () => this.goToStep(3));

        document.querySelectorAll('.preview-controls button').forEach(button => {
            button.addEventListener('click', () => {
                this.changePreviewDevice(button.id.replace('Preview', ''));
            });
        });

        document.getElementById('prevPage').addEventListener('click', () => this.changePage(-1));
        document.getElementById('nextPage').addEventListener('click', () => this.changePage(1));

        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

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

        const checkboxes = step.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length) {
            const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
            if (!anyChecked) {
                this.showCheckboxError(checkboxes[0], 'Select at least one option');
                isValid = false;
            } else {
                this.clearCheckboxError(checkboxes[0]);
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

    async handleSubmit() {
        this.goToStep(5);
        this.showLoading();

        try {
            const formData = new FormData(this.form);
            const finalPrompt = this.buildFinalPrompt(formData);

            const response = await fetch('https://websitegeneration.onrender.com/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: finalPrompt,
                    pageCount: formData.get('pageCount') || '1'
                })
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
        const enhancements = Array.from(formData.getAll('enhancements')).join(', ');

        return `
You are a professional website developer.

Generate exactly ${pageCount} fully standalone HTML pages: ${pages}.
Each page must be a complete HTML5 document using embedded <style> and <script> only.
Do not explain or comment anything.

✅ Design Requirements:
- Use a clean, modern, professional layout.
- Use responsive design with media queries for 1024px, 768px, 480px, and 320px breakpoints.
- Structure pages using semantic HTML5 elements: <header>, <nav>, <main>, <section>, <footer>.
- Use grid or flex layout systems to organize content into responsive rows and columns.
- Prioritize good spacing, font hierarchy, and visual balance.

📦 Details:
- Website Type: ${websiteType}
- Business: "${businessName}" (${businessType})
- Pages: ${pages}
- Features: ${features}
- Design: ${colorScheme} theme, ${fontStyle} font, ${layoutPreference} layout

📝 Business Description:
"${businessDescription}" — expand this into 2–3 well-written paragraphs that describe the business purpose, audience, and mission. Also include 4–6 bullet points.

📐 Section Structure:
- Each page must include at least 5 clearly labeled sections such as:
  1. Hero Section
  2. About/Description
  3. Services Grid
  4. Testimonials
  5. Contact Section

🖼️ Images & Icons:
- Pull at least 2–3 relevant images from public sources online (Unsplash, Pexels, Pixabay).
- Include at least 3 icons per page using FontAwesome CDN.

📋 Content Notes:
- Never use "Lorem Ipsum".
- Use context-aware, realistic content.
- Include CTA buttons, headers, subheaders, and paragraph text.
        `.trim();
    }

    showLoading() {
        const loader = document.createElement('div');
        loader.className = 'loader';
        loader.innerHTML = 'Generating website...';
        this.form.appendChild(loader);
        const submitBtn = this.form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
    }

    hideLoading() {
        const loader = this.form.querySelector('.loader');
        if (loader) loader.remove();
        const submitBtn = this.form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = false;
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

