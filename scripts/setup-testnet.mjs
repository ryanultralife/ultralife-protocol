#!/usr/bin/env node
/**
 * UltraLife Protocol — Testnet Setup
 *
 * Interactive setup for testing on preprod:
 * 1. Validates or prompts for Blockfrost API key
 * 2. Generates a new wallet or uses existing seed phrase
 * 3. Checks balance and shows faucet link if needed
 * 4. Creates/updates .env file
 *
 * Usage:
 *   node setup-testnet.mjs
 *   node setup-testnet.mjs --generate-wallet
 *   node setup-testnet.mjs --blockfrost-key YOUR_KEY
 */

import {
  BlockfrostProvider,
  MeshWallet,
} from '@meshsdk/core';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '.env');

// =============================================================================
// UTILITIES
// =============================================================================

const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  step: (n, msg) => console.log(`\n📍 Step ${n}: ${msg}`),
};

function formatAda(lovelace) {
  return (Number(lovelace) / 1_000_000).toFixed(2) + ' ADA';
}

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function promptSecret(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Note: This doesn't actually hide input in all terminals
  // For production, use a proper secret input library
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// =============================================================================
// WALLET GENERATION
// =============================================================================

function generateWallet() {
  // MeshWallet can generate a new mnemonic
  const mnemonic = MeshWallet.brew();
  return mnemonic;
}

async function getWalletFromMnemonic(mnemonic) {
  const wallet = new MeshWallet({
    networkId: 0, // preprod
    key: {
      type: 'mnemonic',
      words: mnemonic.trim().split(/\s+/),
    },
  });

  return {
    address: wallet.getChangeAddress(),
    wallet,
  };
}

// =============================================================================
// BLOCKFROST VALIDATION
// =============================================================================

async function validateBlockfrostKey(apiKey) {
  try {
    const provider = new BlockfrostProvider(apiKey);
    // Try to fetch something to validate the key
    await provider.fetchProtocolParameters();
    return { valid: true, provider };
  } catch (error) {
    return { valid: false, error: error.message };
  }
}

// =============================================================================
// ENV FILE MANAGEMENT
// =============================================================================

function readEnvFile() {
  if (!fs.existsSync(ENV_PATH)) {
    return {};
  }

  const content = fs.readFileSync(ENV_PATH, 'utf8');
  const env = {};

  for (const line of content.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      env[match[1]] = match[2];
    }
  }

  return env;
}

function writeEnvFile(env) {
  const lines = Object.entries(env).map(([key, value]) => `${key}=${value}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n');
}

// =============================================================================
// MAIN SETUP FLOW
// =============================================================================

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         UltraLife Protocol — Testnet Setup                    ║
╠═══════════════════════════════════════════════════════════════╣
║  This wizard will set up everything you need to test on       ║
║  Cardano preprod testnet.                                     ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Parse arguments
  const args = process.argv.slice(2);
  const generateNew = args.includes('--generate-wallet');
  const keyArg = args.find((a, i) => args[i - 1] === '--blockfrost-key');

  // Load existing env
  let env = readEnvFile();
  env.NETWORK = 'preprod';

  // =========================================================================
  // STEP 1: Blockfrost API Key
  // =========================================================================
  log.step(1, 'Blockfrost API Key');

  let blockfrostKey = keyArg || env.BLOCKFROST_API_KEY || process.env.BLOCKFROST_API_KEY;

  if (blockfrostKey) {
    log.info(`Found existing key: ${blockfrostKey.slice(0, 12)}...`);
    const { valid, error } = await validateBlockfrostKey(blockfrostKey);

    if (valid) {
      log.success('Blockfrost key is valid!');
    } else {
      log.error(`Key validation failed: ${error}`);
      blockfrostKey = null;
    }
  }

  if (!blockfrostKey) {
    console.log(`
To get a free Blockfrost API key:
  1. Go to https://blockfrost.io
  2. Sign up / Log in
  3. Create a new project
  4. Select "Cardano preprod" network
  5. Copy the API key (starts with "preprod")
`);

    blockfrostKey = await prompt('Enter your Blockfrost preprod API key: ');

    if (!blockfrostKey || !blockfrostKey.startsWith('preprod')) {
      log.error('Invalid key format. Preprod keys should start with "preprod"');
      process.exit(1);
    }

    const { valid, error } = await validateBlockfrostKey(blockfrostKey);
    if (!valid) {
      log.error(`Key validation failed: ${error}`);
      process.exit(1);
    }

    log.success('Blockfrost key validated!');
  }

  env.BLOCKFROST_API_KEY = blockfrostKey;

  // =========================================================================
  // STEP 2: Wallet Setup
  // =========================================================================
  log.step(2, 'Wallet Setup');

  let seedPhrase = env.WALLET_SEED_PHRASE || process.env.WALLET_SEED_PHRASE;
  let walletAddress;

  if (generateNew || !seedPhrase) {
    console.log(`
Options:
  1. Generate a new test wallet (recommended for testing)
  2. Use your existing wallet seed phrase
`);

    const choice = await prompt('Enter 1 or 2: ');

    if (choice === '1') {
      log.info('Generating new wallet...');
      const mnemonic = generateWallet();
      seedPhrase = mnemonic.join(' ');

      console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🔐 NEW WALLET GENERATED - SAVE THIS SEED PHRASE! 🔐          ║
╠═══════════════════════════════════════════════════════════════╣
${mnemonic.map((w, i) => `║  ${(i + 1).toString().padStart(2)}. ${w.padEnd(12)}`).join((i) => (i + 1) % 4 === 0 ? '║\n' : '')}
╠═══════════════════════════════════════════════════════════════╣
║  ⚠️  This is a TEST wallet. Don't use for real funds!         ║
╚═══════════════════════════════════════════════════════════════╝
`);
      // Pretty print the mnemonic
      console.log('\nSeed phrase (copy this):');
      console.log('─'.repeat(60));
      console.log(seedPhrase);
      console.log('─'.repeat(60));

    } else {
      seedPhrase = await promptSecret('\nEnter your 24-word seed phrase: ');
    }
  }

  // Validate seed phrase
  const words = seedPhrase.trim().split(/\s+/);
  if (words.length !== 24 && words.length !== 15 && words.length !== 12) {
    log.error(`Invalid seed phrase: expected 12, 15, or 24 words, got ${words.length}`);
    process.exit(1);
  }

  // Get wallet address
  try {
    const { address } = await getWalletFromMnemonic(seedPhrase);
    walletAddress = address;
    log.success(`Wallet address: ${address}`);
  } catch (error) {
    log.error(`Failed to derive wallet: ${error.message}`);
    process.exit(1);
  }

  env.WALLET_SEED_PHRASE = seedPhrase;

  // =========================================================================
  // STEP 3: Check Balance / Fund Wallet
  // =========================================================================
  log.step(3, 'Wallet Funding');

  const provider = new BlockfrostProvider(blockfrostKey);
  let balance = 0n;

  try {
    const utxos = await provider.fetchAddressUTxOs(walletAddress);
    balance = utxos.reduce((sum, u) => {
      const l = u.output.amount.find(a => a.unit === 'lovelace');
      return sum + BigInt(l?.quantity || 0);
    }, 0n);
  } catch (error) {
    log.warn(`Could not fetch balance: ${error.message}`);
  }

  if (balance > 0n) {
    log.success(`Wallet balance: ${formatAda(balance)}`);
  } else {
    console.log(`
Your wallet needs test ADA. Get some from the faucet:

  1. Go to: https://docs.cardano.org/cardano-testnets/tools/faucet/
  2. Select "Preprod" network
  3. Paste this address:

     ${walletAddress}

  4. Click "Request funds"
  5. Wait ~1 minute for confirmation
`);

    log.warn('Wallet has 0 ADA - fund it from the faucet before minting');
  }

  // =========================================================================
  // STEP 4: Save Configuration
  // =========================================================================
  log.step(4, 'Save Configuration');

  writeEnvFile(env);
  log.success(`Configuration saved to ${ENV_PATH}`);

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    ✅ SETUP COMPLETE!                         ║
╠═══════════════════════════════════════════════════════════════╣
║  Network:     preprod                                         ║
║  Blockfrost:  ${blockfrostKey.slice(0, 20)}...${' '.repeat(24)}║
║  Address:     ${walletAddress.slice(0, 40)}...    ║
║  Balance:     ${formatAda(balance).padEnd(48)}║
╚═══════════════════════════════════════════════════════════════╝
`);

  // =========================================================================
  // STEP 5: What Would You Like To Do?
  // =========================================================================
  await showUseCases(balance);
}

async function showUseCases(balance) {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║          💬 WHAT WOULD YOU LIKE TO DO?                        ║
╠═══════════════════════════════════════════════════════════════╣
║  UltraLife is conversation-first. Just talk to your LLM      ║
║  coding agent (Claude Code, Cursor, Windsurf, etc.)          ║
╚═══════════════════════════════════════════════════════════════╝

Here's what you can do:

  1. 🪪  Mint your pNFT identity
     Say: "Mint me a pNFT on preprod"

  2. 📍  Explore bioregions
     Say: "What bioregions exist? Show me their health indices"

  3. 🏪  List an offering (goods/services)
     Say: "I want to offer stake pool operation services"

  4. 🤝  Create a collective
     Say: "Create a collective for local farmers in my bioregion"

  5. 💰  Check token balances
     Say: "What's my ULTRA token balance?"

  6. 🔍  Explore the protocol
     Say: "Explain how UltraLife works"
     Say: "What are the 34 validators?"
     Say: "How does impact tracking work?"
`);

  if (balance < 5_000_000n) {
    console.log(`
⚠️  Your wallet needs test ADA first!

    Get it from: https://docs.cardano.org/cardano-testnets/tools/faucet/

    Then come back and try any of the above.
`);
  }

  const choice = await prompt(`
What would you like to do? (Enter 1-6, or press Enter to exit): `);

  if (choice === '1') {
    if (balance < 5_000_000n) {
      log.warn('Fund your wallet first, then run: npm run mint:pnft:basic');
    } else {
      console.log(`
Great choice! To mint your pNFT identity, run:

  npm run mint:pnft:basic

Or just tell your LLM agent: "Mint me a pNFT"
`);
    }
  } else if (choice === '2') {
    console.log(`
To explore bioregions, tell your LLM agent:

  "Show me the bioregion validator and explain how regions work"
  "What bioregions are defined in the protocol?"
  "How do bioregion health indices work?"
`);
  } else if (choice === '3') {
    console.log(`
To list an offering, tell your LLM agent:

  "I want to list my services on the marketplace"
  "Create an offering for [your product/service]"
  "How does the marketplace validator work?"

Note: You'll need a pNFT identity first.
`);
  } else if (choice === '4') {
    console.log(`
To create a collective, tell your LLM agent:

  "Create a collective called [name] for [purpose]"
  "How do collectives work in UltraLife?"
  "What's the governance model for collectives?"

Note: You'll need a pNFT identity first.
`);
  } else if (choice === '5') {
    console.log(`
To check balances, tell your LLM agent:

  "What's my wallet balance?"
  "Show me my UTxOs"
  "Check if I have any tokens"
`);
  } else if (choice === '6') {
    console.log(`
To explore the protocol, tell your LLM agent:

  "What is UltraLife Protocol?"
  "Walk me through the 34 validators"
  "How does the bonding curve treasury work?"
  "Explain the impact tracking system"
  "What's the UBI distribution model?"

The agent can read all docs in the docs/ folder and explain any concept.
`);
  } else {
    console.log(`
Remember: The bar for participation is "can you talk?"

Just open your LLM coding agent and start chatting!
`);
  }

  console.log(`
─────────────────────────────────────────────────────────────────
📚 More info:
   • Quick Start:     docs/NASEC_TESTNET_GUIDE.md
   • LLM Agent Guide: docs/LLM_AGENT_GUIDE.md
   • Testnet Status:  docs/TESTNET_STATUS.md
─────────────────────────────────────────────────────────────────
`);
}

main().catch(error => {
  log.error(error.message);
  process.exit(1);
});
