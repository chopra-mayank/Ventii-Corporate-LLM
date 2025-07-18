import { logger } from '../utils/logger.js';

export async function errorHandlerNode(state) {
  logger.error('❌ Error Handler Node - Processing errors:', state.errors);

  try {
    const errorCategories = categorizeErrors(state.errors);
    const userMessage = generateUserFriendlyError(errorCategories, state);
    logErrorDetails(state, errorCategories);

    return {
      ...state,
      success: false,
      error: userMessage,
      errorDetails: {
        categories: errorCategories,
        recoverable: isRecoverable(errorCategories),
        suggestions: getRecoverySuggestions(errorCategories)
      },
      nextAction: "END"
    };
  } catch (error) {
    logger.error('Error handler itself failed:', error.message);

    return {
      ...state,
      success: false,
      error: 'System error occurred. Please try again.',
      nextAction: "END"
    };
  }
}

function categorizeErrors(errors) {
  const categories = {
    validation: [],
    parsing: [],
    external: [],
    system: [],
    unknown: []
  };

  errors.forEach(error => {
    const errorLower = error.toLowerCase();

    if (errorLower.includes('validation') || errorLower.includes('invalid')) {
      categories.validation.push(error);
    } else if (errorLower.includes('parsing') || errorLower.includes('understand')) {
      categories.parsing.push(error);
    } else if (errorLower.includes('api') || errorLower.includes('network') || errorLower.includes('timeout')) {
      categories.external.push(error);
    } else if (errorLower.includes('system') || errorLower.includes('internal')) {
      categories.system.push(error);
    } else {
      categories.unknown.push(error);
    }
  });

  return categories;
}

function generateUserFriendlyError(errorCategories, state) {
  if (errorCategories.validation.length > 0) {
    return `Please check your input: ${errorCategories.validation[0]}`;
  }

  if (errorCategories.parsing.length > 0) {
    return 'I couldn\'t understand your event requirements. Please include: event type, number of people, location, date, and budget.';
  }

  if (errorCategories.external.length > 0) {
    return 'Some external services are temporarily unavailable. I\'ll provide a basic plan, but some features may be limited.';
  }

  if (errorCategories.system.length > 0) {
    return 'A system error occurred. Please try again in a moment.';
  }

  return 'Something went wrong. Please try rephrasing your request or contact support if the issue persists.';
}

function logErrorDetails(state, errorCategories) {
  logger.error('Detailed error analysis:', {
    originalInput: state.userInput?.naturalInput,
    tweakPrompt: state.userInput?.tweakPrompt,
    errorCategories,
    currentState: {
      hasEventData: !!state.eventData,
      hasPlan: !!state.eventPlan,
      hasVenues: !!state.venues,
      warnings: state.warnings?.length || 0
    },
    timestamp: new Date().toISOString()
  });
}

function isRecoverable(errorCategories) {
  if (errorCategories.validation.length > 0 || errorCategories.parsing.length > 0) {
    return true;
  }

  if (errorCategories.external.length > 0 && errorCategories.system.length === 0) {
    return true;
  }

  return false;
}

function getRecoverySuggestions(errorCategories) {
  const suggestions = [];

  if (errorCategories.validation.length > 0) {
    suggestions.push('Check that all required fields are provided');
    suggestions.push('Ensure dates are in the future and budget is reasonable');
    suggestions.push('Verify location is a valid city name');
  }

  if (errorCategories.parsing.length > 0) {
    suggestions.push('Include more details about your event');
    suggestions.push('Specify: event type, attendee count, location, date, and budget');
    suggestions.push('Use clear, simple language');
  }

  if (errorCategories.external.length > 0) {
    suggestions.push('Try again in a few minutes');
    suggestions.push('Check your internet connection');
    suggestions.push('Some advanced features may be temporarily unavailable');
  }

  if (errorCategories.system.length > 0) {
    suggestions.push('Wait a moment and try again');
    suggestions.push('Contact support if the problem persists');
  }

  return suggestions;
}