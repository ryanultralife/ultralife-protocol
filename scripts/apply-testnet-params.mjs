#!/usr/bin/env node
/**
 * Apply Testnet Parameters to Validators
 *
 * Uses Aiken CLI to properly apply CBOR-encoded parameters to validators.
 * This creates plutus-testnet.json with fully applied (non-parameterized) scripts.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import { MeshWallet, BlockfrostProvider, resolvePaymentKeyHash } from '@meshsdk/core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// CBOR encoding helpers
function encodeInt(n) {
  if (n < 24) return n.toString(16).padStart(2, '0');
  if (n < 256) return '18' + n.toString(16).padStart(2, '0');
  if (n < 65536) return '19' + n.toString(16).padStart(4, '0');
  return '1a' + n.toString(16).padStart(8, '0');
}

function encodeBytes(hex) {
  const len = hex.length / 2;
  if (len < 24) return (0x40 + len).toString(16).padStart(2, '0') + hex;
  if (len < 256) return '58' + len.toString(16).padStart(2, '0') + hex;
  return '59' + len.toString(16).padStart(4, '0') + hex;
}

function encodeList(items) {
  const len = items.length;
  if (len < 24) return (0x80 + len).toString(16).padStart(2, '0') + items.join('');
  return '98' + len.toString(16).padStart(2, '0') + items.join('');
}

function encodeConstructor(index, fields) {
  // d879xx = constructor 0-6, d87axx = constructor 7+
  const fieldsHex = fields.join('');
  const numFields = fields.length;

  if (index <= 6) {
    // d8799f...ff = constructor 0 with indefinite array
    // d879[80-97] = constructor 0 with definite array
    const tag = (0x79 + index).toString(16);
    if (numFields < 24) {
      return 'd8' + tag + (0x80 + numFields).toString(16).padStart(2, '0') + fieldsHex;
    }
    return 'd8' + tag + '9f' + fieldsHex + 'ff';
  }
  // Higher constructors use d87a with explicit index
  return 'd87a' + encodeList([encodeInt(index), ...fields]);
}

async function main() {
  console.log('\n🔧 Applying Testnet Parameters to Validators\n');

  // Get wallet PKH for oracle/admin lists
  const CONFIG = {
    network: process.env.NETWORK || 'preprod',
    blockfrostKey: process.env.BLOCKFROST_API_KEY,
    walletMnemonic: process.env.WALLET_SEED_PHRASE,
  };

  if (!CONFIG.blockfrostKey || !CONFIG.walletMnemonic) {
    console.error('❌ Missing BLOCKFROST_API_KEY or WALLET_SEED_PHRASE in .env');
    process.exit(1);
  }

  const provider = new BlockfrostProvider(CONFIG.blockfrostKey);
  const wallet = new MeshWallet({
    networkId: CONFIG.network === 'mainnet' ? 1 : 0,
    fetcher: provider,
    key: { type: 'mnemonic', words: CONFIG.walletMnemonic.trim().split(/\s+/) },
  });

  const address = wallet.getChangeAddress();
  const walletPkh = resolvePaymentKeyHash(address);
  console.log(`📍 Wallet PKH: ${walletPkh}`);

  // Placeholder values
  const zeroHash = '00'.repeat(28);  // 28-byte script hash
  const zeroPolicy = '00'.repeat(28); // PolicyId = 28 bytes
  const zeroAssetName = '';           // Empty asset name

  // Build CBOR for each config type
  const configs = {
    // PnftConfig: bioregion_registry, dna_oracle, oracle_threshold
    'pnft': encodeConstructor(0, [
      encodeBytes(zeroHash),
      encodeList([encodeBytes(walletPkh)]),
      encodeInt(1),
    ]),

    // RegistryConfig: pnft_policy
    'registry': encodeConstructor(0, [
      encodeBytes(zeroPolicy),
    ]),

    // GenesisConfig: genesis_utxo, total_supply, treasury, grants_pool
    // genesis_utxo is OutputReference { tx_hash, output_index }
    'genesis': encodeConstructor(0, [
      encodeConstructor(0, [encodeBytes('00'.repeat(32)), encodeInt(0)]), // OutputReference
      encodeInt(1000000000000), // 1 trillion total supply
      encodeBytes(zeroHash),
      encodeBytes(zeroHash),
    ]),

    // BioregionConfig: pnft_policy, beacon_policy, governance_contract, min_residents
    'bioregion': encodeConstructor(0, [
      encodeBytes(zeroPolicy),
      encodeBytes(zeroPolicy),
      encodeBytes(zeroHash),
      encodeInt(1),
    ]),
  };

  // Additional configs for all validators
  const additionalConfigs = {
    // UbiConfig: token_policy, token_name, pnft_policy, bioregion_policy, records_contract, treasury
    'ubi': encodeConstructor(0, [
      encodeBytes(zeroPolicy),        // token_policy
      encodeBytes(zeroAssetName || '554c545241'),  // token_name "ULTRA"
      encodeBytes(zeroPolicy),        // pnft_policy
      encodeBytes(zeroPolicy),        // bioregion_policy
      encodeBytes(zeroHash),          // records_contract
      encodeBytes(zeroHash),          // treasury
    ]),

    // TreasuryConfig: token_policy, token_name, pnft_policy, multisig, governance_contract
    'treasury': encodeConstructor(0, [
      encodeBytes(zeroPolicy),        // token_policy
      encodeBytes('554c545241'),      // token_name "ULTRA"
      encodeBytes(zeroPolicy),        // pnft_policy
      encodeConstructor(0, [          // multisig config
        encodeList([encodeBytes(walletPkh)]),
        encodeInt(1),
      ]),
      encodeBytes(zeroHash),          // governance_contract
    ]),

    // CollectiveConfig: pnft_policy, governance_contract
    'collective': encodeConstructor(0, [
      encodeBytes(zeroPolicy),        // pnft_policy
      encodeBytes(zeroHash),          // governance_contract
    ]),

    // RecordsConfig: pnft_policy
    'records': encodeConstructor(0, [
      encodeBytes(zeroPolicy),        // pnft_policy
    ]),

    // PreservationConfig: pnft_policy, land_registry
    'preservation': encodeConstructor(0, [
      encodeBytes(zeroPolicy),        // pnft_policy
      encodeBytes(zeroHash),          // land_registry
    ]),

    // EnergyConfig: pnft_policy, oracle_list
    'energy': encodeConstructor(0, [
      encodeBytes(zeroPolicy),        // pnft_policy
      encodeList([encodeBytes(walletPkh)]),  // oracle_list
    ]),

    // GrantsConfig: token_policy, pnft_policy, governance_contract
    'grants': encodeConstructor(0, [
      encodeBytes(zeroPolicy),        // token_policy
      encodeBytes(zeroPolicy),        // pnft_policy
      encodeBytes(zeroHash),          // governance_contract
    ]),

    // RemediationConfig: pnft_policy, oracle_list
    'remediation': encodeConstructor(0, [
      encodeBytes(zeroPolicy),        // pnft_policy
      encodeList([encodeBytes(walletPkh)]),  // oracle_list
    ]),

    // CommonsConfig: pnft_policy, governance_contract
    'commons': encodeConstructor(0, [
      encodeBytes(zeroPolicy),        // pnft_policy
      encodeBytes(zeroHash),          // governance_contract
    ]),
  };

  // Merge all configs
  const allConfigs = { ...configs, ...additionalConfigs };

  // Show all config CBOR values
  console.log('\n📋 Config CBOR values for all validators:');
  for (const [name, cbor] of Object.entries(allConfigs)) {
    console.log(`\n  ${name}: ${cbor.slice(0, 40)}...`);
  }

  // Define validator applications
  const validatorApps = [
    { config: 'pnft', module: 'pnft', validators: ['pnft_policy', 'pnft_spend'] },
    { config: 'registry', module: 'registry', validators: ['registry'] },
    { config: 'bioregion', module: 'bioregion', validators: ['bioregion'] },
    { config: 'ubi', module: 'ubi', validators: ['ubi'] },
    { config: 'treasury', module: 'treasury', validators: ['treasury'] },
    { config: 'collective', module: 'collective', validators: ['collective'] },
    { config: 'records', module: 'records', validators: ['records'] },
    { config: 'preservation', module: 'preservation', validators: ['preservation'] },
    { config: 'energy', module: 'energy', validators: ['energy'] },
    { config: 'grants', module: 'grants', validators: ['grants'] },
    { config: 'remediation', module: 'remediation', validators: ['remediation'] },
    { config: 'commons', module: 'commons', validators: ['commons'] },
  ];

  console.log('\n🔨 Applying parameters to all validators...\n');

  const appliedValidators = [];
  const tempFiles = [];
  let preamble = null;

  for (const app of validatorApps) {
    const cbor = allConfigs[app.config];
    if (!cbor) {
      console.log(`⚠️  Skipping ${app.module}: no config defined`);
      continue;
    }

    for (const validator of app.validators) {
      const tempFile = `plutus-temp-${app.module}-${validator}.json`;
      try {
        execSync(
          `aiken blueprint apply "${cbor}" -m ${app.module} -v ${validator} -o ${tempFile}`,
          { cwd: ROOT, stdio: 'pipe' }
        );

        const appliedJson = JSON.parse(fs.readFileSync(path.join(ROOT, tempFile)));

        if (!preamble) {
          preamble = appliedJson.preamble;
        }

        appliedValidators.push(...appliedJson.validators);
        tempFiles.push(tempFile);

        console.log(`  ✅ Applied ${app.config} to ${app.module}.${validator}`);
      } catch (error) {
        // Validator might not exist or might not have parameters
        console.log(`  ⚠️  Skipped ${app.module}.${validator}: ${error.message.split('\n')[0]}`);
      }
    }
  }

  // Create combined plutus-testnet.json
  if (appliedValidators.length > 0) {
    const testnetPlutus = {
      preamble: preamble || {
        title: 'ultralife-protocol/validators',
        description: 'UltraLife Protocol validators with testnet parameters applied',
        version: '1.0.0',
        compiler: { name: 'Aiken', version: '1.0.0' },
      },
      validators: appliedValidators,
    };

    fs.writeFileSync(
      path.join(ROOT, 'plutus-testnet.json'),
      JSON.stringify(testnetPlutus, null, 2)
    );

    console.log(`\n✅ Created plutus-testnet.json with ${appliedValidators.length} validators`);
    console.log('   Validators ready for deployment without parameters');

    // Save config summary to deployment.json
    const deploymentPath = path.join(__dirname, 'deployment.json');
    let deployment = {};
    if (fs.existsSync(deploymentPath)) {
      deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
    }

    deployment.testnetParams = {
      appliedAt: new Date().toISOString(),
      walletPkh,
      validatorCount: appliedValidators.length,
      validators: appliedValidators.map(v => v.title || 'unknown'),
    };

    const { atomicWriteSync } = await import('./utils.mjs');
    atomicWriteSync(deploymentPath, deployment);
    console.log('   Updated deployment.json with parameter info');
  } else {
    console.log('\n⚠️  No validators were successfully applied');
    console.log('   This might be normal if validators are not parameterized');
  }

  // Cleanup temp files
  for (const tempFile of tempFiles) {
    try {
      fs.unlinkSync(path.join(ROOT, tempFile));
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

main().catch(console.error);
