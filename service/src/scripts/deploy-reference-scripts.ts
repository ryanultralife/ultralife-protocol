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

// Deployment order (respects contract dependencies). Names are VALIDATOR BLOCK
// names from the blueprint (title = "file.block.purpose") — NOT file stems.
// Files hold multiple blocks (token.ak -> `token` spend + `token_policy` mint),
// and the old file-stem keying collapsed them last-wins: the derived
// "token policy id" could silently be the spend validator's hash.
const DEPLOYMENT_ORDER = [
  // Phase 0: Unparameterized — deployable as-is today
  'lease',      // Property OS lease validator (activate_lease / asset twins)
  'identity',   // biometric.ak identity validator (pNFT signing flow)
  // Phase 1: Foundation
  'genesis',
  'pnft_policy',
  'pnft_spend',
  'token_policy',
  'token',
  // Phase 2: Infrastructure
  'treasury',
  'bioregion',
  'bioregion_beacon',
  'registry',
  'thing',
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
  'impact_policy',
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

// A compiled validator block from the blueprint.
interface CompiledBlock {
  script: string;            // compiledCode (CBOR hex, unapplied if parameterized)
  hash: string;              // blueprint hash
  purposes: Set<string>;     // mint | spend | else | ...
  parameterized: boolean;    // takes params -> MUST be applied before deploy
  paramTitles: string[];
}

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

async function compileAiken(): Promise<Map<string, CompiledBlock>> {
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

  // Key by validator BLOCK name (title = "file.block.purpose"). One block can
  // appear under several purposes (spend/mint/else) with the same compiled
  // code — record every purpose, keep one script.
  const blocks = new Map<string, CompiledBlock>();

  console.log('\nCompiled validator blocks:');
  for (const validator of plutus.validators) {
    const parts = (validator.title as string).split('.');
    const block = parts.length >= 2 ? parts[1] : parts[0];
    const purpose = parts.length >= 3 ? parts[2] : 'unknown';

    const existing = blocks.get(block);
    if (existing) {
      existing.purposes.add(purpose);
      continue;
    }
    blocks.set(block, {
      script: validator.compiledCode,
      hash: validator.hash,
      purposes: new Set([purpose]),
      parameterized: Array.isArray(validator.parameters) && validator.parameters.length > 0,
      paramTitles: (validator.parameters || []).map((p: { title?: string }) => p.title || '?'),
    });
  }

  for (const [name, b] of blocks) {
    const tag = b.parameterized ? `PARAMETERIZED(${b.paramTitles.join(',')})` : 'ready';
    console.log(`  ${name.padEnd(22)} ${b.hash.slice(0, 12)}... [${[...b.purposes].join('/')}] ${tag}`);
  }
  console.log(`\nTotal: ${blocks.size} validator blocks\n`);
  return blocks;
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

// Policy ids come ONLY from blocks that (a) have a mint purpose and (b) are NOT
// parameterized. A parameterized policy's real id only exists after
// applyParamsToScript — deriving from the unapplied template is silently wrong.
function calculatePolicyIds(blocks: Map<string, CompiledBlock>): Map<string, string> {
  console.log('\nCalculating policy IDs (unparameterized mint blocks only)...');

  const policyIds = new Map<string, string>();
  for (const [name, b] of blocks) {
    if (b.parameterized || !b.purposes.has('mint')) continue;
    const policyId = mintingPolicyToId(toScript(b.script));
    policyIds.set(name, policyId);
    if (b.hash && b.hash !== policyId) {
      console.warn(`  WARNING ${name}: derived policy id ${policyId} != blueprint hash ${b.hash}`);
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
// paid). Only meaningful for unparameterized spend blocks — an unapplied
// parameterized validator's address is not where anything will ever validate.
function calculateAddresses(blocks: Map<string, CompiledBlock>): Map<string, string> {
  console.log('\nCalculating validator addresses (unparameterized spend blocks only)...');

  const addresses = new Map<string, string>();
  for (const [name, b] of blocks) {
    if (b.parameterized || !b.purposes.has('spend')) continue;
    addresses.set(name, validatorToAddress(LUCID_NETWORK, toScript(b.script)));
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

  console.log('\n' + '='.repeat(60));
  console.log('PHASE 1: COMPILE CONTRACTS');
  console.log('='.repeat(60) + '\n');

  // Compile contracts
  const blocks = await compileAiken();

  // Split deployable vs blocked. An unapplied parameterized validator is a
  // dead script on-chain (its runtime hash can never match) — refuse to deploy
  // those until an applyParamsToScript ceremony provides real config values.
  const deployable = new Map<string, string>();
  const blocked: string[] = [];
  for (const name of DEPLOYMENT_ORDER) {
    const b = blocks.get(name);
    if (!b) { console.warn(`  WARNING: block "${name}" not found in plutus.json — skipped`); continue; }
    if (b.parameterized) { blocked.push(`${name}(${b.paramTitles.join(',')})`); continue; }
    deployable.set(name, b.script);
  }

  if (blocked.length) {
    console.log('\nPARAMETERIZED — NOT deployable until params are applied (applyParamsToScript ceremony):');
    for (const n of blocked) console.log(`  ${n}`);
    console.log('  These need real config values (genesis UTxO, oracle keys, policy ids, ...).');
  }
  console.log(`\nDeployable now (unparameterized): ${[...deployable.keys()].join(', ') || 'none'}`);

  // Calculate policy IDs + validator addresses (real, from unparameterized blocks)
  const policyIds = calculatePolicyIds(blocks);
  const addresses = calculateAddresses(blocks);

  // Cost estimate: ~20 ADA per deployable script + fees
  const estimatedCost = Math.max(deployable.size, 1) * 25;
  console.log(`\nEstimated cost: ~${estimatedCost} ADA for ${deployable.size} script(s)`);
  if (!DRY_RUN && totalAda < BigInt(estimatedCost) * 1_000_000n) {
    console.error(`\nERROR: Insufficient balance`);
    console.error(`Need at least ${estimatedCost} ADA for deployment`);
    console.error(`Current balance: ${adaBalance.toFixed(2)} ADA`);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('PHASE 2: DEPLOY REFERENCE SCRIPTS');
  console.log('='.repeat(60) + '\n');

  if (DRY_RUN) {
    console.log('[DRY RUN] Would deploy the following scripts:\n');
    for (const name of deployable.keys()) console.log(`  ${name}`);
    console.log('\nSkipping actual deployment (DRY_RUN=true)\n');
  }

  // Deploy as reference scripts
  const deployed = DRY_RUN
    ? new Map([...deployable.keys()].map((n) => [n, { txHash: 'DRY_RUN', outputIndex: 0 }]))
    : await deployReferenceScripts(lucid, deployable);

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
