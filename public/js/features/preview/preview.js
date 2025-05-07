class PreviewManager {
    constructor() {
        this.previewFrame = document.getElementById('previewFrame');
        this.previewControls = {
            mobile: document.getElementById('mobilePreview'),
            tablet: document.getElementById('tabletPreview'),
            desktop: document.getElementById('desktopPreview')
        };
        this.currentTemplate = null;
        this.initializePreviewControls();
    }

    initializePreviewControls() {
        Object.entries(this.previewControls).forEach(([device, button]) => {
            button.addEventListener('click', () => this.changePreviewSize(device));
        });
    }

    changePreviewSize(device) {
        const sizes = {
            mobile: '375px',
            tablet: '768px',
            desktop: '100%'
        };

        this.previewFrame.style.width = sizes[device];
        this.updateActiveButton(device);
    }

    updateActiveButton(activeDevice) {
        Object.entries(this.previewControls).forEach(([device, button]) => {
            button.classList.toggle('active', device === activeDevice);
        });
    }

    async updatePreview(formData) {
        try {
            const templateName = CONFIG.TEMPLATES[formData.get('businessType')];
            if (!this.currentTemplate || this.currentTemplate !== templateName) {
                const template = await utils.loadTemplate(templateName);
                this.currentTemplate = templateName;
                this.renderTemplate(template, formData);
            } else {
                this.updateTemplateContent(formData);
            }
        } catch (error) {
            console.error('Preview update failed:', error);
        }
    }

    renderTemplate(template, formData) {
        const compiledTemplate = this.compileTemplate(template, formData);
        this.previewFrame.innerHTML = compiledTemplate;
    }

    updateTemplateContent(formData) {
        // Update existing template content without full reload
        const elements = this.previewFrame.contentDocument.querySelectorAll('[data-content]');
        elements.forEach(element => {
            const contentKey = element.dataset.content;
            const content = formData.get(contentKey);
            if (content) {
                element.textContent = content;
            }
        });
    }

    compileTemplate(template, formData) {
        // Replace template variables with form data
        return template.replace(/\${(\w+)}/g, (match, key) => {
            return formData.get(key) || '';
        });
    }
}