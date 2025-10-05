class FormValidator {
    constructor(form) {
        this.form = form;
        this.initializeValidation();
    }

    initializeValidation() {
        this.form.addEventListener('input', this.validateField.bind(this));
        this.form.addEventListener('submit', this.validateForm.bind(this));
    }

    validateField(event) {
        const field = event.target;
        if (field.hasAttribute('required')) {
            this.validateRequired(field);
        }

        if (field.type === 'email') {
            this.validateEmail(field);
        }

        if (field.type === 'file') {
            this.validateFile(field);
        }
    }

    validateRequired(field) {
        if (!field.value.trim()) {
            utils.showError(field, 'This field is required');
            return false;
        }
        utils.clearError(field);
        return true;
    }

    validateEmail(field) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(field.value)) {
            utils.showError(field, 'Please enter a valid email address');
            return false;
        }
        utils.clearError(field);
        return true;
    }

    validateFile(field) {
        const file = field.files[0];
        if (!file) return true;

        if (file.size > CONFIG.MAX_FILE_SIZE) {
            utils.showError(field, 'File size exceeds 5MB limit');
            return false;
        }

        const extension = file.name.split('.').pop().toLowerCase();
        if (!CONFIG.SUPPORTED_FORMATS.includes(extension)) {
            utils.showError(field, 'Unsupported file format');
            return false;
        }

        utils.clearError(field);
        return true;
    }

    validateForm(event) {
        const isValid = utils.validateForm(this.form);
        if (!isValid) {
            event.preventDefault();
        }
        return isValid;
    }
}