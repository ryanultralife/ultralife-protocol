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

  // For now, just show what we'd apply
  console.log('\n📋 Config CBOR (for aiken blueprint apply):');
  for (const [name, cbor] of Object.entries(configs)) {
    console.log(`\n${name}:`);
    console.log(`  ${cbor}`);
  }

  // Apply PnftConfig to pnft validators
  console.log('\n🔨 Applying PnftConfig to pnft validators...');

  const pnftCbor = configs['pnft'];

  try {
    // Apply to pnft_policy
    execSync(
      `aiken blueprint apply "${pnftCbor}" -m pnft -v pnft_policy -o plutus-pnft-policy.json`,
      { cwd: ROOT, stdio: 'pipe' }
    );
    console.log('✅ Applied to pnft.pnft_policy');

    // Apply to pnft_spend
    execSync(
      `aiken blueprint apply "${pnftCbor}" -m pnft -v pnft_spend -o plutus-pnft-spend.json`,
      { cwd: ROOT, stdio: 'pipe' }
    );
    console.log('✅ Applied to pnft.pnft_spend');

    // Read and merge the applied validators
    const policyJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'plutus-pnft-policy.json')));
    const spendJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'plutus-pnft-spend.json')));

    // Create minimal plutus-testnet.json with just the pnft validators
    const testnetPlutus = {
      preamble: policyJson.preamble,
      validators: [
        ...policyJson.validators,
        ...spendJson.validators,
      ],
    };

    fs.writeFileSync(
      path.join(ROOT, 'plutus-testnet.json'),
      JSON.stringify(testnetPlutus, null, 2)
    );

    console.log('\n✅ Created plutus-testnet.json with applied pNFT validators');
    console.log('   Validators ready for deployment without parameters');

    // Cleanup temp files
    fs.unlinkSync(path.join(ROOT, 'plutus-pnft-policy.json'));
    fs.unlinkSync(path.join(ROOT, 'plutus-pnft-spend.json'));

  } catch (error) {
    console.error('❌ Failed to apply parameters:', error.message);
    if (error.stderr) console.error(error.stderr.toString());
    process.exit(1);
  }
}

main().catch(console.error);
