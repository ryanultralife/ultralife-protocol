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

// =============================================================================
// NO PRESETS. ALL IMPACTS MUST BE MEASURED INDIVIDUALLY.
// =============================================================================
// Every transaction must declare its actual measured impacts.
// No guessing. No virtue signaling. No assumptions.
//
// Examples of what must be measured and attributed:
// - Embodied carbon of windmill manufacturing (rare earth extraction, transport, installation)
// - Water cost of almond milk production + impact on bee populations
// - Nitrogen benefit from ruminant urination on free-range pastures
// - Full supply chain: extraction → processing → transport → consumption → disposal
//
// Confidence levels reflect measurement quality:
// - 95%+ = Lab tested, verified by certified surveyor
// - 80-95% = Measured with calibrated equipment
// - 60-80% = Calculated from known inputs
// - 40-60% = Estimated from similar verified activities
// - <40% = Provisional estimate, requires verification
//
// Over time, verified measurements build a knowledge base of tested values.
// But we start with measurement, not assumption.
// =============================================================================

// Known compound types (extensible as measurement science evolves)
// Full lifecycle: Environment → Nutrition → Health → Care
const COMPOUND_TYPES = {
  // === ENVIRONMENTAL (extraction/emission) ===
  // Carbon cycle
  CO2: { name: 'Carbon Dioxide', unit: 'g', category: 'carbon' },
  CH4: { name: 'Methane', unit: 'g', category: 'carbon' },

  // Water cycle
  H2O: { name: 'Water', unit: 'L', category: 'water' },

  // Nitrogen cycle
  N: { name: 'Nitrogen', unit: 'g', category: 'nitrogen' },
  NO3: { name: 'Nitrate', unit: 'g', category: 'nitrogen' },
  NH3: { name: 'Ammonia', unit: 'g', category: 'nitrogen' },
  NOx: { name: 'Nitrogen Oxides', unit: 'g', category: 'nitrogen' },

  // Phosphorus cycle
  P: { name: 'Phosphorus', unit: 'g', category: 'phosphorus' },

  // Biodiversity (measured as habitat/population impact)
  BIO: { name: 'Biodiversity Index', unit: 'idx', category: 'biodiversity' },

  // Soil health
  SOIL: { name: 'Soil Organic Matter', unit: 'g', category: 'soil' },

  // Energy (embodied)
  KWH: { name: 'Energy', unit: 'kWh', category: 'energy' },

  // === NUTRITIONAL (what the product delivers) ===
  PROT: { name: 'Protein', unit: 'g', category: 'nutrition' },
  FAT: { name: 'Fat', unit: 'g', category: 'nutrition' },
  CARB: { name: 'Carbohydrate', unit: 'g', category: 'nutrition' },
  FIBER: { name: 'Fiber', unit: 'g', category: 'nutrition' },
  B12: { name: 'Vitamin B12', unit: 'mcg', category: 'nutrition' },
  IRON: { name: 'Iron', unit: 'mg', category: 'nutrition' },
  ZINC: { name: 'Zinc', unit: 'mg', category: 'nutrition' },
  OMEGA3: { name: 'Omega-3', unit: 'mg', category: 'nutrition' },
  OMEGA6: { name: 'Omega-6', unit: 'mg', category: 'nutrition' },
  VIT_D: { name: 'Vitamin D', unit: 'IU', category: 'nutrition' },
  VIT_A: { name: 'Vitamin A', unit: 'IU', category: 'nutrition' },
  CA: { name: 'Calcium', unit: 'mg', category: 'nutrition' },
  MG: { name: 'Magnesium', unit: 'mg', category: 'nutrition' },
  K: { name: 'Potassium', unit: 'mg', category: 'nutrition' },
  NA: { name: 'Sodium', unit: 'mg', category: 'nutrition' },
  KCAL: { name: 'Calories', unit: 'kcal', category: 'nutrition' },

  // === HEALTH OUTCOMES (relative to individual need) ===
  // Positive = met a deficiency, Negative = excess beyond need
  NEED_PROT: { name: 'Protein Need Met', unit: '%', category: 'health' },
  NEED_B12: { name: 'B12 Need Met', unit: '%', category: 'health' },
  NEED_IRON: { name: 'Iron Need Met', unit: '%', category: 'health' },
  NEED_ZINC: { name: 'Zinc Need Met', unit: '%', category: 'health' },
  EXCESS: { name: 'Nutritional Excess', unit: '%', category: 'health' },

  // === PHARMACEUTICAL/SUPPLEMENT IMPACT CHAIN ===
  // When nature doesn't meet a need, industrial alternatives have their own impacts
  // These must be measured and compared to natural provision
  PHARMA_CO2: { name: 'Pharma Embodied Carbon', unit: 'g', category: 'pharma' },      // R&D, manufacturing, distribution
  PHARMA_H2O: { name: 'Pharma Water Use', unit: 'L', category: 'pharma' },            // Manufacturing water
  PHARMA_CHEM: { name: 'Pharma Chemical Waste', unit: 'g', category: 'pharma' },      // Production byproducts
  PHARMA_PKG: { name: 'Pharma Packaging', unit: 'g', category: 'pharma' },            // Plastic, foil, cardboard
  PHARMA_SIDE: { name: 'Side Effect Risk', unit: '%', category: 'pharma' },           // Known adverse reactions
  PHARMA_DEP: { name: 'Dependency Risk', unit: '%', category: 'pharma' },             // Long-term dependency
  PHARMA_INT: { name: 'Drug Interaction Risk', unit: '%', category: 'pharma' },       // Interactions with other meds

  // === NATURE vs INDUSTRY COMPARISON ===
  // Positive = nature met need (avoided industrial chain)
  // Negative = required industrial intervention
  NAT_PROV: { name: 'Nature Provided', unit: '%', category: 'source' },               // % of need met by natural source
  IND_REQ: { name: 'Industrial Required', unit: '%', category: 'source' },            // % requiring pharma/supplement

  // === CARE ECONOMICS (full chain comparison) ===
  // Not just cost avoided - full impact chain avoided or incurred
  CHAIN_AVOID: { name: 'Industrial Chain Avoided', unit: 'units', category: 'care' }, // Weighted pharma impacts avoided
  CHAIN_INCUR: { name: 'Industrial Chain Incurred', unit: 'units', category: 'care' }, // Weighted pharma impacts required
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
  const noteIdx = args.indexOf('--note');
  const descIdx = args.indexOf('--desc');
  const listIdx = args.indexOf('--list-compounds');
  const helpIdx = args.indexOf('--help');

  // Show help
  if (helpIdx >= 0 || args.length === 0) {
    console.log(`
Usage: node transfer-ultra.mjs [options]

Required:
  --to <name|address>     Recipient (test user name or full address)
  --amount <N>            Amount of ULTRA to transfer
  --compound <spec>       Impact measurement (can specify multiple)
                          Format: COMPOUND:QUANTITY:CONFIDENCE
                          Example: --compound CO2:-500:85 --compound H2O:-50:70

Optional:
  --type <type>           Transaction type: labor|goods|services|gift|investment|remediation
  --desc <description>    Description of what was measured
  --note <note>           Additional note

Info:
  --list-compounds        Show all measurable compound types
  --help                  Show this help

Example:
  node transfer-ultra.mjs --to Alice --amount 10 --type goods \\
    --compound CO2:-500:85 --compound H2O:-50:70 --compound N:+10:60 \\
    --desc "Local beef - measured transport CO2, water use, pasture N benefit"
`);
    return;
  }

  // List compound types
  if (listIdx >= 0) {
    console.log('Measurable compound types:\n');
    console.log('  COMPOUND  NAME                  UNIT    CATEGORY');
    console.log('  ────────  ────────────────────  ──────  ──────────');
    for (const [code, info] of Object.entries(COMPOUND_TYPES)) {
      console.log(`  ${code.padEnd(8)}  ${info.name.padEnd(20)}  ${info.unit.padEnd(6)}  ${info.category}`);
    }
    console.log(`
Measurement format: COMPOUND:QUANTITY:CONFIDENCE
  - QUANTITY: negative = extraction/emission, positive = sequestration/benefit
  - CONFIDENCE: 0-100% reflecting measurement quality

Confidence guidelines:
  95%+   Lab tested, verified by certified surveyor
  80-95  Measured with calibrated equipment
  60-80  Calculated from known inputs
  40-60  Estimated from similar verified activities
  <40    Provisional estimate, requires verification

Example: CO2:-500:85 means 500g CO2 emitted, 85% confidence
`);
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

  // Parse measured compounds (--compound CO2:-500:85 --compound H2O:-50:70)
  const compounds = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--compound' && args[i + 1]) {
      const parts = args[i + 1].split(':');
      if (parts.length >= 3) {
        const compoundCode = parts[0].toUpperCase();
        const quantity = parseFloat(parts[1]);
        const confidence = parseInt(parts[2]) || 50;

        if (!COMPOUND_TYPES[compoundCode]) {
          log.warn(`Unknown compound: ${compoundCode}. Use --list-compounds to see valid types.`);
          continue;
        }
        if (isNaN(quantity)) {
          log.warn(`Invalid quantity for ${compoundCode}: ${parts[1]}`);
          continue;
        }
        if (confidence < 0 || confidence > 100) {
          log.warn(`Confidence must be 0-100, got ${confidence} for ${compoundCode}`);
          continue;
        }

        compounds.push({
          compound: compoundCode,
          quantity: quantity,
          unit: COMPOUND_TYPES[compoundCode].unit,
          confidence: confidence,
          category: COMPOUND_TYPES[compoundCode].category,
        });
      }
    }
  }

  // Require at least one measured compound
  if (compounds.length === 0) {
    log.error('No impact measurements provided.');
    log.info('Use --compound COMPOUND:QUANTITY:CONFIDENCE to declare measured impacts.');
    log.info('Example: --compound CO2:-500:85 --compound H2O:-50:70');
    log.info('Use --list-compounds to see measurable compound types.');
    process.exit(1);
  }

  // Parse description and note
  const description = descIdx >= 0 ? args[descIdx + 1] : 'Impact measurement';
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
  log.info(`Measurement: ${description}`);
  log.info(`Compounds measured: ${compounds.length}`);
  for (const c of compounds) {
    const sign = c.quantity >= 0 ? '+' : '';
    log.info(`  ${c.compound}: ${sign}${c.quantity}${c.unit} (${c.confidence}% confidence)`);
  }

  // Calculate net impact (weighted by confidence)
  const netImpact = compounds.reduce((sum, c) => {
    return sum + (c.quantity * c.confidence / 100);
  }, 0);
  log.info(`Net impact: ${netImpact.toFixed(1)} weighted units`);

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
      description: description,
      compounds: compounds,
      netImpact: netImpact,
      evidenceHash: crypto.createHash('sha256').update(JSON.stringify(compounds)).digest('hex'),
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

  for (const compound of compounds) {
    bioData.byCompound[compound.compound] = bioData.byCompound[compound.compound] || 0;
    bioData.byCompound[compound.compound] += compound.quantity;
  }

  // =========================================================================
  // IMPACT DEBT TRACKING
  // =========================================================================
  // All economic activity creates impact debt (negative).
  // Some activities have LESS debt than alternatives (e.g., renewable vs fossil).
  // ONLY LAND can generate sequestration credits to offset this debt.
  // Consumer accumulates all impact debt from their purchases.
  // =========================================================================

  // Track cumulative impact debt for the consumer (recipient)
  deployment.impactDebt = deployment.impactDebt || {};
  deployment.impactDebt[recipientAddress] = (deployment.impactDebt[recipientAddress] || 0) + Math.abs(netImpact);

  log.info(`Consumer impact debt: ${deployment.impactDebt[recipientAddress].toFixed(1)} units`);

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
║  MEASURED IMPACTS:                                            ║
║    ${description.slice(0, 55).padEnd(55)}║`);

  for (const compound of compounds) {
    const sign = compound.quantity >= 0 ? '+' : '';
    console.log(`║    ${compound.compound.padEnd(6)} ${(sign + compound.quantity + compound.unit).padEnd(12)} (${compound.confidence}% confidence)${' '.repeat(18)}║`);
  }

  console.log(`║  Net:      ${(netImpact.toFixed(1) + ' weighted units (debt)').padEnd(48)}║`);

  // All economic activity creates debt - show cumulative debt for consumer
  const consumerDebt = deployment.impactDebt[recipientAddress] || Math.abs(netImpact);
  console.log(`╠═══════════════════════════════════════════════════════════════╣
║  📊 CONSUMER IMPACT DEBT:                                     ║
║    This transaction:  ${(Math.abs(netImpact).toFixed(1) + ' units').padEnd(37)}║
║    Cumulative debt:   ${(consumerDebt.toFixed(1) + ' units').padEnd(37)}║
║                                                               ║
║    All activity has impact. Some has LESS (renewable, local). ║
║    Only LAND sequestration generates offset credits.          ║`);

  // Show remediation info
  console.log(`╠═══════════════════════════════════════════════════════════════╣
║  🌲 TO OFFSET THIS DEBT:                                      ║
║    Purchase sequestration credits from land stewards          ║
║    Natural quota: ~4 tonnes CO2-eq per person/year            ║
║    Credits are generated by registered land parcels           ║`);

  console.log(`╠═══════════════════════════════════════════════════════════════╣
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
