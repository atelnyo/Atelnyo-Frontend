/**
 * src/accessibility/utils/formAccessibility.js
 *
 * Form accessibility utilities.
 *
 * Provides:
 *   - getFormFieldIds: generates consistent IDs for input/description/error
 *   - createFieldProps: returns aria props for an accessible form field
 *   - validateFieldAccessibility: checks a form field for common a11y issues
 *
 * These are pure utility functions, not React components.
 */

let _fieldCounter = 0;

/**
 * Generate unique field IDs for label/description/error association.
 * @param {string} baseId - Optional base ID
 * @returns {object} { inputId, descriptionId, errorId }
 */
export function getFormFieldIds(baseId) {
  const id = baseId || `a11y-field-${++_fieldCounter}`;
  return {
    inputId: `${id}-input`,
    descriptionId: `${id}-desc`,
    errorId: `${id}-error`,
    labelId: `${id}-label`,
  };
}

/**
 * Create ARIA props for an accessible form field.
 *
 * @param {object} options
 * @param {string} options.fieldId - The field's base ID
 * @param {string} options.error - Current error message (if any)
 * @param {string} options.description - Help text / description
 * @param {boolean} options.required - Whether the field is required
 * @returns {object} Props to spread on the input element
 */
export function createFieldProps({ fieldId, error, description, required }) {
  const ids = getFormFieldIds(fieldId);

  const ariaProps = {};

  // Link to error message
  if (error) {
    ariaProps['aria-invalid'] = 'true';
    ariaProps['aria-describedby'] = ids.errorId;
  }

  // Link to description
  if (description && !error) {
    ariaProps['aria-describedby'] = ids.descriptionId;
  } else if (description && error) {
    ariaProps['aria-describedby'] = `${ids.errorId} ${ids.descriptionId}`;
  }

  // Required state
  if (required) {
    ariaProps['aria-required'] = 'true';
  }

  return { ids, ariaProps };
}

/**
 * Validate a form field for common accessibility issues.
 *
 * @param {object} field
 * @param {string} field.name - Field name/label
 * @param {string} field.type - Input type
 * @param {string} field.value - Current value
 * @param {boolean} field.required - Whether required
 * @param {string} field.label - Label text
 * @returns {object[]} Array of issues { severity, code, message }
 */
export function validateFieldAccessibility(field) {
  const issues = [];

  if (!field.label && !field['aria-label'] && !field['aria-labelledby']) {
    issues.push({
      severity: 'error',
      code: 'INPUT_NO_LABEL',
      message: `The "${field.name || 'input'}" field needs a label so screen-reader users know what information to enter.`,
    });
  }

  if (field.required && !field.value) {
    // This is a validation issue, not strictly a11y — but useful for the a11y dashboard
    issues.push({
      severity: 'info',
      code: 'FIELD_EMPTY_REQUIRED',
      message: `The "${field.name || 'input'}" field is required.`,
    });
  }

  return issues;
}

/**
 * Create accessible error summary data.
 *
 * @param {object[]} errors - Array of { fieldName, message }
 * @returns {object} { summary, fieldErrors }
 */
export function createErrorSummary(errors) {
  if (!errors || errors.length === 0) return { summary: '', fieldErrors: {} };

  const fieldErrors = {};
  errors.forEach(({ fieldName, message }) => {
    if (fieldName) {
      fieldErrors[fieldName] = message;
    }
  });

  const count = errors.length;
  const summary = count === 1
    ? `There is 1 error in this form.`
    : `There are ${count} errors in this form.`;

  return { summary, fieldErrors };
}
