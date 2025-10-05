// ===========================
// WebsiteGenerator.validation.js
// ===========================

WebsiteGenerator.prototype.validateStep = function(stepId) {
  const step = document.getElementById(stepId);
  if (!step) return true; // no step found = nothing to validate

  let isValid = true;

  // ---- Required Fields ----
  const requiredFields = step.querySelectorAll('[required]');
  requiredFields.forEach(field => {
    if (!String(field.value || '').trim()) {
      this.showFieldError(field, 'This field is required');
      isValid = false;
    } else {
      this.clearFieldError(field);
    }
  });

  // ---- Checkbox Groups (only on certain steps) ----
  // Step 1: "Which pages do you need?" → at least one required
  // Step 3: "Extra Features" → at least one required
  const enforceCheckboxOn = new Set(['step1', 'step3']);

  if (enforceCheckboxOn.has(stepId)) {
    const group = step.querySelector('.checkbox-group');
    if (group) {
      const anyChecked = !!group.querySelector('input[type="checkbox"]:checked');
      if (!anyChecked) {
        const first = group.querySelector('input[type="checkbox"]');
        if (first) this.showCheckboxError(first, 'Select at least one option');
        isValid = false;
      } else {
        const first = group.querySelector('input[type="checkbox"]');
        if (first) this.clearCheckboxError(first);
      }
    }
  }

  return isValid;
};


// ===========================
// Error Helpers
// ===========================

WebsiteGenerator.prototype.showFieldError = function(field, message) {
  this.clearFieldError(field);
  const errorDiv = document.createElement('div');
  errorDiv.className = 'field-error';
  errorDiv.textContent = message;
  field.parentNode.appendChild(errorDiv);
  field.classList.add('error');
};

WebsiteGenerator.prototype.clearFieldError = function(field) {
  const errorDiv = field.parentNode.querySelector('.field-error');
  if (errorDiv) errorDiv.remove();
  field.classList.remove('error');
};

WebsiteGenerator.prototype.showCheckboxError = function(field, message) {
  const group = field.closest('.checkbox-group');
  if (group && !group.querySelector('.field-error')) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.textContent = message;
    group.appendChild(errorDiv);
  }
};

WebsiteGenerator.prototype.clearCheckboxError = function(field) {
  const group = field.closest('.checkbox-group');
  const errorDiv = group?.querySelector('.field-error');
  if (errorDiv) errorDiv.remove();
};
