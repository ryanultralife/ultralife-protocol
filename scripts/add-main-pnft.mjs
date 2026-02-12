#!/usr/bin/env node
/**
 * Temporary helper to add pNFT for main wallet in testnet simulation
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
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

async function main() {
  const { atomicWriteSync, safeReadJson } = await import('./utils.mjs');
  const { BlockfrostProvider, MeshWallet } = await import('@meshsdk/core');

  const deploymentPath = path.join(__dirname, 'deployment.json');
  const deployment = safeReadJson(deploymentPath, {});

  // Get main wallet address
  const walletMnemonic = process.env.WALLET_SEED_PHRASE;
  if (!walletMnemonic) {
    console.error('No WALLET_SEED_PHRASE in .env');
    process.exit(1);
  }

  const provider = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY);
  const wallet = new MeshWallet({
    networkId: 0, // preprod
    fetcher: provider,
    submitter: provider,
    key: {
      type: 'mnemonic',
      words: walletMnemonic.trim().split(/\s+/),
    },
  });

  const mainAddress = wallet.getChangeAddress();
  console.log('Main wallet:', mainAddress);

  // Check if already has pNFT
  deployment.pnfts = deployment.pnfts || [];
  const hasPnft = deployment.pnfts.some(p => p.owner === mainAddress);

  if (!hasPnft) {
    const pnftId = 'pnft_' + Date.now().toString(36) + '_' + crypto.randomBytes(8).toString('hex');
    const currentSlot = Math.floor(Date.now() / 1000) - 1654041600;

    // Add pNFT for main wallet
    deployment.pnfts.push({
      id: pnftId,
      owner: mainAddress,
      level: 'Verified', // Give Verified level for land stewardship
      bioregion: 'sierra_nevada',
      createdAt: new Date().toISOString(),
      createdSlot: currentSlot,
      status: 'minted',
      testnetSimulated: true,
    });

    // Grant signup ULTRA
    deployment.ultraBalances = deployment.ultraBalances || {};
    deployment.ultraBalances[mainAddress] = (deployment.ultraBalances[mainAddress] || 0) + 50;

    deployment.signupGrants = deployment.signupGrants || [];
    deployment.signupGrants.push({
      pnftId: pnftId,
      pnftOwner: mainAddress,
      amount: 50,
      claimedAt: new Date().toISOString(),
      testnetSimulated: true,
    });

    atomicWriteSync(deploymentPath, deployment);
    console.log('Created pNFT for main wallet:', pnftId);
    console.log('Level: Verified (can steward land)');
    console.log('ULTRA balance:', deployment.ultraBalances[mainAddress]);
  } else {
    const existingPnft = deployment.pnfts.find(p => p.owner === mainAddress);
    console.log('Main wallet already has pNFT:', existingPnft.id);
    console.log('Level:', existingPnft.level);
  }
}

main().catch(console.error);
