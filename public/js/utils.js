// Debounce function for form inputs
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Form validation
function validateForm(formElement) {
    const requiredFields = formElement.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            isValid = false;
            showFieldError(field, 'This field is required');
        } else {
            clearFieldError(field);
        }
    });

    return isValid;
}

// File upload handling
function handleFileUpload(file) {
    return new Promise((resolve, reject) => {
        if (file.size > CONFIG.MAX_FILE_SIZE) {
            reject(new Error('File size exceeds limit'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
    });
}

// API request wrapper
async function apiRequest(endpoint, options = {}) {
    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${auth.token}`,
            'Content-Type': 'application/json',
        },
    };

    try {
        const response = await fetch(
            `${CONFIG.API_URL}${endpoint}`,
            { ...defaultOptions, ...options }
        );

        if (!response.ok) throw new Error('API request failed');
        return await response.json();
    } catch (error) {
        ErrorHandler.show(error.message);
        throw error;
    }
}