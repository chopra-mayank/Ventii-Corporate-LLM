import { StateGraph } from "@langchain/langgraph";
import { eventPlannerStateSchema, createInitialState, StateHelpers } from "./state.js";
import { parseInputNode } from "../agents/inputParser.js";
import { validateDataNode } from "../agents/validator.js";
import { generatePlanNode } from "../agents/planGenerator.js";
import { searchVenuesNode } from "../agents/venueSearcher.js";
import { errorHandlerNode } from "../agents/errorHandler.js";
import { logger } from "../utils/logger.js";

const graph = new StateGraph(eventPlannerStateSchema);

graph.addNode("parse", parseInputNode);
graph.addNode("validate", validateDataNode);
graph.addNode("plan", generatePlanNode);
graph.addNode("venueSearch", searchVenuesNode);
graph.addNode("error", errorHandlerNode);

graph.addConditionalEdges(
  "parse",
  (state) => {
    logger.debug('🔀 Parse node routing decision:', state.nextAction);
    return state.nextAction;
  },
  {
    validate: "validate",
    error: "error"
  }
);

graph.addConditionalEdges(
  "validate", 
  (state) => {
    logger.debug('🔀 Validate node routing decision:', state.nextAction);
    return state.nextAction;
  },
  {
    plan: "plan",
    error: "error"
  }
);

graph.addConditionalEdges(
  "plan",
  (state) => {
    logger.debug('🔀 Plan node routing decision:', state.nextAction);
    return state.nextAction;
  },
  {
    venueSearch: "venueSearch",
    error: "error"
  }
);

graph.addConditionalEdges(
  "venueSearch",
  (state) => {
    logger.debug('🔀 Venue search node routing decision:', state.nextAction);
    return state.nextAction;
  },
  {
    END: "__end__",
    error: "error"
  }
);

graph.addConditionalEdges(
  "error",
  (state) => {
    logger.debug('🔀 Error node routing decision:', state.nextAction);
    return state.nextAction;
  },
  {
    END: "__end__"
  }
);

graph.addEdge("__start__", "parse");

export const eventPlannerGraph = graph.compile();

/**
 * Main execution function for the event planning graph
 * @param {string} naturalInput - User's natural language description
 * @param {string} tweakPrompt - Optional refinement prompt
 * @returns {Object} Complete event planning result
 */
export async function executeEventPlanning(naturalInput, tweakPrompt = null) {
  const startTime = Date.now();
  const executionId = generateExecutionId();
  
  logger.info(`🚀 [${executionId}] Starting event planning graph execution`, {
    input: naturalInput.substring(0, 100) + (naturalInput.length > 100 ? '...' : ''),
    isRefinement: !!tweakPrompt,
    tweakPrompt: tweakPrompt?.substring(0, 50) + (tweakPrompt?.length > 50 ? '...' : '')
  });
  
  try {
    const initialState = createInitialState(naturalInput, tweakPrompt);
    
    logger.debug(`📊 [${executionId}] Initial state created`, {
      nextAction: initialState.nextAction,
      hasInput: !!initialState.userInput.naturalInput
    });

    const result = await executeWithTracking(initialState, executionId);
    
    const executionTime = Date.now() - startTime;
    const finalResult = enhanceResultWithMetrics(result, executionTime, executionId);

    logger.info(`✅ [${executionId}] Event planning graph execution completed`, {
      success: finalResult.success,
      executionTime: `${(executionTime / 1000).toFixed(2)}s`,
      stepsCompleted: StateHelpers.getCompletedSteps(finalResult).length,
      
      hasWarnings: StateHelpers.hasWarnings(finalResult)
    });
    
    return finalResult;

  } catch (error) {
    const executionTime = Date.now() - startTime;
    
    logger.error(`❌ [${executionId}] Event planning graph execution failed`, {
      error: error.message,
      executionTime: `${(executionTime / 1000).toFixed(2)}s`,
      stack: error.stack
    });
    
    return createErrorResult(error, executionTime, naturalInput, tweakPrompt);
  }
}

/**
 * Execute graph with detailed tracking and logging
 * @param {Object} initialState - Initial state object
 * @param {string} executionId - Unique execution identifier
 * @returns {Object} Execution result
 */
async function executeWithTracking(initialState, executionId) {
  const stepStartTime = Date.now();
  
  const result = await eventPlannerGraph.invoke(initialState, {
    configurable: {
      executionId,
      startTime: stepStartTime,
      logProgress: true
    }
  });
  
  const executionTime = Date.now() - stepStartTime;
  
  logger.info(`📈 [${executionId}] Graph execution summary`, {
    finalAction: result.nextAction,
    success: result.success,
    stepsCompleted: StateHelpers.getCompletedSteps(result),
    progress: StateHelpers.getProgress(result),
    errors: result.errors?.length || 0,
    warnings: result.warnings?.length || 0,
    executionTime: `${(executionTime / 1000).toFixed(2)}s`
  });
  
  return result;
}

/**
 * Enhance result with execution metrics and metadata
 * @param {Object} result - Graph execution result
 * @param {number} executionTime - Total execution time in ms
 * @param {string} executionId - Execution identifier
 * @returns {Object} Enhanced result
 */
function enhanceResultWithMetrics(result, executionId, startTime) {
  return {
    ...result,
    executionAnalytics: {
      executionId,
      totalExecutionTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
      stepsCompleted: result.executionMetadata?.stepsCompleted || [],
      progressPercentage: result.success ? 100 : 0,
      usedFallbacks: (result.warnings || []).some(w => w.includes('fallback')),
      timestamp: new Date().toISOString()
    },
    graphMetadata: {
      architecture: 'state-graph',
      executionModel: 'sequential-with-recovery',
      nodeCount: 5,
      finalAction: result.nextAction || 'unknown'
    },
    summary: {
      status: result.success ? 'Completed' : 'Failed',
      stepsCompleted: result.executionMetadata?.stepsCompleted || [],
      errors: result.errors?.length || 0,
      warnings: result.warnings?.length || 0,
      message: result.success ? 
        'Event plan generated successfully' : 
        'Event planning failed with errors'
    }
  };
}

/**
 * Create error result when graph execution fails
 * @param {Error} error - The error that occurred
 * @param {number} executionTime - Time elapsed before failure
 * @param {string} naturalInput - Original input
 * @param {string} tweakPrompt - Refinement prompt if any
 * @returns {Object} Error result object
 */
function createErrorResult(error, executionTime, naturalInput, tweakPrompt) {
  return {
    success: false,
    error: error.message,
    errors: [`Graph execution failed: ${error.message}`],
    warnings: [],
    generationTime: `${(executionTime / 1000).toFixed(2)} seconds`,
    timestamp: new Date().toISOString(),
    nextAction: "END",
    userInput: {
      naturalInput,
      tweakPrompt
    },
    executionAnalytics: {
      totalTime: executionTime,
      failed: true,
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
 * Generate unique execution ID
 * @returns {string} Unique execution identifier
 */
function generateExecutionId() {
  return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate execution path description
 * @param {Object} result - Execution result
 * @returns {Array} Array of executed steps
 */
function generateExecutionPath(result) {
  const path = ['parse']; // Always starts with parse
  
  if (StateHelpers.hasEventData(result)) path.push('validate');
  if (StateHelpers.hasPlan(result)) path.push('plan');
  if (StateHelpers.hasVenues(result)) path.push('venueSearch');
  if (StateHelpers.hasErrors(result)) path.push('error');
  return path;
}

/**
 * Calculate performance metrics for each node
 * @param {Object} result - Execution result
 * @returns {Object} Node performance metrics
 */
function calculateNodePerformance(result) {
  return {
    parsing: {
      successful: StateHelpers.hasEventData(result),
      hadFallback: false
    },
    validation: {
      successful: StateHelpers.hasEventData(result) && !StateHelpers.hasErrors(result),
      appliedSanitization: result.validationMetadata?.sanitized || false
    },
    planning: {
      successful: StateHelpers.hasPlan(result),
      usedFallback: result.planMetadata?.isFallback || false
    },
    venueSearch: { 
      successful: StateHelpers.hasVenues(result),
      usedFallback: result.venueMetadata?.isFallback || false,
      resultsCount: result.venues?.length || 0
    }
  };
}

/**
 * Count state transitions during execution
 * @param {Object} result - Execution result
 * @returns {number} Number of state transitions
 */
function countStateTransitions(result) {
  const completedSteps = StateHelpers.getCompletedSteps(result);
  return completedSteps.length + (StateHelpers.hasErrors(result) ? 1 : 0);
}

/**
 * Validate graph configuration
 * @returns {Object} Validation result
 */
export function validateGraphConfiguration() {
  try {
    if (!eventPlannerGraph) {
      throw new Error('Event planner graph is not defined');
    }
    
    const testState = createInitialState("test input for validation", null);
    
    const validTestState = {
      ...testState,
      userInput: {
        ...testState.userInput,
        tweakPrompt: undefined
      }
    };
    
    eventPlannerStateSchema.parse(validTestState);
    const expectedNodes = ['parse', 'validate', 'plan', 'venueSearch', 'error'];
    
    return {
      valid: true,
      expectedNodes,
      message: 'Graph configuration is valid',
      schemaValidation: 'passed',
      graphCompiled: true
    };
    
  } catch (error) {
    return {
      valid: false,
      error: error.message,
      message: 'Graph configuration validation failed'
    };
  }
}

/**
 * Get graph statistics
 * @returns {Object} Graph statistics
 */
export function getGraphStatistics() {
  return {
    architecture: 'LangGraph State Machine',
    totalNodes: 5,
    nodeTypes: {
      processing: ['parse', 'validate', 'plan', 'venueSearch'],
      error: ['error']
    },
    features: [
      'Sequential execution with conditional routing',
      'State validation with Zod schemas',
      'Comprehensive error handling',
      'Plan refinement support',
      'Execution tracking and analytics',
      'Graceful fallback mechanisms'
    ],
    stateSchema: 'Validated with Zod',
    executionModel: 'Sequential with error recovery',
    supportedRefinements: true,
    cacheCompatible: true
  };
}