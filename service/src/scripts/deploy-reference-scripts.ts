/**
 * Deploy Reference Scripts to Cardano
 * 
 * This script compiles Aiken validators and deploys them as reference scripts.
 * Run this once to set up the protocol on a network.
 */

import { Lucid, Blockfrost, fromHex, toHex } from 'lucid-cardano';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// CONFIGURATION
// =============================================================================

const NETWORK = process.env.NETWORK || 'preprod';
const BLOCKFROST_KEY = process.env.BLOCKFROST_API_KEY;
const DEPLOYER_SEED = process.env.DEPLOYER_SEED; // 24-word mnemonic

if (!BLOCKFROST_KEY) {
  console.error('BLOCKFROST_API_KEY required');
  process.exit(1);
}

if (!DEPLOYER_SEED) {
  console.error('DEPLOYER_SEED required (24-word mnemonic with funds)');
  process.exit(1);
}

// Reference script holder address - scripts are stored here
const REF_SCRIPT_ADDRESS = 'addr_test1qz...'; // Update after first run

// =============================================================================
// COMPILE AIKEN
// =============================================================================

async function compileAiken(): Promise<Map<string, string>> {
  console.log('Compiling Aiken contracts...');
  
  const contractsDir = path.join(__dirname, '..', '..', '..', 'contracts');
  
  // Run aiken build
  try {
    execSync('aiken build', { cwd: contractsDir, stdio: 'inherit' });
  } catch (error) {
    console.error('Aiken compilation failed');
    throw error;
  }
  
  // Read compiled scripts from plutus.json
  const plutusPath = path.join(contractsDir, 'plutus.json');
  const plutus = JSON.parse(fs.readFileSync(plutusPath, 'utf-8'));
  
  const scripts = new Map<string, string>();
  
  for (const validator of plutus.validators) {
    const name = validator.title.split('.').pop(); // e.g., "pnft" from "validators/pnft.pnft"
    const script = validator.compiledCode;
    scripts.set(name, script);
    console.log(`  Compiled: ${name} (${script.length} bytes)`);
  }
  
  return scripts;
}

// =============================================================================
// DEPLOY REFERENCE SCRIPTS
// =============================================================================

async function deployReferenceScripts(
  lucid: Lucid,
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
      
      // Create output with script reference
      tx = tx.payToAddressWithData(
        REF_SCRIPT_ADDRESS,
        {
          scriptRef: {
            type: 'PlutusV2',
            script: script,
          },
        },
        { lovelace: 20_000_000n } // 20 ADA for storage
      );
    }
    
    const completed = await tx.complete();
    const signed = await completed.sign().complete();
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
  policyIds: Map<string, string>
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
  
  // Reference scripts
  envContent += '# Reference Scripts\n';
  for (const [name, { txHash, outputIndex }] of deployed) {
    envContent += `REF_${name.toUpperCase()}=${txHash}#${outputIndex}\n`;
  }
  
  // Write to file
  fs.writeFileSync(path.join(__dirname, '..', '..', '.env.deployed'), envContent);
  console.log('Written to: .env.deployed');
  
  // Also output JSON format
  const jsonConfig = {
    network: NETWORK,
    referenceScripts: Object.fromEntries(
      Array.from(deployed.entries()).map(([name, ref]) => [
        name,
        { txHash: ref.txHash, outputIndex: ref.outputIndex }
      ])
    ),
    policyIds: Object.fromEntries(policyIds),
    deployedAt: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    path.join(__dirname, '..', '..', 'deployment.json'),
    JSON.stringify(jsonConfig, null, 2)
  );
  console.log('Written to: deployment.json');
}

// =============================================================================
// MAIN
// =============================================================================

async function main(): Promise<void> {
  console.log('=== UltraLife Reference Script Deployment ===\n');
  console.log(`Network: ${NETWORK}`);
  
  // Initialize Lucid
  const lucid = await Lucid.new(
    new Blockfrost(
      `https://cardano-${NETWORK}.blockfrost.io/api`,
      BLOCKFROST_KEY!
    ),
    NETWORK === 'mainnet' ? 'Mainnet' : 'Preprod'
  );
  
  // Load deployer wallet
  lucid.selectWalletFromSeed(DEPLOYER_SEED!);
  const deployerAddress = await lucid.wallet.address();
  console.log(`Deployer: ${deployerAddress}`);
  
  // Check balance
  const utxos = await lucid.wallet.getUtxos();
  const totalAda = utxos.reduce((sum, u) => sum + u.assets.lovelace, 0n);
  console.log(`Balance: ${Number(totalAda) / 1_000_000} ADA`);
  
  if (totalAda < 500_000_000n) {
    console.error('Need at least 500 ADA for deployment');
    process.exit(1);
  }
  
  // Compile contracts
  const scripts = await compileAiken();
  console.log(`\nCompiled ${scripts.size} validators`);
  
  // Deploy as reference scripts
  const deployed = await deployReferenceScripts(lucid, scripts);
  
  // For minting policies, we need to derive the policy IDs
  const policyIds = new Map<string, string>();
  // Policy IDs are derived from the script hash
  // This is simplified - actual implementation would calculate properly
  
  // Generate config
  generateConfig(deployed, policyIds);
  
  console.log('\n=== DEPLOYMENT COMPLETE ===');
  console.log(`Deployed ${deployed.size} reference scripts`);
  console.log('\nNext steps:');
  console.log('1. Copy .env.deployed values to your .env');
  console.log('2. Run seed-testnet.ts to create initial bioregions and test data');
  console.log('3. Start the MCP server with: npm start');
}

main().catch(console.error);
