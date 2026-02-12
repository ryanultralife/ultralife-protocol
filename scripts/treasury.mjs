#!/usr/bin/env node
/**
 * UltraLife Protocol — Treasury CLI
 *
 * External value bridge: ADA/BTC to UltraLife tokens.
 * Linear bonding curve with asymmetric pricing.
 *
 * Usage:
 *   node treasury.mjs --buy-ada --amount 100
 *   node treasury.mjs --sell --amount 1000
 *   node treasury.mjs --status
 *   node treasury.mjs --price
 *   node treasury.mjs --update-oracle --ada-price 0.45
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONSTANTS (from treasury.ak validator)
// =============================================================================

const DEVELOPMENT_POOL = 400_000_000_000;  // 400 billion tokens
const SELL_DISCOUNT_BPS = 9000;            // 90% of buy price

// =============================================================================
// HELPERS
// =============================================================================

function loadDeployment() {
  const deploymentPath = path.join(__dirname, 'deployment.json');
  if (!fs.existsSync(deploymentPath)) {
    return { treasury: { reserves: { ada: 0, btc: 0 }, tokensDistributed: 0, transactions: [], oracleData: { adaUsd: 0.45, btcUsd: 45000 } } };
  }
  const data = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  if (!data.treasury) {
    data.treasury = {
      reserves: { ada: 0, btc: 0 },
      tokensDistributed: 0,
      transactions: [],
      oracleData: { adaUsd: 0.45, btcUsd: 45000, lastUpdate: new Date().toISOString() },
    };
  }
  return data;
}

async function saveDeploymentAsync(data) {
  const { atomicWriteSync } = await import('./utils.mjs');
  const deploymentPath = path.join(__dirname, 'deployment.json');
  atomicWriteSync(deploymentPath, data);
}

function generateId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function parseArgs(argv) {
  const args = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i += 2;
      } else {
        args[key] = true;
        i += 1;
      }
    } else {
      i += 1;
    }
  }
  return args;
}

// Bonding curve: price(n) = n / 400,000,000,000 (in USD)
function currentPriceUsd(distributed) {
  // Price in USD: at 400B distributed, price = $1
  return distributed / DEVELOPMENT_POOL;
}

function currentPriceMicroUsd(distributed) {
  // In micro-USD (1 USD = 1,000,000)
  if (distributed < 400000) {
    return 1; // Minimum 1 micro-USD
  }
  return Math.floor(distributed / 400000);
}

function calculateTokensForAda(adaAmount, distributed, adaUsdPrice) {
  // Convert ADA to USD value
  const usdValue = adaAmount * adaUsdPrice;

  // Get current price per token
  const priceUsd = currentPriceUsd(distributed);

  if (priceUsd <= 0) {
    return usdValue * 1000000; // Very early tokens
  }

  return Math.floor(usdValue / priceUsd);
}

function calculateAdaForTokens(tokenAmount, distributed, adaUsdPrice) {
  const priceUsd = currentPriceUsd(distributed);
  const usdValue = tokenAmount * priceUsd;

  // Apply sell discount
  const discounted = (usdValue * SELL_DISCOUNT_BPS) / 10000;

  return discounted / adaUsdPrice;
}

function getUserPnft(deployment, userName) {
  if (userName) {
    const user = deployment.testUsers?.find(u =>
      u.name?.toLowerCase() === userName.toLowerCase()
    );
    if (user && user.pnft) {
      return { ...user.pnft, owner: user.name, address: user.address };
    }
  }
  if (deployment.pnfts && deployment.pnfts.length > 0) {
    const mainPnft = deployment.pnfts.find(p => p.isMainWallet) || deployment.pnfts[0];
    return { ...mainPnft, owner: 'Main', address: deployment.walletAddress };
  }
  return null;
}

// =============================================================================
// COMMANDS
// =============================================================================

function showHelp() {
  console.log(`
===============================================================================
                    UltraLife Protocol — Treasury
===============================================================================

Usage: node treasury.mjs [command] [options]

COMMANDS:
  --buy-ada              Buy ULTRA tokens with ADA
    --amount <ada>       Amount of ADA to spend
    --user <name>        Buy as test user

  --buy-btc              Buy ULTRA tokens with BTC
    --amount <sats>      Amount in satoshis
    --user <name>        Buy as test user

  --sell                 Sell ULTRA tokens for ADA
    --amount <ultra>     Amount of ULTRA to sell
    --user <name>        Sell as test user

  --status               Show treasury status
  --price                Show current price info
  --simulate             Simulate purchase without executing
    --ada <amount>       ADA amount to simulate

  --update-oracle        Update price oracle (multi-sig)
    --ada-price <usd>    ADA price in USD
    --btc-price <usd>    BTC price in USD

  --history              Show transaction history
    --user <name>        Filter by user

  --help                 Show this help

BONDING CURVE:
  Price = tokens_distributed / 400,000,000,000

  At 0 tokens:    ~$0.000000001
  At 100M tokens: $0.00025
  At 1B tokens:   $0.0025
  At 100B tokens: $0.25
  At 400B tokens: $1.00

PRICING:
  Buy:  Full curve price
  Sell: 90% of curve price (10% spread prevents arbitrage)
`);
}

async function buyWithAda(args, deployment) {
  const adaAmount = parseFloat(args.amount);
  const userName = args.user;

  if (!adaAmount || adaAmount <= 0) {
    console.error('Error: --amount is required and must be positive');
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found. Must have Standard+ pNFT to use treasury.');
    return;
  }

  if (pnft.level === 'Basic' || pnft.level === 'Ward') {
    console.error('Error: Must have Standard+ pNFT to use treasury.');
    return;
  }

  const treasury = deployment.treasury;
  const adaUsdPrice = treasury.oracleData.adaUsd;
  const tokensOut = calculateTokensForAda(adaAmount, treasury.tokensDistributed, adaUsdPrice);

  const pricePerToken = (adaAmount * adaUsdPrice) / tokensOut;

  const tx = {
    txId: generateId('treasury_buy'),
    type: 'BuyWithADA',
    user: pnft.owner,
    address: pnft.address,
    pnftId: pnft.id,
    adaIn: adaAmount,
    tokensOut,
    pricePerToken,
    adaUsdRate: adaUsdPrice,
    timestamp: new Date().toISOString(),
    testnetSimulated: true,
  };

  treasury.reserves.ada += adaAmount;
  treasury.tokensDistributed += tokensOut;
  treasury.transactions.push(tx);

  // Update user balance
  if (!deployment.ultraBalances) deployment.ultraBalances = {};
  deployment.ultraBalances[pnft.address] = (deployment.ultraBalances[pnft.address] || 0) + tokensOut;

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         TOKENS PURCHASED
===============================================================================
  Transaction:     ${tx.txId}
  Buyer:           ${pnft.owner}
  pNFT Level:      ${pnft.level}
-------------------------------------------------------------------------------
  ADA Spent:       ${adaAmount.toFixed(6)} ADA
  ADA/USD Rate:    $${adaUsdPrice.toFixed(4)}
  USD Value:       $${(adaAmount * adaUsdPrice).toFixed(6)}
-------------------------------------------------------------------------------
  Tokens Received: ${tokensOut.toLocaleString()} ULTRA
  Price/Token:     $${pricePerToken.toFixed(12)}
-------------------------------------------------------------------------------
  New Balance:     ${deployment.ultraBalances[pnft.address].toLocaleString()} ULTRA
  Treasury ADA:    ${treasury.reserves.ada.toFixed(6)} ADA
`);
}

async function buyWithBtc(args, deployment) {
  const sats = parseInt(args.amount);
  const userName = args.user;

  if (!sats || sats <= 0) {
    console.error('Error: --amount is required and must be positive (in satoshis)');
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found. Must have Standard+ pNFT to use treasury.');
    return;
  }

  if (pnft.level === 'Basic' || pnft.level === 'Ward') {
    console.error('Error: Must have Standard+ pNFT to use treasury.');
    return;
  }

  const treasury = deployment.treasury;
  const btcUsdPrice = treasury.oracleData.btcUsd;
  const btcAmount = sats / 100_000_000;
  const usdValue = btcAmount * btcUsdPrice;
  const priceUsd = currentPriceUsd(treasury.tokensDistributed);
  const tokensOut = priceUsd > 0 ? Math.floor(usdValue / priceUsd) : Math.floor(usdValue * 1000000);

  const tx = {
    txId: generateId('treasury_buy_btc'),
    type: 'BuyWithBTC',
    user: pnft.owner,
    address: pnft.address,
    pnftId: pnft.id,
    btcIn: btcAmount,
    satsIn: sats,
    tokensOut,
    btcUsdRate: btcUsdPrice,
    timestamp: new Date().toISOString(),
    testnetSimulated: true,
  };

  treasury.reserves.btc += btcAmount;
  treasury.tokensDistributed += tokensOut;
  treasury.transactions.push(tx);

  if (!deployment.ultraBalances) deployment.ultraBalances = {};
  deployment.ultraBalances[pnft.address] = (deployment.ultraBalances[pnft.address] || 0) + tokensOut;

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         TOKENS PURCHASED (BTC)
===============================================================================
  Transaction:     ${tx.txId}
  Buyer:           ${pnft.owner}
-------------------------------------------------------------------------------
  BTC Spent:       ${btcAmount.toFixed(8)} BTC (${sats.toLocaleString()} sats)
  BTC/USD Rate:    $${btcUsdPrice.toLocaleString()}
  USD Value:       $${usdValue.toFixed(2)}
-------------------------------------------------------------------------------
  Tokens Received: ${tokensOut.toLocaleString()} ULTRA
-------------------------------------------------------------------------------
  New Balance:     ${deployment.ultraBalances[pnft.address].toLocaleString()} ULTRA
`);
}

async function sellForAda(args, deployment) {
  const tokenAmount = parseFloat(args.amount);
  const userName = args.user;

  if (!tokenAmount || tokenAmount <= 0) {
    console.error('Error: --amount is required and must be positive');
    return;
  }

  const pnft = getUserPnft(deployment, userName);
  if (!pnft) {
    console.error('Error: No pNFT found');
    return;
  }

  const balance = deployment.ultraBalances?.[pnft.address] || 0;
  if (balance < tokenAmount) {
    console.error(`Error: Insufficient balance (${balance} < ${tokenAmount})`);
    return;
  }

  const treasury = deployment.treasury;
  const adaUsdPrice = treasury.oracleData.adaUsd;
  const adaOut = calculateAdaForTokens(tokenAmount, treasury.tokensDistributed, adaUsdPrice);

  if (treasury.reserves.ada < adaOut) {
    console.error(`Error: Insufficient treasury reserves (${treasury.reserves.ada} < ${adaOut})`);
    return;
  }

  const tx = {
    txId: generateId('treasury_sell'),
    type: 'SellForADA',
    user: pnft.owner,
    address: pnft.address,
    pnftId: pnft.id,
    tokensIn: tokenAmount,
    adaOut,
    adaUsdRate: adaUsdPrice,
    timestamp: new Date().toISOString(),
    testnetSimulated: true,
  };

  treasury.reserves.ada -= adaOut;
  treasury.tokensDistributed -= tokenAmount;
  treasury.transactions.push(tx);
  deployment.ultraBalances[pnft.address] -= tokenAmount;

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                         TOKENS SOLD
===============================================================================
  Transaction:     ${tx.txId}
  Seller:          ${pnft.owner}
-------------------------------------------------------------------------------
  Tokens Sold:     ${tokenAmount.toLocaleString()} ULTRA
  ADA Received:    ${adaOut.toFixed(6)} ADA
  Sell Discount:   10% (${(100 - SELL_DISCOUNT_BPS / 100)}% of buy price)
-------------------------------------------------------------------------------
  New Balance:     ${deployment.ultraBalances[pnft.address].toLocaleString()} ULTRA
`);
}

function showStatus(deployment) {
  const treasury = deployment.treasury;
  const priceUsd = currentPriceUsd(treasury.tokensDistributed);
  const progressPct = (treasury.tokensDistributed / DEVELOPMENT_POOL) * 100;

  console.log(`
===============================================================================
                    TREASURY STATUS
===============================================================================
  RESERVES:
    ADA:           ${treasury.reserves.ada.toFixed(6)} ADA
    BTC:           ${treasury.reserves.btc.toFixed(8)} BTC
    USD Value:     $${((treasury.reserves.ada * treasury.oracleData.adaUsd) + (treasury.reserves.btc * treasury.oracleData.btcUsd)).toFixed(2)}

  TOKEN DISTRIBUTION:
    Distributed:   ${treasury.tokensDistributed.toLocaleString()} ULTRA
    Total Supply:  ${DEVELOPMENT_POOL.toLocaleString()} ULTRA
    Progress:      ${progressPct.toFixed(6)}%

  PRICING:
    Current Price: $${priceUsd.toFixed(12)} per ULTRA
    Buy 1000 ADA:  ~${calculateTokensForAda(1000, treasury.tokensDistributed, treasury.oracleData.adaUsd).toLocaleString()} ULTRA

  ORACLE DATA:
    ADA/USD:       $${treasury.oracleData.adaUsd.toFixed(4)}
    BTC/USD:       $${treasury.oracleData.btcUsd.toLocaleString()}
    Last Update:   ${treasury.oracleData.lastUpdate || 'N/A'}

  TRANSACTIONS:
    Total:         ${treasury.transactions.length}
`);
}

function showPrice(deployment) {
  const treasury = deployment.treasury;
  const distributed = treasury.tokensDistributed;
  const priceUsd = currentPriceUsd(distributed);

  const milestones = [
    { tokens: 0, label: 'Genesis' },
    { tokens: 1_000_000, label: '1M' },
    { tokens: 100_000_000, label: '100M' },
    { tokens: 1_000_000_000, label: '1B' },
    { tokens: 10_000_000_000, label: '10B' },
    { tokens: 100_000_000_000, label: '100B' },
    { tokens: 400_000_000_000, label: '400B (Max)' },
  ];

  console.log(`
===============================================================================
                    BONDING CURVE PRICING
===============================================================================
  Current Distribution: ${distributed.toLocaleString()} ULTRA
  Current Price:        $${priceUsd.toFixed(12)}
-------------------------------------------------------------------------------
  PRICE AT MILESTONES:

  TOKENS           PRICE/TOKEN      USD FOR 1000 ULTRA
  ---------------  ---------------  ------------------`);

  for (const m of milestones) {
    const price = currentPriceUsd(m.tokens);
    const cost = price * 1000;
    const marker = distributed >= m.tokens ? ' <-' : '';
    console.log(`  ${m.label.padEnd(16)} $${price.toFixed(12).padEnd(15)} $${cost.toFixed(6)}${marker}`);
  }

  console.log(`
-------------------------------------------------------------------------------
  Sell prices are 90% of buy prices to prevent arbitrage.
`);
}

function simulate(args, deployment) {
  const adaAmount = parseFloat(args.ada);

  if (!adaAmount || adaAmount <= 0) {
    console.error('Error: --ada is required');
    return;
  }

  const treasury = deployment.treasury;
  const adaUsdPrice = treasury.oracleData.adaUsd;
  const tokensOut = calculateTokensForAda(adaAmount, treasury.tokensDistributed, adaUsdPrice);
  const pricePerToken = (adaAmount * adaUsdPrice) / tokensOut;

  console.log(`
===============================================================================
                    PURCHASE SIMULATION
===============================================================================
  Input:           ${adaAmount.toFixed(6)} ADA
  ADA/USD:         $${adaUsdPrice}
  USD Value:       $${(adaAmount * adaUsdPrice).toFixed(6)}
-------------------------------------------------------------------------------
  Tokens Out:      ${tokensOut.toLocaleString()} ULTRA
  Price/Token:     $${pricePerToken.toFixed(12)}
-------------------------------------------------------------------------------
  (Simulation only - no transaction created)
`);
}

async function updateOracle(args, deployment) {
  const adaPrice = parseFloat(args['ada-price']);
  const btcPrice = parseFloat(args['btc-price']);

  if (!adaPrice && !btcPrice) {
    console.error('Error: Provide --ada-price and/or --btc-price');
    return;
  }

  const treasury = deployment.treasury;

  if (adaPrice) treasury.oracleData.adaUsd = adaPrice;
  if (btcPrice) treasury.oracleData.btcUsd = btcPrice;
  treasury.oracleData.lastUpdate = new Date().toISOString();

  await saveDeploymentAsync(deployment);

  console.log(`
===============================================================================
                    ORACLE UPDATED
===============================================================================
  ADA/USD:       $${treasury.oracleData.adaUsd.toFixed(4)}
  BTC/USD:       $${treasury.oracleData.btcUsd.toLocaleString()}
  Updated:       ${treasury.oracleData.lastUpdate}
-------------------------------------------------------------------------------
  Note: In production, oracle updates require multi-sig approval.
`);
}

function showHistory(args, deployment) {
  const userName = args.user;
  let txs = deployment.treasury.transactions || [];

  if (userName) {
    txs = txs.filter(t => t.user?.toLowerCase() === userName.toLowerCase());
  }

  console.log(`
===============================================================================
                    TREASURY TRANSACTIONS
===============================================================================`);

  if (txs.length === 0) {
    console.log('\n  No transactions found.\n');
    return;
  }

  console.log('\n  ID                      TYPE        USER       AMOUNT');
  console.log('  ----------------------  ----------  ---------  ---------------');

  for (const tx of txs.slice(-20)) {
    const amount = tx.type.includes('Buy')
      ? `+${tx.tokensOut?.toLocaleString()} ULTRA`
      : `-${tx.tokensIn?.toLocaleString()} ULTRA`;
    console.log(`  ${tx.txId.padEnd(22)}  ${tx.type.padEnd(10)}  ${(tx.user || 'N/A').padEnd(9)}  ${amount}`);
  }

  console.log(`\n  Showing last ${Math.min(20, txs.length)} of ${txs.length} transactions\n`);
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const deployment = loadDeployment();

  if (args.help || Object.keys(args).length === 0) {
    showHelp();
    return;
  }

  if (args['buy-ada']) {
    await buyWithAda(args, deployment);
    return;
  }

  if (args['buy-btc']) {
    await buyWithBtc(args, deployment);
    return;
  }

  if (args.sell) {
    await sellForAda(args, deployment);
    return;
  }

  if (args.status) {
    showStatus(deployment);
    return;
  }

  if (args.price) {
    showPrice(deployment);
    return;
  }

  if (args.simulate) {
    simulate(args, deployment);
    return;
  }

  if (args['update-oracle']) {
    await updateOracle(args, deployment);
    return;
  }

  if (args.history) {
    showHistory(args, deployment);
    return;
  }

  showHelp();
}

main().catch(console.error);
