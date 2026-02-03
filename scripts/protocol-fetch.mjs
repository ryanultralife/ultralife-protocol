#!/usr/bin/env node
/**
 * UltraLife Protocol — Fetch & Generate
 *
 * This demonstrates how the protocol spec is the source of truth.
 * Any LLM or system can:
 *   1. Fetch the protocol spec (from URL, IPFS, or local)
 *   2. Understand available compounds, confidence levels, transaction types
 *   3. Generate valid CLI commands based on user intent
 *
 * The scripts in this directory are IMPLEMENTATIONS of the spec.
 * The spec itself is what defines the protocol.
 *
 * Usage:
 *   node protocol-fetch.mjs --show-spec          Show full protocol spec
 *   node protocol-fetch.mjs --compounds          List all compound codes
 *   node protocol-fetch.mjs --generate-example   Show example command generation
 *   node protocol-fetch.mjs --llm-prompt         Output prompt for LLM integration
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// In production, this would fetch from https://ultralife.earth/protocol.json or IPFS
// For now, we read local spec
const SPEC_SOURCES = [
  path.join(__dirname, '..', 'protocol-spec.json'),  // Local development
  // 'https://ultralife.earth/protocol.json',        // Production URL
  // 'ipfs://...'                                     // IPFS backup
];

async function fetchProtocolSpec() {
  for (const source of SPEC_SOURCES) {
    if (source.startsWith('http')) {
      // Would fetch from URL
      // const response = await fetch(source);
      // return response.json();
    } else if (source.startsWith('ipfs://')) {
      // Would fetch from IPFS gateway
    } else {
      // Local file
      if (fs.existsSync(source)) {
        return JSON.parse(fs.readFileSync(source, 'utf-8'));
      }
    }
  }
  throw new Error('Could not fetch protocol spec from any source');
}

function showCompounds(spec) {
  console.log('\n=== UltraLife Compound Registry ===\n');

  for (const [category, compounds] of Object.entries(spec.compounds)) {
    console.log(`\n${category.toUpperCase()}:`);
    console.log('-'.repeat(60));

    for (const [code, info] of Object.entries(compounds)) {
      const direction = info.direction ? ` (${info.direction})` : '';
      const example = info.example ? ` [e.g., ${info.example}]` : '';
      console.log(`  ${code.padEnd(12)} ${info.name.padEnd(25)} ${info.unit}${direction}${example}`);
    }
  }
}

function showConfidence(spec) {
  console.log('\n=== Confidence Levels ===\n');
  console.log('  RANGE      METHOD                 DESCRIPTION');
  console.log('  ' + '-'.repeat(70));

  for (const [range, info] of Object.entries(spec.confidence_levels)) {
    const verify = info.verify_days ? ` (verify in ${info.verify_days}d)` : '';
    console.log(`  ${range.padEnd(10)} ${info.method.padEnd(22)} ${info.description}${verify}`);
  }
}

function generateExampleCommand(spec) {
  console.log('\n=== Command Generation from Spec ===\n');
  console.log('Given: "Alice bought 200g grass-fed beef, has iron deficiency"\n');
  console.log('LLM reads spec.compounds and spec.command_templates...\n');

  // Simulate what an LLM would do
  const template = spec.command_templates.transfer;
  const compounds = [
    { code: 'CO2', quantity: -450, confidence: 75 },
    { code: 'H2O', quantity: -120, confidence: 60 },
    { code: 'PROT', quantity: 25, confidence: 90 },
    { code: 'IRON', quantity: 3, confidence: 85 },
    { code: 'NEED_IRON', quantity: 80, confidence: 70 },
    { code: 'NAT_PROV', quantity: 80, confidence: 70 },
  ];

  const compoundFlags = compounds
    .map(c => `--compound ${c.code}:${c.quantity}:${c.confidence}`)
    .join(' ');

  console.log('Generated command:');
  console.log('─'.repeat(70));
  console.log(`npm run transfer -- \\
  --to Alice \\
  --amount 8 \\
  --type goods \\
  ${compounds.map(c => `--compound ${c.code}:${c.quantity}:${c.confidence}`).join(' \\\n  ')} \\
  --desc "Grass-fed beef 200g - CO2 from transport receipt, iron for documented deficiency, 80% need met naturally"`);
  console.log('─'.repeat(70));

  console.log('\nThe spec provides:');
  console.log('  - Valid compound codes (CO2, H2O, PROT, IRON, NEED_IRON, NAT_PROV)');
  console.log('  - Units for each compound (g, L, mg, %)');
  console.log('  - Confidence level guidelines (75 = calculated from receipts)');
  console.log('  - Command template format');
  console.log('  - Signing convention (negative = extraction)');
}

function outputLLMPrompt(spec) {
  const prompt = `You are helping a user interact with the UltraLife Protocol on Cardano.

PROTOCOL PRINCIPLES:
${spec.principles.map((p, i) => `${i + 1}. ${p}`).join('\n')}

AVAILABLE COMPOUNDS:
${Object.entries(spec.compounds).map(([cat, compounds]) =>
  `${cat}: ${Object.keys(compounds).join(', ')}`
).join('\n')}

CONFIDENCE LEVELS:
${Object.entries(spec.confidence_levels).map(([range, info]) =>
  `${range}: ${info.method} - ${info.description}`
).join('\n')}

COMMAND FORMAT:
${spec.command_templates.transfer.template}
Compound flag: ${spec.command_templates.transfer.compound_flag}

CRITICAL RULES:
- Quantity is SIGNED: negative = extraction/emission, positive = delivery
- Even "green" activities have negative impact (just less than alternatives)
- No presets - every transaction needs individually measured compounds
- Confidence must match actual measurement method
- Consider full chain: production → nutrition → health → care economics
- Compare nature providing vs industrial alternative when relevant

When a user describes a transaction, help them:
1. Identify what compounds were actually measured
2. Determine appropriate confidence levels
3. Generate the complete CLI command
4. Explain what impact debt will be incurred`;

  console.log('\n=== LLM System Prompt ===\n');
  console.log(prompt);
  console.log('\n=== End Prompt ===\n');
}

async function main() {
  const args = process.argv.slice(2);
  const spec = await fetchProtocolSpec();

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           UltraLife Protocol — Spec Fetcher                   ║
║                                                               ║
║   The protocol spec is the source of truth.                   ║
║   Scripts are implementations. Spec is the definition.        ║
╚═══════════════════════════════════════════════════════════════╝

Protocol: ${spec.protocol} v${spec.version}
Network: ${spec.network}
`);

  if (args.includes('--show-spec')) {
    console.log(JSON.stringify(spec, null, 2));
    return;
  }

  if (args.includes('--compounds')) {
    showCompounds(spec);
    showConfidence(spec);
    return;
  }

  if (args.includes('--generate-example')) {
    generateExampleCommand(spec);
    return;
  }

  if (args.includes('--llm-prompt')) {
    outputLLMPrompt(spec);
    return;
  }

  // Default: show summary
  console.log('The protocol spec defines:');
  console.log(`  - ${Object.values(spec.compounds).reduce((sum, cat) => sum + Object.keys(cat).length, 0)} compound codes across ${Object.keys(spec.compounds).length} categories`);
  console.log(`  - ${Object.keys(spec.confidence_levels).length} confidence level ranges`);
  console.log(`  - ${Object.keys(spec.transaction_types).length} transaction types`);
  console.log(`  - ${Object.keys(spec.land_sequestration.rates_tCO2_per_ha_per_year).length} land types with sequestration rates`);
  console.log(`  - ${Object.keys(spec.command_templates).length} command templates for LLMs`);

  console.log('\nUsage:');
  console.log('  --show-spec         Show full protocol spec as JSON');
  console.log('  --compounds         List all compound codes and units');
  console.log('  --generate-example  Demonstrate command generation from spec');
  console.log('  --llm-prompt        Output a system prompt for LLM integration');

  console.log('\n=== How This Works ===');
  console.log(`
1. SPEC IS SOURCE OF TRUTH
   The protocol-spec.json defines everything:
   - Compound codes, units, directions
   - Confidence levels and what they mean
   - Transaction types
   - Command templates

2. ANY LLM CAN FETCH THE SPEC
   Future: fetch('https://ultralife.earth/protocol.json')
   Or: ipfs.cat('ipfs://...')
   Currently: Read local protocol-spec.json

3. LLM GENERATES COMMANDS FROM SPEC
   Given user intent + spec → valid CLI command
   No hardcoded presets. Every measurement is individual.

4. SCRIPTS EXECUTE THE SPEC
   transfer-ultra.mjs, buy-credits.mjs, etc.
   These implement what the spec defines.
   They can be regenerated from the spec.

5. VALIDATORS ENFORCE ON-CHAIN
   Aiken validators check that transactions
   conform to the on_chain_types in the spec.
`);
}

main().catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});
