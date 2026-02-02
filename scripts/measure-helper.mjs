#!/usr/bin/env node
/**
 * UltraLife Protocol — Measurement Helper
 *
 * Helps transactions gather impact measurements from various sources.
 * The validator doesn't care HOW you measured - it validates THAT you measured.
 *
 * MEASUREMENT SOURCES (from lowest to highest confidence):
 *
 * 1. ESTIMATION (10-40% confidence)
 *    - AI/LLM-assisted estimates based on similar activities
 *    - Community-reported averages
 *    - Requires verification upgrade over time
 *
 * 2. CALCULATION (40-70% confidence)
 *    - Calculated from known inputs (fuel receipts, utility bills)
 *    - Supply chain documentation
 *    - Product specifications
 *
 * 3. MEASUREMENT (70-90% confidence)
 *    - IoT sensors (scales, meters, monitors)
 *    - Equipment readings
 *    - Calibrated instruments
 *
 * 4. VERIFICATION (90-99% confidence)
 *    - Lab-tested samples
 *    - Certified surveyor measurements
 *    - Third-party audit
 *
 * Usage:
 *   node measure-helper.mjs --product beef --weight 200g
 *   node measure-helper.mjs --activity transport --distance 50km --vehicle diesel-truck
 *   node measure-helper.mjs --lookup CO2 --source IPCC
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =============================================================================
// MEASUREMENT SOURCES
// =============================================================================
// These are NOT presets. They are documented measurement METHODS that help
// users gather data. The actual values must still be measured or calculated
// for each specific transaction.
// =============================================================================

const MEASUREMENT_METHODS = {
  // === DIRECT MEASUREMENT ===
  scale: {
    description: 'Weighed on calibrated scale',
    confidence_range: [70, 90],
    requires: 'Calibrated scale, photo/timestamp evidence',
  },
  meter: {
    description: 'Read from utility meter',
    confidence_range: [80, 95],
    requires: 'Meter reading, bill documentation',
  },
  sensor: {
    description: 'IoT sensor reading',
    confidence_range: [60, 85],
    requires: 'Sensor ID, calibration date, reading timestamp',
  },
  gps: {
    description: 'GPS-tracked distance',
    confidence_range: [85, 95],
    requires: 'GPS log, start/end coordinates',
  },

  // === CALCULATION FROM INPUTS ===
  fuel_receipt: {
    description: 'Calculated from fuel purchase',
    confidence_range: [70, 85],
    requires: 'Receipt, vehicle specs, standard conversion factors',
    example: 'X liters diesel × 2.68 kg CO2/liter = Y kg CO2',
  },
  utility_bill: {
    description: 'Calculated from utility usage',
    confidence_range: [75, 90],
    requires: 'Bill, grid carbon intensity for region',
    example: 'X kWh × regional_factor g CO2/kWh = Y g CO2',
  },
  product_spec: {
    description: 'From manufacturer specification',
    confidence_range: [50, 75],
    requires: 'Product datasheet, LCA documentation',
  },
  supply_chain: {
    description: 'From supply chain passport',
    confidence_range: [60, 85],
    requires: 'Chain of custody documentation, upstream measurements',
  },

  // === ESTIMATION (use with caution) ===
  similar_activity: {
    description: 'Estimated from similar verified activity',
    confidence_range: [30, 50],
    requires: 'Reference activity ID, similarity justification',
    warning: 'Must be verified within 30 days or confidence decays',
  },
  regional_average: {
    description: 'Regional average from bioregion data',
    confidence_range: [20, 40],
    requires: 'Bioregion ID, activity category',
    warning: 'Low confidence - upgrade with actual measurement',
  },
  ai_estimate: {
    description: 'AI-assisted estimate',
    confidence_range: [10, 35],
    requires: 'Model ID, input parameters, reasoning',
    warning: 'Provisional only - must verify or confidence drops to 0',
  },

  // === VERIFICATION ===
  lab_tested: {
    description: 'Laboratory analysis',
    confidence_range: [90, 99],
    requires: 'Lab certification, sample ID, test methodology',
  },
  surveyor_certified: {
    description: 'Certified surveyor measurement',
    confidence_range: [85, 98],
    requires: 'Surveyor pNFT (with certification), measurement protocol',
  },
  third_party_audit: {
    description: 'Independent third-party audit',
    confidence_range: [88, 97],
    requires: 'Auditor credentials, audit report hash',
  },
};

// =============================================================================
// CONVERSION FACTORS (documented sources)
// =============================================================================
// These are reference values from established sources.
// Users should verify applicability to their specific context.
// =============================================================================

const CONVERSION_FACTORS = {
  // Fuel combustion (IPCC 2006 Guidelines)
  fuel: {
    diesel: { CO2_per_liter: 2680, unit: 'g', source: 'IPCC 2006', confidence: 90 },
    gasoline: { CO2_per_liter: 2310, unit: 'g', source: 'IPCC 2006', confidence: 90 },
    lpg: { CO2_per_liter: 1510, unit: 'g', source: 'IPCC 2006', confidence: 85 },
    natural_gas: { CO2_per_m3: 2000, unit: 'g', source: 'IPCC 2006', confidence: 85 },
  },

  // Electricity (varies by region - these are examples)
  electricity: {
    us_average: { CO2_per_kWh: 420, unit: 'g', source: 'EPA eGRID 2022', confidence: 80 },
    california: { CO2_per_kWh: 210, unit: 'g', source: 'CARB 2022', confidence: 85 },
    renewable: { CO2_per_kWh: 20, unit: 'g', source: 'NREL', confidence: 75 },
    note: 'Embodied carbon of infrastructure not included',
  },

  // Water (varies significantly by source and treatment)
  water: {
    municipal: { KWH_per_1000L: 1.5, source: 'WaterSense', confidence: 70 },
    groundwater: { KWH_per_1000L: 0.5, source: 'varies', confidence: 60 },
    desalination: { KWH_per_1000L: 4.0, source: 'varies', confidence: 75 },
  },

  // Transport distance (per km, varies by vehicle/load)
  transport: {
    heavy_truck: { CO2_per_km: 900, unit: 'g', load_factor: 'full', confidence: 75 },
    light_truck: { CO2_per_km: 250, unit: 'g', load_factor: 'full', confidence: 75 },
    ship_container: { CO2_per_km_per_ton: 15, unit: 'g', confidence: 70 },
    air_freight: { CO2_per_km_per_ton: 500, unit: 'g', confidence: 80 },
    note: 'Highly variable - measure actual fuel consumption when possible',
  },
};

// =============================================================================
// NUTRITIONAL REFERENCE (USDA FoodData Central)
// =============================================================================
// Per 100g raw weight - actual values vary by source, preparation, etc.
// =============================================================================

const NUTRITIONAL_REFERENCE = {
  beef_grass_fed: {
    source: 'USDA FoodData Central',
    per_100g: {
      PROT: 26, FAT: 11, IRON: 2.6, ZINC: 5.3, B12: 2.5,
      KCAL: 198,
    },
    note: 'Varies by cut, age, finishing. Measure specific product.',
  },
  chicken_breast: {
    source: 'USDA FoodData Central',
    per_100g: {
      PROT: 31, FAT: 3.6, IRON: 0.4, ZINC: 0.8, B12: 0.3,
      KCAL: 165,
    },
  },
  salmon_wild: {
    source: 'USDA FoodData Central',
    per_100g: {
      PROT: 20, FAT: 8, IRON: 0.3, OMEGA3: 2260, VIT_D: 526,
      KCAL: 142,
    },
  },
  eggs: {
    source: 'USDA FoodData Central',
    per_100g: {
      PROT: 13, FAT: 11, IRON: 1.8, ZINC: 1.3, B12: 1.1, VIT_D: 82,
      KCAL: 155,
    },
  },
  spinach_raw: {
    source: 'USDA FoodData Central',
    per_100g: {
      PROT: 2.9, IRON: 2.7, CA: 99, MG: 79, K: 558, VIT_A: 9377,
      KCAL: 23,
    },
  },
};

async function main() {
  const args = process.argv.slice(2);
  const listMethodsIdx = args.indexOf('--list-methods');
  const listFactorsIdx = args.indexOf('--list-factors');
  const listNutritionIdx = args.indexOf('--list-nutrition');
  const helpIdx = args.indexOf('--help');

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║         UltraLife Protocol — Measurement Helper               ║
║                                                               ║
║   "We don't guess. We measure. Then we verify."               ║
╚═══════════════════════════════════════════════════════════════╝
`);

  if (helpIdx >= 0 || args.length === 0) {
    console.log(`
This tool helps gather measurements for impact transactions.
The validator doesn't care HOW you measured - it validates THAT you measured.

Commands:
  --list-methods      Show measurement methods and confidence ranges
  --list-factors      Show conversion factors (fuel, electricity, transport)
  --list-nutrition    Show nutritional reference values

The output helps you construct --compound arguments for transfers:
  npm run transfer -- --to Alice --amount 10 \\
    --compound CO2:-450:75 \\
    --compound PROT:+25:90 \\
    --desc "Measured: scale weight, fuel receipt calculation, USDA nutrition"

Remember:
  - All values must be measured or calculated for YOUR specific context
  - Confidence reflects measurement quality, not certainty
  - Provisional estimates must be verified or confidence decays
  - Nature provides - measure what nature gives vs industrial alternatives
`);
    return;
  }

  if (listMethodsIdx >= 0) {
    console.log('MEASUREMENT METHODS:\n');
    for (const [key, method] of Object.entries(MEASUREMENT_METHODS)) {
      console.log(`  ${key.toUpperCase()}`);
      console.log(`    ${method.description}`);
      console.log(`    Confidence: ${method.confidence_range[0]}-${method.confidence_range[1]}%`);
      console.log(`    Requires: ${method.requires}`);
      if (method.warning) console.log(`    ⚠️  ${method.warning}`);
      if (method.example) console.log(`    Example: ${method.example}`);
      console.log('');
    }
    return;
  }

  if (listFactorsIdx >= 0) {
    console.log('CONVERSION FACTORS (reference values - verify for your context):\n');

    console.log('FUEL COMBUSTION:');
    for (const [fuel, data] of Object.entries(CONVERSION_FACTORS.fuel)) {
      const key = Object.keys(data).find(k => k.startsWith('CO2'));
      console.log(`  ${fuel.padEnd(15)} ${data[key]} ${data.unit} CO2 per ${key.split('_')[2]} (${data.source}, ${data.confidence}% conf)`);
    }

    console.log('\nELECTRICITY (varies by region):');
    for (const [region, data] of Object.entries(CONVERSION_FACTORS.electricity)) {
      if (data.CO2_per_kWh) {
        console.log(`  ${region.padEnd(15)} ${data.CO2_per_kWh} ${data.unit} CO2/kWh (${data.source}, ${data.confidence}% conf)`);
      }
    }

    console.log('\nTRANSPORT (per km, varies by vehicle/load):');
    for (const [mode, data] of Object.entries(CONVERSION_FACTORS.transport)) {
      if (data.CO2_per_km) {
        console.log(`  ${mode.padEnd(15)} ${data.CO2_per_km} ${data.unit} CO2/km (${data.confidence}% conf)`);
      }
    }

    console.log('\n⚠️  These are reference values. Measure actual consumption when possible.');
    return;
  }

  if (listNutritionIdx >= 0) {
    console.log('NUTRITIONAL REFERENCE (USDA FoodData Central, per 100g raw):\n');
    for (const [food, data] of Object.entries(NUTRITIONAL_REFERENCE)) {
      console.log(`  ${food.toUpperCase().replace(/_/g, ' ')}`);
      const nutrients = Object.entries(data.per_100g)
        .map(([k, v]) => `${k}:${v}`)
        .join(', ');
      console.log(`    ${nutrients}`);
      if (data.note) console.log(`    Note: ${data.note}`);
      console.log('');
    }
    console.log('⚠️  Actual values vary by source, preparation, and individual product.');
    console.log('    Use these as starting points, then measure/verify for your context.');
    return;
  }
}

main().catch(console.error);
