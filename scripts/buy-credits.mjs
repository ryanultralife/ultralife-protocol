#!/usr/bin/env node
/**
 * UltraLife Protocol — Buy Sequestration Credits
 *
 * Consumers purchase credits from land stewards to offset their impact debt.
 * This closes the loop: Land → Credits → Consumer Offset
 *
 * Usage:
 *   node buy-credits.mjs --amount 10 --from <steward>
 *   node buy-credits.mjs --offset-all
 *   node buy-credits.mjs --list-available
 *   node buy-credits.mjs --my-debt
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

// Price per tonne CO2 in ULTRA (market rate)
const CREDIT_PRICE_ULTRA = 5; // 5 ULTRA per tCO2

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║       UltraLife Protocol — Buy Sequestration Credits          ║
║                                                               ║
║      Offset your impact debt with land-based credits.         ║
╚═══════════════════════════════════════════════════════════════╝
`);

  const args = process.argv.slice(2);
  const amountIdx = args.indexOf('--amount');
  const fromIdx = args.indexOf('--from');
  const userIdx = args.indexOf('--user');
  const listIdx = args.indexOf('--list-available');
  const debtIdx = args.indexOf('--my-debt');
  const offsetAllIdx = args.indexOf('--offset-all');
  const helpIdx = args.indexOf('--help');

  const { atomicWriteSync, safeReadJson } = await import('./utils.mjs');
  const { BlockfrostProvider, MeshWallet } = await import('@meshsdk/core');

  // Load deployment
  const deployment = safeReadJson(CONFIG.deploymentPath, {});
  const credits = deployment.sequestrationCredits || [];
  const creditBalances = deployment.creditBalances || {};
  const impactDebt = deployment.impactDebt || {};
  const ultraBalances = deployment.ultraBalances || {};
  const testUsers = deployment.testUsers || [];

  // Show help
  if (helpIdx >= 0 || args.length === 0) {
    console.log(`
Usage:
  --user <name>         Act as test user (Alice, Bob, etc.)
  --my-debt             Show your current impact debt
  --list-available      Show available credits for purchase
  --amount <tCO2>       Amount of credits to buy (in tonnes CO2)
  --from <steward>      Buy from specific steward (name or address)
  --offset-all          Buy enough credits to offset all your debt

Price: ${CREDIT_PRICE_ULTRA} ULTRA per tonne CO2

Example:
  npm run credits:buy -- --user Alice --my-debt
  npm run credits:buy -- --list-available
  npm run credits:buy -- --user Alice --offset-all
  npm run credits:buy -- --user Alice --amount 0.5 --from Main
`);
    return;
  }

  if (!CONFIG.blockfrostKey) {
    log.error('Missing BLOCKFROST_API_KEY in .env');
    process.exit(1);
  }

  // Check if acting as a test user
  let buyerAddress;
  let buyerName = 'You';

  if (userIdx >= 0) {
    const userName = args[userIdx + 1];
    const testUser = testUsers.find(u => u.name.toLowerCase() === userName?.toLowerCase());
    if (!testUser) {
      log.error(`Test user not found: ${userName}`);
      log.info('Available users: ' + testUsers.map(u => u.name).join(', '));
      process.exit(1);
    }
    buyerAddress = testUser.address;
    buyerName = testUser.name;
    log.info(`Acting as: ${buyerName}`);
  } else {
    // Use main wallet
    if (!CONFIG.walletMnemonic) {
      log.error('Missing WALLET_SEED_PHRASE in .env (or use --user <name>)');
      process.exit(1);
    }
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
    buyerAddress = wallet.getChangeAddress();
  }

  const myDebt = impactDebt[buyerAddress] || 0;
  const myUltra = ultraBalances[buyerAddress] || 0;

  // Show my debt
  if (debtIdx >= 0) {
    const debtInTonnes = myDebt / 1000; // Convert units to approximate tonnes
    const creditsNeeded = debtInTonnes;
    const ultraNeeded = creditsNeeded * CREDIT_PRICE_ULTRA;

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                    YOUR IMPACT DEBT                           ║
╠═══════════════════════════════════════════════════════════════╣
║  Impact debt:     ${(myDebt.toFixed(1) + ' weighted units').padEnd(40)}║
║  ≈ Tonnes CO2:    ${(debtInTonnes.toFixed(3) + ' tCO2').padEnd(40)}║
║  Credits needed:  ${(creditsNeeded.toFixed(3) + ' tCO2').padEnd(40)}║
║  Cost to offset:  ${(ultraNeeded.toFixed(1) + ' ULTRA').padEnd(40)}║
╠═══════════════════════════════════════════════════════════════╣
║  Your ULTRA:      ${(myUltra + ' ULTRA').padEnd(40)}║
║  Can afford:      ${((myUltra / CREDIT_PRICE_ULTRA).toFixed(3) + ' tCO2').padEnd(40)}║
╚═══════════════════════════════════════════════════════════════╝
`);

    if (myDebt === 0) {
      log.success('You have no impact debt! 🌱');
    } else if (myUltra >= ultraNeeded) {
      log.info('You can fully offset your debt.');
      log.info('Run: npm run credits:buy -- --offset-all');
    } else {
      log.warn(`You need ${(ultraNeeded - myUltra).toFixed(1)} more ULTRA to fully offset.`);
    }
    return;
  }

  // List available credits
  if (listIdx >= 0) {
    let totalAvailable = 0;

    console.log('Available sequestration credits:\n');
    console.log('  STEWARD              LAND                    AVAILABLE   PRICE');
    console.log('  ───────              ────                    ─────────   ─────');

    for (const [address, balance] of Object.entries(creditBalances)) {
      if (balance.available > 0) {
        // Find steward name
        const testUser = testUsers.find(u => u.address === address);
        const stewardName = testUser?.name || address.slice(0, 20) + '...';

        // Find land names
        const lands = Object.entries(balance.byLand)
          .filter(([_, amt]) => amt > 0)
          .map(([landId]) => {
            const land = deployment.lands?.find(l => l.landId === landId);
            return land?.name || landId.slice(0, 15);
          });

        console.log(`  ${stewardName.padEnd(18)} ${lands.join(', ').slice(0, 23).padEnd(23)} ${(balance.available.toFixed(2) + ' tCO2').padEnd(11)} ${CREDIT_PRICE_ULTRA} ULTRA/t`);
        totalAvailable += balance.available;
      }
    }

    if (totalAvailable === 0) {
      log.info('No credits available yet.');
      log.info('Land stewards need to generate credits first:');
      log.info('  npm run credits:generate -- --all');
    } else {
      console.log(`\n  TOTAL AVAILABLE: ${totalAvailable.toFixed(2)} tCO2\n`);
    }
    return;
  }

  // Buy credits
  let amountToBuy = 0;
  let sellerAddress = null;

  if (offsetAllIdx >= 0) {
    // Buy enough to offset all debt
    const debtInTonnes = myDebt / 1000;
    amountToBuy = debtInTonnes;
    if (amountToBuy <= 0) {
      log.success('You have no impact debt to offset!');
      return;
    }
  } else if (amountIdx >= 0) {
    amountToBuy = parseFloat(args[amountIdx + 1]);
    if (isNaN(amountToBuy) || amountToBuy <= 0) {
      log.error('Invalid amount');
      return;
    }
  } else {
    log.error('Specify --amount <tCO2> or --offset-all');
    return;
  }

  // Find seller
  if (fromIdx >= 0) {
    const fromArg = args[fromIdx + 1];
    const testUser = testUsers.find(u => u.name.toLowerCase() === fromArg?.toLowerCase());
    if (testUser) {
      sellerAddress = testUser.address;
    } else if (fromArg?.startsWith('addr')) {
      sellerAddress = fromArg;
    } else {
      // Check if "Main" refers to main wallet
      if (fromArg?.toLowerCase() === 'main') {
        // Find main wallet (the one with lands)
        const mainLand = deployment.lands?.[0];
        if (mainLand) {
          sellerAddress = mainLand.stewardAddress;
        }
      }
    }
  }

  // If no seller specified, find any with available credits
  if (!sellerAddress) {
    for (const [address, balance] of Object.entries(creditBalances)) {
      if (balance.available >= amountToBuy) {
        sellerAddress = address;
        break;
      }
    }
  }

  if (!sellerAddress) {
    log.error('No seller found with enough credits.');
    log.info('Use --list-available to see available credits.');
    return;
  }

  const sellerBalance = creditBalances[sellerAddress];
  if (!sellerBalance || sellerBalance.available < amountToBuy) {
    log.error(`Seller only has ${sellerBalance?.available || 0} tCO2 available.`);
    return;
  }

  // Calculate cost
  const cost = amountToBuy * CREDIT_PRICE_ULTRA;
  if (myUltra < cost) {
    log.error(`Insufficient ULTRA. Need ${cost.toFixed(1)}, have ${myUltra}.`);
    return;
  }

  // Can't buy from yourself
  if (buyerAddress === sellerAddress) {
    log.error('Cannot buy credits from yourself.');
    return;
  }

  log.info(`Buying ${amountToBuy.toFixed(3)} tCO2 credits for ${cost.toFixed(1)} ULTRA`);

  // Execute purchase
  const purchaseId = 'purchase_' + crypto.randomBytes(8).toString('hex');

  // Transfer ULTRA
  ultraBalances[buyerAddress] = myUltra - cost;
  ultraBalances[sellerAddress] = (ultraBalances[sellerAddress] || 0) + cost;

  // Transfer credits
  creditBalances[sellerAddress].available -= amountToBuy;
  creditBalances[sellerAddress].sold += amountToBuy;

  // Reduce buyer's impact debt
  const debtReduction = amountToBuy * 1000; // Convert tonnes to units
  const oldDebt = impactDebt[buyerAddress] || 0;
  impactDebt[buyerAddress] = Math.max(0, oldDebt - debtReduction);
  const newDebt = impactDebt[buyerAddress];

  // Record purchase
  deployment.creditPurchases = deployment.creditPurchases || [];
  deployment.creditPurchases.push({
    purchaseId: purchaseId,
    buyer: buyerAddress,
    seller: sellerAddress,
    amount: amountToBuy,
    unit: 'tCO2',
    price: cost,
    priceUnit: 'ULTRA',
    debtBefore: oldDebt,
    debtAfter: newDebt,
    purchasedAt: new Date().toISOString(),
    testnetSimulated: true,
  });

  // Save
  deployment.ultraBalances = ultraBalances;
  deployment.creditBalances = creditBalances;
  deployment.impactDebt = impactDebt;
  atomicWriteSync(CONFIG.deploymentPath, deployment);

  // Find seller name
  const sellerUser = testUsers.find(u => u.address === sellerAddress);
  const sellerName = sellerUser?.name || 'Land Steward';

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           🌲 SEQUESTRATION CREDITS PURCHASED! 🌲              ║
╠═══════════════════════════════════════════════════════════════╣
║  Purchase ID:   ${purchaseId.padEnd(44)}║
║  Amount:        ${(amountToBuy.toFixed(3) + ' tCO2').padEnd(44)}║
║  Cost:          ${(cost.toFixed(1) + ' ULTRA').padEnd(44)}║
║  Seller:        ${sellerName.padEnd(44)}║
╠═══════════════════════════════════════════════════════════════╣
║  IMPACT DEBT OFFSET:                                          ║
║    Before:      ${(oldDebt.toFixed(1) + ' units').padEnd(44)}║
║    Offset:      ${(debtReduction.toFixed(1) + ' units').padEnd(44)}║
║    After:       ${(newDebt.toFixed(1) + ' units').padEnd(44)}║
╠═══════════════════════════════════════════════════════════════╣
║  YOUR NEW BALANCES:                                           ║
║    ULTRA:       ${(ultraBalances[buyerAddress] + ' ULTRA').padEnd(44)}║
║    Impact debt: ${(newDebt.toFixed(1) + ' units').padEnd(44)}║
╚═══════════════════════════════════════════════════════════════╝
`);

  if (newDebt === 0) {
    console.log(`
🌱 CONGRATULATIONS! Your impact debt is fully offset! 🌱

You have achieved net-zero for your tracked activities by
purchasing sequestration credits from land stewards.

The land continues to sequester carbon, and you have
compensated for your economic activity's environmental cost.
`);
  } else {
    const remainingTonnes = newDebt / 1000;
    const remainingCost = remainingTonnes * CREDIT_PRICE_ULTRA;
    log.info(`Remaining debt: ${newDebt.toFixed(1)} units (≈${remainingTonnes.toFixed(3)} tCO2)`);
    log.info(`Cost to fully offset: ${remainingCost.toFixed(1)} ULTRA`);
  }
}

main().catch(error => {
  log.error(error.message);
  console.error(error);
  process.exit(1);
});
