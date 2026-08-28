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
  construction: { name: 'Construction', phases: ['site_prep', 'foundation', 'framing', 'roofing', 'electrical', 'plumbing', 'finishing', 'landscaping'] },
  agriculture: { name: 'Agriculture', activities: ['planting', 'cultivation', 'harvesting', 'irrigation', 'soil_management'] },
  forestry: { name: 'Forestry', activities: ['tree_planting', 'selective_harvest', 'forest_management', 'fire_prevention', 'restoration'] },
  manufacturing: { name: 'Manufacturing' },
  transport: { name: 'Transport' },
  services: { name: 'Services' },
  maintenance: { name: 'Maintenance/Repair' },
  survey: { name: 'Survey/Assessment' },
  custom: { name: 'Custom' },
};

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

const REQUEST_STATUS = { OPEN: 'Open', IN_PROGRESS: 'InProgress', PENDING_VERIFICATION: 'PendingVerification', COMPLETED: 'Completed', CANCELLED: 'Cancelled', DISPUTED: 'Disputed' };
const BID_STATUS = { PENDING: 'Pending', ACCEPTED: 'Accepted', REJECTED: 'Rejected', WITHDRAWN: 'Withdrawn' };
const ESCROW_STATUS = { FUNDED: 'Funded', WORK_STARTED: 'WorkStarted', WORK_SUBMITTED: 'WorkSubmitted', VERIFIED: 'Verified', RELEASED: 'Released', REFUNDED: 'Refunded', IN_DISPUTE: 'InDispute' };

async function main() {
  console.log(`\n+---------------------------------------------------------------+\n|   UltraLife Work Auction — PREPROD Mesh default (--simulate)  |\n+---------------------------------------------------------------+\n`);
  const args = process.argv.slice(2);
  const getArg = (name) => { const idx = args.indexOf(name); return idx >= 0 ? args[idx + 1] : null; };
  const hasFlag = (name) => args.includes(name);
  if (hasFlag('--help') || args.length === 0) { showHelp(); return; }
  refuseMainnet();
  if (!hasFlag('--simulate')) {
    const { runChain } = await import('./work-auction-chain.mjs');
    await runChain({ args, getArg, hasFlag, CONFIG, log, WORK_TYPES, REQUEST_STATUS, BID_STATUS, ESCROW_STATUS, canTransact, meetsLevelRequirement, refuseMainnet });
    return;
  }
  log.warn('SIMULATE mode: local JSON only. This is NOT an on-chain preprod job.');
  const { atomicWriteSync, safeReadJson, estimateCurrentSlot } = await import('./utils.mjs');
  const deployment = safeReadJson(CONFIG.deploymentPath, {});
  deployment.workAuction = deployment.workAuction || { requests: [], bids: [], escrows: [] };
  const testUsers = deployment.testUsers || [];
  const pnfts = deployment.pnfts || [];
  const userArg = getArg('--user');
  let currentUser = null;
  let currentPnft = null;
  if (userArg) {
    currentUser = testUsers.find(u => u.name.toLowerCase() === userArg.toLowerCase());
    if (currentUser) currentPnft = pnfts.find(p => p.id === currentUser.pnftId);
  }
  if (!currentUser && CONFIG.walletMnemonic) {
    const { BlockfrostProvider, MeshWallet } = await import('@meshsdk/core');
    const provider = new BlockfrostProvider(CONFIG.blockfrostKey);
    const wallet = new MeshWallet({ networkId: CONFIG.network === 'mainnet' ? 1 : 0, fetcher: provider, submitter: provider, key: { type: 'mnemonic', words: CONFIG.walletMnemonic.trim().split(/\s+/) } });
    const walletAddress = wallet.getChangeAddress();
    currentPnft = pnfts.find(p => p.owner === walletAddress);
    if (currentPnft) currentUser = { name: 'Main Wallet', address: walletAddress, pnftId: currentPnft.id };
  }
  if (hasFlag('--list-types')) { listWorkTypes(); return; }
  if (hasFlag('--list-jobs') || hasFlag('--list')) { listJobs(deployment); return; }
  if (hasFlag('--show')) {
    const jobId = getArg('--show') || getArg('--job');
    if (!jobId) { log.error('Please provide a job ID with --show <jobId> or --job <jobId>'); process.exit(1); }
    showJobDetails(deployment, jobId); return;
  }
  if (hasFlag('--list-bids')) { listBids(deployment, getArg('--job')); return; }
  if (!currentPnft) {
    log.error('No pNFT found. You need a pNFT to interact with the work auction.');
    log.info('Mint one first: npm run mint:pnft:basic');
    log.info('Or specify a test user: --user Alice');
    process.exit(1);
  }
  log.info(`Acting as: ${currentUser.name} (${currentPnft.id})`);
  log.info(`Verification level: ${currentPnft.level}`);
  if (!canTransact(currentPnft.level)) {
    log.error(`pNFT ${currentPnft.id} is ${currentPnft.level}. can_transact requires level != Basic.`);
    log.error('Do not fake Standard/DNA. Upgrade via genesis FounderSelfVerify with a real DNA hash (Ryan-signed).');
    process.exit(1);
  }
  const currentSlot = estimateCurrentSlot(CONFIG.network);
  if (hasFlag('--post-job') || hasFlag('--post')) {
    const description = getArg('--desc') || getArg('--description');
    const workType = getArg('--type') || 'services';
    const budgetMin = parseInt(getArg('--budget-min') || getArg('--min') || '10');
    const budgetMax = parseInt(getArg('--budget-max') || getArg('--max') || '100');
    const bidDeadlineDays = parseInt(getArg('--bid-deadline') || '7');
    const workDeadlineDays = parseInt(getArg('--work-deadline') || '30');
    const minLevel = getArg('--min-level') || 'Standard';
    const asset = getArg('--asset') || null;
    const specsHash = getArg('--specs') || null;
    const skillsArg = getArg('--skills');
    const skills = skillsArg ? skillsArg.split(',') : [];
    if (!description) { log.error('Please provide a job description with --desc "description"'); process.exit(1); }
    if (!WORK_TYPES[workType.toLowerCase()]) { log.error(`Unknown work type: ${workType}. Use --list-types to see available types.`); process.exit(1); }
    if (budgetMin <= 0 || budgetMax < budgetMin) { log.error('Invalid budget range. --budget-min must be positive and <= --budget-max'); process.exit(1); }
    const balance = deployment.ultraBalances?.[currentUser.address] || 0;
    if (balance < budgetMax) { log.error(`Insufficient ULTRA balance. Have: ${balance}, Need: ${budgetMax} (max budget)`); process.exit(1); }
    const request = createWorkRequest({ requester: currentPnft.id, requesterAddress: currentUser.address, bioregion: currentPnft.bioregion || 'sierra_nevada', workType: workType.toLowerCase(), description, specsHash, budgetMin, budgetMax, requiredCertifications: skills, minWorkerLevel: minLevel, bidDeadline: currentSlot + (bidDeadlineDays * 24 * 60 * 60), workDeadline: currentSlot + (workDeadlineDays * 24 * 60 * 60), asset, currentSlot });
    deployment.workAuction.requests.push(request);
    atomicWriteSync(CONFIG.deploymentPath, deployment);
    console.log(`\nJOB POSTED ${request.requestId} budget ${budgetMin}-${budgetMax} ULTRA\n`);
    return;
  }
  if (hasFlag('--bid')) {
    const jobId = getArg('--job');
    const bidAmount = parseInt(getArg('--amount') || '0');
    const timelineDays = parseInt(getArg('--timeline') || '14');
    if (!jobId) { log.error('Please provide a job ID with --job <jobId>'); process.exit(1); }
    const request = deployment.workAuction.requests.find(r => r.requestId === jobId);
    if (!request) { log.error(`Job not found: ${jobId}`); process.exit(1); }
    if (request.status !== REQUEST_STATUS.OPEN) { log.error(`Job is not open for bidding. Status: ${request.status}`); process.exit(1); }
    if (currentSlot > request.bidDeadline) { log.error('Bid deadline has passed for this job.'); process.exit(1); }
    if (request.requester === currentPnft.id) { log.error('You cannot bid on your own job.'); process.exit(1); }
    if (bidAmount < request.budgetMin || bidAmount > request.budgetMax) { log.error(`Bid amount must be between ${request.budgetMin} and ${request.budgetMax} ULTRA`); process.exit(1); }
    if (!meetsLevelRequirement(currentPnft.level, request.minWorkerLevel || 'Standard')) { log.error(`Your verification level (${currentPnft.level}) does not meet the minimum requirement (${request.minWorkerLevel})`); process.exit(1); }
    const bid = createBid({ requestId: jobId, bidder: currentPnft.id, bidderAddress: currentUser.address, bidAmount, proposedCompletion: currentSlot + (timelineDays * 24 * 60 * 60), methodsHash: getArg('--methods') || null, note: getArg('--note') || '', currentSlot });
    deployment.workAuction.bids.push(bid);
    atomicWriteSync(CONFIG.deploymentPath, deployment);
    console.log(`BID PLACED ${bid.bidId} amount ${bidAmount}`);
    return;
  }
  showHelp();
}

function showHelp() {
  console.log(`Usage: node work-auction.mjs [command] [options]\n  --simulate local JSON only. --unsigned Mesh CBOR; Ryan signs. No fake DNA. No mainnet.`);
}
function listWorkTypes() { for (const [code, info] of Object.entries(WORK_TYPES)) console.log(code, info.name); }
function listJobs(deployment) {
  const requests = deployment.workAuction?.requests || [];
  const openJobs = requests.filter(r => r.status === REQUEST_STATUS.OPEN);
  console.log(`OPEN JOBS (${openJobs.length})`);
  for (const req of openJobs) console.log(req.requestId, req.description, req.budgetMin, req.budgetMax);
}
function showJobDetails(deployment, jobId) {
  const request = deployment.workAuction?.requests?.find(r => r.requestId === jobId);
  if (!request) { log.error(`Job not found: ${jobId}`); return; }
  console.log(JSON.stringify(request, null, 2));
}
function listBids(deployment, jobId) {
  let bids = deployment.workAuction?.bids || [];
  if (jobId) bids = bids.filter(b => b.requestId === jobId);
  for (const bid of bids) console.log(bid.bidId, bid.bidAmount, bid.status);
}
function createWorkRequest(params) {
  return { requestId: `job_${crypto.randomBytes(8).toString('hex')}`, requester: params.requester, requesterAddress: params.requesterAddress, asset: params.asset, bioregion: params.bioregion, workType: params.workType, description: params.description, specificationsHash: params.specsHash, expectedImpacts: [], budgetMin: params.budgetMin, budgetMax: params.budgetMax, requiredCertifications: params.requiredCertifications, minWorkerLevel: params.minWorkerLevel, bidDeadline: params.bidDeadline, workDeadline: params.workDeadline, createdAt: new Date().toISOString(), createdSlot: params.currentSlot, status: REQUEST_STATUS.OPEN, acceptedBid: null, worker: null, mode: 'simulate' };
}
function createBid(params) {
  return { bidId: `bid_${crypto.randomBytes(8).toString('hex')}`, requestId: params.requestId, bidder: params.bidder, bidderAddress: params.bidderAddress, bidAmount: params.bidAmount, estimatedImpacts: [], certifications: [], efficiencyRatings: [], proposedCompletion: params.proposedCompletion, methodsHash: params.methodsHash, note: params.note, submittedAt: new Date().toISOString(), submittedSlot: params.currentSlot, status: BID_STATUS.PENDING, mode: 'simulate' };
}
function createEscrow(params) {
  return { escrowId: `escrow_${crypto.randomBytes(8).toString('hex')}`, requestId: params.request.requestId, bidId: params.bid.bidId, requester: params.request.requester, worker: params.bid.bidder, asset: params.request.asset, workType: params.request.workType, amount: params.bid.bidAmount, expectedImpacts: params.bid.estimatedImpacts, deadline: params.request.workDeadline, status: ESCROW_STATUS.FUNDED, createdAt: new Date().toISOString(), createdSlot: params.currentSlot, mode: 'simulate' };
}
main().catch(error => { log.error(error.message); console.error(error); process.exit(1); });
