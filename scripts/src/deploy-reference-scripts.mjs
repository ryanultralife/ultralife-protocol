#!/usr/bin/env node

/**
 * UltraLife Protocol — Reference Script Deployment
 *
 * Deploys all validators as reference scripts on-chain.
 * Reference scripts reduce transaction sizes and fees.
 *
 * Usage:
 *   npm run deploy:reference
 *
 * Prerequisites:
 *   - BLOCKFROST_API_KEY in environment
 *   - WALLET_SEED in environment
 *   - Compiled contracts in ../contracts/plutus.json
 *   - Funded wallet (~50 ADA for all reference scripts)
 */

import { applyParamsToScript, applyDoubleCborEncoding } from '@lucid-evolution/lucid';
import {
  initLucidWithWallet,
  loadPlutusJson,
  getAllValidators,
  findValidator,
  saveDeployment,
  log,
  logError,
  bytesToHex,
  textToHex,
} from './lib/lucid.mjs';
import dotenv from 'dotenv';

dotenv.config();

// =============================================================================
// DEPLOYMENT ORDER
// =============================================================================

/**
 * Validators in deployment order (dependencies first)
 */
const DEPLOY_ORDER = [
  // Bootstrap
  'genesis',

  // Identity
  'pnft_policy',
  'pnft_spend',

  // Place
  'bioregion',

  // Economy
  'token_policy',
  'token',
  'treasury',
  'grants',

  // Consequence
  'impact',
  'remediation',

  // Distribution
  'ubi',

  // Governance
  'governance',

  // Memory
  'memory',
  'records',

  // Registry
  'registry',

  // Marketplace
  'marketplace',
  'work_auction',

  // Collective
  'collective',
  'recovery',

  // Additional
  'spending_bucket',
  'stake_pool',
  'care',
  'commons',
  'energy',
  'preservation',
  'land_rights',
  'asset_impact',
  'impact_market',
];

// =============================================================================
// MAIN DEPLOYMENT
// =============================================================================

async function main() {
  log('UltraLife Protocol — Reference Script Deployment');
  log(`Network: ${process.env.NETWORK || 'preview'}`);
  log('');

  // Initialize Lucid with wallet
  const lucid = await initLucidWithWallet();
  const address = await lucid.wallet().address();

  // Check wallet balance
  const utxos = await lucid.wallet().getUtxos();
  const balance = utxos.reduce((acc, u) => acc + u.assets.lovelace, 0n);
  log(`Wallet balance: ${Number(balance) / 1_000_000} ADA`);

  if (balance < 50_000_000n) {
    throw new Error('Insufficient balance. Need at least 50 ADA for reference scripts.');
  }

  // Load plutus.json
  log('');
  log('Loading compiled validators...');
  const plutusJson = loadPlutusJson();
  const validators = getAllValidators(plutusJson);
  log(`Found ${Object.keys(validators).length} validators`);

  // Deployment record
  const deployment = {
    network: process.env.NETWORK || 'preview',
    timestamp: new Date().toISOString(),
    deployer: address,
    validators: {},
    referenceScripts: {},
    config: {
      totalSupply: process.env.TOTAL_SUPPLY || '400000000000000000',
      cycleSlots: process.env.CYCLE_SLOTS || '3196800',
    },
  };

  // Deploy each validator
  log('');
  log('Deploying reference scripts...');
  log('');

  for (const name of DEPLOY_ORDER) {
    // Try to find the validator with different naming patterns
    let validator = validators[name];
    if (!validator) {
      // Try finding by partial match
      validator = findValidator(plutusJson, name.replace('_', '.'));
    }

    if (!validator) {
      log(`  [SKIP] ${name} — not found in plutus.json`);
      continue;
    }

    try {
      const result = await deployReferenceScript(lucid, name, validator, deployment);
      deployment.validators[name] = {
        title: validator.title,
        hash: validator.hash,
      };
      deployment.referenceScripts[name] = {
        txHash: result.txHash,
        outputIndex: result.outputIndex,
      };
      log(`  [OK] ${name}`);
      log(`       Hash: ${validator.hash.slice(0, 20)}...`);
      log(`       Ref:  ${result.txHash}#${result.outputIndex}`);
    } catch (error) {
      logError(`  [FAIL] ${name}`, error);
    }
  }

  // Save deployment artifacts
  log('');
  const artifactPath = saveDeployment(deployment.network, deployment);
  log('');
  log('Deployment complete!');
  log(`Artifacts saved to: ${artifactPath}`);
  log('');
  log('Next steps:');
  log('  1. Run genesis initialization: npm run genesis:init');
  log('  2. Mint genesis tokens: npm run genesis:mint');
  log('  3. Create first bioregion');
  log('  4. Start onboarding users');

  return deployment;
}

// =============================================================================
// DEPLOY REFERENCE SCRIPT
// =============================================================================

/**
 * Deploy a single validator as a reference script
 * @param {Lucid} lucid Lucid instance
 * @param {string} name Validator name
 * @param {Object} validator Validator object from plutus.json
 * @param {Object} deployment Deployment record for config
 * @returns {Promise<{txHash: string, outputIndex: number}>}
 */
async function deployReferenceScript(lucid, name, validator, deployment) {
  // Get the compiled script
  let script = validator.compiledCode;

  // Apply parameters if this is a parameterized validator
  script = await applyValidatorParams(lucid, name, script, deployment);

  // Create the script address (for storing the reference script)
  const scriptAddr = lucid.utils.validatorToAddress({
    type: 'PlutusV2',
    script: script,
  });

  // Build transaction to store reference script
  const tx = await lucid
    .newTx()
    .pay.ToAddressWithData(
      scriptAddr,
      { kind: 'inline', value: '00' }, // Empty datum
      { lovelace: 10_000_000n }, // 10 ADA for storage
      { type: 'PlutusV2', script: script }
    )
    .complete();

  // Sign and submit
  const signedTx = await tx.sign.withWallet().complete();
  const txHash = await signedTx.submit();

  // Wait for confirmation
  await lucid.awaitTx(txHash);

  return {
    txHash,
    outputIndex: 0, // Reference script is always at output 0
  };
}

/**
 * Apply parameters to parameterized validators
 * @param {Lucid} lucid Lucid instance
 * @param {string} name Validator name
 * @param {string} script Compiled script
 * @param {Object} deployment Deployment record
 * @returns {Promise<string>} Parameterized script
 */
async function applyValidatorParams(lucid, name, script, deployment) {
  // Most validators require configuration parameters
  // These are applied using Aiken's apply_params pattern

  switch (name) {
    case 'genesis': {
      // Genesis needs founding oracles and stewards
      const foundingOracles = (process.env.FOUNDING_ORACLES || '').split(',').filter(Boolean);
      const foundingStewards = (process.env.FOUNDING_STEWARDS || '').split(',').filter(Boolean);
      const genesisEndSlot = parseInt(process.env.GENESIS_END_SLOT || '0', 10);

      if (foundingOracles.length === 0 || foundingStewards.length === 0) {
        log(`    [WARN] No founders configured for genesis validator`);
        return script;
      }

      // Apply genesis config parameters
      return applyParamsToScript(script, [
        BigInt(genesisEndSlot),
        foundingOracles,
        foundingStewards,
        BigInt(2), // genesis_oracle_threshold
        BigInt(37), // steward_threshold
        deployment.validators.pnft_policy?.hash || '',
      ]);
    }

    case 'pnft_policy':
    case 'pnft_spend': {
      // pNFT needs bioregion registry and DNA oracle config
      return applyParamsToScript(script, [
        deployment.validators.bioregion?.hash || '',
        [], // dna_oracle list (populated during genesis)
        BigInt(2), // oracle_threshold
      ]);
    }

    case 'token_policy': {
      // Token policy needs genesis UTXO
      const genesisUtxo = process.env.GENESIS_UTXO;
      if (!genesisUtxo) {
        log(`    [WARN] No GENESIS_UTXO configured for token policy`);
        return script;
      }

      const [txHash, outputIndex] = genesisUtxo.split('#');
      return applyParamsToScript(script, [
        { txHash, outputIndex: BigInt(outputIndex || 0) },
        BigInt(process.env.TOTAL_SUPPLY || '400000000000000000'),
        deployment.validators.treasury?.hash || '',
        deployment.validators.grants?.hash || '',
      ]);
    }

    case 'token': {
      // Token validator needs policy IDs and contract addresses
      return applyParamsToScript(script, [
        deployment.validators.token_policy?.hash || '',
        textToHex('ULTRA'),
        deployment.validators.pnft_policy?.hash || '',
        deployment.validators.records?.hash || '',
        deployment.validators.ubi?.hash || '',
        deployment.validators.treasury?.hash || '',
        deployment.validators.grants?.hash || '',
        deployment.validators.remediation?.hash || '',
      ]);
    }

    case 'ubi': {
      // UBI needs token policy and related contracts
      return applyParamsToScript(script, [
        deployment.validators.token_policy?.hash || '',
        textToHex('ULTRA'),
        deployment.validators.pnft_policy?.hash || '',
        deployment.validators.bioregion?.hash || '',
        deployment.validators.records?.hash || '',
        deployment.validators.treasury?.hash || '',
      ]);
    }

    case 'treasury':
    case 'grants':
    case 'governance':
    case 'records':
    case 'impact':
    case 'remediation':
    case 'bioregion':
    case 'marketplace':
    case 'collective':
    case 'spending_bucket':
    default:
      // These validators may have simpler or no parameters
      // Return script as-is for now
      return script;
  }
}

// =============================================================================
// RUN
// =============================================================================

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logError('Deployment failed', error);
    process.exit(1);
  });
