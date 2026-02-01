#!/usr/bin/env node
/**
 * UltraLife Protocol — Claim Signup ULTRA
 *
 * Claims the signup grant of ULTRA tokens for your pNFT.
 * On mainnet: 50 ULTRA for DNA-verified users from grants pool
 * On testnet: Simulated grant for testing the flow
 *
 * Usage:
 *   node claim-signup-ultra.mjs
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
dotenv.config({ path: path.join(__dirname, '.env') });

// Fix libsodium ESM
function fixLibsodiumESM() {
  const nodeModules = path.join(__dirname, 'node_modules');
  const targetDir = path.join(nodeModules, 'libsodium-wrappers-sumo', 'dist', 'modules-sumo-esm');
  const targetFile = path.join(targetDir, 'libsodium-sumo.mjs');
  const sourceFile = path.join(nodeModules, 'libsodium-sumo', 'dist', 'modules-sumo-esm', 'libsodium-sumo.mjs');

  if (!fs.existsSync(targetFile) && fs.existsSync(sourceFile)) {
    try {
      fs.copyFileSync(sourceFile, targetFile);
    } catch (err) {}
  }
}
fixLibsodiumESM();

const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
};

const CONFIG = {
  network: process.env.NETWORK || 'preprod',
  blockfrostKey: process.env.BLOCKFROST_API_KEY,
  walletMnemonic: process.env.WALLET_SEED_PHRASE,
  deploymentPath: path.join(__dirname, 'deployment.json'),
};

// Signup grant amount (50 ULTRA = 50_000_000 lovelace-equivalent units)
const SIGNUP_GRANT_AMOUNT = 50;

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          UltraLife Protocol — Claim Signup ULTRA              ║
╚═══════════════════════════════════════════════════════════════╝
`);

  if (!CONFIG.blockfrostKey || !CONFIG.walletMnemonic) {
    log.error('Missing configuration. Set BLOCKFROST_API_KEY and WALLET_SEED_PHRASE in .env');
    process.exit(1);
  }

  const { atomicWriteSync, safeReadJson, formatAda } = await import('./utils.mjs');
  const { BlockfrostProvider, MeshWallet } = await import('@meshsdk/core');

  // Load deployment
  const deployment = safeReadJson(CONFIG.deploymentPath, {});
  const pnfts = deployment.pnfts || [];

  // Initialize wallet
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

  // Find user's pNFT
  const userPnft = pnfts.find(p => p.owner === address && p.status === 'minted');

  if (!userPnft) {
    log.error('No minted pNFT found for your wallet!');
    log.info('First mint a pNFT: npm run mint:pnft:basic');
    process.exit(1);
  }

  log.success(`Found pNFT: ${userPnft.id}`);
  log.info(`Level: ${userPnft.level}`);

  // Check if already claimed
  deployment.signupGrants = deployment.signupGrants || [];
  const existingGrant = deployment.signupGrants.find(g => g.pnftId === userPnft.id);

  if (existingGrant) {
    log.warn('You already claimed your signup ULTRA!');
    log.info(`Claimed: ${existingGrant.amount} ULTRA on ${existingGrant.claimedAt}`);
    console.log(`
Your ULTRA balance: ${existingGrant.amount} ULTRA

To delegate your ULTRA to a bioregion pool:
  npm run delegate:sna
`);
    process.exit(0);
  }

  // Check for grants pool (on-chain)
  // For testnet, we simulate this as a local record
  const grantsPool = deployment.grantsPool || {
    tokensRemaining: 200_000_000_000, // 200B for grants
    grantsIssued: 0,
  };

  if (grantsPool.tokensRemaining < SIGNUP_GRANT_AMOUNT) {
    log.error('Grants pool exhausted!');
    process.exit(1);
  }

  log.info(`Grants pool: ${grantsPool.tokensRemaining.toLocaleString()} ULTRA remaining`);
  log.info(`Claiming: ${SIGNUP_GRANT_AMOUNT} ULTRA signup grant`);

  // =========================================================================
  // TESTNET: Simulated Grant (local record)
  // MAINNET: Would interact with grants contract on-chain
  // =========================================================================

  if (CONFIG.network !== 'mainnet') {
    log.warn('Testnet mode: Simulating grant claim locally');

    // Create grant record
    const grantRecord = {
      pnftId: userPnft.id,
      pnftOwner: address,
      amount: SIGNUP_GRANT_AMOUNT,
      claimedAt: new Date().toISOString(),
      txHash: 'testnet_simulated_' + crypto.randomBytes(16).toString('hex'),
    };

    deployment.signupGrants.push(grantRecord);

    // Update grants pool
    grantsPool.tokensRemaining -= SIGNUP_GRANT_AMOUNT;
    grantsPool.grantsIssued += 1;
    deployment.grantsPool = grantsPool;

    // Track user's ULTRA balance
    deployment.ultraBalances = deployment.ultraBalances || {};
    deployment.ultraBalances[address] = (deployment.ultraBalances[address] || 0) + SIGNUP_GRANT_AMOUNT;

    atomicWriteSync(CONFIG.deploymentPath, deployment);

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║               💰 SIGNUP ULTRA CLAIMED! 💰                     ║
╠═══════════════════════════════════════════════════════════════╣
║  pNFT:       ${userPnft.id.padEnd(48)}║
║  Amount:     ${(SIGNUP_GRANT_AMOUNT + ' ULTRA').padEnd(48)}║
║  Balance:    ${(deployment.ultraBalances[address] + ' ULTRA').padEnd(48)}║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  Your ULTRA is liquid staked to your wallet!                  ║
║  You can spend it anytime while earning from delegation.      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝

What you can do now:

  1. Delegate to your bioregion pool (stays liquid):
     npm run delegate:sna

  2. Check your balance:
     "Show my ULTRA balance"

  3. Make an impact-tracked transaction:
     "Send 5 ULTRA to another user with food purchase impact"

`);
  } else {
    // MAINNET: Would build actual transaction to grants contract
    log.info('Building on-chain grant claim transaction...');
    log.error('Mainnet grants claim not yet implemented');
    log.info('Requires: Grants contract deployed with funded pool');
    process.exit(1);
  }
}

main().catch(error => {
  log.error(error.message);
  console.error(error);
  process.exit(1);
});
