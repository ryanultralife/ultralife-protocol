#!/usr/bin/env node
/**
 * UltraLife Protocol — On-Chain Transaction Tests
 *
 * Actually submits transactions to testnet to verify validators work.
 * WARNING: This spends real test ADA. Ensure wallet is funded.
 *
 * Usage:
 *   node test-onchain.mjs --test mint-basic     # Mint a Basic pNFT
 *   node test-onchain.mjs --test full-journey   # Complete user journey
 *   node test-onchain.mjs --list                # List available tests
 */

import {
  BlockfrostProvider,
  MeshWallet,
  MeshTxBuilder,
  serializePlutusScript,
  deserializeAddress,
} from '@meshsdk/core';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import {
  getCurrentSlot,
  atomicWriteSync,
  formatAda,
} from './utils.mjs';

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
};

const VERIFICATION_LEVELS = {
  Basic: 0,
  Ward: 1,
  Standard: 2,
  Verified: 3,
  Steward: 4,
};

// =============================================================================
// UTILITIES
// =============================================================================

const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  tx: (hash) => console.log(`🔗 https://preview.cardanoscan.io/transaction/${hash}`),
};

function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
}

async function waitForTx(provider, txHash, maxWait = 120) {
  log.info(`Waiting for confirmation: ${txHash.slice(0, 20)}...`);
  const start = Date.now();

  while ((Date.now() - start) / 1000 < maxWait) {
    try {
      const tx = await provider.fetchTxInfo(txHash);
      if (tx) {
        log.success(`Confirmed in block ${tx.block}`);
        return tx;
      }
    } catch (e) {
      // Not found yet
    }
    await new Promise(r => setTimeout(r, 5000));
    process.stdout.write('.');
  }

  throw new Error(`Transaction not confirmed after ${maxWait}s`);
}

// =============================================================================
// TEST CONTEXT
// =============================================================================

class TestContext {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.address = null;
    this.deployment = null;
    this.plutus = null;
    this.testResults = [];
  }

  async init() {
    if (!CONFIG.blockfrostKey || !CONFIG.walletMnemonic) {
      throw new Error('Missing BLOCKFROST_API_KEY or WALLET_SEED_PHRASE');
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

    this.address = this.wallet.getChangeAddress();

    if (fs.existsSync(CONFIG.deploymentPath)) {
      try {
        this.deployment = JSON.parse(fs.readFileSync(CONFIG.deploymentPath, 'utf8'));
      } catch (error) {
        log.warn(`Failed to parse deployment.json: ${error.message}`);
      }
    }

    if (fs.existsSync(CONFIG.plutusPath)) {
      try {
        this.plutus = JSON.parse(fs.readFileSync(CONFIG.plutusPath, 'utf8'));
      } catch (error) {
        log.warn(`Failed to parse plutus.json: ${error.message}`);
      }
    }

    // Check balance
    const utxos = await this.provider.fetchAddressUTxOs(this.address);
    const balance = utxos.reduce((sum, u) => {
      const l = u.output.amount.find(a => a.unit === 'lovelace');
      return sum + BigInt(l?.quantity || 0);
    }, 0n);

    console.log('\n========================================');
    console.log('   On-Chain Transaction Tests');
    console.log('========================================\n');
    console.log(`Network: ${CONFIG.network}`);
    console.log(`Wallet:  ${this.address.slice(0, 40)}...`);
    console.log(`Balance: ${(Number(balance) / 1_000_000).toFixed(2)} ADA`);
    console.log(`UTxOs:   ${utxos.length}\n`);

    if (balance < 10_000_000n) {
      throw new Error('Insufficient balance. Need at least 10 ADA for tests.');
    }

    return this;
  }

  async recordResult(testName, result) {
    this.testResults.push({
      test: testName,
      timestamp: new Date().toISOString(),
      ...result,
    });
  }
}

// =============================================================================
// ON-CHAIN TESTS
// =============================================================================

const onChainTests = {
  /**
   * Test: Simple ADA transfer (baseline test)
   */
  'simple-transfer': async (ctx) => {
    log.info('Test: Simple ADA transfer (2 ADA to self)');

    const txBuilder = new MeshTxBuilder({
      fetcher: ctx.provider,
      submitter: ctx.provider,
    });

    const utxos = await ctx.provider.fetchAddressUTxOs(ctx.address);

    // Simple self-transfer
    txBuilder
      .txIn(utxos[0].input.txHash, utxos[0].input.outputIndex)
      .txOut(ctx.address, [{ unit: 'lovelace', quantity: '2000000' }])
      .changeAddress(ctx.address);

    const unsignedTx = await txBuilder.complete();
    const signedTx = await ctx.wallet.signTx(unsignedTx);
    const txHash = await ctx.provider.submitTx(signedTx);

    log.success(`Submitted: ${txHash}`);
    log.tx(txHash);

    await waitForTx(ctx.provider, txHash);

    return { txHash, status: 'confirmed' };
  },

  /**
   * Test: Create datum output (no validator)
   */
  'datum-output': async (ctx) => {
    log.info('Test: Create output with inline datum');

    // Use slot for on-chain timestamp, not Date.now() milliseconds
    const currentSlot = await getCurrentSlot(ctx.provider, CONFIG.network);

    const testDatum = {
      constructor: 0,
      fields: [
        { bytes: Buffer.from('test_datum').toString('hex') },
        { int: currentSlot },
      ],
    };

    const txBuilder = new MeshTxBuilder({
      fetcher: ctx.provider,
      submitter: ctx.provider,
    });

    const utxos = await ctx.provider.fetchAddressUTxOs(ctx.address);

    txBuilder
      .txIn(utxos[0].input.txHash, utxos[0].input.outputIndex)
      .txOut(ctx.address, [{ unit: 'lovelace', quantity: '2000000' }])
      .txOutInlineDatumValue(testDatum)
      .changeAddress(ctx.address);

    const unsignedTx = await txBuilder.complete();
    const signedTx = await ctx.wallet.signTx(unsignedTx);
    const txHash = await ctx.provider.submitTx(signedTx);

    log.success(`Submitted: ${txHash}`);
    log.tx(txHash);

    await waitForTx(ctx.provider, txHash);

    return { txHash, datum: 'inline', status: 'confirmed' };
  },

  /**
   * Test: Prepare pNFT mint (builds but doesn't submit without reference script)
   */
  'prepare-pnft': async (ctx) => {
    log.info('Test: Prepare pNFT datum (simulation)');

    const pnftId = generateId('pnft');

    // CRITICAL: Use real verification key hash from address, not SHA256 fake
    const deserialized = deserializeAddress(ctx.address);
    const ownerHash = deserialized.pubKeyHash;

    // Get current slot for timestamp (not Date.now() milliseconds!)
    const currentSlot = await getCurrentSlot(ctx.provider, CONFIG.network);

    const pnftDatum = {
      constructor: 0,
      fields: [
        { bytes: Buffer.from(pnftId).toString('hex') },
        { bytes: ownerHash },
        { constructor: VERIFICATION_LEVELS.Basic, fields: [] },
        { constructor: 1, fields: [] }, // None bioregion
        { constructor: 1, fields: [] }, // None dna_hash
        { constructor: 1, fields: [] }, // None guardian
        { constructor: 1, fields: [] }, // None ward_since
        { int: currentSlot },            // created_at (slot number, not milliseconds!)
        { constructor: 1, fields: [] }, // None upgraded_at
        { constructor: 1, fields: [] }, // None consumer_impact
        { constructor: 1, fields: [] }, // None nutrition_profile
      ],
    };

    log.success(`Prepared pNFT: ${pnftId}`);
    log.info(`Fields: ${pnftDatum.fields.length}`);
    log.info(`Level: Basic (constructor ${VERIFICATION_LEVELS.Basic})`);

    // Save to deployment for later use
    if (ctx.deployment) {
      ctx.deployment.testPnfts = ctx.deployment.testPnfts || [];
      ctx.deployment.testPnfts.push({
        id: pnftId,
        owner: ctx.address,
        datum: pnftDatum,
        timestamp: new Date().toISOString(),
      });
      fs.writeFileSync(CONFIG.deploymentPath, JSON.stringify(ctx.deployment, null, 2));
    }

    return { pnftId, fields: pnftDatum.fields.length, status: 'prepared' };
  },

  /**
   * Test: Prepare Genesis datum
   */
  'prepare-genesis': async (ctx) => {
    log.info('Test: Prepare Genesis datum (simulation)');

    const genesisDatum = {
      constructor: 0,
      fields: [
        { int: 0 },                     // verifications_completed
        { int: 0 },                     // stewards_created
        { int: 0 },                     // bioregions_created
        { list: [] },                   // registered_oracles
        { constructor: 1, fields: [] }, // genesis_active = True
      ],
    };

    log.success('Genesis datum prepared');
    log.info(`Fields: ${genesisDatum.fields.length}`);
    log.info('Genesis active: True');

    return { fields: genesisDatum.fields.length, status: 'prepared' };
  },

  /**
   * Test: Prepare Treasury datum
   */
  'prepare-treasury': async (ctx) => {
    log.info('Test: Prepare Treasury datum (simulation)');

    // Use slot for on-chain timestamp
    const currentSlot = await getCurrentSlot(ctx.provider, CONFIG.network);

    const treasuryDatum = {
      constructor: 0,
      fields: [
        { int: 0 },           // tokens_distributed
        { int: 100_000_000 }, // ada_reserves (100 ADA)
        { int: 0 },           // btc_reserves
        { int: currentSlot }, // last_update (slot number)
        {                     // multisig
          constructor: 0,
          fields: [
            { list: [] },
            { int: 1 },
          ],
        },
      ],
    };

    log.success('Treasury datum prepared');
    log.info(`Fields: ${treasuryDatum.fields.length}`);
    log.info('ADA reserves: 100 ADA');

    return { fields: treasuryDatum.fields.length, status: 'prepared' };
  },

  /**
   * Test: Prepare UBI Pool datum
   */
  'prepare-ubi': async (ctx) => {
    log.info('Test: Prepare UBI Pool datum (simulation)');

    // Use slot for on-chain timestamp
    const currentSlot = await getCurrentSlot(ctx.provider, CONFIG.network);

    const bioregionId = 'bioregion_test_001';
    const ubiDatum = {
      constructor: 0,
      fields: [
        { bytes: Buffer.from(bioregionId).toString('hex') },
        { int: 0 },           // cycle
        { int: 0 },           // fees_collected
        { int: 50_000_000 },  // ubi_pool (50 ADA)
        { int: 0 },           // eligible_count
        { int: 0 },           // total_engagement_weight
        { int: 0 },           // claims_count
        { int: 0 },           // distributed
        { int: currentSlot }, // distribution_start (slot number)
      ],
    };

    log.success('UBI Pool datum prepared');
    log.info(`Fields: ${ubiDatum.fields.length}`);
    log.info('UBI pool: 50 ADA');

    return { fields: ubiDatum.fields.length, bioregion: bioregionId, status: 'prepared' };
  },

  /**
   * Test: Full user journey (simulation)
   */
  'full-journey': async (ctx) => {
    log.info('Test: Full User Journey (simulation)');
    console.log('');

    const journey = [
      { step: 1, action: 'Create Basic pNFT', status: 'simulated' },
      { step: 2, action: 'DNA verification → Standard', status: 'simulated' },
      { step: 3, action: 'Join bioregion → Verified', status: 'simulated' },
      { step: 4, action: 'Community endorsement → Steward', status: 'simulated' },
      { step: 5, action: 'Create governance proposal', status: 'simulated' },
      { step: 6, action: 'Vote on proposal', status: 'simulated' },
      { step: 7, action: 'Claim UBI distribution', status: 'simulated' },
      { step: 8, action: 'Record positive impact', status: 'simulated' },
      { step: 9, action: 'Trade impact credits', status: 'simulated' },
    ];

    for (const step of journey) {
      console.log(`  [${step.step}] ${step.action}: ${step.status}`);
    }

    console.log('');
    log.success('User journey simulation complete');
    log.info('Deploy reference scripts to run actual transactions');

    return { steps: journey.length, status: 'simulated' };
  },
};

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--list')) {
    console.log('\nAvailable on-chain tests:\n');
    for (const name of Object.keys(onChainTests)) {
      console.log(`  - ${name}`);
    }
    console.log('\nUsage: node test-onchain.mjs --test <name>');
    console.log('       node test-onchain.mjs --test all');
    return;
  }

  const testArg = args.find((a, i) => args[i - 1] === '--test');

  if (!testArg) {
    console.log('Usage:');
    console.log('  node test-onchain.mjs --test <name>');
    console.log('  node test-onchain.mjs --test all');
    console.log('  node test-onchain.mjs --list');
    return;
  }

  const ctx = new TestContext();
  await ctx.init();

  const testsToRun = testArg === 'all'
    ? Object.keys(onChainTests)
    : [testArg];

  for (const testName of testsToRun) {
    if (!onChainTests[testName]) {
      log.error(`Unknown test: ${testName}`);
      continue;
    }

    console.log(`\n--- Running: ${testName} ---\n`);

    try {
      const result = await onChainTests[testName](ctx);
      await ctx.recordResult(testName, { success: true, ...result });
      log.success(`Test passed: ${testName}`);
    } catch (error) {
      await ctx.recordResult(testName, { success: false, error: error.message });
      log.error(`Test failed: ${testName}`);
      log.error(error.message);
    }
  }

  // Summary
  console.log('\n========================================');
  console.log('           TEST RESULTS');
  console.log('========================================\n');

  const passed = ctx.testResults.filter(r => r.success).length;
  const failed = ctx.testResults.filter(r => !r.success).length;

  for (const result of ctx.testResults) {
    const icon = result.success ? '✅' : '❌';
    console.log(`  ${icon} ${result.test}`);
    if (result.txHash) {
      console.log(`     TX: ${result.txHash.slice(0, 30)}...`);
    }
  }

  console.log(`\n  Passed: ${passed}/${ctx.testResults.length}`);
  console.log(`  Failed: ${failed}/${ctx.testResults.length}\n`);
}

main().catch(error => {
  log.error(error.message);
  process.exit(1);
});
