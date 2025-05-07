class WebsiteGenerator {
    constructor() {
        this.form = document.getElementById('websiteGeneratorForm');
        this.previewContainer = document.getElementById('previewFrame');
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
            this.form.addEventListener('input', debounce(() => this.updatePreview(), 500));
        }
    }

    async handleSubmit(e) {
        e.preventDefault();
        const formData = new FormData(this.form);
        const data = Object.fromEntries(formData.entries());

        try {
            const website = await this.generateWebsite(data);
            this.showSuccess(website);
        } catch (error) {
            ErrorHandler.show(error.message);
        }
    }

    async generateWebsite(data) {
        const response = await fetch(`${CONFIG.API_URL}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`,
            },
            body: JSON.stringify(data),
        });

        if (!response.ok) throw new Error('Website generation failed');
        return await response.json();
    }

    async updatePreview() {
        const formData = new FormData(this.form);
        const data = Object.fromEntries(formData.entries());

        try {
            const preview = await this.generatePreview(data);
            this.renderPreview(preview);
        } catch (error) {
            console.error('Preview generation failed:', error);
        }
    }

    renderPreview(previewData) {
        this.previewContainer.innerHTML = previewData.html;
    }
}