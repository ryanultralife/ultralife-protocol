#!/usr/bin/env node
/**
 * UltraLife Protocol — Create Test User
 *
 * Creates a new test wallet for multi-party transaction testing.
 * Generates a new seed phrase and sets up pNFT + signup ULTRA.
 *
 * Usage:
 *   node create-test-user.mjs --name "Alice"
 *   node create-test-user.mjs --name "Bob" --bioregion sierra_nevada
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

const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
};

const CONFIG = {
  network: process.env.NETWORK || 'preprod',
  blockfrostKey: process.env.BLOCKFROST_API_KEY,
  deploymentPath: path.join(__dirname, 'deployment.json'),
};

// BIP39 word list (simplified - first 256 words for demo)
const BIP39_WORDS = [
  'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
  'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
  'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actress', 'actual',
  'adapt', 'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance',
  'advice', 'aerobic', 'affair', 'afford', 'afraid', 'again', 'age', 'agent',
  'agree', 'ahead', 'aim', 'air', 'airport', 'aisle', 'alarm', 'album',
  'alcohol', 'alert', 'alien', 'all', 'alley', 'allow', 'almost', 'alone',
  'alpha', 'already', 'also', 'alter', 'always', 'amateur', 'amazing', 'among',
  'amount', 'amused', 'analyst', 'anchor', 'ancient', 'anger', 'angle', 'angry',
  'animal', 'ankle', 'announce', 'annual', 'another', 'answer', 'antenna', 'antique',
  'anxiety', 'any', 'apart', 'apology', 'appear', 'apple', 'approve', 'april',
  'arch', 'arctic', 'area', 'arena', 'argue', 'arm', 'armed', 'armor',
  'army', 'around', 'arrange', 'arrest', 'arrive', 'arrow', 'art', 'artefact',
  'artist', 'artwork', 'ask', 'aspect', 'assault', 'asset', 'assist', 'assume',
  'asthma', 'athlete', 'atom', 'attack', 'attend', 'attitude', 'attract', 'auction',
  'audit', 'august', 'aunt', 'author', 'auto', 'autumn', 'average', 'avocado',
  'avoid', 'awake', 'aware', 'away', 'awesome', 'awful', 'awkward', 'axis',
  'baby', 'bachelor', 'bacon', 'badge', 'bag', 'balance', 'balcony', 'ball',
  'bamboo', 'banana', 'banner', 'bar', 'barely', 'bargain', 'barrel', 'base',
  'basic', 'basket', 'battle', 'beach', 'bean', 'beauty', 'because', 'become',
  'beef', 'before', 'begin', 'behave', 'behind', 'believe', 'below', 'belt',
  'bench', 'benefit', 'best', 'betray', 'better', 'between', 'beyond', 'bicycle',
  'bid', 'bike', 'bind', 'biology', 'bird', 'birth', 'bitter', 'black',
  'blade', 'blame', 'blanket', 'blast', 'bleak', 'bless', 'blind', 'blood',
  'blossom', 'blouse', 'blue', 'blur', 'blush', 'board', 'boat', 'body',
  'boil', 'bomb', 'bone', 'bonus', 'book', 'boost', 'border', 'boring',
  'borrow', 'boss', 'bottom', 'bounce', 'box', 'boy', 'bracket', 'brain',
  'brand', 'brass', 'brave', 'bread', 'breeze', 'brick', 'bridge', 'brief',
  'bright', 'bring', 'brisk', 'broccoli', 'broken', 'bronze', 'broom', 'brother',
  'brown', 'brush', 'bubble', 'buddy', 'budget', 'buffalo', 'build', 'bulb',
  'bulk', 'bullet', 'bundle', 'bunker', 'burden', 'burger', 'burst', 'bus',
  'business', 'busy', 'butter', 'buyer', 'buzz', 'cabbage', 'cabin', 'cable',
];

function generateMnemonic() {
  // Generate 24 random words from BIP39 list
  const words = [];
  for (let i = 0; i < 24; i++) {
    const randomIndex = crypto.randomInt(0, BIP39_WORDS.length);
    words.push(BIP39_WORDS[randomIndex]);
  }
  return words.join(' ');
}

function generatePnftId() {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(8).toString('hex');
  return `pnft_${timestamp}_${random}`;
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           UltraLife Protocol — Create Test User               ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Parse arguments
  const args = process.argv.slice(2);
  const nameIdx = args.indexOf('--name');
  const bioregionIdx = args.indexOf('--bioregion');
  const listIdx = args.indexOf('--list');

  const { atomicWriteSync, safeReadJson } = await import('./utils.mjs');
  const { MeshWallet, BlockfrostProvider } = await import('@meshsdk/core');

  // Load deployment
  const deployment = safeReadJson(CONFIG.deploymentPath, {});
  deployment.testUsers = deployment.testUsers || [];

  // List existing test users
  if (listIdx >= 0) {
    if (deployment.testUsers.length === 0) {
      log.info('No test users created yet.');
      log.info('Create one: node create-test-user.mjs --name "Alice"');
    } else {
      console.log('Test users:\n');
      for (const user of deployment.testUsers) {
        const balance = deployment.ultraBalances?.[user.address] || 0;
        console.log(`  ${user.name.padEnd(12)} ${user.pnftId.padEnd(35)} ${balance} ULTRA`);
      }
    }
    return;
  }

  const userName = nameIdx >= 0 ? args[nameIdx + 1] : `User_${Date.now().toString(36)}`;
  const bioregion = bioregionIdx >= 0 ? args[bioregionIdx + 1] : 'sierra_nevada';

  log.info(`Creating test user: ${userName}`);
  log.info(`Bioregion: ${bioregion}`);

  // Generate new wallet
  const mnemonic = generateMnemonic();
  log.info('Generated new wallet');

  // Initialize wallet
  const provider = new BlockfrostProvider(CONFIG.blockfrostKey);
  const wallet = new MeshWallet({
    networkId: CONFIG.network === 'mainnet' ? 1 : 0,
    fetcher: provider,
    submitter: provider,
    key: {
      type: 'mnemonic',
      words: mnemonic.split(' '),
    },
  });

  const address = wallet.getChangeAddress();
  log.info(`Address: ${address.slice(0, 50)}...`);

  // Generate pNFT for this user
  const pnftId = generatePnftId();
  const currentSlot = Math.floor(Date.now() / 1000) - 1654041600; // Approximate preprod slot

  // Create pNFT record (simulated for testnet)
  const pnftRecord = {
    id: pnftId,
    owner: address,
    level: 'Basic',
    bioregion: bioregion,
    createdAt: new Date().toISOString(),
    createdSlot: currentSlot,
    status: 'minted',
    testnetSimulated: true,
  };

  deployment.pnfts = deployment.pnfts || [];
  deployment.pnfts.push(pnftRecord);

  // Grant signup ULTRA
  const signupAmount = 50;
  deployment.ultraBalances = deployment.ultraBalances || {};
  deployment.ultraBalances[address] = signupAmount;

  deployment.signupGrants = deployment.signupGrants || [];
  deployment.signupGrants.push({
    pnftId: pnftId,
    pnftOwner: address,
    amount: signupAmount,
    claimedAt: new Date().toISOString(),
    testnetSimulated: true,
  });

  // Store test user
  const testUser = {
    name: userName,
    address: address,
    mnemonic: mnemonic, // Store for testing (wouldn't do this in production!)
    pnftId: pnftId,
    bioregion: bioregion,
    createdAt: new Date().toISOString(),
  };

  deployment.testUsers.push(testUser);
  atomicWriteSync(CONFIG.deploymentPath, deployment);

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║               👤 TEST USER CREATED! 👤                        ║
╠═══════════════════════════════════════════════════════════════╣
║  Name:       ${userName.padEnd(48)}║
║  Address:    ${(address.slice(0, 45) + '...').padEnd(48)}║
║  pNFT:       ${pnftId.padEnd(48)}║
║  Bioregion:  ${bioregion.padEnd(48)}║
║  ULTRA:      ${(signupAmount + ' ULTRA (signup grant)').padEnd(48)}║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  Seed Phrase (TESTNET ONLY - save this!):                     ║
╠═══════════════════════════════════════════════════════════════╣
║  ${mnemonic.slice(0, 60).padEnd(60)}║
║  ${mnemonic.slice(60, 120).padEnd(60)}║
║  ${mnemonic.slice(120).padEnd(60)}║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║  To send tADA to this user, use this address:                 ║
║  ${address}
║                                                               ║
║  To make an impact transaction TO this user:                  ║
║    npm run transfer -- --to ${userName} --amount 10           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

main().catch(error => {
  log.error(error.message);
  console.error(error);
  process.exit(1);
});
