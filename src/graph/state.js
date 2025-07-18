// src/graph/state.js
import { z } from "zod";

export const eventPlannerStateSchema = z.object({
  // User input data
  userInput: z.object({
    naturalInput: z.string().min(10, "Input must be at least 10 characters"),
    tweakPrompt: z.string().optional(),
  }),

  // Parsed and validated event data
  eventData: z.object({
    eventType: z.enum(["training", "conference", "offsite", "seminar", "workshop", "meeting"]).optional(),
    numberOfAttendees: z.number().min(1).max(1000).optional(),
    location: z.string().min(2).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format").optional(),
    budgetInINR: z.number().min(5000).optional(),
    durationInHours: z.number().min(1).max(24).optional(),
    requirements: z.array(z.string()).default([]),
  }).optional(),

  // Raw LLM responses for debugging
  rawParseResult: z.string().optional(),
  rawPlanResult: z.string().optional(),
  rawVenueResult: z.string().optional(),

  // Generated outputs
  eventPlan: z.string().optional(),
  venues: z.array(z.object({
    name: z.string(),
    url: z.string(),
    description: z.string(),
    snippet: z.string().optional(),
    capacityMatch: z.string().optional(),
    estimatedCostRange: z.string().optional(),
    suitabilityScore: z.number().optional(),
    features: z.array(z.string()).optional(),
    bookingUrgency: z.string().optional(),
  })).default([]),

  // Metadata and analytics
  planMetadata: z.object({
    generatedAt: z.string(),
    isRefinement: z.boolean(),
    refinementPrompt: z.string().optional(),
    planFeatures: z.object({
      hasCustomRequirements: z.boolean(),
      budgetPerPerson: z.number(),
      complexity: z.string(),
      estimatedPreparationTime: z.string(),
    }),
    compliance: z.object({
      budgetAligned: z.boolean(),
      timelineRealistic: z.boolean(),
      locationAppropriate: z.boolean(),
    }),
    isFallback: z.boolean().optional(),
    originalError: z.string().optional(),
  }).optional(),

  venueMetadata: z.object({
    searchedAt: z.string(),
    totalResults: z.number(),
    searchCriteria: z.object({
      location: z.string(),
      capacity: z.number(),
      requirements: z.array(z.string()),
      eventType: z.string(),
    }),
    resultQuality: z.number(),
    hasHighQualityOptions: z.boolean(),
    coversPriceRange: z.boolean(),
    searchStrategy: z.string(),
    isFallback: z.boolean().optional(),
    failedCompletely: z.boolean().optional(),
  }).optional(),

  validationMetadata: z.object({
    originalValid: z.boolean(),
    sanitized: z.boolean(),
    businessRulesApplied: z.boolean(),
    validatedAt: z.string(),
  }).optional(),

  // Timing and performance
  generationTime: z.string().optional(),
  timestamp: z.string().optional(),
  cached: z.boolean().default(false),

  nextAction: z.enum(["parse", "validate", "plan", "venueSearch", "END", "error", "tweak"]),
  
  // Error and warning handling
  errors: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  
  // Success indicators
  success: z.boolean().default(false),
  
  // Error details for advanced error handling
  errorDetails: z.object({
    categories: z.object({
      validation: z.array(z.string()),
      parsing: z.array(z.string()),
      external: z.array(z.string()),
      system: z.array(z.string()),
      unknown: z.array(z.string()),
    }),
    recoverable: z.boolean(),
    suggestions: z.array(z.string()),
  }).optional(),
});

/**
 * JavaScript equivalent of the inferred type (for JSDoc documentation)
 * @typedef {Object} EventPlannerState
 * @property {Object} userInput - User input data
 * @property {string} userInput.naturalInput - Natural language input
 * @property {string} [userInput.tweakPrompt] - Optional refinement prompt
 * @property {Object} [eventData] - Parsed event data
 * @property {string} [eventData.eventType] - Type of event
 * @property {number} [eventData.numberOfAttendees] - Number of attendees
 * @property {string} [eventData.location] - Event location
 * @property {string} [eventData.date] - Event date (YYYY-MM-DD)
 * @property {number} [eventData.budgetInINR] - Budget in INR
 * @property {number} [eventData.durationInHours] - Duration in hours
 * @property {string[]} [eventData.requirements] - Special requirements
 * @property {string} [rawParseResult] - Raw parsing result
 * @property {string} [rawPlanResult] - Raw plan generation result
 * @property {string} [rawVenueResult] - Raw venue search result
 * @property {string} [eventPlan] - Generated event plan
 * @property {Array} [venues] - Array of venue suggestions
 * @property {Object} [planMetadata] - Plan generation metadata
 * @property {Object} [venueMetadata] - Venue search metadata
 * @property {Object} [validationMetadata] - Validation metadata
 * @property {string} [generationTime] - Total generation time
 * @property {string} [timestamp] - Timestamp of generation
 * @property {boolean} cached - Whether result was cached
 * @property {string} nextAction - Next action in the flow
 * @property {string[]} errors - Array of errors
 * @property {string[]} warnings - Array of warnings
 * @property {boolean} success - Success indicator
 * @property {Object} [errorDetails] - Detailed error information
 */

/**
 * Initial state factory function
 * Creates a properly initialized state object
 * @param {string} naturalInput - Natural language input
 * @param {string|null} tweakPrompt - Optional refinement prompt
 * @returns {EventPlannerState} Initial state object
 */
export function createInitialState(naturalInput, tweakPrompt = null) {
  const baseState = {
    userInput: {
      naturalInput
    },
    nextAction: "parse",
    errors: [],
    warnings: [],
    success: false,
    cached: false,
    venues: []
  };

  // Only add tweakPrompt if it's a non-empty string
  if (tweakPrompt && typeof tweakPrompt === 'string' && tweakPrompt.trim().length > 0) {
    baseState.userInput.tweakPrompt = tweakPrompt;
  }

  return baseState;
}

/**
 * State validation helper
 * Validates state object against schema
 * @param {Object} state - State object to validate
 * @returns {EventPlannerState} Validated state object
 * @throws {Error} If validation fails
 */
export function validateState(state) {
  try {
    return eventPlannerStateSchema.parse(state);
  } catch (error) {
    throw new Error(`State validation failed: ${error.message}`);
  }
}

/**
 * State transformation helpers
 * Utility functions for working with state objects
 */
export const StateHelpers = {
  /**
   * Check if state has required data for specific operations
   */
  
  /**
   * Check if state has event data
   * @param {EventPlannerState} state - State object
   * @returns {boolean} True if has event data
   */
  hasEventData: (state) => !!state.eventData,
  
  /**
   * Check if state has generated plan
   * @param {EventPlannerState} state - State object
   * @returns {boolean} True if has plan
   */
  hasPlan: (state) => !!state.eventPlan,
  
  /**
   * Check if state has venues
   * @param {EventPlannerState} state - State object
   * @returns {boolean} True if has venues
   */
  hasVenues: (state) => Array.isArray(state.venues) && state.venues.length > 0,
  
  /**
   * Check if state has errors
   * @param {EventPlannerState} state - State object
   * @returns {boolean} True if has errors
   */
  hasErrors: (state) => Array.isArray(state.errors) && state.errors.length > 0,
  
  /**
   * Check if state has warnings
   * @param {EventPlannerState} state - State object
   * @returns {boolean} True if has warnings
   */
  hasWarnings: (state) => Array.isArray(state.warnings) && state.warnings.length > 0,
  
  /**
   * Check if this is a refinement request
   * @param {EventPlannerState} state - State object
   * @returns {boolean} True if is refinement
   */
  isRefinement: (state) => !!state.userInput?.tweakPrompt,
  
  /**
   * Check if execution is complete
   * @param {EventPlannerState} state - State object
   * @returns {boolean} True if complete
   */
  isComplete: (state) => state.success && state.nextAction === "END",
  
  /**
   * Get execution progress as percentage
   * @param {EventPlannerState} state - State object
   * @returns {number} Progress percentage (0-100)
   */
  getProgress: (state) => {
    const steps = ["parse", "validate", "plan", "venueSearch"]; // Updated step name
    const currentIndex = steps.indexOf(state.nextAction);
    
    if (state.nextAction === "END") return 100;
    if (state.nextAction === "error") return currentIndex >= 0 ? (currentIndex / steps.length) * 100 : 0;
    if (currentIndex === -1) return 0;
    
    return (currentIndex / steps.length) * 100;
  },
  
  /**
   * Get summary of what has been completed
   * @param {EventPlannerState} state - State object
   * @returns {string[]} Array of completed step names
   */
  getCompletedSteps: (state) => {
    const completed = [];
    
    if (StateHelpers.hasEventData(state)) completed.push("parse", "validate");
    if (StateHelpers.hasPlan(state)) completed.push("plan");
    if (StateHelpers.hasVenues(state)) completed.push("venueSearch"); // Updated step name
    
    return completed;
  },
  
  
  
  /**
   * Generate executive summary
   * @param {EventPlannerState} state - State object
   * @returns {Object} Executive summary
   */
  getSummary: (state) => {
  if (!state.success) {
    return {
      status: 'Failed',
      message: state.errors.join('; '),
      progress: StateHelpers.getProgress(state)
    };
  }
  
  const eventData = state.eventData;
  
  return {
    status: 'Success',
    eventType: eventData?.eventType,
    attendees: eventData?.numberOfAttendees,
    location: eventData?.location,
    budget: eventData?.budgetInINR,
    venuesFound: state.venues?.length || 0,
    hasWarnings: StateHelpers.hasWarnings(state),
    isRefinement: StateHelpers.isRefinement(state),
    completedSteps: StateHelpers.getCompletedSteps(state),
    progress: 100
  };
}
};

/**
 * State validation rules for business logic
 */
export const StateValidation = {
  /**
   * Validate state transition is allowed
   * @param {EventPlannerState} currentState - Current state
   * @param {string} nextAction - Proposed next action
   * @returns {boolean} True if transition is allowed
   */
  canTransitionTo: (currentState, nextAction) => {
    const validTransitions = {
      "parse": ["validate", "error"],
      "validate": ["plan", "error"],
      "plan": ["venueSearch", "error"], // FIXED: Use "venueSearch" consistently
      "venueSearch": ["END", "error"], // FIXED: Use "venueSearch" consistently
      "error": ["END"],
      "END": []
    };
    
    const allowed = validTransitions[currentState.nextAction] || [];
    return allowed.includes(nextAction);
  },
  
  /**
   * Validate required data exists for state
   * @param {EventPlannerState} state - State object
   * @param {string} action - Action to validate
   * @returns {boolean} True if required data exists
   */
  hasRequiredData: (state, action) => {
    switch (action) {
      case "parse":
        return state.userInput?.naturalInput?.length >= 10;
      case "validate":
        return StateHelpers.hasEventData(state);
      case "plan":
        return StateHelpers.hasEventData(state);
      case "venueSearch": // Updated action name
        return StateHelpers.hasEventData(state);
      case "END":
        return state.success;
      default:
        return true;
    }
  }
};

/**
 * Schema inference helper for better IDE support
 * @returns {Object} Inferred schema type information
 */
export function getSchemaTypeInfo() {
  return {
    description: "Event Planner State Schema",
    version: "2.0.0",
    fields: {
      userInput: "User input data including natural language and optional tweak prompts",
      eventData: "Parsed and validated event information",
      eventPlan: "Generated comprehensive event plan",
      venues: "Array of venue suggestions with metadata",
      metadata: "Various metadata objects for tracking and analytics",
      flowControl: "Next action and execution state",
      results: "Success indicators, errors, and warnings"
    },
    validNextActions: ["parse", "validate", "plan", "venueSearch", "END", "error", "tweak"] // Updated actions
  };
}