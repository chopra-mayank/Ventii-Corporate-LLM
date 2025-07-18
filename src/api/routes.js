// src/api/routes.js
import { logger } from '../utils/logger.js';

/**
 * Setup all API routes for graph-based event planner
 * @param {Object} app - Express app instance
 * @param {Object} planner - CorporateEventPlannerGraph instance
 */
export function setupApiRoutes(app, planner) {
  
  // Main event planning endpoint
  app.post('/api/generate-event-plan', async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { input, tweakPrompt } = req.body;
      
      if (!input || typeof input !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Please provide event details as text input'
        });
      }

      if (input.trim().length < 10) {
        return res.status(400).json({
          success: false,
          error: 'Please provide more detailed event description (at least 10 characters)'
        });
      }

      const clientIP = req.ip || req.connection.remoteAddress;
      logger.info(`📨 New graph request from ${clientIP}: "${input.substring(0, 100)}..."`);
      
      // Use graph-based planner
      const result = await planner.createEventPlan(input, tweakPrompt);      

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`📤 Graph response sent in ${duration}s - Success: ${result.success}`);
      
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
      
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.error(`❌ Graph request failed in ${duration}s:`, error.message);
      
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    }
  });

  // Refinement endpoint for tweaking existing plans
  app.post('/api/refine-plan', async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { originalInput, tweakPrompt } = req.body;
      
      if (!originalInput || !tweakPrompt) {
        return res.status(400).json({
          success: false,
          error: 'Both originalInput and tweakPrompt are required'
        });
      }

      const clientIP = req.ip || req.connection.remoteAddress;
      logger.info(`🔧 Plan refinement request from ${clientIP}: "${tweakPrompt}"`);
      
      const result = await planner.refinePlan(originalInput, tweakPrompt);      

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.info(`📤 Refinement response sent in ${duration}s - Success: ${result.success}`);
      
      res.json(result);
      
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      logger.error(`❌ Refinement request failed in ${duration}s:`, error.message);
      
      res.status(500).json({
        success: false,
        error: 'Plan refinement failed',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
      });
    }
  });

  // Graph-specific health check
  app.get('/api/health', async (req, res) => {
    try {
      const health = await planner.healthCheck();
      
      if (health.status === 'healthy') {
        res.json(health);
      } else {
        res.status(503).json(health);
      }
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        architecture: 'graph-based',
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Graph statistics and analytics
  app.get('/api/graph/stats', (req, res) => {
    try {
      const stats = planner.getGraphStats();
      res.json({
        success: true,
        graphStats: stats,
        analytics: planner.getAnalytics(),
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get graph stats'
      });
    }
  });

  // Cache management
  app.get('/api/cache/stats', (req, res) => {
    try {
      const stats = planner.getCacheStats();
      res.json({
        success: true,
        cache: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get cache stats'
      });
    }
  });

  app.post('/api/cache/clear', (req, res) => {
    try {
      planner.clearCache();
      res.json({
        success: true,
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to clear cache'
      });
    }
  });

  // Updated examples with refinement examples
  app.get('/api/examples', (req, res) => {
    res.json({
      basicExamples: [
        "Corporate training for 50 people in Bangalore on June 10th. Budget ₹1.5 lakhs.",
        "Team offsite for 30 people in Goa next Friday. Budget 2 lakhs. Need vegetarian food.",
        "Leadership seminar for 25 executives in Mumbai on December 15th. Budget ₹3 lakhs.",
        "Annual conference for 100 people in Delhi on March 20th. Budget ₹5 lakhs. Premium setup."
      ],
      refinementExamples: [
        {
          original: "Corporate training for 50 people in Bangalore on June 10th. Budget ₹1.5 lakhs.",
          tweaks: [
            "Make it more interactive with team building activities",
            "Focus on technology training specifically",
            "Add outdoor activities during breaks",
            "Include guest speakers from the industry"
          ]
        },
        {
          original: "Team offsite for 30 people in Goa next Friday. Budget 2 lakhs.",
          tweaks: [
            "Make it a beach-themed event",
            "Add water sports activities", 
            "Focus on leadership development",
            "Include cultural evening program"
          ]
        }
      ],
      graphFlow: {
        steps: ["parse", "validate", "plan", "venues"],
        description: "Each request flows through parsing, validation, planning, and venue search nodes",
        parallelSupport: false,
        tweakingSupported: true
      }
    });
  });

  // API documentation
  app.get('/api/docs', (req, res) => {
    res.json({
      title: "Corporate Event Planner API (Graph-based)",
      version: "2.0.0",
      architecture: "State Graph Flow",
      description: "Generate comprehensive corporate event plans using a state-based graph flow architecture",
      endpoints: {
        "POST /api/generate-event-plan": {
          description: "Generate event plan from natural language input using graph flow",
          body: {
            input: "string - Event description (required)",
            tweakPrompt: "string - Refinement instructions (optional)"
          },
          response: {
            success: "boolean",
            eventData: "object - Parsed event details",
            eventPlan: "string - Formatted event plan",
            venues: "array - Venue suggestions",
            generationTime: "string - Time taken",
            graphMetadata: "object - Graph execution details",
            summary: "object - Executive summary",
            qualityIndicators: "object - Quality metrics"
          }
        },
        "POST /api/refine-plan": {
          description: "Refine existing plan with additional instructions",
          body: {
            originalInput: "string - Original event description",
            tweakPrompt: "string - Refinement instructions"
          }
        },
        "GET /api/graph/stats": {
          description: "Get graph execution statistics and architecture info"
        },
        "GET /api/health": {
          description: "Comprehensive health check for graph-based planner"
        }
      },
      graphFlow: {
        nodes: ["parse", "validate", "plan", "venues", "error"],
        execution: "sequential with conditional routing",
        refinement: "supported via tweakPrompt",
        caching: "enabled for non-tweaked requests",
        errorHandling: "graceful fallback at each step"
      }
    });
  });

  logger.info('✅ Graph-based API routes configured successfully');
}