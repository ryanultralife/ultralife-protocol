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
  resolveScriptHash,
  stringToHex,
} from '@meshsdk/core';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import { atomicWriteSync, safeReadJson } from './utils.mjs';

// Centralized config - single source of truth for all validator parameters
import {
  applyValidatorParams,
  findValidator,
  getAdminPkh,
} from './testnet-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  network: process.env.NETWORK || 'preprod',
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

  log.info('pNFT datum constructed');

  // =========================================================================
  // ON-CHAIN MINTING
  // =========================================================================

  // Check for pNFT policy reference script
  const pnftPolicyRef = deployment.references?.pnft_pnft_policy_mint;
  if (!pnftPolicyRef?.txHash) {
    log.error('pNFT policy reference script not deployed!');
    log.info('Run: npm run deploy:references -- --validator pnft_policy');
    process.exit(1);
  }

  log.info(`Using pNFT policy ref: ${pnftPolicyRef.txHash}#${pnftPolicyRef.outputIndex}`);

  // Load the pNFT policy script from plutus.json
  const plutusPath = path.join(__dirname, '..', 'plutus.json');
  const plutus = safeReadJson(plutusPath);
  const pnftPolicyValidator = findValidator(plutus?.validators || [], 'pnft_policy.mint');

  if (!pnftPolicyValidator) {
    log.error('pNFT policy validator not found in plutus.json');
    process.exit(1);
  }

  // Apply parameters using the SAME centralized config as deployment
  // This ensures policy ID consistency across the protocol
  const adminPkh = getAdminPkh(address);
  const applied = applyValidatorParams(pnftPolicyValidator, adminPkh);

  if (!applied) {
    log.error('Could not apply params to pnft policy');
    process.exit(1);
  }

  const { encodedScript, scriptHash: policyId, config } = applied;

  // Verify consistency with deployed reference
  if (pnftPolicyRef.scriptHash && pnftPolicyRef.scriptHash !== policyId) {
    log.warn(`Policy ID mismatch!`);
    log.warn(`  Deployment: ${pnftPolicyRef.scriptHash}`);
    log.warn(`  Computed:   ${policyId}`);
    log.error('Configuration inconsistency detected. Ensure same wallet is used for all operations.');
    process.exit(1);
  }

  log.info(`Policy ID: ${policyId}`);
  log.info(`Config type: ${applied.configTypeName || 'none'}`);

  // Asset name is the pNFT ID in hex
  const assetNameHex = stringToHex(pnftId);
  log.info(`Asset name (hex): ${assetNameHex.slice(0, 32)}...`);

  // Build minting redeemer (MintBasic { owner: VerificationKeyHash })
  const mintRedeemer = {
    constructor: 0,  // MintBasic variant
    fields: [
      { bytes: ownerHash },  // owner field
    ],
  };

  // Build the minting transaction
  log.info('Building minting transaction...');

  const txBuilder = new MeshTxBuilder({
    fetcher: provider,
    submitter: provider,
    verbose: false,
  });

  // Select a UTxO with enough ADA (need ~5 ADA for output + fees)
  // IMPORTANT: Skip UTxOs that have reference scripts attached (they have scriptRef)
  const minRequired = 5_000_000n;
  const cleanUtxos = utxos.filter(u => {
    // Skip UTxOs with reference scripts or other assets
    const hasRefScript = u.output.scriptRef || u.output.plutusData;
    const hasOtherAssets = u.output.amount.some(a => a.unit !== 'lovelace');
    return !hasRefScript && !hasOtherAssets;
  });

  log.info(`Found ${cleanUtxos.length} clean UTxOs (no scripts/assets) out of ${utxos.length} total`);

  const inputUtxo = cleanUtxos.find(u => {
    const lovelace = u.output.amount.find(a => a.unit === 'lovelace');
    return BigInt(lovelace?.quantity || 0) >= minRequired;
  });

  if (!inputUtxo) {
    // Fallback: try any UTxO with enough ADA
    const anyUtxo = utxos.find(u => {
      const lovelace = u.output.amount.find(a => a.unit === 'lovelace');
      return BigInt(lovelace?.quantity || 0) >= minRequired;
    });
    if (!anyUtxo) {
      log.error(`No UTxO found with at least ${Number(minRequired) / 1_000_000} ADA`);
      log.info('UTxO breakdown:');
      utxos.slice(0, 5).forEach(u => {
        const lovelace = u.output.amount.find(a => a.unit === 'lovelace');
        log.info(`  ${u.input.txHash.slice(0, 12)}...#${u.input.outputIndex}: ${formatAda(lovelace?.quantity || 0)}`);
      });
      process.exit(1);
    }
    log.warn('Using UTxO with attached data (may have issues)');
  }

  const selectedUtxo = inputUtxo || cleanUtxos[0] || utxos[0];
  const inputLovelace = selectedUtxo.output.amount.find(a => a.unit === 'lovelace')?.quantity || '0';
  log.info(`Using input UTxO: ${selectedUtxo.input.txHash.slice(0, 16)}...#${selectedUtxo.input.outputIndex} (${formatAda(inputLovelace)})`);

  // Provide full UTxO details to txIn for proper handling
  txBuilder.txIn(
    selectedUtxo.input.txHash,
    selectedUtxo.input.outputIndex,
    selectedUtxo.output.amount,
    selectedUtxo.output.address
  );

  // Add the mint operation with reference script
  txBuilder.mintPlutusScriptV3();
  txBuilder.mint('1', policyId, assetNameHex);
  txBuilder.mintTxInReference(pnftPolicyRef.txHash, pnftPolicyRef.outputIndex);
  txBuilder.mintRedeemerValue(mintRedeemer, 'JSON');

  // Output the minted pNFT to the owner's address with inline datum
  txBuilder.txOut(address, [
    { unit: 'lovelace', quantity: '2000000' },  // 2 ADA min
    { unit: policyId + assetNameHex, quantity: '1' },
  ]);
  txBuilder.txOutInlineDatumValue(datum, 'JSON');

  // Change output
  txBuilder.changeAddress(address);

  // Set collateral (required for Plutus scripts)
  // Use a different UTxO than the input, preferring clean UTxOs
  const collateralUtxo = cleanUtxos.find(u => {
    if (u.input.txHash === selectedUtxo.input.txHash &&
        u.input.outputIndex === selectedUtxo.input.outputIndex) {
      return false; // Don't use same UTxO as input
    }
    const lovelace = u.output.amount.find(a => a.unit === 'lovelace');
    return BigInt(lovelace?.quantity || 0) >= 5_000_000n;
  }) || selectedUtxo; // Fall back to same UTxO if no other option

  log.info(`Using collateral: ${collateralUtxo.input.txHash.slice(0, 16)}...#${collateralUtxo.input.outputIndex}`);
  txBuilder.txInCollateral(
    collateralUtxo.input.txHash,
    collateralUtxo.input.outputIndex,
    collateralUtxo.output.amount,
    collateralUtxo.output.address
  );

  // Complete, sign, and submit
  log.info('Completing transaction...');
  const unsignedTx = await txBuilder.complete();

  log.info('Signing transaction...');
  const signedTx = await wallet.signTx(unsignedTx);

  log.info('Submitting transaction...');
  const txHash = await provider.submitTx(signedTx);
  log.success(`Transaction submitted: ${txHash}`);

  // Wait for confirmation
  log.info('Waiting for confirmation...');
  for (let i = 0; i < 60; i++) {
    try {
      const tx = await provider.fetchTxInfo(txHash);
      if (tx) {
        log.success(`Transaction confirmed in block ${tx.block}`);
        break;
      }
    } catch {
      // Not found yet
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
    process.stdout.write('.');
  }

  // Update record with on-chain info
  pnftRecord.status = 'minted';
  pnftRecord.txHash = txHash;
  pnftRecord.policyId = policyId;
  pnftRecord.assetName = assetNameHex;
  pnftRecord.assetId = policyId + assetNameHex;

  deployment.pnfts.push(pnftRecord);
  atomicWriteSync(CONFIG.deploymentPath, deployment);

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                   🎉 pNFT MINTED! 🎉                          ║
╠═══════════════════════════════════════════════════════════════╣
║  ID:        ${pnftId.padEnd(48)}║
║  Owner:     ${address.slice(0, 48).padEnd(48)}║
║  Level:     ${level.padEnd(48)}║
║  Policy:    ${policyId.slice(0, 48).padEnd(48)}║
║  Asset:     ${(policyId + assetNameHex).slice(0, 48).padEnd(48)}║
║  Tx:        ${txHash.slice(0, 48).padEnd(48)}║
║  Status:    ${'✅ On-chain!'.padEnd(48)}║
╚═══════════════════════════════════════════════════════════════╝

🔗 View on Cardanoscan:
   https://${CONFIG.network}.cardanoscan.io/transaction/${txHash}

`);
}

main().catch(error => {
  log.error(error.message);
  console.error(error);
  process.exit(1);
});
