// src/agents/venueSearcher.js
import { VenueSearcher } from '../core/VenueSearcher.js';
import { logger } from '../utils/logger.js';

const venueSearcher = new VenueSearcher();

/**
 * Venue search node for the event planning graph
 * Searches for suitable venues based on event requirements
 * @param {Object} state - Current graph state
 * @returns {Object} Updated state with venue suggestions
 */
export async function searchVenuesNode(state) {
  logger.info('🏢 Search Venues Node - Starting venue search...');
  
  try {
    if (!state.eventData) {
      return {
        ...state,
        errors: [...state.errors, 'No event data for venue search'],
        nextAction: "error"
      };
    }

    // Enhance search criteria based on refinements
    const enhancedEventData = enhanceSearchCriteria(state.eventData, state.userInput.tweakPrompt);
    
    // Perform venue search using core class
    const venueSearchResults = await venueSearcher.findVenues(enhancedEventData);
    
    // The core VenueSearcher already handles processing and fallbacks
    const processedVenues = Array.isArray(venueSearchResults) ? venueSearchResults : [];
    
    // Generate metadata for the workflow
    const venueMetadata = {
      searchedAt: new Date().toISOString(),
      totalResults: processedVenues.length,
      searchCriteria: {
        location: enhancedEventData.location,
        capacity: enhancedEventData.numberOfAttendees,
        requirements: enhancedEventData.requirements || [],
        eventType: enhancedEventData.eventType
      },
      isRefinement: !!state.userInput.tweakPrompt
    };

    logger.info('✅ Search Venues Node - Venue search completed', {
      venuesFound: processedVenues.length,
      isRefinement: !!state.userInput.tweakPrompt
    });
    
    return {
      ...state,
      venues: processedVenues,
      rawVenueResult: JSON.stringify(venueSearchResults, null, 2),
      venueMetadata,
      success: true,
      nextAction: "END"
    };

  } catch (error) {
    logger.error('❌ Search Venues Node failed:', error.message);
    
    return {
      ...state,
      venues: [],
      warnings: [
        ...state.warnings,
        `Venue search failed: ${error.message}`,
        'Manual venue selection will be required'
      ],
      venueMetadata: {
        failedCompletely: true,
        searchedAt: new Date().toISOString()
      },
      success: true,
      nextAction: "END"
    };
  }
}

/**
 * Enhance search criteria based on event data and refinements
 * @param {Object} eventData - Original event data
 * @param {string} tweakPrompt - Refinement prompt (optional)
 * @returns {Object} Enhanced search criteria
 */
function enhanceSearchCriteria(eventData, tweakPrompt = null) {
  const enhanced = { ...eventData };
  
  if (tweakPrompt) {
    const tweakLower = tweakPrompt.toLowerCase();
    const additionalRequirements = [...(enhanced.requirements || [])];
    
    // Add venue-specific requirements based on tweaks
    if (tweakLower.includes('outdoor') || tweakLower.includes('garden')) {
      additionalRequirements.push('outdoor', 'garden');
    }
    
    if (tweakLower.includes('premium') || tweakLower.includes('luxury')) {
      additionalRequirements.push('premium', 'luxury');
    }
    
    if (tweakLower.includes('technology') || tweakLower.includes('tech')) {
      additionalRequirements.push('advanced A/V', 'tech facilities');
    }
    
    if (tweakLower.includes('beach') || tweakLower.includes('resort')) {
      additionalRequirements.push('beach', 'resort');
    }
    
    if (tweakLower.includes('traditional') || tweakLower.includes('cultural')) {
      additionalRequirements.push('traditional', 'cultural venue');
    }
    
    enhanced.requirements = additionalRequirements.filter((req, index, arr) => 
      arr.indexOf(req) === index
    );
  }
  
  return enhanced;
}