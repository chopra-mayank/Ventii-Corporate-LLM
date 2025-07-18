// src/agents/inputParser.js
import { InputParser } from '../core/InputParser.js';
import { validateNaturalInput } from '../utils/validation.js';
import { logger } from '../utils/logger.js';

const inputParser = new InputParser();

/**
 * Parse input node for the event planning graph
 * Converts natural language input into structured event data
 * @param {Object} state - Current graph state
 * @returns {Object} Updated state with parsed event data
 */
export async function parseInputNode(state) {
  logger.info('🧠 Parse Input Node - Starting input parsing...');
  
  try {
    const naturalInput = state.userInput.naturalInput;
    const tweakPrompt = state.userInput.tweakPrompt;
    
    // Validate input format and length
    const inputValidationErrors = validateNaturalInput(naturalInput);
    if (inputValidationErrors.length > 0) {
      return {
        ...state,
        errors: [...state.errors, ...inputValidationErrors],
        nextAction: "error"
      };
    }

    // Combine input with tweak if this is a refinement request
    let processedInput = naturalInput;
    if (tweakPrompt) {
      processedInput = `${naturalInput}\n\nAdditional requirements: ${tweakPrompt}`;
      logger.info('🔧 Processing refinement request:', tweakPrompt);
    }

    // Parse the input using the core InputParser
    const eventData = await inputParser.parseUserInput(processedInput);
    
    if (!eventData) {
      return {
        ...state,
        errors: [...state.errors, 'Could not understand the event requirements. Please include: event type, number of people, location, date, and budget.'],
        nextAction: "error"
      };
    }

    // Apply basic refinements if this is a tweak request
    const refinedEventData = tweakPrompt ? 
      applyBasicRefinements(eventData, tweakPrompt) : 
      eventData;

    logger.info('✅ Parse Input Node - Successfully parsed input:', {
      eventType: refinedEventData.eventType,
      attendees: refinedEventData.numberOfAttendees,
      location: refinedEventData.location,
      budget: refinedEventData.budgetInINR,
      isRefinement: !!tweakPrompt
    });
    
    return {
      ...state,
      eventData: refinedEventData,
      rawParseResult: JSON.stringify(eventData, null, 2),
      nextAction: "validate"
    };

  } catch (error) {
    logger.error('❌ Parse Input Node failed:', error.message);
    
    return {
      ...state,
      errors: [...state.errors, `Parsing failed: ${error.message}`],
      nextAction: "error"
    };
  }
}

/**
 * Apply basic refinement modifications to parsed event data
 * @param {Object} eventData - Parsed event data
 * @param {string} tweakPrompt - Refinement instructions
 * @returns {Object} Modified event data
 */
function applyBasicRefinements(eventData, tweakPrompt) {
  const refinedData = { ...eventData };
  const tweakLower = tweakPrompt.toLowerCase();
  
  // Extract additional requirements from tweak prompt
  const additionalRequirements = [];
  
  // Simple keyword-based requirement extraction
  const requirementKeywords = {
    'interactive': ['interactive', 'engagement', 'hands-on'],
    'team building': ['team building', 'team bonding', 'bonding'],
    'outdoor': ['outdoor', 'outside', 'garden'],
    'technology': ['technology', 'tech', 'digital'],
    'premium': ['premium', 'luxury', 'high-end'],
    'networking': ['networking', 'connections'],
    'guest speakers': ['speaker', 'expert', 'industry'],
    'cultural': ['cultural', 'traditional', 'local']
  };
  
  for (const [requirement, keywords] of Object.entries(requirementKeywords)) {
    if (keywords.some(keyword => tweakLower.includes(keyword))) {
      additionalRequirements.push(requirement);
    }
  }
  
  // Duration modifications
  if (tweakLower.includes('half day') || tweakLower.includes('half-day')) {
    refinedData.durationInHours = 4;
  } else if (tweakLower.includes('full day') || tweakLower.includes('full-day')) {
    refinedData.durationInHours = 8;
  } else if (tweakLower.includes('multi-day') || tweakLower.includes('multiple days')) {
    refinedData.durationInHours = 16; // 2 days
  }
  
  // Merge with existing requirements (remove duplicates)
  refinedData.requirements = [
    ...(refinedData.requirements || []),
    ...additionalRequirements
  ].filter((req, index, arr) => arr.indexOf(req) === index);
  
  // Budget adjustments for premium requirements
  if (additionalRequirements.includes('premium') && refinedData.budgetInINR) {
    refinedData.budgetInINR = Math.floor(refinedData.budgetInINR * 1.3); // 30% increase for premium
  }
  
  logger.info('🔧 Applied basic refinements:', {
    additionalRequirements,
    finalRequirements: refinedData.requirements
  });
  
  return refinedData;
}