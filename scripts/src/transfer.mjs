#!/usr/bin/env node

/**
 * UltraLife Protocol — Token Transfer with Impact Metadata
 *
 * Transfers ULTRA tokens between pNFT holders with required impact declaration.
 *
 * Usage:
 *   npm run transfer -- --to <pnft_id> --amount <tokens> --type labor
 *   npm run transfer -- --to <pnft_id> --amount <tokens> --type goods --impact-co2 100
 *
 * IMPORTANT: Every UltraLife token transaction MUST include:
 *   1. Valid pNFT (WHO is transacting)
 *   2. Transaction type (WHAT kind of activity)
 *   3. Impact declaration (PHYSICAL CONSEQUENCE)
 *   4. Valid recipient (must have pNFT)
 *
 * Transaction types: labor, goods, services, gift, investment, remediation
 * Impact compounds: co2, ch4, h2o, n2o, pm25, etc.
 */

import { Data, fromText } from '@lucid-evolution/lucid';
import { program } from 'commander';
import {
  initLucidWithWallet,
  loadPlutusJson,
  findValidator,
  loadDeployment,
  log,
  logError,
  textToHex,
  generateId,
  getCurrentSlot,
} from './lib/lucid.mjs';
import {
  buildTransactionRecordDatum,
  buildTransactionMeta,
  TransactionTypeCode,
  CompoundCodes,
} from './lib/datums.mjs';
import dotenv from 'dotenv';

dotenv.config();

// Constants
const CYCLE_SLOTS = parseInt(process.env.CYCLE_SLOTS || '3196800', 10);

// Parse CLI arguments
program
  .requiredOption('--to <pnft_id>', 'Recipient pNFT ID')
  .requiredOption('--amount <tokens>', 'Amount in ULTRA (with decimals)')
  .requiredOption('--type <type>', 'Transaction type: labor, goods, services, gift, investment, remediation')
  .option('--from-pnft <id>', 'Sender pNFT ID (auto-detected from wallet)')
  .option('--description <text>', 'Transaction description')
  .option('--evidence <ipfs_hash>', 'IPFS hash of evidence/methodology')
  .option('--impact-co2 <grams>', 'CO2 impact in grams (positive = released, negative = sequestered)')
  .option('--impact-h2o <liters>', 'H2O impact in liters')
  .option('--impact-ch4 <grams>', 'CH4 (methane) impact in grams')
  .option('--work-code <code>', 'Work type code (for labor)')
  .option('--hours <hours>', 'Hours worked (for labor)')
  .option('--product-code <code>', 'Product code (for goods)')
  .option('--quantity <qty>', 'Quantity (for goods)')
  .option('--dry-run', 'Build transaction without submitting')
  .parse();

const options = program.opts();

async function main() {
  log('UltraLife Protocol — Token Transfer');
  log(`Network: ${process.env.NETWORK || 'preview'}`);
  log('');
  log(`Recipient: ${options.to}`);
  log(`Amount: ${options.amount} ULTRA`);
  log(`Type: ${options.type}`);
  log('');

  // Parse amount
  const amount = parseAmount(options.amount);
  log(`Amount (raw): ${amount}`);

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
  const cycle = Math.floor(currentSlot / CYCLE_SLOTS);
  log(`Current cycle: ${cycle}`);

  // Build impact flows
  const compoundFlows = buildCompoundFlows(options);
  if (compoundFlows.length === 0) {
    log('');
    log('WARNING: No impact compounds specified.');
    log('Every transaction has physical impact. Adding minimal CO2 for digital activity.');
    compoundFlows.push({
      compound: CompoundCodes.CO2,
      quantity: 1, // 1 gram CO2 for digital transaction
      unit: 'Grams',
      measurement: { type: 'Estimated', reference: 'digital_tx', similarity: 80 },
      confidence: 80,
    });
  }

  log('');
  log('Impact declaration:');
  for (const flow of compoundFlows) {
    const sign = flow.quantity >= 0 ? '+' : '';
    log(`  ${flow.compound}: ${sign}${flow.quantity} ${flow.unit}`);
  }

  // Build transaction type
  const txType = buildTxType(options);
  log('');
  log(`Transaction type: ${JSON.stringify(txType)}`);

  // Build transaction metadata
  const evidenceHash = options.evidence || textToHex('no_evidence');
  const transactionMeta = buildTransactionMeta({
    txType: txType,
    impacts: compoundFlows,
    evidenceHash: evidenceHash,
    description: options.description ? textToHex(options.description) : null,
  });

  // Load validators
  const plutusJson = loadPlutusJson();
  const tokenValidator = findValidator(plutusJson, 'token');
  const recordsValidator = findValidator(plutusJson, 'records');

  // Get addresses
  const recordsAddr = recordsValidator
    ? lucid.utils.validatorToAddress({ type: 'PlutusV2', script: recordsValidator.compiledCode })
    : address;

  // Get token asset
  const tokenUnit = deployment.tokenPolicyId
    ? `${deployment.tokenPolicyId}${textToHex('ULTRA')}`
    : null;

  if (!tokenUnit) {
    throw new Error('Token policy not deployed. Run genesis:mint first.');
  }

  // Check balance
  const utxos = await lucid.wallet().getUtxos();
  const tokenBalance = utxos.reduce((acc, u) => acc + (u.assets[tokenUnit] || 0n), 0n);
  log(`Token balance: ${Number(tokenBalance) / 1_000_000} ULTRA`);

  if (tokenBalance < amount) {
    throw new Error(`Insufficient balance: ${Number(tokenBalance) / 1_000_000} < ${Number(amount) / 1_000_000}`);
  }

  // Get recipient address (would look up from pNFT in production)
  // For testnet, use a placeholder or configured address
  const recipientAddress = process.env.RECIPIENT_ADDRESS || address;

  // Build transaction record datum
  const recordId = generateId('txr');
  const senderPnft = options.fromPnft ? textToHex(options.fromPnft) : textToHex('sender');
  const recipientPnft = textToHex(options.to);

  const recordDatum = buildTransactionRecordDatum({
    sender: senderPnft,
    senderBioregion: textToHex('testnet'),
    recipient: recipientPnft,
    recipientBioregion: textToHex('testnet'),
    amount: Number(amount),
    txTypeCode: TransactionTypeCode[capitalizeFirst(options.type)] || 9,
    compoundFlows: compoundFlows,
    impactAccruedTo: recipientPnft, // Consumer accrues impact
    slot: currentSlot,
    cycle: cycle,
  });

  // Get reference scripts
  const refScripts = [];
  if (deployment.referenceScripts?.token) {
    const refUtxo = await lucid.utxosByOutRef([{
      txHash: deployment.referenceScripts.token.txHash,
      outputIndex: deployment.referenceScripts.token.outputIndex,
    }]);
    refScripts.push(...refUtxo);
  }

  log('');
  log('Building transfer transaction...');

  // Build transaction
  let txBuilder = lucid.newTx();

  // Add reference scripts if available
  if (refScripts.length > 0) {
    txBuilder = txBuilder.readFrom(refScripts);
  }

  // Transfer tokens to recipient
  txBuilder = txBuilder.pay.ToAddress(
    recipientAddress,
    { lovelace: 2_000_000n, [tokenUnit]: amount }
  );

  // Create transaction record
  txBuilder = txBuilder.pay.ToAddressWithData(
    recordsAddr,
    { kind: 'inline', value: recordDatum },
    { lovelace: 2_000_000n }
  );

  // Add metadata for indexing
  txBuilder = txBuilder.attachMetadata(674, {
    msg: ['UltraLife Token Transfer'],
    type: options.type,
    amount: Number(amount) / 1_000_000,
    to: options.to,
    record: recordId,
  });

  // Add required signers
  txBuilder = txBuilder.addSigner(address);

  // Complete transaction
  const tx = await txBuilder.complete();

  // Dry run check
  if (options.dryRun) {
    log('');
    log('DRY RUN — Transaction not submitted');
    log(`Transaction size: ${tx.toString().length / 2} bytes`);
    log(`Transaction fee: ${tx.fee} lovelace`);
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
  log('Transfer complete!');
  log(`Transaction: ${txHash}`);
  log(`Record ID: ${recordId}`);
  log('');
  log('Summary:');
  log(`  From: ${options.fromPnft || 'wallet'}`);
  log(`  To: ${options.to}`);
  log(`  Amount: ${Number(amount) / 1_000_000} ULTRA`);
  log(`  Type: ${options.type}`);
  log(`  Cycle: ${cycle}`);
  log('');
  log('Impact recorded:');
  for (const flow of compoundFlows) {
    const sign = flow.quantity >= 0 ? '+' : '';
    log(`  ${flow.compound}: ${sign}${flow.quantity} ${flow.unit}`);
  }

  return { txHash, recordId, amount };
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Parse amount string to bigint (handles decimals)
 */
function parseAmount(amountStr) {
  const parts = amountStr.split('.');
  if (parts.length === 1) {
    return BigInt(parts[0]) * 1_000_000n; // 6 decimals
  }
  const whole = BigInt(parts[0]) * 1_000_000n;
  const decimal = parts[1].padEnd(6, '0').slice(0, 6);
  return whole + BigInt(decimal);
}

/**
 * Build compound flows from CLI options
 */
function buildCompoundFlows(options) {
  const flows = [];

  if (options.impactCo2) {
    flows.push({
      compound: CompoundCodes.CO2,
      quantity: parseInt(options.impactCo2, 10),
      unit: 'Grams',
      measurement: { type: 'Calculated', formula: 'user_declared' },
      confidence: 70,
    });
  }

  if (options.impactH2o) {
    flows.push({
      compound: CompoundCodes.H2O,
      quantity: parseInt(options.impactH2o, 10),
      unit: 'Liters',
      measurement: { type: 'Calculated', formula: 'user_declared' },
      confidence: 70,
    });
  }

  if (options.impactCh4) {
    flows.push({
      compound: CompoundCodes.CH4,
      quantity: parseInt(options.impactCh4, 10),
      unit: 'Grams',
      measurement: { type: 'Calculated', formula: 'user_declared' },
      confidence: 70,
    });
  }

  return flows;
}

/**
 * Build transaction type from CLI options
 */
function buildTxType(options) {
  switch (options.type.toLowerCase()) {
    case 'labor':
      return {
        type: 'Labor',
        workCode: options.workCode || '',
        hours: options.hours ? parseInt(options.hours, 10) : null,
      };
    case 'goods':
      return {
        type: 'Goods',
        productCode: options.productCode || '',
        quantity: options.quantity ? parseInt(options.quantity, 10) : 1,
        unitCode: '',
      };
    case 'services':
      return {
        type: 'Services',
        serviceCode: '',
      };
    case 'gift':
      return 'Gift';
    case 'investment':
      return {
        type: 'Investment',
        termsHash: '',
      };
    case 'remediation':
      return {
        type: 'Remediation',
        bondId: '',
      };
    default:
      return 'Internal';
  }
}

function capitalizeFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logError('Transfer failed', error);
    process.exit(1);
  });
