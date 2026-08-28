#!/usr/bin/env node
/**
 * UltraLife Protocol — Work Auction CLI
 *
 * Marketplace for work: pNFTs list work they need, workers bid on it.
 *
 * The flow:
 * 1. Asset owner (pNFT) creates work request with expected impacts
 * 2. Request goes to marketplace as auction
 * 3. Qualified workers (pNFTs) submit bids
 * 4. Owner accepts bid -> Escrow created
 * 5. Worker performs work, submits evidence
 * 6. Payment released, impacts recorded
 *
 * Usage:
 *   node work-auction.mjs --post-job --desc "Fence repair" --type maintenance --budget-min 50 --budget-max 100
 *   node work-auction.mjs --list-jobs
 *   node work-auction.mjs --bid --job <jobId> --amount 75 --timeline 7
 *   node work-auction.mjs --accept-bid --bid <bidId>
 *   node work-auction.mjs --complete --job <jobId> --evidence <ipfsHash>
 *   node work-auction.mjs --confirm --job <jobId>
 *   node work-auction.mjs --dispute --job <jobId> --reason "Work not completed as specified"
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
  info: (msg) => console.log(`[INFO]  ${msg}`),
  success: (msg) => console.log(`[OK]    ${msg}`),
  warn: (msg) => console.log(`[WARN]  ${msg}`),
  error: (msg) => console.log(`[ERROR] ${msg}`),
};

const CONFIG = {
  network: process.env.NETWORK || 'preprod',
  blockfrostKey: process.env.BLOCKFROST_API_KEY,
  walletMnemonic: process.env.WALLET_SEED_PHRASE,
  deploymentPath: path.join(__dirname, 'deployment.json'),
};

const WORK_TYPES = {
  construction: {
    name: 'Construction',
    phases: ['site_prep', 'foundation', 'framing', 'roofing', 'electrical', 'plumbing', 'finishing', 'landscaping'],
  },
  agriculture: {
    name: 'Agriculture',
    activities: ['planting', 'cultivation', 'harvesting', 'irrigation', 'soil_management'],
  },
  forestry: {
    name: 'Forestry',
    activities: ['tree_planting', 'selective_harvest', 'forest_management', 'fire_prevention', 'restoration'],
  },
  manufacturing: { name: 'Manufacturing' },
  transport: { name: 'Transport' },
  services: { name: 'Services' },
  maintenance: { name: 'Maintenance/Repair' },
  survey: { name: 'Survey/Assessment' },
  custom: { name: 'Custom' },
};

const VERIFICATION_LEVELS = ['Basic', 'Ward', 'Standard', 'Verified', 'Steward'];
const VOTING_WEIGHT = { Basic: 0, Ward: 0, Standard: 1, Verified: 2, Steward: 3 };
function canTransact(level) { return level && level !== 'Basic'; }
function meetsLevelRequirement(actual, required) {
  return (VOTING_WEIGHT[actual] ?? -1) >= (VOTING_WEIGHT[required] ?? 99);
}
function refuseMainnet() {
  if ((process.env.NETWORK || 'preprod') === 'mainnet') {
    console.error('[ERROR] Refusing mainnet. Work auction is PREPROD only.');
    process.exit(1);
  }
}

const REQUEST_STATUS = {
  OPEN: 'Open',
  IN_PROGRESS: 'InProgress',
  PENDING_VERIFICATION: 'PendingVerification',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DISPUTED: 'Disputed',
};

const BID_STATUS = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

const ESCROW_STATUS = {
  FUNDED: 'Funded',
  WORK_STARTED: 'WorkStarted',
  WORK_SUBMITTED: 'WorkSubmitted',
  VERIFIED: 'Verified',
  RELEASED: 'Released',
  REFUNDED: 'Refunded',
  IN_DISPUTE: 'InDispute',
};
