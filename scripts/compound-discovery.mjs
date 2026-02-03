#!/usr/bin/env node
/**
 * UltraLife Protocol - Compound Discovery Engine
 *
 * RECURSIVE DISCOVERY ENGINE - correlates transaction data with health indices
 * to discover which compounds actually matter.
 *
 * Key insight: "The data teaches us what matters - we don't have to know in advance"
 *
 * Usage:
 *   node compound-discovery.mjs --analyze --bioregion <id>
 *   node compound-discovery.mjs --correlate --bioregion <id>
 *   node compound-discovery.mjs --gaps --bioregion <id>
 *   node compound-discovery.mjs --propose --bioregion <id>
 *   node compound-discovery.mjs --apply --bioregion <id>
 *   node compound-discovery.mjs --history --bioregion <id>
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import { atomicWriteSync, safeReadJson } from './utils.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  deploymentPath: path.join(__dirname, 'deployment.json'),
  protocolSpecPath: path.join(__dirname, '..', 'protocol-spec.json'),
};

// Default bioregion health profiles (simulated)
const DEFAULT_BIOREGION_HEALTH = {
  sierra_nevada: {
    water_index: 45,      // Drought stress
    soil_index: 70,
    biodiversity_index: 60,  // Fire impact
    air_quality_index: 75,
    aquifer_level: 40,    // Low
    stressors: ['H2O', 'BIO', 'SOIL'],
  },
  pacific_northwest: {
    water_index: 85,
    soil_index: 55,       // Logging impact
    biodiversity_index: 65,
    air_quality_index: 80,
    aquifer_level: 75,
    stressors: ['SOIL', 'BIO'],
  },
  gulf_coast: {
    water_index: 70,
    soil_index: 60,
    biodiversity_index: 50,  // Wetland loss
    air_quality_index: 65,
    aquifer_level: 60,
    no3_runoff: 85,       // High agricultural runoff
    p_runoff: 80,
    stressors: ['NO3', 'P', 'BIO'],
  },
  great_lakes: {
    water_index: 65,
    soil_index: 70,
    biodiversity_index: 70,
    air_quality_index: 60,
    aquifer_level: 80,
    stressors: ['CO2', 'NOx'],
  },
  sonoran_desert: {
    water_index: 25,      // Extreme water stress
    soil_index: 55,
    biodiversity_index: 75,
    air_quality_index: 85,
    aquifer_level: 20,
    stressors: ['H2O'],
  },
};

// Default population health profiles (simulated)
const DEFAULT_POPULATION_HEALTH = {
  sierra_nevada: {
    iron_deficiency: 12,       // % of population
    b12_deficiency: 8,
    vitamin_d_deficiency: 25,  // Mountain communities
    protein_deficiency: 3,
    zinc_deficiency: 6,
    chronic_disease_rate: 15,
    metabolic_syndrome: 18,
    needs: ['VIT_D', 'IRON', 'B12'],
  },
  pacific_northwest: {
    iron_deficiency: 9,
    b12_deficiency: 15,        // Higher plant-based diet
    vitamin_d_deficiency: 35,  // Low sunlight
    protein_deficiency: 5,
    zinc_deficiency: 10,
    chronic_disease_rate: 12,
    metabolic_syndrome: 14,
    needs: ['VIT_D', 'B12', 'ZINC'],
  },
  gulf_coast: {
    iron_deficiency: 18,       // Regional pattern
    b12_deficiency: 7,
    vitamin_d_deficiency: 15,
    protein_deficiency: 4,
    zinc_deficiency: 5,
    fiber_deficiency: 40,      // Diet patterns
    chronic_disease_rate: 22,
    metabolic_syndrome: 28,
    needs: ['IRON', 'FIBER', 'OMEGA3'],
  },
  great_lakes: {
    iron_deficiency: 10,
    b12_deficiency: 6,
    vitamin_d_deficiency: 30,
    protein_deficiency: 2,
    zinc_deficiency: 7,
    chronic_disease_rate: 18,
    metabolic_syndrome: 20,
    needs: ['VIT_D', 'OMEGA3'],
  },
  sonoran_desert: {
    iron_deficiency: 8,
    b12_deficiency: 5,
    vitamin_d_deficiency: 8,   // Lots of sun
    protein_deficiency: 6,
    zinc_deficiency: 9,
    chronic_disease_rate: 16,
    metabolic_syndrome: 22,
    needs: ['H2O', 'PROT', 'ZINC'],
  },
};

// Universal compounds always tracked
const UNIVERSAL_COMPOUNDS = ['CO2', 'H2O', 'KCAL'];

// Compound categories for discovery
const COMPOUND_CATEGORIES = {
  environmental: ['CO2', 'CH4', 'H2O', 'N', 'NO3', 'NH3', 'NOx', 'P', 'BIO', 'SOIL', 'KWH'],
  nutritional: ['PROT', 'FAT', 'CARB', 'FIBER', 'B12', 'IRON', 'ZINC', 'OMEGA3', 'OMEGA6', 'VIT_D', 'VIT_A', 'CA', 'MG', 'K', 'NA', 'KCAL'],
  health: ['NEED_PROT', 'NEED_B12', 'NEED_IRON', 'NEED_ZINC', 'EXCESS'],
  health_root_cause: ['GLYPHOSATE', 'PESTICIDE', 'PROC_FOOD', 'SEED_OIL', 'ADDED_SUGAR', 'MICROBIOME', 'ANTIBIOTIC', 'HORMONE', 'HEAVY_METAL', 'INFLAM'],
  food_as_medicine: ['WHOLE_FOOD', 'LOCAL_FOOD', 'REGEN_SOURCE', 'WILD_FORAGE', 'FERMENTED', 'PHYTONUTRIENT'],
};

// =============================================================================
// LOGGING
// =============================================================================

const log = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  success: (msg) => console.log(`[OK] ${msg}`),
  warn: (msg) => console.log(`[WARN] ${msg}`),
  error: (msg) => console.log(`[ERROR] ${msg}`),
  discovery: (msg) => console.log(`[DISCOVERY] ${msg}`),
  correlation: (msg) => console.log(`[CORRELATION] ${msg}`),
  gap: (msg) => console.log(`[GAP] ${msg}`),
};

// =============================================================================
// DATA LOADING
// =============================================================================

function loadDeployment() {
  return safeReadJson(CONFIG.deploymentPath, {
    transactions: [],
    bioregionStats: {},
    bioregionImpact: {},
    lands: [],
    pnfts: [],
    compoundDiscovery: {},
  });
}

function saveDeployment(deployment) {
  atomicWriteSync(CONFIG.deploymentPath, deployment);
}

function loadProtocolSpec() {
  return safeReadJson(CONFIG.protocolSpecPath, { compounds: {} });
}

function getBioregionHealth(bioregionId) {
  return DEFAULT_BIOREGION_HEALTH[bioregionId] || {
    water_index: 60,
    soil_index: 60,
    biodiversity_index: 60,
    air_quality_index: 70,
    aquifer_level: 50,
    stressors: [],
  };
}

function getPopulationHealth(bioregionId) {
  return DEFAULT_POPULATION_HEALTH[bioregionId] || {
    iron_deficiency: 10,
    b12_deficiency: 10,
    vitamin_d_deficiency: 20,
    protein_deficiency: 5,
    zinc_deficiency: 8,
    chronic_disease_rate: 15,
    metabolic_syndrome: 18,
    needs: [],
  };
}

// =============================================================================
// CORRELATION ENGINE
// =============================================================================

/**
 * Analyze correlations between transaction compounds and health outcomes.
 * This implements the correlation_engine from protocol-spec.json.
 */
function analyzeCorrelations(transactions, bioregionId, bioregionHealth, populationHealth) {
  const correlations = [];

  // Filter transactions for this bioregion
  const bioregionTxs = transactions.filter(tx =>
    tx.senderBioregion === bioregionId || tx.recipientBioregion === bioregionId
  );

  if (bioregionTxs.length === 0) {
    return correlations;
  }

  // Aggregate compounds from transactions
  const compoundAggregates = {};
  bioregionTxs.forEach(tx => {
    if (tx.impact?.compounds) {
      tx.impact.compounds.forEach(c => {
        if (!compoundAggregates[c.compound]) {
          compoundAggregates[c.compound] = {
            totalQuantity: 0,
            transactionCount: 0,
            avgConfidence: 0,
            confidenceSum: 0,
          };
        }
        compoundAggregates[c.compound].totalQuantity += c.quantity;
        compoundAggregates[c.compound].transactionCount += 1;
        compoundAggregates[c.compound].confidenceSum += c.confidence || 50;
      });
    }
  });

  // Calculate averages
  Object.keys(compoundAggregates).forEach(compound => {
    const agg = compoundAggregates[compound];
    agg.avgConfidence = agg.confidenceSum / agg.transactionCount;
  });

  // Correlate with population health needs
  if (compoundAggregates['IRON'] && populationHealth.iron_deficiency > 10) {
    const strength = Math.min(0.9, 0.5 + (populationHealth.iron_deficiency / 100));
    correlations.push({
      compound: 'IRON',
      healthIndicator: 'iron_deficiency',
      type: 'positive_intervention',
      correlation: strength,
      description: `Transactions with IRON correlate with reduced iron deficiency (${populationHealth.iron_deficiency}% population affected)`,
      dataPoints: compoundAggregates['IRON'].transactionCount,
      totalDelivered: compoundAggregates['IRON'].totalQuantity,
    });
  }

  if (compoundAggregates['NEED_IRON'] && populationHealth.iron_deficiency > 10) {
    correlations.push({
      compound: 'NEED_IRON',
      healthIndicator: 'iron_deficiency',
      type: 'need_tracking',
      correlation: 0.85,
      description: `NEED_IRON tracking shows ${compoundAggregates['NEED_IRON'].totalQuantity}% of iron needs being met through natural food sources`,
      dataPoints: compoundAggregates['NEED_IRON'].transactionCount,
    });
  }

  if (compoundAggregates['B12'] && populationHealth.b12_deficiency > 5) {
    correlations.push({
      compound: 'B12',
      healthIndicator: 'b12_deficiency',
      type: 'positive_intervention',
      correlation: 0.7,
      description: `B12 tracking shows natural delivery addressing ${populationHealth.b12_deficiency}% deficiency rate`,
      dataPoints: compoundAggregates['B12'].transactionCount,
    });
  }

  // Correlate with bioregion environmental health
  if (compoundAggregates['H2O'] && bioregionHealth.water_index < 50) {
    correlations.push({
      compound: 'H2O',
      healthIndicator: 'water_stress',
      type: 'environmental_impact',
      correlation: 0.8,
      description: `Water consumption (${Math.abs(compoundAggregates['H2O'].totalQuantity)}L) tracked in water-stressed bioregion (index: ${bioregionHealth.water_index})`,
      dataPoints: compoundAggregates['H2O'].transactionCount,
    });
  }

  if (compoundAggregates['N'] && compoundAggregates['N'].totalQuantity > 0) {
    correlations.push({
      compound: 'N',
      healthIndicator: 'soil_health',
      type: 'positive_intervention',
      correlation: 0.65,
      description: `Positive nitrogen cycling (+${compoundAggregates['N'].totalQuantity}g) from regenerative practices improving soil health`,
      dataPoints: compoundAggregates['N'].transactionCount,
    });
  }

  if (compoundAggregates['REGEN_SOURCE']) {
    correlations.push({
      compound: 'REGEN_SOURCE',
      healthIndicator: 'regenerative_food_system',
      type: 'food_as_medicine',
      correlation: 0.75,
      description: `Regenerative sourcing tracked - healing both land and population through food choices`,
      dataPoints: compoundAggregates['REGEN_SOURCE'].transactionCount,
    });
  }

  // Check for supplement avoidance patterns
  if (compoundAggregates['SUPP_AVOID']) {
    correlations.push({
      compound: 'SUPP_AVOID',
      healthIndicator: 'pharma_avoidance',
      type: 'chain_economics',
      correlation: 0.8,
      description: `Natural food sources avoiding $${compoundAggregates['SUPP_AVOID'].totalQuantity} in supplement costs`,
      dataPoints: compoundAggregates['SUPP_AVOID'].transactionCount,
    });
  }

  return correlations;
}

// =============================================================================
// GAP ANALYSIS
// =============================================================================

/**
 * Identify tracking gaps - health problems without clear compound correlation.
 */
function identifyGaps(transactions, bioregionId, bioregionHealth, populationHealth) {
  const gaps = [];

  // Get all tracked compounds from transactions
  const trackedCompounds = new Set();
  transactions.forEach(tx => {
    if (tx.impact?.compounds) {
      tx.impact.compounds.forEach(c => trackedCompounds.add(c.compound));
    }
  });

  // Check bioregion health stressors
  bioregionHealth.stressors.forEach(stressor => {
    if (!trackedCompounds.has(stressor) && !UNIVERSAL_COMPOUNDS.includes(stressor)) {
      gaps.push({
        type: 'environmental',
        indicator: stressor,
        severity: 'high',
        description: `Bioregion stress factor ${stressor} is not being tracked in transactions`,
        recommendation: `Add ${stressor} tracking to relevant transactions`,
        potentialCompound: stressor,
      });
    }
  });

  // Check population health needs
  populationHealth.needs.forEach(need => {
    if (!trackedCompounds.has(need)) {
      gaps.push({
        type: 'nutritional',
        indicator: need,
        severity: 'medium',
        description: `Population health need ${need} is not being tracked in food transactions`,
        recommendation: `Track ${need} delivery in food-related transactions`,
        potentialCompound: need,
      });
    }
  });

  // Check for specific unaddressed health issues
  if (populationHealth.iron_deficiency > 15 && !trackedCompounds.has('NEED_IRON')) {
    gaps.push({
      type: 'health',
      indicator: 'iron_deficiency_tracking',
      severity: 'high',
      description: `High iron deficiency (${populationHealth.iron_deficiency}%) without NEED_IRON tracking`,
      recommendation: 'Track how much of iron needs are being met by natural food sources',
      potentialCompound: 'NEED_IRON',
    });
  }

  if (populationHealth.vitamin_d_deficiency > 20 && !trackedCompounds.has('VIT_D')) {
    gaps.push({
      type: 'nutritional',
      indicator: 'vitamin_d_deficiency',
      severity: 'medium',
      description: `Vitamin D deficiency (${populationHealth.vitamin_d_deficiency}%) not tracked`,
      recommendation: 'Track VIT_D in food transactions, especially for eggs, fish, fortified foods',
      potentialCompound: 'VIT_D',
    });
  }

  if (bioregionHealth.water_index < 50 && !trackedCompounds.has('H2O')) {
    gaps.push({
      type: 'environmental',
      indicator: 'water_stress',
      severity: 'critical',
      description: `Water-stressed bioregion (index: ${bioregionHealth.water_index}) without water tracking`,
      recommendation: 'Track H2O consumption in all relevant transactions',
      potentialCompound: 'H2O',
    });
  }

  // Check for missing root cause tracking
  if (populationHealth.chronic_disease_rate > 15) {
    const rootCauseCompounds = ['GLYPHOSATE', 'SEED_OIL', 'PROC_FOOD', 'INFLAM'];
    const missingRootCause = rootCauseCompounds.filter(c => !trackedCompounds.has(c));

    if (missingRootCause.length > 0) {
      gaps.push({
        type: 'health_root_cause',
        indicator: 'chronic_disease_factors',
        severity: 'high',
        description: `High chronic disease rate (${populationHealth.chronic_disease_rate}%) without root cause tracking`,
        recommendation: `Track food quality factors: ${missingRootCause.join(', ')}`,
        potentialCompounds: missingRootCause,
      });
    }
  }

  // Check for missing regenerative source tracking
  if (!trackedCompounds.has('REGEN_SOURCE') && !trackedCompounds.has('WHOLE_FOOD')) {
    gaps.push({
      type: 'food_as_medicine',
      indicator: 'food_quality',
      severity: 'medium',
      description: 'No tracking of regenerative or whole food sources',
      recommendation: 'Track REGEN_SOURCE and WHOLE_FOOD to measure food quality impact',
      potentialCompounds: ['REGEN_SOURCE', 'WHOLE_FOOD'],
    });
  }

  return gaps;
}

// =============================================================================
// COMPOUND PROPOSAL ENGINE
// =============================================================================

/**
 * Propose new compounds based on analysis - the recursive discovery mechanism.
 * Implements the example_discovery from protocol-spec.json.
 */
function proposeNewCompounds(correlations, gaps, bioregionId, bioregionHealth, populationHealth) {
  const proposals = [];
  const timestamp = new Date().toISOString();

  // Proposals from gaps (high priority - untracked needs)
  gaps.forEach(gap => {
    if (gap.potentialCompound) {
      proposals.push({
        compound: gap.potentialCompound,
        source: 'gap_analysis',
        priority: gap.severity === 'critical' ? 1 : gap.severity === 'high' ? 2 : 3,
        rationale: gap.description,
        recommendation: gap.recommendation,
        category: gap.type,
        timestamp,
      });
    }
    if (gap.potentialCompounds) {
      gap.potentialCompounds.forEach(compound => {
        proposals.push({
          compound,
          source: 'gap_analysis',
          priority: gap.severity === 'critical' ? 1 : gap.severity === 'high' ? 2 : 3,
          rationale: gap.description,
          recommendation: gap.recommendation,
          category: gap.type,
          timestamp,
        });
      });
    }
  });

  // Emergent compounds from correlations (data-driven discovery)
  correlations.filter(c => c.correlation > 0.7).forEach(corr => {
    // Check if we should propose related tracking
    if (corr.compound === 'IRON' && corr.correlation > 0.7) {
      // Example from protocol-spec: SOIL_FE discovery
      proposals.push({
        compound: 'SOIL_FE',
        source: 'correlation_discovery',
        priority: 2,
        rationale: `Strong IRON correlation (${(corr.correlation * 100).toFixed(0)}%) suggests tracking soil iron content - understanding the full chain from soil to health`,
        recommendation: 'Track SOIL_FE in land health surveys to understand iron availability in food chain',
        category: 'emergent',
        timestamp,
        parentCorrelation: corr,
      });
    }

    if (corr.compound === 'REGEN_SOURCE') {
      proposals.push({
        compound: 'MICROBIOME',
        source: 'correlation_discovery',
        priority: 2,
        rationale: 'Regenerative sourcing correlates with health - track microbiome impact to understand mechanism',
        recommendation: 'Track MICROBIOME impact of regenerative vs conventional food sources',
        category: 'emergent',
        timestamp,
      });
    }
  });

  // Bioregion-specific proposals
  if (bioregionHealth.water_index < 40) {
    proposals.push({
      compound: 'AQUIFER_DRAW',
      source: 'bioregion_stress',
      priority: 1,
      rationale: `Critical water stress (index: ${bioregionHealth.water_index}) - track aquifer withdrawal separately from surface water`,
      recommendation: 'Distinguish groundwater vs surface water consumption in transactions',
      category: 'environmental',
      timestamp,
    });
  }

  if (populationHealth.metabolic_syndrome > 20) {
    proposals.push({
      compound: 'INSULIN_IMPACT',
      source: 'population_health',
      priority: 2,
      rationale: `High metabolic syndrome rate (${populationHealth.metabolic_syndrome}%) - track insulin response of foods`,
      recommendation: 'Track INSULIN_IMPACT to understand food contribution to metabolic health',
      category: 'chronic_disease_factors',
      timestamp,
    });
  }

  // Deduplicate proposals
  const seen = new Set();
  return proposals.filter(p => {
    if (seen.has(p.compound)) return false;
    seen.add(p.compound);
    return true;
  }).sort((a, b) => a.priority - b.priority);
}

// =============================================================================
// COMMAND HANDLERS
// =============================================================================

/**
 * --analyze: Full compound discovery analysis
 */
function handleAnalyze(bioregionId) {
  console.log(`
================================================================================
  COMPOUND DISCOVERY ENGINE - FULL ANALYSIS
  Bioregion: ${bioregionId}
================================================================================
`);

  const deployment = loadDeployment();
  const bioregionHealth = getBioregionHealth(bioregionId);
  const populationHealth = getPopulationHealth(bioregionId);

  console.log('BIOREGION HEALTH INDICES:');
  console.log(`  Water Index:       ${bioregionHealth.water_index}/100 ${bioregionHealth.water_index < 50 ? '(STRESSED)' : ''}`);
  console.log(`  Soil Index:        ${bioregionHealth.soil_index}/100`);
  console.log(`  Biodiversity:      ${bioregionHealth.biodiversity_index}/100`);
  console.log(`  Air Quality:       ${bioregionHealth.air_quality_index}/100`);
  console.log(`  Aquifer Level:     ${bioregionHealth.aquifer_level}/100`);
  console.log(`  Key Stressors:     ${bioregionHealth.stressors.join(', ') || 'None identified'}`);

  console.log('\nPOPULATION HEALTH INDICES:');
  console.log(`  Iron Deficiency:   ${populationHealth.iron_deficiency}%`);
  console.log(`  B12 Deficiency:    ${populationHealth.b12_deficiency}%`);
  console.log(`  Vitamin D Deficit: ${populationHealth.vitamin_d_deficiency}%`);
  console.log(`  Chronic Disease:   ${populationHealth.chronic_disease_rate}%`);
  console.log(`  Metabolic Issues:  ${populationHealth.metabolic_syndrome}%`);
  console.log(`  Key Needs:         ${populationHealth.needs.join(', ') || 'None identified'}`);

  // Run correlation analysis
  const correlations = analyzeCorrelations(
    deployment.transactions || [],
    bioregionId,
    bioregionHealth,
    populationHealth
  );

  console.log('\n--- CORRELATIONS DISCOVERED ---');
  if (correlations.length === 0) {
    console.log('  No correlations found. More transaction data needed.');
  } else {
    correlations.forEach(c => {
      console.log(`\n  ${c.compound} -> ${c.healthIndicator}`);
      console.log(`    Type: ${c.type}`);
      console.log(`    Correlation Strength: ${(c.correlation * 100).toFixed(0)}%`);
      console.log(`    Data Points: ${c.dataPoints}`);
      console.log(`    ${c.description}`);
    });
  }

  // Run gap analysis
  const gaps = identifyGaps(
    deployment.transactions || [],
    bioregionId,
    bioregionHealth,
    populationHealth
  );

  console.log('\n--- TRACKING GAPS IDENTIFIED ---');
  if (gaps.length === 0) {
    console.log('  No significant gaps found.');
  } else {
    gaps.forEach(g => {
      console.log(`\n  [${g.severity.toUpperCase()}] ${g.indicator}`);
      console.log(`    Type: ${g.type}`);
      console.log(`    ${g.description}`);
      console.log(`    -> ${g.recommendation}`);
    });
  }

  // Generate proposals
  const proposals = proposeNewCompounds(
    correlations,
    gaps,
    bioregionId,
    bioregionHealth,
    populationHealth
  );

  console.log('\n--- PROPOSED COMPOUNDS TO TRACK ---');
  if (proposals.length === 0) {
    console.log('  No new compounds proposed.');
  } else {
    proposals.forEach((p, i) => {
      console.log(`\n  ${i + 1}. ${p.compound} (Priority: ${p.priority})`);
      console.log(`     Source: ${p.source}`);
      console.log(`     Category: ${p.category}`);
      console.log(`     Rationale: ${p.rationale}`);
      console.log(`     -> ${p.recommendation}`);
    });
  }

  // Summary
  const txCount = (deployment.transactions || []).filter(tx =>
    tx.senderBioregion === bioregionId || tx.recipientBioregion === bioregionId
  ).length;

  console.log(`
================================================================================
  ANALYSIS SUMMARY
================================================================================
  Transactions Analyzed:  ${txCount}
  Correlations Found:     ${correlations.length}
  Tracking Gaps:          ${gaps.length}
  Proposed Compounds:     ${proposals.length}

  Key Insight: "The data teaches us what matters - we don't have to know in advance"
================================================================================
`);

  return { correlations, gaps, proposals };
}

/**
 * --correlate: Show correlations between compounds and health outcomes
 */
function handleCorrelate(bioregionId) {
  console.log(`
================================================================================
  CORRELATION ANALYSIS
  Bioregion: ${bioregionId}
================================================================================
`);

  const deployment = loadDeployment();
  const bioregionHealth = getBioregionHealth(bioregionId);
  const populationHealth = getPopulationHealth(bioregionId);

  const correlations = analyzeCorrelations(
    deployment.transactions || [],
    bioregionId,
    bioregionHealth,
    populationHealth
  );

  if (correlations.length === 0) {
    console.log('No correlations found. Add more transactions with compound tracking.');
    return;
  }

  // Group by type
  const byType = {};
  correlations.forEach(c => {
    if (!byType[c.type]) byType[c.type] = [];
    byType[c.type].push(c);
  });

  Object.entries(byType).forEach(([type, items]) => {
    console.log(`\n${type.toUpperCase().replace(/_/g, ' ')}:`);
    items.forEach(c => {
      const strengthBar = '='.repeat(Math.floor(c.correlation * 10));
      console.log(`\n  ${c.compound} -> ${c.healthIndicator}`);
      console.log(`    Strength: [${strengthBar}${' '.repeat(10 - strengthBar.length)}] ${(c.correlation * 100).toFixed(0)}%`);
      console.log(`    ${c.description}`);
      if (c.totalDelivered !== undefined) {
        console.log(`    Total delivered: ${c.totalDelivered}`);
      }
    });
  });

  console.log(`
--------------------------------------------------------------------------------
Transaction compound -> Health index change correlations show which tracked
compounds actually improve health outcomes. Strong correlations (>70%) suggest
these compounds should be priority tracking for this bioregion.
--------------------------------------------------------------------------------
`);
}

/**
 * --gaps: Identify tracking gaps
 */
function handleGaps(bioregionId) {
  console.log(`
================================================================================
  TRACKING GAPS ANALYSIS
  Bioregion: ${bioregionId}
================================================================================
`);

  const deployment = loadDeployment();
  const bioregionHealth = getBioregionHealth(bioregionId);
  const populationHealth = getPopulationHealth(bioregionId);

  const gaps = identifyGaps(
    deployment.transactions || [],
    bioregionId,
    bioregionHealth,
    populationHealth
  );

  if (gaps.length === 0) {
    console.log('No significant tracking gaps identified.');
    console.log('The current compound tracking covers known health indicators.');
    return;
  }

  // Group by severity
  const critical = gaps.filter(g => g.severity === 'critical');
  const high = gaps.filter(g => g.severity === 'high');
  const medium = gaps.filter(g => g.severity === 'medium');

  if (critical.length > 0) {
    console.log('\nCRITICAL GAPS (immediate action needed):');
    critical.forEach(g => {
      console.log(`\n  ${g.indicator}`);
      console.log(`    ${g.description}`);
      console.log(`    RECOMMENDATION: ${g.recommendation}`);
    });
  }

  if (high.length > 0) {
    console.log('\nHIGH PRIORITY GAPS:');
    high.forEach(g => {
      console.log(`\n  ${g.indicator}`);
      console.log(`    ${g.description}`);
      console.log(`    -> ${g.recommendation}`);
    });
  }

  if (medium.length > 0) {
    console.log('\nMEDIUM PRIORITY GAPS:');
    medium.forEach(g => {
      console.log(`\n  ${g.indicator}`);
      console.log(`    ${g.description}`);
      console.log(`    -> ${g.recommendation}`);
    });
  }

  console.log(`
--------------------------------------------------------------------------------
Health problems without clear compound correlation suggest investigation areas.
These gaps indicate where additional compound tracking would provide insight
into the health of this bioregion and its population.
--------------------------------------------------------------------------------
`);
}

/**
 * --propose: Propose new compounds based on analysis
 */
function handlePropose(bioregionId) {
  console.log(`
================================================================================
  COMPOUND PROPOSALS
  Bioregion: ${bioregionId}
================================================================================

Based on recursive discovery analysis, the following compounds are proposed
for tracking in this bioregion:
`);

  const deployment = loadDeployment();
  const bioregionHealth = getBioregionHealth(bioregionId);
  const populationHealth = getPopulationHealth(bioregionId);

  const correlations = analyzeCorrelations(
    deployment.transactions || [],
    bioregionId,
    bioregionHealth,
    populationHealth
  );

  const gaps = identifyGaps(
    deployment.transactions || [],
    bioregionId,
    bioregionHealth,
    populationHealth
  );

  const proposals = proposeNewCompounds(
    correlations,
    gaps,
    bioregionId,
    bioregionHealth,
    populationHealth
  );

  if (proposals.length === 0) {
    console.log('No new compounds proposed at this time.');
    console.log('Continue collecting transaction data for more insights.');
    return;
  }

  proposals.forEach((p, i) => {
    console.log(`${i + 1}. ${p.compound}`);
    console.log(`   Priority:    ${p.priority} (1=highest)`);
    console.log(`   Source:      ${p.source}`);
    console.log(`   Category:    ${p.category}`);
    console.log(`   Rationale:   ${p.rationale}`);
    console.log(`   Action:      ${p.recommendation}`);
    console.log('');
  });

  console.log(`
--------------------------------------------------------------------------------
To apply these proposals to the bioregion priority list, run:
  npm run discover:apply -- --bioregion ${bioregionId}
--------------------------------------------------------------------------------
`);

  return proposals;
}

/**
 * --apply: Apply discovered compounds to bioregion priority list
 */
function handleApply(bioregionId) {
  console.log(`
================================================================================
  APPLYING COMPOUND DISCOVERIES
  Bioregion: ${bioregionId}
================================================================================
`);

  const deployment = loadDeployment();
  const bioregionHealth = getBioregionHealth(bioregionId);
  const populationHealth = getPopulationHealth(bioregionId);

  const correlations = analyzeCorrelations(
    deployment.transactions || [],
    bioregionId,
    bioregionHealth,
    populationHealth
  );

  const gaps = identifyGaps(
    deployment.transactions || [],
    bioregionId,
    bioregionHealth,
    populationHealth
  );

  const proposals = proposeNewCompounds(
    correlations,
    gaps,
    bioregionId,
    bioregionHealth,
    populationHealth
  );

  // Initialize compound discovery if needed
  if (!deployment.compoundDiscovery) {
    deployment.compoundDiscovery = {};
  }

  if (!deployment.compoundDiscovery[bioregionId]) {
    deployment.compoundDiscovery[bioregionId] = {
      bioregionId,
      discoveries: [],
      currentPriorities: [...UNIVERSAL_COMPOUNDS],
      pendingInvestigation: [],
    };
  }

  const discovery = deployment.compoundDiscovery[bioregionId];
  const timestamp = new Date().toISOString();

  // Apply high-priority proposals (priority 1-2) to current priorities
  const newPriorities = proposals
    .filter(p => p.priority <= 2)
    .map(p => p.compound)
    .filter(c => !discovery.currentPriorities.includes(c));

  // Add to pending investigation (priority 3+)
  const newInvestigation = proposals
    .filter(p => p.priority > 2)
    .map(p => p.compound)
    .filter(c => !discovery.pendingInvestigation.includes(c));

  // Record discoveries
  proposals.forEach(p => {
    const discoveryRecord = {
      timestamp,
      compound: p.compound,
      rationale: p.rationale,
      correlationStrength: p.parentCorrelation?.correlation || 0,
      dataPoints: p.parentCorrelation?.dataPoints || 0,
      source: p.source,
      priority: p.priority,
    };
    discovery.discoveries.push(discoveryRecord);
  });

  // Update priorities
  discovery.currentPriorities = [...new Set([...discovery.currentPriorities, ...newPriorities])];
  discovery.pendingInvestigation = [...new Set([...discovery.pendingInvestigation, ...newInvestigation])];

  // Save
  saveDeployment(deployment);

  console.log(`Applied ${newPriorities.length} new priority compounds:`);
  newPriorities.forEach(c => console.log(`  + ${c}`));

  console.log(`\nAdded ${newInvestigation.length} compounds to investigation queue:`);
  newInvestigation.forEach(c => console.log(`  ? ${c}`));

  console.log(`\nCurrent Priority Compounds for ${bioregionId}:`);
  discovery.currentPriorities.forEach(c => console.log(`  - ${c}`));

  console.log(`
================================================================================
  DISCOVERY APPLIED

  Total Discoveries Recorded: ${discovery.discoveries.length}
  Priority Compounds:         ${discovery.currentPriorities.length}
  Pending Investigation:      ${discovery.pendingInvestigation.length}

  Saved to: deployment.json -> compoundDiscovery.${bioregionId}
================================================================================
`);
}

/**
 * --history: Show discovery history
 */
function handleHistory(bioregionId) {
  console.log(`
================================================================================
  COMPOUND DISCOVERY HISTORY
  Bioregion: ${bioregionId}
================================================================================
`);

  const deployment = loadDeployment();
  const discovery = deployment.compoundDiscovery?.[bioregionId];

  if (!discovery || discovery.discoveries.length === 0) {
    console.log('No discovery history found for this bioregion.');
    console.log('Run --analyze and --apply to begin building discovery history.');
    return;
  }

  console.log('CURRENT PRIORITY COMPOUNDS:');
  discovery.currentPriorities.forEach(c => console.log(`  - ${c}`));

  console.log('\nPENDING INVESTIGATION:');
  if (discovery.pendingInvestigation.length === 0) {
    console.log('  (none)');
  } else {
    discovery.pendingInvestigation.forEach(c => console.log(`  ? ${c}`));
  }

  console.log('\nDISCOVERY TIMELINE:');

  // Group by date
  const byDate = {};
  discovery.discoveries.forEach(d => {
    const date = d.timestamp.split('T')[0];
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(d);
  });

  Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0])).forEach(([date, items]) => {
    console.log(`\n  ${date}:`);
    items.forEach(d => {
      console.log(`    + ${d.compound} (Priority ${d.priority})`);
      console.log(`      Source: ${d.source}`);
      console.log(`      ${d.rationale.substring(0, 70)}${d.rationale.length > 70 ? '...' : ''}`);
      if (d.correlationStrength > 0) {
        console.log(`      Correlation: ${(d.correlationStrength * 100).toFixed(0)}% (${d.dataPoints} data points)`);
      }
    });
  });

  console.log(`
--------------------------------------------------------------------------------
Discovery history shows which compounds were added to tracking and why.
This recursive process refines what we track based on actual health data.
--------------------------------------------------------------------------------
`);
}

/**
 * Show help
 */
function showHelp() {
  console.log(`
================================================================================
  COMPOUND DISCOVERY ENGINE
================================================================================

RECURSIVE DISCOVERY: Correlates transaction data with health indices to discover
which compounds actually matter for each bioregion.

Key insight: "The data teaches us what matters - we don't have to know in advance"

COMMANDS:
  --analyze --bioregion <id>    Full compound discovery analysis
                                 - Reads bioregion health indices
                                 - Reads population health data
                                 - Reads transaction compound data
                                 - Outputs correlations, gaps, and proposals

  --correlate --bioregion <id>  Show correlations between compounds and health
                                 - Transaction compound -> Health index change
                                 - Which tracked compounds improve health?

  --gaps --bioregion <id>       Identify tracking gaps
                                 - Health problems without clear correlation
                                 - Suggests investigation areas

  --propose --bioregion <id>    Propose new compounds based on analysis
                                 - Data-driven compound discovery
                                 - Emergent compounds from correlations

  --apply --bioregion <id>      Apply discovered compounds to bioregion
                                 - Updates bioregion's priorityCompounds
                                 - Records discovery history

  --history --bioregion <id>    Show discovery history
                                 - What compounds were added when and why

EXAMPLES:
  npm run discover:analyze -- --bioregion sierra_nevada
  npm run discover:correlate -- --bioregion gulf_coast
  npm run discover:gaps -- --bioregion pacific_northwest
  npm run discover:propose -- --bioregion great_lakes
  npm run discover:apply -- --bioregion sonoran_desert
  npm run discover:history -- --bioregion sierra_nevada

AVAILABLE BIOREGIONS:
  sierra_nevada      - Water stress, fire impact, VIT_D/IRON needs
  pacific_northwest  - Soil degradation, low sunlight, B12/VIT_D needs
  gulf_coast         - Agricultural runoff, wetland loss, IRON/FIBER needs
  great_lakes        - Air quality, VIT_D/OMEGA3 needs
  sonoran_desert     - Extreme water stress, protein/zinc needs

================================================================================
`);
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  // Get bioregion
  const bioregionIdx = args.indexOf('--bioregion');
  const bioregionId = bioregionIdx >= 0 ? args[bioregionIdx + 1] : null;

  // Determine command
  const command = args.find(a => ['--analyze', '--correlate', '--gaps', '--propose', '--apply', '--history'].includes(a));

  if (!command) {
    log.error('No command specified. Use --help for usage.');
    process.exit(1);
  }

  if (!bioregionId) {
    log.error('Bioregion required. Use --bioregion <id>');
    log.info('Available: sierra_nevada, pacific_northwest, gulf_coast, great_lakes, sonoran_desert');
    process.exit(1);
  }

  switch (command) {
    case '--analyze':
      handleAnalyze(bioregionId);
      break;
    case '--correlate':
      handleCorrelate(bioregionId);
      break;
    case '--gaps':
      handleGaps(bioregionId);
      break;
    case '--propose':
      handlePropose(bioregionId);
      break;
    case '--apply':
      handleApply(bioregionId);
      break;
    case '--history':
      handleHistory(bioregionId);
      break;
    default:
      showHelp();
  }
}

main().catch(error => {
  log.error(error.message);
  console.error(error);
  process.exit(1);
});
