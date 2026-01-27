#!/usr/bin/env node
/**
 * UltraLife Protocol — Mint pNFT
 *
 * Mints a personal NFT (pNFT) that serves as on-chain identity.
 * Each pNFT is unique and linked to a verification level:
 * - Basic: Wallet-only (no verification)
 * - Ward: Minor under guardianship
 * - Standard: DNA verified
 * - Verified: + Bioregion residency
 * - Steward: + Community endorsement
 *
 * Usage:
 *   node mint-pnft.mjs --level Basic
 *   node mint-pnft.mjs --level Standard --dna-hash <hash>
 */

import {
  BlockfrostProvider,
  MeshWallet,
  MeshTxBuilder,
  deserializeAddress,
} from '@meshsdk/core';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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
};

const VERIFICATION_LEVELS = {
  Basic: 0,
  Ward: 1,
  Standard: 2,
  Verified: 3,
  Steward: 4,
};

// =============================================================================
// UTILITIES
// =============================================================================

const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
};

/**
 * Get current Cardano slot from Blockfrost
 */
async function getCurrentSlot(provider) {
  try {
    const tip = await provider.fetchBlockchainTip();
    return tip.slot;
  } catch (error) {
    log.warn(`Could not fetch current slot: ${error.message}`);
    // Fallback: estimate slot from time (Preview testnet started ~slot 0 at specific time)
    // This is approximate but better than using Date.now() milliseconds
    const previewGenesisTime = 1666656000; // Preview testnet genesis (approx)
    const currentTime = Math.floor(Date.now() / 1000);
    return currentTime - previewGenesisTime;
  }
}

/**
 * Extract verification key hash from a Cardano address
 */
function getVerificationKeyHash(address) {
  try {
    const deserialized = deserializeAddress(address);
    // The pubKeyHash is the verification key hash we need
    return deserialized.pubKeyHash;
  } catch (error) {
    log.error(`Failed to deserialize address: ${error.message}`);
    throw new Error('Invalid Cardano address - cannot extract verification key hash');
  }
}

function generatePnftId() {
  // Generate unique pNFT ID: pnft_ + timestamp + random bytes
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return `pnft_${timestamp}_${random}`;
}

function formatAda(lovelace) {
  return (Number(lovelace) / 1_000_000).toFixed(2) + ' ADA';
}

// =============================================================================
// PNFT DATUM BUILDER
// =============================================================================
// Aligned with PnftDatum from lib/ultralife/types.ak:34-59
// Fields: pnft_id, owner, level, bioregion, dna_hash, guardian, ward_since, created_at, upgraded_at, consumer_impact, nutrition_profile

function buildPnftDatum(pnftId, owner, level, options = {}) {
  // CRITICAL: Use Cardano slot number, NOT JavaScript milliseconds (Date.now())
  const createdAtSlot = options.currentSlot || 0;

  return {
    constructor: 0,
    fields: [
      { bytes: Buffer.from(pnftId).toString('hex') },         // pnft_id: ByteArray
      { bytes: owner },                                        // owner: VerificationKeyHash
      { constructor: VERIFICATION_LEVELS[level], fields: [] }, // level: VerificationLevel
      options.bioregion                                        // bioregion: Option<ByteArray>
        ? { constructor: 0, fields: [{ bytes: options.bioregion }] }  // Some
        : { constructor: 1, fields: [] },                             // None
      options.dnaHash                                          // dna_hash: Option<ByteArray>
        ? { constructor: 0, fields: [{ bytes: options.dnaHash }] }    // Some
        : { constructor: 1, fields: [] },                             // None
      options.guardian                                         // guardian: Option<AssetName>
        ? { constructor: 0, fields: [{ bytes: options.guardian }] }   // Some
        : { constructor: 1, fields: [] },                             // None
      options.wardSince                                        // ward_since: Option<Int> (slot number)
        ? { constructor: 0, fields: [{ int: options.wardSince }] }    // Some
        : { constructor: 1, fields: [] },                             // None
      { int: createdAtSlot },                                  // created_at: Int (slot number)
      { constructor: 1, fields: [] },                          // upgraded_at: Option<Int> (None initially)
      { constructor: 1, fields: [] },                          // consumer_impact: Option<ConsumerImpactRecord> (None)
      { constructor: 1, fields: [] },                          // nutrition_profile: Option<NutritionProfile> (None)
    ],
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              UltraLife Protocol — Mint pNFT                   ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Parse arguments
  const args = process.argv.slice(2);
  const levelIdx = args.indexOf('--level');
  const dnaIdx = args.indexOf('--dna-hash');
  const bioregionIdx = args.indexOf('--bioregion');
  const guardianIdx = args.indexOf('--guardian');

  const level = levelIdx >= 0 ? args[levelIdx + 1] : 'Basic';
  const dnaHash = dnaIdx >= 0 ? args[dnaIdx + 1] : null;
  const bioregion = bioregionIdx >= 0 ? args[bioregionIdx + 1] : null;
  const guardian = guardianIdx >= 0 ? args[guardianIdx + 1] : null;

  // Validate level
  if (!VERIFICATION_LEVELS.hasOwnProperty(level)) {
    log.error(`Invalid level: ${level}`);
    log.info(`Valid levels: ${Object.keys(VERIFICATION_LEVELS).join(', ')}`);
    process.exit(1);
  }

  // Check requirements for specific levels
  if (level === 'Ward') {
    if (!guardian) {
      log.warn('Ward level requires a guardian pNFT.');
      log.info('Use --guardian <pnft_id> to specify guardian.');
    }
  }

  if (level === 'Standard' || level === 'Verified' || level === 'Steward') {
    if (!dnaHash) {
      log.warn(`Level ${level} typically requires DNA verification.`);
      log.info('Use --dna-hash <hash> to include DNA verification.');
    }
  }

  if (level === 'Verified' || level === 'Steward') {
    if (!bioregion) {
      log.warn(`Level ${level} typically requires bioregion assignment.`);
      log.info('Use --bioregion <id> to assign bioregion.');
    }
  }

  // Check configuration
  if (!CONFIG.blockfrostKey || !CONFIG.walletMnemonic) {
    log.error('Missing configuration. Set BLOCKFROST_API_KEY and WALLET_SEED_PHRASE in .env');
    process.exit(1);
  }

  // Load deployment record
  let deployment = {};
  if (fs.existsSync(CONFIG.deploymentPath)) {
    try {
      deployment = JSON.parse(fs.readFileSync(CONFIG.deploymentPath, 'utf8'));
    } catch (error) {
      log.error(`Failed to parse deployment.json: ${error.message}`);
      log.info('The file may be corrupted. Check the JSON syntax.');
      process.exit(1);
    }
  }
  deployment.pnfts = deployment.pnfts || [];

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

  const required = 5_000_000n; // 5 ADA minimum for pNFT mint
  if (balance < required) {
    log.error(`Insufficient funds. Need ${formatAda(required)}, have ${formatAda(balance)}`);
    process.exit(1);
  }

  // Generate pNFT ID
  const pnftId = generatePnftId();
  log.info(`pNFT ID: ${pnftId}`);
  log.info(`Level: ${level}`);

  // Get current slot for timestamp fields
  const currentSlot = await getCurrentSlot(provider);
  log.info(`Current slot: ${currentSlot}`);

  // Get actual verification key hash from address (CRITICAL: not a fake hash!)
  const ownerHash = getVerificationKeyHash(address);
  log.info(`Owner key hash: ${ownerHash.slice(0, 20)}...`);

  // Build pNFT datum
  const datum = buildPnftDatum(pnftId, ownerHash, level, {
    dnaHash: dnaHash ? Buffer.from(dnaHash).toString('hex') : null,
    bioregion: bioregion ? Buffer.from(bioregion).toString('hex') : null,
    guardian: guardian ? Buffer.from(guardian).toString('hex') : null,
    wardSince: level === 'Ward' ? currentSlot : null,
    currentSlot: currentSlot,
  });

  log.info('pNFT datum constructed');

  // Record pNFT
  const pnftRecord = {
    id: pnftId,
    owner: address,
    level: level,
    createdAt: new Date().toISOString(),
    status: 'prepared',
    datum: datum,
    options: {
      dnaHash: dnaHash || null,
      bioregion: bioregion || null,
      guardian: guardian || null,
    },
  };

  deployment.pnfts.push(pnftRecord);
  fs.writeFileSync(CONFIG.deploymentPath, JSON.stringify(deployment, null, 2));

  log.success('pNFT prepared!');

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                      pNFT Summary                             ║
╠═══════════════════════════════════════════════════════════════╣
║  ID:        ${pnftId.padEnd(48)}║
║  Owner:     ${address.slice(0, 48).padEnd(48)}║
║  Level:     ${level.padEnd(48)}║
║  DNA:       ${(dnaHash || 'Not provided').slice(0, 48).padEnd(48)}║
║  Bioregion: ${(bioregion || 'Not assigned').slice(0, 48).padEnd(48)}║
║  Guardian:  ${(guardian || 'None (not a ward)').slice(0, 48).padEnd(48)}║
║  Status:    ${'Prepared (ready for on-chain mint)'.padEnd(48)}║
╚═══════════════════════════════════════════════════════════════╝

pNFT saved to deployment.json

To mint on-chain:
  1. Ensure pnft policy reference script is deployed
  2. Build minting transaction with datum
  3. Submit and wait for confirmation

`);
}

main().catch(error => {
  log.error(error.message);
  console.error(error);
  process.exit(1);
});
