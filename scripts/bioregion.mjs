#!/usr/bin/env node
/**
 * UltraLife Protocol — Bioregion Registry CLI
 *
 * Manages bioregions and their health indices.
 * KEY CONCEPT: Compound tracking priorities EMERGE from bioregion health data.
 *
 * Usage:
 *   node bioregion.mjs --register --name "Sierra Nevada" --id sierra_nevada
 *   node bioregion.mjs --list
 *   node bioregion.mjs --show --bioregion sierra_nevada
 *   node bioregion.mjs --update-health --bioregion sierra_nevada --soil 65 --water 45 --biodiversity 70
 *   node bioregion.mjs --stress-analysis --bioregion sierra_nevada
 *   node bioregion.mjs --compound-priorities --bioregion sierra_nevada
 *   node bioregion.mjs --update-priorities --bioregion sierra_nevada --add H2O --add BIO
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const deploymentPath = path.join(__dirname, 'deployment.json');

// =============================================================================
// CONSTANTS — Compound Emergence Rules
// =============================================================================

// Health index thresholds
const STRESS_THRESHOLD = 50;        // Below this = stressed
const WARNING_THRESHOLD = 70;       // Below this = warning
const HEALTHY_THRESHOLD = 80;       // Above this = healthy

// Compound mappings from health indices
// When a health index is stressed, these compounds become priority
const STRESS_COMPOUND_MAP = {
  soil: {
    primary: ['SOIL', 'N', 'P'],
    secondary: ['MICROBIOME', 'GLYPHOSATE', 'PESTICIDE'],
    description: 'Soil degradation affects nutrient cycling and food quality',
  },
  water: {
    primary: ['H2O', 'NO3', 'P'],
    secondary: ['HEAVY_METAL', 'PESTICIDE'],
    description: 'Water stress affects hydration, contamination, and ecosystems',
  },
  biodiversity: {
    primary: ['BIO'],
    secondary: ['SOIL', 'H2O', 'PESTICIDE'],
    description: 'Biodiversity loss indicates ecosystem collapse',
  },
  air: {
    primary: ['CO2', 'NOx', 'CH4'],
    secondary: ['INFLAM', 'NEURO_IMPACT'],
    description: 'Air quality affects respiratory and neurological health',
  },
  aquifer: {
    primary: ['H2O'],
    secondary: ['HEAVY_METAL', 'NO3'],
    description: 'Aquifer depletion threatens long-term water security',
  },
};

// Population health compound mappings
const POPULATION_COMPOUND_MAP = {
  iron_deficiency: ['IRON', 'NEED_IRON', 'B12'],
  vitamin_d_deficiency: ['VIT_D'],
  protein_malnutrition: ['PROT', 'NEED_PROT'],
  omega_imbalance: ['OMEGA3', 'OMEGA6', 'INFLAM'],
  gut_health: ['MICROBIOME', 'FIBER', 'GUT_PERMEABILITY', 'FERMENTED'],
  chronic_inflammation: ['INFLAM', 'SEED_OIL', 'PROC_FOOD', 'ADDED_SUGAR'],
  metabolic_dysfunction: ['INSULIN_IMPACT', 'METABOLIC', 'ADDED_SUGAR'],
};

// Universal compounds (always tracked)
const UNIVERSAL_COMPOUNDS = ['CO2', 'H2O', 'KCAL'];

// Example bioregion templates
const BIOREGION_TEMPLATES = {
  sierra_nevada: {
    name: 'Sierra Nevada',
    description: 'Mountain ecosystems, forests, snowpack-dependent water',
    typicalStress: ['H2O', 'BIO', 'SOIL'],
    typicalNeeds: ['VIT_D', 'OMEGA3'],
  },
  gulf_coast: {
    name: 'Gulf Coast',
    description: 'Wetlands, coastal ecosystems, agricultural runoff',
    typicalStress: ['NO3', 'P', 'BIO'],
    typicalNeeds: ['IRON', 'FIBER'],
  },
  pacific_northwest: {
    name: 'Pacific Northwest',
    description: 'Temperate rainforest, salmon habitat, logging impact',
    typicalStress: ['SOIL', 'BIO'],
    typicalNeeds: ['VIT_D', 'B12', 'OMEGA3'],
  },
  great_lakes: {
    name: 'Great Lakes',
    description: 'Freshwater ecosystems, industrial legacy',
    typicalStress: ['H2O', 'HEAVY_METAL', 'BIO'],
    typicalNeeds: ['OMEGA3', 'VIT_D'],
  },
  sonoran_desert: {
    name: 'Sonoran Desert',
    description: 'Arid ecosystem, water scarcity, unique biodiversity',
    typicalStress: ['H2O', 'SOIL'],
    typicalNeeds: ['IRON', 'VIT_D'],
  },
};

// =============================================================================
// HELPERS
// =============================================================================

function loadDeployment() {
  if (!fs.existsSync(deploymentPath)) {
    return { bioregions: [] };
  }
  const data = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
  if (!data.bioregions) {
    data.bioregions = [];
  }
  return data;
}

function saveDeployment(data) {
  fs.writeFileSync(deploymentPath, JSON.stringify(data, null, 2));
}

function generateId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function formatDate(timestamp) {
  return new Date(timestamp).toISOString().replace('T', ' ').substr(0, 19);
}

function getHealthStatus(value) {
  if (value >= HEALTHY_THRESHOLD) return { status: 'HEALTHY', color: 'green' };
  if (value >= WARNING_THRESHOLD) return { status: 'WARNING', color: 'yellow' };
  if (value >= STRESS_THRESHOLD) return { status: 'STRESSED', color: 'orange' };
  return { status: 'CRITICAL', color: 'red' };
}

function getStatusBar(value, width = 20) {
  const filled = Math.round((value / 100) * width);
  const empty = width - filled;
  return '[' + '#'.repeat(filled) + '-'.repeat(empty) + ']';
}

// =============================================================================
// COMMANDS
// =============================================================================

function showHelp() {
  console.log(`
=====================================================================================
                    UltraLife Protocol — Bioregion Registry

     "What we track is determined by what needs healing"

     Compound tracking priorities EMERGE from bioregion health data.
=====================================================================================

Usage: node bioregion.mjs [command] [options]

COMMANDS:

  --register                  Register a new bioregion
    --name <name>             Bioregion name (e.g., "Sierra Nevada")
    --id <id>                 Bioregion ID (e.g., sierra_nevada)
    --bounds <geojson>        Geographic bounds (optional JSON string)

  --list                      List all registered bioregions

  --show --bioregion <id>     Show bioregion details including health indices

  --update-health --bioregion <id>   Update bioregion health indices
    --soil <0-100>            Soil health index
    --water <0-100>           Water quality index
    --biodiversity <0-100>    Biodiversity index
    --air <0-100>             Air quality index
    --aquifer <0-100>         Aquifer level index

  --stress-analysis --bioregion <id>   Analyze what's stressed and recommend compounds
                                       Reads health indices and outputs priority compounds

  --compound-priorities --bioregion <id>   Show current compound priority list

  --update-priorities --bioregion <id>     Update compound priorities
    --add <compound>          Add compound to priority list
    --remove <compound>       Remove compound from priority list

  --list-templates            Show example bioregion templates

OPTIONS:
  --help                      Show this help message

HEALTH INDEX INPUTS:
  Soil organic matter, Water quality, Biodiversity counts, Air quality, Aquifer levels

EMERGENCE PRINCIPLE:
  - Stressed soil     -> prioritize SOIL, N, P tracking
  - Water stress      -> prioritize H2O, NO3, P tracking
  - Biodiversity loss -> prioritize BIO tracking
  - Air quality       -> prioritize CO2, NOx, CH4 tracking
  - Aquifer depletion -> prioritize groundwater compounds

  The system learns what to track based on what needs healing.
`);
}

function listTemplates() {
  console.log('\n=== Bioregion Templates ===\n');
  console.log('These are example bioregion profiles showing typical stress patterns:\n');

  for (const [id, template] of Object.entries(BIOREGION_TEMPLATES)) {
    console.log(`  ${id}`);
    console.log(`    Name: ${template.name}`);
    console.log(`    Description: ${template.description}`);
    console.log(`    Typical Stress: ${template.typicalStress.join(', ')}`);
    console.log(`    Population Needs: ${template.typicalNeeds.join(', ')}`);
    console.log('');
  }

  console.log('Register using: node bioregion.mjs --register --name "Sierra Nevada" --id sierra_nevada');
}

function registerBioregion(args, deployment) {
  const name = args.name;
  const id = args.id || (name ? generateId(name) : null);
  const bounds = args.bounds;

  if (!name) {
    console.error('Error: --name is required');
    return;
  }

  if (!id) {
    console.error('Error: --id is required (or will be generated from name)');
    return;
  }

  // Check if already exists
  const existing = deployment.bioregions.find(b => b.id === id);
  if (existing) {
    console.error(`Error: Bioregion '${id}' already exists`);
    return;
  }

  const now = Date.now();

  // Use template if available
  const template = BIOREGION_TEMPLATES[id];

  const bioregion = {
    id: id,
    name: name,
    bounds: bounds ? JSON.parse(bounds) : null,
    healthIndices: {
      soil: 50,
      water: 50,
      biodiversity: 50,
      air: 50,
      aquifer: 50,
    },
    stressedCompounds: template?.typicalStress || [],
    priorityCompounds: [...UNIVERSAL_COMPOUNDS, ...(template?.typicalStress || []), ...(template?.typicalNeeds || [])],
    populationNeeds: template?.typicalNeeds || [],
    lastHealthUpdate: null,
    registeredAt: now,
  };

  deployment.bioregions.push(bioregion);
  saveDeployment(deployment);

  console.log('\n=====================================================================================');
  console.log('                         BIOREGION REGISTERED                                       ');
  console.log('=====================================================================================\n');

  console.log(`  ID:            ${bioregion.id}`);
  console.log(`  Name:          ${bioregion.name}`);
  console.log(`  Registered:    ${formatDate(now)}`);

  console.log('\n  Initial Health Indices (default 50/100 - update with real data):');
  console.log(`    Soil:         ${bioregion.healthIndices.soil}`);
  console.log(`    Water:        ${bioregion.healthIndices.water}`);
  console.log(`    Biodiversity: ${bioregion.healthIndices.biodiversity}`);
  console.log(`    Air:          ${bioregion.healthIndices.air}`);
  console.log(`    Aquifer:      ${bioregion.healthIndices.aquifer}`);

  if (template) {
    console.log(`\n  Template applied: ${template.name}`);
    console.log(`  Typical Stress: ${template.typicalStress.join(', ')}`);
    console.log(`  Population Needs: ${template.typicalNeeds.join(', ')}`);
  }

  console.log('\n  Priority Compounds (initial):');
  console.log(`    ${bioregion.priorityCompounds.join(', ')}`);

  console.log('\n  Next steps:');
  console.log(`    Update health: node bioregion.mjs --update-health --bioregion ${id} --soil 70 --water 45`);
  console.log(`    Analyze stress: node bioregion.mjs --stress-analysis --bioregion ${id}`);
}

function listBioregions(deployment) {
  const bioregions = deployment.bioregions || [];

  console.log('\n=== Registered Bioregions ===\n');

  if (bioregions.length === 0) {
    console.log('  No bioregions registered yet.');
    console.log('  Register one: node bioregion.mjs --register --name "Sierra Nevada" --id sierra_nevada');
    return;
  }

  console.log('ID                    NAME                      HEALTH    STRESSED COMPOUNDS');
  console.log('-'.repeat(90));

  for (const b of bioregions) {
    const avgHealth = Math.round(
      (b.healthIndices.soil + b.healthIndices.water + b.healthIndices.biodiversity +
       b.healthIndices.air + b.healthIndices.aquifer) / 5
    );
    const { status } = getHealthStatus(avgHealth);
    const stressedStr = (b.stressedCompounds || []).slice(0, 4).join(', ') || '(none)';

    console.log(
      `${b.id.padEnd(21)} ${b.name.padEnd(25)} ${(avgHealth + '/100 ' + status).padEnd(17)} ${stressedStr}`
    );
  }

  console.log(`\nTotal: ${bioregions.length} bioregion(s)`);
}

function showBioregion(args, deployment) {
  const id = args.bioregion;

  if (!id) {
    console.error('Error: --bioregion <id> required');
    return;
  }

  const bioregion = deployment.bioregions?.find(b => b.id === id);

  if (!bioregion) {
    console.error(`Error: Bioregion '${id}' not found`);
    return;
  }

  const h = bioregion.healthIndices;
  const avgHealth = Math.round((h.soil + h.water + h.biodiversity + h.air + h.aquifer) / 5);

  console.log('\n=====================================================================================');
  console.log(`  BIOREGION: ${bioregion.name.toUpperCase().padEnd(56)}`);
  console.log('=====================================================================================\n');

  console.log(`  ID:            ${bioregion.id}`);
  console.log(`  Registered:    ${formatDate(bioregion.registeredAt)}`);
  if (bioregion.lastHealthUpdate) {
    console.log(`  Last Updated:  ${formatDate(bioregion.lastHealthUpdate)}`);
  }

  console.log('\n  === HEALTH INDICES ===\n');

  const indices = [
    { name: 'Soil', value: h.soil },
    { name: 'Water', value: h.water },
    { name: 'Biodiversity', value: h.biodiversity },
    { name: 'Air', value: h.air },
    { name: 'Aquifer', value: h.aquifer },
  ];

  for (const idx of indices) {
    const { status } = getHealthStatus(idx.value);
    const bar = getStatusBar(idx.value);
    console.log(`    ${idx.name.padEnd(14)} ${bar} ${idx.value}/100 (${status})`);
  }

  console.log(`\n    ${'OVERALL'.padEnd(14)} ${getStatusBar(avgHealth)} ${avgHealth}/100 (${getHealthStatus(avgHealth).status})`);

  console.log('\n  === STRESSED COMPOUNDS ===\n');
  if (bioregion.stressedCompounds && bioregion.stressedCompounds.length > 0) {
    console.log(`    ${bioregion.stressedCompounds.join(', ')}`);
  } else {
    console.log('    (none - bioregion is healthy)');
  }

  console.log('\n  === PRIORITY COMPOUNDS ===\n');
  if (bioregion.priorityCompounds && bioregion.priorityCompounds.length > 0) {
    console.log(`    Universal: ${UNIVERSAL_COMPOUNDS.join(', ')}`);
    const emergent = bioregion.priorityCompounds.filter(c => !UNIVERSAL_COMPOUNDS.includes(c));
    if (emergent.length > 0) {
      console.log(`    Emergent:  ${emergent.join(', ')}`);
    }
  } else {
    console.log(`    ${UNIVERSAL_COMPOUNDS.join(', ')} (universal only)`);
  }

  if (bioregion.populationNeeds && bioregion.populationNeeds.length > 0) {
    console.log('\n  === POPULATION NEEDS ===\n');
    console.log(`    ${bioregion.populationNeeds.join(', ')}`);
  }

  // Statistics from deployment
  const stats = deployment.bioregionStats?.[id];
  if (stats) {
    console.log('\n  === BIOREGION STATISTICS ===\n');
    console.log(`    Lands Registered:        ${stats.landsRegistered || 0}`);
    console.log(`    Total Land Area:         ${(stats.totalLandArea || 0).toLocaleString()} m2`);
    console.log(`    Sequestration Capacity:  ${(stats.totalSequestrationCapacity || 0).toFixed(2)} tCO2/year`);
  }

  const impact = deployment.bioregionImpact?.[id];
  if (impact) {
    console.log('\n  === ECONOMIC ACTIVITY ===\n');
    console.log(`    Total Transactions:      ${impact.totalTransactions}`);
    console.log(`    Total Volume:            ${impact.totalVolume} ULTRA`);
    console.log(`    Net Impact:              ${impact.netImpact.toFixed(2)}`);
  }
}

function updateHealth(args, deployment) {
  const id = args.bioregion;

  if (!id) {
    console.error('Error: --bioregion <id> required');
    return;
  }

  const bioregion = deployment.bioregions?.find(b => b.id === id);

  if (!bioregion) {
    console.error(`Error: Bioregion '${id}' not found`);
    return;
  }

  // Update any provided health indices
  const updates = {};
  let hasUpdates = false;

  for (const key of ['soil', 'water', 'biodiversity', 'air', 'aquifer']) {
    if (args[key] !== undefined) {
      const value = parseInt(args[key]);
      if (isNaN(value) || value < 0 || value > 100) {
        console.error(`Error: ${key} must be 0-100`);
        return;
      }
      updates[key] = value;
      hasUpdates = true;
    }
  }

  if (!hasUpdates) {
    console.error('Error: Provide at least one health index to update');
    console.error('  --soil <0-100>  --water <0-100>  --biodiversity <0-100>');
    console.error('  --air <0-100>   --aquifer <0-100>');
    return;
  }

  // Store old values for comparison
  const oldValues = { ...bioregion.healthIndices };

  // Apply updates
  for (const [key, value] of Object.entries(updates)) {
    bioregion.healthIndices[key] = value;
  }

  bioregion.lastHealthUpdate = Date.now();

  // Recalculate stressed compounds based on new health
  const newStressed = [];
  for (const [key, value] of Object.entries(bioregion.healthIndices)) {
    if (value < STRESS_THRESHOLD && STRESS_COMPOUND_MAP[key]) {
      newStressed.push(...STRESS_COMPOUND_MAP[key].primary);
    }
  }
  bioregion.stressedCompounds = [...new Set(newStressed)];

  // Update priority compounds (universal + stressed + population needs)
  bioregion.priorityCompounds = [
    ...UNIVERSAL_COMPOUNDS,
    ...bioregion.stressedCompounds,
    ...(bioregion.populationNeeds || []),
  ];
  bioregion.priorityCompounds = [...new Set(bioregion.priorityCompounds)];

  saveDeployment(deployment);

  console.log('\n=====================================================================================');
  console.log('                         HEALTH INDICES UPDATED                                     ');
  console.log('=====================================================================================\n');

  console.log(`  Bioregion: ${bioregion.name} (${bioregion.id})\n`);

  console.log('  Changes:');
  for (const [key, newValue] of Object.entries(updates)) {
    const oldValue = oldValues[key];
    const { status: oldStatus } = getHealthStatus(oldValue);
    const { status: newStatus } = getHealthStatus(newValue);
    const arrow = newValue > oldValue ? '+' : (newValue < oldValue ? '-' : '=');
    console.log(`    ${key.padEnd(14)} ${oldValue} -> ${newValue} (${oldStatus} -> ${newStatus}) ${arrow}`);
  }

  console.log('\n  Current Health Indices:');
  for (const [key, value] of Object.entries(bioregion.healthIndices)) {
    const { status } = getHealthStatus(value);
    console.log(`    ${key.padEnd(14)} ${getStatusBar(value)} ${value}/100 (${status})`);
  }

  if (bioregion.stressedCompounds.length > 0) {
    console.log('\n  Stressed Compounds (auto-updated):');
    console.log(`    ${bioregion.stressedCompounds.join(', ')}`);
  }

  console.log('\n  Run stress analysis: node bioregion.mjs --stress-analysis --bioregion ' + id);
}

function stressAnalysis(args, deployment) {
  const id = args.bioregion;

  if (!id) {
    console.error('Error: --bioregion <id> required');
    return;
  }

  const bioregion = deployment.bioregions?.find(b => b.id === id);

  if (!bioregion) {
    console.error(`Error: Bioregion '${id}' not found`);
    return;
  }

  const h = bioregion.healthIndices;

  console.log('\n=====================================================================================');
  console.log(`  STRESS ANALYSIS: ${bioregion.name.toUpperCase()}`);
  console.log('=====================================================================================\n');

  console.log('  "What we track is determined by what needs healing"\n');

  // Analyze each health index
  const stressAreas = [];
  const warningAreas = [];
  const healthyAreas = [];
  const recommendedCompounds = new Set(UNIVERSAL_COMPOUNDS);
  const secondaryCompounds = new Set();

  for (const [key, value] of Object.entries(h)) {
    const mapping = STRESS_COMPOUND_MAP[key];
    if (!mapping) continue;

    if (value < STRESS_THRESHOLD) {
      stressAreas.push({ key, value, mapping });
      mapping.primary.forEach(c => recommendedCompounds.add(c));
      mapping.secondary.forEach(c => secondaryCompounds.add(c));
    } else if (value < WARNING_THRESHOLD) {
      warningAreas.push({ key, value, mapping });
      mapping.primary.forEach(c => secondaryCompounds.add(c));
    } else {
      healthyAreas.push({ key, value });
    }
  }

  // Report stressed areas
  if (stressAreas.length > 0) {
    console.log('  CRITICAL STRESS (below 50):');
    console.log('  -'.repeat(40));
    for (const area of stressAreas) {
      console.log(`\n    ${area.key.toUpperCase()} (${area.value}/100)`);
      console.log(`    ${area.mapping.description}`);
      console.log(`    -> Primary compounds: ${area.mapping.primary.join(', ')}`);
      console.log(`    -> Secondary compounds: ${area.mapping.secondary.join(', ')}`);
    }
  }

  if (warningAreas.length > 0) {
    console.log('\n  WARNING AREAS (50-70):');
    console.log('  -'.repeat(40));
    for (const area of warningAreas) {
      console.log(`    ${area.key.toUpperCase()} (${area.value}/100) - ${area.mapping.description}`);
    }
  }

  if (healthyAreas.length > 0) {
    console.log('\n  HEALTHY AREAS (above 70):');
    console.log('  -'.repeat(40));
    for (const area of healthyAreas) {
      console.log(`    ${area.key.toUpperCase()} (${area.value}/100)`);
    }
  }

  // Compound recommendations
  console.log('\n  ===============================================');
  console.log('  COMPOUND TRACKING RECOMMENDATIONS');
  console.log('  ===============================================\n');

  console.log('  PRIORITY (always track):');
  console.log(`    ${[...recommendedCompounds].join(', ')}`);

  if (secondaryCompounds.size > 0) {
    const secondary = [...secondaryCompounds].filter(c => !recommendedCompounds.has(c));
    if (secondary.length > 0) {
      console.log('\n  SECONDARY (track when possible):');
      console.log(`    ${secondary.join(', ')}`);
    }
  }

  // Population health integration
  if (bioregion.populationNeeds && bioregion.populationNeeds.length > 0) {
    console.log('\n  POPULATION HEALTH NEEDS:');
    console.log(`    ${bioregion.populationNeeds.join(', ')}`);
  }

  // Summary recommendation
  const allPriority = [...new Set([...recommendedCompounds, ...(bioregion.populationNeeds || [])])];
  console.log('\n  ===============================================');
  console.log('  RECOMMENDED PRIORITY COMPOUND LIST');
  console.log('  ===============================================\n');
  console.log(`    ${allPriority.join(', ')}`);

  console.log('\n  Update priorities:');
  console.log(`    node bioregion.mjs --update-priorities --bioregion ${id} --add <compound>`);

  // Auto-update stressed compounds
  bioregion.stressedCompounds = stressAreas.flatMap(a => a.mapping.primary);
  saveDeployment(deployment);
}

function showCompoundPriorities(args, deployment) {
  const id = args.bioregion;

  if (!id) {
    console.error('Error: --bioregion <id> required');
    return;
  }

  const bioregion = deployment.bioregions?.find(b => b.id === id);

  if (!bioregion) {
    console.error(`Error: Bioregion '${id}' not found`);
    return;
  }

  console.log('\n=====================================================================================');
  console.log(`  COMPOUND PRIORITIES: ${bioregion.name.toUpperCase()}`);
  console.log('=====================================================================================\n');

  console.log('  UNIVERSAL (always tracked):');
  console.log(`    ${UNIVERSAL_COMPOUNDS.join(', ')}`);

  const stressed = bioregion.stressedCompounds || [];
  if (stressed.length > 0) {
    console.log('\n  STRESSED (from health indices):');
    console.log(`    ${stressed.join(', ')}`);
  }

  const popNeeds = bioregion.populationNeeds || [];
  if (popNeeds.length > 0) {
    console.log('\n  POPULATION NEEDS:');
    console.log(`    ${popNeeds.join(', ')}`);
  }

  const emergent = (bioregion.priorityCompounds || []).filter(c =>
    !UNIVERSAL_COMPOUNDS.includes(c) && !stressed.includes(c) && !popNeeds.includes(c)
  );
  if (emergent.length > 0) {
    console.log('\n  MANUALLY ADDED:');
    console.log(`    ${emergent.join(', ')}`);
  }

  console.log('\n  FULL PRIORITY LIST:');
  console.log(`    ${(bioregion.priorityCompounds || UNIVERSAL_COMPOUNDS).join(', ')}`);

  console.log('\n  Modify:');
  console.log(`    --add <compound>    Add to priority list`);
  console.log(`    --remove <compound> Remove from priority list`);
}

function updatePriorities(args, deployment) {
  const id = args.bioregion;
  const addCompound = args.add;
  const removeCompound = args.remove;

  if (!id) {
    console.error('Error: --bioregion <id> required');
    return;
  }

  if (!addCompound && !removeCompound) {
    console.error('Error: Specify --add <compound> or --remove <compound>');
    return;
  }

  const bioregion = deployment.bioregions?.find(b => b.id === id);

  if (!bioregion) {
    console.error(`Error: Bioregion '${id}' not found`);
    return;
  }

  if (!bioregion.priorityCompounds) {
    bioregion.priorityCompounds = [...UNIVERSAL_COMPOUNDS];
  }

  let action = '';

  if (addCompound) {
    const compound = addCompound.toUpperCase();
    if (bioregion.priorityCompounds.includes(compound)) {
      console.log(`  ${compound} is already in priority list`);
    } else {
      bioregion.priorityCompounds.push(compound);
      action = `Added ${compound}`;
    }
  }

  if (removeCompound) {
    const compound = removeCompound.toUpperCase();
    if (UNIVERSAL_COMPOUNDS.includes(compound)) {
      console.error(`Error: Cannot remove universal compound ${compound}`);
      return;
    }
    const idx = bioregion.priorityCompounds.indexOf(compound);
    if (idx === -1) {
      console.log(`  ${compound} is not in priority list`);
    } else {
      bioregion.priorityCompounds.splice(idx, 1);
      action = `Removed ${compound}`;
    }
  }

  if (action) {
    saveDeployment(deployment);

    console.log('\n=== Priority Compounds Updated ===\n');
    console.log(`  Bioregion: ${bioregion.name}`);
    console.log(`  Action: ${action}`);
    console.log(`\n  Current Priority List:`);
    console.log(`    ${bioregion.priorityCompounds.join(', ')}`);
  }
}

// =============================================================================
// MAIN
// =============================================================================

function main() {
  const args = parseArgs(process.argv.slice(2));
  const deployment = loadDeployment();

  if (args.help || Object.keys(args).length === 0) {
    showHelp();
    return;
  }

  if (args['list-templates']) {
    listTemplates();
    return;
  }

  if (args.register) {
    registerBioregion(args, deployment);
    return;
  }

  if (args.list) {
    listBioregions(deployment);
    return;
  }

  if (args.show && args.bioregion) {
    showBioregion(args, deployment);
    return;
  }

  if (args['update-health']) {
    updateHealth(args, deployment);
    return;
  }

  if (args['stress-analysis']) {
    stressAnalysis(args, deployment);
    return;
  }

  if (args['compound-priorities']) {
    showCompoundPriorities(args, deployment);
    return;
  }

  if (args['update-priorities']) {
    updatePriorities(args, deployment);
    return;
  }

  showHelp();
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

main();
