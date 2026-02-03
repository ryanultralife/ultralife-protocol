/**
 * UltraLife Local Indexer Factory
 *
 * Creates a simulation indexer for local development and testing.
 * Uses deployment.json as the data source instead of querying blockchain.
 */

import { join } from 'path';
import { SimulationIndexer } from './simulation.js';
import type {
  DeploymentData,
  DeploymentPnft,
  DeploymentLand,
  DeploymentBioregionStats,
  DeploymentCreditBalance,
  DeploymentOffering,
  DeploymentNeed,
} from './simulation.js';

// =============================================================================
// FACTORY OPTIONS
// =============================================================================

export interface LocalIndexerOptions {
  /**
   * Path to deployment.json file.
   * Defaults to {cwd}/scripts/deployment.json
   */
  deploymentPath?: string;

  /**
   * Project root directory.
   * If provided, deploymentPath will be relative to this.
   */
  projectRoot?: string;
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Creates a simulation indexer for local development.
 *
 * Usage:
 * ```typescript
 * import { createLocalIndexer } from './indexer/index-local.js';
 *
 * const indexer = createLocalIndexer();
 * await indexer.initialize();
 *
 * // Query simulated data
 * const pnfts = await indexer.listPnfts();
 * const balance = await indexer.getTokenBalance('addr_test1...');
 * ```
 *
 * @param options Configuration options
 * @returns SimulationIndexer instance
 */
export function createLocalIndexer(options?: LocalIndexerOptions): SimulationIndexer {
  let deploymentPath: string;

  if (options?.deploymentPath) {
    // Use explicit path if provided
    deploymentPath = options.deploymentPath;
  } else if (options?.projectRoot) {
    // Build path from project root
    deploymentPath = join(options.projectRoot, 'scripts', 'deployment.json');
  } else {
    // Default: relative to current working directory
    deploymentPath = join(process.cwd(), 'scripts', 'deployment.json');
  }

  return new SimulationIndexer(deploymentPath);
}

/**
 * Creates a simulation indexer with the standard UltraLife project layout.
 * Assumes the project root is /home/user/ultralife-protocol
 *
 * @returns SimulationIndexer instance
 */
export function createUltraLifeLocalIndexer(): SimulationIndexer {
  const projectRoot = '/home/user/ultralife-protocol';
  return createLocalIndexer({ projectRoot });
}

// =============================================================================
// TYPE-COMPATIBLE INTERFACE
// =============================================================================

/**
 * Interface that matches what MCP tools expect from an indexer.
 * Both SimulationIndexer and UltraLifeIndexer implement this interface.
 */
export interface IndexerInterface {
  // Initialization
  initialize(): Promise<void>;
  syncState(): Promise<void>;

  // pNFT queries
  getPnft(pnftId: string): Promise<unknown>;
  getPnftByOwner(address: string): Promise<unknown>;
  listPnfts(options?: { bioregion?: string; minLevel?: number; limit?: number }): Promise<unknown[]>;

  // Token queries
  getTokenBalance(address: string): Promise<bigint>;
  getPnftTokenBalance(pnftId: string): Promise<bigint>;

  // Bioregion queries
  listBioregions(): Promise<unknown[]>;
  getBioregion(bioregionId: string): Promise<unknown>;

  // Offering queries
  listOfferings(options?: { bioregion?: string; offerer?: string; status?: string; limit?: number }): Promise<unknown[]>;
  getOffering(offeringId: string): Promise<unknown>;

  // Need queries
  listNeeds(options?: { bioregion?: string; needer?: string; status?: string; limit?: number }): Promise<unknown[]>;
  getNeed(needId: string): Promise<unknown>;

  // Collective queries
  listCollectives(options?: { bioregion?: string; member?: string }): Promise<unknown[]>;
  getCollective(collectiveId: string): Promise<unknown>;

  // Protocol stats
  getProtocolStats(): Promise<{
    totalPnfts: number;
    totalBioregions: number;
    activeOfferings: number;
    activeNeeds: number;
    totalValueLocked: bigint;
  }>;

  // Spending bucket queries
  getSpendingBuckets(pnftId: string): Promise<unknown>;
  getBucket(pnftId: string, bucketId: string): Promise<unknown>;
  listBuckets(pnftId: string): Promise<unknown[]>;

  // Treasury queries
  getTreasuryState(): Promise<unknown>;
  getTokenPrice(): Promise<unknown>;
  simulatePurchase(adaAmount: number): Promise<unknown>;
  getFounderStatus(): Promise<unknown>;
}

// =============================================================================
// SIMULATION-SPECIFIC INTERFACE
// =============================================================================

/**
 * Extended interface for simulation-specific methods.
 * These are additional methods only available on SimulationIndexer.
 */
export interface SimulationIndexerInterface extends IndexerInterface {
  // Land queries
  listLands(): Promise<DeploymentLand[]>;
  getLand(landId: string): Promise<DeploymentLand | null>;

  // Credit queries
  getCreditBalances(): Promise<Record<string, DeploymentCreditBalance>>;
  getCreditBalance(address: string): Promise<DeploymentCreditBalance | null>;

  // Impact debt queries
  getImpactDebt(address: string): Promise<number>;
  getAllImpactDebt(): Promise<Record<string, number>>;

  // Transaction history
  getTransactions(options?: {
    address?: string;
    pnftId?: string;
    bioregion?: string;
    limit?: number;
  }): Promise<unknown[]>;

  // Sequestration credits
  getSequestrationCredits(): Promise<unknown[]>;
  getCreditPurchases(): Promise<unknown[]>;
}

// =============================================================================
// RE-EXPORTS
// =============================================================================

export { SimulationIndexer };
export type {
  DeploymentData,
  DeploymentPnft,
  DeploymentLand,
  DeploymentBioregionStats,
  DeploymentCreditBalance,
  DeploymentOffering,
  DeploymentNeed,
};

export default createLocalIndexer;
