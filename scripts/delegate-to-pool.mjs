#!/usr/bin/env node
/**
 * UltraLife Protocol — Delegate to Bioregion Stake Pool
 *
 * Delegates your wallet's stake to a bioregion stake pool.
 * Your ADA remains liquid - you can spend it anytime while delegated.
 *
 * Usage:
 *   node delegate-to-pool.mjs --pool SNA
 *   node delegate-to-pool.mjs --pool-id pool1abc...
 *   node delegate-to-pool.mjs --bioregion sierra_nevada
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env file from scripts directory
dotenv.config({ path: path.join(__dirname, '.env') });

// Fix libsodium ESM module issue
function fixLibsodiumESM() {
  const nodeModules = path.join(__dirname, 'node_modules');
  const targetDir = path.join(nodeModules, 'libsodium-wrappers-sumo', 'dist', 'modules-sumo-esm');
  const targetFile = path.join(targetDir, 'libsodium-sumo.mjs');
  const sourceFile = path.join(nodeModules, 'libsodium-sumo', 'dist', 'modules-sumo-esm', 'libsodium-sumo.mjs');

  if (!fs.existsSync(targetFile) && fs.existsSync(sourceFile)) {
    try {
      fs.copyFileSync(sourceFile, targetFile);
      console.log('ℹ️  Fixed libsodium ESM module path');
    } catch (err) {
      // Ignore
    }
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

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║       UltraLife Protocol — Delegate to Bioregion Pool         ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Parse arguments
  const args = process.argv.slice(2);
  const poolIdx = args.indexOf('--pool');
  const poolIdIdx = args.indexOf('--pool-id');
  const bioregionIdx = args.indexOf('--bioregion');
  const listIdx = args.indexOf('--list');

  // Check configuration
  if (!CONFIG.blockfrostKey || !CONFIG.walletMnemonic) {
    log.error('Missing configuration. Set BLOCKFROST_API_KEY and WALLET_SEED_PHRASE in .env');
    process.exit(1);
  }

  // Dynamic imports
  const { atomicWriteSync, safeReadJson, formatAda } = await import('./utils.mjs');
  const { BlockfrostProvider, MeshWallet, Transaction, deserializeAddress } = await import('@meshsdk/core');

  // Load deployment record
  const deployment = safeReadJson(CONFIG.deploymentPath, {});
  const stakePools = deployment.stakePools || [];

  // List registered pools
  if (listIdx >= 0 || stakePools.length === 0) {
    if (stakePools.length === 0) {
      log.warn('No stake pools registered yet.');
      log.info('Register one first: npm run register:pool:sierra-a');
      process.exit(1);
    }

    console.log('Registered bioregion stake pools:\n');
    for (const pool of stakePools) {
      console.log(`  ${pool.ticker.padEnd(6)} ${pool.bioregion.padEnd(20)} ${pool.poolId.slice(0, 20)}...`);
    }
    console.log('\nUse --pool <ticker> to delegate to a pool.');
    return;
  }

  // Find the target pool
  let targetPool = null;

  if (poolIdx >= 0) {
    const ticker = args[poolIdx + 1]?.toUpperCase();
    targetPool = stakePools.find(p => p.ticker === ticker);
    if (!targetPool) {
      log.error(`Pool with ticker "${ticker}" not found.`);
      log.info('Use --list to see available pools.');
      process.exit(1);
    }
  } else if (poolIdIdx >= 0) {
    const poolId = args[poolIdIdx + 1];
    targetPool = stakePools.find(p => p.poolId === poolId || p.poolId.startsWith(poolId));
    if (!targetPool) {
      log.error(`Pool with ID "${poolId}" not found.`);
      process.exit(1);
    }
  } else if (bioregionIdx >= 0) {
    const bioregion = args[bioregionIdx + 1];
    targetPool = stakePools.find(p =>
      p.bioregion === bioregion ||
      p.bioregion.toLowerCase().replace(/\s+/g, '_') === bioregion.toLowerCase()
    );
    if (!targetPool) {
      log.error(`No pool found for bioregion "${bioregion}".`);
      process.exit(1);
    }
  } else {
    // Default to first pool (SNA if registered)
    targetPool = stakePools.find(p => p.ticker === 'SNA') || stakePools[0];
    log.info(`No pool specified, using ${targetPool.ticker}`);
  }

  log.info(`Delegating to: ${targetPool.ticker} (${targetPool.bioregion})`);
  log.info(`Pool ID: ${targetPool.poolId.slice(0, 30)}...`);

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

  // Get reward/stake address - try multiple methods
  let stakeAddress;
  try {
    const rewardAddresses = wallet.getRewardAddresses();
    stakeAddress = rewardAddresses?.[0];
  } catch (err) {
    // Fallback: derive from address
  }

  // If no stake address, we can still track delegation locally for testnet
  if (!stakeAddress) {
    log.warn('Could not get stake address from wallet');
    log.info('Using local delegation tracking for testnet');
  } else {
    log.info(`Stake address: ${stakeAddress}`);
  }

  log.info(`Wallet: ${address.slice(0, 40)}...`);

  // Check balance
  const utxos = await provider.fetchAddressUTxOs(address);
  const balance = utxos.reduce((sum, u) => {
    const l = u.output.amount.find(a => a.unit === 'lovelace');
    return sum + BigInt(l?.quantity || 0);
  }, 0n);
  log.info(`Balance: ${formatAda(balance)} (remains liquid while delegated)`);

  if (balance < 5_000_000n) {
    log.error('Need at least 5 ADA for delegation transaction + deposit');
    process.exit(1);
  }

  // Check for existing local delegation
  const existingDelegation = deployment.delegations?.find(d => d.walletAddress === address);
  if (existingDelegation) {
    log.info(`Currently delegated to: ${existingDelegation.poolTicker} (${existingDelegation.bioregion})`);
  }

  // =========================================================================
  // TESTNET: Local delegation tracking (demo pool IDs aren't real Cardano pools)
  // MAINNET: Would use real Cardano stake delegation
  // =========================================================================

  const isTestnetDemoPool = !targetPool.poolId.startsWith('pool1');

  if (isTestnetDemoPool) {
    log.info('');
    log.info('Testnet mode: Recording delegation locally');
    log.info('(Demo pool ID - not a real Cardano stake pool)');

    // Record delegation locally
    deployment.delegations = deployment.delegations || [];

    // Remove existing delegation for this wallet
    deployment.delegations = deployment.delegations.filter(d => d.walletAddress !== address);

    const txHash = 'testnet_delegation_' + Date.now().toString(16);

    deployment.delegations.push({
      stakeAddress: stakeAddress || 'derived_from_' + address.slice(0, 20),
      poolId: targetPool.poolId,
      poolTicker: targetPool.ticker,
      bioregion: targetPool.bioregion,
      delegatedAt: new Date().toISOString(),
      txHash: txHash,
      walletAddress: address,
      testnetSimulated: true,
    });

    atomicWriteSync(CONFIG.deploymentPath, deployment);

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              🌲 DELEGATION RECORDED! 🌲                       ║
╠═══════════════════════════════════════════════════════════════╣
║  Pool:        ${targetPool.ticker.padEnd(47)}║
║  Bioregion:   ${targetPool.bioregion.padEnd(47)}║
║  Balance:     ${(formatAda(balance) + ' (still liquid!)').padEnd(47)}║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  Your ADA remains fully spendable while delegated.            ║
║                                                               ║
║  As a delegator to ${targetPool.ticker}, you're now:${' '.repeat(Math.max(0, 26 - targetPool.ticker.length))}║
║  • Supporting ${targetPool.bioregion} bioregion health${' '.repeat(Math.max(0, 26 - targetPool.bioregion.length))}║
║  • Contributing to local treasury (${targetPool.commitment?.treasuryContribution / 100 || 5}%)${' '.repeat(23)}║
║  • Enabling credit underwriting for local projects            ║
║                                                               ║
║  Note: Testnet uses simulated delegation.                     ║
║  Mainnet would use real Cardano stake delegation.             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

  } else {
    // Real Cardano delegation (mainnet or real preprod pool)
    log.info('');
    log.info('Building on-chain delegation transaction...');

    try {
      const tx = new Transaction({ initiator: wallet });

      if (stakeAddress) {
        tx.registerStake(stakeAddress);
        tx.delegateStake(stakeAddress, targetPool.poolId);

        const unsignedTx = await tx.build();
        const signedTx = await wallet.signTx(unsignedTx);

        log.info('Submitting delegation transaction...');
        const txHash = await wallet.submitTx(signedTx);

        log.success(`Delegation submitted!`);
        log.success(`Transaction: ${txHash}`);

        deployment.delegations = deployment.delegations || [];
        deployment.delegations.push({
          stakeAddress: stakeAddress,
          poolId: targetPool.poolId,
          poolTicker: targetPool.ticker,
          bioregion: targetPool.bioregion,
          delegatedAt: new Date().toISOString(),
          txHash: txHash,
          walletAddress: address,
        });

        atomicWriteSync(CONFIG.deploymentPath, deployment);

        console.log(`
╔═══════════════════════════════════════════════════════════════╗
║              🌲 DELEGATION SUCCESSFUL! 🌲                     ║
╠═══════════════════════════════════════════════════════════════╣
║  Pool:        ${targetPool.ticker.padEnd(47)}║
║  Bioregion:   ${targetPool.bioregion.padEnd(47)}║
║  Balance:     ${(formatAda(balance) + ' (still liquid!)').padEnd(47)}║
╠═══════════════════════════════════════════════════════════════╣
║  Transaction: ${txHash.slice(0, 44)}...  ║
╚═══════════════════════════════════════════════════════════════╝

View on Cardanoscan:
  https://${CONFIG.network === 'mainnet' ? '' : 'preprod.'}cardanoscan.io/transaction/${txHash}
`);
      } else {
        log.error('Could not determine stake address for on-chain delegation');
        process.exit(1);
      }
    } catch (error) {
      log.error(`Delegation failed: ${error.message}`);
      console.error(error);
      process.exit(1);
    }
  }
}

main().catch(error => {
  log.error(error.message);
  console.error(error);
  process.exit(1);
});
