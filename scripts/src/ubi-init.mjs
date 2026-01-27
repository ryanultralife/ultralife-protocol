#!/usr/bin/env node

/**
 * UltraLife Protocol — UBI Pool Initialization
 *
 * Initializes a UBI distribution pool for a bioregion and cycle.
 *
 * Usage:
 *   npm run ubi:init -- --bioregion <id> --cycle <number>
 *
 * UBI FUNDING: 100% from transaction fees.
 * - Each epoch, total fees collected = UBI pool for that epoch
 * - Pool divided among eligible claimants based on engagement
 * - Unclaimed tokens returned to fee pool (not accumulated)
 */

import { Data } from '@lucid-evolution/lucid';
import { program } from 'commander';
import {
  initLucidWithWallet,
  loadPlutusJson,
  findValidator,
  loadDeployment,
  saveDeployment,
  log,
  logError,
  textToHex,
  getCurrentSlot,
} from './lib/lucid.mjs';
import { buildUbiPoolDatum } from './lib/datums.mjs';
import { fundUbiPool } from './lib/redeemers.mjs';
import dotenv from 'dotenv';

dotenv.config();

// Constants
const CYCLE_SLOTS = parseInt(process.env.CYCLE_SLOTS || '3196800', 10); // 37 days

// Parse CLI arguments
program
  .requiredOption('--bioregion <id>', 'Bioregion ID')
  .option('--cycle <number>', 'Cycle number (defaults to current)')
  .option('--amount <tokens>', 'Initial pool funding amount', '0')
  .option('--dry-run', 'Build transaction without submitting')
  .parse();

const options = program.opts();

async function main() {
  log('UltraLife Protocol — UBI Pool Initialization');
  log(`Network: ${process.env.NETWORK || 'preview'}`);
  log(`Bioregion: ${options.bioregion}`);
  log('');

  // Load deployment
  const deployment = loadDeployment(process.env.NETWORK || 'preview');
  if (!deployment) {
    throw new Error('No deployment found. Run deploy:reference first.');
  }

  // Initialize Lucid
  const lucid = await initLucidWithWallet();
  const address = await lucid.wallet().address();
  log(`Wallet: ${address}`);

  // Calculate current cycle
  const currentSlot = await getCurrentSlot(lucid);
  const cycle = options.cycle
    ? parseInt(options.cycle, 10)
    : Math.floor(currentSlot / CYCLE_SLOTS);

  log(`Current slot: ${currentSlot}`);
  log(`Cycle: ${cycle}`);

  // Load UBI validator
  const plutusJson = loadPlutusJson();
  const ubiValidator = findValidator(plutusJson, 'ubi');

  if (!ubiValidator) {
    throw new Error('UBI validator not found in plutus.json');
  }

  // Create UBI script address
  const ubiAddr = lucid.utils.validatorToAddress({
    type: 'PlutusV2',
    script: ubiValidator.compiledCode,
  });

  log(`UBI address: ${ubiAddr}`);

  // Calculate pool parameters
  const bioregionHex = textToHex(options.bioregion);
  const fundingAmount = BigInt(options.amount);
  const distributionStart = cycle * CYCLE_SLOTS;

  // For testnet, use estimated values
  // In production, these would be calculated from on-chain data
  const estimatedEligible = 100; // Estimated eligible claimants
  const estimatedEngagement = 100000; // Total engagement weight

  // Build datum
  const ubiPoolDatum = buildUbiPoolDatum({
    bioregion: bioregionHex,
    cycle: cycle,
    feesCollected: fundingAmount,
    ubiPool: fundingAmount,
    eligibleCount: estimatedEligible,
    totalEngagementWeight: estimatedEngagement,
    claimsCount: 0,
    distributed: 0,
    distributionStart: distributionStart,
  });

  // Build redeemer
  const redeemer = fundUbiPool({
    cycle: cycle,
    amount: fundingAmount,
  });

  // Get reference scripts
  const refScripts = [];
  if (deployment.referenceScripts?.ubi) {
    const refUtxo = await lucid.utxosByOutRef([{
      txHash: deployment.referenceScripts.ubi.txHash,
      outputIndex: deployment.referenceScripts.ubi.outputIndex,
    }]);
    refScripts.push(...refUtxo);
  }

  log('');
  log('Building UBI pool initialization transaction...');

  // Build assets to lock
  const assets = { lovelace: 5_000_000n };
  if (fundingAmount > 0n && deployment.tokenPolicyId) {
    const tokenUnit = `${deployment.tokenPolicyId}${textToHex('ULTRA')}`;
    assets[tokenUnit] = fundingAmount;
    log(`Funding pool with: ${Number(fundingAmount) / 1_000_000} ULTRA`);
  }

  // Build transaction
  let txBuilder = lucid.newTx();

  // Add reference scripts if available
  if (refScripts.length > 0) {
    txBuilder = txBuilder.readFrom(refScripts);
  }

  // Create pool UTxO
  txBuilder = txBuilder.pay.ToAddressWithData(
    ubiAddr,
    { kind: 'inline', value: ubiPoolDatum },
    assets
  );

  // Add metadata for indexing
  txBuilder = txBuilder.attachMetadata(674, {
    msg: ['UltraLife UBI Pool Initialization'],
    bioregion: options.bioregion,
    cycle: cycle,
  });

  // Complete transaction
  const tx = await txBuilder.complete();

  // Dry run check
  if (options.dryRun) {
    log('');
    log('DRY RUN — Transaction not submitted');
    log(`Transaction size: ${tx.toString().length / 2} bytes`);
    return;
  }

  // Sign and submit
  log('Signing transaction...');
  const signedTx = await tx.sign.withWallet().complete();
  const txHash = await signedTx.submit();

  log(`Transaction submitted: ${txHash}`);

  // Wait for confirmation
  log('Waiting for confirmation...');
  await lucid.awaitTx(txHash);

  log('');
  log('UBI Pool initialized successfully!');
  log(`Transaction: ${txHash}`);
  log('');
  log('Pool details:');
  log(`  Bioregion: ${options.bioregion}`);
  log(`  Cycle: ${cycle}`);
  log(`  Distribution window: First 3.7 days of cycle`);
  log(`  Pool address: ${ubiAddr}`);
  log('');
  log('UBI claims can now be processed during the distribution window.');

  return { txHash, cycle, bioregion: options.bioregion };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logError('UBI pool initialization failed', error);
    process.exit(1);
  });
