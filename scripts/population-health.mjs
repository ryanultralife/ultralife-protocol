#!/usr/bin/env node
/**
 * UltraLife Protocol — Population Health Tracking CLI
 *
 * Tracks population health indices for bioregions. Compound priorities EMERGE
 * from population health data - what we track is determined by what needs healing.
 *
 * From protocol-spec.json compound_emergence.health_indices.population_health_index:
 *   - Inputs: Blood test aggregates, deficiency prevalence, chronic disease rates
 *   - Output: Identifies which nutritional/health compounds are needed
 *   - Source: Anonymized clinic data, public health records, voluntary health sharing
 *
 * Usage:
 *   node population-health.mjs --report --bioregion sierra_nevada --deficiency IRON:15 --deficiency VIT_D:25 --sample-size 1000
 *   node population-health.mjs --show --bioregion sierra_nevada
 *   node population-health.mjs --deficiencies --bioregion sierra_nevada
 *   node population-health.mjs --chronic-conditions --bioregion sierra_nevada
 *   node population-health.mjs --compound-needs --bioregion sierra_nevada
 *   node population-health.mjs --trends --bioregion sierra_nevada
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const log = {
  info: (msg) => console.log(`[INFO]  ${msg}`),
  success: (msg) => console.log(`[OK]    ${msg}`),
  warn: (msg) => console.log(`[WARN]  ${msg}`),
  error: (msg) => console.log(`[ERROR] ${msg}`),
};

const CONFIG = {
  network: process.env.NETWORK || 'preprod',
  deploymentPath: path.join(__dirname, 'deployment.json'),
  protocolSpecPath: path.join(__dirname, '..', 'protocol-spec.json'),
};

// =============================================================================
// DEFICIENCY TO COMPOUND MAPPING
// =============================================================================
// Maps deficiencies to nutritional compounds that address them
// This is the core emergence mechanism: population health data reveals needed compounds

const DEFICIENCY_COMPOUND_MAP = {
  // Mineral deficiencies
  IRON: {
    name: 'Iron Deficiency',
    compounds: ['IRON', 'NEED_IRON'],
    description: 'Low iron levels - causes fatigue, weakness, impaired cognition',
    foodSources: ['Red meat', 'Organ meats', 'Legumes', 'Dark leafy greens'],
    severity: { low: 10, moderate: 20, high: 30 },
  },
  ZINC: {
    name: 'Zinc Deficiency',
    compounds: ['ZINC', 'NEED_ZINC'],
    description: 'Low zinc - impairs immunity, wound healing, taste/smell',
    foodSources: ['Oysters', 'Beef', 'Pumpkin seeds', 'Chickpeas'],
    severity: { low: 8, moderate: 15, high: 25 },
  },
  MG: {
    name: 'Magnesium Deficiency',
    compounds: ['MG'],
    description: 'Low magnesium - muscle cramps, anxiety, poor sleep',
    foodSources: ['Dark chocolate', 'Avocados', 'Nuts', 'Leafy greens'],
    severity: { low: 15, moderate: 30, high: 45 },
  },
  CA: {
    name: 'Calcium Deficiency',
    compounds: ['CA'],
    description: 'Low calcium - bone loss, muscle spasms, dental problems',
    foodSources: ['Dairy', 'Sardines', 'Leafy greens', 'Fortified foods'],
    severity: { low: 10, moderate: 20, high: 35 },
  },

  // Vitamin deficiencies
  B12: {
    name: 'Vitamin B12 Deficiency',
    compounds: ['B12', 'NEED_B12'],
    description: 'Low B12 - fatigue, nerve damage, cognitive decline',
    foodSources: ['Animal products', 'Eggs', 'Dairy', 'Fortified foods'],
    severity: { low: 5, moderate: 12, high: 20 },
  },
  VIT_D: {
    name: 'Vitamin D Deficiency',
    compounds: ['VIT_D'],
    description: 'Low vitamin D - bone weakness, depression, immune dysfunction',
    foodSources: ['Fatty fish', 'Egg yolks', 'Fortified foods', 'Sunlight exposure'],
    severity: { low: 20, moderate: 35, high: 50 },
  },
  VIT_A: {
    name: 'Vitamin A Deficiency',
    compounds: ['VIT_A'],
    description: 'Low vitamin A - vision problems, immune weakness, skin issues',
    foodSources: ['Liver', 'Sweet potato', 'Carrots', 'Leafy greens'],
    severity: { low: 5, moderate: 10, high: 20 },
  },

  // Macronutrient deficiencies
  PROT: {
    name: 'Protein Malnutrition',
    compounds: ['PROT', 'NEED_PROT'],
    description: 'Inadequate protein - muscle wasting, weakness, poor healing',
    foodSources: ['Meat', 'Fish', 'Eggs', 'Legumes', 'Dairy'],
    severity: { low: 5, moderate: 10, high: 15 },
  },
  OMEGA3: {
    name: 'Omega-3 Deficiency',
    compounds: ['OMEGA3'],
    description: 'Low omega-3 - inflammation, cognitive issues, heart risk',
    foodSources: ['Fatty fish', 'Walnuts', 'Flax seeds', 'Chia seeds'],
    severity: { low: 30, moderate: 50, high: 70 },
  },
  FIBER: {
    name: 'Fiber Deficiency',
    compounds: ['FIBER'],
    description: 'Low fiber - digestive issues, metabolic problems, gut dysbiosis',
    foodSources: ['Vegetables', 'Fruits', 'Whole grains', 'Legumes'],
    severity: { low: 40, moderate: 60, high: 80 },
  },

  // Gut health issues
  GUT: {
    name: 'Gut Health Issues',
    compounds: ['MICROBIOME', 'FERMENTED', 'FIBER'],
    description: 'Gut dysbiosis - digestive problems, immune issues, inflammation',
    foodSources: ['Fermented foods', 'Fiber-rich foods', 'Bone broth', 'Prebiotic foods'],
    severity: { low: 15, moderate: 25, high: 40 },
  },
  MICROBIOME: {
    name: 'Microbiome Disruption',
    compounds: ['MICROBIOME', 'FERMENTED'],
    description: 'Disrupted gut flora - inflammation, immune dysfunction, mood issues',
    foodSources: ['Yogurt', 'Kefir', 'Sauerkraut', 'Kimchi', 'Kombucha'],
    severity: { low: 20, moderate: 35, high: 50 },
  },
};

// =============================================================================
// CHRONIC CONDITIONS
// =============================================================================
// Chronic conditions and their associated nutritional factors

const CHRONIC_CONDITIONS = {
  diabetes: {
    name: 'Type 2 Diabetes',
    relatedCompounds: ['INSULIN_IMPACT', 'FIBER', 'MG', 'ADDED_SUGAR', 'PROC_FOOD'],
    nutritionalFactors: ['High processed food', 'Low fiber', 'Magnesium deficiency'],
  },
  autoimmune: {
    name: 'Autoimmune Conditions',
    relatedCompounds: ['AUTOIMMUNE_RISK', 'GLYPHOSATE', 'GUT_PERMEABILITY', 'INFLAM'],
    nutritionalFactors: ['Gut permeability', 'Glyphosate exposure', 'Chronic inflammation'],
  },
  cardiovascular: {
    name: 'Cardiovascular Disease',
    relatedCompounds: ['CARDIO_IMPACT', 'OMEGA3', 'INFLAM', 'SEED_OIL'],
    nutritionalFactors: ['Omega-3 deficiency', 'Chronic inflammation', 'Seed oil excess'],
  },
  obesity: {
    name: 'Obesity/Metabolic Syndrome',
    relatedCompounds: ['METABOLIC', 'PROC_FOOD', 'ADDED_SUGAR', 'SEED_OIL'],
    nutritionalFactors: ['Ultra-processed food', 'Added sugars', 'Seed oil excess'],
  },
  depression: {
    name: 'Depression/Anxiety',
    relatedCompounds: ['NEURO_IMPACT', 'OMEGA3', 'VIT_D', 'B12', 'MG'],
    nutritionalFactors: ['Omega-3 deficiency', 'Vitamin D deficiency', 'B12 deficiency'],
  },
  osteoporosis: {
    name: 'Osteoporosis',
    relatedCompounds: ['CA', 'VIT_D', 'MG', 'PROT'],
    nutritionalFactors: ['Calcium deficiency', 'Vitamin D deficiency', 'Low protein'],
  },
  ibs: {
    name: 'Irritable Bowel Syndrome',
    relatedCompounds: ['MICROBIOME', 'FIBER', 'GUT_PERMEABILITY', 'GLYPHOSATE'],
    nutritionalFactors: ['Gut dysbiosis', 'Low fiber', 'Glyphosate exposure'],
  },
  thyroid: {
    name: 'Thyroid Disorders',
    relatedCompounds: ['ZINC', 'IRON', 'VIT_D', 'GLYPHOSATE'],
    nutritionalFactors: ['Zinc deficiency', 'Iron deficiency', 'Endocrine disruptors'],
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateId(prefix) {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(6).toString('hex');
  return `${prefix}_${timestamp}_${random}`;
}

function getCurrentSlot() {
  // Approximate preprod slot
  return Math.floor(Date.now() / 1000) - 1654041600;
}

function formatDate(isoDate) {
  return new Date(isoDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeAgo(isoDate) {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
  return `${Math.floor(diffDays / 365)} years ago`;
}

function getSeverityLevel(prevalence, thresholds) {
  if (prevalence >= thresholds.high) return 'HIGH';
  if (prevalence >= thresholds.moderate) return 'MODERATE';
  if (prevalence >= thresholds.low) return 'LOW';
  return 'MINIMAL';
}

function getSeverityColor(level) {
  switch (level) {
    case 'HIGH': return '[!!!]';
    case 'MODERATE': return '[!! ]';
    case 'LOW': return '[!  ]';
    default: return '[   ]';
  }
}

// =============================================================================
// AGGREGATION FUNCTIONS
// =============================================================================

function aggregateReports(reports) {
  if (!reports || reports.length === 0) {
    return {
      deficiencies: {},
      chronicConditions: {},
      totalSampleSize: 0,
      reportCount: 0,
    };
  }

  // Weight by sample size
  let totalSampleSize = 0;
  const weightedDeficiencies = {};
  const weightedConditions = {};

  for (const report of reports) {
    const weight = report.sampleSize || 100;
    totalSampleSize += weight;

    // Aggregate deficiencies
    for (const [compound, prevalence] of Object.entries(report.deficiencies || {})) {
      if (!weightedDeficiencies[compound]) {
        weightedDeficiencies[compound] = { sum: 0, weight: 0 };
      }
      weightedDeficiencies[compound].sum += prevalence * weight;
      weightedDeficiencies[compound].weight += weight;
    }

    // Aggregate chronic conditions
    for (const [condition, prevalence] of Object.entries(report.chronicConditions || {})) {
      if (!weightedConditions[condition]) {
        weightedConditions[condition] = { sum: 0, weight: 0 };
      }
      weightedConditions[condition].sum += prevalence * weight;
      weightedConditions[condition].weight += weight;
    }
  }

  // Calculate weighted averages
  const deficiencies = {};
  for (const [compound, data] of Object.entries(weightedDeficiencies)) {
    deficiencies[compound] = Math.round((data.sum / data.weight) * 10) / 10;
  }

  const chronicConditions = {};
  for (const [condition, data] of Object.entries(weightedConditions)) {
    chronicConditions[condition] = Math.round((data.sum / data.weight) * 10) / 10;
  }

  return {
    deficiencies,
    chronicConditions,
    totalSampleSize,
    reportCount: reports.length,
  };
}

function calculateNeededCompounds(deficiencies, chronicConditions) {
  const neededCompounds = new Map();

  // From deficiencies
  for (const [deficiency, prevalence] of Object.entries(deficiencies)) {
    const mapping = DEFICIENCY_COMPOUND_MAP[deficiency];
    if (mapping) {
      for (const compound of mapping.compounds) {
        const current = neededCompounds.get(compound) || { score: 0, sources: [] };
        current.score += prevalence;
        current.sources.push({ type: 'deficiency', name: deficiency, prevalence });
        neededCompounds.set(compound, current);
      }
    }
  }

  // From chronic conditions
  for (const [condition, prevalence] of Object.entries(chronicConditions)) {
    const condInfo = CHRONIC_CONDITIONS[condition];
    if (condInfo) {
      for (const compound of condInfo.relatedCompounds) {
        const current = neededCompounds.get(compound) || { score: 0, sources: [] };
        current.score += prevalence * 0.5; // Weight conditions lower than direct deficiencies
        current.sources.push({ type: 'condition', name: condition, prevalence });
        neededCompounds.set(compound, current);
      }
    }
  }

  // Sort by score and return
  return Array.from(neededCompounds.entries())
    .map(([compound, data]) => ({
      compound,
      score: Math.round(data.score * 10) / 10,
      sources: data.sources,
    }))
    .sort((a, b) => b.score - a.score);
}

function calculateTrend(reports) {
  if (!reports || reports.length < 2) return null;

  // Sort by timestamp
  const sorted = [...reports].sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Compare latest vs earlier
  const midpoint = Math.floor(sorted.length / 2);
  const earlier = sorted.slice(0, midpoint);
  const later = sorted.slice(midpoint);

  const earlierAgg = aggregateReports(earlier);
  const laterAgg = aggregateReports(later);

  const trends = {};

  // Calculate deficiency trends
  const allDeficiencies = new Set([
    ...Object.keys(earlierAgg.deficiencies),
    ...Object.keys(laterAgg.deficiencies),
  ]);

  for (const deficiency of allDeficiencies) {
    const earlierVal = earlierAgg.deficiencies[deficiency] || 0;
    const laterVal = laterAgg.deficiencies[deficiency] || 0;
    const change = laterVal - earlierVal;
    trends[deficiency] = {
      earlier: earlierVal,
      later: laterVal,
      change,
      direction: change > 1 ? 'WORSENING' : change < -1 ? 'IMPROVING' : 'STABLE',
    };
  }

  return {
    deficiencyTrends: trends,
    periodStart: sorted[0].timestamp,
    periodEnd: sorted[sorted.length - 1].timestamp,
    reportCount: sorted.length,
  };
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  console.log(`
===============================================================================
        UltraLife Protocol — Population Health Tracking

        Compound priorities EMERGE from population health data
===============================================================================
`);

  const args = process.argv.slice(2);

  // Command flags
  const reportIdx = args.indexOf('--report');
  const showIdx = args.indexOf('--show');
  const deficienciesIdx = args.indexOf('--deficiencies');
  const chronicIdx = args.indexOf('--chronic-conditions');
  const compoundNeedsIdx = args.indexOf('--compound-needs');
  const trendsIdx = args.indexOf('--trends');
  const helpIdx = args.indexOf('--help');
  const listBioregionsIdx = args.indexOf('--list-bioregions');

  // Parameter flags
  const bioregionIdx = args.indexOf('--bioregion');
  const deficiencyFlags = args.reduce((acc, arg, i) => {
    if (arg === '--deficiency' && args[i + 1]) {
      acc.push(args[i + 1]);
    }
    return acc;
  }, []);
  const chronicFlags = args.reduce((acc, arg, i) => {
    if (arg === '--chronic' && args[i + 1]) {
      acc.push(args[i + 1]);
    }
    return acc;
  }, []);
  const sampleSizeIdx = args.indexOf('--sample-size');
  const sourceIdx = args.indexOf('--source');
  const noteIdx = args.indexOf('--note');

  const { atomicWriteSync, safeReadJson } = await import('./utils.mjs');

  // Load deployment state
  const deployment = safeReadJson(CONFIG.deploymentPath, {});
  deployment.populationHealth = deployment.populationHealth || {};

  // Show help
  if (helpIdx >= 0 || args.length === 0) {
    showHelp();
    return;
  }

  // List bioregions
  if (listBioregionsIdx >= 0) {
    const bioregions = Object.keys(deployment.populationHealth);
    if (bioregions.length === 0) {
      log.info('No bioregions have population health data yet.');
      log.info('Report data: npm run pop:report -- --bioregion <id> --deficiency IRON:15');
    } else {
      console.log(`
Bioregions with population health data:
`);
      for (const bioregion of bioregions) {
        const data = deployment.populationHealth[bioregion];
        const reportCount = data.reports?.length || 0;
        const lastUpdate = data.aggregated?.lastUpdated
          ? formatTimeAgo(data.aggregated.lastUpdated)
          : 'never';
        console.log(`  ${bioregion.padEnd(20)} ${reportCount} reports, last updated ${lastUpdate}`);
      }
    }
    return;
  }

  // Get bioregion for commands that need it
  const bioregion = bioregionIdx >= 0 ? args[bioregionIdx + 1] : null;

  // ==========================================================================
  // COMMAND: --report
  // ==========================================================================
  if (reportIdx >= 0) {
    if (!bioregion) {
      log.error('Missing --bioregion <id>');
      log.info('Example: npm run pop:report -- --bioregion sierra_nevada --deficiency IRON:15');
      process.exit(1);
    }

    if (deficiencyFlags.length === 0 && chronicFlags.length === 0) {
      log.error('No health data provided.');
      log.info('Use --deficiency <COMPOUND>:<prevalence%> to report deficiency rates');
      log.info('Use --chronic <condition>:<prevalence%> to report chronic condition rates');
      log.info('');
      log.info('Example:');
      log.info('  npm run pop:report -- --bioregion sierra_nevada \\');
      log.info('    --deficiency IRON:15 --deficiency VIT_D:25 \\');
      log.info('    --chronic diabetes:12 --sample-size 1000');
      process.exit(1);
    }

    // Parse deficiencies
    const deficiencies = {};
    for (const flag of deficiencyFlags) {
      const [compound, prevalenceStr] = flag.split(':');
      const prevalence = parseFloat(prevalenceStr);
      if (!compound || isNaN(prevalence) || prevalence < 0 || prevalence > 100) {
        log.warn(`Invalid deficiency format: ${flag} (expected COMPOUND:prevalence%)`);
        continue;
      }
      deficiencies[compound.toUpperCase()] = prevalence;
    }

    // Parse chronic conditions
    const chronicConditions = {};
    for (const flag of chronicFlags) {
      const [condition, prevalenceStr] = flag.split(':');
      const prevalence = parseFloat(prevalenceStr);
      if (!condition || isNaN(prevalence) || prevalence < 0 || prevalence > 100) {
        log.warn(`Invalid chronic condition format: ${flag} (expected condition:prevalence%)`);
        continue;
      }
      chronicConditions[condition.toLowerCase()] = prevalence;
    }

    const sampleSize = sampleSizeIdx >= 0 ? parseInt(args[sampleSizeIdx + 1]) || 100 : 100;
    const source = sourceIdx >= 0 ? args[sourceIdx + 1] : 'anonymous_clinic_data';
    const note = noteIdx >= 0 ? args[noteIdx + 1] : '';

    // Initialize bioregion data if needed
    if (!deployment.populationHealth[bioregion]) {
      deployment.populationHealth[bioregion] = {
        bioregionId: bioregion,
        reports: [],
        aggregated: null,
      };
    }

    // Create report
    const reportId = generateId('healthreport');
    const report = {
      reportId,
      timestamp: new Date().toISOString(),
      slot: getCurrentSlot(),
      sampleSize,
      source,
      note,
      deficiencies,
      chronicConditions,
      testnetSimulated: true,
    };

    deployment.populationHealth[bioregion].reports.push(report);

    // Recalculate aggregated data
    const allReports = deployment.populationHealth[bioregion].reports;
    const aggregated = aggregateReports(allReports);
    const neededCompounds = calculateNeededCompounds(
      aggregated.deficiencies,
      aggregated.chronicConditions
    );

    deployment.populationHealth[bioregion].aggregated = {
      topDeficiencies: Object.entries(aggregated.deficiencies)
        .map(([compound, prevalence]) => ({ compound, prevalence }))
        .sort((a, b) => b.prevalence - a.prevalence),
      topConditions: Object.entries(aggregated.chronicConditions)
        .map(([condition, prevalence]) => ({ condition, prevalence }))
        .sort((a, b) => b.prevalence - a.prevalence),
      neededCompounds: neededCompounds.map(c => c.compound),
      neededCompoundsDetail: neededCompounds,
      totalSampleSize: aggregated.totalSampleSize,
      reportCount: aggregated.reportCount,
      lastUpdated: new Date().toISOString(),
    };

    atomicWriteSync(CONFIG.deploymentPath, deployment);

    console.log(`
===============================================================================
                     POPULATION HEALTH REPORT SUBMITTED
===============================================================================
  Report ID:        ${reportId}
  Bioregion:        ${bioregion}
  Sample Size:      ${sampleSize}
  Source:           ${source}
-------------------------------------------------------------------------------
  DEFICIENCIES REPORTED:`);

    for (const [compound, prevalence] of Object.entries(deficiencies)) {
      const mapping = DEFICIENCY_COMPOUND_MAP[compound];
      const name = mapping?.name || compound;
      console.log(`    ${name.padEnd(30)} ${prevalence}%`);
    }

    if (Object.keys(chronicConditions).length > 0) {
      console.log(`
  CHRONIC CONDITIONS REPORTED:`);
      for (const [condition, prevalence] of Object.entries(chronicConditions)) {
        const info = CHRONIC_CONDITIONS[condition];
        const name = info?.name || condition;
        console.log(`    ${name.padEnd(30)} ${prevalence}%`);
      }
    }

    console.log(`
-------------------------------------------------------------------------------
  This data contributes to bioregion compound priority emergence.
  View aggregated data: npm run pop:show -- --bioregion ${bioregion}
===============================================================================
`);
    return;
  }

  // ==========================================================================
  // COMMAND: --show
  // ==========================================================================
  if (showIdx >= 0) {
    if (!bioregion) {
      log.error('Missing --bioregion <id>');
      log.info('List bioregions: npm run pop:report -- --list-bioregions');
      process.exit(1);
    }

    const data = deployment.populationHealth[bioregion];
    if (!data || !data.aggregated) {
      log.info(`No population health data for bioregion: ${bioregion}`);
      log.info('Report data: npm run pop:report -- --bioregion ' + bioregion + ' --deficiency IRON:15');
      return;
    }

    const agg = data.aggregated;

    console.log(`
===============================================================================
                     POPULATION HEALTH INDEX: ${bioregion.toUpperCase()}
===============================================================================
  Total sample size:  ${agg.totalSampleSize.toLocaleString()} people
  Reports submitted:  ${agg.reportCount}
  Last updated:       ${formatDate(agg.lastUpdated)}
-------------------------------------------------------------------------------

TOP DEFICIENCIES:
  COMPOUND                  PREVALENCE   SEVERITY    PRIORITY COMPOUNDS
  ------------------------  ----------   --------    ------------------`);

    for (const item of agg.topDeficiencies.slice(0, 10)) {
      const mapping = DEFICIENCY_COMPOUND_MAP[item.compound];
      const name = (mapping?.name || item.compound).slice(0, 24).padEnd(24);
      const prevalence = `${item.prevalence}%`.padEnd(10);
      const severity = mapping
        ? getSeverityColor(getSeverityLevel(item.prevalence, mapping.severity))
        : '[   ]';
      const compounds = mapping?.compounds.join(', ') || item.compound;
      console.log(`  ${name}  ${prevalence}   ${severity}       ${compounds}`);
    }

    if (agg.topConditions.length > 0) {
      console.log(`
TOP CHRONIC CONDITIONS:
  CONDITION                 PREVALENCE   RELATED COMPOUNDS
  ------------------------  ----------   ------------------`);

      for (const item of agg.topConditions.slice(0, 8)) {
        const info = CHRONIC_CONDITIONS[item.condition];
        const name = (info?.name || item.condition).slice(0, 24).padEnd(24);
        const prevalence = `${item.prevalence}%`.padEnd(10);
        const compounds = info?.relatedCompounds.slice(0, 4).join(', ') || '-';
        console.log(`  ${name}  ${prevalence}   ${compounds}`);
      }
    }

    console.log(`
-------------------------------------------------------------------------------
EMERGED PRIORITY COMPOUNDS (top 10):
  ${agg.neededCompounds.slice(0, 10).join(', ')}
-------------------------------------------------------------------------------

  View deficiency details: npm run pop:deficiencies -- --bioregion ${bioregion}
  View compound needs:     npm run pop:needs -- --bioregion ${bioregion}
  View health trends:      npm run pop:trends -- --bioregion ${bioregion}
===============================================================================
`);
    return;
  }

  // ==========================================================================
  // COMMAND: --deficiencies
  // ==========================================================================
  if (deficienciesIdx >= 0) {
    if (!bioregion) {
      log.error('Missing --bioregion <id>');
      process.exit(1);
    }

    const data = deployment.populationHealth[bioregion];
    if (!data || !data.aggregated) {
      log.info(`No population health data for bioregion: ${bioregion}`);
      return;
    }

    console.log(`
===============================================================================
                     DEFICIENCY PREVALENCE: ${bioregion.toUpperCase()}
===============================================================================
`);

    for (const item of data.aggregated.topDeficiencies) {
      const mapping = DEFICIENCY_COMPOUND_MAP[item.compound];
      const severity = mapping
        ? getSeverityLevel(item.prevalence, mapping.severity)
        : 'UNKNOWN';

      console.log(`  ${item.compound} - ${mapping?.name || 'Unknown Deficiency'}`);
      console.log(`    Prevalence:   ${item.prevalence}%`);
      console.log(`    Severity:     ${severity}`);
      if (mapping) {
        console.log(`    Description:  ${mapping.description}`);
        console.log(`    Compounds:    ${mapping.compounds.join(', ')}`);
        console.log(`    Food sources: ${mapping.foodSources.join(', ')}`);
      }
      console.log('');
    }

    console.log(`===============================================================================
`);
    return;
  }

  // ==========================================================================
  // COMMAND: --chronic-conditions
  // ==========================================================================
  if (chronicIdx >= 0) {
    if (!bioregion) {
      log.error('Missing --bioregion <id>');
      process.exit(1);
    }

    const data = deployment.populationHealth[bioregion];
    if (!data || !data.aggregated) {
      log.info(`No population health data for bioregion: ${bioregion}`);
      return;
    }

    console.log(`
===============================================================================
                     CHRONIC CONDITIONS: ${bioregion.toUpperCase()}
===============================================================================
`);

    if (data.aggregated.topConditions.length === 0) {
      log.info('No chronic condition data reported yet.');
      log.info('Report data: npm run pop:report -- --bioregion ' + bioregion + ' --chronic diabetes:12');
    } else {
      for (const item of data.aggregated.topConditions) {
        const info = CHRONIC_CONDITIONS[item.condition];
        console.log(`  ${item.condition.toUpperCase()} - ${info?.name || 'Unknown Condition'}`);
        console.log(`    Prevalence:         ${item.prevalence}%`);
        if (info) {
          console.log(`    Related compounds:  ${info.relatedCompounds.join(', ')}`);
          console.log(`    Nutritional factors:`);
          for (const factor of info.nutritionalFactors) {
            console.log(`      - ${factor}`);
          }
        }
        console.log('');
      }
    }

    console.log(`===============================================================================
`);
    return;
  }

  // ==========================================================================
  // COMMAND: --compound-needs
  // ==========================================================================
  if (compoundNeedsIdx >= 0) {
    if (!bioregion) {
      log.error('Missing --bioregion <id>');
      process.exit(1);
    }

    const data = deployment.populationHealth[bioregion];
    if (!data || !data.aggregated) {
      log.info(`No population health data for bioregion: ${bioregion}`);
      return;
    }

    const detail = data.aggregated.neededCompoundsDetail || [];

    console.log(`
===============================================================================
            EMERGED COMPOUND NEEDS: ${bioregion.toUpperCase()}
===============================================================================
  These compounds emerged as priorities based on population health data.
  The system learns what to track from what needs healing.
-------------------------------------------------------------------------------

  COMPOUND        PRIORITY    SOURCES
                  SCORE
  -------------   --------    ----------------------------------------`);

    for (const item of detail.slice(0, 15)) {
      const compound = item.compound.padEnd(13);
      const score = String(item.score).padEnd(8);
      const sources = item.sources
        .map(s => `${s.name}(${s.prevalence}%)`)
        .slice(0, 3)
        .join(', ');
      console.log(`  ${compound}   ${score}    ${sources}`);
    }

    console.log(`
-------------------------------------------------------------------------------
RECOMMENDATION: Track these compounds in bioregion transactions

For food/product transactions in ${bioregion}, prioritize measuring:
  1. ${detail[0]?.compound || 'N/A'} - highest need
  2. ${detail[1]?.compound || 'N/A'}
  3. ${detail[2]?.compound || 'N/A'}
  4. ${detail[3]?.compound || 'N/A'}
  5. ${detail[4]?.compound || 'N/A'}

Products that deliver these compounds address documented population needs.
===============================================================================
`);
    return;
  }

  // ==========================================================================
  // COMMAND: --trends
  // ==========================================================================
  if (trendsIdx >= 0) {
    if (!bioregion) {
      log.error('Missing --bioregion <id>');
      process.exit(1);
    }

    const data = deployment.populationHealth[bioregion];
    if (!data || !data.reports || data.reports.length < 2) {
      log.info(`Need at least 2 reports to show trends for bioregion: ${bioregion}`);
      log.info(`Current reports: ${data?.reports?.length || 0}`);
      return;
    }

    const trends = calculateTrend(data.reports);

    console.log(`
===============================================================================
                     HEALTH TRENDS: ${bioregion.toUpperCase()}
===============================================================================
  Period:         ${formatDate(trends.periodStart)} to ${formatDate(trends.periodEnd)}
  Reports:        ${trends.reportCount}
-------------------------------------------------------------------------------

DEFICIENCY TRENDS:
  DEFICIENCY                EARLIER    LATER      CHANGE    DIRECTION
  ------------------------  --------   --------   --------  ----------`);

    const sortedTrends = Object.entries(trends.deficiencyTrends)
      .sort((a, b) => Math.abs(b[1].change) - Math.abs(a[1].change));

    for (const [deficiency, trend] of sortedTrends) {
      const mapping = DEFICIENCY_COMPOUND_MAP[deficiency];
      const name = (mapping?.name || deficiency).slice(0, 24).padEnd(24);
      const earlier = `${trend.earlier}%`.padEnd(8);
      const later = `${trend.later}%`.padEnd(8);
      const change = (trend.change > 0 ? '+' : '') + `${trend.change}%`.padEnd(8);
      const arrow = trend.direction === 'IMPROVING' ? '[+++]'
        : trend.direction === 'WORSENING' ? '[---]'
        : '[   ]';
      console.log(`  ${name}  ${earlier}   ${later}   ${change}  ${arrow} ${trend.direction}`);
    }

    // Summary
    const improving = sortedTrends.filter(([_, t]) => t.direction === 'IMPROVING').length;
    const worsening = sortedTrends.filter(([_, t]) => t.direction === 'WORSENING').length;
    const stable = sortedTrends.filter(([_, t]) => t.direction === 'STABLE').length;

    console.log(`
-------------------------------------------------------------------------------
SUMMARY:
  Improving:      ${improving} deficiencies
  Stable:         ${stable} deficiencies
  Worsening:      ${worsening} deficiencies
-------------------------------------------------------------------------------

Note: Trends require ongoing data reporting to be meaningful.
Continue reporting: npm run pop:report -- --bioregion ${bioregion} --deficiency ...
===============================================================================
`);
    return;
  }

  // Default: show help
  showHelp();
}

// =============================================================================
// HELP
// =============================================================================

function showHelp() {
  console.log(`
Usage: node population-health.mjs [command] [options]

COMMANDS:
  --report              Submit population health data for a bioregion
  --show                Show population health indices for a bioregion
  --deficiencies        List top deficiencies and their details
  --chronic-conditions  List chronic condition prevalence
  --compound-needs      Analyze deficiencies and output needed compounds
  --trends              Show health trends over time (improving/declining)
  --list-bioregions     List bioregions with health data

OPTIONS:
  --bioregion <id>              Bioregion identifier (required for most commands)
  --deficiency <COMPOUND:pct>   Report deficiency prevalence (repeatable)
  --chronic <condition:pct>     Report chronic condition prevalence (repeatable)
  --sample-size <n>             Number of people in sample (default: 100)
  --source <name>               Data source identifier
  --note <text>                 Additional notes

DEFICIENCY COMPOUNDS:
  IRON      Iron deficiency (fatigue, weakness)
  B12       Vitamin B12 deficiency (nerve damage, fatigue)
  VIT_D     Vitamin D deficiency (bone weakness, depression)
  VIT_A     Vitamin A deficiency (vision, immunity)
  ZINC      Zinc deficiency (immunity, healing)
  MG        Magnesium deficiency (cramps, anxiety)
  CA        Calcium deficiency (bone loss)
  PROT      Protein malnutrition
  OMEGA3    Omega-3 deficiency (inflammation)
  FIBER     Fiber deficiency (digestive issues)
  GUT       Gut health issues (dysbiosis)
  MICROBIOME  Microbiome disruption

CHRONIC CONDITIONS:
  diabetes        Type 2 Diabetes
  autoimmune      Autoimmune Conditions
  cardiovascular  Cardiovascular Disease
  obesity         Obesity/Metabolic Syndrome
  depression      Depression/Anxiety
  osteoporosis    Osteoporosis
  ibs             Irritable Bowel Syndrome
  thyroid         Thyroid Disorders

EXAMPLES:
  # Report deficiency data for a bioregion
  npm run pop:report -- --bioregion sierra_nevada \\
    --deficiency IRON:15 --deficiency VIT_D:25 --deficiency B12:8 \\
    --chronic diabetes:12 --sample-size 1000

  # Show population health index
  npm run pop:show -- --bioregion sierra_nevada

  # List deficiencies with details
  npm run pop:deficiencies -- --bioregion sierra_nevada

  # See which compounds are needed based on health data
  npm run pop:needs -- --bioregion sierra_nevada

  # View health trends over time
  npm run pop:trends -- --bioregion sierra_nevada

EMERGENCE PRINCIPLE:
  Compound priorities emerge from population health data. This system doesn't
  preset which compounds matter - it discovers what's needed by analyzing
  health indices. What we track is determined by what needs healing.
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
