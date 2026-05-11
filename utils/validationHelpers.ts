/**
 * Validation helper functions for user input
 */

export interface ValidationResult {
  isValid: boolean;
  message?: string;
}

/**
 * Validate phone number format and length
 */
export function validatePhoneNumber(phone: any): ValidationResult {
  if (!phone) {
    return { isValid: false, message: 'Phone number is required.' };
  }

  const phoneStr = String(phone).trim();
  
  if (!phoneStr) {
    return { isValid: false, message: 'Phone number cannot be empty.' };
  }

  // Check if phone contains only numbers
  if (!/^\d+$/.test(phoneStr)) {
    return { 
      isValid: false, 
      message: 'Phone number must contain only numbers. Please remove any letters, spaces, or special characters.' 
    };
  }

  // Check phone number length (reasonable range for international numbers)
  if (phoneStr.length < 10) {
    return { 
      isValid: false, 
      message: 'Phone number is too short. Please enter at least 10 digits.' 
    };
  }

  if (phoneStr.length > 15) {
    return { 
      isValid: false, 
      message: 'Phone number is too long. Please enter no more than 15 digits.' 
    };
  }

  return { isValid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: any): ValidationResult {

  const emailStr = String(email || '').trim();
  
  if (!emailStr) {
    return { isValid: true }; // Empty email is allowed
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailStr)) {
    return { 
      isValid: false, 
      message: 'Please enter a valid email address (e.g., example@email.com).' 
    };
  }

  // Check for reasonable email length
  if (emailStr.length > 254) {
    return { 
      isValid: false, 
      message: 'Email address is too long.' 
    };
  }

  return { isValid: true };
}

/**
 * Validate password strength
 */
export function validatePassword(password: any): ValidationResult {
  if (!password) {
    return { isValid: false, message: 'Password is required.' };
  }

  return { isValid: true };
}

/**
 * Validate required string field
 */
export function validateRequiredString(value: any, fieldName: string): ValidationResult {
  if (!value) {
    return { 
      isValid: false, 
      message: `${fieldName} is required.` 
    };
  }

  const valueStr = String(value).trim();
  
  if (!valueStr) {
    return { 
      isValid: false, 
      message: `${fieldName} cannot be empty.` 
    };
  }

  if (valueStr.length > 255) {
    return { 
      isValid: false, 
      message: `${fieldName} is too long. Please use fewer than 255 characters.` 
    };
  }

  return { isValid: true };
}

/**
 * Validate optional string field
 */
export function validateOptionalString(value: any, fieldName: string, maxLength: number = 255): ValidationResult {
  if (!value) {
    return { isValid: true }; // Optional field
  }

  const valueStr = String(value).trim();
  
  if (!valueStr) {
    return { isValid: true }; // Empty optional field is allowed
  }

  if (valueStr.length > maxLength) {
    return { 
      isValid: false, 
      message: `${fieldName} is too long. Please use fewer than ${maxLength} characters.` 
    };
  }

  return { isValid: true };
}

/**
 * Sanitize string input by trimming and handling null/undefined
 */
export function sanitizeString(value: any): string | null {
  if (!value) {
    return null;
  }

  const sanitized = String(value).trim();
  return sanitized || null;
}

/**
 * Validate URL format (for profile pictures, etc.)
 */
export function validateUrl(url: any, fieldName: string = 'URL'): ValidationResult {
  if (!url) {
    return { isValid: true }; // URL is optional
  }

  const urlStr = String(url).trim();
  
  if (!urlStr) {
    return { isValid: true }; // Empty URL is allowed
  }

  try {
    new URL(urlStr);
    return { isValid: true };
  } catch {
    return { 
      isValid: false, 
      message: `${fieldName} must be a valid URL (e.g., https://example.com).` 
    };
  }
}

/**
 * Comprehensive signup data validation
 */
export function validateSignupData(signupData: any): ValidationResult {
  const { name, email, password, phone, roleType } = signupData;

  // Validate required fields
  const nameValidation = validateRequiredString(name, 'Name');
  if (!nameValidation.isValid) return nameValidation;

  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) return passwordValidation;

  const phoneValidation = validatePhoneNumber(phone);
  if (!phoneValidation.isValid) return phoneValidation;

  const roleValidation = validateRequiredString(roleType, 'Role type');
  if (!roleValidation.isValid) return roleValidation;

  // Validate optional fields
  const emailValidation = validateEmail(email);
  if (!emailValidation.isValid) return emailValidation;

  return { isValid: true };
}
