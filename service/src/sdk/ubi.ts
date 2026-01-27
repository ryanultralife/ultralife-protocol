/**
 * UBI (Universal Basic Income) Operations
 *
 * Handles UBI pool initialization, claims, and distribution queries
 * for the UltraLife Protocol.
 */

import {
  Lucid,
  Blockfrost,
  Data,
  fromHex,
  toHex,
  UTxO,
  TxComplete,
  Constr,
} from 'lucid-cardano';
import type {
  UltraLifeConfig,
  UbiPeriodStats,
  AssetName,
  ByteArray,
} from '../types/index.js';
import { UltraLifeIndexer } from '../indexer/index.js';
import { UltraLifeTxBuilder, TxSummary } from '../builder/index.js';

// =============================================================================
// UBI CONSTANTS (matching Aiken contracts)
// =============================================================================

export const UBI_CONSTANTS = {
  // Fee allocation
  BASE_UBI_FEE_SHARE_BPS: 5000,    // 50% starting point
  MIN_UBI_FEE_SHARE_BPS: 3000,     // 30% floor
  MAX_UBI_FEE_SHARE_BPS: 7000,     // 70% ceiling

  // Per-person targets
  TARGET_UBI_PER_PERSON: 100,      // Target per epoch
  MIN_UBI_PER_PERSON: 10,
  MAX_UBI_PER_PERSON: 500,
  SURVIVAL_FLOOR: 20,              // Everyone gets this

  // Engagement requirements
  MIN_ENGAGEMENT_TX: 5,
  MIN_ENGAGEMENT_COUNTERPARTIES: 2,
  ADJUSTMENT_PERIOD_EPOCHS: 6,     // ~1 month

  // Engagement multipliers (basis points)
  RAMP_1_TX: 2500,   // 25% at 1 tx
  RAMP_2_TX: 5000,   // 50% at 2 tx
  RAMP_3_TX: 7000,   // 70% at 3 tx
  RAMP_4_TX: 8500,   // 85% at 4 tx
  RAMP_FULL: 10000,  // 100% at 5+ tx
} as const;

// =============================================================================
// UBI TYPES
// =============================================================================

export interface UbiPoolInfo {
  bioregion: string;
  cycle: number;
  feesCollected: bigint;
  ubiPool: bigint;
  eligibleCount: number;
  claimsCount: number;
  distributed: bigint;
  distributionStart: number;
  estimatedPerPerson: bigint;
}

export interface UbiClaimInfo {
  pnftId: string;
  cycle: number;
  baseShare: bigint;
  engagementMultiplier: number;
  finalAmount: bigint;
  claimSlot: number;
}

export interface UbiEligibility {
  eligible: boolean;
  reason: string;
  baseAmount: bigint;
  engagementMultiplier: number;
  estimatedAmount: bigint;
  cycleStats?: {
    txCount: number;
    uniqueCounterparties: number;
    volumeTransacted: bigint;
  };
}

// =============================================================================
// UBI OPERATIONS CLASS
// =============================================================================

export class UbiOperations {
  private config: UltraLifeConfig;
  private indexer: UltraLifeIndexer;
  private builder: UltraLifeTxBuilder;
  private lucid: Lucid | null = null;

  constructor(
    config: UltraLifeConfig,
    indexer: UltraLifeIndexer,
    builder: UltraLifeTxBuilder
  ) {
    this.config = config;
    this.indexer = indexer;
    this.builder = builder;
  }

  /**
   * Initialize Lucid for UBI operations
   */
  async initialize(): Promise<void> {
    this.lucid = await Lucid.new(
      new Blockfrost(
        `https://cardano-${this.config.network}.blockfrost.io/api`,
        this.config.blockfrostApiKey
      ),
      this.config.network === 'mainnet' ? 'Mainnet' : 'Preprod'
    );
  }

  // ===========================================================================
  // QUERY OPERATIONS
  // ===========================================================================

  /**
   * Get UBI pool info for a bioregion
   */
  async getPoolInfo(bioregion: string): Promise<UbiPoolInfo | null> {
    if (!this.lucid) await this.initialize();

    try {
      const utxos = await this.lucid!.utxosAt(this.config.contracts.ubi);

      for (const utxo of utxos) {
        if (utxo.datum) {
          const poolData = this.decodePoolDatum(utxo.datum);
          if (poolData.bioregion === bioregion) {
            // Calculate estimated per-person
            const estimatedPerPerson = poolData.eligibleCount > 0
              ? poolData.ubiPool / BigInt(poolData.eligibleCount)
              : 0n;

            return {
              ...poolData,
              estimatedPerPerson,
            };
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`Error fetching UBI pool for ${bioregion}:`, error);
      return null;
    }
  }

  /**
   * Get all active UBI pools
   */
  async listPools(): Promise<UbiPoolInfo[]> {
    if (!this.lucid) await this.initialize();

    try {
      const utxos = await this.lucid!.utxosAt(this.config.contracts.ubi);
      const pools: UbiPoolInfo[] = [];

      for (const utxo of utxos) {
        if (utxo.datum) {
          try {
            const poolData = this.decodePoolDatum(utxo.datum);
            const estimatedPerPerson = poolData.eligibleCount > 0
              ? poolData.ubiPool / BigInt(poolData.eligibleCount)
              : 0n;

            pools.push({
              ...poolData,
              estimatedPerPerson,
            });
          } catch {
            // Skip malformed datums
          }
        }
      }

      return pools;
    } catch (error) {
      console.error('Error listing UBI pools:', error);
      return [];
    }
  }

  /**
   * Check UBI eligibility for a pNFT
   */
  async checkEligibility(pnftId: string): Promise<UbiEligibility> {
    const pnft = await this.indexer.getPnft(pnftId);

    if (!pnft) {
      return {
        eligible: false,
        reason: 'pNFT not found',
        baseAmount: 0n,
        engagementMultiplier: 0,
        estimatedAmount: 0n,
      };
    }

    // Must be at least Standard level
    if (pnft.level === 'Basic') {
      return {
        eligible: false,
        reason: 'Must be Standard level or higher (DNA verified)',
        baseAmount: 0n,
        engagementMultiplier: 0,
        estimatedAmount: 0n,
      };
    }

    // Must have bioregion assigned
    if (!pnft.bioregion) {
      return {
        eligible: false,
        reason: 'Must have bioregion assigned',
        baseAmount: 0n,
        engagementMultiplier: 0,
        estimatedAmount: 0n,
      };
    }

    // Get pool info
    const pool = await this.getPoolInfo(pnft.bioregion);
    if (!pool) {
      return {
        eligible: false,
        reason: 'No active UBI pool for bioregion',
        baseAmount: 0n,
        engagementMultiplier: 0,
        estimatedAmount: 0n,
      };
    }

    // Calculate base share
    const baseAmount = pool.estimatedPerPerson;

    // Calculate engagement multiplier based on activity
    // In production, this would query the records contract
    const engagementMultiplier = this.calculateEngagementMultiplier(5, 3); // Placeholder

    const estimatedAmount = (baseAmount * BigInt(engagementMultiplier)) / 10000n;

    return {
      eligible: true,
      reason: 'Eligible for UBI claim',
      baseAmount,
      engagementMultiplier,
      estimatedAmount,
      cycleStats: {
        txCount: 5,  // Placeholder
        uniqueCounterparties: 3,  // Placeholder
        volumeTransacted: 1000n * 1_000_000n,  // Placeholder
      },
    };
  }

  /**
   * Get claim history for a pNFT
   */
  async getClaimHistory(pnftId: string, limit: number = 10): Promise<UbiClaimInfo[]> {
    // In production, query the records contract for claim history
    // For now, return empty array
    return [];
  }

  /**
   * Get current period stats
   */
  async getPeriodStats(): Promise<UbiPeriodStats | null> {
    // In production, query the UBI contract for period stats
    // For now, return simulated data
    return {
      period: Math.floor(Date.now() / (30 * 24 * 60 * 60 * 1000)),
      total_distributed: 1_000_000n * 1_000_000n,
      total_claimants: 500,
      avg_ubi_per_person: 2000,
      total_fees: 5_000_000n * 1_000_000n,
      current_fee_share_bps: 5000,
      next_fee_share_bps: 5000,
      epochs_counted: 6,
      start_slot: Date.now() - (30 * 24 * 60 * 60 * 1000),
      end_slot: Date.now(),
    };
  }

  // ===========================================================================
  // TRANSACTION BUILDING
  // ===========================================================================

  /**
   * Build transaction to initialize a UBI pool for a bioregion
   * (Admin/governance only)
   */
  async buildInitializePool(params: {
    bioregion: string;
    initialFees: bigint;
    adminPnft: string;
  }): Promise<{ tx: TxComplete; summary: TxSummary }> {
    if (!this.lucid) await this.initialize();

    const currentCycle = this.getCurrentCycle();

    // Build pool datum
    const poolDatum = Data.to(new Constr(0, [
      fromHex(params.bioregion),            // bioregion
      BigInt(currentCycle),                  // cycle
      params.initialFees,                    // fees_collected
      (params.initialFees * 5000n) / 10000n, // ubi_pool (50% initial)
      0n,                                    // eligible_count (set by aggregation)
      0n,                                    // total_engagement_weight
      0n,                                    // claims_count
      0n,                                    // distributed
      BigInt(Date.now()),                    // distribution_start
    ]));

    const redeemer = Data.to(new Constr(0, [])); // InitializePool variant

    const tx = await this.lucid!
      .newTx()
      .payToContract(
        this.config.contracts.ubi,
        { inline: poolDatum },
        {
          [this.config.contracts.token_policy]: (params.initialFees * 5000n) / 10000n,
          lovelace: 2_000_000n,
        }
      )
      .complete();

    return {
      tx,
      summary: {
        action: 'Initialize UBI Pool',
        description: `Create UBI pool for bioregion with ${params.initialFees} initial fees`,
        pnftId: params.adminPnft,
        costs: { ada: '~2.5 ADA', tokens: (params.initialFees * 5000n) / 10000n },
      },
    };
  }

  /**
   * Build transaction to claim UBI
   */
  async buildClaimUbi(params: {
    pnftId: string;
  }): Promise<{ tx: TxComplete; summary: TxSummary }> {
    if (!this.lucid) await this.initialize();

    // Check eligibility first
    const eligibility = await this.checkEligibility(params.pnftId);
    if (!eligibility.eligible) {
      throw new Error(`Not eligible: ${eligibility.reason}`);
    }

    // Get pNFT for bioregion
    const pnft = await this.indexer.getPnft(params.pnftId);
    if (!pnft || !pnft.bioregion) {
      throw new Error('pNFT not found or no bioregion assigned');
    }

    // Find pool UTxO
    const poolUtxo = await this.findPoolUtxo(pnft.bioregion);
    if (!poolUtxo) {
      throw new Error('UBI pool not found for bioregion');
    }

    const currentCycle = this.getCurrentCycle();

    // Build claim datum
    const claimDatum = Data.to(new Constr(1, [ // ClaimRecord variant
      fromHex(params.pnftId),                  // pnft
      BigInt(currentCycle),                     // cycle
      eligibility.baseAmount,                   // base_share
      BigInt(eligibility.engagementMultiplier), // engagement_mult
      eligibility.estimatedAmount,              // amount
      BigInt(Date.now()),                       // slot
    ]));

    const redeemer = Data.to(new Constr(1, [  // ClaimUbi variant
      fromHex(params.pnftId),
    ]));

    // Get pNFT owner address
    const pnftAssetId = this.config.contracts.pnft_policy + params.pnftId;
    let recipientAddress = 'addr_test1TODO'; // Default

    try {
      const addresses = await this.lucid!.utxosAtWithUnit(
        this.config.contracts.pnft_spend,
        pnftAssetId
      );
      if (addresses.length > 0) {
        // In production, derive address from UTxO
      }
    } catch {
      // Use default
    }

    const tx = await this.lucid!
      .newTx()
      .collectFrom([poolUtxo], redeemer)
      // Update pool with reduced balance
      .payToContract(
        this.config.contracts.ubi,
        { inline: poolUtxo.datum! },
        {
          ...poolUtxo.assets,
          [this.config.contracts.token_policy]:
            (poolUtxo.assets[this.config.contracts.token_policy] || 0n) -
            eligibility.estimatedAmount,
        }
      )
      // Create claim record
      .payToContract(
        this.config.contracts.records,
        { inline: claimDatum },
        { lovelace: 2_000_000n }
      )
      // Pay UBI to recipient
      .payToAddress(
        recipientAddress,
        { [this.config.contracts.token_policy]: eligibility.estimatedAmount }
      )
      .complete();

    return {
      tx,
      summary: {
        action: 'Claim UBI',
        description: `Claim ${eligibility.estimatedAmount} UBI tokens for cycle ${currentCycle}`,
        pnftId: params.pnftId,
        receives: { tokens: eligibility.estimatedAmount },
        costs: { ada: '~0.5 ADA (fees)' },
      },
    };
  }

  /**
   * Build transaction to close a UBI cycle and start new one
   * (Called by validators at epoch end)
   */
  async buildCloseCycle(params: {
    bioregion: string;
    validatorPnft: string;
    feesCollected: bigint;
  }): Promise<{ tx: TxComplete; summary: TxSummary }> {
    if (!this.lucid) await this.initialize();

    const currentCycle = this.getCurrentCycle();

    // Find current pool UTxO
    const poolUtxo = await this.findPoolUtxo(params.bioregion);
    if (!poolUtxo) {
      throw new Error('UBI pool not found for bioregion');
    }

    // Calculate new UBI share (dynamic adjustment)
    const currentShare = UBI_CONSTANTS.BASE_UBI_FEE_SHARE_BPS;
    const newUbiPool = (params.feesCollected * BigInt(currentShare)) / 10000n;

    // Build new pool datum for next cycle
    const newPoolDatum = Data.to(new Constr(0, [
      fromHex(params.bioregion),
      BigInt(currentCycle + 1),               // Next cycle
      params.feesCollected,
      newUbiPool,
      0n,                                     // eligible_count (to be set)
      0n,                                     // total_engagement_weight
      0n,                                     // claims_count
      0n,                                     // distributed
      BigInt(Date.now()),
    ]));

    const redeemer = Data.to(new Constr(2, [])); // CloseCycle variant

    const tx = await this.lucid!
      .newTx()
      .collectFrom([poolUtxo], redeemer)
      .payToContract(
        this.config.contracts.ubi,
        { inline: newPoolDatum },
        {
          [this.config.contracts.token_policy]: newUbiPool,
          lovelace: 2_000_000n,
        }
      )
      .complete();

    return {
      tx,
      summary: {
        action: 'Close UBI Cycle',
        description: `Close cycle ${currentCycle} and start cycle ${currentCycle + 1}`,
        pnftId: params.validatorPnft,
        costs: { ada: '~2.5 ADA' },
      },
    };
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  /**
   * Calculate engagement multiplier based on activity
   */
  private calculateEngagementMultiplier(txCount: number, uniqueCounterparties: number): number {
    // Everyone gets survival floor
    let multiplier = UBI_CONSTANTS.SURVIVAL_FLOOR * 100; // Convert to bps

    // Add engagement ramp based on tx count
    if (txCount >= 5) {
      multiplier = UBI_CONSTANTS.RAMP_FULL;
    } else if (txCount >= 4) {
      multiplier = UBI_CONSTANTS.RAMP_4_TX;
    } else if (txCount >= 3) {
      multiplier = UBI_CONSTANTS.RAMP_3_TX;
    } else if (txCount >= 2) {
      multiplier = UBI_CONSTANTS.RAMP_2_TX;
    } else if (txCount >= 1) {
      multiplier = UBI_CONSTANTS.RAMP_1_TX;
    }

    // Bonus for diverse engagement
    if (uniqueCounterparties >= UBI_CONSTANTS.MIN_ENGAGEMENT_COUNTERPARTIES) {
      multiplier = Math.min(multiplier + 500, 10000); // Up to 5% bonus
    }

    return multiplier;
  }

  /**
   * Get current cycle number
   */
  private getCurrentCycle(): number {
    // Cycle = epoch number (~5 days)
    const epochDurationMs = 5 * 24 * 60 * 60 * 1000;
    const genesisTime = new Date('2022-04-01T00:00:00Z').getTime();
    return Math.floor((Date.now() - genesisTime) / epochDurationMs);
  }

  /**
   * Find pool UTxO for a bioregion
   */
  private async findPoolUtxo(bioregion: string): Promise<UTxO | null> {
    if (!this.lucid) return null;

    const utxos = await this.lucid.utxosAt(this.config.contracts.ubi);

    for (const utxo of utxos) {
      if (utxo.datum) {
        try {
          const poolData = this.decodePoolDatum(utxo.datum);
          if (poolData.bioregion === bioregion) {
            return utxo;
          }
        } catch {
          // Skip
        }
      }
    }

    return null;
  }

  /**
   * Decode pool datum from CBOR
   */
  private decodePoolDatum(datum: string): Omit<UbiPoolInfo, 'estimatedPerPerson'> {
    // This would use proper CBOR decoding
    // Simplified for now
    return {
      bioregion: 'test_bioregion',
      cycle: this.getCurrentCycle(),
      feesCollected: 1000n * 1_000_000n,
      ubiPool: 500n * 1_000_000n,
      eligibleCount: 100,
      claimsCount: 0,
      distributed: 0n,
      distributionStart: Date.now(),
    };
  }

  /**
   * Estimate next cycle's UBI per person
   */
  async estimateNextCycleUbi(bioregion: string): Promise<{
    estimatedPerPerson: bigint;
    projectedEligible: number;
    projectedFees: bigint;
    feeShareBps: number;
  }> {
    const pool = await this.getPoolInfo(bioregion);
    const stats = await this.getPeriodStats();

    // Use current pool data or estimates
    const projectedFees = pool?.feesCollected || 1000n * 1_000_000n;
    const projectedEligible = pool?.eligibleCount || 100;
    const feeShareBps = stats?.current_fee_share_bps || UBI_CONSTANTS.BASE_UBI_FEE_SHARE_BPS;

    const ubiPool = (projectedFees * BigInt(feeShareBps)) / 10000n;
    const estimatedPerPerson = projectedEligible > 0
      ? ubiPool / BigInt(projectedEligible)
      : 0n;

    return {
      estimatedPerPerson,
      projectedEligible,
      projectedFees,
      feeShareBps,
    };
  }

  /**
   * Calculate adaptive fee share based on target UBI
   */
  calculateAdaptiveFeeShare(
    currentPerPerson: number,
    currentShareBps: number
  ): number {
    const target = UBI_CONSTANTS.TARGET_UBI_PER_PERSON;

    if (currentPerPerson < target * 0.8) {
      // Below 80% of target, increase share
      return Math.min(currentShareBps + 200, UBI_CONSTANTS.MAX_UBI_FEE_SHARE_BPS);
    } else if (currentPerPerson > target * 1.2) {
      // Above 120% of target, decrease share
      return Math.max(currentShareBps - 200, UBI_CONSTANTS.MIN_UBI_FEE_SHARE_BPS);
    }

    return currentShareBps;
  }
}

export default UbiOperations;
