import axios from 'axios';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

export class VenueSearcher {
  constructor() {
    this.tavilyApiKey = config.tavilyApiKey;
  }

  /**
   * Find suitable venues for the event
   * @param {Object} eventData - Event details
   * @returns {Array|string} Array of venues or error message
   */
  async findVenues(eventData) {
    if (!this.tavilyApiKey) {
      logger.warn('Tavily API key not configured - venue search disabled');
      return this.getFallbackVenues(eventData);
    }

    const query = this.buildSearchQuery(eventData);
    
    try {
      logger.info(`🏢 Searching venues: "${query}"`);

      const response = await axios.post(
        "https://api.tavily.com/search",
        {
          query,
          search_depth: "basic",
          max_results: 5,
          include_answer: false,
          include_domains: [
            "marriott.com",
            "hyatt.com", 
            "itchotels.com",
            "theleela.com",
            "oberoi.com",
            "tajhotels.com",
            "radisson.com",
            "novotel.com"
          ]
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.tavilyApiKey}`,
          },
          timeout: 20000 // 20 second timeout
        }
      );

      const venues = this.processVenueResults(response.data.results || []);
      
      if (venues.length === 0) {
        logger.warn('No venues found through search, using fallback');
        return this.getFallbackVenues(eventData);
      }

      logger.info(`✅ Found ${venues.length} venue suggestions`);
      return venues;

    } catch (error) {
      logger.error('❌ Venue search failed:', error.message);
      return this.getFallbackVenues(eventData);
    }
  }

  /**
   * Build search query for venue search
   * @param {Object} eventData - Event details
   * @returns {string} Search query
   */
  buildSearchQuery(eventData) {
    const {
      eventType,
      location,
      numberOfAttendees,
      requirements = []
    } = eventData;

    const baseQuery = `corporate ${eventType} venues ${location} ${numberOfAttendees} people`;
    
    // Add capacity requirements
    let capacityTerm = '';
    if (numberOfAttendees <= 20) capacityTerm = 'small meeting rooms';
    else if (numberOfAttendees <= 50) capacityTerm = 'conference halls';
    else if (numberOfAttendees <= 100) capacityTerm = 'banquet halls';
    else capacityTerm = 'large convention centers';

    // Add special requirements
    const specialTerms = [];
    if (requirements.includes('premium')) specialTerms.push('luxury');
    if (requirements.includes('outdoor')) specialTerms.push('garden outdoor');
    if (requirements.includes('beach')) specialTerms.push('beach resort');
    
    specialTerms.push('A/V equipment', 'catering', 'parking');

    return `${baseQuery} ${capacityTerm} ${specialTerms.join(' ')}`;
  }

  /**
   * Process venue search results
   * @param {Array} results - Raw search results
   * @returns {Array} Processed venue list
   */
  processVenueResults(results) {
    return results
      .filter(result => this.isValidVenueResult(result))
      .map(result => ({
        name: this.cleanVenueName(result.title),
        url: result.url,
        description: this.cleanDescription(result.content),
        snippet: result.content?.substring(0, 150) + "..."
      }))
      .slice(0, 5); // Limit to top 5 results
  }

  /**
   * Check if search result is a valid venue
   * @param {Object} result - Search result
   * @returns {boolean} Is valid venue
   */
  isValidVenueResult(result) {
    if (!result.title || !result.url) return false;
    
    const title = result.title.toLowerCase();
    const content = (result.content || '').toLowerCase();
    
    // Exclude irrelevant results
    const excludeTerms = [
      'blog', 'article', 'news', 'review',
      'wikipedia', 'facebook', 'twitter',
      'youtube', 'instagram', 'linkedin'
    ];
    
    for (const term of excludeTerms) {
      if (title.includes(term) || result.url.includes(term)) {
        return false;
      }
    }

    // Include relevant results
    const includeTerms = [
      'hotel', 'resort', 'conference', 'banquet',
      'hall', 'venue', 'meeting', 'event',
      'center', 'centre', 'marriott', 'hyatt',
      'leela', 'oberoi', 'taj', 'itc'
    ];
    
    return includeTerms.some(term => 
      title.includes(term) || content.includes(term)
    );
  }

  /**
   * Clean venue name from search result
   * @param {string} title - Raw title
   * @returns {string} Cleaned name
   */
  cleanVenueName(title) {
    return title
      .replace(/\s*-\s*.*$/, '') // Remove everything after first dash
      .replace(/\|\s*.*$/, '') // Remove everything after pipe
      .replace(/\.\.\.$/, '') // Remove trailing dots
      .trim()
      .substring(0, 100); // Limit length
  }

  /**
   * Clean venue description
   * @param {string} content - Raw content
   * @returns {string} Cleaned description
   */
  cleanDescription(content) {
    if (!content) return 'Professional venue with event facilities';
    
    return content
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .substring(0, 200); // Limit length
  }

  /**
   * Get fallback venues when search fails
   * @param {Object} eventData - Event details
   * @returns {Array} Fallback venue suggestions
   */
  getFallbackVenues(eventData) {
    const { location, numberOfAttendees, eventType } = eventData;
    
    // City-specific fallback venues
    const cityVenues = {
      'Mumbai': [
        {
          name: 'ITC Grand Central - Conference Center',
          url: 'https://www.itchotels.com/in/itcgrandcentral/',
          description: 'Premium business hotel with state-of-the-art conference facilities in Parel, Mumbai.'
        },
        {
          name: 'The Leela Mumbai - Meeting Rooms',
          url: 'https://www.theleela.com/mumbai/',
          description: 'Luxury hotel offering sophisticated meeting spaces and professional event services.'
        }
      ],
      'Bangalore': [
        {
          name: 'ITC Gardenia - Conference Halls',
          url: 'https://www.itchotels.com/in/itcgardenia/',
          description: 'Business hotel with multiple conference rooms and modern A/V facilities in Bangalore.'
        },
        {
          name: 'The Leela Palace Bangalore',
          url: 'https://www.theleela.com/bangalore/',
          description: 'Premium venue with elegant meeting spaces and comprehensive business services.'
        }
      ],
      'Delhi': [
        {
          name: 'ITC Maurya - Convention Center',
          url: 'https://www.itchotels.com/in/itcmaurya/',
          description: 'Large-scale convention facilities with professional event management services.'
        },
        {
          name: 'The Leela Palace New Delhi',
          url: 'https://www.theleela.com/newdelhi/',
          description: 'Luxury hotel with sophisticated conference facilities in the heart of Delhi.'
        }
      ],
      'Pune': [
        {
          name: 'JW Marriott Pune - Meeting Spaces',
          url: 'https://www.marriott.com/hotels/travel/pnqjw-jw-marriott-pune/',
          description: 'Modern business hotel with flexible meeting rooms and event spaces.'
        },
        {
          name: 'Hyatt Regency Pune - Conference Center',
          url: 'https://www.hyatt.com/en-US/hotel/india/hyatt-regency-pune/punpr',
          description: 'Professional venue with comprehensive conference facilities and catering services.'
        }
      ]
    };

    // Generic venues for other cities
    const genericVenues = [
      {
        name: `${location} Convention Center`,
        url: '#',
        description: `Local convention center with facilities for ${numberOfAttendees} attendees and professional event services.`
      },
      {
        name: `Business Hotel ${location}`,
        url: '#',
        description: `Professional business hotel with conference rooms suitable for ${eventType} events.`
      }
    ];

    const venues = cityVenues[location] || genericVenues;
    
    logger.info(`📋 Providing fallback venues for ${location}`);
    return venues;
  }
}