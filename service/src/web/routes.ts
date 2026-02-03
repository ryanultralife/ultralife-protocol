import { Request, Response, NextFunction } from 'express';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { z } from 'zod';

// Paths to data files
const PROTOCOL_SPEC_PATH = '/home/user/ultralife-protocol/protocol-spec.json';
const DEPLOYMENT_PATH = '/home/user/ultralife-protocol/scripts/deployment.json';

// Cache for protocol spec (loaded once at startup)
let protocolSpecCache: any = null;
let deploymentCache: any = null;
let lastDeploymentLoad = 0;
const DEPLOYMENT_CACHE_TTL = 5000; // 5 seconds

// Load protocol spec on startup
async function loadProtocolSpec() {
  if (!protocolSpecCache) {
    try {
      const data = await readFile(PROTOCOL_SPEC_PATH, 'utf-8');
      protocolSpecCache = JSON.parse(data);
      console.log('Protocol specification loaded successfully');
    } catch (error) {
      console.error('Failed to load protocol specification:', error);
      throw error;
    }
  }
  return protocolSpecCache;
}

// Load deployment state with caching
async function loadDeploymentState() {
  const now = Date.now();
  if (!deploymentCache || now - lastDeploymentLoad > DEPLOYMENT_CACHE_TTL) {
    try {
      const data = await readFile(DEPLOYMENT_PATH, 'utf-8');
      deploymentCache = JSON.parse(data);
      lastDeploymentLoad = now;
      console.log('Deployment state loaded successfully');
    } catch (error) {
      console.warn('Failed to load deployment state:', error);
      deploymentCache = null;
    }
  }
  return deploymentCache;
}

// Initialize spec on module load
loadProtocolSpec().catch(console.error);

// Validation schemas
const CompoundIdSchema = z.string().min(1).max(50);
const ValidatorIdSchema = z.string().min(1).max(100);

// Route handlers

/**
 * GET /spec - Full protocol specification
 */
export async function getProtocolSpec(req: Request, res: Response, next: NextFunction) {
  try {
    const spec = await loadProtocolSpec();
    res.json(spec);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /spec/compounds - List all compound categories
 */
export async function getCompounds(req: Request, res: Response, next: NextFunction) {
  try {
    const spec = await loadProtocolSpec();
    const compounds = spec.compounds;

    // Build a flattened list with metadata
    const compoundsList: any[] = [];

    for (const [category, categoryCompounds] of Object.entries(compounds)) {
      for (const [code, details] of Object.entries(categoryCompounds as Record<string, any>)) {
        compoundsList.push({
          code,
          category,
          ...details,
        });
      }
    }

    res.json({
      total: compoundsList.length,
      categories: Object.keys(compounds),
      compounds: compoundsList,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /spec/compounds/:id - Get specific compound by ID
 */
export async function getCompoundById(req: Request, res: Response, next: NextFunction) {
  try {
    const idValidation = CompoundIdSchema.safeParse(req.params.id);

    if (!idValidation.success) {
      return res.status(400).json({
        error: 'Invalid compound ID',
        details: idValidation.error.errors,
      });
    }

    const compoundId = idValidation.data.toUpperCase();
    const spec = await loadProtocolSpec();
    const compounds = spec.compounds;

    // Search through all categories
    for (const [category, categoryCompounds] of Object.entries(compounds)) {
      const compound = (categoryCompounds as Record<string, any>)[compoundId];
      if (compound) {
        return res.json({
          code: compoundId,
          category,
          ...compound,
        });
      }
    }

    res.status(404).json({
      error: 'Compound not found',
      id: compoundId,
      hint: 'Use /spec/compounds to see all available compounds',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /spec/validators - List all validators
 */
export async function getValidators(req: Request, res: Response, next: NextFunction) {
  try {
    const spec = await loadProtocolSpec();

    // Extract validator information from the spec
    const validators = [
      {
        id: 'compound-flow',
        name: 'Compound Flow Validator',
        description: 'Validates compound flows in transactions with confidence levels',
        fields: ['compound', 'quantity', 'unit', 'measurement', 'confidence'],
      },
      {
        id: 'transaction',
        name: 'Transaction Validator',
        description: 'Validates UltraLife protocol transactions',
        types: spec.transaction_types,
      },
      {
        id: 'land-sequestration',
        name: 'Land Sequestration Validator',
        description: 'Validates land registration and sequestration credit generation',
        rates: spec.land_sequestration,
      },
      {
        id: 'confidence-level',
        name: 'Confidence Level Validator',
        description: 'Validates measurement confidence levels',
        levels: spec.confidence_levels,
      },
    ];

    res.json({
      total: validators.length,
      validators,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /spec/validators/:id - Get specific validator
 */
export async function getValidatorById(req: Request, res: Response, next: NextFunction) {
  try {
    const idValidation = ValidatorIdSchema.safeParse(req.params.id);

    if (!idValidation.success) {
      return res.status(400).json({
        error: 'Invalid validator ID',
        details: idValidation.error.errors,
      });
    }

    const validatorId = idValidation.data.toLowerCase();
    const spec = await loadProtocolSpec();

    const validators: Record<string, any> = {
      'compound-flow': {
        id: 'compound-flow',
        name: 'Compound Flow Validator',
        description: 'Validates compound flows in transactions with confidence levels',
        onChainTypes: spec.on_chain_types,
        measurementMethods: spec.on_chain_types.MeasurementMethod,
        confidenceLevels: spec.confidence_levels,
        examples: spec.transaction_examples,
      },
      'transaction': {
        id: 'transaction',
        name: 'Transaction Validator',
        description: 'Validates UltraLife protocol transactions',
        types: spec.transaction_types,
        commandTemplates: spec.command_templates,
        examples: spec.transaction_examples,
      },
      'land-sequestration': {
        id: 'land-sequestration',
        name: 'Land Sequestration Validator',
        description: 'Validates land registration and sequestration credit generation',
        sequestration: spec.land_sequestration,
        debtOffset: spec.debt_offset,
      },
      'confidence-level': {
        id: 'confidence-level',
        name: 'Confidence Level Validator',
        description: 'Validates measurement confidence levels',
        levels: spec.confidence_levels,
        measurementGuidance: spec.measurement_guidance,
      },
    };

    const validator = validators[validatorId];

    if (!validator) {
      return res.status(404).json({
        error: 'Validator not found',
        id: validatorId,
        available: Object.keys(validators),
      });
    }

    res.json(validator);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /deployment - Current deployment state
 */
export async function getDeploymentState(req: Request, res: Response, next: NextFunction) {
  try {
    const deployment = await loadDeploymentState();

    if (!deployment) {
      return res.status(404).json({
        error: 'Deployment state not available',
        message: 'No deployment data found. Run deployment scripts first.',
      });
    }

    // Return a summary of deployment state
    const summary = {
      testUsers: deployment.testUsers?.length || 0,
      pnfts: deployment.pnfts?.length || 0,
      lands: deployment.lands?.length || 0,
      transactions: deployment.transactions?.length || 0,
      bioregions: deployment.bioregions?.length || 0,
      totalUltraBalance: Object.values(deployment.ultraBalances || {}).reduce((sum: number, val: any) => sum + val, 0),
      sequestrationCredits: deployment.sequestrationCredits?.length || 0,
      creditPurchases: deployment.creditPurchases?.length || 0,
    };

    res.json({
      summary,
      details: deployment,
      lastUpdated: deployment.lastDeploymentLoad || new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /health - Health check
 */
export async function getHealthCheck(req: Request, res: Response, next: NextFunction) {
  try {
    const spec = await loadProtocolSpec();
    const deployment = await loadDeploymentState();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        protocolSpec: {
          loaded: !!spec,
          version: spec?.version || 'unknown',
        },
        deployment: {
          loaded: !!deployment,
          testMode: deployment?.pnfts?.[0]?.testnetSimulated || false,
        },
      },
      uptime: process.uptime(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        unit: 'MB',
      },
    };

    res.json(health);
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Service unavailable',
    });
  }
}

// Export all handlers
export default {
  getProtocolSpec,
  getCompounds,
  getCompoundById,
  getValidators,
  getValidatorById,
  getDeploymentState,
  getHealthCheck,
};
