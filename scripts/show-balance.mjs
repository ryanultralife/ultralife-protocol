#!/usr/bin/env node
/**
 * UltraLife Protocol — Show Balance
 *
 * Shows your ADA and ULTRA token balances.
 *
 * Usage:
 *   node show-balance.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// Fix libsodium ESM
function fixLibsodiumESM() {
  const nodeModules = path.join(__dirname, 'node_modules');
  const targetDir = path.join(nodeModules, 'libsodium-wrappers-sumo', 'dist', 'modules-sumo-esm');
  const targetFile = path.join(targetDir, 'libsodium-sumo.mjs');
  const sourceFile = path.join(nodeModules, 'libsodium-sumo', 'dist', 'modules-sumo-esm', 'libsodium-sumo.mjs');

  if (!fs.existsSync(targetFile) && fs.existsSync(sourceFile)) {
    try { fs.copyFileSync(sourceFile, targetFile); } catch (err) {}
  }
}
fixLibsodiumESM();

const CONFIG = {
  network: process.env.NETWORK || 'preprod',
  blockfrostKey: process.env.BLOCKFROST_API_KEY,
  walletMnemonic: process.env.WALLET_SEED_PHRASE,
  deploymentPath: path.join(__dirname, 'deployment.json'),
};

async function main() {
  const { safeReadJson, formatAda } = await import('./utils.mjs');
  const { BlockfrostProvider, MeshWallet } = await import('@meshsdk/core');

  if (!CONFIG.blockfrostKey || !CONFIG.walletMnemonic) {
    console.error('❌ Missing configuration');
    process.exit(1);
  }

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
  const deployment = safeReadJson(CONFIG.deploymentPath, {});

  // ADA balance
  const utxos = await provider.fetchAddressUTxOs(address);
  const adaBalance = utxos.reduce((sum, u) => {
    const l = u.output.amount.find(a => a.unit === 'lovelace');
    return sum + BigInt(l?.quantity || 0);
  }, 0n);

  // ULTRA balance (testnet: local record)
  const ultraBalance = deployment.ultraBalances?.[address] || 0;

  // Find pNFT
  const pnfts = deployment.pnfts || [];
  const userPnft = pnfts.find(p => p.owner === address && p.status === 'minted');

  // Find delegations
  const delegations = deployment.delegations || [];
  const userDelegation = delegations.find(d => d.walletAddress === address);

  // Find stake pool
  const stakePools = deployment.stakePools || [];
  const userPool = stakePools.find(p => p.operatorAddress === address);

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                 UltraLife Protocol — Balance                  ║
╠═══════════════════════════════════════════════════════════════╣
║  Wallet:    ${address.slice(0, 48)}...║
╠═══════════════════════════════════════════════════════════════╣
║  💰 ADA:     ${formatAda(adaBalance).padEnd(46)}║
║  🌿 ULTRA:   ${(ultraBalance + ' ULTRA').padEnd(46)}║
╠═══════════════════════════════════════════════════════════════╣`);

  if (userPnft) {
    console.log(`║  🪪 pNFT:    ${userPnft.id.padEnd(46)}║`);
    console.log(`║     Level:  ${userPnft.level.padEnd(47)}║`);
  } else {
    console.log(`║  🪪 pNFT:    Not minted yet                                  ║`);
  }

  if (userPool) {
    console.log(`╠═══════════════════════════════════════════════════════════════╣`);
    console.log(`║  🏊 Pool:    ${userPool.ticker.padEnd(46)}║`);
    console.log(`║     Region: ${userPool.bioregion.padEnd(47)}║`);
  }

  if (userDelegation) {
    console.log(`╠═══════════════════════════════════════════════════════════════╣`);
    console.log(`║  📍 Delegated to: ${(userDelegation.poolTicker + ' (' + userDelegation.bioregion + ')').padEnd(41)}║`);
  }

  console.log(`╚═══════════════════════════════════════════════════════════════╝

Your ${formatAda(adaBalance)} remains liquid while delegated.
Your ${ultraBalance} ULTRA can be spent anytime.
`);
}

main().catch(error => {
  console.error('❌', error.message);
  process.exit(1);
});
