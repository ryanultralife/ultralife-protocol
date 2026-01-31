/**
 * UltraLife Protocol — Deployment Script
 * 
 * Deploys all contracts to Cardano testnet in dependency order.
 * 
 * Prerequisites:
 * - BLOCKFROST_KEY environment variable
 * - NETWORK environment variable (preview, preprod, mainnet)
 * - Compiled contracts in ../contracts/plutus.json
 * 
 * Usage:
 *   npm install
 *   export BLOCKFROST_KEY=your_key
 *   export NETWORK=preview
 *   node deploy.mjs
 */

import { BlockfrostProvider } from '@meshsdk/core';
import fs from 'fs';

const BLOCKFROST_KEY = process.env.BLOCKFROST_KEY;
const NETWORK = process.env.NETWORK || 'preprod';

if (!BLOCKFROST_KEY) {
  console.error('Error: BLOCKFROST_KEY environment variable required');
  process.exit(1);
}

/**
 * Contract deployment order (respects dependencies)
 */
const DEPLOY_ORDER = [
  // Bootstrap
  'genesis',
  // Identity
  'pnft',
  // Place
  'bioregion',
  // Economy
  'token',
  'treasury',
  'grants',
  // Consequence
  'impact',
  'remediation',
  // Distribution
  'ubi',
  // Governance
  'governance',
  // Memory
  'memory',
  // Classification
  'registry',
];

async function main() {
  console.log(`\n🚀 UltraLife Protocol Deployment`);
  console.log(`   Network: ${NETWORK}`);
  console.log(`   Contracts: ${DEPLOY_ORDER.length}\n`);

  // Load compiled contracts
  const plutusPath = '../plutus.json';
  if (!fs.existsSync(plutusPath)) {
    console.error('Error: plutus.json not found. Run `aiken build` first.');
    process.exit(1);
  }

  const plutusJson = JSON.parse(fs.readFileSync(plutusPath, 'utf8'));

  // Deployment record
  const deployment = {
    network: NETWORK,
    timestamp: new Date().toISOString(),
    contracts: {},
  };

  // Process each contract
  for (const name of DEPLOY_ORDER) {
    console.log(`📦 ${name}`);
    
    const validator = plutusJson.validators.find(v => 
      v.title.toLowerCase().includes(name.toLowerCase())
    );

    if (!validator) {
      console.log(`   ⚠️  Not found in plutus.json`);
      continue;
    }

    deployment.contracts[name] = {
      hash: validator.hash,
      title: validator.title,
    };

    console.log(`   ✓ ${validator.hash.slice(0, 20)}...`);
  }

  // Save deployment record
  const outputPath = `deployment-${NETWORK}-${Date.now()}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(deployment, null, 2));
  
  console.log(`\n✅ Prepared: ${outputPath}`);
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Fund a wallet on ${NETWORK}`);
  console.log(`   2. Deploy reference scripts`);
  console.log(`   3. Initialize genesis datum`);
  console.log(`   4. Mint genesis tokens\n`);
}

main().catch(console.error);
