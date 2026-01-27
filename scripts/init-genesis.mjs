#!/usr/bin/env node
/**
 * UltraLife Protocol — Genesis Initialization
 *
 * Creates the genesis transaction that bootstraps the protocol:
 * - Mints protocol NFTs (one-time, non-fungible identifiers)
 * - Initializes treasury with seed parameters
 * - Creates first bioregion
 * - Sets up initial UBI pool
 *
 * Usage:
 *   node init-genesis.mjs
 */

import {
  BlockfrostProvider,
  MeshWallet,
  MeshTxBuilder,
} from '@meshsdk/core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  network: process.env.NETWORK || 'preview',
  blockfrostKey: process.env.BLOCKFROST_API_KEY,
  walletMnemonic: process.env.WALLET_SEED_PHRASE,
  deploymentPath: path.join(__dirname, 'deployment.json'),

  // Genesis parameters
  protocolName: 'UltraLife',
  initialTreasuryAda: 100_000_000n, // 100 ADA
  initialUbiPoolAda: 50_000_000n,   // 50 ADA
  testBioregion: {
    id: 'bioregion_test_001',
    name: 'Test Bioregion Alpha',
    boundsHash: Buffer.from('test_bounds_hash_placeholder').toString('hex'),
  },
};

// =============================================================================
// UTILITIES
// =============================================================================

const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  step: (n, msg) => console.log(`\n[Step ${n}] ${msg}`),
};

/**
 * Get current Cardano slot from Blockfrost
 * CRITICAL: Use slot numbers, not milliseconds, for all on-chain timestamps
 */
async function getCurrentSlot(provider) {
  try {
    const tip = await provider.fetchBlockchainTip();
    return tip.slot;
  } catch (error) {
    log.warn(`Could not fetch current slot: ${error.message}`);
    // Fallback: estimate slot from time (Preview testnet)
    const previewGenesisTime = 1666656000;
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime - previewGenesisTime;
  }
}

function formatAda(lovelace) {
  return (Number(lovelace) / 1_000_000).toFixed(2) + ' ADA';
}

// =============================================================================
// GENESIS DATUM BUILDERS
// =============================================================================
// Aligned with Aiken type definitions in validators/genesis.ak and lib/ultralife/types.ak

function buildGenesisDatum() {
  // GenesisDatum from validators/genesis.ak:65-76
  // Fields: verifications_completed, stewards_created, bioregions_created, registered_oracles, genesis_active
  return {
    constructor: 0,
    fields: [
      { int: 0 },                                    // verifications_completed
      { int: 0 },                                    // stewards_created
      { int: 0 },                                    // bioregions_created
      { list: [] },                                  // registered_oracles (empty initially)
      { constructor: 1, fields: [] },                // genesis_active = True (constructor 1 for True in Aiken)
    ],
  };
}

function buildTreasuryDatum(currentSlot) {
  // TreasuryDatum from lib/ultralife/types.ak:643-654
  // Fields: tokens_distributed, ada_reserves, btc_reserves, last_update, multisig
  // CRITICAL: last_update must be slot number, NOT milliseconds
  return {
    constructor: 0,
    fields: [
      { int: 0 },                                    // tokens_distributed
      { int: Number(CONFIG.initialTreasuryAda) },    // ada_reserves (lovelace)
      { int: 0 },                                    // btc_reserves (satoshis)
      { int: currentSlot },                          // last_update (slot number)
      {                                              // multisig: MultisigConfig
        constructor: 0,
        fields: [
          { list: [] },                              // signers (empty initially)
          { int: 1 },                                // threshold
        ],
      },
    ],
  };
}

function buildBioregionDatum(currentSlot) {
  // BioregionDatum from lib/ultralife/types.ak:139-156
  // Fields: bioregion_id, name_hash, bounds_hash, health_index, resident_count, treasury, created_at, last_health_update
  // CRITICAL: created_at must be slot number, NOT milliseconds
  return {
    constructor: 0,
    fields: [
      { bytes: Buffer.from(CONFIG.testBioregion.id).toString('hex') },     // bioregion_id
      { bytes: Buffer.from(CONFIG.testBioregion.name).toString('hex') },   // name_hash
      { bytes: CONFIG.testBioregion.boundsHash },                          // bounds_hash
      { int: 10000 },                                                      // health_index (0-10000 = 0-100.00%)
      { int: 0 },                                                          // resident_count
      { bytes: '' },                                                       // treasury (script hash, set during deploy)
      { int: currentSlot },                                                // created_at (slot number)
      { int: 0 },                                                          // last_health_update (cycle)
    ],
  };
}

function buildUbiPoolDatum(currentSlot) {
  // UbiPoolDatum from lib/ultralife/types.ak:740-759
  // Fields: bioregion, cycle, fees_collected, ubi_pool, eligible_count, total_engagement_weight, claims_count, distributed, distribution_start
  // CRITICAL: distribution_start must be slot number, NOT milliseconds
  return {
    constructor: 0,
    fields: [
      { bytes: Buffer.from(CONFIG.testBioregion.id).toString('hex') },    // bioregion
      { int: 0 },                                                         // cycle
      { int: 0 },                                                         // fees_collected
      { int: Number(CONFIG.initialUbiPoolAda) },                          // ubi_pool
      { int: 0 },                                                         // eligible_count
      { int: 0 },                                                         // total_engagement_weight
      { int: 0 },                                                         // claims_count
      { int: 0 },                                                         // distributed
      { int: currentSlot },                                               // distribution_start (slot number)
    ],
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          UltraLife Protocol — Genesis Initialization          ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Check configuration
  if (!CONFIG.blockfrostKey || !CONFIG.walletMnemonic) {
    log.error('Missing configuration. Set BLOCKFROST_API_KEY and WALLET_SEED_PHRASE in .env');
    process.exit(1);
  }

  // Load deployment record
  if (!fs.existsSync(CONFIG.deploymentPath)) {
    log.error('No deployment.json found. Run deploy-testnet.mjs first.');
    process.exit(1);
  }

  let deployment;
  try {
    deployment = JSON.parse(fs.readFileSync(CONFIG.deploymentPath, 'utf8'));
  } catch (error) {
    log.error(`Failed to parse deployment.json: ${error.message}`);
    log.info('The file may be corrupted. Check the JSON syntax.');
    process.exit(1);
  }

  // Check if already initialized
  if (deployment.genesis?.txHash) {
    log.warn(`Genesis already initialized at ${deployment.genesis.txHash}`);
    log.info('To reinitialize, delete genesis from deployment.json');
    process.exit(0);
  }

  // Initialize provider and wallet
  const provider = new BlockfrostProvider(CONFIG.blockfrostKey);
  const wallet = new MeshWallet({
    networkId: CONFIG.network === 'mainnet' ? 1 : 0,
    fetcher: provider,
    submitter: provider,
    key: {
      type: 'mnemonic',
      words: CONFIG.walletMnemonic.trim().split(/\s+/),
    },
  });

  const address = wallet.getChangeAddress();
  log.info(`Wallet: ${address}`);

  // Get current slot (CRITICAL: use slot numbers, not milliseconds)
  const currentSlot = await getCurrentSlot(provider);
  log.info(`Current slot: ${currentSlot}`);

  // Check balance
  const utxos = await provider.fetchAddressUTxOs(address);
  const balance = utxos.reduce((sum, u) => {
    const l = u.output.amount.find(a => a.unit === 'lovelace');
    return sum + BigInt(l?.quantity || 0);
  }, 0n);
  log.info(`Balance: ${formatAda(balance)}`);

  const required = CONFIG.initialTreasuryAda + CONFIG.initialUbiPoolAda + 10_000_000n;
  if (balance < required) {
    log.error(`Insufficient funds. Need ${formatAda(required)}, have ${formatAda(balance)}`);
    process.exit(1);
  }

  // Build datum structures
  log.step(1, 'Building genesis datums...');

  const genesisDatum = buildGenesisDatum();
  const treasuryDatum = buildTreasuryDatum(currentSlot);
  const bioregionDatum = buildBioregionDatum(currentSlot);
  const ubiPoolDatum = buildUbiPoolDatum(currentSlot);

  log.info('Genesis datum: Protocol parameters');
  log.info('Treasury datum: Initial treasury state');
  log.info('Bioregion datum: Test bioregion');
  log.info('UBI Pool datum: Initial UBI pool');

  // Note: Full implementation would build and submit transaction
  log.step(2, 'Genesis transaction preparation...');

  log.warn('Full on-chain genesis requires:');
  log.info('  1. Genesis validator reference script');
  log.info('  2. Treasury validator reference script');
  log.info('  3. Bioregion validator reference script');
  log.info('  4. UBI validator reference script');
  log.info('  5. Properly constructed datum at each output');

  // Record genesis info
  deployment.genesis = {
    status: 'prepared',
    timestamp: new Date().toISOString(),
    parameters: {
      protocolName: CONFIG.protocolName,
      network: CONFIG.network,
      initialTreasury: formatAda(CONFIG.initialTreasuryAda),
      initialUbiPool: formatAda(CONFIG.initialUbiPoolAda),
    },
    datums: {
      genesis: genesisDatum,
      treasury: treasuryDatum,
      bioregion: bioregionDatum,
      ubiPool: ubiPoolDatum,
    },
  };

  fs.writeFileSync(CONFIG.deploymentPath, JSON.stringify(deployment, null, 2));

  log.success('Genesis preparation complete!');

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                     Genesis Summary                            ║
╠═══════════════════════════════════════════════════════════════╣
║  Protocol:    ${CONFIG.protocolName.padEnd(44)}║
║  Network:     ${CONFIG.network.padEnd(44)}║
║  Treasury:    ${formatAda(CONFIG.initialTreasuryAda).padEnd(44)}║
║  UBI Pool:    ${formatAda(CONFIG.initialUbiPoolAda).padEnd(44)}║
║  Bioregion:   ${CONFIG.testBioregion.name.padEnd(44)}║
╚═══════════════════════════════════════════════════════════════╝

Genesis datums saved to deployment.json

To submit genesis transaction on-chain:
  1. Ensure reference scripts are deployed (deploy-references.mjs)
  2. Build transaction with proper script witnesses
  3. Submit and wait for confirmation

`);
}

main().catch(error => {
  log.error(error.message);
  console.error(error);
  process.exit(1);
});
