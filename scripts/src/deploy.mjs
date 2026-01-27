#!/usr/bin/env node

/**
 * UltraLife Protocol — Full Deployment Script
 *
 * This is the main deployment entry point that orchestrates
 * the complete deployment sequence.
 *
 * Usage:
 *   npm run deploy
 *   npm run deploy:preview
 *   npm run deploy:preprod
 *
 * The deployment sequence:
 *   1. Deploy reference scripts
 *   2. Initialize genesis datum
 *   3. Mint token supply
 *   4. Create first bioregion (optional)
 *
 * For step-by-step deployment, use individual scripts:
 *   npm run deploy:reference
 *   npm run genesis:init
 *   npm run genesis:mint
 */

import {
  initLucidWithWallet,
  loadPlutusJson,
  getAllValidators,
  loadDeployment,
  saveDeployment,
  log,
  logError,
} from './lib/lucid.mjs';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  const network = process.env.NETWORK || 'preview';

  log('');
  log('='.repeat(60));
  log('  UltraLife Protocol — Deployment');
  log('='.repeat(60));
  log('');
  log(`Network: ${network}`);
  log('');

  // Validate environment
  validateEnvironment();

  // Initialize Lucid
  log('Initializing wallet...');
  const lucid = await initLucidWithWallet();
  const address = await lucid.wallet().address();
  log(`Wallet: ${address}`);

  // Check balance
  const utxos = await lucid.wallet().getUtxos();
  const balance = utxos.reduce((acc, u) => acc + u.assets.lovelace, 0n);
  log(`Balance: ${Number(balance) / 1_000_000} ADA`);

  if (balance < 100_000_000n) {
    log('');
    log('[!!] Insufficient balance for full deployment');
    log('     Recommended: 100+ ADA for reference scripts and genesis');
    log('');
    log('Get test ADA from:');
    log('  Preview: https://docs.cardano.org/cardano-testnets/tools/faucet/');
    log('');
    throw new Error('Insufficient balance');
  }

  // Check plutus.json
  log('');
  log('Checking compiled contracts...');
  const plutusJson = loadPlutusJson();
  const validators = getAllValidators(plutusJson);
  log(`Found ${Object.keys(validators).length} validators`);

  // Check existing deployment
  const existingDeployment = loadDeployment(network);
  if (existingDeployment) {
    log('');
    log('[!!] Existing deployment found');
    log(`     Deployed: ${existingDeployment.timestamp}`);
    log('');
    log('Options:');
    log('  1. Run individual scripts to update specific components');
    log('  2. Delete deployments/${network}-latest.json to start fresh');
    log('');
    log('Run "npm run status" to see current deployment state.');
    return;
  }

  // Full deployment sequence
  log('');
  log('='.repeat(60));
  log('  Step 1: Deploy Reference Scripts');
  log('='.repeat(60));
  log('');
  log('This step deploys all validators as reference scripts on-chain.');
  log('Reference scripts reduce transaction sizes and fees.');
  log('');
  log('Run: npm run deploy:reference');
  log('');
  log('After reference scripts are deployed:');
  log('');
  log('='.repeat(60));
  log('  Step 2: Initialize Genesis');
  log('='.repeat(60));
  log('');
  log('Creates the genesis datum for bootstrapping the system.');
  log('');
  log('Run: npm run genesis:init');
  log('');
  log('='.repeat(60));
  log('  Step 3: Mint Token Supply');
  log('='.repeat(60));
  log('');
  log('Mints the total ULTRA supply and distributes to:');
  log('  - Treasury: 200 billion ULTRA (bonding curve)');
  log('  - Grants:   200 billion ULTRA (bootstrap grants)');
  log('');
  log('Run: npm run genesis:mint');
  log('');
  log('='.repeat(60));
  log('  After Deployment');
  log('='.repeat(60));
  log('');
  log('1. Founders verify DNA: npm run pnft:mint -- --level standard');
  log('2. Initialize UBI pool: npm run ubi:init -- --bioregion test');
  log('3. Start onboarding users');
  log('');
  log('Run "npm run status" to check deployment progress.');
  log('');
}

function validateEnvironment() {
  const required = ['BLOCKFROST_API_KEY', 'WALLET_SEED'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    log('[!!] Missing required environment variables:');
    for (const key of missing) {
      log(`     - ${key}`);
    }
    log('');
    log('Copy .env.example to .env and configure these values.');
    throw new Error('Missing environment variables');
  }

  // Validate genesis UTXO for minting
  if (!process.env.GENESIS_UTXO) {
    log('[..] GENESIS_UTXO not configured');
    log('     This is required for token minting.');
    log('     Set to a UTXO in your wallet that will be spent during genesis mint.');
  }

  // Validate founders
  if (!process.env.FOUNDING_ORACLES || !process.env.FOUNDING_STEWARDS) {
    log('[..] Founding oracles/stewards not configured');
    log('     These are required for genesis validator.');
    log('     Set FOUNDING_ORACLES and FOUNDING_STEWARDS in .env');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logError('Deployment failed', error);
    process.exit(1);
  });
