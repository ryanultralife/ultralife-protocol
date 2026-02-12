#!/usr/bin/env node
/**
 * UltraLife Protocol — Impact Token Market CLI
 *
 * The market where planetary health is priced.
 * Regenerators sell verified positive impacts.
 * Extractors buy offsets or fund remediation projects.
 *
 * Usage:
 *   node impact-market.mjs --sell --category Carbon --quantity 100 --price 10
 *   node impact-market.mjs --buy --category Carbon --quantity 50 --max-price 15
 *   node impact-market.mjs --fill --order <order_id>
 *   node impact-market.mjs --cancel --order <order_id>
 *   node impact-market.mjs --orderbook --category Carbon
 *   node impact-market.mjs --my-orders
 *   node impact-market.mjs --history
 *   node impact-market.mjs --price --category Carbon
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
  info: (msg) => console.log(`[INFO]  ${msg}`),
  success: (msg) => console.log(`[OK]    ${msg}`),
  warn: (msg) => console.log(`[WARN]  ${msg}`),
  error: (msg) => console.log(`[ERROR] ${msg}`),
};

const CONFIG = {
  network: process.env.NETWORK || 'preprod',
  blockfrostKey: process.env.BLOCKFROST_API_KEY,
  walletMnemonic: process.env.WALLET_SEED_PHRASE,
  deploymentPath: path.join(__dirname, 'deployment.json'),
};

// =============================================================================
// IMPACT CATEGORIES (from validators/impact_market.ak)
// =============================================================================
const IMPACT_CATEGORIES = {
  Carbon: { code: 'Carbon', name: 'Carbon', defaultPrice: 10, unit: 'tCO2' },
  Water: { code: 'Water', name: 'Water', defaultPrice: 15, unit: 'kL' },
  Biodiversity: { code: 'BiodiversityImpact', name: 'Biodiversity', defaultPrice: 25, unit: 'idx' },
  Soil: { code: 'Soil', name: 'Soil Health', defaultPrice: 12, unit: 'tOM' },
  Air: { code: 'Air', name: 'Air Quality', defaultPrice: 8, unit: 'AQI' },
  Waste: { code: 'Waste', name: 'Waste Reduction', defaultPrice: 5, unit: 'kg' },
  Energy: { code: 'Energy', name: 'Clean Energy', defaultPrice: 7, unit: 'MWh' },
  LandUse: { code: 'LandUse', name: 'Land Use', defaultPrice: 20, unit: 'ha' },
};

// Order status values (from validator)
const ORDER_STATUS = {
  Open: 'Open',
  PartiallyFilled: 'PartiallyFilled',
  Filled: 'Filled',
  Cancelled: 'Cancelled',
  Expired: 'Expired',
};

// Order types
const ORDER_TYPES = {
  Sell: 'Sell',
  Buy: 'Buy',
  FundProject: 'FundProjectOrder',
};

// Market fee in basis points (from validator config)
const MARKET_FEE_BPS = 50; // 0.5%

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log(`
+===============================================================+
|          UltraLife Protocol - Impact Token Market             |
|                                                               |
|     Price discovery for planetary health. Regenerators sell,  |
|     extractors buy. The market determines what society values.|
+===============================================================+
`);

  const args = process.argv.slice(2);

  // Command flags
  const sellIdx = args.indexOf('--sell');
  const buyIdx = args.indexOf('--buy');
  const fillIdx = args.indexOf('--fill');
  const cancelIdx = args.indexOf('--cancel');
  const orderbookIdx = args.indexOf('--orderbook');
  const myOrdersIdx = args.indexOf('--my-orders');
  const historyIdx = args.indexOf('--history');
  const priceIdx = args.indexOf('--price');
  const helpIdx = args.indexOf('--help');

  // Parameter flags
  const categoryIdx = args.indexOf('--category');
  const quantityIdx = args.indexOf('--quantity');
  const priceArgIdx = args.indexOf('--price-per-unit');
  const maxPriceIdx = args.indexOf('--max-price');
  const orderIdx = args.indexOf('--order');
  const userIdx = args.indexOf('--user');
  const partialIdx = args.indexOf('--partial');
  const bioregionIdx = args.indexOf('--bioregion');
  const compoundIdx = args.indexOf('--compound');
  const impactTokenIdx = args.indexOf('--impact-token');
  const limitIdx = args.indexOf('--limit');

  const { atomicWriteSync, safeReadJson } = await import('./utils.mjs');

  // Load deployment state
  const deployment = safeReadJson(CONFIG.deploymentPath, {});
  initMarketState(deployment);

  // Show help
  if (helpIdx >= 0 || args.length === 0) {
    showHelp();
    return;
  }

  // Get user context
  const userContext = await getUserContext(deployment, args, userIdx);
  if (!userContext && (sellIdx >= 0 || buyIdx >= 0 || fillIdx >= 0 || cancelIdx >= 0 || myOrdersIdx >= 0)) {
    log.error('User context required. Use --user <name> or configure WALLET_SEED_PHRASE');
    return;
  }

  // Execute command
  if (sellIdx >= 0) {
    await handleSellOrder(deployment, userContext, args, {
      categoryIdx, quantityIdx, priceArgIdx, partialIdx, bioregionIdx, compoundIdx, impactTokenIdx
    });
  } else if (buyIdx >= 0) {
    await handleBuyOrder(deployment, userContext, args, {
      categoryIdx, quantityIdx, maxPriceIdx, partialIdx, bioregionIdx, compoundIdx
    });
  } else if (fillIdx >= 0) {
    await handleFillOrder(deployment, userContext, args, { orderIdx, quantityIdx, impactTokenIdx });
  } else if (cancelIdx >= 0) {
    await handleCancelOrder(deployment, userContext, args, { orderIdx });
  } else if (orderbookIdx >= 0) {
    await handleOrderbook(deployment, args, { categoryIdx, bioregionIdx });
  } else if (myOrdersIdx >= 0) {
    await handleMyOrders(deployment, userContext);
  } else if (historyIdx >= 0) {
    await handleHistory(deployment, args, { limitIdx, categoryIdx });
  } else if (priceIdx >= 0) {
    await handlePrice(deployment, args, { categoryIdx, bioregionIdx });
  } else {
    showHelp();
  }

  // Save state
  atomicWriteSync(CONFIG.deploymentPath, deployment);
}

// =============================================================================
// HELP
// =============================================================================

function showHelp() {
  console.log(`
Usage: node impact-market.mjs [command] [options]

COMMANDS:

  --sell                  Create a sell order (regenerators selling impact credits)
    --category <type>     Impact category: Carbon, Water, Biodiversity, Soil, Air, Waste, Energy, LandUse
    --quantity <N>        Amount of impact units to sell
    --price-per-unit <N>  Price per unit in ULTRA
    --impact-token <id>   Impact token ID to sell (optional, simulated)
    --compound <code>     Specific compound code (optional)
    --bioregion <name>    Bioregion for local market (optional)
    --partial             Allow partial fills (default: true)

  --buy                   Create a buy order (extractors buying offsets)
    --category <type>     Impact category to buy
    --quantity <N>        Amount of impact units needed
    --max-price <N>       Maximum price per unit in ULTRA
    --compound <code>     Specific compound code (optional)
    --bioregion <name>    Bioregion preference (optional)
    --partial             Allow partial fills (default: true)

  --fill                  Fill an existing order
    --order <id>          Order ID to fill
    --quantity <N>        Amount to fill (for partial fills)
    --impact-token <id>   Impact token to use (for filling buy orders)

  --cancel                Cancel your own order
    --order <id>          Order ID to cancel

  --orderbook             View current order book
    --category <type>     Filter by impact category
    --bioregion <name>    Filter by bioregion

  --my-orders             View your open orders

  --history               View trade history
    --limit <N>           Number of recent trades to show (default: 20)
    --category <type>     Filter by category

  --price                 Get current market price
    --category <type>     Impact category (required)
    --bioregion <name>    Bioregion (optional)

GENERAL OPTIONS:
  --user <name>           Act as test user (Alice, Bob, etc.)
  --help                  Show this help

IMPACT CATEGORIES:
  Carbon        Carbon sequestration/emissions (tCO2)
  Water         Water conservation/use (kL)
  Biodiversity  Species/habitat impact (index)
  Soil          Soil organic matter (tonnes)
  Air           Air quality improvement (AQI)
  Waste         Waste reduction (kg)
  Energy        Clean energy generation (MWh)
  LandUse       Land use change (hectares)

EXAMPLES:

  # Regenerator sells 100 carbon credits at 10 ULTRA each
  npm run impact:sell -- --user Alice --category Carbon --quantity 100 --price-per-unit 10

  # Extractor places buy order for carbon offsets
  npm run impact:buy -- --user Bob --category Carbon --quantity 50 --max-price 15

  # Fill a sell order
  npm run impact:fill -- --user Bob --order ord_abc123

  # View the carbon market orderbook
  npm run impact:orderbook -- --category Carbon

  # Get current carbon price
  npm run impact:price -- --category Carbon
`);
}

// =============================================================================
// STATE INITIALIZATION
// =============================================================================

function initMarketState(deployment) {
  // Initialize market state structures
  deployment.impactMarket = deployment.impactMarket || {
    orders: [],
    trades: [],
    markets: {},
    orderSequence: 0,
    tradeSequence: 0,
  };

  // Initialize market state for each category
  for (const [key, cat] of Object.entries(IMPACT_CATEGORIES)) {
    if (!deployment.impactMarket.markets[cat.code]) {
      deployment.impactMarket.markets[cat.code] = {
        category: cat.code,
        bioregion: null,
        bestAsk: null,
        bestBid: null,
        lastPrice: cat.defaultPrice,
        volume24h: 0,
        totalSupply: 0,
        totalDemand: 0,
        liquidityScore: 0,
      };
    }
  }
}

// =============================================================================
// USER CONTEXT
// =============================================================================

async function getUserContext(deployment, args, userIdx) {
  const testUsers = deployment.testUsers || [];
  const pnfts = deployment.pnfts || [];

  if (userIdx >= 0) {
    const userName = args[userIdx + 1];
    const testUser = testUsers.find(u => u.name.toLowerCase() === userName?.toLowerCase());
    if (!testUser) {
      log.error(`Test user not found: ${userName}`);
      log.info('Available users: ' + testUsers.map(u => u.name).join(', '));
      return null;
    }
    const pnft = pnfts.find(p => p.owner === testUser.address) || { id: testUser.pnftId };
    return {
      address: testUser.address,
      name: testUser.name,
      pnftId: pnft?.id || testUser.pnftId,
      bioregion: testUser.bioregion || 'sierra_nevada',
    };
  }

  // Try main wallet
  if (CONFIG.walletMnemonic && CONFIG.blockfrostKey) {
    try {
      const { BlockfrostProvider, MeshWallet } = await import('@meshsdk/core');
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
      const address = wallet.getChangeAddress();
      const pnft = pnfts.find(p => p.owner === address);
      return {
        address: address,
        name: 'Main Wallet',
        pnftId: pnft?.id || 'main_pnft',
        bioregion: pnft?.bioregion || 'sierra_nevada',
      };
    } catch (err) {
      log.warn('Could not load main wallet: ' + err.message);
    }
  }

  return null;
}

// =============================================================================
// SELL ORDER (PlaceSellOrder)
// =============================================================================

async function handleSellOrder(deployment, user, args, indices) {
  const { categoryIdx, quantityIdx, priceArgIdx, partialIdx, bioregionIdx, compoundIdx, impactTokenIdx } = indices;

  // Parse category
  const categoryArg = categoryIdx >= 0 ? args[categoryIdx + 1] : null;
  if (!categoryArg) {
    log.error('--category required for sell order');
    log.info('Categories: ' + Object.keys(IMPACT_CATEGORIES).join(', '));
    return;
  }
  const category = IMPACT_CATEGORIES[categoryArg];
  if (!category) {
    log.error(`Unknown category: ${categoryArg}`);
    return;
  }

  // Parse quantity
  const quantity = quantityIdx >= 0 ? parseFloat(args[quantityIdx + 1]) : null;
  if (!quantity || quantity <= 0) {
    log.error('--quantity required (positive number)');
    return;
  }

  // Parse price
  const pricePerUnit = priceArgIdx >= 0 ? parseFloat(args[priceArgIdx + 1]) : category.defaultPrice;
  if (pricePerUnit <= 0) {
    log.error('Price must be positive');
    return;
  }

  // Optional parameters
  const allowPartial = partialIdx >= 0 || args.indexOf('--no-partial') < 0;
  const bioregion = bioregionIdx >= 0 ? args[bioregionIdx + 1] : null;
  const compoundCode = compoundIdx >= 0 ? args[compoundIdx + 1] : '';
  const impactToken = impactTokenIdx >= 0 ? args[impactTokenIdx + 1] : `impact_${crypto.randomBytes(8).toString('hex')}`;

  // Create order
  const orderId = `ord_${crypto.randomBytes(8).toString('hex')}`;
  const currentSlot = Math.floor(Date.now() / 1000) - 1654041600;

  const order = {
    orderId: orderId,
    orderType: ORDER_TYPES.Sell,
    category: category.code,
    compoundCode: compoundCode,
    quantity: quantity,
    pricePerUnit: pricePerUnit,
    creator: user.pnftId,
    creatorAddress: user.address,
    creatorName: user.name,
    bioregion: bioregion,
    createdAt: currentSlot,
    expiresAt: null,
    allowPartial: allowPartial,
    filled: 0,
    status: ORDER_STATUS.Open,
    impactToken: impactToken,
    timestamp: new Date().toISOString(),
  };

  deployment.impactMarket.orders.push(order);
  deployment.impactMarket.orderSequence += 1;

  // Update market state
  updateMarketState(deployment, category.code, bioregion);

  log.success(`Sell order created: ${orderId}`);

  console.log(`
+===============================================================+
|              SELL ORDER PLACED (PlaceSellOrder)               |
+===============================================================+
  Order ID:       ${orderId}
  Category:       ${category.name} (${category.code})
  Quantity:       ${quantity} ${category.unit}
  Price:          ${pricePerUnit} ULTRA per ${category.unit}
  Total Value:    ${(quantity * pricePerUnit).toFixed(2)} ULTRA
  Partial Fills:  ${allowPartial ? 'Allowed' : 'Not allowed'}
  Bioregion:      ${bioregion || 'Global'}
  Seller:         ${user.name} (${user.pnftId})
  Impact Token:   ${impactToken}
+---------------------------------------------------------------+
  Status:         ${order.status}
  Created:        ${order.timestamp}
+===============================================================+

Your impact tokens are now listed on the market.
Extractors can buy these credits to offset their impacts.
`);
}

// =============================================================================
// BUY ORDER (PlaceBuyOrder)
// =============================================================================

async function handleBuyOrder(deployment, user, args, indices) {
  const { categoryIdx, quantityIdx, maxPriceIdx, partialIdx, bioregionIdx, compoundIdx } = indices;

  // Parse category
  const categoryArg = categoryIdx >= 0 ? args[categoryIdx + 1] : null;
  if (!categoryArg) {
    log.error('--category required for buy order');
    log.info('Categories: ' + Object.keys(IMPACT_CATEGORIES).join(', '));
    return;
  }
  const category = IMPACT_CATEGORIES[categoryArg];
  if (!category) {
    log.error(`Unknown category: ${categoryArg}`);
    return;
  }

  // Parse quantity
  const quantity = quantityIdx >= 0 ? parseFloat(args[quantityIdx + 1]) : null;
  if (!quantity || quantity <= 0) {
    log.error('--quantity required (positive number)');
    return;
  }

  // Parse max price
  const maxPricePerUnit = maxPriceIdx >= 0 ? parseFloat(args[maxPriceIdx + 1]) : category.defaultPrice * 1.5;
  if (maxPricePerUnit <= 0) {
    log.error('Max price must be positive');
    return;
  }

  // Check buyer has enough ULTRA locked
  const maxCost = quantity * maxPricePerUnit;
  const ultraBalance = deployment.ultraBalances?.[user.address] || 0;
  if (ultraBalance < maxCost) {
    log.error(`Insufficient ULTRA. Need ${maxCost.toFixed(2)} to cover max purchase, have ${ultraBalance}`);
    return;
  }

  // Optional parameters
  const allowPartial = partialIdx >= 0 || args.indexOf('--no-partial') < 0;
  const bioregion = bioregionIdx >= 0 ? args[bioregionIdx + 1] : null;
  const compoundCode = compoundIdx >= 0 ? args[compoundIdx + 1] : '';

  // Create order
  const orderId = `ord_${crypto.randomBytes(8).toString('hex')}`;
  const currentSlot = Math.floor(Date.now() / 1000) - 1654041600;

  const order = {
    orderId: orderId,
    orderType: ORDER_TYPES.Buy,
    category: category.code,
    compoundCode: compoundCode,
    quantity: quantity,
    pricePerUnit: maxPricePerUnit,
    creator: user.pnftId,
    creatorAddress: user.address,
    creatorName: user.name,
    bioregion: bioregion,
    createdAt: currentSlot,
    expiresAt: null,
    allowPartial: allowPartial,
    filled: 0,
    status: ORDER_STATUS.Open,
    escrowedAmount: maxCost,
    timestamp: new Date().toISOString(),
  };

  // Lock ULTRA in escrow (simulated)
  deployment.ultraBalances[user.address] = ultraBalance - maxCost;
  deployment.impactMarket.escrow = deployment.impactMarket.escrow || {};
  deployment.impactMarket.escrow[orderId] = maxCost;

  deployment.impactMarket.orders.push(order);
  deployment.impactMarket.orderSequence += 1;

  // Update market state
  updateMarketState(deployment, category.code, bioregion);

  // Check for matching sell orders
  const matchingSells = deployment.impactMarket.orders.filter(o =>
    o.orderType === ORDER_TYPES.Sell &&
    o.category === category.code &&
    o.status === ORDER_STATUS.Open &&
    o.pricePerUnit <= maxPricePerUnit &&
    (o.compoundCode === '' || compoundCode === '' || o.compoundCode === compoundCode) &&
    (bioregion === null || o.bioregion === null || o.bioregion === bioregion)
  ).sort((a, b) => a.pricePerUnit - b.pricePerUnit);

  log.success(`Buy order created: ${orderId}`);

  console.log(`
+===============================================================+
|               BUY ORDER PLACED (PlaceBuyOrder)                |
+===============================================================+
  Order ID:       ${orderId}
  Category:       ${category.name} (${category.code})
  Quantity:       ${quantity} ${category.unit}
  Max Price:      ${maxPricePerUnit} ULTRA per ${category.unit}
  Max Cost:       ${maxCost.toFixed(2)} ULTRA (locked in escrow)
  Partial Fills:  ${allowPartial ? 'Allowed' : 'Not allowed'}
  Bioregion:      ${bioregion || 'Any'}
  Buyer:          ${user.name} (${user.pnftId})
+---------------------------------------------------------------+
  Status:         ${order.status}
  ULTRA Locked:   ${maxCost.toFixed(2)} ULTRA
  Your Balance:   ${deployment.ultraBalances[user.address]} ULTRA
+===============================================================+
`);

  if (matchingSells.length > 0) {
    console.log(`  ${matchingSells.length} matching sell order(s) available!`);
    console.log(`  Best ask: ${matchingSells[0].pricePerUnit} ULTRA per ${category.unit}`);
    console.log(`  Use: npm run impact:fill -- --order ${matchingSells[0].orderId}`);
  } else {
    console.log(`  No matching sell orders currently available.`);
    console.log(`  Your bid is now on the order book for sellers to fill.`);
  }
}

// =============================================================================
// FILL ORDER (FillSellOrder / FillBuyOrder)
// =============================================================================

async function handleFillOrder(deployment, user, args, indices) {
  const { orderIdx, quantityIdx, impactTokenIdx } = indices;

  // Get order ID
  const orderId = orderIdx >= 0 ? args[orderIdx + 1] : null;
  if (!orderId) {
    log.error('--order <id> required');
    return;
  }

  // Find order
  const order = deployment.impactMarket.orders.find(o => o.orderId === orderId);
  if (!order) {
    log.error(`Order not found: ${orderId}`);
    return;
  }

  if (order.status !== ORDER_STATUS.Open && order.status !== ORDER_STATUS.PartiallyFilled) {
    log.error(`Order is not fillable. Status: ${order.status}`);
    return;
  }

  // Can't fill your own order
  if (order.creatorAddress === user.address) {
    log.error('Cannot fill your own order');
    return;
  }

  const remaining = order.quantity - order.filled;
  let fillQuantity = quantityIdx >= 0 ? parseFloat(args[quantityIdx + 1]) : remaining;

  if (fillQuantity <= 0 || fillQuantity > remaining) {
    log.error(`Invalid quantity. Remaining: ${remaining}`);
    return;
  }

  if (!order.allowPartial && fillQuantity !== remaining) {
    log.error('Order does not allow partial fills. Must fill entire remaining amount.');
    fillQuantity = remaining;
  }

  const category = Object.values(IMPACT_CATEGORIES).find(c => c.code === order.category);
  const payment = fillQuantity * order.pricePerUnit;
  const fee = Math.floor(payment * MARKET_FEE_BPS / 10000);
  const sellerReceives = payment - fee;

  if (order.orderType === ORDER_TYPES.Sell) {
    // User is BUYING from a sell order
    // Check buyer has enough ULTRA
    const buyerBalance = deployment.ultraBalances?.[user.address] || 0;
    if (buyerBalance < payment) {
      log.error(`Insufficient ULTRA. Need ${payment.toFixed(2)}, have ${buyerBalance}`);
      return;
    }

    // Execute trade
    deployment.ultraBalances[user.address] = buyerBalance - payment;
    deployment.ultraBalances[order.creatorAddress] = (deployment.ultraBalances[order.creatorAddress] || 0) + sellerReceives;
    deployment.ultraBalances['treasury'] = (deployment.ultraBalances['treasury'] || 0) + fee;

    // Record trade
    const tradeId = `trade_${crypto.randomBytes(8).toString('hex')}`;
    const trade = {
      tradeId: tradeId,
      buyer: user.pnftId,
      buyerAddress: user.address,
      buyerName: user.name,
      seller: order.creator,
      sellerAddress: order.creatorAddress,
      sellerName: order.creatorName,
      quantity: fillQuantity,
      price: order.pricePerUnit,
      totalValue: payment,
      fee: fee,
      category: order.category,
      orderId: orderId,
      executedAt: Math.floor(Date.now() / 1000) - 1654041600,
      timestamp: new Date().toISOString(),
    };

    deployment.impactMarket.trades.push(trade);
    deployment.impactMarket.tradeSequence += 1;

    // Update order
    order.filled += fillQuantity;
    order.status = order.filled >= order.quantity ? ORDER_STATUS.Filled : ORDER_STATUS.PartiallyFilled;

    // Reduce buyer's impact debt (they bought offsets)
    const debtReduction = fillQuantity * 100; // Simplified conversion
    deployment.impactDebt = deployment.impactDebt || {};
    deployment.impactDebt[user.address] = Math.max(0, (deployment.impactDebt[user.address] || 0) - debtReduction);

    // Update market
    updateMarketState(deployment, order.category, order.bioregion);
    updateMarketPrice(deployment, order.category, order.pricePerUnit, fillQuantity);

    log.success(`Trade executed: ${tradeId}`);

    console.log(`
+===============================================================+
|             TRADE EXECUTED (FillSellOrder)                    |
+===============================================================+
  Trade ID:       ${tradeId}
  Order:          ${orderId}
  Category:       ${category?.name || order.category}
  Quantity:       ${fillQuantity} ${category?.unit || 'units'}
  Price:          ${order.pricePerUnit} ULTRA per unit
  Total:          ${payment.toFixed(2)} ULTRA
  Fee (0.5%):     ${fee.toFixed(2)} ULTRA
+---------------------------------------------------------------+
  Seller:         ${order.creatorName} receives ${sellerReceives.toFixed(2)} ULTRA
  Buyer:          ${user.name} receives ${fillQuantity} ${order.category} credits
  Treasury:       ${fee.toFixed(2)} ULTRA
+---------------------------------------------------------------+
  Order Status:   ${order.status} (${order.filled}/${order.quantity} filled)
  Your Balance:   ${deployment.ultraBalances[user.address]} ULTRA
  Impact Debt:    ${(deployment.impactDebt[user.address] || 0).toFixed(1)} units
+===============================================================+
`);

  } else if (order.orderType === ORDER_TYPES.Buy) {
    // User is SELLING to a buy order
    const impactToken = impactTokenIdx >= 0 ? args[impactTokenIdx + 1] : `impact_${crypto.randomBytes(8).toString('hex')}`;

    // Release escrowed ULTRA to seller
    const escrowedAmount = deployment.impactMarket.escrow?.[orderId] || 0;
    const refundAmount = (order.quantity - order.filled - fillQuantity) * order.pricePerUnit;

    deployment.ultraBalances[user.address] = (deployment.ultraBalances[user.address] || 0) + sellerReceives;
    deployment.ultraBalances['treasury'] = (deployment.ultraBalances['treasury'] || 0) + fee;

    // Update escrow
    if (deployment.impactMarket.escrow) {
      deployment.impactMarket.escrow[orderId] = Math.max(0, escrowedAmount - payment);
    }

    // Record trade
    const tradeId = `trade_${crypto.randomBytes(8).toString('hex')}`;
    const trade = {
      tradeId: tradeId,
      buyer: order.creator,
      buyerAddress: order.creatorAddress,
      buyerName: order.creatorName,
      seller: user.pnftId,
      sellerAddress: user.address,
      sellerName: user.name,
      quantity: fillQuantity,
      price: order.pricePerUnit,
      totalValue: payment,
      fee: fee,
      category: order.category,
      orderId: orderId,
      impactToken: impactToken,
      executedAt: Math.floor(Date.now() / 1000) - 1654041600,
      timestamp: new Date().toISOString(),
    };

    deployment.impactMarket.trades.push(trade);
    deployment.impactMarket.tradeSequence += 1;

    // Update order
    order.filled += fillQuantity;
    order.status = order.filled >= order.quantity ? ORDER_STATUS.Filled : ORDER_STATUS.PartiallyFilled;

    // Reduce buyer's impact debt
    deployment.impactDebt = deployment.impactDebt || {};
    const debtReduction = fillQuantity * 100;
    deployment.impactDebt[order.creatorAddress] = Math.max(0, (deployment.impactDebt[order.creatorAddress] || 0) - debtReduction);

    // Update market
    updateMarketState(deployment, order.category, order.bioregion);
    updateMarketPrice(deployment, order.category, order.pricePerUnit, fillQuantity);

    log.success(`Trade executed: ${tradeId}`);

    console.log(`
+===============================================================+
|              TRADE EXECUTED (FillBuyOrder)                    |
+===============================================================+
  Trade ID:       ${tradeId}
  Order:          ${orderId}
  Category:       ${category?.name || order.category}
  Quantity:       ${fillQuantity} ${category?.unit || 'units'}
  Price:          ${order.pricePerUnit} ULTRA per unit
  Total:          ${payment.toFixed(2)} ULTRA
  Fee (0.5%):     ${fee.toFixed(2)} ULTRA
+---------------------------------------------------------------+
  Seller:         ${user.name} receives ${sellerReceives.toFixed(2)} ULTRA
  Buyer:          ${order.creatorName} receives ${fillQuantity} ${order.category} credits
  Impact Token:   ${impactToken}
+---------------------------------------------------------------+
  Order Status:   ${order.status} (${order.filled}/${order.quantity} filled)
  Your Balance:   ${deployment.ultraBalances[user.address]} ULTRA
+===============================================================+
`);
  }
}

// =============================================================================
// CANCEL ORDER (CancelOrder)
// =============================================================================

async function handleCancelOrder(deployment, user, args, indices) {
  const { orderIdx } = indices;

  const orderId = orderIdx >= 0 ? args[orderIdx + 1] : null;
  if (!orderId) {
    log.error('--order <id> required');
    return;
  }

  const order = deployment.impactMarket.orders.find(o => o.orderId === orderId);
  if (!order) {
    log.error(`Order not found: ${orderId}`);
    return;
  }

  if (order.creatorAddress !== user.address) {
    log.error('You can only cancel your own orders');
    return;
  }

  if (order.status === ORDER_STATUS.Filled || order.status === ORDER_STATUS.Cancelled) {
    log.error(`Cannot cancel order with status: ${order.status}`);
    return;
  }

  // Return escrowed assets
  if (order.orderType === ORDER_TYPES.Buy) {
    const remainingEscrow = (order.quantity - order.filled) * order.pricePerUnit;
    deployment.ultraBalances[user.address] = (deployment.ultraBalances[user.address] || 0) + remainingEscrow;
    if (deployment.impactMarket.escrow) {
      delete deployment.impactMarket.escrow[orderId];
    }
    log.info(`Returned ${remainingEscrow.toFixed(2)} ULTRA from escrow`);
  }

  order.status = ORDER_STATUS.Cancelled;
  order.cancelledAt = new Date().toISOString();

  // Update market state
  updateMarketState(deployment, order.category, order.bioregion);

  log.success(`Order cancelled: ${orderId}`);

  const category = Object.values(IMPACT_CATEGORIES).find(c => c.code === order.category);

  console.log(`
+===============================================================+
|                  ORDER CANCELLED (CancelOrder)                |
+===============================================================+
  Order ID:       ${orderId}
  Type:           ${order.orderType}
  Category:       ${category?.name || order.category}
  Original Qty:   ${order.quantity} ${category?.unit || 'units'}
  Filled:         ${order.filled} ${category?.unit || 'units'}
  Status:         ${order.status}
${order.orderType === ORDER_TYPES.Buy ? `  Escrow Return: ${((order.quantity - order.filled) * order.pricePerUnit).toFixed(2)} ULTRA` : ''}
  Your Balance:   ${deployment.ultraBalances[user.address] || 0} ULTRA
+===============================================================+
`);
}

// =============================================================================
// VIEW ORDERBOOK
// =============================================================================

async function handleOrderbook(deployment, args, indices) {
  const { categoryIdx, bioregionIdx } = indices;

  const categoryArg = categoryIdx >= 0 ? args[categoryIdx + 1] : null;
  const bioregion = bioregionIdx >= 0 ? args[bioregionIdx + 1] : null;

  let categories = categoryArg
    ? [IMPACT_CATEGORIES[categoryArg]]
    : Object.values(IMPACT_CATEGORIES);

  if (categoryArg && !IMPACT_CATEGORIES[categoryArg]) {
    log.error(`Unknown category: ${categoryArg}`);
    log.info('Categories: ' + Object.keys(IMPACT_CATEGORIES).join(', '));
    return;
  }

  for (const category of categories) {
    if (!category) continue;

    const orders = deployment.impactMarket.orders.filter(o =>
      o.category === category.code &&
      (o.status === ORDER_STATUS.Open || o.status === ORDER_STATUS.PartiallyFilled) &&
      (bioregion === null || o.bioregion === null || o.bioregion === bioregion)
    );

    const sells = orders
      .filter(o => o.orderType === ORDER_TYPES.Sell)
      .sort((a, b) => a.pricePerUnit - b.pricePerUnit);

    const buys = orders
      .filter(o => o.orderType === ORDER_TYPES.Buy)
      .sort((a, b) => b.pricePerUnit - a.pricePerUnit);

    const market = deployment.impactMarket.markets[category.code] || {};

    console.log(`
+===============================================================+
|          ORDER BOOK: ${category.name.toUpperCase().padEnd(36)}|
+===============================================================+
  Last Price:     ${market.lastPrice || category.defaultPrice} ULTRA/${category.unit}
  Best Ask:       ${sells.length > 0 ? sells[0].pricePerUnit + ' ULTRA' : 'None'}
  Best Bid:       ${buys.length > 0 ? buys[0].pricePerUnit + ' ULTRA' : 'None'}
  Spread:         ${sells.length > 0 && buys.length > 0 ? ((sells[0].pricePerUnit - buys[0].pricePerUnit).toFixed(2) + ' ULTRA') : 'N/A'}
  24h Volume:     ${market.volume24h || 0} ${category.unit}
+---------------------------------------------------------------+

  SELL ORDERS (ASKS):
  ${'PRICE'.padEnd(10)} ${'QTY'.padEnd(10)} ${'FILLED'.padEnd(10)} ${'SELLER'.padEnd(15)} ORDER ID
  ${'-'.repeat(65)}`);

    if (sells.length === 0) {
      console.log('  No sell orders');
    } else {
      for (const order of sells.slice(0, 10)) {
        const remaining = order.quantity - order.filled;
        console.log(`  ${(order.pricePerUnit + '').padEnd(10)} ${(remaining + '').padEnd(10)} ${(order.filled + '/' + order.quantity).padEnd(10)} ${(order.creatorName || 'Unknown').padEnd(15)} ${order.orderId}`);
      }
      if (sells.length > 10) {
        console.log(`  ... and ${sells.length - 10} more sell orders`);
      }
    }

    console.log(`
  BUY ORDERS (BIDS):
  ${'PRICE'.padEnd(10)} ${'QTY'.padEnd(10)} ${'FILLED'.padEnd(10)} ${'BUYER'.padEnd(15)} ORDER ID
  ${'-'.repeat(65)}`);

    if (buys.length === 0) {
      console.log('  No buy orders');
    } else {
      for (const order of buys.slice(0, 10)) {
        const remaining = order.quantity - order.filled;
        console.log(`  ${(order.pricePerUnit + '').padEnd(10)} ${(remaining + '').padEnd(10)} ${(order.filled + '/' + order.quantity).padEnd(10)} ${(order.creatorName || 'Unknown').padEnd(15)} ${order.orderId}`);
      }
      if (buys.length > 10) {
        console.log(`  ... and ${buys.length - 10} more buy orders`);
      }
    }

    console.log(`
  Total Supply:   ${sells.reduce((sum, o) => sum + (o.quantity - o.filled), 0)} ${category.unit}
  Total Demand:   ${buys.reduce((sum, o) => sum + (o.quantity - o.filled), 0)} ${category.unit}
+===============================================================+
`);
  }
}

// =============================================================================
// MY ORDERS
// =============================================================================

async function handleMyOrders(deployment, user) {
  const orders = deployment.impactMarket.orders.filter(o =>
    o.creatorAddress === user.address &&
    (o.status === ORDER_STATUS.Open || o.status === ORDER_STATUS.PartiallyFilled)
  );

  console.log(`
+===============================================================+
|              YOUR OPEN ORDERS - ${user.name.padEnd(27)}|
+===============================================================+
`);

  if (orders.length === 0) {
    console.log('  You have no open orders.\n');
    return;
  }

  console.log(`  ${'TYPE'.padEnd(6)} ${'CATEGORY'.padEnd(12)} ${'PRICE'.padEnd(10)} ${'QTY'.padEnd(10)} ${'FILLED'.padEnd(10)} ${'STATUS'.padEnd(15)} ORDER ID`);
  console.log(`  ${'-'.repeat(80)}`);

  for (const order of orders) {
    const category = Object.values(IMPACT_CATEGORIES).find(c => c.code === order.category);
    console.log(`  ${order.orderType.padEnd(6)} ${(category?.name || order.category).padEnd(12)} ${(order.pricePerUnit + '').padEnd(10)} ${(order.quantity + '').padEnd(10)} ${(order.filled + '').padEnd(10)} ${order.status.padEnd(15)} ${order.orderId}`);
  }

  // Calculate totals
  const sellOrders = orders.filter(o => o.orderType === ORDER_TYPES.Sell);
  const buyOrders = orders.filter(o => o.orderType === ORDER_TYPES.Buy);
  const lockedUltra = buyOrders.reduce((sum, o) => sum + (o.quantity - o.filled) * o.pricePerUnit, 0);

  console.log(`
+---------------------------------------------------------------+
  Sell Orders:    ${sellOrders.length}
  Buy Orders:     ${buyOrders.length}
  ULTRA Locked:   ${lockedUltra.toFixed(2)} ULTRA (in buy order escrow)
+===============================================================+
`);
}

// =============================================================================
// TRADE HISTORY
// =============================================================================

async function handleHistory(deployment, args, indices) {
  const { limitIdx, categoryIdx } = indices;

  const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1]) : 20;
  const categoryArg = categoryIdx >= 0 ? args[categoryIdx + 1] : null;

  let trades = [...deployment.impactMarket.trades].reverse();

  if (categoryArg) {
    const category = IMPACT_CATEGORIES[categoryArg];
    if (!category) {
      log.error(`Unknown category: ${categoryArg}`);
      return;
    }
    trades = trades.filter(t => t.category === category.code);
  }

  const recentTrades = trades.slice(0, limit);

  console.log(`
+===============================================================+
|                    TRADE HISTORY                              |
+===============================================================+
`);

  if (recentTrades.length === 0) {
    console.log('  No trades recorded yet.\n');
    return;
  }

  console.log(`  ${'TIME'.padEnd(20)} ${'CATEGORY'.padEnd(12)} ${'QTY'.padEnd(8)} ${'PRICE'.padEnd(8)} ${'VALUE'.padEnd(10)} BUYER -> SELLER`);
  console.log(`  ${'-'.repeat(85)}`);

  for (const trade of recentTrades) {
    const category = Object.values(IMPACT_CATEGORIES).find(c => c.code === trade.category);
    const time = new Date(trade.timestamp).toLocaleString().slice(0, 16);
    console.log(`  ${time.padEnd(20)} ${(category?.name || trade.category).padEnd(12)} ${(trade.quantity + '').padEnd(8)} ${(trade.price + '').padEnd(8)} ${(trade.totalValue.toFixed(0) + '').padEnd(10)} ${trade.buyerName || 'Unknown'} <- ${trade.sellerName || 'Unknown'}`);
  }

  // Calculate statistics
  const totalVolume = recentTrades.reduce((sum, t) => sum + t.totalValue, 0);
  const totalQuantity = recentTrades.reduce((sum, t) => sum + t.quantity, 0);
  const avgPrice = totalQuantity > 0 ? totalVolume / totalQuantity : 0;

  console.log(`
+---------------------------------------------------------------+
  Trades Shown:   ${recentTrades.length} of ${trades.length}
  Total Volume:   ${totalVolume.toFixed(2)} ULTRA
  Total Qty:      ${totalQuantity}
  Avg Price:      ${avgPrice.toFixed(2)} ULTRA/unit
+===============================================================+
`);
}

// =============================================================================
// CURRENT PRICE
// =============================================================================

async function handlePrice(deployment, args, indices) {
  const { categoryIdx, bioregionIdx } = indices;

  const categoryArg = categoryIdx >= 0 ? args[categoryIdx + 1] : null;
  if (!categoryArg) {
    // Show all prices
    console.log(`
+===============================================================+
|                IMPACT TOKEN PRICES                            |
+===============================================================+
  ${'CATEGORY'.padEnd(15)} ${'LAST PRICE'.padEnd(12)} ${'BID'.padEnd(10)} ${'ASK'.padEnd(10)} ${'24H VOL'.padEnd(10)} UNIT
  ${'-'.repeat(70)}`);

    for (const [key, cat] of Object.entries(IMPACT_CATEGORIES)) {
      const market = deployment.impactMarket.markets[cat.code] || {};
      const lastPrice = market.lastPrice || cat.defaultPrice;
      const bestBid = market.bestBid || '-';
      const bestAsk = market.bestAsk || '-';
      const volume = market.volume24h || 0;

      console.log(`  ${cat.name.padEnd(15)} ${(lastPrice + ' ULTRA').padEnd(12)} ${(bestBid + '').padEnd(10)} ${(bestAsk + '').padEnd(10)} ${(volume + '').padEnd(10)} ${cat.unit}`);
    }

    console.log(`
+===============================================================+
  Prices reflect market-determined value of planetary health.
  When supply is low, project funding creates new impact.
+===============================================================+
`);
    return;
  }

  const category = IMPACT_CATEGORIES[categoryArg];
  if (!category) {
    log.error(`Unknown category: ${categoryArg}`);
    return;
  }

  const market = deployment.impactMarket.markets[category.code] || {};
  const bioregion = bioregionIdx >= 0 ? args[bioregionIdx + 1] : null;

  // Get recent trades for this category
  const recentTrades = deployment.impactMarket.trades
    .filter(t => t.category === category.code)
    .slice(-10);

  const orders = deployment.impactMarket.orders.filter(o =>
    o.category === category.code &&
    (o.status === ORDER_STATUS.Open || o.status === ORDER_STATUS.PartiallyFilled)
  );

  const sells = orders.filter(o => o.orderType === ORDER_TYPES.Sell).sort((a, b) => a.pricePerUnit - b.pricePerUnit);
  const buys = orders.filter(o => o.orderType === ORDER_TYPES.Buy).sort((a, b) => b.pricePerUnit - a.pricePerUnit);

  console.log(`
+===============================================================+
|          PRICE INFO: ${category.name.toUpperCase().padEnd(35)}|
+===============================================================+
  Category:       ${category.name} (${category.code})
  Unit:           ${category.unit}
  Default Price:  ${category.defaultPrice} ULTRA (when no market exists)
+---------------------------------------------------------------+
  CURRENT MARKET:
  Last Trade:     ${market.lastPrice || category.defaultPrice} ULTRA/${category.unit}
  Best Bid:       ${buys.length > 0 ? buys[0].pricePerUnit + ' ULTRA' : 'No bids'}
  Best Ask:       ${sells.length > 0 ? sells[0].pricePerUnit + ' ULTRA' : 'No asks'}
  Spread:         ${sells.length > 0 && buys.length > 0 ? (sells[0].pricePerUnit - buys[0].pricePerUnit).toFixed(2) + ' ULTRA' : 'N/A'}
  24h Volume:     ${market.volume24h || 0} ${category.unit}
+---------------------------------------------------------------+
  SUPPLY & DEMAND:
  Available Supply: ${sells.reduce((sum, o) => sum + (o.quantity - o.filled), 0)} ${category.unit}
  Total Demand:     ${buys.reduce((sum, o) => sum + (o.quantity - o.filled), 0)} ${category.unit}
  Open Sell Orders: ${sells.length}
  Open Buy Orders:  ${buys.length}
+---------------------------------------------------------------+
  RECENT TRADES:`);

  if (recentTrades.length === 0) {
    console.log('  No recent trades');
  } else {
    for (const trade of recentTrades.slice(-5)) {
      const time = new Date(trade.timestamp).toLocaleString().slice(0, 16);
      console.log(`  ${time}: ${trade.quantity} @ ${trade.price} ULTRA (${trade.totalValue} ULTRA total)`);
    }
  }

  console.log(`+===============================================================+
`);
}

// =============================================================================
// MARKET STATE UPDATES
// =============================================================================

function updateMarketState(deployment, categoryCode, bioregion) {
  const orders = deployment.impactMarket.orders.filter(o =>
    o.category === categoryCode &&
    (o.status === ORDER_STATUS.Open || o.status === ORDER_STATUS.PartiallyFilled)
  );

  const sells = orders.filter(o => o.orderType === ORDER_TYPES.Sell).sort((a, b) => a.pricePerUnit - b.pricePerUnit);
  const buys = orders.filter(o => o.orderType === ORDER_TYPES.Buy).sort((a, b) => b.pricePerUnit - a.pricePerUnit);

  const market = deployment.impactMarket.markets[categoryCode] || {};

  market.bestAsk = sells.length > 0 ? sells[0].pricePerUnit : null;
  market.bestBid = buys.length > 0 ? buys[0].pricePerUnit : null;
  market.totalSupply = sells.reduce((sum, o) => sum + (o.quantity - o.filled), 0);
  market.totalDemand = buys.reduce((sum, o) => sum + (o.quantity - o.filled), 0);

  // Liquidity score (simplified)
  const spread = market.bestAsk && market.bestBid ? market.bestAsk - market.bestBid : Infinity;
  const depth = market.totalSupply + market.totalDemand;
  market.liquidityScore = depth > 0 ? Math.min(100, Math.floor(depth / (1 + spread / 10))) : 0;

  deployment.impactMarket.markets[categoryCode] = market;
}

function updateMarketPrice(deployment, categoryCode, price, quantity) {
  const market = deployment.impactMarket.markets[categoryCode];
  if (market) {
    market.lastPrice = price;
    market.volume24h = (market.volume24h || 0) + quantity;
  }
}

// =============================================================================
// RUN
// =============================================================================

main().catch(error => {
  log.error(error.message);
  console.error(error);
  process.exit(1);
});
