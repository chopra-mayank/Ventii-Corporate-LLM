// src/agents/validator.js
import { validateEventInput, sanitizeEventData, getValidationSummary } from '../utils/validation.js';
import { logger } from '../utils/logger.js';

/**
 * Validation node for the event planning graph
 * Validates and sanitizes parsed event data
 * @param {Object} state - Current graph state
 * @returns {Object} Updated state with validation results
 */
export async function validateDataNode(state) {
  logger.info('✅ Validate Data Node - Starting validation...');
  
  try {
    if (!state.eventData) {
      return {
        ...state,
        errors: [...state.errors, 'No event data to validate'],
        nextAction: "error"
      };
    }

    // Get comprehensive validation summary
    const validationSummary = getValidationSummary(state.eventData);
    
    if (!validationSummary.isValid) {
      logger.warn('Validation failed:', validationSummary.errors);
      return {
        ...state,
        errors: [...state.errors, ...validationSummary.errors],
        nextAction: "error"
      };
    }

    // Sanitize the event data
    const sanitizedData = sanitizeEventData(state.eventData);
    
    // Add any warnings from validation
    const warnings = [...state.warnings, ...validationSummary.warnings];
    
    // Perform business logic validation
    const businessValidationResults = performBusinessValidation(sanitizedData);
    
    if (businessValidationResults.errors.length > 0) {
      return {
        ...state,
        errors: [...state.errors, ...businessValidationResults.errors],
        nextAction: "error"
      };
    }

    // Add business warnings
    warnings.push(...businessValidationResults.warnings);

    logger.info('✅ Validate Data Node - Validation successful:', {
      eventType: sanitizedData.eventType,
      attendees: sanitizedData.numberOfAttendees,
      budget: sanitizedData.budgetInINR,
      hasWarnings: warnings.length > 0,
      warningCount: warnings.length
    });
    
    return {
      ...state,
      eventData: sanitizedData,
      warnings,
      validationMetadata: {
        originalValid: validationSummary.isValid,
        sanitized: true,
        businessRulesApplied: true,
        validatedAt: new Date().toISOString()
      },
      nextAction: "plan"
    };

  } catch (error) {
    logger.error('❌ Validate Data Node failed:', error.message);
    
    return {
      ...state,
      errors: [...state.errors, `Validation failed: ${error.message}`],
      nextAction: "error"
    };
  }
}

/**
 * Perform business logic validation beyond basic data validation
 * @param {Object} eventData - Sanitized event data
 * @returns {Object} Business validation results
 */
function performBusinessValidation(eventData) {
  const errors = [];
  const warnings = [];
  
  const {
    eventType,
    numberOfAttendees,
    budgetInINR,
    durationInHours,
    date,
    location,
    requirements = []
  } = eventData;

  // Business rule: Budget per person validation
  const budgetPerPerson = budgetInINR / numberOfAttendees;
  
  if (budgetPerPerson < 500) {
    errors.push('Budget is too low - minimum ₹500 per person required for a quality event');
  } else if (budgetPerPerson < 1000) {
    warnings.push('Budget per person is quite low - this may limit venue and catering options');
  }

  // Business rule: Event type and duration compatibility
  const durationCompatibility = checkEventTypeDurationCompatibility(eventType, durationInHours);
  if (!durationCompatibility.isCompatible) {
    warnings.push(durationCompatibility.message);
  }

  // Business rule: Location and budget compatibility
  const locationBudgetCheck = checkLocationBudgetCompatibility(location, budgetInINR, numberOfAttendees);
  if (locationBudgetCheck.warning) {
    warnings.push(locationBudgetCheck.warning);
  }

  // Business rule: Requirements feasibility
  const requirementsFeasibility = checkRequirementsFeasibility(requirements, budgetPerPerson, eventType);
  warnings.push(...requirementsFeasibility.warnings);
  errors.push(...requirementsFeasibility.errors);

  // Business rule: Date validation (weekends vs weekdays)
  const dateValidation = validateEventDate(date, eventType);
  if (dateValidation.warning) {
    warnings.push(dateValidation.warning);
  }

  // Business rule: Attendee count and venue compatibility
  const venueCompatibility = checkAttendeeVenueCompatibility(numberOfAttendees, location);
  if (venueCompatibility.warning) {
    warnings.push(venueCompatibility.warning);
  }

  return { errors, warnings };
}

/**
 * Check if event type and duration are compatible
 * @param {string} eventType - Type of event
 * @param {number} durationInHours - Duration in hours
 * @returns {Object} Compatibility result
 */
function checkEventTypeDurationCompatibility(eventType, durationInHours) {
  const typicalDurations = {
    'meeting': { min: 1, max: 4, optimal: 2 },
    'workshop': { min: 2, max: 8, optimal: 4 },
    'training': { min: 4, max: 16, optimal: 8 },
    'seminar': { min: 2, max: 8, optimal: 6 },
    'conference': { min: 8, max: 24, optimal: 12 },
    'offsite': { min: 8, max: 48, optimal: 16 }
  };

  const typical = typicalDurations[eventType];
  if (!typical) {
    return { isCompatible: true };
  }

  if (durationInHours < typical.min) {
    return {
      isCompatible: false,
      message: `${eventType} events typically need at least ${typical.min} hours. Consider extending duration or changing event type.`
    };
  }

  if (durationInHours > typical.max) {
    return {
      isCompatible: false,
      message: `${eventType} events are typically no longer than ${typical.max} hours. Consider reducing duration or changing event type.`
    };
  }

  if (Math.abs(durationInHours - typical.optimal) > 2) {
    return {
      isCompatible: true,
      message: `${eventType} events work best with around ${typical.optimal} hours duration.`
    };
  }

  return { isCompatible: true };
}

/**
 * Check location and budget compatibility
 * @param {string} location - Event location
 * @param {number} budget - Total budget
 * @param {number} attendees - Number of attendees
 * @returns {Object} Compatibility result
 */
function checkLocationBudgetCompatibility(location, budget, attendees) {
  const expensiveCities = ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Pune', 'Chennai'];
  const moderateCities = ['Ahmedabad', 'Kolkata', 'Surat', 'Jaipur', 'Lucknow'];
  
  const budgetPerPerson = budget / attendees;
  
  if (expensiveCities.includes(location)) {
    if (budgetPerPerson < 1500) {
      return {
        warning: `${location} is an expensive city. Consider increasing budget for better venue and catering options.`
      };
    }
  } else if (moderateCities.includes(location)) {
    if (budgetPerPerson > 5000) {
      return {
        warning: `Budget seems high for ${location}. You could potentially reduce costs or upgrade to premium options.`
      };
    }
  }

  return {};
}

/**
 * Check if requirements are feasible with given budget and event type
 * @param {Array} requirements - Event requirements
 * @param {number} budgetPerPerson - Budget per person
 * @param {string} eventType - Event type
 * @returns {Object} Feasibility results
 */
function checkRequirementsFeasibility(requirements, budgetPerPerson, eventType) {
  const warnings = [];
  const errors = [];

  requirements.forEach(requirement => {
    switch (requirement) {
      case 'premium':
        if (budgetPerPerson < 2000) {
          warnings.push('Premium requirements may not be fully achievable with current budget');
        }
        break;
        
      case 'outdoor':
        if (['conference', 'training'].includes(eventType)) {
          warnings.push('Outdoor venues may not be ideal for formal training/conference events');
        }
        break;
        
      case 'technology focus':
        if (budgetPerPerson < 1200) {
          warnings.push('Technology-focused events typically require higher budget for equipment');
        }
        break;
        
      case 'guest speakers':
        if (budgetPerPerson < 1000) {
          warnings.push('Professional speakers may require additional budget allocation');
        }
        break;
    }
  });

  return { warnings, errors };
}

/**
 * Validate event date for business appropriateness
 * @param {string} date - Event date in YYYY-MM-DD format
 * @param {string} eventType - Event type
 * @returns {Object} Date validation result
 */
function validateEventDate(date, eventType) {
  const eventDate = new Date(date);
  const dayOfWeek = eventDate.getDay(); // 0 = Sunday, 6 = Saturday
  
  const corporateEventTypes = ['training', 'conference', 'seminar', 'meeting'];
  const casualEventTypes = ['offsite', 'workshop'];

  if (corporateEventTypes.includes(eventType) && (dayOfWeek === 0 || dayOfWeek === 6)) {
    return {
      warning: 'Corporate events are typically scheduled on weekdays for better attendance'
    };
  }

  if (casualEventTypes.includes(eventType) && dayOfWeek >= 1 && dayOfWeek <= 5) {
    return {
      warning: 'Team offsites and workshops often work better on weekends when people are more relaxed'
    };
  }

  return {};
}

/**
 * Check attendee count and venue availability in location
 * @param {number} attendees - Number of attendees
 * @param {string} location - Event location
 * @returns {Object} Venue compatibility result
 */
function checkAttendeeVenueCompatibility(attendees, location) {
  const smallCities = ['Mysore', 'Kochi', 'Vadodara', 'Nashik', 'Rajkot'];
  
  if (smallCities.includes(location) && attendees > 200) {
    return {
      warning: `Large events (${attendees} people) may have limited venue options in ${location}`
    };
  }

  if (attendees > 500) {
    return {
      warning: 'Very large events require specialized convention centers and advance booking'
    };
  }

  return {};
}