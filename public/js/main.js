// WebsiteGenerator class handles all the main functionality of the website generator using Google Apps Script as backend
class WebsiteGenerator {
    constructor() {
        // Grab important DOM elements
        this.form = document.getElementById('websiteGeneratorForm');
        this.previewFrame = document.getElementById('previewFrame');
        this.currentPage = 0;
        this.generatedPages = [];

        // Set up all event listeners
        this.initializeEventListeners();
    }

    // Set up user interaction event listeners
    initializeEventListeners() {
        // Prevent default form submission and handle custom logic
        this.form.addEventListener('submit', this.handleSubmit.bind(this));

        // Real-time preview update after user input (debounced)
        this.form.addEventListener('input', debounce(() => {
            this.updatePreview();
        }, 1000));

        // Handle device preview buttons
        document.querySelectorAll('.preview-controls button').forEach(button => {
            button.addEventListener('click', () => {
                this.changePreviewDevice(button.id.replace('Preview', ''));
            });
        });

        // Handle manual page navigation
        document.getElementById('prevPage').addEventListener('click', () => this.changePage(-1));
        document.getElementById('nextPage').addEventListener('click', () => this.changePage(1));
    }

    // Handle form submission, send data to Google Apps Script backend
    async handleSubmit(event) {
        event.preventDefault(); // Prevent page reload

        if (!this.validateForm()) return; // Check form is filled

        this.showLoading(); // Show loader

        try {
            const formData = new FormData(this.form);
            const aiQuery = this.generateAIQuery(formData);

            const response = await fetch('https://script.google.com/macros/s/AKfycbyLl-daaimhjv05m5zCiLZJ4K9Uv3vvMPa-4LVsjhxTw2Sn6lkKk3P8fGMfj-XN7XVj/exec', {
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

    // Convert form data into a full OpenAI prompt
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

    // Show live preview of the generated content
    updatePreview() {
        if (this.generatedPages.length === 0) return;

        const currentPageContent = this.generatedPages[this.currentPage];
        const scrollY = window.scrollY; // Save scroll position

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

    // Handle next/previous buttons and update UI
    updatePageNavigation() {
        const prevButton = document.getElementById('prevPage');
        const nextButton = document.getElementById('nextPage');
        const pageIndicator = document.getElementById('pageIndicator');

        prevButton.disabled = this.currentPage === 0;
        nextButton.disabled = this.currentPage === this.generatedPages.length - 1;
        pageIndicator.textContent = `Page ${this.currentPage + 1} of ${this.generatedPages.length}`;
    }

    // Change preview page by offset
    changePage(direction) {
        this.currentPage += direction;
        this.currentPage = Math.max(0, Math.min(this.currentPage, this.generatedPages.length - 1));
        this.updatePreview();
    }

    // Change the size of the preview iframe
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

    // Show a loading indicator and disable submit button
    showLoading() {
        const loader = document.createElement('div');
        loader.className = 'loader';
        loader.innerHTML = 'Generating website...';
        this.form.appendChild(loader);
        this.form.querySelector('button[type="submit"]').disabled = true;
    }

    // Hide loader and re-enable submit
    hideLoading() {
        const loader = this.form.querySelector('.loader');
        if (loader) loader.remove();
        this.form.querySelector('button[type="submit"]').disabled = false;
    }

    // Show success alert
    showSuccess(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-success';
        alert.innerHTML = message;
        this.form.insertBefore(alert, this.form.firstChild);
        setTimeout(() => alert.remove(), 5000);
    }

    // Show error alert
    showError(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-error';
        alert.innerHTML = message;
        this.form.insertBefore(alert, this.form.firstChild);
        setTimeout(() => alert.remove(), 5000);
    }

    // Check that all required fields are filled
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

    // Display error below a field
    showFieldError(field, message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.innerHTML = message;
        field.parentNode.appendChild(errorDiv);
        field.classList.add('error');
    }

    // Remove any previous field error
    clearFieldError(field) {
        const errorDiv = field.parentNode.querySelector('.field-error');
        if (errorDiv) errorDiv.remove();
        field.classList.remove('error');
    }
}

// Debounce function to limit how often preview updates
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

// Initialize when page is loaded
document.addEventListener('DOMContentLoaded', () => {
    new WebsiteGenerator();
});
