// src/core/CorporateEventPlannerGraph.js
import { executeEventPlanning, validateGraphConfiguration, getGraphStatistics } from '../graph/EventPlannerGraph.js';
import { StateHelpers } from '../graph/state.js';
import { cache } from '../utils/cache.js';
import { logger } from '../utils/logger.js';
import { config } from '../config/config.js';

/**
 * Main Corporate Event Planner class using graph-based architecture
 * Provides a clean interface to the underlying state graph execution
 */
export class CorporateEventPlannerGraph {
  constructor() {
    this.cache = cache;
    this.graphStats = getGraphStatistics();
    
    // Validate graph configuration on initialization (non-blocking)
    const validation = validateGraphConfiguration();
    if (!validation.valid) {
      logger.warn(`Graph configuration validation failed: ${validation.error}`);
      // Don't throw error, just log warning - graph might still work
    } else {
      logger.info('✅ Graph configuration validation passed');
    }
    
    logger.info('🔄 CorporateEventPlannerGraph initialized with state-based flow', {
      architecture: this.graphStats.architecture,
      nodes: this.graphStats.totalNodes,
      features: this.graphStats.features.length,
      validationPassed: validation.valid
    });
  }

  /**
   * Main method to create event plan using graph flow
   * @param {string} naturalInput - User's natural language description
   * @param {string} tweakPrompt - Optional refinement prompt
   * @returns {Object} Complete event plan response
   */
  async createEventPlan(naturalInput, tweakPrompt = null) {
    const startTime = Date.now();
    const requestId = this.generateRequestId();
    
    logger.info(`🚀 [${requestId}] Starting graph-based event plan generation`, {
      inputLength: naturalInput?.length || 0,
      isRefinement: !!tweakPrompt,
      tweakLength: tweakPrompt?.length || 0
    });

    try {
      // Step 1: Input validation
      const inputValidation = this.validateInput(naturalInput);
      if (!inputValidation.valid) {
        throw new Error(inputValidation.error);
      }

      // Step 2: Cache check (only for non-refinement requests)
      let cacheKey = null;
      if (!tweakPrompt && config.enableCaching) {
        cacheKey = this.generateCacheKey(naturalInput);
        const cachedResult = this.getCachedResult(cacheKey, startTime);
        
        if (cachedResult) {
          logger.info(`📦 [${requestId}] Returning cached result`);
          return cachedResult;
        }
      }

      // Step 3: Execute the graph flow
      const graphResult = await executeEventPlanning(naturalInput, tweakPrompt);

      // Step 4: Process and enhance the result
      const processedResult = this.processGraphResult(graphResult, startTime, requestId);

      // Step 5: Cache successful non-refinement results
      if (processedResult.success && !tweakPrompt && config.enableCaching && cacheKey) {
        this.cacheResult(cacheKey, processedResult);
      }

      logger.info(`✅ [${requestId}] Graph-based event plan completed`, {
        success: processedResult.success,
        executionTime: processedResult.generationTime,
        qualityScore: processedResult.summary?.qualityScore,
        stepsCompleted: processedResult.executionAnalytics?.stepsCompleted?.length || 0
      });
      
      return processedResult;

    } catch (error) {
      const executionTime = `${((Date.now() - startTime) / 1000).toFixed(2)} seconds`;
      
      logger.error(`❌ [${requestId}] Graph-based event plan generation failed`, {
        error: error.message,
        executionTime,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
      
      return this.createErrorResponse(error, executionTime, naturalInput, tweakPrompt);
    }
  }

  /**
   * Refine an existing plan with additional instructions
   * @param {string} originalInput - Original input
   * @param {string} tweakPrompt - Refinement instructions
   * @returns {Object} Refined event plan
   */
  async refinePlan(originalInput, tweakPrompt) {
    logger.info('🔧 Refining plan with tweak prompt', {
      originalLength: originalInput?.length || 0,
      tweakLength: tweakPrompt?.length || 0
    });
    
    if (!tweakPrompt || tweakPrompt.trim().length < 5) {
      throw new Error('Refinement prompt must be at least 5 characters long');
    }
    
    return await this.createEventPlan(originalInput, tweakPrompt);
  }

  /**
   * Validate input parameters
   * @param {string} naturalInput - Input to validate
   * @returns {Object} Validation result
   */
  validateInput(naturalInput) {
    if (!naturalInput || typeof naturalInput !== 'string') {
      return { valid: false, error: 'Input must be a non-empty string' };
    }

    const trimmed = naturalInput.trim();
    if (trimmed.length < 10) {
      return { valid: false, error: 'Please provide a detailed event description (at least 10 characters)' };
    }

    if (trimmed.length > 2000) {
      return { valid: false, error: 'Input is too long (maximum 2000 characters)' };
    }

    return { valid: true };
  }

  /**
   * Get cached result if available
   * @param {string} cacheKey - Cache key
   * @param {number} startTime - Request start time
   * @returns {Object|null} Cached result or null
   */
  getCachedResult(cacheKey, startTime) {
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        cached: true,
        generationTime: `${((Date.now() - startTime) / 1000).toFixed(2)} seconds (cached)`,
        timestamp: new Date().toISOString()
      };
    }
    return null;
  }

  /**
   * Cache successful result
   * @param {string} cacheKey - Cache key
   * @param {Object} result - Result to cache
   */
  cacheResult(cacheKey, result) {
    try {
      // Remove execution-specific data before caching
      const cacheableResult = {
        ...result,
        cached: false,
        executionId: undefined,
        generationTime: undefined,
        timestamp: undefined
      };
      
      this.cache.set(cacheKey, cacheableResult, config.cacheExpiryMinutes);
      logger.debug('💾 Result cached successfully', { cacheKey });
    } catch (error) {
      logger.warn('Failed to cache result:', error.message);
    }
  }

  /**
   * Process graph execution result into API response format
   * @param {Object} graphResult - Result from graph execution
   * @param {number} startTime - Start timestamp
   * @param {string} requestId - Request identifier
   * @returns {Object} Processed response
   */
  processGraphResult(graphResult, startTime, requestId) {
    const generationTime = `${((Date.now() - startTime) / 1000).toFixed(2)} seconds`;
    
    // Base response structure
    const response = {
      success: graphResult.success || false,
      generationTime,
      timestamp: new Date().toISOString(),
      cached: false,
      requestId,
      errors: graphResult.errors || [],
      warnings: graphResult.warnings || []
    };

    if (graphResult.success) {
      // Successful response
      response.eventData = graphResult.eventData;
      response.eventPlan = graphResult.eventPlan;
      response.venues = graphResult.venues || [];
      
      // Add graph execution metadata
      response.graphMetadata = {
        ...graphResult.graphMetadata,
        architecture: 'state-graph',
        executionAnalytics: graphResult.executionAnalytics
      };
      
      // Add summary
      response.summary = graphResult.summary;
      
      // Add quality indicators
      response.qualityIndicators = this.calculateQualityIndicators(graphResult);
      
    } else {
      // Error response
      response.error = graphResult.errors?.length > 0 ? 
        graphResult.errors.join('; ') : 
        'Event plan generation failed';
        
      // Add error details if available
      if (graphResult.errorDetails) {
        response.errorDetails = graphResult.errorDetails;
      }
    }

    return response;
  }

  calculateQualityIndicators(graphResult) {
  const indicators = {
    // REMOVE THIS LINE: overallScore: StateHelpers.getQualityScore(graphResult),
    dataCompleteness: 0,
    planRichness: 0,
    venueRelevance: 0,
    executionEfficiency: 0
  };

  // Keep the rest of the function as is...
  // Data completeness (0-25 points)
  if (graphResult.eventData) {
    let completeness = 0;
    const requiredFields = ['eventType', 'numberOfAttendees', 'location', 'date', 'budgetInINR'];
    requiredFields.forEach(field => {
      if (graphResult.eventData[field]) completeness += 5;
    });
    indicators.dataCompleteness = completeness;
  }

  // Plan richness (0-25 points)
  if (graphResult.eventPlan) {
    const planLength = graphResult.eventPlan.length;
    const hasDetailedSections = graphResult.eventPlan.includes('## DETAILED ITINERARY') && 
                               graphResult.eventPlan.includes('## COST BREAKDOWN');
    
    indicators.planRichness = Math.min(25, 
      (planLength > 2000 ? 15 : planLength > 1000 ? 10 : 5) +
      (hasDetailedSections ? 10 : 0)
    );
  }

  // Venue relevance (0-25 points)
  if (graphResult.venues?.length > 0) {
    const avgScore = graphResult.venues.reduce((sum, v) => sum + (v.suitabilityScore || 0), 0) / 
                    graphResult.venues.length;
    indicators.venueRelevance = Math.min(25, avgScore / 4);
  }

  // Execution efficiency (0-25 points)
  const analytics = graphResult.executionAnalytics;
  if (analytics) {
    let efficiency = 15; // Base score
    
    if (!analytics.usedFallbacks) efficiency += 5;
    if (analytics.progressPercentage === 100) efficiency += 5;
    
    indicators.executionEfficiency = efficiency;
  }

  return indicators;
}

  /**
   * Create error response
   * @param {Error} error - The error that occurred
   * @param {string} generationTime - Time elapsed
   * @param {string} naturalInput - Original input
   * @param {string} tweakPrompt - Refinement prompt if any
   * @returns {Object} Error response
   */
  createErrorResponse(error, generationTime, naturalInput, tweakPrompt) {
    return {
      success: false,
      error: error.message,
      errors: [error.message],
      warnings: [],
      generationTime,
      timestamp: new Date().toISOString(),
      cached: false,
      userInput: {
        naturalInput: naturalInput?.substring(0, 100),
        tweakPrompt: tweakPrompt?.substring(0, 50)
      },
      graphMetadata: {
        architecture: 'state-graph',
        executionFailed: true,
        failureReason: error.message
      },
      summary: {
        status: 'Failed',
        message: error.message,
        progress: 0
      }
    };
  }

  /**
   * Generate cache key for input
   * @param {string} input - Natural language input
   * @returns {string} Cache key
   */
  generateCacheKey(input) {
    const normalized = input
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/[^\w\s]/g, ''); // Remove special characters
    
    return `event_plan_graph_${Buffer.from(normalized).toString('base64').slice(0, 32)}`;
  }

  /**
   * Generate unique request ID
   * @returns {string} Request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      ...this.cache.getStats(),
      graphArchitecture: true
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    logger.info('🗑️ Graph planner cache cleared');
  }

  /**
   * Health check for the graph-based planner
   * @returns {Object} Health status
   */
  async healthCheck() {
    const healthCheckId = `health_${Date.now()}`;
    
    try {
      logger.info(`🏥 [${healthCheckId}] Starting health check`);
      
      // Test basic graph execution
      const testResult = await this.createEventPlan(
        "Health check meeting for 5 people in Mumbai tomorrow. Budget ₹10,000."
      );
      
      // Validate graph configuration
      const graphValidation = validateGraphConfiguration();
      
      const healthStatus = {
        status: testResult.success && graphValidation.valid ? 'healthy' : 'unhealthy',
        architecture: 'graph-based',
        timestamp: new Date().toISOString(),
        
        // Component health
        components: {
          stateGraph: graphValidation.valid ? 'operational' : 'failed',
          parseNode: testResult.summary?.completedSteps?.includes('parse') ? 'operational' : 'unknown',
          validateNode: testResult.summary?.completedSteps?.includes('validate') ? 'operational' : 'unknown',
          planNode: testResult.summary?.completedSteps?.includes('plan') ? 'operational' : 'unknown',
          venueNode: testResult.summary?.completedSteps?.includes('venues') ? 'operational' : 'unknown',
          cache: 'operational',
          errorHandler: 'operational'
        },
        
        // Test results
        testExecution: {
          successful: testResult.success,
          executionTime: testResult.generationTime,
          qualityScore: testResult.summary?.qualityScore || 0,
          completedSteps: testResult.summary?.completedSteps || [],
          errors: testResult.errors || [],
          warnings: testResult.warnings || []
        },
        
        // Configuration validation
        graphValidation,
        
        // Statistics
        statistics: this.getGraphStats()
      };
      
      logger.info(`✅ [${healthCheckId}] Health check completed`, {
        status: healthStatus.status,
        testSuccessful: testResult.success,
        graphValid: graphValidation.valid
      });
      
      return healthStatus;
      
    } catch (error) {
      logger.error(`❌ [${healthCheckId}] Health check failed:`, error.message);
      
      return {
        status: 'unhealthy',
        architecture: 'graph-based',
        error: error.message,
        timestamp: new Date().toISOString(),
        components: {
          stateGraph: 'unknown',
          parseNode: 'unknown',
          validateNode: 'unknown',
          planNode: 'unknown',
          venueNode: 'unknown',
          cache: 'unknown',
          errorHandler: 'unknown'
        }
      };
    }
  }

  /**
   * Get comprehensive graph execution statistics
   * @returns {Object} Graph stats
   */
  getGraphStats() {
    return {
      ...this.graphStats,
      cacheStats: this.getCacheStats(),
      runtime: {
        nodeJsVersion: process.version,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      },
      configuration: {
        cacheEnabled: config.enableCaching,
        venueSearchEnabled: config.enableVenueSearch,
        fallbackParsingEnabled: config.enableFallbackParsing
      }
    };
  }

  /**
   * Get execution analytics for monitoring
   * @returns {Object} Analytics data
   */
  getAnalytics() {
    return {
      architecture: 'LangGraph State Machine',
      version: '2.0.0',
      features: {
        sequentialExecution: true,
        conditionalRouting: true,
        stateValidation: true,
        errorRecovery: true,
        planRefinement: true,
        caching: config.enableCaching,
        executionTracking: true
      },
      performance: {
        avgExecutionTime: 'Varies by complexity',
        cacheHitRate: this.getCacheStats().hitRate,
        fallbackUsage: 'Tracked per execution'
      },
      quality: {
        scoreCalculation: 'Multi-factor quality assessment',
        businessValidation: 'Comprehensive rule engine',
        resultEnhancement: 'Context-aware improvements'
      }
    };
  }
}