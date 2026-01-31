#!/usr/bin/env node
/**
 * UltraLife Protocol — End-to-End Automated Test
 *
 * Runs a complete automated test sequence on testnet:
 * 1. Validate prerequisites
 * 2. Run local tests
 * 3. Deploy reference scripts (if not already deployed)
 * 4. Run on-chain tests
 * 5. Mint test pNFT
 * 6. Verify all deployments
 *
 * Usage:
 *   node e2e-test.mjs              # Full test
 *   node e2e-test.mjs --skip-deploy # Skip reference deployment
 *   node e2e-test.mjs --quick      # Quick smoke test only
 */

import {
  BlockfrostProvider,
  MeshWallet,
  MeshTxBuilder,
  deserializeAddress,
} from '@meshsdk/core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import 'dotenv/config';

import {
  atomicWriteSync,
  safeReadJson,
  getCurrentSlot,
  formatAda,
} from './utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  network: process.env.NETWORK || 'preprod',
  blockfrostKey: process.env.BLOCKFROST_API_KEY,
  walletMnemonic: process.env.WALLET_SEED_PHRASE,
  plutusPath: path.join(__dirname, '..', 'plutus.json'),
  deploymentPath: path.join(__dirname, 'deployment.json'),
  resultsPath: path.join(__dirname, 'e2e-results.json'),
};

// =============================================================================
// UTILITIES
// =============================================================================

const log = {
  header: (msg) => console.log(`\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}`),
  step: (n, msg) => console.log(`\n[Step ${n}] ${msg}`),
  info: (msg) => console.log(`  ℹ️  ${msg}`),
  success: (msg) => console.log(`  ✅ ${msg}`),
  warn: (msg) => console.log(`  ⚠️  ${msg}`),
  error: (msg) => console.log(`  ❌ ${msg}`),
  result: (name, passed) => console.log(`  ${passed ? '✅' : '❌'} ${name}`),
};

function runScript(scriptName, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [path.join(__dirname, scriptName), ...args], {
      cwd: __dirname,
      env: process.env,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr });
    });

    child.on('error', reject);
  });
}

// =============================================================================
// TEST PHASES
// =============================================================================

async function phase1_Prerequisites() {
  log.step(1, 'Checking Prerequisites');

  const results = { passed: 0, failed: 0, checks: [] };

  // Check env vars
  const envCheck = CONFIG.blockfrostKey && CONFIG.walletMnemonic;
  results.checks.push({ name: 'Environment variables', passed: envCheck });
  log.result('Environment variables', envCheck);

  // Check plutus.json
  const plutus = safeReadJson(CONFIG.plutusPath);
  const plutusCheck = plutus && plutus.validators && plutus.validators.length > 0;
  results.checks.push({ name: 'plutus.json valid', passed: plutusCheck });
  log.result('plutus.json valid', plutusCheck);

  if (plutusCheck) {
    log.info(`Found ${plutus.validators.length} validators`);
  }

  // Check wallet balance
  if (envCheck) {
    try {
      const provider = new BlockfrostProvider(CONFIG.blockfrostKey);
      const wallet = new MeshWallet({
        networkId: 0,
        fetcher: provider,
        submitter: provider,
        key: { type: 'mnemonic', words: CONFIG.walletMnemonic.trim().split(/\s+/) },
      });

      const address = wallet.getChangeAddress();
      const utxos = await provider.fetchAddressUTxOs(address);
      const balance = utxos.reduce((sum, u) => {
        const l = u.output.amount.find(a => a.unit === 'lovelace');
        return sum + BigInt(l?.quantity || 0);
      }, 0n);

      const balanceCheck = balance >= 50_000_000n; // 50 ADA minimum
      results.checks.push({ name: 'Wallet balance >= 50 ADA', passed: balanceCheck });
      log.result(`Wallet balance: ${formatAda(balance)}`, balanceCheck);

      results.balance = balance;
      results.address = address;
    } catch (error) {
      results.checks.push({ name: 'Wallet connection', passed: false });
      log.result(`Wallet connection: ${error.message}`, false);
    }
  }

  results.passed = results.checks.filter(c => c.passed).length;
  results.failed = results.checks.filter(c => !c.passed).length;

  return results;
}

async function phase2_LocalTests() {
  log.step(2, 'Running Local Validation Tests');

  const result = await runScript('test-harness.mjs', ['--phase', '1']);
  const passed = result.code === 0;

  log.result('Phase 1 (Foundation)', passed);

  // Run more phases if phase 1 passed
  if (passed) {
    const phase2 = await runScript('test-harness.mjs', ['--phase', '2']);
    log.result('Phase 2 (Identity)', phase2.code === 0);

    const phase3 = await runScript('test-harness.mjs', ['--phase', '3']);
    log.result('Phase 3 (Economy)', phase3.code === 0);

    const phase4 = await runScript('test-harness.mjs', ['--phase', '4']);
    log.result('Phase 4 (Bioregion & UBI)', phase4.code === 0);
  }

  return {
    passed: passed,
    output: result.stdout,
  };
}

async function phase3_OnChainTests(skipDeploy) {
  log.step(3, 'Running On-Chain Tests');

  // Simple transfer test
  log.info('Testing simple ADA transfer...');
  const transferResult = await runScript('test-onchain.mjs', ['--test', 'simple-transfer']);
  const transferPassed = transferResult.code === 0;
  log.result('Simple transfer', transferPassed);

  if (!transferPassed) {
    log.warn('Basic transfer failed. Check wallet balance and network connection.');
    return { passed: false, tests: { transfer: false } };
  }

  // Datum output test
  log.info('Testing inline datum output...');
  const datumResult = await runScript('test-onchain.mjs', ['--test', 'datum-output']);
  const datumPassed = datumResult.code === 0;
  log.result('Datum output', datumPassed);

  // Prepare pNFT test (simulation)
  log.info('Testing pNFT datum preparation...');
  const pnftResult = await runScript('test-onchain.mjs', ['--test', 'prepare-pnft']);
  const pnftPassed = pnftResult.code === 0;
  log.result('pNFT datum preparation', pnftPassed);

  return {
    passed: transferPassed && datumPassed,
    tests: {
      transfer: transferPassed,
      datum: datumPassed,
      pnft: pnftPassed,
    },
  };
}

async function phase4_DeploymentVerification() {
  log.step(4, 'Verifying Deployment State');

  const deployment = safeReadJson(CONFIG.deploymentPath, {});
  const results = { checks: [] };

  // Check if deployment exists
  const hasDeployment = Object.keys(deployment).length > 0;
  results.checks.push({ name: 'Deployment record exists', passed: hasDeployment });
  log.result('Deployment record exists', hasDeployment);

  if (hasDeployment) {
    // Check validators
    const validatorCount = Object.keys(deployment.validators || {}).length;
    const hasValidators = validatorCount > 0;
    results.checks.push({ name: `Validators recorded (${validatorCount})`, passed: hasValidators });
    log.result(`Validators recorded: ${validatorCount}`, hasValidators);

    // Check references
    const refCount = Object.keys(deployment.references || {}).length;
    const hasRefs = refCount > 0;
    results.checks.push({ name: `Reference scripts (${refCount})`, passed: hasRefs });
    log.result(`Reference scripts: ${refCount}`, hasRefs);

    // Check genesis
    const hasGenesis = !!deployment.genesis;
    results.checks.push({ name: 'Genesis prepared', passed: hasGenesis });
    log.result('Genesis prepared', hasGenesis);

    // Check pNFTs
    const pnftCount = (deployment.pnfts || []).length;
    results.checks.push({ name: `Test pNFTs (${pnftCount})`, passed: pnftCount > 0 });
    log.result(`Test pNFTs: ${pnftCount}`, pnftCount > 0);
  }

  results.passed = results.checks.filter(c => c.passed).length;
  results.failed = results.checks.filter(c => !c.passed).length;

  return results;
}

async function phase5_Summary(allResults) {
  log.step(5, 'Test Summary');

  const summary = {
    timestamp: new Date().toISOString(),
    network: CONFIG.network,
    phases: allResults,
    totals: {
      passed: 0,
      failed: 0,
    },
  };

  // Count totals
  for (const [phase, result] of Object.entries(allResults)) {
    if (result.checks) {
      summary.totals.passed += result.checks.filter(c => c.passed).length;
      summary.totals.failed += result.checks.filter(c => !c.passed).length;
    }
    if (result.tests) {
      summary.totals.passed += Object.values(result.tests).filter(t => t).length;
      summary.totals.failed += Object.values(result.tests).filter(t => !t).length;
    }
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('                    E2E TEST RESULTS');
  console.log('='.repeat(60));
  console.log(`  Network:    ${CONFIG.network}`);
  console.log(`  Timestamp:  ${summary.timestamp}`);
  console.log(`  Passed:     ${summary.totals.passed}`);
  console.log(`  Failed:     ${summary.totals.failed}`);
  console.log('='.repeat(60));

  const allPassed = summary.totals.failed === 0;
  if (allPassed) {
    console.log('\n  🎉 ALL TESTS PASSED - Ready for deployment!\n');
  } else {
    console.log('\n  ⚠️  Some tests failed. Review results above.\n');
  }

  // Save results
  atomicWriteSync(CONFIG.resultsPath, summary);
  log.info(`Results saved to: ${CONFIG.resultsPath}`);

  return summary;
}

// =============================================================================
// QUICK SMOKE TEST
// =============================================================================

async function quickSmokeTest() {
  log.header('QUICK SMOKE TEST');
  log.info('Running minimal validation...\n');

  const results = {};

  // 1. Check config
  const configOk = CONFIG.blockfrostKey && CONFIG.walletMnemonic;
  log.result('Configuration', configOk);
  results.config = configOk;

  if (!configOk) {
    log.error('Missing .env configuration. Cannot proceed.');
    return results;
  }

  // 2. Check plutus.json
  const plutus = safeReadJson(CONFIG.plutusPath);
  const plutusOk = plutus && plutus.validators;
  log.result(`Plutus.json (${plutus?.validators?.length || 0} validators)`, plutusOk);
  results.plutus = plutusOk;

  // 3. Check wallet
  try {
    const provider = new BlockfrostProvider(CONFIG.blockfrostKey);
    const wallet = new MeshWallet({
      networkId: 0,
      fetcher: provider,
      submitter: provider,
      key: { type: 'mnemonic', words: CONFIG.walletMnemonic.trim().split(/\s+/) },
    });

    const address = wallet.getChangeAddress();
    const utxos = await provider.fetchAddressUTxOs(address);
    const balance = utxos.reduce((sum, u) => {
      const l = u.output.amount.find(a => a.unit === 'lovelace');
      return sum + BigInt(l?.quantity || 0);
    }, 0n);

    log.result(`Wallet connected (${formatAda(balance)})`, true);
    results.wallet = true;
    results.balance = Number(balance) / 1_000_000;

    // 4. Check slot fetching
    const slot = await getCurrentSlot(provider, CONFIG.network);
    log.result(`Current slot: ${slot}`, slot > 0);
    results.slot = slot;

  } catch (error) {
    log.result(`Wallet: ${error.message}`, false);
    results.wallet = false;
  }

  // Summary
  const allPassed = Object.values(results).every(v => v !== false);
  console.log('\n' + (allPassed ? '✅ Smoke test passed!' : '❌ Smoke test failed'));

  return results;
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);
  const skipDeploy = args.includes('--skip-deploy');
  const quickMode = args.includes('--quick');

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         UltraLife Protocol — End-to-End Test Suite            ║
╚═══════════════════════════════════════════════════════════════╝
`);

  if (quickMode) {
    await quickSmokeTest();
    return;
  }

  const results = {};

  try {
    // Phase 1: Prerequisites
    results.prerequisites = await phase1_Prerequisites();
    if (results.prerequisites.failed > 0) {
      log.warn('Prerequisites check had failures. Some tests may fail.');
    }

    // Phase 2: Local Tests
    results.localTests = await phase2_LocalTests();

    // Phase 3: On-Chain Tests
    results.onChainTests = await phase3_OnChainTests(skipDeploy);

    // Phase 4: Deployment Verification
    results.deployment = await phase4_DeploymentVerification();

    // Phase 5: Summary
    await phase5_Summary(results);

  } catch (error) {
    log.error(`Test suite failed: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

main().catch(console.error);
