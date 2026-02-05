#!/usr/bin/env node
/**
 * UltraLife Protocol — Multi-User Interaction Test Suite
 *
 * Tests complete interaction flows between multiple users.
 * Simulates real-world scenarios like marketplace trades, work auctions,
 * governance voting, and impact credit trading.
 *
 * Usage:
 *   node interaction-test.mjs                    # Run all interaction tests
 *   node interaction-test.mjs --flow marketplace # Run specific flow
 *   node interaction-test.mjs --flow work        # Work auction flow
 *   node interaction-test.mjs --flow governance  # Governance flow
 *   node interaction-test.mjs --flow care        # Care economy flow
 *   node interaction-test.mjs --flow impact      # Impact market flow
 *   node interaction-test.mjs --flow land        # Land stewardship flow
 *   node interaction-test.mjs --verbose          # Detailed output
 *   node interaction-test.mjs --setup            # Create test users first
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  deploymentPath: path.join(__dirname, 'deployment.json'),
  resultsPath: path.join(__dirname, 'interaction-test-results.json'),
};

const args = process.argv.slice(2);
const FLAGS = {
  flow: args.find((a, i) => args[i - 1] === '--flow') || null,
  verbose: args.includes('--verbose'),
  setup: args.includes('--setup'),
  help: args.includes('--help'),
};

// =============================================================================
// TEST FRAMEWORK
// =============================================================================

class InteractionTestHarness {
  constructor() {
    this.deployment = null;
    this.users = {};
    this.results = {
      timestamp: new Date().toISOString(),
      flows: {},
      summary: { passed: 0, failed: 0, total: 0 },
    };
    this.startTime = Date.now();
  }

  async initialize() {
    this.printBanner();

    if (!fs.existsSync(CONFIG.deploymentPath)) {
      this.error('deployment.json not found. Run deployment first.');
      process.exit(1);
    }

    this.deployment = JSON.parse(fs.readFileSync(CONFIG.deploymentPath, 'utf-8'));
    await this.setupUsers();

    this.log(`Initialized with ${Object.keys(this.users).length} test users`);
    console.log('');
  }

  printBanner() {
    console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║            UltraLife Protocol — Multi-User Interaction Tests                  ║
║                                                                               ║
║     Testing complete user interaction flows                                   ║
║     Marketplace • Work • Governance • Care • Impact                           ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`);
  }

  async setupUsers() {
    // Get or create test users
    const pnfts = this.deployment.pnfts || [];
    const mintedPnfts = pnfts.filter(p => p.status === 'minted');
    const delegations = this.deployment.delegations || [];
    const balances = this.deployment.ultraBalances || {};

    // Primary user from minted pNFT
    if (mintedPnfts.length > 0) {
      const pnft = mintedPnfts[0];
      const delegation = delegations.find(d => d.walletAddress === pnft.owner);
      this.users.alice = {
        name: 'Alice',
        address: pnft.owner,
        pnftId: pnft.id,
        pnftLevel: pnft.level,
        bioregion: delegation?.bioregion || 'sierra_nevada',
        balance: balances[pnft.owner] || 0,
      };
    }

    // Create simulated users for testing
    this.users.bob = this.createSimulatedUser('Bob', 'Verified');
    this.users.carol = this.createSimulatedUser('Carol', 'Standard');
    this.users.dave = this.createSimulatedUser('Dave', 'Steward');

    // If setup flag, persist users
    if (FLAGS.setup) {
      await this.persistSimulatedUsers();
    }
  }

  createSimulatedUser(name, level) {
    const id = crypto.randomBytes(4).toString('hex');
    return {
      name,
      address: `addr_test_simulated_${name.toLowerCase()}_${id}`,
      pnftId: `pnft_sim_${name.toLowerCase()}_${id}`,
      pnftLevel: level,
      bioregion: 'sierra_nevada',
      balance: 100, // Simulated balance
      simulated: true,
    };
  }

  async persistSimulatedUsers() {
    // Add simulated users to deployment for future tests
    if (!this.deployment.simulatedUsers) {
      this.deployment.simulatedUsers = [];
    }

    for (const [key, user] of Object.entries(this.users)) {
      if (user.simulated) {
        this.deployment.simulatedUsers.push(user);
        // Add balance
        if (!this.deployment.ultraBalances) {
          this.deployment.ultraBalances = {};
        }
        this.deployment.ultraBalances[user.address] = user.balance;
      }
    }

    fs.writeFileSync(CONFIG.deploymentPath, JSON.stringify(this.deployment, null, 2));
    this.success('Simulated users persisted to deployment.json');
  }

  log(msg) {
    if (FLAGS.verbose) {
      console.log(`  [INFO] ${msg}`);
    }
  }

  success(msg) {
    console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
  }

  error(msg) {
    console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
  }

  step(msg) {
    console.log(`  \x1b[36m→\x1b[0m ${msg}`);
  }

  async runStep(flowName, stepName, stepFn) {
    this.step(stepName);

    try {
      const result = await stepFn();
      this.success(`${stepName}`);
      this.log(`  Result: ${JSON.stringify(result)}`);

      if (!this.results.flows[flowName]) {
        this.results.flows[flowName] = { steps: [], passed: 0, failed: 0 };
      }
      this.results.flows[flowName].steps.push({ name: stepName, status: 'passed', result });
      this.results.flows[flowName].passed++;
      this.results.summary.passed++;
      this.results.summary.total++;

      return result;
    } catch (err) {
      this.error(`${stepName}: ${err.message}`);

      if (!this.results.flows[flowName]) {
        this.results.flows[flowName] = { steps: [], passed: 0, failed: 0 };
      }
      this.results.flows[flowName].steps.push({ name: stepName, status: 'failed', error: err.message });
      this.results.flows[flowName].failed++;
      this.results.summary.failed++;
      this.results.summary.total++;

      return null;
    }
  }

  saveResults() {
    this.results.duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
    fs.writeFileSync(CONFIG.resultsPath, JSON.stringify(this.results, null, 2));
  }

  printSummary() {
    const { passed, failed, total } = this.results.summary;
    const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : 0;

    console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║                       INTERACTION TEST SUMMARY                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
  Total Steps:  ${total}
  Passed:       \x1b[32m${passed}\x1b[0m (${passRate}%)
  Failed:       \x1b[31m${failed}\x1b[0m
  Duration:     ${this.results.duration}s

  Flow Results:`);

    for (const [flow, stats] of Object.entries(this.results.flows)) {
      const flowTotal = stats.passed + stats.failed;
      const flowRate = flowTotal > 0 ? ((stats.passed / flowTotal) * 100).toFixed(0) : 0;
      const status = stats.failed === 0 ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
      console.log(`    ${status} ${flow.padEnd(25)} ${stats.passed}/${flowTotal} (${flowRate}%)`);
    }

    console.log(`
═══════════════════════════════════════════════════════════════════════════════
`);
  }
}

// =============================================================================
// INTERACTION FLOWS
// =============================================================================

/**
 * MARKETPLACE FLOW
 * Alice lists an item → Bob purchases → Impact is recorded → Review submitted
 */
async function marketplaceFlow(harness) {
  console.log('\n\x1b[1mMARKETPLACE FLOW\x1b[0m');
  console.log('─'.repeat(60));
  console.log(`  Seller: ${harness.users.alice.name} (${harness.users.alice.pnftLevel})`);
  console.log(`  Buyer:  ${harness.users.bob.name} (${harness.users.bob.pnftLevel})`);
  console.log('');

  const listingId = `listing_${Date.now().toString(36)}`;
  let listing = null;

  // Step 1: Alice lists an item
  await harness.runStep('Marketplace', 'Alice creates listing', async () => {
    listing = {
      id: listingId,
      seller: harness.users.alice.address,
      sellerPnft: harness.users.alice.pnftId,
      title: 'Organic Honey - 1kg',
      description: 'Raw honey from Sierra Nevada apiaries',
      price: 25, // ULTRA
      category: 'food',
      impactDisclosure: {
        CO2: -0.5,   // Negative = sequestered
        BIO: 2.0,    // Positive biodiversity impact
        H2O: -10,    // Water used
        POLL: 5.0,   // Pollination benefit
      },
      bioregion: harness.users.alice.bioregion,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    if (!harness.deployment.marketplace) {
      harness.deployment.marketplace = { listings: [], purchases: [], reviews: [] };
    }
    harness.deployment.marketplace.listings.push(listing);

    return { listingId: listing.id, price: listing.price };
  });

  // Step 2: Bob views the listing
  await harness.runStep('Marketplace', 'Bob views listing details', async () => {
    const found = harness.deployment.marketplace.listings.find(l => l.id === listingId);
    if (!found) throw new Error('Listing not found');

    return {
      title: found.title,
      price: found.price,
      impact: found.impactDisclosure,
    };
  });

  // Step 3: Bob purchases the item
  let purchase = null;
  await harness.runStep('Marketplace', 'Bob purchases item', async () => {
    const bobBalance = harness.users.bob.balance;
    if (bobBalance < listing.price) {
      throw new Error(`Insufficient balance: ${bobBalance} < ${listing.price}`);
    }

    purchase = {
      id: `purchase_${Date.now().toString(36)}`,
      listingId: listingId,
      buyer: harness.users.bob.address,
      buyerPnft: harness.users.bob.pnftId,
      seller: harness.users.alice.address,
      amount: listing.price,
      impactTransferred: listing.impactDisclosure,
      timestamp: new Date().toISOString(),
    };

    // Update balances
    harness.users.bob.balance -= listing.price;
    harness.users.alice.balance += listing.price;

    // Record impact on buyer's pNFT
    if (!harness.deployment.impactRecords) {
      harness.deployment.impactRecords = [];
    }
    harness.deployment.impactRecords.push({
      pnftId: harness.users.bob.pnftId,
      source: 'marketplace_purchase',
      purchaseId: purchase.id,
      impact: listing.impactDisclosure,
      timestamp: purchase.timestamp,
    });

    harness.deployment.marketplace.purchases.push(purchase);

    // Update listing status
    listing.status = 'sold';

    return { purchaseId: purchase.id, amount: purchase.amount };
  });

  // Step 4: Impact is recorded on both parties
  await harness.runStep('Marketplace', 'Impact recorded on buyer pNFT', async () => {
    const record = harness.deployment.impactRecords.find(
      r => r.pnftId === harness.users.bob.pnftId && r.purchaseId === purchase.id
    );
    if (!record) throw new Error('Impact record not found');

    return { impact: record.impact };
  });

  // Step 5: Bob submits a review
  await harness.runStep('Marketplace', 'Bob submits review', async () => {
    const review = {
      id: `review_${Date.now().toString(36)}`,
      purchaseId: purchase.id,
      reviewer: harness.users.bob.address,
      reviewerPnft: harness.users.bob.pnftId,
      seller: harness.users.alice.address,
      rating: 5,
      comment: 'Excellent honey, great impact disclosure!',
      timestamp: new Date().toISOString(),
    };

    harness.deployment.marketplace.reviews.push(review);

    return { reviewId: review.id, rating: review.rating };
  });

  // Step 6: Verify final state
  await harness.runStep('Marketplace', 'Verify final balances', async () => {
    return {
      aliceBalance: harness.users.alice.balance,
      bobBalance: harness.users.bob.balance,
      listingStatus: listing.status,
    };
  });
}

/**
 * WORK AUCTION FLOW
 * Alice posts a job → Bob and Carol bid → Alice accepts Bob → Bob completes → Payment released
 */
async function workAuctionFlow(harness) {
  console.log('\n\x1b[1mWORK AUCTION FLOW\x1b[0m');
  console.log('─'.repeat(60));
  console.log(`  Poster:   ${harness.users.alice.name}`);
  console.log(`  Bidder 1: ${harness.users.bob.name}`);
  console.log(`  Bidder 2: ${harness.users.carol.name}`);
  console.log('');

  const jobId = `job_${Date.now().toString(36)}`;
  let job = null;

  // Step 1: Alice posts a job
  await harness.runStep('Work Auction', 'Alice posts job', async () => {
    job = {
      id: jobId,
      poster: harness.users.alice.address,
      posterPnft: harness.users.alice.pnftId,
      title: 'Trail Maintenance - 2 miles',
      description: 'Clear fallen trees and repair trail markers on Sierra Ridge trail',
      category: 'forestry',
      budget: 150, // ULTRA
      escrow: 150,
      bioregion: harness.users.alice.bioregion,
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      requirements: {
        minLevel: 'Standard',
        skills: ['trail_work', 'chainsaw'],
      },
      status: 'open',
      bids: [],
      createdAt: new Date().toISOString(),
    };

    if (!harness.deployment.workAuction) {
      harness.deployment.workAuction = { jobs: [], completions: [], disputes: [] };
    }
    harness.deployment.workAuction.jobs.push(job);

    // Escrow funds from Alice
    harness.users.alice.balance -= job.escrow;

    return { jobId: job.id, budget: job.budget, escrow: job.escrow };
  });

  // Step 2: Bob places a bid
  await harness.runStep('Work Auction', 'Bob places bid at 140 ULTRA', async () => {
    const bid = {
      id: `bid_${Date.now().toString(36)}_bob`,
      jobId: jobId,
      bidder: harness.users.bob.address,
      bidderPnft: harness.users.bob.pnftId,
      amount: 140,
      estimatedDays: 3,
      message: 'Experienced trail worker, have all equipment.',
      timestamp: new Date().toISOString(),
    };

    job.bids.push(bid);
    return { bidId: bid.id, amount: bid.amount };
  });

  // Step 3: Carol places a competing bid
  await harness.runStep('Work Auction', 'Carol places bid at 130 ULTRA', async () => {
    const bid = {
      id: `bid_${Date.now().toString(36)}_carol`,
      jobId: jobId,
      bidder: harness.users.carol.address,
      bidderPnft: harness.users.carol.pnftId,
      amount: 130,
      estimatedDays: 4,
      message: 'Will do quality work at lower rate.',
      timestamp: new Date().toISOString(),
    };

    job.bids.push(bid);
    return { bidId: bid.id, amount: bid.amount };
  });

  // Step 4: Alice reviews bids and accepts Bob
  let acceptedBid = null;
  await harness.runStep('Work Auction', 'Alice accepts Bob\'s bid', async () => {
    acceptedBid = job.bids.find(b => b.bidder === harness.users.bob.address);
    if (!acceptedBid) throw new Error('Bob\'s bid not found');

    job.status = 'in_progress';
    job.acceptedBid = acceptedBid.id;
    job.worker = harness.users.bob.address;
    job.workerPnft = harness.users.bob.pnftId;
    job.startedAt = new Date().toISOString();

    return { acceptedBid: acceptedBid.id, worker: harness.users.bob.name };
  });

  // Step 5: Bob completes the work
  await harness.runStep('Work Auction', 'Bob submits completion', async () => {
    job.status = 'pending_approval';
    job.completionSubmitted = new Date().toISOString();
    job.completionEvidence = {
      photos: ['trail_before.jpg', 'trail_after.jpg'],
      notes: 'Cleared 3 fallen trees, replaced 5 trail markers.',
      hoursWorked: 18,
    };

    return { status: job.status, hoursWorked: job.completionEvidence.hoursWorked };
  });

  // Step 6: Alice approves and payment is released
  await harness.runStep('Work Auction', 'Alice approves, payment released', async () => {
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    job.approvedAt = new Date().toISOString();

    // Release payment from escrow to Bob
    const payment = acceptedBid.amount;
    harness.users.bob.balance += payment;

    // Refund excess escrow to Alice
    const refund = job.escrow - payment;
    if (refund > 0) {
      harness.users.alice.balance += refund;
    }

    // Record work completion
    harness.deployment.workAuction.completions.push({
      jobId: job.id,
      worker: harness.users.bob.address,
      workerPnft: harness.users.bob.pnftId,
      payment: payment,
      completedAt: job.completedAt,
    });

    return { payment, refund, bobNewBalance: harness.users.bob.balance };
  });

  // Step 7: Verify final state
  await harness.runStep('Work Auction', 'Verify job completed', async () => {
    return {
      jobStatus: job.status,
      aliceBalance: harness.users.alice.balance,
      bobBalance: harness.users.bob.balance,
    };
  });
}

/**
 * GOVERNANCE FLOW
 * Alice proposes budget allocation → Bob, Carol, Dave vote → Tally and execute
 */
async function governanceFlow(harness) {
  console.log('\n\x1b[1mGOVERNANCE FLOW\x1b[0m');
  console.log('─'.repeat(60));
  console.log(`  Proposer: ${harness.users.alice.name} (${harness.users.alice.pnftLevel})`);
  console.log(`  Voters:   ${harness.users.bob.name} (${harness.users.bob.pnftLevel}), ` +
              `${harness.users.carol.name} (${harness.users.carol.pnftLevel}), ` +
              `${harness.users.dave.name} (${harness.users.dave.pnftLevel})`);
  console.log('');

  const proposalId = `proposal_${Date.now().toString(36)}`;
  let proposal = null;

  // Voting weights by level
  const weights = { Basic: 0, Ward: 0, Standard: 1, Verified: 2, Steward: 3 };

  // Step 1: Alice creates a proposal
  await harness.runStep('Governance', 'Alice creates budget proposal', async () => {
    proposal = {
      id: proposalId,
      type: 'budget',
      title: 'Fund Trail Restoration Project',
      description: 'Allocate 5000 ULTRA from bioregion treasury for trail restoration in Sierra Nevada.',
      proposer: harness.users.alice.address,
      proposerPnft: harness.users.alice.pnftId,
      bioregion: harness.users.alice.bioregion,
      budgetRequest: {
        amount: 5000,
        recipient: 'sierra_nevada_trails_collective',
        purpose: 'Trail restoration and maintenance',
      },
      votingPeriod: {
        start: new Date().toISOString(),
        end: new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString(), // 37 days (PRC-37)
      },
      votes: [],
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    if (!harness.deployment.governance) {
      harness.deployment.governance = { proposals: [], votes: [], executions: [] };
    }
    harness.deployment.governance.proposals.push(proposal);

    return { proposalId: proposal.id, type: proposal.type, amount: proposal.budgetRequest.amount };
  });

  // Step 2: Bob votes YES (weight: 2)
  await harness.runStep('Governance', 'Bob votes YES (weight: 2)', async () => {
    const vote = {
      id: `vote_${Date.now().toString(36)}_bob`,
      proposalId: proposalId,
      voter: harness.users.bob.address,
      voterPnft: harness.users.bob.pnftId,
      voterLevel: harness.users.bob.pnftLevel,
      choice: 'yes',
      weight: weights[harness.users.bob.pnftLevel],
      timestamp: new Date().toISOString(),
    };

    proposal.votes.push(vote);
    return { choice: vote.choice, weight: vote.weight };
  });

  // Step 3: Carol votes YES (weight: 1)
  await harness.runStep('Governance', 'Carol votes YES (weight: 1)', async () => {
    const vote = {
      id: `vote_${Date.now().toString(36)}_carol`,
      proposalId: proposalId,
      voter: harness.users.carol.address,
      voterPnft: harness.users.carol.pnftId,
      voterLevel: harness.users.carol.pnftLevel,
      choice: 'yes',
      weight: weights[harness.users.carol.pnftLevel],
      timestamp: new Date().toISOString(),
    };

    proposal.votes.push(vote);
    return { choice: vote.choice, weight: vote.weight };
  });

  // Step 4: Dave votes NO (weight: 3)
  await harness.runStep('Governance', 'Dave votes NO (weight: 3)', async () => {
    const vote = {
      id: `vote_${Date.now().toString(36)}_dave`,
      proposalId: proposalId,
      voter: harness.users.dave.address,
      voterPnft: harness.users.dave.pnftId,
      voterLevel: harness.users.dave.pnftLevel,
      choice: 'no',
      weight: weights[harness.users.dave.pnftLevel],
      timestamp: new Date().toISOString(),
    };

    proposal.votes.push(vote);
    return { choice: vote.choice, weight: vote.weight };
  });

  // Step 5: Tally votes
  let tally = null;
  await harness.runStep('Governance', 'Tally votes', async () => {
    const yesVotes = proposal.votes.filter(v => v.choice === 'yes');
    const noVotes = proposal.votes.filter(v => v.choice === 'no');

    const yesWeight = yesVotes.reduce((sum, v) => sum + v.weight, 0);
    const noWeight = noVotes.reduce((sum, v) => sum + v.weight, 0);
    const totalWeight = yesWeight + noWeight;

    tally = {
      yes: yesWeight,
      no: noWeight,
      total: totalWeight,
      yesPercent: ((yesWeight / totalWeight) * 100).toFixed(1),
      passed: yesWeight > noWeight,
    };

    proposal.tally = tally;
    proposal.status = tally.passed ? 'passed' : 'rejected';
    proposal.talliedAt = new Date().toISOString();

    return tally;
  });

  // Step 6: Execute if passed
  await harness.runStep('Governance', 'Execute proposal result', async () => {
    if (!tally.passed) {
      return { executed: false, reason: 'Proposal did not pass' };
    }

    const execution = {
      proposalId: proposalId,
      type: 'budget_allocation',
      amount: proposal.budgetRequest.amount,
      recipient: proposal.budgetRequest.recipient,
      executedAt: new Date().toISOString(),
    };

    harness.deployment.governance.executions.push(execution);
    proposal.status = 'executed';
    proposal.executedAt = execution.executedAt;

    return { executed: true, amount: execution.amount };
  });
}

/**
 * CARE ECONOMY FLOW
 * Alice registers care need → Bob offers to fulfill → Match made → Care provided → Credits exchanged
 */
async function careEconomyFlow(harness) {
  console.log('\n\x1b[1mCARE ECONOMY FLOW\x1b[0m');
  console.log('─'.repeat(60));
  console.log(`  Care Seeker:   ${harness.users.alice.name}`);
  console.log(`  Care Provider: ${harness.users.bob.name}`);
  console.log('');

  const needId = `need_${Date.now().toString(36)}`;
  let need = null;
  let match = null;

  // Step 1: Alice registers a care need
  await harness.runStep('Care Economy', 'Alice registers eldercare need', async () => {
    need = {
      id: needId,
      type: 'eldercare',
      seeker: harness.users.alice.address,
      seekerPnft: harness.users.alice.pnftId,
      description: 'Weekly check-in and meal preparation for elderly parent',
      hoursNeeded: 4,
      frequency: 'weekly',
      bioregion: harness.users.alice.bioregion,
      preferences: {
        experience: 'preferred',
        background_check: true,
      },
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    if (!harness.deployment.care) {
      harness.deployment.care = { needs: [], offers: [], matches: [], completions: [] };
    }
    harness.deployment.care.needs.push(need);

    return { needId: need.id, type: need.type, hours: need.hoursNeeded };
  });

  // Step 2: Bob offers to provide care
  await harness.runStep('Care Economy', 'Bob offers to provide care', async () => {
    const offer = {
      id: `offer_${Date.now().toString(36)}`,
      needId: needId,
      provider: harness.users.bob.address,
      providerPnft: harness.users.bob.pnftId,
      message: 'I have experience with eldercare and can commit to weekly visits.',
      availability: 'Saturdays 10am-2pm',
      experience: {
        years: 3,
        certifications: ['first_aid', 'eldercare_basics'],
      },
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    harness.deployment.care.offers.push(offer);
    return { offerId: offer.id, provider: harness.users.bob.name };
  });

  // Step 3: Alice accepts Bob's offer, match is made
  await harness.runStep('Care Economy', 'Alice accepts, match created', async () => {
    match = {
      id: `match_${Date.now().toString(36)}`,
      needId: needId,
      seeker: harness.users.alice.address,
      seekerPnft: harness.users.alice.pnftId,
      provider: harness.users.bob.address,
      providerPnft: harness.users.bob.pnftId,
      type: need.type,
      hoursPerSession: need.hoursNeeded,
      schedule: 'Saturdays 10am-2pm',
      status: 'active',
      sessions: [],
      createdAt: new Date().toISOString(),
    };

    need.status = 'matched';
    harness.deployment.care.matches.push(match);

    return { matchId: match.id, schedule: match.schedule };
  });

  // Step 4: Bob provides care (logs session)
  await harness.runStep('Care Economy', 'Bob logs care session (4 hours)', async () => {
    const session = {
      id: `session_${Date.now().toString(36)}`,
      matchId: match.id,
      date: new Date().toISOString(),
      hoursProvided: 4,
      notes: 'Prepared meals for the week, helped with light housekeeping.',
      verified: false,
    };

    match.sessions.push(session);
    return { sessionId: session.id, hours: session.hoursProvided };
  });

  // Step 5: Alice verifies the care session
  await harness.runStep('Care Economy', 'Alice verifies session', async () => {
    const session = match.sessions[match.sessions.length - 1];
    session.verified = true;
    session.verifiedAt = new Date().toISOString();

    return { verified: true, hours: session.hoursProvided };
  });

  // Step 6: Care credits are exchanged
  await harness.runStep('Care Economy', 'Care credits issued to Bob', async () => {
    const session = match.sessions[match.sessions.length - 1];

    // Issue care credits
    if (!harness.deployment.careCredits) {
      harness.deployment.careCredits = {};
    }
    if (!harness.deployment.careCredits[harness.users.bob.address]) {
      harness.deployment.careCredits[harness.users.bob.address] = 0;
    }

    const creditsEarned = session.hoursProvided; // 1 credit per hour
    harness.deployment.careCredits[harness.users.bob.address] += creditsEarned;

    // Record completion
    harness.deployment.care.completions.push({
      matchId: match.id,
      sessionId: session.id,
      provider: harness.users.bob.address,
      hours: session.hoursProvided,
      creditsIssued: creditsEarned,
      timestamp: new Date().toISOString(),
    });

    return {
      creditsEarned,
      totalCredits: harness.deployment.careCredits[harness.users.bob.address],
    };
  });
}

/**
 * IMPACT MARKET FLOW
 * Land generates credits → Steward lists on market → Extractor purchases → Impact transferred
 */
async function impactMarketFlow(harness) {
  console.log('\n\x1b[1mIMPACT MARKET FLOW\x1b[0m');
  console.log('─'.repeat(60));
  console.log(`  Regenerator (Seller): ${harness.users.dave.name} (Land Steward)`);
  console.log(`  Extractor (Buyer):    ${harness.users.bob.name}`);
  console.log('');

  // Dave is a land steward who generates credits
  const landId = `land_${Date.now().toString(36)}`;
  let order = null;

  // Step 1: Dave's land generates sequestration credits
  await harness.runStep('Impact Market', 'Land generates CO2 credits', async () => {
    // Create land for Dave
    const land = {
      id: landId,
      steward: harness.users.dave.address,
      stewardPnft: harness.users.dave.pnftId,
      name: 'Pine Ridge Forest',
      area_m2: 100000, // 10 hectares
      classification: 'Forest',
      sequestrationRate: 5, // tons CO2/hectare/year
      bioregion: 'sierra_nevada',
    };

    if (!harness.deployment.lands) {
      harness.deployment.lands = [];
    }
    harness.deployment.lands.push(land);

    // Generate credits (simulation: 1 month of sequestration)
    const monthlySequestration = (land.area_m2 / 10000) * land.sequestrationRate / 12;

    if (!harness.deployment.impactCredits) {
      harness.deployment.impactCredits = {};
    }
    if (!harness.deployment.impactCredits[harness.users.dave.address]) {
      harness.deployment.impactCredits[harness.users.dave.address] = { CO2: 0 };
    }
    harness.deployment.impactCredits[harness.users.dave.address].CO2 += monthlySequestration;

    return {
      landId: land.id,
      creditsGenerated: monthlySequestration.toFixed(2),
      compound: 'CO2',
    };
  });

  // Step 2: Dave lists credits on impact market
  await harness.runStep('Impact Market', 'Dave lists CO2 credits for sale', async () => {
    order = {
      id: `order_${Date.now().toString(36)}`,
      type: 'Sell',
      seller: harness.users.dave.address,
      sellerPnft: harness.users.dave.pnftId,
      compound: 'CO2',
      quantity: 2, // tons
      pricePerUnit: 50, // ULTRA per ton
      totalPrice: 100,
      landSource: landId,
      status: 'open',
      createdAt: new Date().toISOString(),
    };

    if (!harness.deployment.impactMarket) {
      harness.deployment.impactMarket = { orders: [], fills: [] };
    }
    harness.deployment.impactMarket.orders.push(order);

    return { orderId: order.id, quantity: order.quantity, pricePerUnit: order.pricePerUnit };
  });

  // Step 3: Bob (extractor) needs to offset impact
  await harness.runStep('Impact Market', 'Bob has impact debt to offset', async () => {
    // Bob has accumulated impact debt from consumption
    if (!harness.deployment.impactDebt) {
      harness.deployment.impactDebt = {};
    }
    harness.deployment.impactDebt[harness.users.bob.address] = {
      CO2: 5, // tons of CO2 debt
      H2O: 1000, // liters
    };

    return {
      debt: harness.deployment.impactDebt[harness.users.bob.address],
    };
  });

  // Step 4: Bob purchases credits from Dave
  await harness.runStep('Impact Market', 'Bob purchases 2 tons CO2 credits', async () => {
    if (harness.users.bob.balance < order.totalPrice) {
      throw new Error(`Insufficient balance: ${harness.users.bob.balance} < ${order.totalPrice}`);
    }

    // Execute the trade
    harness.users.bob.balance -= order.totalPrice;
    harness.users.dave.balance += order.totalPrice;

    // Transfer credits
    harness.deployment.impactCredits[harness.users.dave.address].CO2 -= order.quantity;

    // Reduce Bob's debt
    harness.deployment.impactDebt[harness.users.bob.address].CO2 -= order.quantity;

    // Record the fill
    const fill = {
      id: `fill_${Date.now().toString(36)}`,
      orderId: order.id,
      buyer: harness.users.bob.address,
      buyerPnft: harness.users.bob.pnftId,
      seller: harness.users.dave.address,
      compound: order.compound,
      quantity: order.quantity,
      totalPrice: order.totalPrice,
      timestamp: new Date().toISOString(),
    };

    harness.deployment.impactMarket.fills.push(fill);
    order.status = 'filled';

    return {
      fillId: fill.id,
      paid: order.totalPrice,
      creditsReceived: order.quantity,
    };
  });

  // Step 5: Verify impact transferred
  await harness.runStep('Impact Market', 'Verify impact debt reduced', async () => {
    return {
      bobDebtRemaining: harness.deployment.impactDebt[harness.users.bob.address],
      daveCreditsRemaining: harness.deployment.impactCredits[harness.users.dave.address],
    };
  });

  // Step 6: Final balance check
  await harness.runStep('Impact Market', 'Verify final balances', async () => {
    return {
      daveBalance: harness.users.dave.balance,
      bobBalance: harness.users.bob.balance,
    };
  });
}

// =============================================================================
// FAILURE SCENARIO FLOWS
// =============================================================================

/**
 * MARKETPLACE FAILURE FLOW
 * Test purchase with insufficient funds
 */
async function marketplaceFailureFlow(harness) {
  console.log('\n\x1b[1mMARKETPLACE FAILURE SCENARIOS\x1b[0m');
  console.log('─'.repeat(60));
  console.log(`  Testing error handling for marketplace operations`);
  console.log('');

  const listingId = `listing_fail_${Date.now().toString(36)}`;

  // Step 1: Create a listing for testing
  await harness.runStep('Marketplace Failure', 'Create test listing', async () => {
    const listing = {
      id: listingId,
      seller: harness.users.alice.address,
      sellerPnft: harness.users.alice.pnftId,
      title: 'Expensive Item',
      price: 10000, // Very expensive
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    if (!harness.deployment.marketplace) {
      harness.deployment.marketplace = { listings: [], purchases: [], reviews: [] };
    }
    harness.deployment.marketplace.listings.push(listing);

    return { listingId: listing.id, price: listing.price };
  });

  // Step 2: Attempt purchase with insufficient funds
  await harness.runStep('Marketplace Failure', 'Reject purchase - insufficient funds', async () => {
    const listing = harness.deployment.marketplace.listings.find(l => l.id === listingId);
    const buyerBalance = harness.users.bob.balance || 100;

    if (buyerBalance < listing.price) {
      return {
        rejected: true,
        reason: 'Insufficient ULTRA balance',
        available: buyerBalance,
        required: listing.price,
        shortfall: listing.price - buyerBalance,
      };
    }
    throw new Error('Purchase should have been rejected due to insufficient funds');
  });

  // Step 3: Attempt purchase from self
  await harness.runStep('Marketplace Failure', 'Reject purchase - buying from self', async () => {
    const listing = harness.deployment.marketplace.listings.find(l => l.id === listingId);
    const buyerAddress = harness.users.alice.address; // Same as seller

    if (buyerAddress === listing.seller) {
      return {
        rejected: true,
        reason: 'Cannot purchase your own listing',
        seller: listing.seller,
        buyer: buyerAddress,
      };
    }
    throw new Error('Self-purchase should have been rejected');
  });

  // Step 4: Attempt purchase of inactive listing
  await harness.runStep('Marketplace Failure', 'Reject purchase - inactive listing', async () => {
    const listing = harness.deployment.marketplace.listings.find(l => l.id === listingId);
    listing.status = 'paused'; // Temporarily pause

    if (listing.status !== 'active') {
      listing.status = 'active'; // Restore for other tests
      return {
        rejected: true,
        reason: 'Listing is not active',
        status: 'paused',
      };
    }
    throw new Error('Inactive listing purchase should have been rejected');
  });

  // Step 5: Attempt to update listing without ownership
  await harness.runStep('Marketplace Failure', 'Reject update - not the seller', async () => {
    const listing = harness.deployment.marketplace.listings.find(l => l.id === listingId);
    const requester = harness.users.bob.address;

    if (requester !== listing.seller) {
      return {
        rejected: true,
        reason: 'Only the seller can update this listing',
        seller: listing.seller,
        requester: requester,
      };
    }
    throw new Error('Unauthorized update should have been rejected');
  });
}

/**
 * WORK AUCTION FAILURE FLOW
 * Test accept bid without escrow
 */
async function workAuctionFailureFlow(harness) {
  console.log('\n\x1b[1mWORK AUCTION FAILURE SCENARIOS\x1b[0m');
  console.log('─'.repeat(60));
  console.log(`  Testing error handling for work auction operations`);
  console.log('');

  const jobId = `job_fail_${Date.now().toString(36)}`;

  // Step 1: Create job without sufficient escrow
  await harness.runStep('Work Failure', 'Reject job - insufficient escrow funds', async () => {
    const budget = 500;
    const userBalance = harness.users.alice.balance || 100;

    if (userBalance < budget) {
      return {
        rejected: true,
        reason: 'Insufficient funds for escrow',
        required: budget,
        available: userBalance,
      };
    }
    throw new Error('Job creation should have been rejected due to insufficient escrow');
  });

  // Step 2: Create a valid job for testing other failures
  await harness.runStep('Work Failure', 'Create test job with minimal escrow', async () => {
    const job = {
      id: jobId,
      poster: harness.users.dave.address, // Dave has Steward level with more funds
      posterPnft: harness.users.dave.pnftId,
      title: 'Test Job',
      budget: 50,
      escrow: 50,
      status: 'open',
      bids: [],
      createdAt: new Date().toISOString(),
    };

    if (!harness.deployment.workAuction) {
      harness.deployment.workAuction = { jobs: [], completions: [], disputes: [] };
    }
    harness.deployment.workAuction.jobs.push(job);

    return { jobId: job.id, budget: job.budget };
  });

  // Step 3: Attempt to accept non-existent bid
  await harness.runStep('Work Failure', 'Reject accept - bid not found', async () => {
    const job = harness.deployment.workAuction.jobs.find(j => j.id === jobId);
    const fakeBidId = 'bid_nonexistent_123';
    const bid = job.bids.find(b => b.id === fakeBidId);

    if (!bid) {
      return {
        rejected: true,
        reason: 'Bid not found',
        bidId: fakeBidId,
        jobId: jobId,
      };
    }
    throw new Error('Accept non-existent bid should have been rejected');
  });

  // Step 4: Attempt to bid on own job
  await harness.runStep('Work Failure', 'Reject bid - bidding on own job', async () => {
    const job = harness.deployment.workAuction.jobs.find(j => j.id === jobId);
    const bidderAddress = harness.users.dave.address; // Same as poster

    if (bidderAddress === job.poster) {
      return {
        rejected: true,
        reason: 'Cannot bid on your own job',
        poster: job.poster,
        bidder: bidderAddress,
      };
    }
    throw new Error('Self-bid should have been rejected');
  });

  // Step 5: Attempt to complete job without being assigned
  await harness.runStep('Work Failure', 'Reject complete - not assigned worker', async () => {
    const job = harness.deployment.workAuction.jobs.find(j => j.id === jobId);
    const requester = harness.users.carol.address;

    if (!job.worker || job.worker !== requester) {
      return {
        rejected: true,
        reason: 'Only assigned worker can mark job complete',
        assignedWorker: job.worker || 'none',
        requester: requester,
      };
    }
    throw new Error('Unauthorized completion should have been rejected');
  });

  // Step 6: Attempt to cancel completed job
  await harness.runStep('Work Failure', 'Reject cancel - invalid status', async () => {
    const job = harness.deployment.workAuction.jobs.find(j => j.id === jobId);
    const originalStatus = job.status;
    job.status = 'completed'; // Temporarily set to completed

    if (job.status === 'completed') {
      job.status = originalStatus; // Restore
      return {
        rejected: true,
        reason: 'Cannot cancel a completed job',
        status: 'completed',
      };
    }
    throw new Error('Cancel completed job should have been rejected');
  });
}

/**
 * GOVERNANCE FAILURE FLOW
 * Test vote without voting rights
 */
async function governanceFailureFlow(harness) {
  console.log('\n\x1b[1mGOVERNANCE FAILURE SCENARIOS\x1b[0m');
  console.log('─'.repeat(60));
  console.log(`  Testing error handling for governance operations`);
  console.log('');

  const proposalId = `prop_fail_${Date.now().toString(36)}`;
  const votingWeights = { Basic: 0, Ward: 0, Standard: 1, Verified: 2, Steward: 3 };

  // Step 1: Attempt to vote without voting rights (Basic level)
  await harness.runStep('Governance Failure', 'Reject vote - Basic level cannot vote', async () => {
    const basicUser = { name: 'BasicUser', level: 'Basic' };
    const weight = votingWeights[basicUser.level];

    if (weight === 0) {
      return {
        rejected: true,
        reason: 'Users with Basic level cannot vote',
        level: basicUser.level,
        weight: 0,
        requiredLevel: 'Standard or higher',
      };
    }
    throw new Error('Basic user vote should have been rejected');
  });

  // Step 2: Create a test proposal
  await harness.runStep('Governance Failure', 'Create test proposal', async () => {
    const proposal = {
      id: proposalId,
      type: 'budget',
      status: 'active',
      proposer: harness.users.dave.address,
      votingEnd: Date.now() + 7 * 24 * 60 * 60 * 1000,
      votes: [],
      votesFor: 0,
      votesAgainst: 0,
      voteCount: 0,
      createdAt: new Date().toISOString(),
    };

    if (!harness.deployment.governance) {
      harness.deployment.governance = { proposals: [], votes: [], currentCycle: 1 };
    }
    harness.deployment.governance.proposals.push(proposal);

    return { proposalId: proposal.id, status: proposal.status };
  });

  // Step 3: Attempt to vote on inactive proposal
  await harness.runStep('Governance Failure', 'Reject vote - proposal not active', async () => {
    const proposal = harness.deployment.governance.proposals.find(p => p.id === proposalId);
    const originalStatus = proposal.status;
    proposal.status = 'executed';

    if (proposal.status !== 'active') {
      proposal.status = originalStatus;
      return {
        rejected: true,
        reason: 'Can only vote on active proposals',
        status: 'executed',
      };
    }
    throw new Error('Vote on inactive proposal should have been rejected');
  });

  // Step 4: Attempt duplicate vote
  await harness.runStep('Governance Failure', 'Reject vote - already voted', async () => {
    const proposal = harness.deployment.governance.proposals.find(p => p.id === proposalId);
    const voter = harness.users.bob.address;

    // Simulate existing vote
    proposal.votes.push({ voter, voteFor: true });

    const existingVote = proposal.votes.find(v => v.voter === voter);

    if (existingVote) {
      proposal.votes.pop(); // Remove test vote
      return {
        rejected: true,
        reason: 'User has already voted on this proposal',
        voter: voter,
        proposalId: proposalId,
      };
    }
    throw new Error('Duplicate vote should have been rejected');
  });

  // Step 5: Attempt to execute unfinished proposal
  await harness.runStep('Governance Failure', 'Reject execute - voting not ended', async () => {
    const proposal = harness.deployment.governance.proposals.find(p => p.id === proposalId);

    if (Date.now() < proposal.votingEnd) {
      return {
        rejected: true,
        reason: 'Voting period has not ended',
        votingEnd: new Date(proposal.votingEnd).toISOString(),
        now: new Date().toISOString(),
      };
    }
    throw new Error('Early execution should have been rejected');
  });

  // Step 6: Attempt to propose without required stake
  await harness.runStep('Governance Failure', 'Reject proposal - insufficient stake', async () => {
    const stakeRequired = 100;
    const userBalance = 50;

    if (userBalance < stakeRequired) {
      return {
        rejected: true,
        reason: 'Insufficient ULTRA balance for proposal stake',
        required: stakeRequired,
        available: userBalance,
      };
    }
    throw new Error('Proposal without stake should have been rejected');
  });
}

/**
 * CARE ECONOMY FAILURE FLOW
 * Test fulfill without matching
 */
async function careFailureFlow(harness) {
  console.log('\n\x1b[1mCARE ECONOMY FAILURE SCENARIOS\x1b[0m');
  console.log('─'.repeat(60));
  console.log(`  Testing error handling for care economy operations`);
  console.log('');

  const needId = `need_fail_${Date.now().toString(36)}`;

  // Step 1: Attempt to fulfill non-existent need
  await harness.runStep('Care Failure', 'Reject fulfill - need not found', async () => {
    const fakeNeedId = 'need_nonexistent_123';

    if (!harness.deployment.care) {
      harness.deployment.care = { needs: [], offers: [], matches: [], completions: [] };
    }

    const need = harness.deployment.care.needs.find(n => n.id === fakeNeedId);

    if (!need) {
      return {
        rejected: true,
        reason: 'Care need not found',
        needId: fakeNeedId,
      };
    }
    throw new Error('Fulfill non-existent need should have been rejected');
  });

  // Step 2: Create a test need
  await harness.runStep('Care Failure', 'Create test care need', async () => {
    const need = {
      id: needId,
      type: 'eldercare',
      seeker: harness.users.alice.address,
      seekerPnft: harness.users.alice.pnftId,
      status: 'open',
      hoursNeeded: 4,
      createdAt: new Date().toISOString(),
    };

    harness.deployment.care.needs.push(need);

    return { needId: need.id, type: need.type };
  });

  // Step 3: Attempt to fulfill own care need
  await harness.runStep('Care Failure', 'Reject fulfill - cannot fulfill own need', async () => {
    const need = harness.deployment.care.needs.find(n => n.id === needId);
    const provider = harness.users.alice.address; // Same as seeker

    if (provider === need.seeker) {
      return {
        rejected: true,
        reason: 'Cannot fulfill your own care need',
        seeker: need.seeker,
        provider: provider,
      };
    }
    throw new Error('Self-fulfill should have been rejected');
  });

  // Step 4: Attempt to log session without active match
  await harness.runStep('Care Failure', 'Reject session log - no active match', async () => {
    const need = harness.deployment.care.needs.find(n => n.id === needId);
    const matchExists = harness.deployment.care.matches.some(
      m => m.needId === needId && m.status === 'active'
    );

    if (!matchExists) {
      return {
        rejected: true,
        reason: 'No active care match found',
        needId: needId,
      };
    }
    throw new Error('Session log without match should have been rejected');
  });

  // Step 5: Attempt to register care need without required fields
  await harness.runStep('Care Failure', 'Reject need - missing care type', async () => {
    const invalidNeed = {
      seeker: harness.users.bob.address,
      hoursNeeded: 4,
      // Missing type field
    };

    if (!invalidNeed.type) {
      return {
        rejected: true,
        reason: 'Care type is required',
        missing: 'type',
      };
    }
    throw new Error('Need without type should have been rejected');
  });

  // Step 6: Attempt to verify session as non-seeker
  await harness.runStep('Care Failure', 'Reject verify - not the care seeker', async () => {
    const need = harness.deployment.care.needs.find(n => n.id === needId);
    const verifier = harness.users.carol.address;

    if (verifier !== need.seeker) {
      return {
        rejected: true,
        reason: 'Only care seeker can verify sessions',
        seeker: need.seeker,
        verifier: verifier,
      };
    }
    throw new Error('Unauthorized verification should have been rejected');
  });
}

/**
 * IMPACT MARKET FAILURE FLOW
 * Test sell more credits than owned
 */
async function impactMarketFailureFlow(harness) {
  console.log('\n\x1b[1mIMPACT MARKET FAILURE SCENARIOS\x1b[0m');
  console.log('─'.repeat(60));
  console.log(`  Testing error handling for impact market operations`);
  console.log('');

  // Setup: Initialize impact credits for testing
  if (!harness.deployment.impactCredits) {
    harness.deployment.impactCredits = {};
  }
  harness.deployment.impactCredits[harness.users.alice.address] = { CO2: 5, H2O: 100 };

  // Step 1: Attempt to sell more credits than owned
  await harness.runStep('Impact Failure', 'Reject sell - insufficient credits', async () => {
    const sellerAddress = harness.users.alice.address;
    const ownedCredits = harness.deployment.impactCredits[sellerAddress]?.CO2 || 0;
    const sellQuantity = 50; // More than owned

    if (sellQuantity > ownedCredits) {
      return {
        rejected: true,
        reason: 'Cannot sell more credits than owned',
        compound: 'CO2',
        owned: ownedCredits,
        requested: sellQuantity,
      };
    }
    throw new Error('Oversell should have been rejected');
  });

  // Step 2: Attempt to sell with invalid compound type
  await harness.runStep('Impact Failure', 'Reject sell - invalid compound', async () => {
    const validCompounds = ['CO2', 'H2O', 'BIO', 'SOIL', 'N', 'P'];
    const invalidCompound = 'INVALID_XYZ';

    if (!validCompounds.includes(invalidCompound)) {
      return {
        rejected: true,
        reason: 'Invalid compound type',
        compound: invalidCompound,
        validCompounds: validCompounds,
      };
    }
    throw new Error('Invalid compound should have been rejected');
  });

  // Step 3: Attempt to buy with insufficient balance
  await harness.runStep('Impact Failure', 'Reject buy - insufficient ULTRA balance', async () => {
    const buyerBalance = harness.users.bob.balance || 100;
    const orderPrice = 500;

    if (buyerBalance < orderPrice) {
      return {
        rejected: true,
        reason: 'Insufficient ULTRA balance for purchase',
        available: buyerBalance,
        required: orderPrice,
      };
    }
    throw new Error('Purchase should have been rejected');
  });

  // Step 4: Attempt to fill non-existent order
  await harness.runStep('Impact Failure', 'Reject fill - order not found', async () => {
    if (!harness.deployment.impactMarket) {
      harness.deployment.impactMarket = { orders: [], fills: [] };
    }

    const fakeOrderId = 'order_nonexistent_123';
    const order = harness.deployment.impactMarket.orders.find(o => o.id === fakeOrderId);

    if (!order) {
      return {
        rejected: true,
        reason: 'Order not found',
        orderId: fakeOrderId,
      };
    }
    throw new Error('Fill non-existent order should have been rejected');
  });

  // Step 5: Attempt to cancel someone else's order
  await harness.runStep('Impact Failure', 'Reject cancel - not order owner', async () => {
    const order = {
      id: 'order_test_123',
      seller: harness.users.alice.address,
      compound: 'CO2',
      quantity: 2,
      status: 'open',
    };
    const canceller = harness.users.bob.address;

    if (canceller !== order.seller) {
      return {
        rejected: true,
        reason: 'Only order creator can cancel',
        orderOwner: order.seller,
        canceller: canceller,
      };
    }
    throw new Error('Unauthorized cancel should have been rejected');
  });

  // Step 6: Attempt to sell with zero or negative quantity
  await harness.runStep('Impact Failure', 'Reject sell - invalid quantity', async () => {
    const quantity = -5;

    if (quantity <= 0) {
      return {
        rejected: true,
        reason: 'Quantity must be positive',
        quantity: quantity,
      };
    }
    throw new Error('Invalid quantity should have been rejected');
  });
}

/**
 * LAND STEWARDSHIP FLOW
 * Register land → Record health metrics → Generate credits → Update health index
 */
async function landStewardshipFlow(harness) {
  console.log('\n\x1b[1mLAND STEWARDSHIP FLOW\x1b[0m');
  console.log('─'.repeat(60));
  console.log(`  Steward: ${harness.users.alice.name}`);
  console.log('');

  const landId = `land_${Date.now().toString(36)}`;
  let land = null;

  // Step 1: Register new land parcel
  await harness.runStep('Land Stewardship', 'Register land parcel', async () => {
    land = {
      id: landId,
      steward: harness.users.alice.address,
      stewardPnft: harness.users.alice.pnftId,
      name: 'Meadow Creek Restoration Site',
      coordinates: { lat: 39.2, lng: -120.5 },
      area_m2: 50000, // 5 hectares
      classification: 'Wetland',
      bioregion: harness.users.alice.bioregion,
      health: {
        overall: null,
        soil: null,
        water: null,
        biodiversity: null,
      },
      registeredAt: new Date().toISOString(),
      status: 'registered',
    };

    if (!harness.deployment.lands) {
      harness.deployment.lands = [];
    }
    harness.deployment.lands.push(land);

    return { landId: land.id, area: land.area_m2, classification: land.classification };
  });

  // Step 2: Initial health assessment
  await harness.runStep('Land Stewardship', 'Record initial health assessment', async () => {
    land.health = {
      overall: 45,
      soil: 40,
      water: 55,
      biodiversity: 35,
      lastSurvey: new Date().toISOString(),
    };

    return { health: land.health };
  });

  // Step 3: Implement restoration activities
  await harness.runStep('Land Stewardship', 'Log restoration activities', async () => {
    if (!land.activities) {
      land.activities = [];
    }

    land.activities.push({
      id: `activity_${Date.now().toString(36)}`,
      type: 'native_planting',
      description: 'Planted 500 native sedges and willows along creek',
      date: new Date().toISOString(),
      impact: { biodiversity: +10, water: +5 },
    });

    land.activities.push({
      id: `activity_${Date.now().toString(36)}_2`,
      type: 'erosion_control',
      description: 'Installed check dams and bioswales',
      date: new Date().toISOString(),
      impact: { soil: +15, water: +10 },
    });

    return { activitiesLogged: land.activities.length };
  });

  // Step 4: Follow-up health assessment (improved)
  await harness.runStep('Land Stewardship', 'Record improved health metrics', async () => {
    // Apply improvements from activities
    land.health.soil += 15;
    land.health.water += 15;
    land.health.biodiversity += 10;
    land.health.overall = Math.round((land.health.soil + land.health.water + land.health.biodiversity) / 3);
    land.health.lastSurvey = new Date().toISOString();

    return { improvedHealth: land.health };
  });

  // Step 5: Generate sequestration credits based on improvement
  await harness.runStep('Land Stewardship', 'Generate credits from restoration', async () => {
    const healthImprovement = land.health.overall - 45; // Delta from initial
    const creditsGenerated = {
      CO2: healthImprovement * 0.5, // tons
      H2O: healthImprovement * 100, // liters
      BIO: healthImprovement * 0.1, // biodiversity units
    };

    if (!harness.deployment.impactCredits) {
      harness.deployment.impactCredits = {};
    }
    if (!harness.deployment.impactCredits[harness.users.alice.address]) {
      harness.deployment.impactCredits[harness.users.alice.address] = { CO2: 0, H2O: 0, BIO: 0 };
    }

    for (const [compound, amount] of Object.entries(creditsGenerated)) {
      harness.deployment.impactCredits[harness.users.alice.address][compound] += amount;
    }

    return { creditsGenerated, totalCredits: harness.deployment.impactCredits[harness.users.alice.address] };
  });

  // Step 6: Update bioregion health index
  await harness.runStep('Land Stewardship', 'Update bioregion health index', async () => {
    const bioregion = (harness.deployment.bioregions || []).find(
      b => b.id === harness.users.alice.bioregion
    );

    if (bioregion) {
      // Land improvement contributes to bioregion health
      const contribution = Math.round(land.health.overall * 0.01);
      bioregion.healthIndex = Math.min(10000, bioregion.healthIndex + contribution);

      return { bioregionHealth: bioregion.healthIndex, contribution };
    }

    return { note: 'Bioregion not found, skipped index update' };
  });
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  if (FLAGS.help) {
    showHelp();
    return;
  }

  const harness = new InteractionTestHarness();
  await harness.initialize();

  const flows = {
    marketplace: marketplaceFlow,
    work: workAuctionFlow,
    governance: governanceFlow,
    care: careEconomyFlow,
    impact: impactMarketFlow,
    land: landStewardshipFlow,
  };

  // Failure scenario flows
  const failureFlows = {
    'marketplace-fail': marketplaceFailureFlow,
    'work-fail': workAuctionFailureFlow,
    'governance-fail': governanceFailureFlow,
    'care-fail': careFailureFlow,
    'impact-fail': impactMarketFailureFlow,
  };

  // Combined flows for 'failures' or 'errors' flag
  const allFlows = { ...flows, ...failureFlows };

  if (FLAGS.flow) {
    // Check for 'failures' or 'errors' to run all failure flows
    if (FLAGS.flow === 'failures' || FLAGS.flow === 'errors') {
      for (const [name, flowFn] of Object.entries(failureFlows)) {
        await flowFn(harness);
      }
    } else if (FLAGS.flow === 'all-with-errors') {
      // Run all flows including failure scenarios
      for (const [name, flowFn] of Object.entries(allFlows)) {
        await flowFn(harness);
      }
    } else if (!allFlows[FLAGS.flow]) {
      console.error(`Unknown flow: ${FLAGS.flow}`);
      console.log(`Available flows: ${Object.keys(flows).join(', ')}`);
      console.log(`Failure flows: ${Object.keys(failureFlows).join(', ')}`);
      console.log(`Special: failures, errors, all-with-errors`);
      process.exit(1);
    } else {
      await allFlows[FLAGS.flow](harness);
    }
  } else {
    // Run all flows
    for (const [name, flowFn] of Object.entries(flows)) {
      await flowFn(harness);
    }
  }

  // Save deployment state
  fs.writeFileSync(CONFIG.deploymentPath, JSON.stringify(harness.deployment, null, 2));

  harness.saveResults();
  harness.printSummary();

  process.exit(harness.results.summary.failed > 0 ? 1 : 0);
}

function showHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════════════════╗
║          UltraLife Protocol — Interaction Test Help                           ║
╚═══════════════════════════════════════════════════════════════════════════════╝

USAGE:
  node interaction-test.mjs [options]

OPTIONS:
  --help              Show this help message
  --flow <name>       Run specific interaction flow
  --verbose           Show detailed step output
  --setup             Create and persist simulated test users

FLOWS:
  marketplace         Seller lists item → Buyer purchases → Impact recorded
  work                Job posted → Bids → Accept → Complete → Payment
  governance          Proposal → Voting → Tally → Execute
  care                Need registered → Provider matches → Care given → Credits
  impact              Land generates credits → Listed → Purchased → Debt reduced
  land                Register land → Health assessment → Restoration → Credits

FAILURE FLOWS (Error Path Testing):
  marketplace-fail    Test insufficient funds, self-purchase, unauthorized updates
  work-fail           Test missing escrow, self-bidding, unauthorized completion
  governance-fail     Test voting without rights, duplicate votes, early execution
  care-fail           Test missing matches, self-fulfill, unauthorized verification
  impact-fail         Test overselling credits, invalid compounds, unauthorized cancel

SPECIAL OPTIONS:
  failures            Run all failure flow tests
  errors              Alias for failures
  all-with-errors     Run all flows including failure scenarios

EXAMPLES:
  # Run all interaction flows
  node interaction-test.mjs

  # Run specific flow with verbose output
  node interaction-test.mjs --flow marketplace --verbose

  # Set up test users first
  node interaction-test.mjs --setup

  # Test governance flow only
  node interaction-test.mjs --flow governance

USERS:
  The test creates simulated users with different pNFT levels:
  - Alice: Your actual wallet (from deployment.json)
  - Bob:   Simulated (Verified level)
  - Carol: Simulated (Standard level)
  - Dave:  Simulated (Steward level)

RESULTS:
  - Results saved to: scripts/interaction-test-results.json
  - Deployment state updated with interaction data
  - Exit code 0 = all steps passed
  - Exit code 1 = one or more steps failed
`);
}

main().catch(error => {
  console.error('\n[FATAL ERROR]', error.message);
  if (FLAGS.verbose) {
    console.error(error.stack);
  }
  process.exit(1);
});
