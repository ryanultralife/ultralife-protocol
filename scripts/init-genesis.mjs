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

function formatAda(lovelace) {
  return (Number(lovelace) / 1_000_000).toFixed(2) + ' ADA';
}

// =============================================================================
// GENESIS DATUM BUILDERS
// =============================================================================

function buildGenesisDatum() {
  // Genesis datum contains protocol-wide parameters
  return {
    constructor: 0,
    fields: [
      { bytes: Buffer.from(CONFIG.protocolName).toString('hex') },
      { int: Date.now() }, // Genesis timestamp
      { int: 0 },          // Genesis cycle (starts at 0)
      { bytes: '' },       // Admin key hash (would be set in production)
    ],
  };
}

function buildTreasuryDatum() {
  return {
    constructor: 0,
    fields: [
      { int: Number(CONFIG.initialTreasuryAda) }, // Total value
      { int: 0 },                                  // Distributed
      { int: 0 },                                  // Reserved
      { list: [] },                                // Allocations
    ],
  };
}

function buildBioregionDatum() {
  return {
    constructor: 0,
    fields: [
      { bytes: Buffer.from(CONFIG.testBioregion.id).toString('hex') },
      { bytes: Buffer.from(CONFIG.testBioregion.name).toString('hex') },
      { bytes: CONFIG.testBioregion.boundsHash },
      { int: 0 },    // Population
      { int: 1000 }, // Health index (0-1000 scale)
      { int: 0 },    // Current cycle
    ],
  };
}

function buildUbiPoolDatum() {
  return {
    constructor: 0,
    fields: [
      { bytes: Buffer.from(CONFIG.testBioregion.id).toString('hex') },
      { int: 0 },                                     // Current cycle
      { int: Number(CONFIG.initialUbiPoolAda) },      // Available
      { int: 0 },                                     // Claims count
      { int: Date.now() },                            // Distribution start
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
  const deployment = JSON.parse(fs.readFileSync(CONFIG.deploymentPath, 'utf8'));

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
  const treasuryDatum = buildTreasuryDatum();
  const bioregionDatum = buildBioregionDatum();
  const ubiPoolDatum = buildUbiPoolDatum();

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
