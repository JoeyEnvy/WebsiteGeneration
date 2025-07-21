WebsiteGenerator.prototype.validateStep = function(stepId) {
  const step = document.getElementById(stepId);

  // ✅ Only validate visible required fields
  const requiredFields = Array.from(step.querySelectorAll('[required]'))
    .filter(field => field.offsetParent !== null);

  let isValid = true;

  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      this.showFieldError(field, 'This field is required');
      isValid = false;
    } else {
      this.clearFieldError(field);
    }
  });

  // ✅ At least one checkbox must be selected, if any exist
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
};

WebsiteGenerator.prototype.showFieldError = function(field, message) {
  this.clearFieldError(field);
  const errorDiv = document.createElement('div');
  errorDiv.className = 'field-error';
  errorDiv.innerHTML = message;
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
    errorDiv.innerHTML = message;
    group.appendChild(errorDiv);
  }
};

WebsiteGenerator.prototype.clearCheckboxError = function(field) {
  const group = field.closest('.checkbox-group');
  const errorDiv = group?.querySelector('.field-error');
  if (errorDiv) errorDiv.remove();
};
