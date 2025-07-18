import axios from 'axios';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

export class PlanGenerator {
  constructor() {
    this.groqApiKey = config.groqApiKey;
  }

  /**
   * Generate comprehensive event plan from structured data
   * @param {Object} eventData - Parsed event data
   * @returns {string} Formatted event plan
   */
  async generateEventPlan(eventData) {
    const prompt = this.createPlanPrompt(eventData);

    try {
      logger.info('🎯 Generating comprehensive event plan...');

      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: config.llmModel,
          messages: [
            { 
              role: "system", 
              content: this.getSystemPrompt() 
            },
            { 
              role: "user", 
              content: prompt 
            }
          ],
          temperature: 0.7, // Slightly higher for creative content
          max_tokens: 4000
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.groqApiKey}`,
          },
          timeout: 45000 // 45 second timeout for plan generation
        }
      );

      const eventPlan = response.data.choices[0].message.content;
      logger.info('✅ Event plan generated successfully');
      
      return this.postProcessPlan(eventPlan, eventData);

    } catch (error) {
      logger.error('❌ Event plan generation failed:', error.message);
      
      // Return fallback plan
      return this.generateFallbackPlan(eventData);
    }
  }

  /**
   * Create system prompt for the LLM
   * @returns {string} System prompt
   */
  getSystemPrompt() {
    return `You are an expert corporate event planner with 15+ years of experience in India. You understand:

- Local business culture and preferences
- Regional cuisine and dietary requirements  
- Venue standards and pricing in major Indian cities
- Corporate training methodologies
- Professional event logistics

Create comprehensive, realistic, and culturally appropriate event plans. Always:
- Use specific, actionable details
- Include accurate cost breakdowns that sum correctly
- Suggest India-based speakers and vendors when possible
- Consider local transportation and infrastructure
- Include appropriate meal plans for the region
- Follow professional corporate event standards`;
  }

  /**
   * Create the plan generation prompt
   * @param {Object} eventData - Structured event data
   * @returns {string} Formatted prompt
   */
  createPlanPrompt(eventData) {
  const {
    eventType,
    numberOfAttendees,
    location,
    date,
    budgetInINR,
    durationInHours,
    requirements = []
  } = eventData;

  const isVegetarian = requirements.includes('vegetarian');
  const isPremium = requirements.includes('premium');
  const isOutdoor = requirements.includes('outdoor');

  return `
Generate a comprehensive corporate event plan for:

📋 EVENT DETAILS:
- Type: ${eventType}
- Attendees: ${numberOfAttendees}
- Location: ${location}
- Date: ${date}
- Budget: ₹${budgetInINR.toLocaleString()}
- Duration: ${durationInHours} hours
- Special Requirements: ${requirements.join(', ') || 'None'}

🎯 GENERATE COMPLETE PLAN WITH EXACT FORMAT:

## EVENT BRIEF
[Write 2-3 sentences describing the event purpose, objectives, and expected outcomes. Make it professional and specific to the event type.]

## DETAILED ITINERARY
${this.generateTimeSlots(durationInHours)}

## COST BREAKDOWN
${this.generateCostStructure(budgetInINR, numberOfAttendees, requirements)}

## MEAL PLAN
${isVegetarian ? 'Breakfast: [4-5 vegetarian items suitable for ' + location + ']' : 'Breakfast: [4-5 items including vegetarian options, suitable for ' + location + ']'}
${isVegetarian ? 'Lunch: [6-8 vegetarian items with regional specialties]' : 'Lunch: [6-8 items including vegetarian and non-vegetarian options, regional specialties]'}
Snacks: [3-4 items for ${durationInHours > 6 ? 'afternoon and evening' : 'break time'}]

## SPEAKER RECOMMENDATIONS
1. [Name/Professional Title] - [Expertise Area] - [City/Remote availability]
2. [Name/Professional Title] - [Expertise Area] - [City/Remote availability]  
3. [Name/Professional Title] - [Expertise Area] - [City/Remote availability]

## LOGISTICS & SETUP
Transport: [Detailed plan for ${numberOfAttendees} people in ${location}]
Venue Setup: [Tables, chairs, A/V requirements, room layout]
Equipment: [Projectors, microphones, laptops, flipcharts, etc.]
Timeline: [Setup, event flow, breakdown schedule]

## ENERGIZER ACTIVITIES
- [15-minute icebreaker activity relevant to ${eventType}]
- [Team building exercise for ${numberOfAttendees} people]
- [Networking/interaction activity]

REQUIREMENTS:
- Make it realistic for ${location} with local knowledge
- Stay within ₹${budgetInINR.toLocaleString()} budget
- All costs must add up correctly
- Include cultural considerations for ${location}
- ${isPremium ? 'Use premium vendors and high-end options' : 'Use cost-effective but quality options'}
- ${isOutdoor ? 'Include outdoor elements and weather contingencies' : 'Focus on indoor professional setup'}
`;
}


    

  /**
   * Generate time slots for itinerary based on duration
   * @param {number} hours - Event duration in hours
   * @returns {string} Time slot template
   */
  generateTimeSlots(hours) {
    const startHour = 9; // 9 AM start
    const slots = [];
    
    for (let i = 0; i < hours; i++) {
      const hour = startHour + i;
      const time = `${hour.toString().padStart(2, '0')}:00`;
      slots.push(`${time} - [Activity ${i + 1}]`);
    }
    
    return slots.join('\n');
  }

  /**
   * Generate cost structure template
   * @param {number} budget - Total budget
   * @param {number} attendees - Number of attendees
   * @param {Array} requirements - Special requirements
   * @returns {string} Cost breakdown template
   */
  generateCostStructure(budget, attendees, requirements) {
    const isPremium = requirements.includes('premium');
    const hasTransport = requirements.includes('transport') || attendees > 30;
    
    return `Venue Rental: ₹[${Math.floor(budget * 0.25).toLocaleString()}]
Catering (${attendees} people): ₹[${(attendees * (isPremium ? 1200 : 800)).toLocaleString()}] 
A/V Equipment: ₹[${Math.floor(budget * 0.08).toLocaleString()}]
Stationery & Materials: ₹[${(attendees * 150).toLocaleString()}]
${hasTransport ? `Transport: ₹[${Math.ceil(attendees / 20) * 1000}]` : ''}
Speaker Fees: ₹[amount]
Miscellaneous: ₹[amount]
Total: ₹[sum all amounts = ${budget.toLocaleString()}]`;
  }

  /**
   * Post-process the generated plan
   * @param {string} plan - Raw plan from LLM
   * @param {Object} eventData - Original event data
   * @returns {string} Processed plan
   */
  postProcessPlan(plan, eventData) {
    // Clean up formatting
    let processedPlan = plan.trim();
    
    // Ensure proper markdown formatting
    processedPlan = processedPlan.replace(/^([A-Z\s]+)$/gm, '## $1');
    
    // Add event summary at the top
    const summary = `# ${eventData.eventType.toUpperCase()} EVENT PLAN\n**${eventData.numberOfAttendees} people • ${eventData.location} • ${eventData.date}**\n**Budget: ₹${eventData.budgetInINR.toLocaleString()}**\n\n`;
    
    return summary + processedPlan;
  }

  // Add this method to your existing PlanGenerator.js core class

/**
 * Generate event plan with refinement support
 * @param {Object} eventData - Event data with enhanced requirements
 * @returns {string} Formatted event plan
 */
async generateRefinedEventPlan(eventData, refinementPrompt = null) {
  // Use existing generateEventPlan method but enhance the prompt
  if (refinementPrompt) {
    // Create enhanced prompt for refinements
    const enhancedPrompt = this.createRefinedPlanPrompt(eventData, refinementPrompt);
    
    try {
      logger.info('🔧 Generating refined event plan...');

      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: config.llmModel,
          messages: [
            { 
              role: "system", 
              content: this.getSystemPrompt() + "\n\nIMPORTANT: This is a refinement request. Pay special attention to the specific modifications requested by the user." 
            },
            { 
              role: "user", 
              content: enhancedPrompt 
            }
          ],
          temperature: 0.7,
          max_tokens: 4000
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.groqApiKey}`,
          },
          timeout: 45000
        }
      );

      const eventPlan = response.data.choices[0].message.content;
      logger.info('✅ Refined event plan generated successfully');
      
      return this.postProcessPlan(eventPlan, eventData);

    } catch (error) {
      logger.warn('⚠️ Refined plan generation failed, using standard generation');
      // Fallback to standard generation
      return this.generateEventPlan(eventData);
    }
  }
  
  // Use standard generation if no refinement
  return this.generateEventPlan(eventData);
}

/**
 * Create refined plan prompt with specific refinement instructions
 * @param {Object} eventData - Event data
 * @param {string} refinementPrompt - User's refinement request
 * @returns {string} Enhanced prompt
 */
createRefinedPlanPrompt(eventData, refinementPrompt) {
  const basePrompt = this.createPlanPrompt(eventData);
  
  const refinementInstructions = `

🔧 REFINEMENT REQUEST:
"${refinementPrompt}"

SPECIAL INSTRUCTIONS:
- Incorporate the above refinement request into the plan
- Highlight the specific changes made to address the request
- Ensure the modifications align with the original event requirements
- Maintain the same format and structure as requested above

`;

  return basePrompt + refinementInstructions;
}

  /**
   * Generate fallback plan when LLM fails
   * @param {Object} eventData - Event data
   * @returns {string} Basic event plan
   */
  generateFallbackPlan(eventData) {
    const {
      eventType,
      numberOfAttendees,
      location,
      date,
      budgetInINR,
      durationInHours
    } = eventData;

    logger.info('🔄 Generating fallback event plan...');

    return `# ${eventType.toUpperCase()} EVENT PLAN
**${numberOfAttendees} people • ${location} • ${date}**
**Budget: ₹${budgetInINR.toLocaleString()}**

## EVENT BRIEF
A professional ${eventType} for ${numberOfAttendees} participants in ${location}, designed to achieve key business objectives within the allocated budget.

## DETAILED ITINERARY
09:00 AM - Registration & Welcome
09:30 AM - Opening Session
10:30 AM - Main Session 1
11:30 AM - Networking Break
12:00 PM - Main Session 2
01:00 PM - Lunch Break
02:00 PM - Interactive Session
03:30 PM - Group Activities
04:30 PM - Closing Remarks
05:00 PM - Event Conclusion

## COST BREAKDOWN
Venue Rental: ₹${Math.floor(budgetInINR * 0.3).toLocaleString()}
Catering: ₹${Math.floor(budgetInINR * 0.4).toLocaleString()}
Equipment: ₹${Math.floor(budgetInINR * 0.15).toLocaleString()}
Materials: ₹${Math.floor(budgetInINR * 0.1).toLocaleString()}
Miscellaneous: ₹${Math.floor(budgetInINR * 0.05).toLocaleString()}
Total: ₹${budgetInINR.toLocaleString()}

## MEAL PLAN
Breakfast: Tea, coffee, sandwiches, fruits
Lunch: Regional cuisine with vegetarian and non-vegetarian options
Snacks: Evening refreshments

## LOGISTICS
Basic venue setup with necessary A/V equipment and professional catering services suitable for ${numberOfAttendees} attendees.

*Note: This is a basic plan. For detailed customization, please try again or contact support.*`;
  }
}
