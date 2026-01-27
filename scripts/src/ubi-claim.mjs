#!/usr/bin/env node

/**
 * UltraLife Protocol — UBI Claim
 *
 * Claims UBI distribution for a pNFT holder.
 *
 * Usage:
 *   npm run ubi:claim -- --pnft <id>
 *
 * Requirements:
 *   - Must be in UBI window (first 3.7 days of 37-day cycle)
 *   - Must have Standard+ pNFT in the bioregion
 *   - Must not have claimed this cycle already
 *
 * UBI ALGORITHM:
 *   1. Everyone gets SURVIVAL_FLOOR (20 ULTRA)
 *   2. Additional UBI based on engagement:
 *      - 0 tx: Floor only
 *      - 1 tx: Floor + 25% share
 *      - 2 tx: Floor + 50% share
 *      - 3 tx: Floor + 75% share
 *      - 5+ tx with 2+ counterparties: Floor + 100% share
 */

import { Data } from '@lucid-evolution/lucid';
import { program } from 'commander';
import {
  initLucidWithWallet,
  loadPlutusJson,
  findValidator,
  loadDeployment,
  log,
  logError,
  textToHex,
  getCurrentSlot,
} from './lib/lucid.mjs';
import { buildUbiClaimDatum } from './lib/datums.mjs';
import { claimUbi } from './lib/redeemers.mjs';
import dotenv from 'dotenv';

dotenv.config();

// Constants
const CYCLE_SLOTS = parseInt(process.env.CYCLE_SLOTS || '3196800', 10);
const UBI_WINDOW_SLOTS = 319680; // 3.7 days (10% of cycle)
const SURVIVAL_FLOOR = 20_000_000n; // 20 ULTRA

// Parse CLI arguments
program
  .requiredOption('--pnft <id>', 'pNFT identifier')
  .option('--cycle <number>', 'Cycle to claim (defaults to current)')
  .option('--dry-run', 'Build transaction without submitting')
  .parse();

const options = program.opts();

async function main() {
  log('UltraLife Protocol — UBI Claim');
  log(`Network: ${process.env.NETWORK || 'preview'}`);
  log(`pNFT: ${options.pnft}`);
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

  // Calculate current cycle and check UBI window
  const currentSlot = await getCurrentSlot(lucid);
  const cycle = options.cycle
    ? parseInt(options.cycle, 10)
    : Math.floor(currentSlot / CYCLE_SLOTS);
  const cycleStart = cycle * CYCLE_SLOTS;
  const slotInCycle = currentSlot - cycleStart;

  log(`Current slot: ${currentSlot}`);
  log(`Cycle: ${cycle}`);
  log(`Slot in cycle: ${slotInCycle} / ${CYCLE_SLOTS}`);

  // Check if in UBI window
  if (slotInCycle > UBI_WINDOW_SLOTS) {
    const daysRemaining = (CYCLE_SLOTS - slotInCycle) / (86400 / 1); // slots per day
    log('');
    log('WARNING: Outside UBI claim window.');
    log(`UBI claims are only available in the first 3.7 days of each cycle.`);
    log(`Next window opens in approximately ${Math.ceil(daysRemaining)} days.`);
    log('');
    if (!options.dryRun) {
      throw new Error('Cannot claim UBI outside the distribution window.');
    }
  } else {
    const hoursRemaining = ((UBI_WINDOW_SLOTS - slotInCycle) / 3600).toFixed(1);
    log(`UBI window: ${hoursRemaining} hours remaining`);
  }

  // Load validators
  const plutusJson = loadPlutusJson();
  const ubiValidator = findValidator(plutusJson, 'ubi');
  const pnftValidator = findValidator(plutusJson, 'pnft_spend');

  if (!ubiValidator) {
    throw new Error('UBI validator not found in plutus.json');
  }

  // Get UBI script address
  const ubiAddr = lucid.utils.validatorToAddress({
    type: 'PlutusV2',
    script: ubiValidator.compiledCode,
  });

  // Find UBI pool UTxO for this cycle
  log('');
  log('Finding UBI pool...');
  const poolUtxos = await lucid.utxosAt(ubiAddr);

  // Filter for the correct cycle (would parse datum in production)
  // For testnet, use first available pool
  if (poolUtxos.length === 0) {
    throw new Error('No UBI pool found. Run ubi:init first.');
  }

  const poolUtxo = poolUtxos[0];
  log(`Found pool: ${poolUtxo.txHash}#${poolUtxo.outputIndex}`);

  // Find pNFT UTxO for reference
  log('Finding pNFT...');
  const pnftAddr = lucid.utils.validatorToAddress({
    type: 'PlutusV2',
    script: pnftValidator?.compiledCode || '',
  });

  // In production, would look up specific pNFT
  // For testnet, we'll reference from current wallet

  // Calculate claim amount (simplified for testnet)
  // In production, this would be calculated from on-chain engagement data
  const engagementWeight = 1000; // Base weight
  const engagementMult = 10000; // 100% (basis points)
  const baseShare = SURVIVAL_FLOOR;

  // Simulate engagement-based calculation
  const variableShare = 80_000_000n; // 80 ULTRA variable share
  const claimAmount = baseShare + (variableShare * BigInt(engagementMult) / 10000n);

  log(`Claim amount: ${Number(claimAmount) / 1_000_000} ULTRA`);
  log(`  Survival floor: ${Number(SURVIVAL_FLOOR) / 1_000_000} ULTRA`);
  log(`  Engagement bonus: ${Number(claimAmount - SURVIVAL_FLOOR) / 1_000_000} ULTRA`);

  // Build redeemer
  const redeemer = claimUbi({
    pnft: textToHex(options.pnft),
    cycle: cycle,
  });

  // Build claim record datum
  const claimDatum = buildUbiClaimDatum({
    pnft: textToHex(options.pnft),
    cycle: cycle,
    baseShare: Number(baseShare),
    engagementMult: engagementMult,
    amount: Number(claimAmount),
    slot: currentSlot,
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
  log('Building UBI claim transaction...');

  // Get token asset
  const tokenUnit = deployment.tokenPolicyId
    ? `${deployment.tokenPolicyId}${textToHex('ULTRA')}`
    : null;

  // Build transaction
  let txBuilder = lucid
    .newTx()
    // Spend pool UTxO
    .collectFrom([poolUtxo], redeemer);

  // Add reference scripts if available
  if (refScripts.length > 0) {
    txBuilder = txBuilder.readFrom(refScripts);
  }

  // Create updated pool output (reduced balance)
  const poolTokens = poolUtxo.assets[tokenUnit] || 0n;
  const updatedPoolAssets = {
    lovelace: poolUtxo.assets.lovelace - 1_000_000n,
  };
  if (tokenUnit && poolTokens > claimAmount) {
    updatedPoolAssets[tokenUnit] = poolTokens - claimAmount;
  }

  txBuilder = txBuilder.pay.ToAddressWithData(
    ubiAddr,
    { kind: 'inline', value: poolUtxo.datum }, // Would update datum
    updatedPoolAssets
  );

  // Pay claim to user
  if (tokenUnit) {
    txBuilder = txBuilder.pay.ToAddress(
      address,
      { lovelace: 2_000_000n, [tokenUnit]: claimAmount }
    );
  } else {
    txBuilder = txBuilder.pay.ToAddress(
      address,
      { lovelace: 2_000_000n + claimAmount } // Fallback to ADA for testing
    );
  }

  // Create claim record
  txBuilder = txBuilder.pay.ToAddressWithData(
    ubiAddr,
    { kind: 'inline', value: claimDatum },
    { lovelace: 2_000_000n }
  );

  // Add required signers
  txBuilder = txBuilder.addSigner(address);

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
  log('UBI claimed successfully!');
  log(`Transaction: ${txHash}`);
  log(`Amount: ${Number(claimAmount) / 1_000_000} ULTRA`);
  log('');
  log('Claim breakdown:');
  log(`  Survival floor: ${Number(SURVIVAL_FLOOR) / 1_000_000} ULTRA`);
  log(`  Engagement multiplier: ${engagementMult / 100}%`);
  log(`  Total: ${Number(claimAmount) / 1_000_000} ULTRA`);

  return { txHash, claimAmount };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logError('UBI claim failed', error);
    process.exit(1);
  });
