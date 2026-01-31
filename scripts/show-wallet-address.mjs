#!/usr/bin/env node
/**
 * Show Wallet Address
 *
 * Displays the address derived from your .env seed phrase.
 * Use this to verify you're funding the correct address.
 */

import 'dotenv/config';
import { MeshWallet, BlockfrostProvider } from '@meshsdk/core';

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  network: process.env.NETWORK || 'preprod',
  blockfrostKey: process.env.BLOCKFROST_API_KEY,
  seedPhrase: process.env.WALLET_SEED_PHRASE,
};

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('\n' + '='.repeat(70));
  console.log('  UltraLife Protocol — Wallet Address Checker');
  console.log('='.repeat(70) + '\n');

  // Validate config
  if (!CONFIG.blockfrostKey) {
    console.error('❌ Missing BLOCKFROST_API_KEY in .env');
    process.exit(1);
  }

  if (!CONFIG.seedPhrase || CONFIG.seedPhrase.includes('your twenty four')) {
    console.error('❌ Missing or invalid WALLET_SEED_PHRASE in .env');
    console.error('   Please add your 24-word seed phrase to scripts/.env');
    process.exit(1);
  }

  console.log(`Network: ${CONFIG.network}`);
  console.log('');

  // Initialize provider and wallet
  const provider = new BlockfrostProvider(CONFIG.blockfrostKey);

  const wallet = new MeshWallet({
    networkId: CONFIG.network === 'mainnet' ? 1 : 0,
    fetcher: provider,
    submitter: provider,
    key: {
      type: 'mnemonic',
      words: CONFIG.seedPhrase.split(' '),
    },
  });

  // Get addresses
  const addresses = wallet.getUsedAddresses();
  const unusedAddresses = wallet.getUnusedAddresses();
  const changeAddress = wallet.getChangeAddress();

  console.log('📍 Your wallet address (from .env seed phrase):');
  console.log('');
  console.log(`   ${changeAddress}`);
  console.log('');

  // Check balance
  try {
    const utxos = await wallet.getUtxos();
    let totalLovelace = 0n;
    for (const utxo of utxos) {
      for (const amount of utxo.output.amount) {
        if (amount.unit === 'lovelace') {
          totalLovelace += BigInt(amount.quantity);
        }
      }
    }
    const adaBalance = Number(totalLovelace) / 1_000_000;

    console.log(`💰 Balance: ${adaBalance.toLocaleString()} ADA`);
    console.log(`   (${utxos.length} UTxO${utxos.length !== 1 ? 's' : ''})`);
  } catch (err) {
    console.log('💰 Balance: Unable to fetch (check Blockfrost key)');
  }

  console.log('');
  console.log('─'.repeat(70));
  console.log('');
  console.log('📋 NEXT STEPS:');
  console.log('');
  console.log('   If this address has 0 ADA, you have two options:');
  console.log('');
  console.log('   Option 1: Send tADA to the address above');
  console.log('   - Open your funded wallet (Eternl/Nami/Lace)');
  console.log('   - Send some tADA to the address shown above');
  console.log('   - Wait for confirmation, then run deploy again');
  console.log('');
  console.log('   Option 2: Use your funded wallet\'s seed phrase');
  console.log('   - In Eternl: Settings → Security → Show Seed Phrase');
  console.log('   - In Nami: Settings → Security → Recovery Phrase');
  console.log('   - Update scripts/.env with that seed phrase');
  console.log('');
  console.log('─'.repeat(70));
  console.log('');
  console.log('🔗 View on Cardanoscan:');
  const explorerBase = CONFIG.network === 'mainnet'
    ? 'https://cardanoscan.io'
    : `https://${CONFIG.network}.cardanoscan.io`;
  console.log(`   ${explorerBase}/address/${changeAddress}`);
  console.log('');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
