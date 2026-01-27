/**
 * Seed Testnet with Initial Data
 * 
 * Creates initial bioregions, development pool, and test data for SPO testing.
 */

import { Lucid, Blockfrost, Data, fromText } from 'lucid-cardano';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// CONFIGURATION
// =============================================================================

const NETWORK = process.env.NETWORK || 'preprod';
const BLOCKFROST_KEY = process.env.BLOCKFROST_API_KEY;
const DEPLOYER_SEED = process.env.DEPLOYER_SEED;

// Load deployment config
const deploymentPath = path.join(__dirname, '..', '..', 'deployment.json');
let deployment: any;
try {
  deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
} catch {
  console.error('deployment.json not found. Run deploy-reference-scripts.ts first.');
  process.exit(1);
}

// =============================================================================
// INITIAL BIOREGIONS
// =============================================================================

const INITIAL_BIOREGIONS = [
  {
    id: 'sierra_nevada',
    name: 'Sierra Nevada',
    description: 'Mountain range in California including Lake Tahoe and Yosemite',
    indices: {
      water: 7500,    // 75%
      land: 8000,     // 80%
      air: 9000,      // 90%
      energy: 6000,   // 60% (solar/hydro potential)
      health: 7000,
      education: 7500,
      housing: 5500,
      food_security: 6500,
      care: 6000,
    },
  },
  {
    id: 'pacific_northwest',
    name: 'Pacific Northwest',
    description: 'Cascadia bioregion including Oregon, Washington, and British Columbia',
    indices: {
      water: 9000,
      land: 8500,
      air: 8500,
      energy: 7500,   // Hydro rich
      health: 7500,
      education: 8000,
      housing: 5000,
      food_security: 7000,
      care: 6500,
    },
  },
  {
    id: 'great_basin',
    name: 'Great Basin',
    description: 'Desert region between Sierra Nevada and Rocky Mountains',
    indices: {
      water: 3000,    // Arid
      land: 5000,
      air: 8000,
      energy: 8500,   // Solar potential
      health: 6000,
      education: 6500,
      housing: 7000,
      food_security: 5000,
      care: 5500,
    },
  },
  {
    id: 'amazon_basin',
    name: 'Amazon Basin',
    description: 'Amazon rainforest bioregion',
    indices: {
      water: 9500,
      land: 9000,
      air: 7000,      // Deforestation concerns
      energy: 5000,
      health: 5500,
      education: 5000,
      housing: 4500,
      food_security: 6000,
      care: 5000,
    },
  },
  {
    id: 'test_bioregion',
    name: 'Test Bioregion',
    description: 'Generic test bioregion for development',
    indices: {
      water: 5000,
      land: 5000,
      air: 5000,
      energy: 5000,
      health: 5000,
      education: 5000,
      housing: 5000,
      food_security: 5000,
      care: 5000,
    },
  },
];

// =============================================================================
// SEED FUNCTIONS
// =============================================================================

async function createBioregion(
  lucid: Lucid,
  bioregion: typeof INITIAL_BIOREGIONS[0]
): Promise<string> {
  console.log(`Creating bioregion: ${bioregion.name}`);
  
  const datum = Data.to({
    bioregion: fromText(bioregion.id),
    cycle: 0n,
    water_index: { value: BigInt(bioregion.indices.water), trend: 0n, confidence: 80n },
    land_index: { value: BigInt(bioregion.indices.land), trend: 0n, confidence: 80n },
    air_index: { value: BigInt(bioregion.indices.air), trend: 0n, confidence: 80n },
    energy_index: { value: BigInt(bioregion.indices.energy), trend: 0n, confidence: 80n },
    health_index: { value: BigInt(bioregion.indices.health), trend: 0n, confidence: 70n },
    education_index: { value: BigInt(bioregion.indices.education), trend: 0n, confidence: 70n },
    housing_index: { value: BigInt(bioregion.indices.housing), trend: 0n, confidence: 70n },
    food_security_index: { value: BigInt(bioregion.indices.food_security), trend: 0n, confidence: 70n },
    care_availability_index: { value: BigInt(bioregion.indices.care), trend: 0n, confidence: 60n },
    offerings_active: 0n,
    needs_active: 0n,
    agreements_completed: 0n,
    value_transacted: 0n,
    care_hours: 0n,
    compound_balances: [],
    health_score: BigInt(
      Math.round(
        Object.values(bioregion.indices).reduce((a, b) => a + b, 0) / 
        Object.values(bioregion.indices).length
      )
    ),
    updated_at: BigInt(Date.now()),
  });

  const tx = await lucid
    .newTx()
    .payToContract(
      deployment.contracts?.bioregion || 'addr_test1TODO',
      { inline: datum },
      { lovelace: 2_000_000n }
    )
    .complete();

  const signed = await tx.sign().complete();
  const txHash = await signed.submit();
  
  console.log(`  TX: ${txHash}`);
  await lucid.awaitTx(txHash);
  
  return txHash;
}

async function createDevelopmentPool(lucid: Lucid): Promise<string> {
  console.log('\nCreating development pool...');
  
  // Mint initial token supply to treasury
  // This is simplified - actual implementation would use proper minting
  
  const tx = await lucid
    .newTx()
    .payToAddress(
      deployment.contracts?.treasury || 'addr_test1TODO',
      { lovelace: 100_000_000n } // 100 ADA for pool
    )
    .complete();

  const signed = await tx.sign().complete();
  const txHash = await signed.submit();
  
  console.log(`  TX: ${txHash}`);
  await lucid.awaitTx(txHash);
  
  return txHash;
}

async function createTestOfferings(lucid: Lucid): Promise<void> {
  console.log('\nCreating sample offerings...');
  
  const offerings = [
    {
      type: 'Work',
      description: 'Stake Pool Operation Services',
      bioregion: 'test_bioregion',
      price: 100,
    },
    {
      type: 'Knowledge',
      description: 'Cardano Development Consulting',
      bioregion: 'test_bioregion',
      price: 50,
    },
    {
      type: 'Thing',
      description: 'Organic Vegetables (Local Farm)',
      bioregion: 'sierra_nevada',
      price: 10,
    },
  ];
  
  // In a real implementation, these would be created with proper datums
  console.log(`  Would create ${offerings.length} sample offerings`);
  console.log('  (Skipping - requires deployed contracts)');
}

async function createTestNeeds(lucid: Lucid): Promise<void> {
  console.log('\nCreating sample needs...');

  const needs = [
    {
      type: 'Work',
      description: 'Need help setting up validator node',
      bioregion: 'test_bioregion',
      budget: 200,
    },
    {
      type: 'Knowledge',
      description: 'Looking for Aiken smart contract review',
      bioregion: 'test_bioregion',
      budget: 100,
    },
  ];

  console.log(`  Would create ${needs.length} sample needs`);
  console.log('  (Skipping - requires deployed contracts)');
}

// =============================================================================
// REGISTRY ENTRIES (Category Definitions)
// =============================================================================

const REGISTRY_CATEGORIES = [
  // Work categories
  { code: 'WORK', name: 'Work', parent: null, compounds: [] },
  { code: 'WORK.TECH', name: 'Technology Services', parent: 'WORK', compounds: ['CO2_COMPUTE'] },
  { code: 'WORK.TECH.DEV', name: 'Software Development', parent: 'WORK.TECH', compounds: ['CO2_COMPUTE'] },
  { code: 'WORK.TECH.DEVOPS', name: 'DevOps & Infrastructure', parent: 'WORK.TECH', compounds: ['CO2_COMPUTE'] },
  { code: 'WORK.TECH.BLOCKCHAIN', name: 'Blockchain Development', parent: 'WORK.TECH', compounds: ['CO2_COMPUTE'] },
  { code: 'WORK.CARE', name: 'Care Work', parent: 'WORK', compounds: [] },
  { code: 'WORK.CARE.CHILD', name: 'Childcare', parent: 'WORK.CARE', compounds: [] },
  { code: 'WORK.CARE.ELDER', name: 'Elder Care', parent: 'WORK.CARE', compounds: [] },
  { code: 'WORK.LABOR', name: 'Physical Labor', parent: 'WORK', compounds: ['CO2_TRANSPORT'] },

  // Knowledge categories
  { code: 'KNOW', name: 'Knowledge', parent: null, compounds: [] },
  { code: 'KNOW.CONSULT', name: 'Consulting', parent: 'KNOW', compounds: [] },
  { code: 'KNOW.TRAINING', name: 'Training & Education', parent: 'KNOW', compounds: [] },
  { code: 'KNOW.RESEARCH', name: 'Research', parent: 'KNOW', compounds: [] },

  // Things (goods) categories
  { code: 'THING', name: 'Physical Goods', parent: null, compounds: [] },
  { code: 'THING.FOOD', name: 'Food', parent: 'THING', compounds: ['CO2_FOOD', 'H2O_FOOD'] },
  { code: 'THING.FOOD.LOCAL', name: 'Local/Farm Products', parent: 'THING.FOOD', compounds: ['CO2_LOCAL_FOOD'] },
  { code: 'THING.FOOD.ORGANIC', name: 'Organic Products', parent: 'THING.FOOD', compounds: ['CO2_ORGANIC'] },
  { code: 'THING.CRAFT', name: 'Handcrafted Items', parent: 'THING', compounds: [] },
  { code: 'THING.TECH', name: 'Technology Hardware', parent: 'THING', compounds: ['CO2_ELECTRONICS', 'E_WASTE'] },

  // Access categories
  { code: 'ACCESS', name: 'Access/Rental', parent: null, compounds: [] },
  { code: 'ACCESS.VEHICLE', name: 'Vehicle Access', parent: 'ACCESS', compounds: ['CO2_TRANSPORT'] },
  { code: 'ACCESS.SPACE', name: 'Space Rental', parent: 'ACCESS', compounds: ['CO2_BUILDING'] },
  { code: 'ACCESS.TOOL', name: 'Tool/Equipment Rental', parent: 'ACCESS', compounds: [] },
];

async function createRegistryEntries(lucid: Lucid): Promise<void> {
  console.log('\nCreating registry categories...');

  for (const category of REGISTRY_CATEGORIES) {
    console.log(`  ${category.code}: ${category.name}`);
  }

  console.log(`\n  Total: ${REGISTRY_CATEGORIES.length} categories defined`);
  console.log('  (Full creation requires deployed contracts)');
}

// =============================================================================
// TREASURY INITIALIZATION
// =============================================================================

async function initializeTreasury(lucid: Lucid): Promise<string | null> {
  console.log('\nInitializing treasury with bonding curve...');

  const treasuryAddress = deployment.contracts?.treasury;
  if (!treasuryAddress || treasuryAddress === 'addr_test1TODO') {
    console.log('  Treasury address not configured');
    console.log('  Skipping treasury initialization');
    return null;
  }

  try {
    // Treasury initialization datum
    const treasuryDatum = Data.to({
      total_supply: 400_000_000_000_000_000n, // 400B tokens (with 6 decimals)
      distributed: 0n,
      reserved: 400_000_000_000_000_000n,
      ada_reserve: 0n,
      next_epoch_queue: 0n,
      founder_accrued: 0n,
      founder_claimed: 0n,
      last_settlement: BigInt(Date.now()),
      epoch_purchases: [],
      bonding_curve_params: {
        slope: 1n, // Linear curve
        floor_price: 1n, // 1 lovelace minimum
      },
    });

    // Seed treasury with initial ADA reserve
    const tx = await lucid
      .newTx()
      .payToContract(
        treasuryAddress,
        { inline: treasuryDatum },
        { lovelace: 1_000_000_000n } // 1000 ADA initial reserve
      )
      .complete();

    const signed = await tx.sign().complete();
    const txHash = await signed.submit();

    console.log(`  TX: ${txHash}`);
    await lucid.awaitTx(txHash);
    console.log('  Treasury initialized with 1000 ADA reserve');

    return txHash;
  } catch (error) {
    console.log(`  Error: ${error}`);
    console.log('  Treasury initialization skipped');
    return null;
  }
}

// =============================================================================
// SUMMARY
// =============================================================================

interface SeedingSummary {
  network: string;
  timestamp: string;
  bioregions: { created: number; skipped: number };
  registry: { defined: number };
  treasury: { initialized: boolean; txHash: string | null };
  offerings: { created: number };
  needs: { created: number };
}

function printSummary(summary: SeedingSummary): void {
  console.log('\n' + '='.repeat(50));
  console.log('SEEDING SUMMARY');
  console.log('='.repeat(50));
  console.log(`Network: ${summary.network}`);
  console.log(`Timestamp: ${summary.timestamp}`);
  console.log('');
  console.log('Bioregions:');
  console.log(`  Created: ${summary.bioregions.created}`);
  console.log(`  Skipped: ${summary.bioregions.skipped}`);
  console.log('');
  console.log('Registry:');
  console.log(`  Categories defined: ${summary.registry.defined}`);
  console.log('');
  console.log('Treasury:');
  console.log(`  Initialized: ${summary.treasury.initialized}`);
  if (summary.treasury.txHash) {
    console.log(`  TX: ${summary.treasury.txHash}`);
  }
  console.log('');
  console.log('Sample Data:');
  console.log(`  Offerings: ${summary.offerings.created}`);
  console.log(`  Needs: ${summary.needs.created}`);
  console.log('='.repeat(50));
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('=== UltraLife Testnet Seeding ===\n');
  console.log(`Network: ${NETWORK}`);

  if (!BLOCKFROST_KEY || !DEPLOYER_SEED) {
    console.error('BLOCKFROST_API_KEY and DEPLOYER_SEED required');
    process.exit(1);
  }

  // Initialize summary
  const summary: SeedingSummary = {
    network: NETWORK,
    timestamp: new Date().toISOString(),
    bioregions: { created: 0, skipped: 0 },
    registry: { defined: REGISTRY_CATEGORIES.length },
    treasury: { initialized: false, txHash: null },
    offerings: { created: 0 },
    needs: { created: 0 },
  };

  // Initialize Lucid
  const lucid = await Lucid.new(
    new Blockfrost(
      `https://cardano-${NETWORK}.blockfrost.io/api`,
      BLOCKFROST_KEY
    ),
    NETWORK === 'mainnet' ? 'Mainnet' : 'Preprod'
  );

  lucid.selectWalletFromSeed(DEPLOYER_SEED);
  const address = await lucid.wallet.address();
  console.log(`Seeder: ${address}`);

  // Check balance
  const utxos = await lucid.wallet.getUtxos();
  const balance = utxos.reduce((sum, u) => sum + (u.assets.lovelace || 0n), 0n);
  console.log(`Balance: ${Number(balance) / 1_000_000} ADA\n`);

  if (balance < 50_000_000n) {
    console.error('ERROR: Insufficient balance. Need at least 50 ADA for seeding.');
    process.exit(1);
  }

  // Check if contracts are deployed
  const contractsDeployed = deployment.referenceScripts?.bioregion?.txHash !== 'TODO';
  if (!contractsDeployed) {
    console.log('WARNING: Contracts not yet deployed.');
    console.log('Run deploy-reference-scripts.ts first.');
    console.log('\nProceeding with simulation mode...\n');
  }

  // Create bioregions
  console.log('=== Creating Bioregions ===\n');
  for (const bioregion of INITIAL_BIOREGIONS) {
    try {
      if (contractsDeployed) {
        await createBioregion(lucid, bioregion);
        summary.bioregions.created++;
      } else {
        console.log(`  [SIM] Would create: ${bioregion.name}`);
        summary.bioregions.skipped++;
      }
    } catch (error) {
      console.log(`  Skipped: ${bioregion.name} - ${error}`);
      summary.bioregions.skipped++;
    }
  }

  // Initialize treasury
  if (contractsDeployed) {
    const treasuryTx = await initializeTreasury(lucid);
    summary.treasury.initialized = treasuryTx !== null;
    summary.treasury.txHash = treasuryTx;
  } else {
    console.log('\n[SIM] Would initialize treasury with bonding curve');
  }

  // Create registry categories
  await createRegistryEntries(lucid);

  // Create development pool
  try {
    if (contractsDeployed) {
      await createDevelopmentPool(lucid);
    } else {
      console.log('\n[SIM] Would create development pool with 100 ADA');
    }
  } catch (error) {
    console.log('  Development pool creation skipped');
  }

  // Create sample data
  await createTestOfferings(lucid);
  await createTestNeeds(lucid);

  // Print summary
  printSummary(summary);

  // Save summary to file
  const summaryPath = path.join(__dirname, '..', '..', 'seeding-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`\nSummary saved to: seeding-summary.json`);

  console.log('\n=== NEXT STEPS ===\n');
  console.log('Testnet is ready for SPO testing!\n');
  console.log('1. Start MCP server: npm start');
  console.log('2. Connect your LLM to the MCP server');
  console.log('3. Try: "Tell me about UltraLife Protocol"');
  console.log('4. Try: "Create a pNFT for my wallet"');
  console.log('5. Try: "Show me bioregions"');
  console.log('6. Try: "Get the current token price"');
  console.log('7. Try: "What offerings are available?"');
}

main().catch(console.error);
