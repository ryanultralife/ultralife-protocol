#!/usr/bin/env node

/**
 * UltraLife Protocol — Status Check
 *
 * Displays the current deployment status and wallet information.
 *
 * Usage:
 *   npm run status
 */

import {
  initLucid,
  loadPlutusJson,
  getAllValidators,
  loadDeployment,
  log,
  logError,
} from './lib/lucid.mjs';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function main() {
  const network = process.env.NETWORK || 'preview';

  log('');
  log('='.repeat(60));
  log('  UltraLife Protocol — Deployment Status');
  log('='.repeat(60));
  log('');

  // Network info
  log(`Network: ${network}`);
  log('');

  // Check Blockfrost API key
  if (process.env.BLOCKFROST_API_KEY) {
    log('[OK] Blockfrost API key configured');
  } else {
    log('[!!] Blockfrost API key NOT configured');
  }

  // Check wallet seed
  if (process.env.WALLET_SEED) {
    log('[OK] Wallet seed configured');
  } else {
    log('[!!] Wallet seed NOT configured');
  }

  // Load deployment
  const deployment = loadDeployment(network);

  if (!deployment) {
    log('');
    log('[!!] No deployment found for this network');
    log('');
    log('To deploy:');
    log('  1. Copy .env.example to .env');
    log('  2. Configure BLOCKFROST_API_KEY and WALLET_SEED');
    log('  3. Run: npm run deploy:reference');
    return;
  }

  log('');
  log('-'.repeat(60));
  log('  Deployment Info');
  log('-'.repeat(60));
  log('');
  log(`Deployed: ${deployment.timestamp}`);
  log(`Deployer: ${deployment.deployer}`);

  // Genesis status
  log('');
  log('-'.repeat(60));
  log('  Genesis Status');
  log('-'.repeat(60));
  log('');

  if (deployment.genesisInitialized) {
    log(`[OK] Genesis initialized: ${deployment.genesisInitialized}`);
    log(`     Genesis UTxO: ${deployment.genesisUtxo || 'N/A'}`);
  } else {
    log('[..] Genesis NOT initialized');
    log('     Run: npm run genesis:init');
  }

  if (deployment.genesisMintTx) {
    log(`[OK] Tokens minted: ${deployment.genesisMintTx}`);
    log(`     Policy ID: ${deployment.tokenPolicyId}`);
    log(`     Total supply: ${formatSupply(deployment.totalSupply)}`);
  } else {
    log('[..] Tokens NOT minted');
    log('     Run: npm run genesis:mint');
  }

  // Reference scripts
  log('');
  log('-'.repeat(60));
  log('  Reference Scripts');
  log('-'.repeat(60));
  log('');

  const refScripts = deployment.referenceScripts || {};
  const validators = deployment.validators || {};

  const scriptStatus = [
    'genesis',
    'pnft_policy',
    'pnft_spend',
    'token_policy',
    'token',
    'ubi',
    'treasury',
    'grants',
    'bioregion',
    'governance',
    'records',
  ];

  for (const name of scriptStatus) {
    if (refScripts[name]) {
      log(`[OK] ${name.padEnd(15)} — ${refScripts[name].txHash.slice(0, 20)}...`);
    } else if (validators[name]) {
      log(`[..] ${name.padEnd(15)} — compiled but not deployed`);
    } else {
      log(`[  ] ${name.padEnd(15)} — not found`);
    }
  }

  // Contract addresses
  log('');
  log('-'.repeat(60));
  log('  Contract Addresses');
  log('-'.repeat(60));
  log('');

  if (deployment.genesisAddress) {
    log(`Genesis:  ${deployment.genesisAddress}`);
  }
  if (deployment.treasuryAddress) {
    log(`Treasury: ${deployment.treasuryAddress}`);
  }
  if (deployment.grantsAddress) {
    log(`Grants:   ${deployment.grantsAddress}`);
  }

  // Try to get wallet balance
  if (process.env.BLOCKFROST_API_KEY) {
    try {
      const lucid = await initLucid();
      if (process.env.WALLET_SEED) {
        lucid.selectWallet.fromSeed(process.env.WALLET_SEED);
        const address = await lucid.wallet().address();
        const utxos = await lucid.wallet().getUtxos();
        const adaBalance = utxos.reduce((acc, u) => acc + u.assets.lovelace, 0n);

        log('');
        log('-'.repeat(60));
        log('  Wallet Status');
        log('-'.repeat(60));
        log('');
        log(`Address: ${address}`);
        log(`Balance: ${Number(adaBalance) / 1_000_000} ADA`);
        log(`UTxOs:   ${utxos.length}`);

        // Check token balance if deployed
        if (deployment.tokenPolicyId) {
          const tokenUnit = `${deployment.tokenPolicyId}554c545241`; // ULTRA
          const tokenBalance = utxos.reduce((acc, u) => acc + (u.assets[tokenUnit] || 0n), 0n);
          log(`ULTRA:   ${Number(tokenBalance) / 1_000_000}`);
        }
      }
    } catch (e) {
      log('');
      log('[!!] Could not fetch wallet balance');
    }
  }

  // plutus.json status
  log('');
  log('-'.repeat(60));
  log('  Compiled Contracts (plutus.json)');
  log('-'.repeat(60));
  log('');

  try {
    const plutusJson = loadPlutusJson();
    const allValidators = getAllValidators(plutusJson);
    const count = Object.keys(allValidators).length;
    log(`Found ${count} validators in plutus.json`);
    log('');

    for (const [name, v] of Object.entries(allValidators)) {
      log(`  ${name}: ${v.hash.slice(0, 20)}...`);
    }
  } catch (e) {
    log('[!!] plutus.json not found');
    log('     Run: aiken build (in contracts directory)');
  }

  log('');
  log('='.repeat(60));
  log('');
  log('Commands:');
  log('  npm run deploy:reference  — Deploy reference scripts');
  log('  npm run genesis:init      — Initialize genesis datum');
  log('  npm run genesis:mint      — Mint token supply');
  log('  npm run pnft:mint         — Mint a pNFT');
  log('  npm run ubi:init          — Initialize UBI pool');
  log('  npm run ubi:claim         — Claim UBI distribution');
  log('  npm run transfer          — Transfer tokens');
  log('');
}

function formatSupply(supply) {
  if (!supply) return 'N/A';
  const num = BigInt(supply);
  const billions = Number(num / 1_000_000_000_000n);
  return `${billions}B ULTRA`;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logError('Status check failed', error);
    process.exit(1);
  });
