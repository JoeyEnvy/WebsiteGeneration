class WebsiteGenerator {
    constructor() {
        this.form = document.getElementById('websiteGeneratorForm');
        this.previewFrame = document.getElementById('previewFrame');
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        this.form.addEventListener('input', utils.debounce(
            this.updatePreview.bind(this),
            CONFIG.PREVIEW_DELAY
        ));

        // Color picker event
        document.getElementById('primaryColor').addEventListener('change', 
            this.updatePreview.bind(this)
        );

        // Logo upload
        document.getElementById('logo').addEventListener('change', 
            this.handleLogoUpload.bind(this)
        );
    }

    async handleSubmit(event) {
        event.preventDefault();
        
        if (!utils.validateForm(this.form)) {
            return;
        }

        try {
            const formData = new FormData(this.form);
            const websiteData = await this.generateWebsite(formData);
            this.showSuccessMessage(websiteData);
        } catch (error) {
            this.showErrorMessage(error.message);
        }
    }

    async generateWebsite(formData) {
        const response = await fetch(`${CONFIG.API_URL}/generate`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error('Failed to generate website');
        }

        return await response.json();
    }

    async handleLogoUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (file.size > CONFIG.MAX_FILE_SIZE) {
            this.showErrorMessage('File size exceeds limit (5MB)');
            event.target.value = '';
            return;
        }

        try {
            const base64Logo = await this.convertToBase64(file);
            this.updatePreview({ logo: base64Logo });
        } catch (error) {
            this.showErrorMessage('Failed to process logo');
        }
    }

    convertToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    showSuccessMessage(data) {
        // Implement success message UI
    }

    showErrorMessage(message) {
        // Implement error message UI
    }
}