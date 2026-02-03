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

// Work types from the Aiken validator
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

// Verification levels
const VERIFICATION_LEVELS = ['Basic', 'Standard', 'Verified', 'Steward'];

// Request statuses
const REQUEST_STATUS = {
  OPEN: 'Open',
  IN_PROGRESS: 'InProgress',
  PENDING_VERIFICATION: 'PendingVerification',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  DISPUTED: 'Disputed',
};

// Bid statuses
const BID_STATUS = {
  PENDING: 'Pending',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

// Escrow statuses
const ESCROW_STATUS = {
  FUNDED: 'Funded',
  WORK_STARTED: 'WorkStarted',
  WORK_SUBMITTED: 'WorkSubmitted',
  VERIFIED: 'Verified',
  RELEASED: 'Released',
  REFUNDED: 'Refunded',
  IN_DISPUTE: 'InDispute',
};

async function main() {
  console.log(`
+---------------------------------------------------------------+
|         UltraLife Protocol - Work Auction Marketplace         |
+---------------------------------------------------------------+
`);

  const args = process.argv.slice(2);

  // Parse arguments
  const getArg = (name) => {
    const idx = args.indexOf(name);
    return idx >= 0 ? args[idx + 1] : null;
  };
  const hasFlag = (name) => args.includes(name);

  // Show help
  if (hasFlag('--help') || args.length === 0) {
    showHelp();
    return;
  }

  const { atomicWriteSync, safeReadJson, estimateCurrentSlot } = await import('./utils.mjs');

  // Load deployment
  const deployment = safeReadJson(CONFIG.deploymentPath, {});
  deployment.workAuction = deployment.workAuction || {
    requests: [],
    bids: [],
    escrows: [],
  };

  const testUsers = deployment.testUsers || [];
  const pnfts = deployment.pnfts || [];

  // Get current user
  const userArg = getArg('--user');
  let currentUser = null;
  let currentPnft = null;

  if (userArg) {
    currentUser = testUsers.find(u => u.name.toLowerCase() === userArg.toLowerCase());
    if (currentUser) {
      currentPnft = pnfts.find(p => p.id === currentUser.pnftId);
    }
  }

  // If no user specified, use the main wallet
  if (!currentUser && CONFIG.walletMnemonic) {
    const { BlockfrostProvider, MeshWallet } = await import('@meshsdk/core');
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
    const walletAddress = wallet.getChangeAddress();
    currentPnft = pnfts.find(p => p.owner === walletAddress);
    if (currentPnft) {
      currentUser = { name: 'Main Wallet', address: walletAddress, pnftId: currentPnft.id };
    }
  }

  // Command: List work types
  if (hasFlag('--list-types')) {
    listWorkTypes();
    return;
  }

  // Command: List jobs
  if (hasFlag('--list-jobs') || hasFlag('--list')) {
    listJobs(deployment);
    return;
  }

  // Command: Show job details
  if (hasFlag('--show')) {
    const jobId = getArg('--show') || getArg('--job');
    if (!jobId) {
      log.error('Please provide a job ID with --show <jobId> or --job <jobId>');
      process.exit(1);
    }
    showJobDetails(deployment, jobId);
    return;
  }

  // Command: List bids
  if (hasFlag('--list-bids')) {
    const jobId = getArg('--job');
    listBids(deployment, jobId);
    return;
  }

  // Commands requiring a pNFT
  if (!currentPnft) {
    log.error('No pNFT found. You need a pNFT to interact with the work auction.');
    log.info('Mint one first: npm run mint:pnft:basic');
    log.info('Or specify a test user: --user Alice');
    process.exit(1);
  }

  log.info(`Acting as: ${currentUser.name} (${currentPnft.id})`);
  log.info(`Verification level: ${currentPnft.level}`);

  const currentSlot = estimateCurrentSlot(CONFIG.network);

  // Command: Post a new job
  if (hasFlag('--post-job') || hasFlag('--post')) {
    const description = getArg('--desc') || getArg('--description');
    const workType = getArg('--type') || 'services';
    const budgetMin = parseInt(getArg('--budget-min') || getArg('--min') || '10');
    const budgetMax = parseInt(getArg('--budget-max') || getArg('--max') || '100');
    const bidDeadlineDays = parseInt(getArg('--bid-deadline') || '7');
    const workDeadlineDays = parseInt(getArg('--work-deadline') || '30');
    const minLevel = getArg('--min-level') || 'Basic';
    const asset = getArg('--asset') || null;
    const specsHash = getArg('--specs') || null;
    const skillsArg = getArg('--skills');
    const skills = skillsArg ? skillsArg.split(',') : [];

    if (!description) {
      log.error('Please provide a job description with --desc "description"');
      process.exit(1);
    }

    if (!WORK_TYPES[workType.toLowerCase()]) {
      log.error(`Unknown work type: ${workType}. Use --list-types to see available types.`);
      process.exit(1);
    }

    if (budgetMin <= 0 || budgetMax < budgetMin) {
      log.error('Invalid budget range. --budget-min must be positive and <= --budget-max');
      process.exit(1);
    }

    // Check ULTRA balance
    const balance = deployment.ultraBalances?.[currentUser.address] || 0;
    if (balance < budgetMax) {
      log.error(`Insufficient ULTRA balance. Have: ${balance}, Need: ${budgetMax} (max budget)`);
      process.exit(1);
    }

    const request = createWorkRequest({
      requester: currentPnft.id,
      requesterAddress: currentUser.address,
      bioregion: currentPnft.bioregion || 'sierra_nevada',
      workType: workType.toLowerCase(),
      description,
      specsHash,
      budgetMin,
      budgetMax,
      requiredCertifications: skills,
      minWorkerLevel: minLevel,
      bidDeadline: currentSlot + (bidDeadlineDays * 24 * 60 * 60),
      workDeadline: currentSlot + (workDeadlineDays * 24 * 60 * 60),
      asset,
      currentSlot,
    });

    deployment.workAuction.requests.push(request);
    atomicWriteSync(CONFIG.deploymentPath, deployment);

    console.log(`
+---------------------------------------------------------------+
|                     JOB POSTED SUCCESSFULLY                   |
+---------------------------------------------------------------+
  Job ID:        ${request.requestId}
  Type:          ${WORK_TYPES[workType.toLowerCase()].name}
  Description:   ${description.slice(0, 50)}${description.length > 50 ? '...' : ''}
  Budget:        ${budgetMin} - ${budgetMax} ULTRA
  Bid Deadline:  ${bidDeadlineDays} days
  Work Deadline: ${workDeadlineDays} days
  Min Level:     ${minLevel}
  Skills:        ${skills.length > 0 ? skills.join(', ') : 'None specified'}

  Workers can now bid on this job!
  View bids: node work-auction.mjs --list-bids --job ${request.requestId}
+---------------------------------------------------------------+
`);
    return;
  }

  // Command: Place a bid
  if (hasFlag('--bid')) {
    const jobId = getArg('--job');
    const bidAmount = parseInt(getArg('--amount') || '0');
    const timelineDays = parseInt(getArg('--timeline') || '14');
    const methodsHash = getArg('--methods') || null;
    const note = getArg('--note') || '';

    if (!jobId) {
      log.error('Please provide a job ID with --job <jobId>');
      process.exit(1);
    }

    const request = deployment.workAuction.requests.find(r => r.requestId === jobId);
    if (!request) {
      log.error(`Job not found: ${jobId}`);
      process.exit(1);
    }

    if (request.status !== REQUEST_STATUS.OPEN) {
      log.error(`Job is not open for bidding. Status: ${request.status}`);
      process.exit(1);
    }

    if (currentSlot > request.bidDeadline) {
      log.error('Bid deadline has passed for this job.');
      process.exit(1);
    }

    if (request.requester === currentPnft.id) {
      log.error('You cannot bid on your own job.');
      process.exit(1);
    }

    if (bidAmount < request.budgetMin || bidAmount > request.budgetMax) {
      log.error(`Bid amount must be between ${request.budgetMin} and ${request.budgetMax} ULTRA`);
      process.exit(1);
    }

    // Check verification level
    const requiredLevelIdx = VERIFICATION_LEVELS.indexOf(request.minWorkerLevel);
    const actualLevelIdx = VERIFICATION_LEVELS.indexOf(currentPnft.level);
    if (actualLevelIdx < requiredLevelIdx) {
      log.error(`Your verification level (${currentPnft.level}) does not meet the minimum requirement (${request.minWorkerLevel})`);
      process.exit(1);
    }

    const bid = createBid({
      requestId: jobId,
      bidder: currentPnft.id,
      bidderAddress: currentUser.address,
      bidAmount,
      proposedCompletion: currentSlot + (timelineDays * 24 * 60 * 60),
      methodsHash,
      note,
      currentSlot,
    });

    deployment.workAuction.bids.push(bid);
    atomicWriteSync(CONFIG.deploymentPath, deployment);

    console.log(`
+---------------------------------------------------------------+
|                     BID PLACED SUCCESSFULLY                   |
+---------------------------------------------------------------+
  Bid ID:      ${bid.bidId}
  Job:         ${request.description.slice(0, 40)}...
  Amount:      ${bidAmount} ULTRA
  Timeline:    ${timelineDays} days
  Status:      ${bid.status}

  Waiting for job poster to accept or reject.
+---------------------------------------------------------------+
`);
    return;
  }

  // Command: Accept a bid
  if (hasFlag('--accept-bid') || hasFlag('--accept')) {
    const bidId = getArg('--bid');
    if (!bidId) {
      log.error('Please provide a bid ID with --bid <bidId>');
      process.exit(1);
    }

    const bid = deployment.workAuction.bids.find(b => b.bidId === bidId);
    if (!bid) {
      log.error(`Bid not found: ${bidId}`);
      process.exit(1);
    }

    const request = deployment.workAuction.requests.find(r => r.requestId === bid.requestId);
    if (!request) {
      log.error(`Job not found for bid: ${bid.requestId}`);
      process.exit(1);
    }

    if (request.requester !== currentPnft.id) {
      log.error('Only the job poster can accept bids.');
      process.exit(1);
    }

    if (request.status !== REQUEST_STATUS.OPEN) {
      log.error(`Job is not open. Status: ${request.status}`);
      process.exit(1);
    }

    if (bid.status !== BID_STATUS.PENDING) {
      log.error(`Bid is not pending. Status: ${bid.status}`);
      process.exit(1);
    }

    // Check balance for escrow
    const balance = deployment.ultraBalances?.[currentUser.address] || 0;
    if (balance < bid.bidAmount) {
      log.error(`Insufficient ULTRA balance for escrow. Have: ${balance}, Need: ${bid.bidAmount}`);
      process.exit(1);
    }

    // Create escrow
    const escrow = createEscrow({
      request,
      bid,
      currentSlot,
    });

    // Update statuses
    bid.status = BID_STATUS.ACCEPTED;
    request.status = REQUEST_STATUS.IN_PROGRESS;
    request.acceptedBid = bidId;
    request.worker = bid.bidder;

    // Lock funds in escrow (deduct from requester)
    deployment.ultraBalances[currentUser.address] = balance - bid.bidAmount;

    // Reject other pending bids for this job
    deployment.workAuction.bids
      .filter(b => b.requestId === request.requestId && b.bidId !== bidId && b.status === BID_STATUS.PENDING)
      .forEach(b => {
        b.status = BID_STATUS.REJECTED;
        b.rejectedReason = 'Another bid was accepted';
      });

    deployment.workAuction.escrows.push(escrow);
    atomicWriteSync(CONFIG.deploymentPath, deployment);

    const bidderPnft = pnfts.find(p => p.id === bid.bidder);

    console.log(`
+---------------------------------------------------------------+
|                     BID ACCEPTED - ESCROW CREATED             |
+---------------------------------------------------------------+
  Escrow ID:   ${escrow.escrowId}
  Job:         ${request.description.slice(0, 40)}...
  Worker:      ${bid.bidder}
  Amount:      ${bid.bidAmount} ULTRA (locked in escrow)
  Deadline:    ${new Date(request.workDeadline * 1000 + 1654041600000).toISOString().split('T')[0]}

  The worker can now start the job.
  Your new balance: ${deployment.ultraBalances[currentUser.address]} ULTRA
+---------------------------------------------------------------+
`);
    return;
  }

  // Command: Start work
  if (hasFlag('--start')) {
    const jobId = getArg('--job');
    if (!jobId) {
      log.error('Please provide a job ID with --job <jobId>');
      process.exit(1);
    }

    const request = deployment.workAuction.requests.find(r => r.requestId === jobId);
    if (!request) {
      log.error(`Job not found: ${jobId}`);
      process.exit(1);
    }

    if (request.worker !== currentPnft.id) {
      log.error('Only the assigned worker can start the work.');
      process.exit(1);
    }

    const escrow = deployment.workAuction.escrows.find(e => e.requestId === jobId);
    if (!escrow || escrow.status !== ESCROW_STATUS.FUNDED) {
      log.error('Escrow not found or not in funded state.');
      process.exit(1);
    }

    escrow.status = ESCROW_STATUS.WORK_STARTED;
    escrow.startTime = currentSlot;

    atomicWriteSync(CONFIG.deploymentPath, deployment);

    console.log(`
+---------------------------------------------------------------+
|                       WORK STARTED                            |
+---------------------------------------------------------------+
  Job:         ${request.description.slice(0, 40)}...
  Escrow:      ${escrow.escrowId}
  Started:     ${new Date().toISOString()}
  Deadline:    ${new Date(request.workDeadline * 1000 + 1654041600000).toISOString().split('T')[0]}

  Complete the work and submit evidence when done.
  Command: node work-auction.mjs --complete --job ${jobId} --evidence <ipfsHash>
+---------------------------------------------------------------+
`);
    return;
  }

  // Command: Complete work (submit evidence)
  if (hasFlag('--complete')) {
    const jobId = getArg('--job');
    const evidenceHash = getArg('--evidence') || crypto.randomBytes(32).toString('hex');
    const impactNote = getArg('--impact') || '';

    if (!jobId) {
      log.error('Please provide a job ID with --job <jobId>');
      process.exit(1);
    }

    const request = deployment.workAuction.requests.find(r => r.requestId === jobId);
    if (!request) {
      log.error(`Job not found: ${jobId}`);
      process.exit(1);
    }

    if (request.worker !== currentPnft.id) {
      log.error('Only the assigned worker can submit completion.');
      process.exit(1);
    }

    const escrow = deployment.workAuction.escrows.find(e => e.requestId === jobId);
    if (!escrow) {
      log.error('Escrow not found for this job.');
      process.exit(1);
    }

    if (escrow.status !== ESCROW_STATUS.WORK_STARTED && escrow.status !== ESCROW_STATUS.FUNDED) {
      log.error(`Cannot submit completion. Escrow status: ${escrow.status}`);
      process.exit(1);
    }

    escrow.status = ESCROW_STATUS.WORK_SUBMITTED;
    escrow.submissionTime = currentSlot;
    escrow.evidenceHash = evidenceHash;
    escrow.impactNote = impactNote;

    request.status = REQUEST_STATUS.PENDING_VERIFICATION;
    request.evidenceHash = evidenceHash;

    atomicWriteSync(CONFIG.deploymentPath, deployment);

    console.log(`
+---------------------------------------------------------------+
|                    WORK SUBMITTED FOR REVIEW                  |
+---------------------------------------------------------------+
  Job:         ${request.description.slice(0, 40)}...
  Evidence:    ${evidenceHash.slice(0, 20)}...
  Status:      Pending Verification

  Waiting for job poster to confirm completion.
  The poster should run: node work-auction.mjs --confirm --job ${jobId}
+---------------------------------------------------------------+
`);
    return;
  }

  // Command: Confirm completion (release payment)
  if (hasFlag('--confirm')) {
    const jobId = getArg('--job');
    if (!jobId) {
      log.error('Please provide a job ID with --job <jobId>');
      process.exit(1);
    }

    const request = deployment.workAuction.requests.find(r => r.requestId === jobId);
    if (!request) {
      log.error(`Job not found: ${jobId}`);
      process.exit(1);
    }

    if (request.requester !== currentPnft.id) {
      log.error('Only the job poster can confirm completion.');
      process.exit(1);
    }

    if (request.status !== REQUEST_STATUS.PENDING_VERIFICATION) {
      log.error(`Job is not pending verification. Status: ${request.status}`);
      process.exit(1);
    }

    const escrow = deployment.workAuction.escrows.find(e => e.requestId === jobId);
    if (!escrow || escrow.status !== ESCROW_STATUS.WORK_SUBMITTED) {
      log.error('Escrow not found or work not submitted.');
      process.exit(1);
    }

    // Calculate fee (1% platform fee)
    const platformFeeBps = 100; // 1%
    const fee = Math.floor(escrow.amount * platformFeeBps / 10000);
    const workerPayment = escrow.amount - fee;

    // Release payment to worker
    const bid = deployment.workAuction.bids.find(b => b.bidId === escrow.bidId);
    const workerAddress = bid.bidderAddress;

    deployment.ultraBalances[workerAddress] = (deployment.ultraBalances[workerAddress] || 0) + workerPayment;

    // Update statuses
    escrow.status = ESCROW_STATUS.RELEASED;
    escrow.releaseTime = currentSlot;
    escrow.workerPayment = workerPayment;
    escrow.platformFee = fee;

    request.status = REQUEST_STATUS.COMPLETED;
    request.completedAt = currentSlot;

    atomicWriteSync(CONFIG.deploymentPath, deployment);

    console.log(`
+---------------------------------------------------------------+
|                  WORK CONFIRMED - PAYMENT RELEASED            |
+---------------------------------------------------------------+
  Job:           ${request.description.slice(0, 40)}...
  Worker:        ${request.worker}
  Total Amount:  ${escrow.amount} ULTRA
  Platform Fee:  ${fee} ULTRA (${platformFeeBps / 100}%)
  Worker Paid:   ${workerPayment} ULTRA

  Worker's new balance: ${deployment.ultraBalances[workerAddress]} ULTRA

  Job completed successfully!
+---------------------------------------------------------------+
`);
    return;
  }

  // Command: Dispute work
  if (hasFlag('--dispute')) {
    const jobId = getArg('--job');
    const reason = getArg('--reason') || 'Work quality dispute';

    if (!jobId) {
      log.error('Please provide a job ID with --job <jobId>');
      process.exit(1);
    }

    const request = deployment.workAuction.requests.find(r => r.requestId === jobId);
    if (!request) {
      log.error(`Job not found: ${jobId}`);
      process.exit(1);
    }

    // Either party can dispute
    if (request.requester !== currentPnft.id && request.worker !== currentPnft.id) {
      log.error('Only the job poster or worker can initiate a dispute.');
      process.exit(1);
    }

    const escrow = deployment.workAuction.escrows.find(e => e.requestId === jobId);
    if (!escrow) {
      log.error('Escrow not found for this job.');
      process.exit(1);
    }

    if (escrow.status === ESCROW_STATUS.RELEASED || escrow.status === ESCROW_STATUS.REFUNDED) {
      log.error('Cannot dispute - payment already released or refunded.');
      process.exit(1);
    }

    const disputeId = `dispute_${crypto.randomBytes(8).toString('hex')}`;

    escrow.status = ESCROW_STATUS.IN_DISPUTE;
    escrow.disputeId = disputeId;
    escrow.disputeReason = reason;
    escrow.disputeInitiator = currentPnft.id;
    escrow.disputeTime = currentSlot;

    request.status = REQUEST_STATUS.DISPUTED;
    request.disputeId = disputeId;

    atomicWriteSync(CONFIG.deploymentPath, deployment);

    console.log(`
+---------------------------------------------------------------+
|                      DISPUTE INITIATED                        |
+---------------------------------------------------------------+
  Dispute ID:  ${disputeId}
  Job:         ${request.description.slice(0, 40)}...
  Reason:      ${reason}
  Initiated:   ${currentPnft.id}

  The dispute will be resolved by governance.
  Escrow funds (${escrow.amount} ULTRA) are held until resolution.
+---------------------------------------------------------------+
`);
    return;
  }

  // Command: Cancel job
  if (hasFlag('--cancel')) {
    const jobId = getArg('--job');
    const reason = getArg('--reason') || 'Cancelled by requester';

    if (!jobId) {
      log.error('Please provide a job ID with --job <jobId>');
      process.exit(1);
    }

    const request = deployment.workAuction.requests.find(r => r.requestId === jobId);
    if (!request) {
      log.error(`Job not found: ${jobId}`);
      process.exit(1);
    }

    if (request.requester !== currentPnft.id) {
      log.error('Only the job poster can cancel the job.');
      process.exit(1);
    }

    if (request.status !== REQUEST_STATUS.OPEN) {
      log.error('Can only cancel jobs that are still open for bidding.');
      process.exit(1);
    }

    request.status = REQUEST_STATUS.CANCELLED;
    request.cancelledReason = reason;
    request.cancelledAt = currentSlot;

    // Reject all pending bids
    deployment.workAuction.bids
      .filter(b => b.requestId === jobId && b.status === BID_STATUS.PENDING)
      .forEach(b => {
        b.status = BID_STATUS.REJECTED;
        b.rejectedReason = 'Job cancelled';
      });

    atomicWriteSync(CONFIG.deploymentPath, deployment);

    console.log(`
+---------------------------------------------------------------+
|                       JOB CANCELLED                           |
+---------------------------------------------------------------+
  Job ID:      ${jobId}
  Reason:      ${reason}

  All pending bids have been rejected.
+---------------------------------------------------------------+
`);
    return;
  }

  // Command: Withdraw bid
  if (hasFlag('--withdraw')) {
    const bidId = getArg('--bid');
    if (!bidId) {
      log.error('Please provide a bid ID with --bid <bidId>');
      process.exit(1);
    }

    const bid = deployment.workAuction.bids.find(b => b.bidId === bidId);
    if (!bid) {
      log.error(`Bid not found: ${bidId}`);
      process.exit(1);
    }

    if (bid.bidder !== currentPnft.id) {
      log.error('Only the bidder can withdraw their bid.');
      process.exit(1);
    }

    if (bid.status !== BID_STATUS.PENDING) {
      log.error(`Cannot withdraw bid. Status: ${bid.status}`);
      process.exit(1);
    }

    bid.status = BID_STATUS.WITHDRAWN;
    bid.withdrawnAt = currentSlot;

    atomicWriteSync(CONFIG.deploymentPath, deployment);

    console.log(`
+---------------------------------------------------------------+
|                      BID WITHDRAWN                            |
+---------------------------------------------------------------+
  Bid ID:      ${bidId}
  Status:      Withdrawn
+---------------------------------------------------------------+
`);
    return;
  }

  // Command: My jobs
  if (hasFlag('--my-jobs')) {
    const myRequests = deployment.workAuction.requests.filter(r => r.requester === currentPnft.id);
    const myWorking = deployment.workAuction.requests.filter(r => r.worker === currentPnft.id);

    console.log(`
+---------------------------------------------------------------+
|                        MY JOBS                                |
+---------------------------------------------------------------+

Jobs I Posted (${myRequests.length}):
`);

    if (myRequests.length === 0) {
      console.log('  No jobs posted yet.');
    } else {
      for (const req of myRequests) {
        const bidCount = deployment.workAuction.bids.filter(b => b.requestId === req.requestId).length;
        console.log(`  ${req.requestId}`);
        console.log(`    ${req.description.slice(0, 50)}${req.description.length > 50 ? '...' : ''}`);
        console.log(`    Status: ${req.status} | Budget: ${req.budgetMin}-${req.budgetMax} ULTRA | Bids: ${bidCount}`);
        console.log('');
      }
    }

    console.log(`
Jobs I'm Working On (${myWorking.length}):
`);

    if (myWorking.length === 0) {
      console.log('  No jobs assigned yet.');
    } else {
      for (const req of myWorking) {
        const escrow = deployment.workAuction.escrows.find(e => e.requestId === req.requestId);
        console.log(`  ${req.requestId}`);
        console.log(`    ${req.description.slice(0, 50)}${req.description.length > 50 ? '...' : ''}`);
        console.log(`    Status: ${req.status} | Escrow: ${escrow?.status || 'N/A'} | Amount: ${escrow?.amount || 'N/A'} ULTRA`);
        console.log('');
      }
    }

    console.log('+---------------------------------------------------------------+');
    return;
  }

  // Default: show help
  showHelp();
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function showHelp() {
  console.log(`
Usage: node work-auction.mjs [command] [options]

Commands:
  --post-job              Post a new job
    --desc <description>  Job description (required)
    --type <type>         Work type (default: services)
    --budget-min <n>      Minimum budget in ULTRA (default: 10)
    --budget-max <n>      Maximum budget in ULTRA (default: 100)
    --bid-deadline <n>    Days until bid deadline (default: 7)
    --work-deadline <n>   Days until work deadline (default: 30)
    --min-level <level>   Minimum worker level (default: Basic)
    --skills <list>       Comma-separated required skills

  --list-jobs             List all open jobs
  --list-types            List available work types
  --show --job <id>       Show job details
  --list-bids --job <id>  List bids for a job

  --bid --job <id>        Place a bid on a job
    --amount <n>          Bid amount in ULTRA (required)
    --timeline <n>        Days to complete (default: 14)
    --note <text>         Additional note

  --accept-bid --bid <id> Accept a bid (job poster only)
  --start --job <id>      Start working on a job (worker only)
  --complete --job <id>   Submit completed work (worker only)
    --evidence <hash>     Evidence hash (IPFS)
  --confirm --job <id>    Confirm completion, release payment (poster only)
  --dispute --job <id>    Initiate a dispute
    --reason <text>       Dispute reason

  --cancel --job <id>     Cancel a job (only if still open)
  --withdraw --bid <id>   Withdraw a pending bid
  --my-jobs               Show my posted and assigned jobs

Options:
  --user <name>           Act as a test user (e.g., Alice)
  --help                  Show this help

Examples:
  # Post a job for fence repair
  node work-auction.mjs --post-job --desc "Repair 100m of fence" --type maintenance --min 50 --max 100

  # List open jobs
  node work-auction.mjs --list-jobs

  # Bid on a job
  node work-auction.mjs --bid --job job_abc123 --amount 75 --timeline 7 --user Alice

  # Accept a bid
  node work-auction.mjs --accept-bid --bid bid_xyz789

  # Complete work and get paid
  node work-auction.mjs --complete --job job_abc123 --evidence QmHash --user Alice
  node work-auction.mjs --confirm --job job_abc123
`);
}

function listWorkTypes() {
  console.log(`
+---------------------------------------------------------------+
|                     AVAILABLE WORK TYPES                      |
+---------------------------------------------------------------+

  TYPE           DESCRIPTION
  -----------    ---------------------------------------------`);

  for (const [code, info] of Object.entries(WORK_TYPES)) {
    console.log(`  ${code.padEnd(13)} ${info.name}`);
    if (info.phases) {
      console.log(`               Phases: ${info.phases.join(', ')}`);
    }
    if (info.activities) {
      console.log(`               Activities: ${info.activities.join(', ')}`);
    }
  }

  console.log(`
+---------------------------------------------------------------+
`);
}

function listJobs(deployment) {
  const requests = deployment.workAuction?.requests || [];
  const openJobs = requests.filter(r => r.status === REQUEST_STATUS.OPEN);

  console.log(`
+---------------------------------------------------------------+
|                      OPEN JOBS (${openJobs.length})                           |
+---------------------------------------------------------------+
`);

  if (openJobs.length === 0) {
    console.log('  No open jobs at the moment.');
    console.log('  Post one: node work-auction.mjs --post-job --desc "Your job" --max 100');
  } else {
    for (const req of openJobs) {
      const bidCount = (deployment.workAuction.bids || [])
        .filter(b => b.requestId === req.requestId && b.status === BID_STATUS.PENDING).length;

      console.log(`  JOB: ${req.requestId}`);
      console.log(`  Type: ${WORK_TYPES[req.workType]?.name || req.workType}`);
      console.log(`  Description: ${req.description}`);
      console.log(`  Budget: ${req.budgetMin} - ${req.budgetMax} ULTRA`);
      console.log(`  Min Level: ${req.minWorkerLevel} | Bioregion: ${req.bioregion}`);
      console.log(`  Bids: ${bidCount} | Posted by: ${req.requester.slice(0, 20)}...`);
      if (req.requiredCertifications?.length > 0) {
        console.log(`  Skills: ${req.requiredCertifications.join(', ')}`);
      }
      console.log('  ---');
    }
  }

  console.log(`
  Total jobs: ${requests.length} | Open: ${openJobs.length} | In Progress: ${requests.filter(r => r.status === REQUEST_STATUS.IN_PROGRESS).length}
+---------------------------------------------------------------+
`);
}

function showJobDetails(deployment, jobId) {
  const request = deployment.workAuction?.requests?.find(r => r.requestId === jobId);

  if (!request) {
    log.error(`Job not found: ${jobId}`);
    return;
  }

  const bids = (deployment.workAuction?.bids || []).filter(b => b.requestId === jobId);
  const escrow = deployment.workAuction?.escrows?.find(e => e.requestId === jobId);

  console.log(`
+---------------------------------------------------------------+
|                        JOB DETAILS                            |
+---------------------------------------------------------------+

  Job ID:        ${request.requestId}
  Status:        ${request.status}
  Type:          ${WORK_TYPES[request.workType]?.name || request.workType}
  Description:   ${request.description}

  Budget:        ${request.budgetMin} - ${request.budgetMax} ULTRA
  Min Level:     ${request.minWorkerLevel}
  Bioregion:     ${request.bioregion}

  Requester:     ${request.requester}
  Worker:        ${request.worker || 'Not assigned'}

  Created:       ${request.createdAt}
  Bid Deadline:  Slot ${request.bidDeadline}
  Work Deadline: Slot ${request.workDeadline}
`);

  if (request.requiredCertifications?.length > 0) {
    console.log(`  Skills:        ${request.requiredCertifications.join(', ')}`);
  }

  if (bids.length > 0) {
    console.log(`
  BIDS (${bids.length}):
  ---`);
    for (const bid of bids) {
      console.log(`    ${bid.bidId}`);
      console.log(`      Bidder: ${bid.bidder}`);
      console.log(`      Amount: ${bid.bidAmount} ULTRA | Status: ${bid.status}`);
      if (bid.note) {
        console.log(`      Note: ${bid.note}`);
      }
    }
  }

  if (escrow) {
    console.log(`
  ESCROW:
  ---
    ID:          ${escrow.escrowId}
    Amount:      ${escrow.amount} ULTRA
    Status:      ${escrow.status}
    ${escrow.evidenceHash ? `Evidence:    ${escrow.evidenceHash.slice(0, 30)}...` : ''}
`);
  }

  console.log('+---------------------------------------------------------------+');
}

function listBids(deployment, jobId) {
  let bids = deployment.workAuction?.bids || [];

  if (jobId) {
    bids = bids.filter(b => b.requestId === jobId);
    console.log(`
+---------------------------------------------------------------+
|                  BIDS FOR JOB ${jobId.slice(0, 20)}            |
+---------------------------------------------------------------+
`);
  } else {
    console.log(`
+---------------------------------------------------------------+
|                        ALL BIDS                               |
+---------------------------------------------------------------+
`);
  }

  if (bids.length === 0) {
    console.log('  No bids found.');
  } else {
    for (const bid of bids) {
      console.log(`  BID: ${bid.bidId}`);
      console.log(`  Job: ${bid.requestId}`);
      console.log(`  Bidder: ${bid.bidder}`);
      console.log(`  Amount: ${bid.bidAmount} ULTRA | Status: ${bid.status}`);
      console.log(`  Timeline: ${bid.proposedCompletion ? `Slot ${bid.proposedCompletion}` : 'Not specified'}`);
      if (bid.note) {
        console.log(`  Note: ${bid.note}`);
      }
      console.log('  ---');
    }
  }

  console.log(`
+---------------------------------------------------------------+
`);
}

function createWorkRequest(params) {
  const requestId = `job_${crypto.randomBytes(8).toString('hex')}`;

  return {
    requestId,
    requester: params.requester,
    requesterAddress: params.requesterAddress,
    asset: params.asset,
    bioregion: params.bioregion,
    workType: params.workType,
    description: params.description,
    specificationsHash: params.specsHash,
    expectedImpacts: [],
    budgetMin: params.budgetMin,
    budgetMax: params.budgetMax,
    requiredCertifications: params.requiredCertifications,
    minWorkerLevel: params.minWorkerLevel,
    bidDeadline: params.bidDeadline,
    workDeadline: params.workDeadline,
    createdAt: new Date().toISOString(),
    createdSlot: params.currentSlot,
    status: REQUEST_STATUS.OPEN,
    acceptedBid: null,
    worker: null,
    testnetSimulated: true,
  };
}

function createBid(params) {
  const bidId = `bid_${crypto.randomBytes(8).toString('hex')}`;

  return {
    bidId,
    requestId: params.requestId,
    bidder: params.bidder,
    bidderAddress: params.bidderAddress,
    bidAmount: params.bidAmount,
    estimatedImpacts: [],
    certifications: [],
    efficiencyRatings: [],
    proposedCompletion: params.proposedCompletion,
    methodsHash: params.methodsHash,
    note: params.note,
    submittedAt: new Date().toISOString(),
    submittedSlot: params.currentSlot,
    status: BID_STATUS.PENDING,
    testnetSimulated: true,
  };
}

function createEscrow(params) {
  const escrowId = `escrow_${crypto.randomBytes(8).toString('hex')}`;

  return {
    escrowId,
    requestId: params.request.requestId,
    bidId: params.bid.bidId,
    requester: params.request.requester,
    worker: params.bid.bidder,
    asset: params.request.asset,
    workType: params.request.workType,
    amount: params.bid.bidAmount,
    expectedImpacts: params.bid.estimatedImpacts,
    deadline: params.request.workDeadline,
    status: ESCROW_STATUS.FUNDED,
    createdAt: new Date().toISOString(),
    createdSlot: params.currentSlot,
    testnetSimulated: true,
  };
}

main().catch(error => {
  log.error(error.message);
  console.error(error);
  process.exit(1);
});
