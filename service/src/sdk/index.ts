/**
 * UltraLife SDK
 *
 * Unified TypeScript SDK for interacting with the UltraLife Protocol on Cardano.
 *
 * Usage:
 * ```typescript
 * import { UltraLifeSDK, createConfig } from '@ultralife/sdk';
 *
 * const sdk = new UltraLifeSDK(createConfig({
 *   network: 'preprod',
 *   blockfrostApiKey: 'your-key-here'
 * }));
 *
 * await sdk.initialize();
 *
 * // Query data
 * const pnft = await sdk.indexer.getPnft('some-pnft-id');
 * const buckets = await sdk.indexer.listBuckets(pnft.pnft_id);
 *
 * // Build transactions
 * const tx = await sdk.builder.buildMintPnft({ ... });
 *
 * // Use metadata builders
 * const impact = sdk.metadata.createActivityImpact([
 *   sdk.metadata.createCompoundFlow('CO2', 500, 'Grams', 'Estimated')
 * ]);
 * ```
 */

export { UltraLifeIndexer } from '../indexer/index.js';
export { UltraLifeTxBuilder, type TxSummary } from '../builder/index.js';
export { UltraLifeMcpServer, startMcpServer } from '../mcp/index.js';

// Types
export * from '../types/index.js';

// New modules
export * from './metadata.js';
export * from './wallet.js';
export * from './ubi.js';

// Main SDK class
import type { UltraLifeConfig, ContractAddresses, ReferenceScripts } from '../types/index.js';
import { UltraLifeIndexer } from '../indexer/index.js';
import { UltraLifeTxBuilder } from '../builder/index.js';
import { MetadataBuilder } from './metadata.js';
import { WalletHelpers } from './wallet.js';
import { UbiOperations } from './ubi.js';

/**
 * Main SDK class - provides unified access to all UltraLife functionality
 */
export class UltraLifeSDK {
  public readonly config: UltraLifeConfig;
  public readonly indexer: UltraLifeIndexer;
  public readonly builder: UltraLifeTxBuilder;
  public readonly metadata: MetadataBuilder;
  public readonly wallet: WalletHelpers;
  public readonly ubi: UbiOperations;

  private initialized: boolean = false;

  constructor(config: UltraLifeConfig) {
    this.config = config;
    this.indexer = new UltraLifeIndexer(config);
    this.builder = new UltraLifeTxBuilder(config, this.indexer);
    this.metadata = new MetadataBuilder();
    this.wallet = new WalletHelpers(config.network);
    this.ubi = new UbiOperations(config, this.indexer, this.builder);
  }

  /**
   * Initialize the SDK - must be called before using indexer or builder
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await Promise.all([
      this.indexer.initialize(),
      this.builder.initialize(),
    ]);

    this.initialized = true;
  }

  /**
   * Check if SDK is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get protocol statistics
   */
  async getStats() {
    return this.indexer.getProtocolStats();
  }

  /**
   * Get current network
   */
  getNetwork(): 'mainnet' | 'preprod' | 'preview' {
    return this.config.network;
  }
}

/**
 * Create SDK configuration with defaults
 */
export function createConfig(options: {
  network: 'mainnet' | 'preprod' | 'preview';
  blockfrostApiKey: string;
  contracts?: Partial<ContractAddresses>;
  referenceScripts?: Partial<ReferenceScripts>;
}): UltraLifeConfig {
  // Default contract addresses (testnet placeholders)
  const defaultContracts: ContractAddresses = {
    // Identity
    pnft_policy: process.env.PNFT_POLICY || 'addr_test1TODO_PNFT_POLICY',
    pnft_spend: process.env.PNFT_SPEND || 'addr_test1TODO_PNFT_SPEND',
    recovery: process.env.RECOVERY || 'addr_test1TODO_RECOVERY',

    // Token
    token_policy: process.env.TOKEN_POLICY || 'addr_test1TODO_TOKEN_POLICY',
    token_spend: process.env.TOKEN_SPEND || 'addr_test1TODO_TOKEN_SPEND',
    treasury: process.env.TREASURY || 'addr_test1TODO_TREASURY',

    // Marketplace
    marketplace: process.env.MARKETPLACE || 'addr_test1TODO_MARKETPLACE',
    work_auction: process.env.WORK_AUCTION || 'addr_test1TODO_WORK_AUCTION',

    // Records & Registry
    records: process.env.RECORDS || 'addr_test1TODO_RECORDS',
    registry: process.env.REGISTRY || 'addr_test1TODO_REGISTRY',
    memory: process.env.MEMORY || 'addr_test1TODO_MEMORY',

    // Bioregion & Land
    bioregion: process.env.BIOREGION || 'addr_test1TODO_BIOREGION',
    land_rights: process.env.LAND_RIGHTS || 'addr_test1TODO_LAND_RIGHTS',
    commons: process.env.COMMONS || 'addr_test1TODO_COMMONS',

    // Staking & Governance
    stake_pool: process.env.STAKE_POOL || 'addr_test1TODO_STAKE_POOL',
    governance: process.env.GOVERNANCE || 'addr_test1TODO_GOVERNANCE',
    ubi: process.env.UBI || 'addr_test1TODO_UBI',

    // Impact
    impact: process.env.IMPACT || 'addr_test1TODO_IMPACT',
    impact_market: process.env.IMPACT_MARKET || 'addr_test1TODO_IMPACT_MARKET',
    asset_impact: process.env.ASSET_IMPACT || 'addr_test1TODO_ASSET_IMPACT',
    remediation: process.env.REMEDIATION || 'addr_test1TODO_REMEDIATION',
    preservation: process.env.PRESERVATION || 'addr_test1TODO_PRESERVATION',

    // Collectives & Care
    collective: process.env.COLLECTIVE || 'addr_test1TODO_COLLECTIVE',
    care: process.env.CARE || 'addr_test1TODO_CARE',

    // Infrastructure
    energy: process.env.ENERGY || 'addr_test1TODO_ENERGY',
    grants: process.env.GRANTS || 'addr_test1TODO_GRANTS',
    genesis: process.env.GENESIS || 'addr_test1TODO_GENESIS',

    // Hydra
    spending_bucket: process.env.SPENDING_BUCKET || 'addr_test1TODO_SPENDING_BUCKET',
    ultralife_validator: process.env.ULTRALIFE_VALIDATOR || 'addr_test1TODO_ULTRALIFE_VALIDATOR',
    fee_pool: process.env.FEE_POOL || 'addr_test1TODO_FEE_POOL',
  };

  // Default reference scripts (placeholder)
  const placeholderRef = { txHash: '0'.repeat(64), outputIndex: 0 };
  const defaultReferenceScripts: ReferenceScripts = {
    pnft_mint: placeholderRef,
    pnft_spend: placeholderRef,
    recovery: placeholderRef,
    token: placeholderRef,
    treasury: placeholderRef,
    marketplace: placeholderRef,
    work_auction: placeholderRef,
    records: placeholderRef,
    registry: placeholderRef,
    memory: placeholderRef,
    bioregion: placeholderRef,
    land_rights: placeholderRef,
    commons: placeholderRef,
    stake_pool: placeholderRef,
    governance: placeholderRef,
    ubi: placeholderRef,
    impact: placeholderRef,
    impact_market: placeholderRef,
    asset_impact: placeholderRef,
    remediation: placeholderRef,
    preservation: placeholderRef,
    collective: placeholderRef,
    care: placeholderRef,
    energy: placeholderRef,
    grants: placeholderRef,
    genesis: placeholderRef,
    spending_bucket: placeholderRef,
    ultralife_validator: placeholderRef,
    fee_pool: placeholderRef,
  };

  return {
    network: options.network,
    blockfrostApiKey: options.blockfrostApiKey,
    contracts: { ...defaultContracts, ...options.contracts },
    referenceScripts: { ...defaultReferenceScripts, ...options.referenceScripts },
  };
}

export default UltraLifeSDK;
