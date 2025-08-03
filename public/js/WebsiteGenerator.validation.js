// =======================
// ✅ validateStep with Step 4 flexibility + full checkbox group support
// =======================
WebsiteGenerator.prototype.validateStep = function (stepId) {
  const step = document.getElementById(stepId);

  if (!step) {
    console.error(`❌ Step element not found: ${stepId}`);
    return false;
  }

  let isValid = true;

  // ✅ Validate all visible required inputs or textareas
  const requiredFields = Array.from(step.querySelectorAll('[required]')).filter(field => {
    return field.offsetParent !== null;
  });

  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      this.showFieldError(field, 'This field is required');
      isValid = false;
    } else {
      this.clearFieldError(field);
    }
  });

  // ✅ Validate checkbox groups — except skip step4 enhancements
  const checkboxGroups = step.querySelectorAll('.checkbox-group');
  checkboxGroups.forEach(group => {
    const checkboxes = group.querySelectorAll('input[type="checkbox"]');
    const anyChecked = Array.from(checkboxes).some(cb => cb.checked);

const isOptionalGroup = group.classList.contains('optional-group');
const isRequired = !isOptionalGroup;


    if (isRequired && !anyChecked) {
      this.showCheckboxError(checkboxes[0], 'Select at least one option');
      isValid = false;
    } else {
      this.clearCheckboxError(checkboxes[0]);
    }
  });

  // ✅ Special validation for contact email if visible (Step 3 specific)
  const contactEmailContainer = document.getElementById('contactEmailContainer');
  const contactEmailInput = document.getElementById('contactEmail');

  if (
    stepId === 'step3' &&
    contactEmailContainer?.style.display !== 'none' &&
    contactEmailInput
  ) {
    const email = contactEmailInput.value.trim();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!validEmail) {
      this.showFieldError(contactEmailInput, 'Enter a valid email address');
      isValid = false;
    } else {
      this.clearFieldError(contactEmailInput);
    }
  }

  // 🐛 Debug if validation failed
  if (!isValid) {
    console.warn(`❌ Validation failed for ${stepId}.`);
  }

  return isValid;
};

// =======================
// 🔴 Show input error for text/textarea/email
// =======================
WebsiteGenerator.prototype.showFieldError = function (field, message) {
  this.clearFieldError(field);
  const errorDiv = document.createElement('div');
  errorDiv.className = 'field-error';
  errorDiv.textContent = message;
  field.classList.add('error');
  field.parentNode.appendChild(errorDiv);
};

// =======================
// 🟢 Remove input error display
// =======================
WebsiteGenerator.prototype.clearFieldError = function (field) {
  const errorDiv = field.parentNode.querySelector('.field-error');
  if (errorDiv) errorDiv.remove();
  field.classList.remove('error');
};

// =======================
// 🔴 Show error on checkbox group
// =======================
WebsiteGenerator.prototype.showCheckboxError = function (field, message) {
  const group = field.closest('.checkbox-group');
  if (group && !group.querySelector('.field-error')) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.innerHTML = message;
    group.appendChild(errorDiv);
  }
};

// =======================
// 🟢 Clear error from checkbox group
// =======================
WebsiteGenerator.prototype.clearCheckboxError = function (field) {
  const group = field.closest('.checkbox-group');
  const errorDiv = group?.querySelector('.field-error');
  if (errorDiv) errorDiv.remove();
};

