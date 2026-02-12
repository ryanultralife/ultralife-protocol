#!/usr/bin/env node
/**
 * UltraLife Protocol — Generate Sequestration Credits
 *
 * Land generates sequestration credits based on its capacity.
 * These credits can be sold to offset consumer impact debt.
 *
 * Only LAND generates positive capacity. This is the source of all offsets.
 *
 * Usage:
 *   node generate-credits.mjs --land <land_id>
 *   node generate-credits.mjs --list
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
  walletMnemonic: process.env.WALLET_SEED_PHRASE,
  deploymentPath: path.join(__dirname, 'deployment.json'),
};

// Cycle duration in milliseconds (~37 days)
const CYCLE_DURATION_MS = 37 * 24 * 60 * 60 * 1000;

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║      UltraLife Protocol — Generate Sequestration Credits      ║
║                                                               ║
║        Only LAND generates positive offset capacity.          ║
╚═══════════════════════════════════════════════════════════════╝
`);

  const args = process.argv.slice(2);
  const landIdx = args.indexOf('--land');
  const listIdx = args.indexOf('--list');
  const allIdx = args.indexOf('--all');

  const { atomicWriteSync, safeReadJson } = await import('./utils.mjs');
  const { BlockfrostProvider, MeshWallet } = await import('@meshsdk/core');

  // Load deployment
  const deployment = safeReadJson(CONFIG.deploymentPath, {});
  const lands = deployment.lands || [];
  deployment.sequestrationCredits = deployment.sequestrationCredits || [];
  deployment.creditBalances = deployment.creditBalances || {};

  // List available lands and their credit status
  if (listIdx >= 0) {
    if (lands.length === 0) {
      log.info('No lands registered yet.');
      log.info('Register one: npm run land:mint -- --name "My Forest" --area 10000 --type forest');
      return;
    }

    console.log('Registered lands and sequestration capacity:\n');
    for (const land of lands) {
      const hectares = land.area_m2 / 10000;
      const annualCapacity = hectares * land.classification.sequestrationRate;
      const cycleCapacity = annualCapacity / 10; // ~10 cycles per year

      // Check last credit generation
      const lastGen = deployment.lastCreditGeneration?.[land.landId];
      const timeSinceGen = lastGen ? Date.now() - new Date(lastGen).getTime() : CYCLE_DURATION_MS;
      const cyclesAvailable = Math.floor(timeSinceGen / CYCLE_DURATION_MS);
      const creditsAvailable = cyclesAvailable * cycleCapacity;

      console.log(`  ${land.name}`);
      console.log(`    ID: ${land.landId}`);
      console.log(`    Type: ${land.classification.name}, Area: ${hectares.toFixed(2)} ha`);
      console.log(`    Capacity: ${annualCapacity.toFixed(2)} tCO2/year (${cycleCapacity.toFixed(2)}/cycle)`);
      console.log(`    Cycles available: ${cyclesAvailable}`);
      console.log(`    Credits ready to generate: ${creditsAvailable.toFixed(2)} tCO2`);
      console.log(`    Steward: ${land.primarySteward}`);
      console.log('');
    }
    return;
  }

  if (!CONFIG.blockfrostKey || !CONFIG.walletMnemonic) {
    log.error('Missing configuration. Set BLOCKFROST_API_KEY and WALLET_SEED_PHRASE in .env');
    process.exit(1);
  }

  // Initialize wallet
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

  const stewardAddress = wallet.getChangeAddress();

  // Find lands to generate credits for
  let targetLands = [];

  if (allIdx >= 0) {
    // Generate for all lands owned by this steward
    targetLands = lands.filter(l => l.stewardAddress === stewardAddress);
    if (targetLands.length === 0) {
      log.error('You do not steward any lands.');
      return;
    }
  } else if (landIdx >= 0) {
    const landId = args[landIdx + 1];
    const land = lands.find(l => l.landId === landId || l.name.toLowerCase().includes(landId?.toLowerCase()));
    if (!land) {
      log.error(`Land not found: ${landId}`);
      log.info('Use --list to see available lands');
      return;
    }
    if (land.stewardAddress !== stewardAddress) {
      log.error('You are not the steward of this land.');
      return;
    }
    targetLands = [land];
  } else {
    log.error('Specify --land <id> or --all');
    log.info('Use --list to see available lands');
    return;
  }

  // Generate credits for each land
  let totalCreditsGenerated = 0;

  for (const land of targetLands) {
    const hectares = land.area_m2 / 10000;
    const annualCapacity = hectares * land.classification.sequestrationRate;
    const cycleCapacity = annualCapacity / 10;

    // Check cycles since last generation
    deployment.lastCreditGeneration = deployment.lastCreditGeneration || {};
    const lastGen = deployment.lastCreditGeneration[land.landId];
    const timeSinceGen = lastGen ? Date.now() - new Date(lastGen).getTime() : CYCLE_DURATION_MS;
    const cyclesAvailable = Math.floor(timeSinceGen / CYCLE_DURATION_MS);

    if (cyclesAvailable < 1) {
      log.warn(`${land.name}: No cycles available yet. Wait for next cycle.`);
      continue;
    }

    const creditsToGenerate = cyclesAvailable * cycleCapacity;
    const creditId = 'seqcred_' + crypto.randomBytes(8).toString('hex');

    log.info(`${land.name}: Generating ${creditsToGenerate.toFixed(2)} tCO2 credits (${cyclesAvailable} cycles)`);

    // Create credit record
    const creditRecord = {
      creditId: creditId,
      landId: land.landId,
      landName: land.name,
      steward: land.primarySteward,
      stewardAddress: stewardAddress,
      bioregion: land.bioregion,
      amount: creditsToGenerate,
      unit: 'tCO2',
      cyclesGenerated: cyclesAvailable,
      generatedAt: new Date().toISOString(),
      landType: land.classification.name,
      sequestrationRate: land.classification.sequestrationRate,
      // Confidence based on land health and survey status
      confidence: land.health?.last_survey ? 85 : 70,
      status: 'available',
      testnetSimulated: true,
    };

    deployment.sequestrationCredits.push(creditRecord);

    // Add to steward's credit balance
    deployment.creditBalances[stewardAddress] = deployment.creditBalances[stewardAddress] || {
      total: 0,
      available: 0,
      sold: 0,
      byLand: {},
    };
    deployment.creditBalances[stewardAddress].total += creditsToGenerate;
    deployment.creditBalances[stewardAddress].available += creditsToGenerate;
    deployment.creditBalances[stewardAddress].byLand[land.landId] =
      (deployment.creditBalances[stewardAddress].byLand[land.landId] || 0) + creditsToGenerate;

    // Update last generation time
    deployment.lastCreditGeneration[land.landId] = new Date().toISOString();

    totalCreditsGenerated += creditsToGenerate;

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          🌲 SEQUESTRATION CREDITS GENERATED! 🌲               ║
╠═══════════════════════════════════════════════════════════════╣
║  Credit ID:  ${creditId.padEnd(46)}║
║  Land:       ${land.name.padEnd(46)}║
║  Type:       ${land.classification.name.padEnd(46)}║
║  Amount:     ${(creditsToGenerate.toFixed(2) + ' tCO2').padEnd(46)}║
║  Cycles:     ${(cyclesAvailable + ' cycles @ ' + cycleCapacity.toFixed(2) + ' tCO2/cycle').padEnd(46)}║
║  Confidence: ${(creditRecord.confidence + '%').padEnd(46)}║
╚═══════════════════════════════════════════════════════════════╝
`);
  }

  // Save deployment
  atomicWriteSync(CONFIG.deploymentPath, deployment);

  // Summary
  const balance = deployment.creditBalances[stewardAddress];
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    CREDIT BALANCE SUMMARY                     ║
╠═══════════════════════════════════════════════════════════════╣
║  Total generated:    ${(balance.total.toFixed(2) + ' tCO2').padEnd(38)}║
║  Available to sell:  ${(balance.available.toFixed(2) + ' tCO2').padEnd(38)}║
║  Already sold:       ${(balance.sold.toFixed(2) + ' tCO2').padEnd(38)}║
╠═══════════════════════════════════════════════════════════════╣
║  These credits can be sold to consumers to offset their       ║
║  impact debt. Consumers need credits to achieve net-zero.     ║
║                                                               ║
║  Sell credits: npm run credits:sell --amount 10 --to Alice    ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

main().catch(error => {
  log.error(error.message);
  console.error(error);
  process.exit(1);
});
