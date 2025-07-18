import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  groqApiKey: process.env.GROQ_API_KEY,
  tavilyApiKey: process.env.TAVILY_API_KEY,
  
  llmModel: process.env.LLM_MODEL || 'llama3-70b-8192',
  llmTimeout: parseInt(process.env.LLM_TIMEOUT) || 45000, // 45 seconds
  
  enableCaching: process.env.ENABLE_CACHING !== 'false', // Default true
  cacheExpiryMinutes: parseInt(process.env.CACHE_EXPIRY_MINUTES) || 60, // 1 hour
  maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE) || 1000, // Max 1000 entries
  
  rateLimitRequests: parseInt(process.env.RATE_LIMIT_REQUESTS) || 100,
  rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW) || 3600000, // 1 hour in ms
  
  logLevel: process.env.LOG_LEVEL || 'info',
  logToFile: process.env.LOG_TO_FILE === 'true',
  
  venueSearchTimeout: parseInt(process.env.VENUE_SEARCH_TIMEOUT) || 20000, // 20 seconds
  maxVenueResults: parseInt(process.env.MAX_VENUE_RESULTS) || 5,
  
  defaultEventDuration: parseInt(process.env.DEFAULT_EVENT_DURATION) || 8, // 8 hours
  minBudget: parseInt(process.env.MIN_BUDGET) || 10000, // ₹10,000
  maxAttendees: parseInt(process.env.MAX_ATTENDEES) || 1000,
  
  maxInputLength: parseInt(process.env.MAX_INPUT_LENGTH) || 1000, // Max input characters
  minInputLength: parseInt(process.env.MIN_INPUT_LENGTH) || 10,
  
  enableVenueSearch: process.env.ENABLE_VENUE_SEARCH !== 'false',
  enableFallbackParsing: process.env.ENABLE_FALLBACK_PARSING !== 'false',
  enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS !== 'false',

  validate() {
    const errors = [];
    
    if (!this.groqApiKey) {
      errors.push('GROQ_API_KEY is required');
    }
    
    if (this.enableVenueSearch && !this.tavilyApiKey) {
      console.warn('⚠️  TAVILY_API_KEY not set - venue search will use fallback data');
    }
    
    if (this.port < 1 || this.port > 65535) {
      errors.push('PORT must be between 1 and 65535');
    }
    
    if (this.cacheExpiryMinutes < 1) {
      errors.push('CACHE_EXPIRY_MINUTES must be at least 1');
    }
    
    if (this.maxCacheSize < 10) {
      errors.push('MAX_CACHE_SIZE must be at least 10');
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration errors: ${errors.join(', ')}`);
    }
    
    return true;
  },

  getSummary() {
    return {
      environment: this.nodeEnv,
      port: this.port,
      llmModel: this.llmModel,
      cachingEnabled: this.enableCaching,
      venueSearchEnabled: this.enableVenueSearch
    };
  }
};