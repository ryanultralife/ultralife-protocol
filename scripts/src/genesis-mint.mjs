#!/usr/bin/env node

/**
 * UltraLife Protocol — Genesis Token Minting
 *
 * Mints the total token supply and distributes to treasury and grants pools.
 * This is a ONE-TIME operation that creates the entire token supply.
 *
 * Usage:
 *   npm run genesis:mint
 *
 * Prerequisites:
 *   - Genesis UTXO must be available (not spent)
 *   - Reference scripts must be deployed
 *   - Treasury and grants addresses must exist
 */

import { Data } from '@lucid-evolution/lucid';
import {
  initLucidWithWallet,
  loadPlutusJson,
  findValidator,
  loadDeployment,
  saveDeployment,
  log,
  logError,
  textToHex,
} from './lib/lucid.mjs';
import dotenv from 'dotenv';

dotenv.config();

// Token configuration
const TOKEN_NAME = 'ULTRA';
const TOTAL_SUPPLY = BigInt(process.env.TOTAL_SUPPLY || '400000000000000000'); // 400 billion with 6 decimals

async function main() {
  log('UltraLife Protocol — Genesis Token Minting');
  log(`Network: ${process.env.NETWORK || 'preview'}`);
  log('');
  log(`Total supply: ${Number(TOTAL_SUPPLY) / 1_000_000_000_000} billion ULTRA`);
  log('');

  // Check for genesis UTXO
  const genesisUtxo = process.env.GENESIS_UTXO;
  if (!genesisUtxo) {
    throw new Error('GENESIS_UTXO environment variable required');
  }

  const [genesisUtxoTxHash, genesisUtxoIndex] = genesisUtxo.split('#');
  log(`Genesis UTXO: ${genesisUtxo}`);

  // Load deployment
  const deployment = loadDeployment(process.env.NETWORK || 'preview');
  if (!deployment) {
    throw new Error('No deployment found. Run deploy:reference first.');
  }

  // Initialize Lucid
  const lucid = await initLucidWithWallet();
  const address = await lucid.wallet().address();
  log(`Minting wallet: ${address}`);

  // Load token policy validator
  const plutusJson = loadPlutusJson();
  const tokenPolicy = findValidator(plutusJson, 'token_policy');
  if (!tokenPolicy) {
    throw new Error('Token policy validator not found in plutus.json');
  }

  // Get policy ID
  const policyId = tokenPolicy.hash;
  log(`Policy ID: ${policyId}`);

  // Get treasury and grants addresses
  const treasuryAddr = lucid.utils.validatorToAddress({
    type: 'PlutusV2',
    script: findValidator(plutusJson, 'treasury')?.compiledCode || '',
  });

  const grantsAddr = lucid.utils.validatorToAddress({
    type: 'PlutusV2',
    script: findValidator(plutusJson, 'grants')?.compiledCode || '',
  });

  log(`Treasury: ${treasuryAddr}`);
  log(`Grants: ${grantsAddr}`);

  // Check genesis UTXO is available
  log('');
  log('Verifying genesis UTXO...');

  const genesisUtxoRef = await lucid.utxosByOutRef([{
    txHash: genesisUtxoTxHash,
    outputIndex: parseInt(genesisUtxoIndex || '0', 10),
  }]);

  if (genesisUtxoRef.length === 0) {
    throw new Error(`Genesis UTXO not found or already spent: ${genesisUtxo}`);
  }

  log('Genesis UTXO verified!');

  // Calculate distribution
  const half = TOTAL_SUPPLY / 2n;
  const tokenAsset = `${policyId}${textToHex(TOKEN_NAME)}`;

  log('');
  log('Distribution:');
  log(`  Treasury: ${Number(half) / 1_000_000_000_000} billion ULTRA`);
  log(`  Grants:   ${Number(half) / 1_000_000_000_000} billion ULTRA`);

  // Build mint redeemer (empty for genesis mint)
  const mintRedeemer = Data.to({ constructor: 0, fields: [] });

  // Get reference script UTxO
  const refScriptUtxo = deployment.referenceScripts?.token_policy;
  if (!refScriptUtxo) {
    throw new Error('Token policy reference script not found.');
  }

  const refUtxos = await lucid.utxosByOutRef([{
    txHash: refScriptUtxo.txHash,
    outputIndex: refScriptUtxo.outputIndex,
  }]);

  log('');
  log('Building genesis mint transaction...');

  // Build transaction
  const tx = await lucid
    .newTx()
    // Spend genesis UTXO (one-time guarantee)
    .collectFrom(genesisUtxoRef)
    // Mint total supply
    .mintAssets(
      { [tokenAsset]: TOTAL_SUPPLY },
      mintRedeemer
    )
    // Use reference script
    .readFrom(refUtxos)
    // Send half to treasury
    .pay.ToAddressWithData(
      treasuryAddr,
      {
        kind: 'inline',
        value: Data.to({
          tokens_distributed: 0n,
          ada_reserves: 0n,
          btc_reserves: 0n,
          last_update: BigInt(Date.now()),
        }),
      },
      { lovelace: 10_000_000n, [tokenAsset]: half }
    )
    // Send half to grants
    .pay.ToAddressWithData(
      grantsAddr,
      {
        kind: 'inline',
        value: Data.to({
          available: half,
          distributed: 0n,
          grant_per_user: BigInt(process.env.BOOTSTRAP_GRANT || '50000000'),
        }),
      },
      { lovelace: 10_000_000n, [tokenAsset]: half }
    )
    .complete();

  // Dry run check
  if (process.env.DRY_RUN === 'true') {
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
  log('Genesis minting complete!');
  log(`Transaction: ${txHash}`);
  log('');

  // Update deployment
  deployment.genesisMintTx = txHash;
  deployment.tokenPolicyId = policyId;
  deployment.tokenName = TOKEN_NAME;
  deployment.totalSupply = TOTAL_SUPPLY.toString();
  deployment.treasuryAddress = treasuryAddr;
  deployment.grantsAddress = grantsAddr;
  saveDeployment(deployment.network, deployment);

  log('Token distribution:');
  log(`  Policy ID: ${policyId}`);
  log(`  Treasury:  ${Number(half) / 1_000_000_000_000}B ULTRA at ${treasuryAddr}`);
  log(`  Grants:    ${Number(half) / 1_000_000_000_000}B ULTRA at ${grantsAddr}`);
  log('');
  log('Next steps:');
  log('  1. Initialize UBI pool: npm run ubi:init');
  log('  2. Begin pNFT minting: npm run pnft:mint');

  return { txHash, policyId };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logError('Genesis minting failed', error);
    process.exit(1);
  });
