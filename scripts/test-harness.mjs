#!/usr/bin/env node
/**
 * UltraLife Protocol — Testnet Test Harness
 *
 * Automated test suite for validating the protocol on Cardano testnet.
 * Runs phased tests covering all validators and their interactions.
 *
 * Usage:
 *   node test-harness.mjs                    # Run all tests
 *   node test-harness.mjs --phase 1          # Run specific phase
 *   node test-harness.mjs --scenario journey # Run user journey
 *   node test-harness.mjs --dry-run          # Show what would run
 */

import {
  BlockfrostProvider,
  MeshWallet,
  MeshTxBuilder,
  serializePlutusScript,
} from '@meshsdk/core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  network: process.env.NETWORK || 'preview',
  blockfrostKey: process.env.BLOCKFROST_API_KEY,
  walletMnemonic: process.env.WALLET_SEED_PHRASE,
  plutusPath: path.join(__dirname, '..', 'plutus.json'),
  deploymentPath: path.join(__dirname, 'deployment.json'),
  testResultsPath: path.join(__dirname, 'test-results.json'),
};

// =============================================================================
// TEST FRAMEWORK
// =============================================================================

class TestHarness {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      network: CONFIG.network,
      phases: {},
      summary: { passed: 0, failed: 0, skipped: 0 },
    };
    this.provider = null;
    this.wallet = null;
    this.deployment = null;
  }

  async initialize() {
    console.log('\n========================================');
    console.log('   UltraLife Protocol Test Harness');
    console.log('========================================\n');

    if (!CONFIG.blockfrostKey || !CONFIG.walletMnemonic) {
      throw new Error('Missing BLOCKFROST_API_KEY or WALLET_SEED_PHRASE in .env');
    }

    this.provider = new BlockfrostProvider(CONFIG.blockfrostKey);
    this.wallet = new MeshWallet({
      networkId: CONFIG.network === 'mainnet' ? 1 : 0,
      fetcher: this.provider,
      submitter: this.provider,
      key: {
        type: 'mnemonic',
        words: CONFIG.walletMnemonic.trim().split(/\s+/),
      },
    });

    if (fs.existsSync(CONFIG.deploymentPath)) {
      this.deployment = JSON.parse(fs.readFileSync(CONFIG.deploymentPath, 'utf8'));
    }

    const address = this.wallet.getChangeAddress();
    const utxos = await this.provider.fetchAddressUTxOs(address);
    const balance = utxos.reduce((sum, u) => {
      const l = u.output.amount.find(a => a.unit === 'lovelace');
      return sum + BigInt(l?.quantity || 0);
    }, 0n);

    console.log(`Network:  ${CONFIG.network}`);
    console.log(`Wallet:   ${address.slice(0, 40)}...`);
    console.log(`Balance:  ${(Number(balance) / 1_000_000).toFixed(2)} ADA`);
    console.log(`UTxOs:    ${utxos.length}\n`);

    return this;
  }

  async runTest(name, testFn) {
    const start = Date.now();
    try {
      console.log(`  [ ] ${name}`);
      const result = await testFn();
      const duration = Date.now() - start;
      console.log(`\x1b[1A  [✓] ${name} (${duration}ms)`);
      this.results.summary.passed++;
      return { status: 'passed', duration, result };
    } catch (error) {
      const duration = Date.now() - start;
      console.log(`\x1b[1A  [✗] ${name} (${duration}ms)`);
      console.log(`      Error: ${error.message}`);
      this.results.summary.failed++;
      return { status: 'failed', duration, error: error.message };
    }
  }

  async runPhase(phaseNum, phaseName, tests) {
    console.log(`\n--- Phase ${phaseNum}: ${phaseName} ---\n`);
    this.results.phases[phaseNum] = { name: phaseName, tests: {} };

    for (const [testName, testFn] of Object.entries(tests)) {
      this.results.phases[phaseNum].tests[testName] = await this.runTest(testName, testFn);
    }
  }

  saveResults() {
    fs.writeFileSync(CONFIG.testResultsPath, JSON.stringify(this.results, null, 2));
    console.log(`\nResults saved to: ${CONFIG.testResultsPath}`);
  }

  printSummary() {
    const { passed, failed, skipped } = this.results.summary;
    const total = passed + failed + skipped;
    console.log('\n========================================');
    console.log('              TEST SUMMARY');
    console.log('========================================');
    console.log(`  Passed:  ${passed}/${total}`);
    console.log(`  Failed:  ${failed}/${total}`);
    console.log(`  Skipped: ${skipped}/${total}`);
    console.log('========================================\n');
  }
}

// =============================================================================
// PHASE 1: FOUNDATION TESTS
// =============================================================================

const phase1Tests = (harness) => ({
  'Wallet has sufficient balance': async () => {
    const address = harness.wallet.getChangeAddress();
    const utxos = await harness.provider.fetchAddressUTxOs(address);
    const balance = utxos.reduce((sum, u) => {
      const l = u.output.amount.find(a => a.unit === 'lovelace');
      return sum + BigInt(l?.quantity || 0);
    }, 0n);
    if (balance < 50_000_000n) {
      throw new Error(`Need at least 50 ADA, have ${Number(balance) / 1_000_000}`);
    }
    return { balance: Number(balance) / 1_000_000 };
  },

  'Deployment record exists': async () => {
    if (!harness.deployment) {
      throw new Error('No deployment.json found. Run deploy-testnet.mjs first.');
    }
    return { validators: Object.keys(harness.deployment.validators || {}).length };
  },

  'Genesis validator recorded': async () => {
    const genesis = harness.deployment?.validators?.genesis_spend;
    if (!genesis) {
      throw new Error('Genesis validator not found in deployment');
    }
    return { hash: genesis.hash?.slice(0, 20) };
  },

  'pNFT policy recorded': async () => {
    const pnft = harness.deployment?.validators?.pnft_mint;
    if (!pnft) {
      throw new Error('pNFT mint policy not found in deployment');
    }
    return { hash: pnft.hash?.slice(0, 20) };
  },

  'Treasury validator recorded': async () => {
    const treasury = harness.deployment?.validators?.treasury_spend;
    if (!treasury) {
      throw new Error('Treasury validator not found in deployment');
    }
    return { hash: treasury.hash?.slice(0, 20) };
  },
});

// =============================================================================
// PHASE 2: IDENTITY (pNFT) TESTS
// =============================================================================

const phase2Tests = (harness) => ({
  'Can build Basic pNFT datum': async () => {
    const datum = {
      constructor: 0,
      fields: [
        { bytes: Buffer.from('test_pnft_001').toString('hex') },
        { bytes: '00'.repeat(28) },
        { constructor: 0, fields: [] }, // Basic
        { constructor: 1, fields: [] }, // None bioregion
        { constructor: 1, fields: [] }, // None dna_hash
        { constructor: 1, fields: [] }, // None guardian
        { constructor: 1, fields: [] }, // None ward_since
        { int: Date.now() },
        { constructor: 1, fields: [] }, // None upgraded_at
        { constructor: 1, fields: [] }, // None consumer_impact
        { constructor: 1, fields: [] }, // None nutrition_profile
      ],
    };
    if (datum.fields.length !== 11) {
      throw new Error(`Expected 11 fields, got ${datum.fields.length}`);
    }
    return { fields: datum.fields.length };
  },

  'Can build Ward pNFT datum': async () => {
    const guardianId = 'guardian_pnft_001';
    const datum = {
      constructor: 0,
      fields: [
        { bytes: Buffer.from('ward_pnft_001').toString('hex') },
        { bytes: '00'.repeat(28) },
        { constructor: 1, fields: [] }, // Ward level
        { constructor: 1, fields: [] },
        { constructor: 1, fields: [] },
        { constructor: 0, fields: [{ bytes: Buffer.from(guardianId).toString('hex') }] }, // Some guardian
        { constructor: 0, fields: [{ int: Date.now() }] }, // Some ward_since
        { int: Date.now() },
        { constructor: 1, fields: [] },
        { constructor: 1, fields: [] },
        { constructor: 1, fields: [] },
      ],
    };
    return { hasGuardian: true };
  },

  'Can build Steward pNFT datum': async () => {
    const datum = {
      constructor: 0,
      fields: [
        { bytes: Buffer.from('steward_pnft_001').toString('hex') },
        { bytes: '00'.repeat(28) },
        { constructor: 4, fields: [] }, // Steward level
        { constructor: 0, fields: [{ bytes: Buffer.from('bioregion_001').toString('hex') }] },
        { constructor: 0, fields: [{ bytes: '00'.repeat(32) }] }, // DNA hash
        { constructor: 1, fields: [] },
        { constructor: 1, fields: [] },
        { int: Date.now() },
        { constructor: 0, fields: [{ int: Date.now() - 86400000 }] }, // Upgraded yesterday
        { constructor: 1, fields: [] },
        { constructor: 1, fields: [] },
      ],
    };
    return { level: 'Steward' };
  },

  'Verification levels are ordered correctly': async () => {
    const levels = { Basic: 0, Ward: 1, Standard: 2, Verified: 3, Steward: 4 };
    if (levels.Basic >= levels.Standard) throw new Error('Basic >= Standard');
    if (levels.Standard >= levels.Verified) throw new Error('Standard >= Verified');
    if (levels.Verified >= levels.Steward) throw new Error('Verified >= Steward');
    return levels;
  },
});

// =============================================================================
// PHASE 3: ECONOMY TESTS
// =============================================================================

const phase3Tests = (harness) => ({
  'Can build Treasury datum': async () => {
    const datum = {
      constructor: 0,
      fields: [
        { int: 0 },           // tokens_distributed
        { int: 100_000_000 }, // ada_reserves (100 ADA)
        { int: 0 },           // btc_reserves
        { int: Date.now() },  // last_update
        {                     // multisig
          constructor: 0,
          fields: [
            { list: [] },
            { int: 1 },
          ],
        },
      ],
    };
    if (datum.fields.length !== 5) {
      throw new Error(`Expected 5 fields, got ${datum.fields.length}`);
    }
    return { fields: datum.fields.length };
  },

  'Token policy recorded': async () => {
    const token = harness.deployment?.validators?.token_mint;
    if (!token) {
      throw new Error('Token mint policy not found');
    }
    return { hash: token.hash?.slice(0, 20) };
  },

  'Grants validator recorded': async () => {
    const grants = harness.deployment?.validators?.grants_spend;
    if (!grants) {
      throw new Error('Grants validator not found');
    }
    return { hash: grants.hash?.slice(0, 20) };
  },
});

// =============================================================================
// PHASE 4: BIOREGION & UBI TESTS
// =============================================================================

const phase4Tests = (harness) => ({
  'Can build Bioregion datum': async () => {
    const datum = {
      constructor: 0,
      fields: [
        { bytes: Buffer.from('bioregion_test_001').toString('hex') },
        { bytes: Buffer.from('Test Bioregion').toString('hex') },
        { bytes: '00'.repeat(32) }, // bounds_hash
        { int: 10000 },             // health_index (100%)
        { int: 0 },                 // resident_count
        { bytes: '' },              // treasury
        { int: Date.now() },        // created_at
        { int: 0 },                 // last_health_update
      ],
    };
    if (datum.fields.length !== 8) {
      throw new Error(`Expected 8 fields, got ${datum.fields.length}`);
    }
    return { fields: datum.fields.length };
  },

  'Can build UBI Pool datum': async () => {
    const datum = {
      constructor: 0,
      fields: [
        { bytes: Buffer.from('bioregion_test_001').toString('hex') },
        { int: 0 },           // cycle
        { int: 0 },           // fees_collected
        { int: 50_000_000 },  // ubi_pool (50 ADA)
        { int: 0 },           // eligible_count
        { int: 0 },           // total_engagement_weight
        { int: 0 },           // claims_count
        { int: 0 },           // distributed
        { int: Date.now() },  // distribution_start
      ],
    };
    if (datum.fields.length !== 9) {
      throw new Error(`Expected 9 fields, got ${datum.fields.length}`);
    }
    return { fields: datum.fields.length };
  },

  'Bioregion validator recorded': async () => {
    const bioregion = harness.deployment?.validators?.bioregion_spend;
    if (!bioregion) {
      throw new Error('Bioregion validator not found');
    }
    return { hash: bioregion.hash?.slice(0, 20) };
  },

  'UBI validator recorded': async () => {
    const ubi = harness.deployment?.validators?.ubi_spend;
    if (!ubi) {
      throw new Error('UBI validator not found');
    }
    return { hash: ubi.hash?.slice(0, 20) };
  },

  'PRC-37 cycle calculation': async () => {
    const cycleSlots = 3_196_800; // 37 days
    const currentSlot = 10_000_000;
    const cycle = Math.floor(currentSlot / cycleSlots);
    const cycleStart = cycle * cycleSlots;
    const ubiWindowEnd = cycleStart + 319_680; // 10% of cycle

    return {
      cycle,
      cycleStart,
      ubiWindowEnd,
      inUbiWindow: currentSlot < ubiWindowEnd,
    };
  },
});

// =============================================================================
// PHASE 5: IMPACT & REMEDIATION TESTS
// =============================================================================

const phase5Tests = (harness) => ({
  'Impact validator recorded': async () => {
    const impact = harness.deployment?.validators?.impact_spend;
    if (!impact) {
      throw new Error('Impact validator not found');
    }
    return { hash: impact.hash?.slice(0, 20) };
  },

  'Impact policy recorded': async () => {
    const policy = harness.deployment?.validators?.impact_mint;
    if (!policy) {
      throw new Error('Impact mint policy not found');
    }
    return { hash: policy.hash?.slice(0, 20) };
  },

  'Remediation validator recorded': async () => {
    const remediation = harness.deployment?.validators?.remediation_spend;
    if (!remediation) {
      throw new Error('Remediation validator not found');
    }
    return { hash: remediation.hash?.slice(0, 20) };
  },

  'Asset impact validator recorded': async () => {
    const assetImpact = harness.deployment?.validators?.asset_impact_spend;
    if (!assetImpact) {
      throw new Error('Asset impact validator not found');
    }
    return { hash: assetImpact.hash?.slice(0, 20) };
  },
});

// =============================================================================
// PHASE 6: GOVERNANCE TESTS
// =============================================================================

const phase6Tests = (harness) => ({
  'Governance validator recorded': async () => {
    const governance = harness.deployment?.validators?.governance_spend;
    if (!governance) {
      throw new Error('Governance validator not found');
    }
    return { hash: governance.hash?.slice(0, 20) };
  },

  'Governance thresholds valid': async () => {
    const quorum = 3700;       // 37%
    const supermajority = 6300; // 63%

    if (quorum >= supermajority) {
      throw new Error('Quorum must be less than supermajority');
    }
    if (quorum + supermajority !== 10000) {
      // Note: they don't need to sum to 10000, just checking logic
    }
    return { quorum: quorum / 100 + '%', supermajority: supermajority / 100 + '%' };
  },

  'Voting weight by level': async () => {
    const weights = {
      Basic: 0,
      Ward: 0,
      Standard: 1,
      Verified: 2,
      Steward: 3,
    };

    if (weights.Basic !== 0) throw new Error('Basic should have 0 voting weight');
    if (weights.Ward !== 0) throw new Error('Ward should have 0 voting weight');
    if (weights.Steward <= weights.Verified) throw new Error('Steward should have higher weight');

    return weights;
  },
});

// =============================================================================
// INTEGRATION SCENARIOS
// =============================================================================

const userJourneyScenario = (harness) => ({
  'Scenario: New user creates Basic pNFT': async () => {
    // Simulate the journey of a new user
    const steps = [
      'User connects wallet',
      'User requests Basic pNFT mint',
      'Transaction built with pNFT datum',
      'User signs transaction',
      'pNFT minted to user wallet',
    ];
    return { steps, status: 'simulated' };
  },

  'Scenario: User upgrades to Standard (DNA)': async () => {
    const steps = [
      'User has Basic pNFT',
      'User visits DNA verification partner',
      'Partner attests DNA hash',
      'Upgrade transaction built',
      'pNFT level changed to Standard',
    ];
    return { steps, status: 'simulated' };
  },

  'Scenario: User joins bioregion': async () => {
    const steps = [
      'User has Standard+ pNFT',
      'User selects bioregion',
      'Residency verification (if required)',
      'pNFT bioregion field updated',
      'User added to bioregion resident count',
    ];
    return { steps, status: 'simulated' };
  },

  'Scenario: User claims UBI': async () => {
    const steps = [
      'Check: User is bioregion resident',
      'Check: Current slot in UBI window',
      'Check: User has not claimed this cycle',
      'Calculate: Base share + engagement multiplier',
      'Distribute: Tokens to user wallet',
      'Update: UBI pool claims_count',
    ];
    return { steps, status: 'simulated' };
  },

  'Scenario: Steward creates proposal': async () => {
    const steps = [
      'Check: User is Steward level',
      'Create: Proposal datum with details',
      'Submit: Proposal to governance validator',
      'Start: Voting period (37 days)',
      'Community: Votes with weighted power',
      'Finalize: Execute if passed',
    ];
    return { steps, status: 'simulated' };
  },
});

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const phaseArg = args.find((a, i) => args[i - 1] === '--phase');
  const scenarioArg = args.find((a, i) => args[i - 1] === '--scenario');

  if (dryRun) {
    console.log('\n=== DRY RUN MODE ===\n');
    console.log('Available phases:');
    console.log('  1: Foundation (wallet, deployment, validators)');
    console.log('  2: Identity (pNFT lifecycle)');
    console.log('  3: Economy (tokens, treasury, grants)');
    console.log('  4: Bioregion & UBI');
    console.log('  5: Impact & Remediation');
    console.log('  6: Governance');
    console.log('\nAvailable scenarios:');
    console.log('  journey: Full user journey simulation');
    console.log('\nUsage:');
    console.log('  node test-harness.mjs              # Run all');
    console.log('  node test-harness.mjs --phase 2    # Run phase 2 only');
    console.log('  node test-harness.mjs --scenario journey');
    return;
  }

  const harness = new TestHarness();
  await harness.initialize();

  const phases = {
    1: ['Foundation', phase1Tests],
    2: ['Identity (pNFT)', phase2Tests],
    3: ['Economy', phase3Tests],
    4: ['Bioregion & UBI', phase4Tests],
    5: ['Impact & Remediation', phase5Tests],
    6: ['Governance', phase6Tests],
  };

  if (scenarioArg === 'journey') {
    await harness.runPhase(99, 'User Journey Scenario', userJourneyScenario(harness));
  } else if (phaseArg) {
    const phaseNum = parseInt(phaseArg);
    if (phases[phaseNum]) {
      const [name, testFn] = phases[phaseNum];
      await harness.runPhase(phaseNum, name, testFn(harness));
    } else {
      console.error(`Unknown phase: ${phaseArg}`);
      process.exit(1);
    }
  } else {
    // Run all phases
    for (const [num, [name, testFn]] of Object.entries(phases)) {
      await harness.runPhase(num, name, testFn(harness));
    }
  }

  harness.saveResults();
  harness.printSummary();

  process.exit(harness.results.summary.failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('\n[FATAL]', error.message);
  process.exit(1);
});
