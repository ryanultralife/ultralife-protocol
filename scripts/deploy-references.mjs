#!/usr/bin/env node
/**
 * UltraLife Protocol — Deploy Reference Scripts
 *
 * Deploys validator scripts as reference scripts on-chain.
 * Reference scripts are stored once and can be referenced by transactions,
 * significantly reducing transaction fees.
 *
 * Usage:
 *   node deploy-references.mjs [--validator name] [--all]
 *
 * Examples:
 *   node deploy-references.mjs --all           # Deploy all validators
 *   node deploy-references.mjs --validator pnft # Deploy only pnft
 */

import {
  BlockfrostProvider,
  MeshWallet,
  MeshTxBuilder,
  resolvePaymentKeyHash,
} from '@meshsdk/core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import {
  atomicWriteSync,
  safeReadJson,
  selectUtxos,
  validateUtxoSelection,
  estimateFee,
  formatAda,
} from './utils.mjs';

// Centralized config - single source of truth for all validator parameters
import {
  applyValidatorParams,
  getUniqueValidators,
} from './testnet-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  network: process.env.NETWORK || 'preprod',
  blockfrostKey: process.env.BLOCKFROST_API_KEY,
  walletMnemonic: process.env.WALLET_SEED_PHRASE,
  plutusPath: path.join(__dirname, '..', 'plutus.json'),
  deploymentPath: path.join(__dirname, 'deployment.json'),
};

// Minimum ADA to lock with reference script - calculated dynamically based on script size
// Formula: coinsPerUTxOByte (4310) * (baseSize + scriptBytes)
const COINS_PER_UTXO_BYTE = 4310n;
const BASE_OUTPUT_SIZE = 160n; // Base UTXO overhead

function calculateMinLovelace(scriptHex) {
  // Script size in bytes (hex string / 2)
  const scriptBytes = BigInt(Math.ceil(scriptHex.length / 2));
  // Add overhead for script hash, address, etc.
  const totalSize = BASE_OUTPUT_SIZE + scriptBytes + 50n; // 50 bytes overhead for reference script
  // Calculate minimum with 20% safety margin
  const minUtxo = (COINS_PER_UTXO_BYTE * totalSize * 120n) / 100n;
  return minUtxo;
}


// =============================================================================
// UTILITIES
// =============================================================================

const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
};

async function waitForConfirmation(provider, txHash, maxAttempts = 60) {
  log.info(`Waiting for confirmation: ${txHash}`);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const tx = await provider.fetchTxInfo(txHash);
      if (tx) {
        log.success(`Transaction confirmed in block ${tx.block}`);
        return tx;
      }
    } catch {
      // Not found yet
    }
    await new Promise(resolve => setTimeout(resolve, 5000));
    process.stdout.write('.');
  }

  throw new Error(`Transaction not confirmed after ${maxAttempts * 5} seconds`);
}

// =============================================================================
// DEPLOY SINGLE REFERENCE SCRIPT
// =============================================================================

async function deployReferenceScript(provider, wallet, validator, deployment, walletPkh) {
  const key = validator.title.replace(/\./g, '_');

  // Check if already deployed
  if (deployment.references?.[key]?.txHash && deployment.references[key].txHash !== 'pending') {
    log.info(`${key}: Already deployed at ${deployment.references[key].txHash}`);
    return null;
  }

  try {
    const address = wallet.getChangeAddress();
    const utxos = await provider.fetchAddressUTxOs(address);

    if (utxos.length === 0) {
      throw new Error('No UTxOs available. Fund the wallet first.');
    }

    // Apply parameters using centralized config
    const applied = applyValidatorParams(validator, walletPkh);

    // Skip if params couldn't be applied
    if (!applied) {
      throw new Error('Could not apply validator parameters');
    }

    const { script, encodedScript, scriptHash, config, configTypeName } = applied;

    // Calculate minimum lovelace based on final script size
    const scriptSizeBytes = Math.ceil(script.length / 2);
    const minLovelace = calculateMinLovelace(script);
    log.info(`Deploying: ${validator.title} (${(scriptSizeBytes / 1024).toFixed(1)} KB, min ${formatAda(minLovelace)})`);

    // Build transaction
    const txBuilder = new MeshTxBuilder({
      fetcher: provider,
      submitter: provider,
      verbose: false,
    });

    // Calculate fee estimation
    const estimatedFee = estimateFee('referenceScript', { scriptSize: scriptSizeBytes });

    // Select UTxOs with proper validation
    const targetAmount = minLovelace + estimatedFee;
    const selection = selectUtxos(utxos, targetAmount);

    if (!selection.sufficient) {
      throw new Error(
        `Insufficient UTxOs: need ${formatAda(targetAmount)}, ` +
        `have ${formatAda(selection.total)}, shortfall ${formatAda(selection.shortfall)}`
      );
    }

    // Validate selection before building transaction
    const validation = validateUtxoSelection(selection.selected, minLovelace, estimatedFee);
    if (!validation.valid) {
      throw new Error(`UTxO validation failed: ${validation.errors.join(', ')}`);
    }
    for (const warning of validation.warnings) {
      log.warn(warning);
    }

    // Add inputs
    for (const utxo of selection.selected) {
      txBuilder.txIn(
        utxo.input.txHash,
        utxo.input.outputIndex
      );
    }

    // Add reference script output with CBOR-encoded script
    txBuilder.txOut(address, [
      { unit: 'lovelace', quantity: minLovelace.toString() }
    ]);
    txBuilder.txOutReferenceScript(encodedScript, 'V3');

    // Add change output
    txBuilder.changeAddress(address);

    // Complete and sign
    const unsignedTx = await txBuilder.complete();
    const signedTx = await wallet.signTx(unsignedTx);

    // Submit
    const txHash = await provider.submitTx(signedTx);
    log.success(`Submitted: ${txHash}`);

    // Wait for confirmation
    await waitForConfirmation(provider, txHash);

    // Return deployment record with all details needed for future use
    return {
      txHash,
      outputIndex: 0,
      scriptHash,
      configTypeName,
      config,  // Store config for verification
      scriptSize: scriptSizeBytes,
      deployedAt: new Date().toISOString(),
    };

  } catch (error) {
    const errMsg = error?.message || error?.toString() || JSON.stringify(error) || 'Unknown error';
    log.error(`Failed to deploy ${validator.title}: ${errMsg}`);
    throw new Error(errMsg);
  }
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log('\n🚀 UltraLife Protocol — Reference Script Deployment\n');

  // Parse arguments
  const args = process.argv.slice(2);
  const deployAll = args.includes('--all');
  const specificValidator = args.find((a, i) => args[i - 1] === '--validator');

  if (!deployAll && !specificValidator) {
    console.log('Usage:');
    console.log('  node deploy-references.mjs --all');
    console.log('  node deploy-references.mjs --validator <name>');
    process.exit(0);
  }

  // Check configuration
  if (!CONFIG.blockfrostKey || !CONFIG.walletMnemonic) {
    log.error('Missing configuration. Set BLOCKFROST_API_KEY and WALLET_SEED_PHRASE in .env');
    process.exit(1);
  }

  // Load plutus.json
  if (!fs.existsSync(CONFIG.plutusPath)) {
    log.error(`plutus.json not found at ${CONFIG.plutusPath}`);
    process.exit(1);
  }
  const plutus = safeReadJson(CONFIG.plutusPath);
  if (!plutus) {
    log.error('Failed to parse plutus.json');
    process.exit(1);
  }

  // Load or create deployment record (safe read with default)
  let deployment = safeReadJson(CONFIG.deploymentPath, {});
  deployment.references = deployment.references || {};

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
  log.info(`Wallet: ${address.slice(0, 40)}...`);

  // Check balance
  const utxos = await provider.fetchAddressUTxOs(address);
  const balance = utxos.reduce((sum, u) => {
    const l = u.output.amount.find(a => a.unit === 'lovelace');
    return sum + BigInt(l?.quantity || 0);
  }, 0n);
  log.info(`Balance: ${formatAda(balance)}`);

  // Filter validators to deploy (skip .else duplicates)
  let validators = getUniqueValidators(plutus.validators);
  log.info(`Filtered to ${validators.length} unique validators (skipping .else duplicates)`);

  if (specificValidator) {
    validators = validators.filter(v =>
      v.title.toLowerCase().includes(specificValidator.toLowerCase())
    );
    if (validators.length === 0) {
      log.error(`No validator found matching: ${specificValidator}`);
      process.exit(1);
    }
  }

  log.info(`Validators to deploy: ${validators.length}`);

  // Get wallet's payment key hash for parameterized validators
  const walletPkh = resolvePaymentKeyHash(address);
  log.info(`Using wallet PKH for config: ${walletPkh.slice(0, 16)}...`);

  // Deploy each validator
  let deployed = 0;
  let skipped = 0;
  let failed = 0;

  for (const validator of validators) {
    const key = validator.title.replace(/\./g, '_');

    try {
      const result = await deployReferenceScript(provider, wallet, validator, deployment, walletPkh);

      if (result) {
        deployment.references[key] = result;
        deployed++;
      } else {
        skipped++;
      }

      // Save after each deployment (atomic write prevents corruption)
      atomicWriteSync(CONFIG.deploymentPath, deployment);

    } catch (error) {
      failed++;
      deployment.references[key] = {
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }

    // Small delay between deployments
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  log.info(`Deployed: ${deployed}`);
  log.info(`Skipped:  ${skipped}`);
  log.info(`Failed:   ${failed}`);
  log.info(`Saved:    ${CONFIG.deploymentPath}`);
}

main().catch(error => {
  log.error(error.message);
  process.exit(1);
});
