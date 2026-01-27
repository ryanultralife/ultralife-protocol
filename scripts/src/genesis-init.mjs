#!/usr/bin/env node

/**
 * UltraLife Protocol — Genesis Initialization
 *
 * Creates the initial genesis datum and prepares for token minting.
 *
 * Usage:
 *   npm run genesis:init
 *
 * This script:
 *   1. Creates the genesis datum with initial state
 *   2. Locks ADA at the genesis script address
 *   3. Prepares for founder operations
 */

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
import { buildGenesisDatum } from './lib/datums.mjs';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
  log('UltraLife Protocol — Genesis Initialization');
  log(`Network: ${process.env.NETWORK || 'preview'}`);
  log('');

  // Load deployment artifacts
  const deployment = loadDeployment(process.env.NETWORK || 'preview');
  if (!deployment) {
    throw new Error('No deployment found. Run deploy:reference first.');
  }

  // Initialize Lucid
  const lucid = await initLucidWithWallet();
  const address = await lucid.wallet().address();
  log(`Wallet: ${address}`);

  // Check for genesis reference script
  const genesisRef = deployment.referenceScripts?.genesis;
  if (!genesisRef) {
    throw new Error('Genesis reference script not deployed.');
  }

  // Load genesis validator
  const plutusJson = loadPlutusJson();
  const genesisValidator = findValidator(plutusJson, 'genesis');
  if (!genesisValidator) {
    throw new Error('Genesis validator not found in plutus.json');
  }

  // Create genesis script address
  const genesisAddr = lucid.utils.validatorToAddress({
    type: 'PlutusV2',
    script: genesisValidator.compiledCode,
  });

  log(`Genesis address: ${genesisAddr}`);

  // Build initial genesis datum
  const genesisDatum = buildGenesisDatum({
    verificationsCompleted: 0,
    stewardsCreated: 0,
    bioregionsCreated: 0,
    registeredOracles: [],
    genesisActive: true,
  });

  log('');
  log('Creating genesis UTxO...');

  // Build transaction
  const tx = await lucid
    .newTx()
    .pay.ToAddressWithData(
      genesisAddr,
      { kind: 'inline', value: genesisDatum },
      { lovelace: 5_000_000n } // 5 ADA
    )
    .complete();

  // Sign and submit
  const signedTx = await tx.sign.withWallet().complete();
  const txHash = await signedTx.submit();

  log(`Transaction submitted: ${txHash}`);

  // Wait for confirmation
  await lucid.awaitTx(txHash);

  log('Genesis datum created successfully!');
  log('');

  // Update deployment record
  deployment.genesisUtxo = `${txHash}#0`;
  deployment.genesisAddress = genesisAddr;
  deployment.genesisInitialized = new Date().toISOString();
  saveDeployment(deployment.network, deployment);

  log('Next steps:');
  log('  1. Have founders verify their DNA (founder self-verify)');
  log('  2. Register DNA verification oracles');
  log('  3. Create first bioregion');
  log('  4. Begin community onboarding');

  return { txHash, genesisAddr };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    logError('Genesis initialization failed', error);
    process.exit(1);
  });
