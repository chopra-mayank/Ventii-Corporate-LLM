// src/agents/planGenerator.js
import { PlanGenerator } from '../core/PlanGenerator.js';
import { logger } from '../utils/logger.js';

const planGenerator = new PlanGenerator();

/**
 * Plan generation node for the event planning graph
 * Generates comprehensive event plans from validated event data
 * @param {Object} state - Current graph state
 * @returns {Object} Updated state with generated event plan
 */
export async function generatePlanNode(state) {
  logger.info('🎯 Generate Plan Node - Starting plan generation...');
  
  try {
    if (!state.eventData) {
      return {
        ...state,
        errors: [...state.errors, 'No event data for plan generation'],
        nextAction: "error"
      };
    }

    // Apply refinement-specific modifications if this is a tweak request
    let eventData = { ...state.eventData };
    if (state.userInput.tweakPrompt) {
      eventData = enhanceEventDataForRefinement(eventData, state.userInput.tweakPrompt);
      logger.info('🔧 Enhanced event data for refinement:', {
        originalRequirements: state.eventData.requirements?.length || 0,
        enhancedRequirements: eventData.requirements?.length || 0,
        tweakPrompt: state.userInput.tweakPrompt
      });
    }

    // Generate the event plan using core class
    const eventPlan = await planGenerator.generateEventPlan(eventData);
    
    if (!eventPlan || eventPlan.trim().length === 0) {
      throw new Error('Generated plan is empty');
    }

    // Add refinement notice if this was a tweak
    const finalPlan = state.userInput.tweakPrompt ? 
      addRefinementNotice(eventPlan, state.userInput.tweakPrompt) : 
      eventPlan;

    // Generate simple metadata for the workflow
    const planMetadata = {
      generatedAt: new Date().toISOString(),
      isRefinement: !!state.userInput.tweakPrompt,
      refinementPrompt: state.userInput.tweakPrompt,
      budgetPerPerson: Math.floor(eventData.budgetInINR / eventData.numberOfAttendees)
    };

    logger.info('✅ Generate Plan Node - Plan generated successfully', {
      planLength: finalPlan.length,
      isRefinement: !!state.userInput.tweakPrompt
    });
    
    return {
      ...state,
      eventPlan: finalPlan,
      rawPlanResult: eventPlan,
      planMetadata,
      nextAction: "venueSearch"
    };

  } catch (error) {
    logger.error('❌ Generate Plan Node failed:', error.message);
    
    // Try to generate fallback plan using core class
    try {
      const fallbackPlan = planGenerator.generateFallbackPlan(state.eventData);
      
      return {
        ...state,
        eventPlan: fallbackPlan,
        warnings: [...state.warnings, `Plan generation failed: ${error.message}`, 'Using fallback plan generation'],
        planMetadata: {
          isFallback: true,
          originalError: error.message,
          generatedAt: new Date().toISOString()
        },
        nextAction: "venueSearch"
      };
      
    } catch (fallbackError) {
      logger.error('❌ Fallback plan generation also failed:', fallbackError.message);
      
      return {
        ...state,
        errors: [...state.errors, `Plan generation failed: ${error.message}`, `Fallback also failed: ${fallbackError.message}`],
        nextAction: "error"
      };
    }
  }
}

/**
 * Enhance event data for refinement requests
 * @param {Object} eventData - Original event data
 * @param {string} tweakPrompt - Refinement instructions
 * @returns {Object} Enhanced event data
 */
function enhanceEventDataForRefinement(eventData, tweakPrompt) {
  const enhanced = { ...eventData };
  const tweakLower = tweakPrompt.toLowerCase();
  
  // Add specific requirements based on tweak prompt
  const additionalRequirements = [];
  
  // Interactive elements
  if (tweakLower.includes('interactive') || tweakLower.includes('hands-on')) {
    additionalRequirements.push('interactive sessions', 'hands-on activities');
  }
  
  // Team building focus
  if (tweakLower.includes('team building') || tweakLower.includes('team bonding')) {
    additionalRequirements.push('team building activities', 'group exercises');
  }
  
  // Technology enhancement
  if (tweakLower.includes('technology') || tweakLower.includes('digital') || tweakLower.includes('tech')) {
    additionalRequirements.push('technology integration', 'digital tools');
  }
  
  // Outdoor elements
  if (tweakLower.includes('outdoor') || tweakLower.includes('nature')) {
    additionalRequirements.push('outdoor activities', 'fresh air breaks');
  }
  
  // Networking focus
  if (tweakLower.includes('networking') || tweakLower.includes('connections')) {
    additionalRequirements.push('networking sessions', 'connection building');
  }
  
  // Cultural elements
  if (tweakLower.includes('cultural') || tweakLower.includes('local')) {
    additionalRequirements.push('cultural activities', 'local traditions');
  }
  
  // Speaker enhancements
  if (tweakLower.includes('speaker') || tweakLower.includes('expert')) {
    additionalRequirements.push('guest speakers', 'industry experts');
  }
  
  // Creative elements
  if (tweakLower.includes('creative') || tweakLower.includes('innovation')) {
    additionalRequirements.push('creative workshops', 'innovation sessions');
  }
  
  // Merge requirements (remove duplicates)
  enhanced.requirements = [
    ...(enhanced.requirements || []),
    ...additionalRequirements
  ].filter((req, index, arr) => arr.indexOf(req) === index);
  
  // Adjust duration if specified
  if (tweakLower.includes('extend') || tweakLower.includes('longer')) {
    enhanced.durationInHours = Math.min(12, enhanced.durationInHours + 2);
  } else if (tweakLower.includes('shorter') || tweakLower.includes('compact')) {
    enhanced.durationInHours = Math.max(2, enhanced.durationInHours - 2);
  }
  
  return enhanced;
}

/**
 * Add refinement notice to the generated plan
 * @param {string} originalPlan - Original generated plan
 * @param {string} tweakPrompt - Refinement instructions
 * @returns {string} Plan with refinement notice
 */
function addRefinementNotice(originalPlan, tweakPrompt) {
  const refinementNotice = `\n## 🔧 REFINEMENTS APPLIED\n**User Request**: ${tweakPrompt}\n*The plan below has been adjusted to incorporate your requested changes.*\n\n`;
  
  // Find insertion point (after event brief)
  const briefEndIndex = originalPlan.indexOf('## DETAILED ITINERARY');
  if (briefEndIndex !== -1) {
    return originalPlan.slice(0, briefEndIndex) + 
           refinementNotice + 
           originalPlan.slice(briefEndIndex);
  } else {
    // If structure is different, add at the beginning
    return refinementNotice + originalPlan;
  }
}