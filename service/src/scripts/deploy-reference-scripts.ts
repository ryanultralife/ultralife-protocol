/**
 * Deploy Reference Scripts to Cardano
 *
 * This script compiles Aiken validators and deploys them as reference scripts.
 * Run this once to set up the protocol on a network.
 *
 * Prerequisites:
 * - Aiken CLI installed (aiken --version)
 * - Blockfrost API key
 * - Funded wallet (500+ ADA for full deployment)
 *
 * Usage:
 *   export BLOCKFROST_API_KEY=your_key
 *   export DEPLOYER_SEED="24 word mnemonic"
 *   export NETWORK=preprod
 *   npm run deploy-scripts
 */

import {
  Lucid,
  Blockfrost,
  validatorToAddress,
  mintingPolicyToId,
  applyDoubleCborEncoding,
} from '@lucid-evolution/lucid';
import type { Script, Network, LucidEvolution } from '@lucid-evolution/lucid';
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM (this package is "type": "module") — __dirname isn't defined; derive it.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CONFIGURATION
// =============================================================================

const NETWORK = process.env.NETWORK || 'preprod';
const BLOCKFROST_KEY = process.env.BLOCKFROST_API_KEY;
const DEPLOYER_SEED = process.env.DEPLOYER_SEED; // 24-word mnemonic
const DRY_RUN = process.env.DRY_RUN === 'true'; // Set to simulate without submitting

if (!BLOCKFROST_KEY) {
  console.error('ERROR: BLOCKFROST_API_KEY required');
  console.error('Get one at: https://blockfrost.io');
  process.exit(1);
}

if (!DEPLOYER_SEED) {
  console.error('ERROR: DEPLOYER_SEED required (24-word mnemonic with funds)');
  console.error('Create a wallet and fund it with 500+ ADA');
  process.exit(1);
}

// Guard against pasting the runbook placeholders (e.g. "<your real key>").
// Without this, a bogus key just makes Blockfrost return an HTML error page and
// the failure surfaces as a cryptic "Unexpected token '<' ... is not valid JSON".
if (/[<>]/.test(BLOCKFROST_KEY)) {
  console.error('ERROR: BLOCKFROST_API_KEY still contains placeholder characters (< or >).');
  console.error(`  Got: ${BLOCKFROST_KEY}`);
  console.error('  Paste your REAL preprod project key from https://blockfrost.io (e.g. preprodXXXXXXXX...).');
  process.exit(1);
}
if (/[<>]/.test(DEPLOYER_SEED)) {
  console.error('ERROR: DEPLOYER_SEED still contains placeholder characters (< or >).');
  console.error('  Paste your REAL 24-word mnemonic (a funded preprod wallet, ~500 tADA).');
  process.exit(1);
}
if (!BLOCKFROST_KEY.toLowerCase().startsWith(NETWORK.toLowerCase())) {
  console.warn(`WARNING: BLOCKFROST_API_KEY does not start with "${NETWORK}" — make sure it's a ${NETWORK} project key, not mainnet/preview.`);
}

// Lucid Network enum from our lowercase NETWORK env.
const LUCID_NETWORK: Network =
  NETWORK === 'mainnet' ? 'Mainnet' : NETWORK === 'preview' ? 'Preview' : 'Preprod';

// Wrap an Aiken blueprint compiledCode as a Plutus V3 Script. applyDoubleCborEncoding
// gives the canonical form lucid hashes/deploys — using the SAME Script object for
// policy-id derivation, address derivation, and the deployed reference script keeps
// all three mutually consistent.
function toScript(compiledCode: string): Script {
  return { type: 'PlutusV3', script: applyDoubleCborEncoding(compiledCode) };
}

// Reference script holder address - will be generated from deployer wallet
let REF_SCRIPT_ADDRESS: string;

// Deployment order (respects contract dependencies)
const DEPLOYMENT_ORDER = [
  // Phase 1: Foundation
  'genesis',
  'pnft',
  'token',
  // Phase 2: Infrastructure
  'treasury',
  'bioregion',
  'registry',
  // Phase 3: Economics
  'stake_pool',
  'ubi',
  'governance',
  // Phase 4: Marketplace
  'marketplace',
  'work_auction',
  'records',
  'memory',
  // Phase 5: Impact
  'impact',
  'impact_market',
  'asset_impact',
  'remediation',
  'preservation',
  // Phase 6: Land & Resources
  'land_rights',
  'commons',
  // Phase 7: Social
  'collective',
  'care',
  'recovery',
  // Phase 8: Infrastructure
  'energy',
  'grants',
  // Phase 9: Hydra L2
  'spending_bucket',
  'ultralife_validator',
  'fee_pool',
];

// =============================================================================
// PREREQUISITE CHECKS
// =============================================================================

function checkPrerequisites(): boolean {
  console.log('Checking prerequisites...\n');

  // Check Aiken. shell:true so Windows resolves the npm `aiken.cmd`/`.ps1`
  // shim (bare spawnSync can't, returning ENOENT even when Aiken is installed).
  const aikenResult = spawnSync('aiken', ['--version'], { encoding: 'utf-8', shell: true });
  if (aikenResult.error || aikenResult.status !== 0) {
    console.error('ERROR: Aiken CLI not found');
    console.error('Install (mac/Linux): curl -sSfL https://install.aiken-lang.org | bash');
    console.error('Install (any OS): npm install -g @aiken-lang/aiken');
    return false;
  }
  console.log(`  Aiken: ${aikenResult.stdout.trim()}`);

  // Check contracts directory
  // The Aiken project (aiken.toml, validators/, plutus.json) lives at the repo
  // root — service/src/scripts -> up 3 == repo root. (No contracts/ subdir.)
  const contractsDir = path.join(__dirname, '..', '..', '..');
  if (!fs.existsSync(contractsDir)) {
    console.error(`ERROR: Contracts directory not found: ${contractsDir}`);
    return false;
  }
  console.log(`  Contracts: ${contractsDir}`);

  // Check for validators
  const validatorsDir = path.join(contractsDir, 'validators');
  if (!fs.existsSync(validatorsDir)) {
    console.error('ERROR: validators/ directory not found');
    return false;
  }
  const validators = fs.readdirSync(validatorsDir).filter((f) => f.endsWith('.ak'));
  console.log(`  Validators: ${validators.length} found`);

  console.log('\nPrerequisites OK!\n');
  return true;
}

// =============================================================================
// COMPILE AIKEN
// =============================================================================

async function compileAiken(): Promise<{ scripts: Map<string, string>; hashes: Map<string, string> }> {
  console.log('Compiling Aiken contracts...\n');

  // The Aiken project (aiken.toml, validators/, plutus.json) lives at the repo
  // root — service/src/scripts -> up 3 == repo root. (No contracts/ subdir.)
  const contractsDir = path.join(__dirname, '..', '..', '..');

  // Run aiken check first
  console.log('  Running: aiken check');
  try {
    execSync('aiken check', { cwd: contractsDir, stdio: 'inherit' });
  } catch (error) {
    console.error('\nERROR: Aiken check failed');
    console.error('Fix any errors before deploying');
    throw error;
  }

  // Run aiken build
  console.log('\n  Running: aiken build');
  try {
    execSync('aiken build', { cwd: contractsDir, stdio: 'inherit' });
  } catch (error) {
    console.error('\nERROR: Aiken build failed');
    throw error;
  }

  // Read compiled scripts from plutus.json
  const plutusPath = path.join(contractsDir, 'plutus.json');
  if (!fs.existsSync(plutusPath)) {
    throw new Error('plutus.json not found after build');
  }

  const plutus = JSON.parse(fs.readFileSync(plutusPath, 'utf-8'));

  const scripts = new Map<string, string>();
  const hashes = new Map<string, string>();

  console.log('\nCompiled validators:');
  for (const validator of plutus.validators) {
    // Extract name from title like "validators/pnft.pnft"
    const fullName = validator.title;
    const name = fullName.split('/').pop()?.split('.')[0] || fullName;
    const script = validator.compiledCode;
    const hash = validator.hash;

    scripts.set(name, script);
    if (hash) hashes.set(name, hash);
    console.log(`  ${name.padEnd(20)} ${hash.slice(0, 16)}... (${script.length} chars)`);
  }

  console.log(`\nTotal: ${scripts.size} validators compiled\n`);
  return { scripts, hashes };
}

// =============================================================================
// DEPLOY REFERENCE SCRIPTS
// =============================================================================

async function deployReferenceScripts(
  lucid: LucidEvolution,
  scripts: Map<string, string>
): Promise<Map<string, { txHash: string; outputIndex: number }>> {
  
  console.log('\nDeploying reference scripts...');
  
  const deployed = new Map<string, { txHash: string; outputIndex: number }>();
  
  // Deploy in batches to avoid tx size limits
  const scriptEntries = Array.from(scripts.entries());
  const batchSize = 3; // Scripts per transaction
  
  for (let i = 0; i < scriptEntries.length; i += batchSize) {
    const batch = scriptEntries.slice(i, i + batchSize);
    console.log(`\nDeploying batch ${Math.floor(i / batchSize) + 1}...`);
    
    let tx = lucid.newTx();
    
    for (const [name, script] of batch) {
      console.log(`  Adding: ${name}`);
      
      // Create output carrying the validator as a Plutus V3 reference script.
      tx = tx.pay.ToAddressWithData(
        REF_SCRIPT_ADDRESS,
        undefined,                  // no datum
        { lovelace: 20_000_000n },  // 20 ADA for storage
        toScript(script)            // scriptRef (V3)
      );
    }
    
    const completed = await tx.complete();
    const signed = await completed.sign.withWallet().complete();
    const txHash = await signed.submit();
    
    console.log(`  TX: ${txHash}`);
    
    // Wait for confirmation
    await lucid.awaitTx(txHash);
    console.log(`  Confirmed!`);
    
    // Record deployed locations
    for (let j = 0; j < batch.length; j++) {
      const [name] = batch[j];
      deployed.set(name, { txHash, outputIndex: j });
      console.log(`  ${name}: ${txHash}#${j}`);
    }
    
    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  return deployed;
}

// =============================================================================
// GENERATE CONFIG
// =============================================================================

function generateConfig(
  deployed: Map<string, { txHash: string; outputIndex: number }>,
  policyIds: Map<string, string>,
  addresses: Map<string, string>
): void {

  console.log('\n=== DEPLOYMENT CONFIG ===\n');

  // Generate .env format
  let envContent = `# UltraLife Protocol Deployment - ${NETWORK}\n`;
  envContent += `# Generated: ${new Date().toISOString()}\n\n`;

  envContent += `NETWORK=${NETWORK}\n`;
  envContent += `BLOCKFROST_API_KEY=${BLOCKFROST_KEY}\n\n`;

  // Policy IDs
  for (const [name, policyId] of policyIds) {
    envContent += `${name.toUpperCase()}_POLICY=${policyId}\n`;
  }
  envContent += '\n';

  // Validator addresses
  envContent += '# Validator Addresses\n';
  for (const [name, address] of addresses) {
    envContent += `ADDR_${name.toUpperCase()}=${address}\n`;
  }
  envContent += '\n';

  // Reference scripts
  envContent += '# Reference Scripts\n';
  for (const [name, { txHash, outputIndex }] of deployed) {
    envContent += `REF_${name.toUpperCase()}=${txHash}#${outputIndex}\n`;
  }

  // Repo root — next to plutus.json / aiken.toml (service/src/scripts -> up 3).
  const repoRoot = path.join(__dirname, '..', '..', '..');

  fs.writeFileSync(path.join(repoRoot, '.env.deployed'), envContent);
  console.log('Written to: .env.deployed');

  // Also output JSON format — consumed by service/src/config.ts.
  const jsonConfig = {
    network: NETWORK,
    referenceScripts: Object.fromEntries(
      Array.from(deployed.entries()).map(([name, ref]) => [
        name,
        { txHash: ref.txHash, outputIndex: ref.outputIndex }
      ])
    ),
    policyIds: Object.fromEntries(policyIds),
    addresses: Object.fromEntries(addresses),
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(repoRoot, 'deployment.json'),
    JSON.stringify(jsonConfig, null, 2)
  );
  console.log('Written to: deployment.json');
}

// =============================================================================
// CALCULATE POLICY IDS
// =============================================================================

function calculatePolicyIds(
  scripts: Map<string, string>,
  hashes: Map<string, string>
): Map<string, string> {
  console.log('\nCalculating policy IDs...');

  const policyIds = new Map<string, string>();

  // Minting policies (scripts that mint NFTs/tokens)
  const mintingScripts = ['pnft', 'token', 'genesis'];

  for (const name of mintingScripts) {
    const script = scripts.get(name);
    if (!script) continue;
    // Real policy id = the minting script's hash, derived from the compiled code.
    const policyId = mintingPolicyToId(toScript(script));
    policyIds.set(name, policyId);
    const blueprintHash = hashes.get(name);
    if (blueprintHash && blueprintHash !== policyId) {
      console.warn(`  WARNING ${name}: derived policy id ${policyId} != blueprint hash ${blueprintHash}`);
      console.warn('    (CBOR-encoding assumption mismatch — verify before mainnet.)');
    }
    console.log(`  ${name}: ${policyId}`);
  }

  return policyIds;
}

// =============================================================================
// CALCULATE VALIDATOR ADDRESSES
// =============================================================================

// Spend-validator addresses (e.g. `records`, where the transfer record datum is
// paid). These are NOT policy ids — they're derived from each validator's script
// hash — and the builder/config needs them. deployment.json carries them so
// config.ts can populate contracts.records / contracts.*_spend.
function calculateAddresses(
  scripts: Map<string, string>,
  hashes: Map<string, string>
): Map<string, string> {
  console.log('\nCalculating validator addresses...');

  const addresses = new Map<string, string>();

  for (const [name, script] of scripts) {
    const address = validatorToAddress(LUCID_NETWORK, toScript(script));
    addresses.set(name, address);
  }

  console.log(`  ${addresses.size} addresses derived (network: ${LUCID_NETWORK})`);
  return addresses;
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('ULTRALIFE PROTOCOL - REFERENCE SCRIPT DEPLOYMENT');
  console.log('='.repeat(60));
  console.log(`\nNetwork: ${NETWORK}`);
  console.log(`Dry run: ${DRY_RUN}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // Check prerequisites
  if (!checkPrerequisites()) {
    process.exit(1);
  }

  // Initialize Lucid
  console.log('Initializing Lucid...');
  const lucid = await Lucid(
    new Blockfrost(
      `https://cardano-${NETWORK}.blockfrost.io/api`,
      BLOCKFROST_KEY!
    ),
    LUCID_NETWORK
  );

  // Load deployer wallet
  lucid.selectWallet.fromSeed(DEPLOYER_SEED!);
  const deployerAddress = await lucid.wallet().address();
  REF_SCRIPT_ADDRESS = deployerAddress; // Use deployer address for reference scripts

  console.log(`\nDeployer: ${deployerAddress}`);

  // Check balance
  const utxos = await lucid.wallet().getUtxos();
  const totalAda = utxos.reduce((sum, u) => sum + (u.assets.lovelace || 0n), 0n);
  const adaBalance = Number(totalAda) / 1_000_000;
  console.log(`Balance: ${adaBalance.toFixed(2)} ADA`);

  // Estimate cost: ~20 ADA per script + fees
  const estimatedCost = DEPLOYMENT_ORDER.length * 25;
  console.log(`Estimated cost: ~${estimatedCost} ADA`);

  if (totalAda < BigInt(estimatedCost) * 1_000_000n) {
    console.error(`\nERROR: Insufficient balance`);
    console.error(`Need at least ${estimatedCost} ADA for deployment`);
    console.error(`Current balance: ${adaBalance.toFixed(2)} ADA`);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('PHASE 1: COMPILE CONTRACTS');
  console.log('='.repeat(60) + '\n');

  // Compile contracts
  const { scripts, hashes } = await compileAiken();

  // Calculate policy IDs + validator addresses (real, from the compiled scripts)
  const policyIds = calculatePolicyIds(scripts, hashes);
  const addresses = calculateAddresses(scripts, hashes);

  // Check if all expected scripts are present
  const missingScripts = DEPLOYMENT_ORDER.filter((name) => !scripts.has(name));
  if (missingScripts.length > 0) {
    console.warn(`\nWARNING: Missing scripts: ${missingScripts.join(', ')}`);
    console.warn('Deployment will skip missing scripts\n');
  }

  console.log('\n' + '='.repeat(60));
  console.log('PHASE 2: DEPLOY REFERENCE SCRIPTS');
  console.log('='.repeat(60) + '\n');

  if (DRY_RUN) {
    console.log('[DRY RUN] Would deploy the following scripts:\n');
    for (const name of DEPLOYMENT_ORDER) {
      if (scripts.has(name)) {
        console.log(`  ${name}`);
      }
    }
    console.log('\nSkipping actual deployment (DRY_RUN=true)\n');
  }

  // Deploy as reference scripts
  const deployed = DRY_RUN
    ? new Map(DEPLOYMENT_ORDER.filter((n) => scripts.has(n)).map((n) => [n, { txHash: 'DRY_RUN', outputIndex: 0 }]))
    : await deployReferenceScripts(lucid, scripts);

  console.log('\n' + '='.repeat(60));
  console.log('PHASE 3: GENERATE CONFIGURATION');
  console.log('='.repeat(60) + '\n');

  // Generate config
  generateConfig(deployed, policyIds, addresses);

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('DEPLOYMENT SUMMARY');
  console.log('='.repeat(60));
  console.log(`\nNetwork: ${NETWORK}`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log(`Scripts deployed: ${deployed.size}`);
  console.log(`Policy IDs generated: ${policyIds.size}`);

  if (!DRY_RUN) {
    const finalUtxos = await lucid.wallet().getUtxos();
    const finalAda = finalUtxos.reduce((sum, u) => sum + (u.assets.lovelace || 0n), 0n);
    const spent = (totalAda - finalAda) / 1_000_000n;
    console.log(`ADA spent: ${spent} ADA`);
    console.log(`Remaining balance: ${Number(finalAda) / 1_000_000} ADA`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('NEXT STEPS');
  console.log('='.repeat(60));
  console.log(`
1. Copy deployment values to your environment:
   cp .env.deployed .env

2. Seed testnet with initial data:
   npm run seed-testnet

3. Start the MCP server:
   npm start

4. Connect your LLM and test:
   - "Tell me about UltraLife Protocol"
   - "Get current token price"
   - "List bioregions"
`);
}

main().catch((error) => {
  console.error('\n' + '='.repeat(60));
  console.error('DEPLOYMENT FAILED');
  console.error('='.repeat(60));
  console.error(`\nError: ${error.message}`);
  console.error('\nStack trace:');
  console.error(error.stack);
  process.exit(1);
});
