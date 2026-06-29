/**
 * Shared UltraLife blockchain configuration (preprod).
 *
 * Extracted from the service entry point so BOTH the MCP server (src/index.ts)
 * and the web /build endpoint (src/web/build.ts) consume one source of truth.
 * Importing this module has NO side effects (unlike src/index.ts, which starts
 * a server on import).
 *
 * Every address / reference script is overridable via env var. Until the
 * protocol contracts are deployed (aiken build + deploy-reference-scripts),
 * the placeholders below mean tx building will fail with a clear error — see
 * `findPlaceholders()`.
 */

import type { UltraLifeConfig } from './types/index.js';

export const TESTNET_CONFIG: UltraLifeConfig = {
  network: 'preprod',
  blockfrostApiKey: process.env.BLOCKFROST_API_KEY || 'your_api_key_here',

  contracts: {
    // Identity
    pnft_policy: process.env.PNFT_POLICY || 'TODO_DEPLOY',
    pnft_spend: process.env.PNFT_SPEND || 'addr_test1TODO',
    recovery: process.env.RECOVERY || 'addr_test1TODO',

    // Token
    token_policy: process.env.TOKEN_POLICY || 'TODO_DEPLOY',
    token_spend: process.env.TOKEN_SPEND || 'addr_test1TODO',
    treasury: process.env.TREASURY || 'addr_test1TODO',

    // Marketplace
    marketplace: process.env.MARKETPLACE || 'addr_test1TODO',
    work_auction: process.env.WORK_AUCTION || 'addr_test1TODO',

    // Records & Registry
    records: process.env.RECORDS || 'addr_test1TODO',
    registry: process.env.REGISTRY || 'addr_test1TODO',
    memory: process.env.MEMORY || 'addr_test1TODO',

    // Bioregion & Land
    bioregion: process.env.BIOREGION || 'addr_test1TODO',
    land_rights: process.env.LAND_RIGHTS || 'addr_test1TODO',
    commons: process.env.COMMONS || 'addr_test1TODO',

    // Staking & Governance
    stake_pool: process.env.STAKE_POOL || 'addr_test1TODO',
    governance: process.env.GOVERNANCE || 'addr_test1TODO',
    ubi: process.env.UBI || 'addr_test1TODO',

    // Impact
    impact: process.env.IMPACT || 'addr_test1TODO',
    impact_market: process.env.IMPACT_MARKET || 'addr_test1TODO',
    asset_impact: process.env.ASSET_IMPACT || 'addr_test1TODO',
    remediation: process.env.REMEDIATION || 'addr_test1TODO',
    preservation: process.env.PRESERVATION || 'addr_test1TODO',

    // Collectives & Care
    collective: process.env.COLLECTIVE || 'addr_test1TODO',
    care: process.env.CARE || 'addr_test1TODO',

    // Infrastructure
    energy: process.env.ENERGY || 'addr_test1TODO',
    grants: process.env.GRANTS || 'addr_test1TODO',
    genesis: process.env.GENESIS || 'addr_test1TODO',

    // Hydra
    spending_bucket: process.env.SPENDING_BUCKET || 'addr_test1TODO',
    ultralife_validator: process.env.ULTRALIFE_VALIDATOR || 'addr_test1TODO',
    fee_pool: process.env.FEE_POOL || 'addr_test1TODO',
  },

  referenceScripts: {
    // Identity
    pnft_mint: { txHash: 'TODO', outputIndex: 0 },
    pnft_spend: { txHash: 'TODO', outputIndex: 0 },
    recovery: { txHash: 'TODO', outputIndex: 0 },

    // Token
    token: { txHash: 'TODO', outputIndex: 0 },
    treasury: { txHash: 'TODO', outputIndex: 0 },

    // Marketplace
    marketplace: { txHash: 'TODO', outputIndex: 0 },
    work_auction: { txHash: 'TODO', outputIndex: 0 },

    // Records & Registry
    records: { txHash: 'TODO', outputIndex: 0 },
    registry: { txHash: 'TODO', outputIndex: 0 },
    memory: { txHash: 'TODO', outputIndex: 0 },

    // Bioregion & Land
    bioregion: { txHash: 'TODO', outputIndex: 0 },
    land_rights: { txHash: 'TODO', outputIndex: 0 },
    commons: { txHash: 'TODO', outputIndex: 0 },

    // Staking & Governance
    stake_pool: { txHash: 'TODO', outputIndex: 0 },
    governance: { txHash: 'TODO', outputIndex: 0 },
    ubi: { txHash: 'TODO', outputIndex: 0 },

    // Impact
    impact: { txHash: 'TODO', outputIndex: 0 },
    impact_market: { txHash: 'TODO', outputIndex: 0 },
    asset_impact: { txHash: 'TODO', outputIndex: 0 },
    remediation: { txHash: 'TODO', outputIndex: 0 },
    preservation: { txHash: 'TODO', outputIndex: 0 },

    // Collectives & Care
    collective: { txHash: 'TODO', outputIndex: 0 },
    care: { txHash: 'TODO', outputIndex: 0 },

    // Infrastructure
    energy: { txHash: 'TODO', outputIndex: 0 },
    grants: { txHash: 'TODO', outputIndex: 0 },
    genesis: { txHash: 'TODO', outputIndex: 0 },

    // Hydra
    spending_bucket: { txHash: 'TODO', outputIndex: 0 },
    ultralife_validator: { txHash: 'TODO', outputIndex: 0 },
    fee_pool: { txHash: 'TODO', outputIndex: 0 },
  },
};

/**
 * The contracts/reference scripts a given CompositionBundle actually touches.
 * Used to give a precise "deploy these first" error instead of a cryptic
 * Lucid failure when building against placeholder addresses.
 */
export const BUNDLE_REQUIREMENTS: Record<string, { contracts: string[]; refScripts: string[] }> = {
  // transfer action -> pays token_policy to recipient + writes a record datum
  leaseRentSettlement: { contracts: ['token_policy', 'records'], refScripts: ['token', 'records'] },
  workSettlement: { contracts: ['token_policy', 'records'], refScripts: ['token', 'records'] },
  workerOnboarding: { contracts: ['pnft_policy'], refScripts: ['pnft_mint'] },
};

/**
 * Returns the list of still-placeholder dependencies for a bundle, or [] if all
 * required addresses/scripts are populated. A non-empty result means the chain
 * isn't ready to build this bundle yet.
 */
export function findPlaceholders(cfg: UltraLifeConfig, bundle: string): string[] {
  const req = BUNDLE_REQUIREMENTS[bundle];
  if (!req) return [];
  const missing: string[] = [];
  const contracts = cfg.contracts as unknown as Record<string, string>;
  for (const c of req.contracts) {
    const v = contracts[c];
    if (!v || v.startsWith('TODO') || v.endsWith('TODO')) missing.push(`contracts.${c}`);
  }
  const refScripts = cfg.referenceScripts as unknown as Record<string, { txHash: string }>;
  for (const r of req.refScripts) {
    const v = refScripts[r];
    if (!v || !v.txHash || v.txHash === 'TODO') missing.push(`referenceScripts.${r}`);
  }
  return missing;
}
