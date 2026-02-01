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

Getting Started:

  1. 🪪  Mint your pNFT identity
     "Mint me a pNFT on preprod"

  2. 📍  Register your bioregion stake pool
     "Register my stake pool NASEC for the Sierra Nevada bioregion"

  3. 🏪  Offer stake pool services
     "Create an offering for stake pool operation - 2% margin, ticker NASEC"

Participate in the Economy:

  4. 🌱  Track environmental impact
     "How does impact tracking work? Show me the impact validators"

  5. 🤝  Create a regional SPO collective
     "Create a collective called 'NASEC Pool Operators' for our bioregion"

  6. 🏠  Register land or commons
     "I want to register community land in my bioregion"

  7. 💰  Buy ULTRA tokens
     "How does the bonding curve work? What's the current ULTRA price?"

Explore the Protocol:

  8. 🔍  Understand UltraLife
     "What is UltraLife? Explain the vision"

  9. 📜  Explore the 34 validators
     "Walk me through all 34 smart contracts"

  10. 🌐  Learn about UBI distribution
      "How does UBI work? Who qualifies?"
`);

  if (balance < 5_000_000n) {
    console.log(`
⚠️  Your wallet needs test ADA first!

    Get it from: https://docs.cardano.org/cardano-testnets/tools/faucet/

    Then come back and try any of the above.
`);
  }

  const choice = await prompt(`
What would you like to do? (Enter 1-10, or press Enter to exit): `);

  if (choice === '1') {
    if (balance < 5_000_000n) {
      log.warn('Fund your wallet first, then run: npm run mint:pnft:basic');
    } else {
      console.log(`
Great choice! Your pNFT is your on-chain identity - one per person, permanent.

To mint, run:

  npm run mint:pnft:basic

Or tell your LLM agent: "Mint me a pNFT"

Verification levels:
  • Basic    - wallet verification only (what you're minting now)
  • Ward     - for minors, linked to guardian
  • Standard - government ID verified
  • Verified - DNA verified (one per human, permanent)
  • Steward  - community-recognized leaders
`);
    }
  } else if (choice === '2') {
    console.log(`
As an SPO, you can register your pool to serve a bioregion!

Tell your LLM agent:

  "Register my stake pool for the Sierra Nevada bioregion"
  "How do bioregion stake pools work?"
  "What validators handle SPO integration?"

Your pool can:
  • Validate bioregion transactions
  • Earn ULTRA rewards for ecosystem services
  • Participate in regional governance
  • Support local UBI distribution

See: docs/VALIDATOR_NETWORK.md for full SPO integration details.
`);
  } else if (choice === '3') {
    console.log(`
List your stake pool services on the marketplace!

Tell your LLM agent:

  "Create an offering for stake pool delegation services"
  "I charge 2% margin, pool ticker is NASEC, minimum delegation 100 ADA"
  "How does the marketplace validator work?"

Your offering can include:
  • Delegation services
  • Technical consulting
  • Pool operation training
  • Multi-pool management

Note: You'll need a pNFT identity first.
`);
  } else if (choice === '4') {
    console.log(`
Every transaction in UltraLife tracks environmental impact!

Tell your LLM agent:

  "Explain the impact tracking system"
  "What are impact compounds?"
  "Show me the impact, remediation, and preservation validators"
  "How does consumer impact accrual work?"

Key concepts:
  • Impact measured in chemical compounds (CO2, H2O, etc.)
  • Consumer accrues full supply chain impact
  • Negative impact requires remediation
  • Positive impact earns rewards

See: docs/IMPACT_COMPOUNDS.md
`);
  } else if (choice === '5') {
    console.log(`
SPOs can form collectives for governance and coordination!

Tell your LLM agent:

  "Create a collective called 'NASEC Pool Operators'"
  "How do collectives govern themselves?"
  "What's the relationship between collectives and bioregions?"

Collective features:
  • Multi-sig governance
  • Shared treasury
  • Identity recovery (5-of-9 trusted members)
  • Regional coordination

Note: You'll need a pNFT identity first.
`);
  } else if (choice === '6') {
    console.log(`
Register land rights or contribute to commons!

Tell your LLM agent:

  "How do land rights work in UltraLife?"
  "What are commons and how are they governed?"
  "Register community garden at [location]"

Land features:
  • Transparent ownership records
  • Commons for shared resources
  • Bioregion-linked governance
  • Impact tracking for land use

See: docs/LAND_RIGHTS.md (if exists) or validators/land_rights.ak
`);
  } else if (choice === '7') {
    console.log(`
ULTRA tokens power the entire economy!

Tell your LLM agent:

  "Explain the bonding curve treasury"
  "What's the current ULTRA token price?"
  "How do I buy ULTRA tokens?"
  "What's the token distribution model?"

Bonding curve mechanics:
  • 400 billion total supply
  • Price: tokens_outstanding / 400B
  • Starts at $0.0000000025
  • Ends at $1.00 when fully distributed
  • All purchases are permanent (no sells)

See: docs/TOKEN_DISTRIBUTION.md
`);
  } else if (choice === '8') {
    console.log(`
Understand the vision!

Tell your LLM agent:

  "What is UltraLife Protocol?"
  "What problem does it solve?"
  "How is this different from other blockchains?"
  "What does 'management software for life on Earth' mean?"

Key principles:
  • One identity per human (DNA-verified pNFT)
  • Every transaction has measured impact
  • Bioregions not borders
  • Consumer accrues impact
  • No chokepoints - fully decentralized

See: docs/WHAT_IT_DOES.md
`);
  } else if (choice === '9') {
    console.log(`
Explore all 34 smart contracts!

Tell your LLM agent:

  "List all 34 validators and what they do"
  "Explain the pNFT validator"
  "How does the treasury validator work?"
  "Show me the stake_pool validator code"

Categories:
  • Identity: pnft, recovery
  • Token: token, treasury
  • Marketplace: marketplace, work_auction
  • Bioregion: bioregion, land_rights, commons
  • Impact: impact, impact_market, remediation, preservation
  • Collectives: collective, care
  • Infrastructure: ubi, governance, grants, energy

See: docs/TESTNET_STATUS.md for full deployment list
`);
  } else if (choice === '10') {
    console.log(`
Universal Basic Income for all verified humans!

Tell your LLM agent:

  "How does UBI distribution work?"
  "Who qualifies for UBI?"
  "How is UBI funded?"
  "Show me the ubi validator"

UBI mechanics:
  • Requires Verified (DNA) pNFT level
  • Distributed per epoch
  • Funded by protocol fees + treasury
  • Bioregion-weighted based on local cost of living
  • Every verified human receives equal share

See: docs/ECONOMIC_MODEL.md
`);
  } else {
    console.log(`
Remember: The bar for participation is "can you talk?"

Just open your LLM coding agent and start chatting!

Some things to try:
  • "What can I do as an SPO in UltraLife?"
  • "How would a farmer use this system?"
  • "Explain how someone would sell eggs using UltraLife"
  • "What happens when I buy something?"
`);
  }

  console.log(`
─────────────────────────────────────────────────────────────────
📚 More info:
   • Quick Start:     docs/NASEC_TESTNET_GUIDE.md
   • LLM Agent Guide: docs/LLM_AGENT_GUIDE.md
   • Testnet Status:  docs/TESTNET_STATUS.md
   • SPO Integration: docs/VALIDATOR_NETWORK.md
─────────────────────────────────────────────────────────────────
`);
}

main().catch(error => {
  log.error(error.message);
  process.exit(1);
});
