#!/usr/bin/env node
/**
 * UltraLife Protocol — Marketplace
 *
 * Decentralized marketplace with full impact disclosure.
 * Every listing shows its environmental and social impact.
 *
 * Usage:
 *   node marketplace.mjs --list --type product --name "Local Honey" --price 5 --category Food
 *   node marketplace.mjs --browse --category Food
 *   node marketplace.mjs --purchase --listing <id>
 *   node marketplace.mjs --update --listing <id> --price 8
 *   node marketplace.mjs --cancel --listing <id>
 *   node marketplace.mjs --review --listing <id> --rating 5 --comment "Excellent!"
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
  info: (msg) => console.log(`[INFO] ${msg}`),
  success: (msg) => console.log(`[OK] ${msg}`),
  warn: (msg) => console.log(`[WARN] ${msg}`),
  error: (msg) => console.log(`[ERROR] ${msg}`),
};

const CONFIG = {
  network: process.env.NETWORK || 'preprod',
  blockfrostKey: process.env.BLOCKFROST_API_KEY,
  walletMnemonic: process.env.WALLET_SEED_PHRASE,
  deploymentPath: path.join(__dirname, 'deployment.json'),
};

// =============================================================================
// LISTING TYPES (matching marketplace.ak validator)
// =============================================================================

const LISTING_TYPES = {
  product: { code: 1, name: 'Product', description: 'Physical product for sale' },
  service: { code: 2, name: 'Service', description: 'Service offered' },
  work: { code: 3, name: 'WorkCapacity', description: 'Skills available for hire' },
  asset_sale: { code: 4, name: 'AssetSale', description: 'Asset for sale' },
  asset_rental: { code: 5, name: 'AssetRental', description: 'Asset for rent' },
};

const PRODUCT_CATEGORIES = {
  food: { name: 'Food', subcategories: ['Produce', 'Dairy', 'Meat', 'Seafood', 'Grains', 'Prepared', 'Preserved', 'Beverages'] },
  clothing: { name: 'Clothing', subcategories: ['Men', 'Women', 'Children', 'Footwear', 'Accessories'] },
  household: { name: 'Household', subcategories: ['Furniture', 'Decor', 'Linens', 'Kitchenware'] },
  tools: { name: 'Tools', subcategories: ['Hand', 'Power', 'Garden', 'Automotive'] },
  electronics: { name: 'Electronics', subcategories: ['Computers', 'Phones', 'Audio', 'Appliances'] },
  materials: { name: 'Materials', subcategories: ['Wood', 'Metal', 'Fabric', 'Plastic'] },
  handmade: { name: 'Handmade', subcategories: ['Art', 'Crafts', 'Jewelry', 'Pottery'] },
  other: { name: 'Other', subcategories: ['Miscellaneous'] },
};

const SERVICE_CATEGORIES = {
  healthcare: { name: 'Healthcare', subcategories: ['General', 'Dental', 'Mental', 'Alternative'] },
  education: { name: 'Education', subcategories: ['Academic', 'Trade', 'Language', 'Music'] },
  technical: { name: 'Technical', subcategories: ['IT', 'Repair', 'Construction', 'Automotive'] },
  creative: { name: 'Creative', subcategories: ['Design', 'Writing', 'Photography', 'Video'] },
  personal: { name: 'Personal', subcategories: ['Fitness', 'Wellness', 'Coaching', 'Care'] },
  home: { name: 'Home', subcategories: ['Cleaning', 'Gardening', 'Maintenance', 'Moving'] },
  other: { name: 'Other', subcategories: ['Miscellaneous'] },
};

const PRICE_TYPES = {
  fixed: { name: 'Fixed', description: 'Set price' },
  range: { name: 'Range', description: 'Negotiable within range' },
  sliding: { name: 'SlidingScale', description: 'Adjusted based on buyer' },
  trade: { name: 'Trade', description: 'Barter/trade accepted' },
  free: { name: 'Free', description: 'Gift economy' },
};

const ORIGIN_TYPES = {
  local: { name: 'Local', description: 'From your bioregion' },
  regional: { name: 'Regional', description: 'From neighboring bioregions' },
  imported: { name: 'Imported', description: 'From distant regions' },
  unknown: { name: 'Unknown', description: 'Origin not verified' },
};

// Known compound types for impact disclosure
const COMPOUND_TYPES = {
  CO2: { name: 'Carbon Dioxide', unit: 'g', category: 'carbon' },
  CH4: { name: 'Methane', unit: 'g', category: 'carbon' },
  H2O: { name: 'Water', unit: 'L', category: 'water' },
  N: { name: 'Nitrogen', unit: 'g', category: 'nitrogen' },
  NO3: { name: 'Nitrate', unit: 'g', category: 'nitrogen' },
  P: { name: 'Phosphorus', unit: 'g', category: 'phosphorus' },
  BIO: { name: 'Biodiversity Index', unit: 'idx', category: 'biodiversity' },
  SOIL: { name: 'Soil Organic Matter', unit: 'g', category: 'soil' },
  KWH: { name: 'Energy', unit: 'kWh', category: 'energy' },
  // Nutritional (for food products)
  PROT: { name: 'Protein', unit: 'g', category: 'nutrition' },
  FAT: { name: 'Fat', unit: 'g', category: 'nutrition' },
  CARB: { name: 'Carbohydrate', unit: 'g', category: 'nutrition' },
  FIBER: { name: 'Fiber', unit: 'g', category: 'nutrition' },
  B12: { name: 'Vitamin B12', unit: 'mcg', category: 'nutrition' },
  IRON: { name: 'Iron', unit: 'mg', category: 'nutrition' },
  ZINC: { name: 'Zinc', unit: 'mg', category: 'nutrition' },
  OMEGA3: { name: 'Omega-3', unit: 'mg', category: 'nutrition' },
  KCAL: { name: 'Calories', unit: 'kcal', category: 'nutrition' },
};

// =============================================================================
// MAIN ENTRY POINT
// =============================================================================

async function main() {
  console.log(`
================================================================================
        UltraLife Protocol - Marketplace
================================================================================
`);

  const args = process.argv.slice(2);

  // Help
  if (args.includes('--help') || args.length === 0) {
    showHelp();
    return;
  }

  // Load utilities
  const { atomicWriteSync, safeReadJson, formatAda, estimateCurrentSlot } = await import('./utils.mjs');

  // Load deployment state
  const deployment = safeReadJson(CONFIG.deploymentPath, {});
  deployment.marketplace = deployment.marketplace || { listings: [], reviews: [] };

  // Determine command
  if (args.includes('--list')) {
    await handleList(args, deployment, atomicWriteSync);
  } else if (args.includes('--browse')) {
    await handleBrowse(args, deployment);
  } else if (args.includes('--purchase')) {
    await handlePurchase(args, deployment, atomicWriteSync);
  } else if (args.includes('--update')) {
    await handleUpdate(args, deployment, atomicWriteSync);
  } else if (args.includes('--cancel')) {
    await handleCancel(args, deployment, atomicWriteSync);
  } else if (args.includes('--review')) {
    await handleReview(args, deployment, atomicWriteSync);
  } else if (args.includes('--list-categories')) {
    showCategories();
  } else if (args.includes('--list-compounds')) {
    showCompounds();
  } else {
    log.error('Unknown command. Use --help for usage.');
  }
}

// =============================================================================
// HELP
// =============================================================================

function showHelp() {
  console.log(`
Usage: node marketplace.mjs [command] [options]

Commands:
  --list              Create a new listing
  --browse            Browse available listings
  --purchase          Purchase a listing
  --update            Update your listing
  --cancel            Cancel your listing
  --review            Leave a review after purchase

Options for --list:
  --type <type>       Listing type: product|service|work|asset_sale|asset_rental
  --name <name>       Name of the product/service
  --desc <text>       Description
  --price <amount>    Price in ULTRA
  --price-type <type> Pricing: fixed|range|sliding|trade|free (default: fixed)
  --category <cat>    Category (use --list-categories for options)
  --subcategory <sub> Subcategory
  --quantity <n>      Quantity available (for products)
  --unit <unit>       Unit of measurement (e.g., "kg", "item", "hour")
  --origin <origin>   Origin: local|regional|imported|unknown
  --compound <spec>   Impact disclosure (COMPOUND:QUANTITY:CONFIDENCE)
                      Example: --compound CO2:-200:80 --compound H2O:-50:70
  --tags <tags>       Comma-separated tags for search
  --survival          Mark as eligible for UBI survival floor (food only)
  --user <name>       Seller (test user name, or uses wallet)

Options for --browse:
  --category <cat>    Filter by category
  --type <type>       Filter by listing type
  --bioregion <bio>   Filter by bioregion
  --status <status>   Filter by status: active|paused|sold (default: active)
  --seller <name>     Filter by seller name
  --search <term>     Search in name/description/tags

Options for --purchase:
  --listing <id>      Listing ID to purchase
  --quantity <n>      Quantity to purchase (default: 1)
  --user <name>       Buyer (test user name)

Options for --update:
  --listing <id>      Listing ID to update
  --price <amount>    New price
  --quantity <n>      New quantity
  --status <status>   New status: active|paused

Options for --cancel:
  --listing <id>      Listing ID to cancel

Options for --review:
  --listing <id>      Listing ID (must have purchased)
  --rating <1-5>      Star rating
  --comment <text>    Review comment
  --user <name>       Reviewer (test user who purchased)

Info:
  --list-categories   Show all product/service categories
  --list-compounds    Show measurable compound types for impact disclosure
  --help              Show this help

Examples:
  # List local honey with impact disclosure
  node marketplace.mjs --list --type product --name "Local Wildflower Honey" \\
    --price 8 --category food --subcategory Prepared --quantity 10 --unit jar \\
    --origin local --compound CO2:-50:70 --compound BIO:+5:60 \\
    --tags "honey,raw,organic"

  # List a service
  node marketplace.mjs --list --type service --name "Permaculture Consultation" \\
    --price 50 --category education --desc "2-hour site assessment"

  # Browse food listings
  node marketplace.mjs --browse --category food --origin local

  # Purchase a listing
  node marketplace.mjs --purchase --listing lst_abc123 --user Alice
`);
}

function showCategories() {
  console.log('Product Categories:');
  console.log('-------------------');
  for (const [key, cat] of Object.entries(PRODUCT_CATEGORIES)) {
    console.log(`  ${key.padEnd(12)} ${cat.name}`);
    console.log(`               Subcategories: ${cat.subcategories.join(', ')}`);
  }

  console.log('\nService Categories:');
  console.log('-------------------');
  for (const [key, cat] of Object.entries(SERVICE_CATEGORIES)) {
    console.log(`  ${key.padEnd(12)} ${cat.name}`);
    console.log(`               Subcategories: ${cat.subcategories.join(', ')}`);
  }
}

function showCompounds() {
  console.log('Measurable Compound Types for Impact Disclosure:');
  console.log('================================================\n');
  console.log('  COMPOUND  NAME                  UNIT    CATEGORY');
  console.log('  --------  --------------------  ------  ----------');
  for (const [code, info] of Object.entries(COMPOUND_TYPES)) {
    console.log(`  ${code.padEnd(8)}  ${info.name.padEnd(20)}  ${info.unit.padEnd(6)}  ${info.category}`);
  }
  console.log(`
Format: COMPOUND:QUANTITY:CONFIDENCE
  - QUANTITY: negative = extraction/emission, positive = sequestration/benefit
  - CONFIDENCE: 0-100% reflecting measurement quality

Example: CO2:-500:85 means 500g CO2 emitted, 85% confidence
`);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getArg(args, flag, defaultValue = null) {
  const idx = args.indexOf(flag);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : defaultValue;
}

function parseCompounds(args) {
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
  return compounds;
}

function findUserByName(deployment, name) {
  if (!name) return null;
  const testUsers = deployment.testUsers || [];
  return testUsers.find(u => u.name.toLowerCase() === name.toLowerCase());
}

function findPnftByAddress(deployment, address) {
  const pnfts = deployment.pnfts || [];
  return pnfts.find(p => p.owner === address);
}

function generateListingId() {
  return 'lst_' + crypto.randomBytes(8).toString('hex');
}

function getCurrentSlot() {
  return Math.floor(Date.now() / 1000) - 1654041600; // preprod genesis
}

// =============================================================================
// LIST COMMAND
// =============================================================================

async function handleList(args, deployment, atomicWriteSync) {
  log.info('Creating new marketplace listing...');

  // Get seller info
  const userName = getArg(args, '--user');
  let seller, sellerAddress, sellerPnft;

  if (userName) {
    const user = findUserByName(deployment, userName);
    if (!user) {
      log.error(`Unknown user: ${userName}`);
      log.info('Available users: ' + (deployment.testUsers || []).map(u => u.name).join(', '));
      return;
    }
    sellerAddress = user.address;
    sellerPnft = findPnftByAddress(deployment, sellerAddress);
    seller = { name: user.name, address: sellerAddress, pnft: sellerPnft };
  } else {
    // Use main wallet
    if (!CONFIG.walletMnemonic) {
      log.error('No wallet configured. Use --user <name> or set WALLET_SEED_PHRASE in .env');
      return;
    }
    const { MeshWallet, BlockfrostProvider } = await import('@meshsdk/core');
    const provider = new BlockfrostProvider(CONFIG.blockfrostKey);
    const wallet = new MeshWallet({
      networkId: CONFIG.network === 'mainnet' ? 1 : 0,
      fetcher: provider,
      submitter: provider,
      key: { type: 'mnemonic', words: CONFIG.walletMnemonic.trim().split(/\s+/) },
    });
    sellerAddress = wallet.getChangeAddress();
    sellerPnft = findPnftByAddress(deployment, sellerAddress);
    seller = { name: 'Wallet', address: sellerAddress, pnft: sellerPnft };
  }

  if (!sellerPnft) {
    log.error('Seller does not have a pNFT! Mint one first: npm run mint:pnft:basic');
    return;
  }

  // Parse listing details
  const listingType = getArg(args, '--type', 'product').toLowerCase();
  if (!LISTING_TYPES[listingType]) {
    log.error(`Invalid listing type: ${listingType}`);
    log.info('Valid types: ' + Object.keys(LISTING_TYPES).join(', '));
    return;
  }

  const name = getArg(args, '--name');
  if (!name) {
    log.error('Listing name required. Use --name "Product Name"');
    return;
  }

  const price = parseFloat(getArg(args, '--price', '0'));
  const priceType = getArg(args, '--price-type', 'fixed').toLowerCase();
  const description = getArg(args, '--desc', '');
  const category = getArg(args, '--category', 'other').toLowerCase();
  const subcategory = getArg(args, '--subcategory', 'Miscellaneous');
  const quantity = parseInt(getArg(args, '--quantity', '1'));
  const unit = getArg(args, '--unit', 'item');
  const origin = getArg(args, '--origin', 'local').toLowerCase();
  const tags = getArg(args, '--tags', '').split(',').filter(t => t.trim()).map(t => t.trim());
  const survivalEligible = args.includes('--survival');

  // Parse impact compounds
  const compounds = parseCompounds(args);

  // For products, require impact disclosure
  if (listingType === 'product' && compounds.length === 0) {
    log.warn('No impact disclosure provided. Products should include measured impacts.');
    log.info('Use --compound COMPOUND:QUANTITY:CONFIDENCE to add impact data.');
    log.info('Proceeding with empty impact disclosure...');
  }

  // Calculate net impact
  const netImpact = compounds.reduce((sum, c) => sum + (c.quantity * c.confidence / 100), 0);

  // Build listing object
  const currentSlot = getCurrentSlot();
  const listingId = generateListingId();

  const listing = {
    listing_id: listingId,
    seller: sellerPnft.id,
    seller_address: sellerAddress,
    seller_name: seller.name,
    listing_type: {
      type: listingType,
      ...LISTING_TYPES[listingType],
    },
    name: name,
    description: description,
    category: category,
    subcategory: subcategory,
    price: {
      amount: price,
      type: priceType,
      ...PRICE_TYPES[priceType] || PRICE_TYPES.fixed,
    },
    quantity: quantity,
    unit: unit,
    origin: {
      type: origin,
      ...ORIGIN_TYPES[origin] || ORIGIN_TYPES.unknown,
      bioregion: sellerPnft.bioregion || 'unknown',
      producer: sellerPnft.id,
    },
    impact_disclosure: {
      compounds: compounds,
      netImpact: netImpact,
      evidenceHash: crypto.createHash('sha256').update(JSON.stringify(compounds)).digest('hex'),
    },
    survival_eligible: survivalEligible,
    bioregion: sellerPnft.bioregion || 'unknown',
    created_at: currentSlot,
    updated_at: currentSlot,
    expires_at: null,
    status: 'active',
    interest_count: 0,
    tags: tags,
    purchases: [],
    reviews: [],
    testnetSimulated: true,
  };

  // Add to marketplace
  deployment.marketplace.listings.push(listing);

  // Save
  atomicWriteSync(CONFIG.deploymentPath, deployment);

  // Display result
  console.log(`
================================================================================
                    LISTING CREATED SUCCESSFULLY
================================================================================

  Listing ID:    ${listingId}
  Name:          ${name}
  Type:          ${LISTING_TYPES[listingType].name}
  Price:         ${price} ULTRA (${priceType})
  Category:      ${category} / ${subcategory}
  Quantity:      ${quantity} ${unit}
  Origin:        ${ORIGIN_TYPES[origin].name} (${sellerPnft.bioregion})
  Seller:        ${seller.name} (${sellerPnft.id})

--------------------------------------------------------------------------------
  IMPACT DISCLOSURE
--------------------------------------------------------------------------------`);

  if (compounds.length > 0) {
    for (const c of compounds) {
      const sign = c.quantity >= 0 ? '+' : '';
      console.log(`    ${c.compound.padEnd(8)} ${(sign + c.quantity + c.unit).padEnd(12)} (${c.confidence}% confidence)`);
    }
    console.log(`    Net Impact: ${netImpact.toFixed(1)} weighted units`);
  } else {
    console.log('    No impact data provided');
  }

  if (survivalEligible) {
    console.log(`
--------------------------------------------------------------------------------
  UBI SURVIVAL FLOOR ELIGIBLE
  This item can be purchased with survival floor ULTRA allocation.
--------------------------------------------------------------------------------`);
  }

  console.log(`
================================================================================
  View listing: node marketplace.mjs --browse --listing ${listingId}
================================================================================
`);
}

// =============================================================================
// BROWSE COMMAND
// =============================================================================

async function handleBrowse(args, deployment) {
  const listings = deployment.marketplace?.listings || [];

  if (listings.length === 0) {
    console.log('No listings in marketplace yet.');
    console.log('Create one: node marketplace.mjs --list --type product --name "My Product" --price 10');
    return;
  }

  // Filters
  const categoryFilter = getArg(args, '--category');
  const typeFilter = getArg(args, '--type');
  const bioregionFilter = getArg(args, '--bioregion');
  const statusFilter = getArg(args, '--status', 'active');
  const sellerFilter = getArg(args, '--seller');
  const searchTerm = getArg(args, '--search');
  const listingId = getArg(args, '--listing');

  // Apply filters
  let filtered = listings;

  if (listingId) {
    filtered = filtered.filter(l => l.listing_id === listingId);
  } else {
    if (statusFilter) {
      filtered = filtered.filter(l => l.status === statusFilter);
    }
    if (categoryFilter) {
      filtered = filtered.filter(l => l.category === categoryFilter.toLowerCase());
    }
    if (typeFilter) {
      filtered = filtered.filter(l => l.listing_type.type === typeFilter.toLowerCase());
    }
    if (bioregionFilter) {
      filtered = filtered.filter(l => l.bioregion === bioregionFilter);
    }
    if (sellerFilter) {
      const sellerUser = findUserByName(deployment, sellerFilter);
      if (sellerUser) {
        filtered = filtered.filter(l => l.seller_address === sellerUser.address);
      } else {
        filtered = filtered.filter(l => l.seller_name?.toLowerCase() === sellerFilter.toLowerCase());
      }
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(l =>
        l.name.toLowerCase().includes(term) ||
        l.description?.toLowerCase().includes(term) ||
        l.tags?.some(t => t.toLowerCase().includes(term))
      );
    }
  }

  console.log(`
================================================================================
                    MARKETPLACE LISTINGS
================================================================================
  Showing ${filtered.length} of ${listings.length} listings
  Filters: status=${statusFilter}${categoryFilter ? ' category=' + categoryFilter : ''}${typeFilter ? ' type=' + typeFilter : ''}
================================================================================
`);

  if (filtered.length === 0) {
    console.log('  No listings match your criteria.\n');
    return;
  }

  for (const listing of filtered) {
    const impactStr = listing.impact_disclosure?.compounds?.length > 0
      ? listing.impact_disclosure.compounds.map(c => {
          const sign = c.quantity >= 0 ? '+' : '';
          return `${c.compound}:${sign}${c.quantity}`;
        }).join(', ')
      : 'No impact data';

    const survivalBadge = listing.survival_eligible ? ' [UBI-ELIGIBLE]' : '';
    const statusBadge = listing.status === 'active' ? '' : ` [${listing.status.toUpperCase()}]`;

    console.log(`--------------------------------------------------------------------------------
  ${listing.listing_id}${statusBadge}${survivalBadge}
--------------------------------------------------------------------------------
    Name:        ${listing.name}
    Type:        ${listing.listing_type.name} - ${listing.category}/${listing.subcategory}
    Price:       ${listing.price.amount} ULTRA (${listing.price.type})
    Quantity:    ${listing.quantity} ${listing.unit}
    Origin:      ${listing.origin.name} (${listing.bioregion})
    Seller:      ${listing.seller_name} (${listing.seller.slice(0, 20)}...)
    Impact:      ${impactStr}
    Net Impact:  ${listing.impact_disclosure?.netImpact?.toFixed(1) || 0} weighted units
    Tags:        ${listing.tags?.join(', ') || 'none'}
    Reviews:     ${listing.reviews?.length || 0} (avg: ${calculateAvgRating(listing.reviews)} stars)
`);

    // Show more detail for single listing view
    if (listingId) {
      console.log(`    Description: ${listing.description || 'No description'}`);
      console.log(`    Created:     Slot ${listing.created_at}`);
      console.log(`    Purchases:   ${listing.purchases?.length || 0}`);

      if (listing.impact_disclosure?.compounds?.length > 0) {
        console.log('\n    DETAILED IMPACT DISCLOSURE:');
        for (const c of listing.impact_disclosure.compounds) {
          const sign = c.quantity >= 0 ? '+' : '';
          console.log(`      ${c.compound.padEnd(8)} ${(sign + c.quantity + c.unit).padEnd(12)} (${c.confidence}% confidence) [${c.category}]`);
        }
      }

      if (listing.reviews?.length > 0) {
        console.log('\n    REVIEWS:');
        for (const review of listing.reviews) {
          console.log(`      ${'*'.repeat(review.rating)}${'.'.repeat(5 - review.rating)} by ${review.reviewer_name}`);
          console.log(`        "${review.comment}"`);
        }
      }
    }
  }

  console.log(`================================================================================
  To purchase: node marketplace.mjs --purchase --listing <id> --user <name>
  To view details: node marketplace.mjs --browse --listing <id>
================================================================================
`);
}

function calculateAvgRating(reviews) {
  if (!reviews || reviews.length === 0) return 'N/A';
  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  return avg.toFixed(1);
}

// =============================================================================
// PURCHASE COMMAND
// =============================================================================

async function handlePurchase(args, deployment, atomicWriteSync) {
  const listingId = getArg(args, '--listing');
  if (!listingId) {
    log.error('Listing ID required. Use --listing <id>');
    return;
  }

  const listing = deployment.marketplace?.listings?.find(l => l.listing_id === listingId);
  if (!listing) {
    log.error(`Listing not found: ${listingId}`);
    return;
  }

  if (listing.status !== 'active') {
    log.error(`Listing is not active (status: ${listing.status})`);
    return;
  }

  // Get buyer info
  const userName = getArg(args, '--user');
  let buyer, buyerAddress, buyerPnft;

  if (userName) {
    const user = findUserByName(deployment, userName);
    if (!user) {
      log.error(`Unknown user: ${userName}`);
      return;
    }
    buyerAddress = user.address;
    buyerPnft = findPnftByAddress(deployment, buyerAddress);
    buyer = { name: user.name, address: buyerAddress, pnft: buyerPnft };
  } else {
    log.error('Buyer required. Use --user <name>');
    return;
  }

  if (!buyerPnft) {
    log.error('Buyer does not have a pNFT!');
    return;
  }

  // Check can't buy from self
  if (buyerAddress === listing.seller_address) {
    log.error('Cannot purchase from yourself!');
    return;
  }

  // Parse quantity
  const quantity = parseInt(getArg(args, '--quantity', '1'));
  if (quantity > listing.quantity) {
    log.error(`Not enough quantity available. Available: ${listing.quantity}, Requested: ${quantity}`);
    return;
  }

  // Calculate total price
  const totalPrice = listing.price.amount * quantity;

  // Check buyer balance
  const buyerBalance = deployment.ultraBalances?.[buyerAddress] || 0;
  if (buyerBalance < totalPrice) {
    log.error(`Insufficient ULTRA balance. Have: ${buyerBalance}, Need: ${totalPrice}`);
    return;
  }

  log.info(`Processing purchase...`);
  log.info(`  Listing: ${listing.name}`);
  log.info(`  Quantity: ${quantity} ${listing.unit}`);
  log.info(`  Total Price: ${totalPrice} ULTRA`);
  log.info(`  Buyer: ${buyer.name} (balance: ${buyerBalance} ULTRA)`);

  // Create purchase record
  const purchaseId = 'pur_' + crypto.randomBytes(8).toString('hex');
  const currentSlot = getCurrentSlot();

  const purchase = {
    purchase_id: purchaseId,
    listing_id: listingId,
    buyer: buyerPnft.id,
    buyer_address: buyerAddress,
    buyer_name: buyer.name,
    seller: listing.seller,
    seller_address: listing.seller_address,
    quantity: quantity,
    unit_price: listing.price.amount,
    total_price: totalPrice,
    impact_acquired: {
      compounds: listing.impact_disclosure?.compounds?.map(c => ({
        ...c,
        quantity: c.quantity * quantity,
      })) || [],
      netImpact: (listing.impact_disclosure?.netImpact || 0) * quantity,
    },
    purchased_at: currentSlot,
    timestamp: new Date().toISOString(),
    testnetSimulated: true,
  };

  // Update balances
  deployment.ultraBalances = deployment.ultraBalances || {};
  deployment.ultraBalances[buyerAddress] = buyerBalance - totalPrice;
  deployment.ultraBalances[listing.seller_address] = (deployment.ultraBalances[listing.seller_address] || 0) + totalPrice;

  // Update listing
  listing.quantity -= quantity;
  listing.purchases = listing.purchases || [];
  listing.purchases.push(purchaseId);

  if (listing.quantity <= 0) {
    listing.status = 'sold';
    listing.sold_at = currentSlot;
    listing.sold_to = buyerPnft.id;
  }

  // Track purchase in deployment
  deployment.marketplace.purchases = deployment.marketplace.purchases || [];
  deployment.marketplace.purchases.push(purchase);

  // Track impact debt for buyer (compounds flow through to consumer)
  const impactDebt = Math.abs(purchase.impact_acquired.netImpact);
  deployment.impactDebt = deployment.impactDebt || {};
  deployment.impactDebt[buyerAddress] = (deployment.impactDebt[buyerAddress] || 0) + impactDebt;

  // Record as transaction
  const txHash = 'market_tx_' + crypto.randomBytes(16).toString('hex');
  deployment.transactions = deployment.transactions || [];
  deployment.transactions.push({
    txHash: txHash,
    type: 'marketplace_purchase',
    purchaseId: purchaseId,
    sender: buyerPnft.id,
    senderAddress: buyerAddress,
    senderBioregion: buyerPnft.bioregion || 'unknown',
    recipient: listing.seller,
    recipientAddress: listing.seller_address,
    recipientBioregion: listing.bioregion,
    amount: totalPrice,
    txType: {
      code: 2,
      name: 'Goods',
      description: 'Marketplace purchase',
    },
    impact: purchase.impact_acquired,
    slot: currentSlot,
    timestamp: new Date().toISOString(),
    testnetSimulated: true,
  });

  // Update bioregion stats
  const bio = buyerPnft.bioregion || 'unknown';
  deployment.bioregionImpact = deployment.bioregionImpact || {};
  deployment.bioregionImpact[bio] = deployment.bioregionImpact[bio] || {
    totalTransactions: 0,
    totalVolume: 0,
    netImpact: 0,
    byType: {},
    byCompound: {},
  };
  deployment.bioregionImpact[bio].totalTransactions += 1;
  deployment.bioregionImpact[bio].totalVolume += totalPrice;
  deployment.bioregionImpact[bio].netImpact += purchase.impact_acquired.netImpact;

  // Save
  atomicWriteSync(CONFIG.deploymentPath, deployment);

  // Display result
  console.log(`
================================================================================
                    PURCHASE COMPLETE
================================================================================

  Purchase ID:   ${purchaseId}
  Listing:       ${listing.name}
  Quantity:      ${quantity} ${listing.unit}
  Unit Price:    ${listing.price.amount} ULTRA
  Total:         ${totalPrice} ULTRA

--------------------------------------------------------------------------------
  PARTIES
--------------------------------------------------------------------------------
  Buyer:         ${buyer.name} (${buyerPnft.id})
  Seller:        ${listing.seller_name} (${listing.seller})

--------------------------------------------------------------------------------
  IMPACT ACQUIRED (flows to consumer)
--------------------------------------------------------------------------------`);

  if (purchase.impact_acquired.compounds.length > 0) {
    for (const c of purchase.impact_acquired.compounds) {
      const sign = c.quantity >= 0 ? '+' : '';
      console.log(`    ${c.compound.padEnd(8)} ${(sign + c.quantity + c.unit).padEnd(12)} (${c.confidence}% confidence)`);
    }
    console.log(`    Net Impact: ${purchase.impact_acquired.netImpact.toFixed(1)} weighted units`);
  } else {
    console.log('    No impact data');
  }

  console.log(`
--------------------------------------------------------------------------------
  BALANCES UPDATED
--------------------------------------------------------------------------------
  Buyer (${buyer.name}):     ${deployment.ultraBalances[buyerAddress]} ULTRA
  Seller (${listing.seller_name}):   ${deployment.ultraBalances[listing.seller_address]} ULTRA

  Consumer Impact Debt: ${(deployment.impactDebt[buyerAddress] || 0).toFixed(1)} units
    (Offset with: npm run credits:buy)

--------------------------------------------------------------------------------
  LISTING STATUS
--------------------------------------------------------------------------------
  Remaining Quantity: ${listing.quantity} ${listing.unit}
  Status:            ${listing.status}

================================================================================
  Leave a review: node marketplace.mjs --review --listing ${listingId} --rating 5 --user ${buyer.name}
================================================================================
`);
}

// =============================================================================
// UPDATE COMMAND
// =============================================================================

async function handleUpdate(args, deployment, atomicWriteSync) {
  const listingId = getArg(args, '--listing');
  if (!listingId) {
    log.error('Listing ID required. Use --listing <id>');
    return;
  }

  const listing = deployment.marketplace?.listings?.find(l => l.listing_id === listingId);
  if (!listing) {
    log.error(`Listing not found: ${listingId}`);
    return;
  }

  // Verify seller (would need wallet or user check in production)
  const userName = getArg(args, '--user');
  if (userName) {
    const user = findUserByName(deployment, userName);
    if (!user || user.address !== listing.seller_address) {
      log.error('Only the seller can update this listing');
      return;
    }
  }

  // Apply updates
  const newPrice = getArg(args, '--price');
  const newQuantity = getArg(args, '--quantity');
  const newStatus = getArg(args, '--status');

  if (newPrice !== null) {
    listing.price.amount = parseFloat(newPrice);
    log.success(`Price updated to ${newPrice} ULTRA`);
  }

  if (newQuantity !== null) {
    listing.quantity = parseInt(newQuantity);
    log.success(`Quantity updated to ${newQuantity}`);
  }

  if (newStatus !== null) {
    if (!['active', 'paused'].includes(newStatus)) {
      log.error('Invalid status. Use: active, paused');
      return;
    }
    listing.status = newStatus;
    log.success(`Status updated to ${newStatus}`);
  }

  listing.updated_at = getCurrentSlot();

  // Save
  atomicWriteSync(CONFIG.deploymentPath, deployment);

  console.log(`
================================================================================
                    LISTING UPDATED
================================================================================

  Listing ID:    ${listingId}
  Name:          ${listing.name}
  Price:         ${listing.price.amount} ULTRA
  Quantity:      ${listing.quantity} ${listing.unit}
  Status:        ${listing.status}

================================================================================
`);
}

// =============================================================================
// CANCEL COMMAND
// =============================================================================

async function handleCancel(args, deployment, atomicWriteSync) {
  const listingId = getArg(args, '--listing');
  if (!listingId) {
    log.error('Listing ID required. Use --listing <id>');
    return;
  }

  const listing = deployment.marketplace?.listings?.find(l => l.listing_id === listingId);
  if (!listing) {
    log.error(`Listing not found: ${listingId}`);
    return;
  }

  if (listing.status === 'cancelled') {
    log.error('Listing is already cancelled');
    return;
  }

  if (listing.status === 'sold') {
    log.error('Cannot cancel a sold listing');
    return;
  }

  // Verify seller (would need wallet check in production)
  const userName = getArg(args, '--user');
  if (userName) {
    const user = findUserByName(deployment, userName);
    if (!user || user.address !== listing.seller_address) {
      log.error('Only the seller can cancel this listing');
      return;
    }
  }

  listing.status = 'cancelled';
  listing.cancelled_at = getCurrentSlot();

  // Save
  atomicWriteSync(CONFIG.deploymentPath, deployment);

  console.log(`
================================================================================
                    LISTING CANCELLED
================================================================================

  Listing ID:    ${listingId}
  Name:          ${listing.name}
  Status:        CANCELLED

================================================================================
`);
}

// =============================================================================
// REVIEW COMMAND
// =============================================================================

async function handleReview(args, deployment, atomicWriteSync) {
  const listingId = getArg(args, '--listing');
  if (!listingId) {
    log.error('Listing ID required. Use --listing <id>');
    return;
  }

  const listing = deployment.marketplace?.listings?.find(l => l.listing_id === listingId);
  if (!listing) {
    log.error(`Listing not found: ${listingId}`);
    return;
  }

  // Get reviewer info
  const userName = getArg(args, '--user');
  if (!userName) {
    log.error('Reviewer required. Use --user <name>');
    return;
  }

  const user = findUserByName(deployment, userName);
  if (!user) {
    log.error(`Unknown user: ${userName}`);
    return;
  }

  const reviewerPnft = findPnftByAddress(deployment, user.address);
  if (!reviewerPnft) {
    log.error('Reviewer does not have a pNFT!');
    return;
  }

  // Verify purchase (should have purchased to review)
  const purchases = deployment.marketplace?.purchases || [];
  const hasPurchased = purchases.some(p =>
    p.listing_id === listingId && p.buyer_address === user.address
  );

  if (!hasPurchased) {
    log.warn('Reviewer has not purchased this listing. Review will be marked as non-verified.');
  }

  // Check for existing review
  const existingReview = listing.reviews?.find(r => r.reviewer_address === user.address);
  if (existingReview) {
    log.error('You have already reviewed this listing');
    return;
  }

  // Parse review
  const rating = parseInt(getArg(args, '--rating', '5'));
  if (rating < 1 || rating > 5) {
    log.error('Rating must be 1-5');
    return;
  }

  const comment = getArg(args, '--comment', 'Great transaction!');

  // Create review
  const review = {
    review_id: 'rev_' + crypto.randomBytes(8).toString('hex'),
    listing_id: listingId,
    reviewer: reviewerPnft.id,
    reviewer_address: user.address,
    reviewer_name: user.name,
    rating: rating,
    comment: comment,
    verified_purchase: hasPurchased,
    created_at: getCurrentSlot(),
    timestamp: new Date().toISOString(),
  };

  // Add to listing
  listing.reviews = listing.reviews || [];
  listing.reviews.push(review);

  // Add to global reviews
  deployment.marketplace.reviews = deployment.marketplace.reviews || [];
  deployment.marketplace.reviews.push(review);

  // Save
  atomicWriteSync(CONFIG.deploymentPath, deployment);

  const stars = '*'.repeat(rating) + '.'.repeat(5 - rating);

  console.log(`
================================================================================
                    REVIEW SUBMITTED
================================================================================

  Listing:       ${listing.name}
  Reviewer:      ${user.name}
  Rating:        ${stars} (${rating}/5)
  Comment:       "${comment}"
  Verified:      ${hasPurchased ? 'Yes (purchased)' : 'No (not purchased)'}

================================================================================
  View listing: node marketplace.mjs --browse --listing ${listingId}
================================================================================
`);
}

// =============================================================================
// RUN
// =============================================================================

main().catch(error => {
  log.error(error.message);
  console.error(error);
  process.exit(1);
});
