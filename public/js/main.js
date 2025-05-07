// WebsiteGenerator class handles all the main functionality of the website generator using a secure backend API
class WebsiteGenerator {
    constructor() {
        this.form = document.getElementById('websiteGeneratorForm');
        this.previewFrame = document.getElementById('previewFrame');
        this.currentPage = 0;
        this.generatedPages = [];

        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        this.form.addEventListener('input', debounce(() => {
            this.updatePreview();
        }, 1000));

        document.querySelectorAll('.preview-controls button').forEach(button => {
            button.addEventListener('click', () => {
                this.changePreviewDevice(button.id.replace('Preview', ''));
            });
        });

        document.getElementById('prevPage').addEventListener('click', () => this.changePage(-1));
        document.getElementById('nextPage').addEventListener('click', () => this.changePage(1));
    }

    async handleSubmit(event) {
        event.preventDefault();

        if (!this.validateForm()) return;

        this.showLoading();

        try {
            const formData = new FormData(this.form);
            const aiQuery = this.generateAIQuery(formData);

            const response = await fetch('https://websitegeneration.onrender.com/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: aiQuery })
            });

            const data = await response.json();

            if (data.success) {
                this.generatedPages = data.pages;
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

    generateAIQuery(formData) {
        const websiteType = formData.get('websiteType');
        const pageCount = formData.get('pageCount');
        const pages = Array.from(formData.getAll('pages')).join(', ');
        const businessName = formData.get('businessName');
        const businessDescription = formData.get('businessDescription');
        const features = Array.from(formData.getAll('features')).join(', ');
        const colorScheme = formData.get('colorScheme');
        const fontStyle = formData.get('fontStyle');
        const layoutPreference = formData.get('layoutPreference');

        return `
Please generate a full multi-page responsive website in one complete HTML file (including embedded CSS and JavaScript).

Business Information:
- Type: ${websiteType}
- Name: ${businessName}
- Description: ${businessDescription}
- Pages: ${pageCount} (${pages})
- Desired Features: ${features}

Design Preferences:
- Color Scheme: ${colorScheme}
- Font Style: ${fontStyle}
- Layout: ${layoutPreference}

Additional Instructions:
1. Ensure all code (HTML, CSS, JS) is in a single file.
2. Use appropriate styling with clean, aesthetic, and modern UI/UX.
3. Include animations, icons, and placeholder images where useful.
4. Add JavaScript interactivity (like transitions, forms, or tab switching).
5. Style with twice the usual amount of visual detail.
6. Assume the user has no code to edit. This must be complete and ready.
7. DO NOT explain the code. Output the code only.
8. Output should start with <!DOCTYPE html> and end at the final </html>.
        `.trim();
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
        this.form.querySelector('button[type="submit"]').disabled = true;
    }

    hideLoading() {
        const loader = this.form.querySelector('.loader');
        if (loader) loader.remove();
        this.form.querySelector('button[type="submit"]').disabled = false;
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

    validateForm() {
        const requiredFields = this.form.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                this.showFieldError(field, 'This field is required');
                isValid = false;
            } else {
                this.clearFieldError(field);
            }
        });

        return isValid;
    }

    showFieldError(field, message) {
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

