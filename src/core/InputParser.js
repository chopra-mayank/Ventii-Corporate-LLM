import axios from 'axios';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

export class InputParser {
  constructor() {
    this.groqApiKey = config.groqApiKey;
    this.defaultDuration = 8; // Default 8 hours for corporate events
  }

  /**
   * Parse natural language input into structured event data
   * @param {string} naturalInput - User's description
   * @returns {Object|null} Parsed event data or null if parsing fails
   */
  async parseUserInput(naturalInput) {
    const parsePrompt = this.createParsePrompt(naturalInput);

    try {
      logger.info('🧠 Calling LLM for input parsing...');
      
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: config.llmModel,
          messages: [
            { 
              role: "system", 
              content: "You are a data extraction expert. Extract corporate event details and return ONLY valid JSON. Be precise and consistent." 
            },
            { 
              role: "user", 
              content: parsePrompt 
            }
          ],
          temperature: 0.1, // Low temperature for consistent parsing
          max_tokens: 500
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.groqApiKey}`,
          },
          timeout: 30000 // 30 second timeout
        }
      );

      const content = response.data.choices[0].message.content;
      logger.info('📥 LLM response received for parsing');
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const parsedData = JSON.parse(jsonMatch[0]);
      
      const processedData = this.postProcessParsedData(parsedData);
      
      logger.info('✅ Input parsing successful:', processedData);
      return processedData;

    } catch (error) {
      logger.error('❌ Input parsing failed:', error.message);
      
      const fallbackData = this.fallbackParsing(naturalInput);
      if (fallbackData) {
        logger.info('🔄 Fallback parsing successful');
        return fallbackData;
      }
      
      return null;
    }
  }

  // Add this method to your existing InputParser.js core class

/**
 * Parse natural language input with refinement support
 * @param {string} naturalInput - User's description
 * @param {string} refinementPrompt - Optional refinement instructions
 * @returns {Object|null} Parsed event data or null if parsing fails
 */
async parseUserInputWithRefinement(naturalInput, refinementPrompt = null) {
  // Combine inputs if refinement provided
  const combinedInput = refinementPrompt ? 
    `${naturalInput}\n\nAdditional requirements: ${refinementPrompt}` : 
    naturalInput;
    
  // Use enhanced prompt for refinements
  const parsePrompt = refinementPrompt ? 
    this.createRefinementParsePrompt(combinedInput, refinementPrompt) : 
    this.createParsePrompt(combinedInput);

  try {
    logger.info(refinementPrompt ? '🔧 Calling LLM for refinement parsing...' : '🧠 Calling LLM for input parsing...');
    
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: config.llmModel,
        messages: [
          { 
            role: "system", 
            content: "You are a data extraction expert. Extract corporate event details and return ONLY valid JSON. Be precise and consistent." + 
                    (refinementPrompt ? " Pay special attention to refinement requirements." : "")
          },
          { 
            role: "user", 
            content: parsePrompt 
          }
        ],
        temperature: 0.1,
        max_tokens: 500
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.groqApiKey}`,
        },
        timeout: 30000
      }
    );

    const content = response.data.choices[0].message.content;
    logger.info('📥 LLM response received for parsing');
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response');
    }

    const parsedData = JSON.parse(jsonMatch[0]);
    const processedData = this.postProcessParsedData(parsedData);
    
    logger.info('✅ Input parsing successful:', processedData);
    return processedData;

  } catch (error) {
    logger.error('❌ Input parsing failed:', error.message);
    
    // Use standard parsing as fallback
    if (refinementPrompt) {
      logger.info('🔄 Falling back to standard parsing...');
      return this.parseUserInput(naturalInput);
    }
    
    const fallbackData = this.fallbackParsing(combinedInput);
    if (fallbackData) {
      logger.info('🔄 Fallback parsing successful');
      return fallbackData;
    }
    
    return null;
  }
}

/**
 * Create refinement-aware parsing prompt
 * @param {string} combinedInput - Combined input with refinements
 * @param {string} refinementPrompt - Refinement instructions
 * @returns {string} Enhanced prompt
 */
createRefinementParsePrompt(combinedInput, refinementPrompt) {
  const basePrompt = this.createParsePrompt(combinedInput);
  
  const refinementInstructions = `

🔧 REFINEMENT CONTEXT:
The user has provided additional requirements: "${refinementPrompt}"

SPECIAL INSTRUCTIONS:
- Pay extra attention to the refinement requirements
- Add relevant keywords to the requirements array
- Adjust duration, budget, or other fields if the refinement implies changes
- Ensure the refinement is properly captured in the structured data

`;

  return basePrompt + refinementInstructions;
}

  /**
   * Create the parsing prompt for the LLM
   * @param {string} input - Natural language input
   * @returns {string} Formatted prompt
   */
  createParsePrompt(input) {
    const currentDate = new Date().toISOString().split('T')[0];
    
    return `
Extract event details from this text: "${input}"

Current date: ${currentDate}

Return ONLY a JSON object with these exact fields:
{
  "eventType": "training|conference|offsite|seminar|workshop|meeting",
  "numberOfAttendees": number,
  "location": "city name",
  "date": "YYYY-MM-DD format",
  "budgetInINR": number,
  "durationInHours": number,
  "requirements": ["requirement1", "requirement2"]
}

PARSING RULES:
- eventType: Identify from keywords (training, conference, offsite, seminar, workshop, meeting)
- numberOfAttendees: Extract exact number mentioned
- location: City name only (e.g., "Mumbai", "Bangalore")
- date: Convert relative dates ("tomorrow", "next Friday") to YYYY-MM-DD
- budgetInINR: Convert all formats (₹1.5L, 1.5 lakhs, 150000) to integer
- durationInHours: Default 8 for full day, 4 for half day, or extract if mentioned
- requirements: Extract keywords like "vegetarian", "premium", "outdoor", "a/v equipment"

EXAMPLES:
"Corporate training for 50 people in Bangalore on June 10th. Budget ₹1.5 lakhs."
→ {"eventType": "training", "numberOfAttendees": 50, "location": "Bangalore", "date": "2025-06-10", "budgetInINR": 150000, "durationInHours": 8, "requirements": []}

"Team offsite for 30 people in Goa tomorrow. Budget 2 lakhs. Need vegetarian food."
→ {"eventType": "offsite", "numberOfAttendees": 30, "location": "Goa", "date": "${this.getTomorrowDate()}", "budgetInINR": 200000, "durationInHours": 8, "requirements": ["vegetarian"]}

"Half-day workshop for 25 executives in Mumbai next week. Premium setup required."
→ {"eventType": "workshop", "numberOfAttendees": 25, "location": "Mumbai", "date": "${this.getNextWeekDate()}", "budgetInINR": 0, "durationInHours": 4, "requirements": ["premium"]}
`;
  }

  /**
   * Post-process parsed data to ensure consistency
   * @param {Object} data - Raw parsed data
   * @returns {Object} Processed data
   */
  postProcessParsedData(data) {
    const processed = { ...data };

    if (!processed.eventType) processed.eventType = 'meeting';
    if (!processed.numberOfAttendees) processed.numberOfAttendees = 20;
    if (!processed.location) processed.location = 'Mumbai';
    if (!processed.date) processed.date = this.getTomorrowDate();
    if (!processed.budgetInINR) processed.budgetInINR = 50000;
    if (!processed.durationInHours) processed.durationInHours = this.defaultDuration;
    if (!processed.requirements) processed.requirements = [];

    processed.numberOfAttendees = Math.max(1, parseInt(processed.numberOfAttendees) || 20);
    processed.budgetInINR = Math.max(config.minBudget, parseInt(processed.budgetInINR) || config.minBudget);
    processed.durationInHours = Math.max(1, Math.min(12, parseInt(processed.durationInHours) || 8));

    const validEventTypes = ['training', 'conference', 'offsite', 'seminar', 'workshop', 'meeting'];
    if (!validEventTypes.includes(processed.eventType)) {
      processed.eventType = 'meeting';
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(processed.date)) {
      processed.date = this.getTomorrowDate();
    }

    return processed;
  }

  /**
   * FIXED: Fallback parsing using regex patterns
   * @param {string} input - Natural language input
   * @returns {Object|null} Basic parsed data or null
   */
  fallbackParsing(input) {
    try {
      logger.info('🔄 Attempting fallback regex parsing...');
      
      const data = {
        eventType: 'meeting',
        numberOfAttendees: 20,
        location: 'Mumbai',
        date: this.getTomorrowDate(),
        budgetInINR: 50000,
        durationInHours: 8,
        requirements: []
      };

      // Extract number of attendees
      const attendeeMatch = input.match(/(\d+)\s*(people|persons|attendees|participants)/i);
      if (attendeeMatch) {
        data.numberOfAttendees = parseInt(attendeeMatch[1]);
      }

      // FIXED: Extract budget with better patterns
      const budgetPatterns = [
        // Match "₹80,000" or "₹80000"
        /₹\s*(\d{1,2}),?(\d{3})\b/,
        // Match "₹1.5 lakhs" or "₹1.5L"
        /₹\s*(\d+(?:\.\d+)?)\s*(?:lakh|l)\b/i,
        // Match "2 lakhs" or "2L"
        /(\d+(?:\.\d+)?)\s*(?:lakh|l)\b/i,
        // Match simple numbers like "budget 50000"
        /budget.*?₹?\s*(\d+(?:,\d+)*)/i,
        // Match "₹50000" or "₹50,000"
        /₹\s*(\d+(?:,\d+)*)/
      ];

      for (const pattern of budgetPatterns) {
        const match = input.match(pattern);
        if (match) {
          let amount;
          
          if (pattern.source.includes('lakh|l')) {
            // Handle lakhs conversion
            amount = parseFloat(match[1]) * 100000;
          } else if (match[2]) {
            // Handle comma-separated format like "80,000"
            amount = parseInt(match[1] + match[2]);
          } else {
            // Handle simple number
            amount = parseFloat(match[1].replace(/,/g, ''));
          }
          
          data.budgetInINR = Math.max(5000, amount);
          logger.info(`💰 Parsed budget: ₹${data.budgetInINR} from "${match[0]}"`);
          break;
        }
      }

      // Extract location - improved pattern
      const locationPatterns = [
        /in\s+([A-Za-z\s]+?)(?:\s+on|\s+tomorrow|\s+next|\s+budget|\s*\.|$)/i,
        /(?:at|@)\s+([A-Za-z\s]+?)(?:\s+on|\s+tomorrow|\s+next|\s+budget|\s*\.|$)/i
      ];

      for (const pattern of locationPatterns) {
        const match = input.match(pattern);
        if (match) {
          data.location = match[1].trim();
          break;
        }
      }

      // Extract event type
      const eventTypes = {
        'training': /training|skill|learn/i,
        'conference': /conference|convention/i,
        'offsite': /offsite|retreat|outing/i,
        'seminar': /seminar|session/i,
        'workshop': /workshop/i,
        'meeting': /meeting|discussion/i
      };

      for (const [type, pattern] of Object.entries(eventTypes)) {
        if (pattern.test(input)) {
          data.eventType = type;
          break;
        }
      }

      // Extract requirements
      if (/vegetarian|veg/i.test(input)) data.requirements.push('vegetarian');
      if (/premium|luxury|high-end/i.test(input)) data.requirements.push('premium');
      if (/outdoor|beach|garden/i.test(input)) data.requirements.push('outdoor');
      if (/basic/i.test(input)) data.requirements.push('basic');

      logger.info('✅ Fallback parsing completed:', data);
      return data;

    } catch (error) {
      logger.error('❌ Fallback parsing failed:', error.message);
      return null;
    }
  }

  /**
   * Get tomorrow's date in YYYY-MM-DD format
   * @returns {string} Tomorrow's date
   */
  getTomorrowDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  /**
   * Get next week's date in YYYY-MM-DD format
   * @returns {string} Next week's date
   */
  getNextWeekDate() {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    return nextWeek.toISOString().split('T')[0];
  }
}