import { config } from '../config/config.js';

/**
 * Validate parsed event input data
 * @param {Object} eventData - Parsed event data
 * @returns {Array} Array of validation errors (empty if valid)
 */
export function validateEventInput(eventData) {
  const errors = [];

  if (!eventData || typeof eventData !== 'object') {
    errors.push('Event data must be an object');
    return errors;
  }

  // Validate event type
  const validEventTypes = ['training', 'conference', 'offsite', 'seminar', 'workshop', 'meeting'];
  if (!eventData.eventType || !validEventTypes.includes(eventData.eventType)) {
    errors.push(`Event type must be one of: ${validEventTypes.join(', ')}`);
  }

  // Validate number of attendees
  if (!eventData.numberOfAttendees || 
      !Number.isInteger(eventData.numberOfAttendees) || 
      eventData.numberOfAttendees < 1 || 
      eventData.numberOfAttendees > config.maxAttendees) {
    errors.push(`Number of attendees must be between 1 and ${config.maxAttendees}`);
  }

  // Validate location
  if (!eventData.location || typeof eventData.location !== 'string' || eventData.location.trim().length < 2) {
    errors.push('Location must be a valid city name (at least 2 characters)');
  }

  // Validate date
  if (!eventData.date || !isValidDate(eventData.date)) {
    errors.push('Date must be in YYYY-MM-DD format');
  } else {
    const eventDate = new Date(eventData.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (eventDate < today) {
      errors.push('Event date cannot be in the past');
    }
    
    const maxFutureDate = new Date();
    maxFutureDate.setFullYear(maxFutureDate.getFullYear() + 2);
    
    if (eventDate > maxFutureDate) {
      errors.push('Event date cannot be more than 2 years in the future');
    }
  }

  // Validate budget
  if (!eventData.budgetInINR || 
      !Number.isInteger(eventData.budgetInINR) || 
      eventData.budgetInINR < config.minBudget) {
    errors.push(`Budget must be at least ₹${config.minBudget.toLocaleString()}`);
  }

  // Validate duration
  if (!eventData.durationInHours || 
      !Number.isInteger(eventData.durationInHours) || 
      eventData.durationInHours < 1 || 
      eventData.durationInHours > 12) {
    errors.push('Duration must be between 1 and 12 hours');
  }

  // Validate requirements array
  if (eventData.requirements && !Array.isArray(eventData.requirements)) {
    errors.push('Requirements must be an array');
  }

  return errors;
}

/**
 * Validate natural language input
 * @param {string} input - User input
 * @returns {Array} Array of validation errors (empty if valid)
 */
export function validateNaturalInput(input) {
  const errors = [];

  if (!input || typeof input !== 'string') {
    errors.push('Input must be a non-empty string');
    return errors;
  }

  const trimmedInput = input.trim();

  if (trimmedInput.length < config.minInputLength) {
    errors.push(`Input must be at least ${config.minInputLength} characters long`);
  }

  if (trimmedInput.length > config.maxInputLength) {
    errors.push(`Input must not exceed ${config.maxInputLength} characters`);
  }

  // Check for potentially malicious content
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /eval\s*\(/i,
    /document\./i,
    /window\./i
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmedInput)) {
      errors.push('Input contains potentially unsafe content');
      break;
    }
  }

  return errors;
}

/**
 * Check if a string is a valid date in YYYY-MM-DD format
 * @param {string} dateString - Date string to validate
 * @returns {boolean} True if valid date
 */
function isValidDate(dateString) {
  if (typeof dateString !== 'string') return false;
  
  // Check format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;
  
  // Check if it's a valid date
  const date = new Date(dateString);
  const timestamp = date.getTime();
  
  if (typeof timestamp !== 'number' || Number.isNaN(timestamp)) return false;
  
  // Check if the date string matches the parsed date
  return date.toISOString().startsWith(dateString);
}

/**
 * Sanitize and normalize event data
 * @param {Object} eventData - Raw event data
 * @returns {Object} Sanitized event data
 */
export function sanitizeEventData(eventData) {
  const sanitized = { ...eventData };

  // Sanitize strings
  if (sanitized.eventType) {
    sanitized.eventType = sanitized.eventType.toString().toLowerCase().trim();
  }

  if (sanitized.location) {
    sanitized.location = sanitized.location.toString().trim();
    // Capitalize first letter of each word
    sanitized.location = sanitized.location
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  // Sanitize numbers
  if (sanitized.numberOfAttendees) {
    sanitized.numberOfAttendees = Math.max(1, Math.min(config.maxAttendees, 
      parseInt(sanitized.numberOfAttendees) || 1));
  }

  if (sanitized.budgetInINR) {
    sanitized.budgetInINR = Math.max(config.minBudget, 
      parseInt(sanitized.budgetInINR) || config.minBudget);
  }

  if (sanitized.durationInHours) {
    sanitized.durationInHours = Math.max(1, Math.min(12, 
      parseInt(sanitized.durationInHours) || config.defaultEventDuration));
  }

  // Sanitize requirements array
  if (sanitized.requirements && Array.isArray(sanitized.requirements)) {
    sanitized.requirements = sanitized.requirements
      .filter(req => typeof req === 'string' && req.trim().length > 0)
      .map(req => req.toString().toLowerCase().trim())
      .slice(0, 10); // Limit to 10 requirements
  }

  return sanitized;
}

/**
 * Validate API response before sending
 * @param {Object} response - API response object
 * @returns {boolean} True if response is valid
 */
export function validateApiResponse(response) {
  if (!response || typeof response !== 'object') return false;
  
  // Must have success field
  if (typeof response.success !== 'boolean') return false;
  
  if (response.success) {
    // Successful response validation
    return !!(response.eventData && response.eventPlan && response.generationTime);
  } else {
    // Error response validation
    return !!(response.error && typeof response.error === 'string');
  }
}

/**
 * Get validation summary for debugging
 * @param {Object} data - Data to validate
 * @returns {Object} Validation summary
 */
export function getValidationSummary(data) {
  const summary = {
    isValid: true,
    errors: [],
    warnings: [],
    sanitized: null
  };

  try {
    // Validate input type
    if (typeof data === 'string') {
      summary.errors = validateNaturalInput(data);
    } else if (typeof data === 'object') {
      summary.errors = validateEventInput(data);
      summary.sanitized = sanitizeEventData(data);
    } else {
      summary.errors = ['Invalid data type'];
    }

    summary.isValid = summary.errors.length === 0;

    // Add warnings for edge cases
    if (data.numberOfAttendees && data.numberOfAttendees > 200) {
      summary.warnings.push('Large events may require special arrangements');
    }

    if (data.budgetInINR && data.numberOfAttendees && 
        (data.budgetInINR / data.numberOfAttendees) < 1000) {
      summary.warnings.push('Budget per person is quite low - may limit options');
    }

  } catch (error) {
    summary.isValid = false;
    summary.errors = [`Validation error: ${error.message}`];
  }

  return summary;
}