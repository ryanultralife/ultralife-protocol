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
  resolveScriptHash,
  applyParamsToScript,
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
  calculateRequiredBalance,
  formatAda,
} from './utils.mjs';

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

// Apply parameters to parameterized validators
// For testnet, we use placeholder values based on the wallet address
function applyValidatorParams(validator, walletPkh, plutusDefinitions) {
  // If validator has no parameters, return as-is
  if (!validator.parameters || validator.parameters.length === 0) {
    return validator.compiledCode;
  }

  // Get the config schema reference
  const configRef = validator.parameters[0]?.schema?.['$ref'];
  if (!configRef) {
    log.warn(`No config schema for ${validator.title}`);
    return validator.compiledCode;
  }

  // Extract config type name (e.g., "pnft/PnftConfig" -> "PnftConfig")
  const configTypeName = configRef.replace('#/definitions/', '').split('/').pop();

  // Placeholder values for testnet
  const placeholderHash = '00'.repeat(28);  // 28-byte hash
  const adminList = [{ bytes: walletPkh }]; // Wallet as admin

  // Build config based on validator type
  // Each config is a constructor with index 0
  let configFields;

  switch (configTypeName) {
    case 'PnftConfig':
      // bioregion_registry (ByteArray), dna_oracle (List<PKH>), oracle_threshold (Int)
      configFields = [
        { bytes: placeholderHash },
        { list: adminList },
        { int: 1 },
      ];
      break;

    case 'GenesisConfig':
      // genesis_end_slot, founding_oracles, founding_stewards, genesis_oracle_threshold, steward_threshold
      configFields = [
        { int: 999999999 },  // Far future slot
        { list: adminList },
        { list: adminList },
        { int: 1 },
        { int: 1 },
      ];
      break;

    case 'BioregionConfig':
    case 'RegistryConfig':
      // Most have: some_hash, admin_list, threshold pattern
      configFields = [
        { bytes: placeholderHash },
        { list: adminList },
        { int: 1 },
      ];
      break;

    case 'GovernanceConfig':
    case 'TreasuryConfig':
    case 'UbiConfig':
      // proposal_threshold, quorum, etc.
      configFields = [
        { bytes: placeholderHash },
        { list: adminList },
        { int: 1 },
        { int: 1 },
      ];
      break;

    default:
      // Generic fallback: try common 3-field pattern
      configFields = [
        { bytes: placeholderHash },
        { list: adminList },
        { int: 1 },
      ];
  }

  const config = {
    constructor: 0,  // First constructor variant
    fields: configFields,
  };

  try {
    const appliedScript = applyParamsToScript(validator.compiledCode, [config], 'JSON');
    return appliedScript;
  } catch (e) {
    // Try with fewer fields
    for (let numFields = configFields.length - 1; numFields >= 1; numFields--) {
      try {
        const reducedConfig = {
          constructor: 0,
          fields: configFields.slice(0, numFields),
        };
        return applyParamsToScript(validator.compiledCode, [reducedConfig], 'JSON');
      } catch {
        continue;
      }
    }
    log.warn(`Could not apply params to ${validator.title} (${configTypeName}): ${e.message}`);
    return null; // Return null to skip this validator
  }
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

    // Apply parameters to get the final script
    const finalScript = applyValidatorParams(validator, walletPkh);

    // Skip if params couldn't be applied
    if (!finalScript) {
      throw new Error('Could not apply validator parameters');
    }

    // Calculate minimum lovelace based on final script size
    const scriptSizeBytes = Math.ceil(finalScript.length / 2);
    const minLovelace = calculateMinLovelace(finalScript);
    log.info(`Deploying: ${validator.title} (${(scriptSizeBytes / 1024).toFixed(1)} KB, min ${formatAda(minLovelace)})`);

    const scriptSize = scriptSizeBytes;

    // Build transaction
    const txBuilder = new MeshTxBuilder({
      fetcher: provider,
      submitter: provider,
      verbose: false,
    });

    // Calculate fee estimation
    const estimatedFee = estimateFee('referenceScript', { scriptSize });

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

    // Add reference script output
    // Store at the wallet address with the script attached
    txBuilder.txOut(address, [
      { unit: 'lovelace', quantity: minLovelace.toString() }
    ]);
    txBuilder.txOutReferenceScript(finalScript, 'V3');

    // Calculate script hash for reference
    const scriptHash = resolveScriptHash(finalScript, 'V3');

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

    return {
      txHash,
      outputIndex: 0,
      scriptHash,
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

  // Filter validators to deploy
  let validators = plutus.validators;
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
