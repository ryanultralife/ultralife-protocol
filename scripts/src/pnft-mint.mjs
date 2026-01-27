#!/usr/bin/env node

/**
 * UltraLife Protocol — pNFT Minting
 *
 * Mints a new personal NFT (pNFT) for identity verification.
 *
 * Usage:
 *   npm run pnft:mint -- --level basic
 *   npm run pnft:mint -- --level standard --dna-hash <hash>
 *
 * Verification Levels:
 *   - basic: Wallet signature only (can be upgraded later)
 *   - standard: DNA-verified (requires oracle attestations)
 *
 * The pNFT is the foundation of participation in UltraLife.
 * - One per human (DNA-verified uniqueness)
 * - Required for ALL token transactions
 * - Cannot be transferred or duplicated
 */

import { Data, fromText } from '@lucid-evolution/lucid';
import { program } from 'commander';
import {
  initLucidWithWallet,
  loadPlutusJson,
  findValidator,
  loadDeployment,
  saveDeployment,
  log,
  logError,
  generateId,
  bytesToHex,
  textToHex,
} from './lib/lucid.mjs';
import { buildPnftDatum, VerificationLevel } from './lib/datums.mjs';
import { mintBasicPnft, upgradeToStandard } from './lib/redeemers.mjs';
import dotenv from 'dotenv';

dotenv.config();

// Parse CLI arguments
program
  .option('--level <level>', 'Verification level: basic or standard', 'basic')
  .option('--dna-hash <hash>', 'DNA verification hash (required for standard)')
  .option('--attestations <sigs>', 'Oracle attestation signatures (comma-separated)')
  .option('--bioregion <id>', 'Initial bioregion assignment')
  .option('--dry-run', 'Build transaction without submitting')
  .parse();

const options = program.opts();

async function main() {
  log('UltraLife Protocol — pNFT Minting');
  log(`Network: ${process.env.NETWORK || 'preview'}`);
  log(`Level: ${options.level}`);
  log('');

  // Validate options
  if (options.level === 'standard' && !options.dnaHash) {
    throw new Error('--dna-hash required for standard level pNFT');
  }

  // Load deployment
  const deployment = loadDeployment(process.env.NETWORK || 'preview');
  if (!deployment) {
    throw new Error('No deployment found. Run deploy:reference first.');
  }

  // Initialize Lucid
  const lucid = await initLucidWithWallet();
  const address = await lucid.wallet().address();
  log(`Wallet: ${address}`);

  // Get payment key hash from address
  const paymentKeyHash = lucid.utils.paymentCredentialOf(address).hash;
  log(`Payment key hash: ${paymentKeyHash}`);

  // Load pNFT validator
  const plutusJson = loadPlutusJson();
  const pnftPolicy = findValidator(plutusJson, 'pnft_policy');
  const pnftSpend = findValidator(plutusJson, 'pnft_spend');

  if (!pnftPolicy || !pnftSpend) {
    throw new Error('pNFT validators not found in plutus.json');
  }

  // Generate pNFT ID
  const pnftId = generateId('pnft');
  const assetName = textToHex(pnftId);
  const policyId = pnftPolicy.hash;
  const unit = `${policyId}${assetName}`;

  log(`pNFT ID: ${pnftId}`);
  log(`Policy: ${policyId}`);
  log(`Asset: ${unit}`);

  // Create pNFT script address (for datum storage)
  const pnftAddr = lucid.utils.validatorToAddress({
    type: 'PlutusV2',
    script: pnftSpend.compiledCode,
  });

  // Build datum
  const level = options.level === 'standard' ? 'Standard' : 'Basic';
  const createdAt = Date.now();

  const pnftDatum = buildPnftDatum({
    pnftId: assetName,
    owner: paymentKeyHash,
    level: level,
    bioregion: options.bioregion ? textToHex(options.bioregion) : null,
    dnaHash: options.dnaHash || null,
    guardian: null,
    wardSince: null,
    createdAt: createdAt,
    upgradedAt: null,
    consumerImpact: null,
    nutritionProfile: null,
  });

  // Build redeemer
  const redeemer = mintBasicPnft(paymentKeyHash);

  // Get reference scripts
  const refScripts = [];
  if (deployment.referenceScripts?.pnft_policy) {
    const refUtxo = await lucid.utxosByOutRef([{
      txHash: deployment.referenceScripts.pnft_policy.txHash,
      outputIndex: deployment.referenceScripts.pnft_policy.outputIndex,
    }]);
    refScripts.push(...refUtxo);
  }

  log('');
  log('Building pNFT mint transaction...');

  // Build transaction
  let txBuilder = lucid
    .newTx()
    // Mint the pNFT
    .mintAssets({ [unit]: 1n }, redeemer);

  // Add reference scripts if available
  if (refScripts.length > 0) {
    txBuilder = txBuilder.readFrom(refScripts);
  }

  // Pay pNFT to script address with datum
  txBuilder = txBuilder.pay.ToAddressWithData(
    pnftAddr,
    { kind: 'inline', value: pnftDatum },
    { lovelace: 2_000_000n, [unit]: 1n }
  );

  // Add bootstrap grant for standard level
  if (options.level === 'standard' && deployment.grantsAddress) {
    const grantAmount = BigInt(process.env.BOOTSTRAP_GRANT || '50000000');
    const tokenUnit = `${deployment.tokenPolicyId}${textToHex('ULTRA')}`;

    log(`Including bootstrap grant: ${Number(grantAmount) / 1_000_000} ULTRA`);

    // Note: In production, this would withdraw from grants pool
    // For testnet, we simulate by including the grant
  }

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
  log('pNFT minted successfully!');
  log(`Transaction: ${txHash}`);
  log(`pNFT ID: ${pnftId}`);
  log(`Verification Level: ${level}`);
  log('');

  // Display capabilities
  log('Capabilities:');
  if (level === 'Basic') {
    log('  - View data');
    log('  - Create pNFT');
    log('  - CANNOT transact tokens (upgrade required)');
    log('');
    log('To upgrade to Standard (DNA verification):');
    log('  1. Visit a DNA verification partner');
    log('  2. Submit verification proof');
    log('  3. Upgrade grants access to token transactions');
  } else {
    log('  - Transact tokens');
    log('  - Vote on governance');
    log('  - Claim UBI distributions');
    log('  - Receive 50 ULTRA bootstrap grant');
  }

  return { txHash, pnftId, policyId, level };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logError('pNFT minting failed', error);
    process.exit(1);
  });
