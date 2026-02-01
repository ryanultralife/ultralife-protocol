#!/usr/bin/env node
/**
 * UltraLife Protocol — Impact-Tracked ULTRA Transfer
 *
 * Every transaction in UltraLife carries impact data.
 * This is the core of the transparent economy.
 *
 * Usage:
 *   node transfer-ultra.mjs --to Alice --amount 10 --type goods --impact food
 *   node transfer-ultra.mjs --to <address> --amount 5 --type services
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// Fix libsodium ESM
function fixLibsodiumESM() {
  const nodeModules = path.join(__dirname, 'node_modules');
  const targetDir = path.join(nodeModules, 'libsodium-wrappers-sumo', 'dist', 'modules-sumo-esm');
  const targetFile = path.join(targetDir, 'libsodium-sumo.mjs');
  const sourceFile = path.join(nodeModules, 'libsodium-sumo', 'dist', 'modules-sumo-esm', 'libsodium-sumo.mjs');
  if (!fs.existsSync(targetFile) && fs.existsSync(sourceFile)) {
    try { fs.copyFileSync(sourceFile, targetFile); } catch (err) {}
  }
}
fixLibsodiumESM();

const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
};

const CONFIG = {
  network: process.env.NETWORK || 'preprod',
  blockfrostKey: process.env.BLOCKFROST_API_KEY,
  walletMnemonic: process.env.WALLET_SEED_PHRASE,
  deploymentPath: path.join(__dirname, 'deployment.json'),
};

// Transaction types from the Aiken validator
const TX_TYPES = {
  labor: { code: 1, name: 'Labor', description: 'Work performed' },
  goods: { code: 2, name: 'Goods', description: 'Physical products' },
  services: { code: 3, name: 'Services', description: 'Service provided' },
  gift: { code: 4, name: 'Gift', description: 'Voluntary transfer' },
  investment: { code: 5, name: 'Investment', description: 'Capital allocation' },
  remediation: { code: 6, name: 'Remediation', description: 'Environmental repair' },
};

// Impact categories (compound flows)
const IMPACT_PRESETS = {
  food: {
    description: 'Food purchase - local organic',
    compounds: [
      { compound: 'CO2', quantity: -200, unit: 'g', confidence: 70 },  // Carbon from transport
      { compound: 'H2O', quantity: -50, unit: 'L', confidence: 60 },   // Water footprint
      { compound: 'N', quantity: 5, unit: 'g', confidence: 50 },       // Nitrogen cycle benefit
    ],
  },
  digital: {
    description: 'Digital service - low impact',
    compounds: [
      { compound: 'CO2', quantity: -10, unit: 'g', confidence: 80 },   // Server energy
    ],
  },
  transport: {
    description: 'Transportation service',
    compounds: [
      { compound: 'CO2', quantity: -500, unit: 'g', confidence: 85 },  // Fuel emissions
      { compound: 'NOx', quantity: -5, unit: 'g', confidence: 70 },    // Exhaust
    ],
  },
  renewable: {
    description: 'Renewable energy purchase',
    compounds: [
      { compound: 'CO2', quantity: 100, unit: 'g', confidence: 90 },   // Avoided emissions
    ],
  },
  craft: {
    description: 'Handmade/artisan goods',
    compounds: [
      { compound: 'CO2', quantity: -50, unit: 'g', confidence: 60 },
    ],
  },
  regenerative: {
    description: 'Regenerative agriculture product',
    compounds: [
      { compound: 'CO2', quantity: 500, unit: 'g', confidence: 75 },   // Carbon sequestered
      { compound: 'H2O', quantity: 100, unit: 'L', confidence: 65 },   // Water retention
      { compound: 'N', quantity: 20, unit: 'g', confidence: 70 },      // Soil nitrogen
    ],
  },
  neutral: {
    description: 'Estimated neutral impact',
    compounds: [
      { compound: 'CO2', quantity: 0, unit: 'g', confidence: 50 },
    ],
  },
};

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║        UltraLife Protocol — Impact-Tracked Transfer           ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Parse arguments
  const args = process.argv.slice(2);
  const toIdx = args.indexOf('--to');
  const amountIdx = args.indexOf('--amount');
  const typeIdx = args.indexOf('--type');
  const impactIdx = args.indexOf('--impact');
  const noteIdx = args.indexOf('--note');
  const listIdx = args.indexOf('--list-impacts');

  if (listIdx >= 0) {
    console.log('Available impact presets:\n');
    for (const [key, preset] of Object.entries(IMPACT_PRESETS)) {
      console.log(`  ${key.padEnd(12)} ${preset.description}`);
      for (const c of preset.compounds) {
        const sign = c.quantity >= 0 ? '+' : '';
        console.log(`              ${c.compound}: ${sign}${c.quantity}${c.unit} (${c.confidence}% confidence)`);
      }
      console.log('');
    }
    return;
  }

  if (!CONFIG.blockfrostKey || !CONFIG.walletMnemonic) {
    log.error('Missing configuration. Set BLOCKFROST_API_KEY and WALLET_SEED_PHRASE in .env');
    process.exit(1);
  }

  const { atomicWriteSync, safeReadJson, formatAda } = await import('./utils.mjs');
  const { BlockfrostProvider, MeshWallet } = await import('@meshsdk/core');

  // Load deployment
  const deployment = safeReadJson(CONFIG.deploymentPath, {});
  const testUsers = deployment.testUsers || [];
  const pnfts = deployment.pnfts || [];

  // Parse recipient
  if (toIdx < 0) {
    log.error('Missing --to argument');
    log.info('Usage: node transfer-ultra.mjs --to <name|address> --amount <N>');
    if (testUsers.length > 0) {
      log.info('');
      log.info('Available recipients:');
      for (const user of testUsers) {
        log.info(`  ${user.name}: ${user.address.slice(0, 40)}...`);
      }
    }
    process.exit(1);
  }

  const toArg = args[toIdx + 1];
  let recipientAddress;
  let recipientName;
  let recipientPnft;

  // Try to find by name first
  const testUser = testUsers.find(u => u.name.toLowerCase() === toArg.toLowerCase());
  if (testUser) {
    recipientAddress = testUser.address;
    recipientName = testUser.name;
    recipientPnft = testUser.pnftId;
  } else if (toArg.startsWith('addr')) {
    recipientAddress = toArg;
    recipientName = toArg.slice(0, 20) + '...';
    // Find pNFT for this address
    const pnft = pnfts.find(p => p.owner === toArg);
    recipientPnft = pnft?.id || 'unknown';
  } else {
    log.error(`Unknown recipient: ${toArg}`);
    log.info('Use a test user name or full address');
    process.exit(1);
  }

  // Parse amount
  const amount = amountIdx >= 0 ? parseInt(args[amountIdx + 1]) : 10;
  if (isNaN(amount) || amount <= 0) {
    log.error('Invalid amount');
    process.exit(1);
  }

  // Parse transaction type
  const txTypeArg = typeIdx >= 0 ? args[typeIdx + 1].toLowerCase() : 'goods';
  const txType = TX_TYPES[txTypeArg] || TX_TYPES.goods;

  // Parse impact preset
  const impactArg = impactIdx >= 0 ? args[impactIdx + 1].toLowerCase() : 'neutral';
  const impactPreset = IMPACT_PRESETS[impactArg] || IMPACT_PRESETS.neutral;

  // Parse note
  const note = noteIdx >= 0 ? args[noteIdx + 1] : '';

  // Initialize sender wallet
  const provider = new BlockfrostProvider(CONFIG.blockfrostKey);
  const wallet = new MeshWallet({
    networkId: CONFIG.network === 'mainnet' ? 1 : 0,
    fetcher: provider,
    submitter: provider,
    key: {
      type: 'mnemonic',
      words: CONFIG.walletMnemonic.trim().split(/\s+/),
    },
  });

  const senderAddress = wallet.getChangeAddress();
  const senderPnft = pnfts.find(p => p.owner === senderAddress);

  if (!senderPnft) {
    log.error('Sender does not have a pNFT!');
    log.info('Mint one first: npm run mint:pnft:basic');
    process.exit(1);
  }

  // Check sender balance
  const senderBalance = deployment.ultraBalances?.[senderAddress] || 0;
  if (senderBalance < amount) {
    log.error(`Insufficient ULTRA balance. Have: ${senderBalance}, Need: ${amount}`);
    process.exit(1);
  }

  log.info(`From: ${senderPnft.id} (${senderAddress.slice(0, 30)}...)`);
  log.info(`To: ${recipientName} (${recipientPnft})`);
  log.info(`Amount: ${amount} ULTRA`);
  log.info(`Type: ${txType.name} - ${txType.description}`);
  log.info(`Impact: ${impactPreset.description}`);

  // Calculate net impact
  const netImpact = impactPreset.compounds.reduce((sum, c) => {
    return sum + (c.quantity * c.confidence / 100);
  }, 0);
  const impactSign = netImpact >= 0 ? '+' : '';
  log.info(`Net impact: ${impactSign}${netImpact.toFixed(1)} (weighted by confidence)`);

  // Create transaction record
  const currentSlot = Math.floor(Date.now() / 1000) - 1654041600;
  const txHash = 'ultra_tx_' + crypto.randomBytes(16).toString('hex');

  const transactionRecord = {
    txHash: txHash,
    sender: senderPnft.id,
    senderAddress: senderAddress,
    senderBioregion: senderPnft.bioregion || 'sierra_nevada',
    recipient: recipientPnft,
    recipientAddress: recipientAddress,
    recipientBioregion: testUser?.bioregion || 'sierra_nevada',
    amount: amount,
    txType: txType,
    impact: {
      preset: impactArg,
      description: impactPreset.description,
      compounds: impactPreset.compounds,
      netImpact: netImpact,
      evidenceHash: crypto.createHash('sha256').update(JSON.stringify(impactPreset)).digest('hex'),
    },
    note: note,
    slot: currentSlot,
    timestamp: new Date().toISOString(),
    testnetSimulated: true,
  };

  // Update balances
  deployment.ultraBalances[senderAddress] = senderBalance - amount;
  deployment.ultraBalances[recipientAddress] = (deployment.ultraBalances[recipientAddress] || 0) + amount;

  // Store transaction
  deployment.transactions = deployment.transactions || [];
  deployment.transactions.push(transactionRecord);

  // Aggregate impact data by bioregion (for SPO data collation)
  deployment.bioregionImpact = deployment.bioregionImpact || {};
  const senderBio = senderPnft.bioregion || 'sierra_nevada';
  deployment.bioregionImpact[senderBio] = deployment.bioregionImpact[senderBio] || {
    totalTransactions: 0,
    totalVolume: 0,
    netImpact: 0,
    byType: {},
    byCompound: {},
  };

  const bioData = deployment.bioregionImpact[senderBio];
  bioData.totalTransactions += 1;
  bioData.totalVolume += amount;
  bioData.netImpact += netImpact;
  bioData.byType[txType.name] = (bioData.byType[txType.name] || 0) + 1;

  for (const compound of impactPreset.compounds) {
    bioData.byCompound[compound.compound] = bioData.byCompound[compound.compound] || 0;
    bioData.byCompound[compound.compound] += compound.quantity;
  }

  atomicWriteSync(CONFIG.deploymentPath, deployment);

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║            💸 IMPACT TRANSACTION RECORDED! 💸                 ║
╠═══════════════════════════════════════════════════════════════╣
║  From:       ${senderPnft.id.padEnd(48)}║
║  To:         ${recipientPnft.padEnd(48)}║
║  Amount:     ${(amount + ' ULTRA').padEnd(48)}║
║  Type:       ${txType.name.padEnd(48)}║
╠═══════════════════════════════════════════════════════════════╣
║  IMPACT DATA (flows through bioregion pool):                  ║`);

  for (const compound of impactPreset.compounds) {
    const sign = compound.quantity >= 0 ? '+' : '';
    console.log(`║    ${compound.compound.padEnd(6)} ${(sign + compound.quantity + compound.unit).padEnd(12)} (${compound.confidence}% confidence)${' '.repeat(18)}║`);
  }

  console.log(`║  Net:      ${(impactSign + netImpact.toFixed(1) + ' weighted units').padEnd(48)}║
╠═══════════════════════════════════════════════════════════════╣
║  Tx Hash:  ${txHash.slice(0, 50).padEnd(50)}║
╠═══════════════════════════════════════════════════════════════╣
║  NEW BALANCES:                                                ║
║    Sender:    ${(deployment.ultraBalances[senderAddress] + ' ULTRA').padEnd(46)}║
║    Recipient: ${(deployment.ultraBalances[recipientAddress] + ' ULTRA').padEnd(46)}║
╚═══════════════════════════════════════════════════════════════╝

This transaction is now part of ${senderBio}'s economic data,
collated by the SNA stake pool for bioregion health tracking.
`);
}

main().catch(error => {
  log.error(error.message);
  console.error(error);
  process.exit(1);
});
