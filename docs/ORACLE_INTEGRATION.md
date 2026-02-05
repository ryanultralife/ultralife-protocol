# Oracle Integration Guide

This document describes how to integrate external oracles with the UltraLife Protocol for real-world data feeds.

## Overview

UltraLife Protocol requires reliable external data for:
- Price feeds for UBI calculation
- Environmental measurements for impact verification
- Population health indices for compound prioritization
- Carrying capacity assessments for bioregions

## Supported Oracle Providers

### Charli3 (Recommended for Cardano)

Charli3 is a native Cardano oracle solution providing decentralized data feeds.

**Installation:**
```bash
npm install @charli3/sdk
```

**Configuration:**
```javascript
// config.mjs
export const ORACLE_CONFIG = {
  charli3: {
    network: process.env.NETWORK || 'preprod',
    apiKey: process.env.CHARLI3_API_KEY,
    feedAddresses: {
      ADA_USD: 'addr_test1...',
      ULTRA_ADA: 'addr_test1...',
      // Custom feeds
      FOOD_BASKET: 'addr_test1...',
      ENERGY_PRICE: 'addr_test1...',
    },
    updateInterval: 3600, // seconds
    staleness: 7200, // max age before rejecting
  },
};
```

**Usage Example:**
```javascript
import { Charli3Client } from '@charli3/sdk';
import { ORACLE_CONFIG } from './config.mjs';

const client = new Charli3Client(ORACLE_CONFIG.charli3);

// Fetch price feed
async function getPrice(feedName) {
  const feed = await client.getFeed(ORACLE_CONFIG.charli3.feedAddresses[feedName]);

  // Validate staleness
  const age = Date.now() / 1000 - feed.timestamp;
  if (age > ORACLE_CONFIG.charli3.staleness) {
    throw new Error(`Feed ${feedName} is stale: ${age}s old`);
  }

  return {
    price: feed.value,
    confidence: feed.confidence,
    timestamp: feed.timestamp,
    sources: feed.sourceCount,
  };
}
```

### Switchboard

Switchboard provides cross-chain oracle services with Cardano support.

**Installation:**
```bash
npm install @switchboard-xyz/cardano-sdk
```

**Configuration:**
```javascript
// config.mjs
export const ORACLE_CONFIG = {
  switchboard: {
    network: process.env.NETWORK || 'preprod',
    programId: 'sw1tch...',
    feeds: {
      CARBON_PRICE: 'feed_carbon_001',
      WATER_QUALITY: 'feed_water_001',
      BIODIVERSITY_INDEX: 'feed_bio_001',
    },
    minConfirmations: 3,
    maxStaleness: 3600,
  },
};
```

**Usage Example:**
```javascript
import { SwitchboardClient } from '@switchboard-xyz/cardano-sdk';
import { ORACLE_CONFIG } from './config.mjs';

const switchboard = new SwitchboardClient({
  network: ORACLE_CONFIG.switchboard.network,
  programId: ORACLE_CONFIG.switchboard.programId,
});

async function getEnvironmentalData(feedId) {
  const aggregator = await switchboard.loadAggregator(feedId);
  const result = await aggregator.loadCurrentValue();

  return {
    value: result.value,
    confidence: result.stdDeviation,
    timestamp: result.timestamp,
    oracleCount: result.oracleCount,
  };
}
```

## Oracle Types and Data Feeds

### 1. Price Oracles

Feed real-world prices for UBI calculation and marketplace pricing.

**Required Feeds:**
| Feed | Update Frequency | Sources |
|------|------------------|---------|
| ADA/USD | Every 5 minutes | Aggregated exchanges |
| ULTRA/ADA | Every 5 minutes | DEX pools |
| Food Basket (by bioregion) | Daily | Transaction medians + external |
| Housing Index | Weekly | Regional housing data |
| Energy Price | Hourly | Utility APIs |

**Datum Structure:**
```aiken
type PriceOracleDatum {
  oracle_id: ByteArray,
  bioregion: ByteArray,
  prices: List<PricePoint>,
  updated_at: Int,           // Slot number
  update_count: Int,
  signature: ByteArray,
}

type PricePoint {
  category: PriceCategory,   // Food, Housing, Energy, Healthcare, Transport
  item_code: ByteArray,      // Specific item identifier
  median_price: Int,         // In smallest unit
  sample_size: Int,          // Number of data points
  confidence: Int,           // 0-100
}
```

**Integration Example:**
```javascript
async function updatePriceOracle(bioregion) {
  // Collect price data
  const foodPrices = await fetchFoodBasketPrices(bioregion);
  const energyPrices = await fetchEnergyPrices(bioregion);
  const housingPrices = await fetchHousingIndex(bioregion);

  // Aggregate and validate
  const pricePoints = [
    {
      category: 'Food',
      item_code: 'FOOD_BASKET',
      median_price: calculateMedian(foodPrices),
      sample_size: foodPrices.length,
      confidence: calculateConfidence(foodPrices),
    },
    // ... more price points
  ];

  // Build oracle update transaction
  const datum = {
    oracle_id: ORACLE_ID,
    bioregion: bioregion,
    prices: pricePoints,
    updated_at: currentSlot,
    update_count: previousCount + 1,
    signature: signData(pricePoints),
  };

  return submitOracleUpdate(datum);
}
```

### 2. Environmental Oracles

Feed ecosystem health data from sensors and surveys.

**Required Feeds:**
| Metric | Unit | Update Frequency | Source |
|--------|------|------------------|--------|
| Air Quality (PM2.5) | ug/m3 | Hourly | IoT sensors |
| Air Quality (CO2) | ppm | Hourly | Sensors |
| Water pH | pH | Daily | Watershed monitors |
| Soil Carbon | g/kg | Seasonal | Lab tests |
| Biodiversity Index | idx | Monthly | Surveys |

**Datum Structure:**
```aiken
type EnvironmentalOracleDatum {
  oracle_id: ByteArray,
  location_hash: ByteArray,      // Geohash or boundary
  bioregion: ByteArray,
  measurements: List<Measurement>,
  measured_at: Int,              // Slot number
  sensor_ids: List<ByteArray>,
  surveyor_pnft: Option<AssetName>,
}

type Measurement {
  metric: EnvironmentalMetric,
  value: Int,                    // Scaled integer
  unit: ByteArray,
  quality: DataQuality,          // Raw, Validated, Verified
}
```

**Sensor Integration:**
```javascript
// IoT sensor configuration
const SENSOR_CONFIG = {
  airQuality: {
    endpoints: [
      'https://api.purpleair.com/v1/sensors',
      'https://api.openaq.org/v1/measurements',
    ],
    pollInterval: 3600000, // 1 hour
    aggregation: 'median',
  },
  waterQuality: {
    endpoints: [
      'https://waterdata.usgs.gov/nwis',
    ],
    pollInterval: 86400000, // 24 hours
  },
};

async function collectEnvironmentalData(bioregion) {
  const airData = await fetchAirQuality(bioregion);
  const waterData = await fetchWaterQuality(bioregion);

  return {
    measurements: [
      {
        metric: 'AirQuality_PM25',
        value: Math.round(airData.pm25 * 100), // Scale to integer
        unit: 'ug_m3_x100',
        quality: 'Validated',
      },
      {
        metric: 'WaterQuality_pH',
        value: Math.round(waterData.ph * 100),
        unit: 'pH_x100',
        quality: 'Validated',
      },
    ],
    sensor_ids: airData.sensorIds.concat(waterData.sensorIds),
    measured_at: currentSlot,
  };
}
```

### 3. Impact Verification Oracles

Verify claimed impacts through independent measurement.

**Configuration:**
```javascript
export const IMPACT_ORACLE_CONFIG = {
  // Minimum surveyors for verification
  minSurveyors: 2,

  // Required surveyor level
  minSurveyorLevel: 'Verified', // or 'Steward'

  // Verification methods
  methods: {
    DirectMeasurement: { minConfidence: 90 },
    SurveyorAttestation: { minConfidence: 85 },
    SatelliteImagery: { minConfidence: 75 },
    MultiSourceAggregation: { minConfidence: 80 },
    PeerVerification: { minConfidence: 70 },
  },

  // Category-specific requirements
  categories: {
    Carbon: {
      methods: ['DirectMeasurement', 'SatelliteImagery', 'SurveyorAttestation'],
      minSurveyors: 2,
    },
    Water: {
      methods: ['DirectMeasurement', 'SurveyorAttestation'],
      minSurveyors: 1,
    },
    Biodiversity: {
      methods: ['SurveyorAttestation', 'PeerVerification'],
      minSurveyors: 3,
    },
  },
};
```

**Verification Flow:**
```javascript
async function verifyImpact(claimedImpact, surveys) {
  // 1. Check minimum surveyors
  if (surveys.length < IMPACT_ORACLE_CONFIG.minSurveyors) {
    throw new Error('Insufficient surveyors');
  }

  // 2. Validate surveyor credentials
  for (const survey of surveys) {
    const surveyor = await getPnftData(survey.surveyorPnft);
    if (!isLevelSufficient(surveyor.level, IMPACT_ORACLE_CONFIG.minSurveyorLevel)) {
      throw new Error(`Surveyor ${survey.surveyorPnft} insufficient level`);
    }
  }

  // 3. Aggregate measurements
  const measurements = surveys.map(s => s.verifiedMagnitude);
  const median = calculateMedian(measurements);
  const deviation = calculateStdDev(measurements);

  // 4. Compare to claimed
  const ratio = median / claimedImpact.magnitude;
  const confidence = Math.max(0, 100 - (deviation / median) * 100);

  return {
    verified_magnitude: median,
    claimed_magnitude: claimedImpact.magnitude,
    verification_ratio: ratio,
    confidence: Math.round(confidence),
    surveyor_count: surveys.length,
    method: determineMethod(surveys),
  };
}
```

### 4. Population Health Oracles

Track population health metrics for compound prioritization.

**Data Sources:**
- Anonymized clinic data
- Public health records
- Voluntary health sharing via pNFT
- Blood test aggregates

**Configuration:**
```javascript
export const POPULATION_ORACLE_CONFIG = {
  // Update frequency
  updateCycles: 1, // Every PRC-37 cycle (37 days)

  // Privacy settings
  minAggregationSize: 50, // Minimum people for reporting

  // Health metrics
  metrics: {
    DEFICIENCY_IRON: { threshold: 0.15, priority: 'high' },
    DEFICIENCY_B12: { threshold: 0.10, priority: 'high' },
    DEFICIENCY_VIT_D: { threshold: 0.20, priority: 'medium' },
    CHRONIC_DIABETES: { threshold: 0.08, priority: 'high' },
    CHRONIC_HEART: { threshold: 0.05, priority: 'high' },
  },

  // Correlation tracking
  correlations: {
    minDataPoints: 100,
    significanceLevel: 0.05,
  },
};
```

**Datum Structure:**
```aiken
type PopulationOracleDatum {
  bioregion: ByteArray,
  cycle: Int,
  total_verified: Int,
  active_count: Int,
  health_metrics: List<HealthMetric>,
  deficiency_rates: List<(ByteArray, Int)>,  // (compound, rate_per_10000)
  chronic_rates: List<(ByteArray, Int)>,
  updated_at: Int,
}

type HealthMetric {
  metric_code: ByteArray,
  value: Int,
  population_size: Int,
  confidence: Int,
}
```

### 5. Carrying Capacity Oracles

Ecological limits for sustainable population.

**Configuration:**
```javascript
export const CARRYING_CAPACITY_CONFIG = {
  // Resource limits
  resources: {
    water: {
      unit: 'liters_per_day',
      sustainable_per_capita: 200,
      stress_threshold: 0.8,
      critical_threshold: 0.95,
    },
    food: {
      unit: 'calories_per_day',
      sustainable_per_capita: 2500,
      local_production_target: 0.7,
    },
    energy: {
      unit: 'kwh_per_day',
      sustainable_per_capita: 30,
      renewable_target: 0.8,
    },
  },

  // Assessment frequency
  updateFrequency: 'seasonal', // or 'annual'

  // Methodology
  methodology: 'ecological_footprint', // or 'biocapacity'
};
```

## Oracle Registration

Oracles must be registered through the Genesis contract.

**Registration Requirements:**
1. Steward-level multi-sig approval
2. Stake requirement (prevents spam)
3. Public key for signature verification
4. Metadata describing methodology

**Registration Transaction:**
```javascript
async function registerOracle(oracleConfig) {
  const redeemer = {
    RegisterOracle: {
      oracle_id: oracleConfig.id,
      oracle_type: oracleConfig.type,
      public_key: oracleConfig.publicKey,
      metadata_hash: hashMetadata(oracleConfig.metadata),
    },
  };

  // Build transaction with steward signatures
  const tx = await buildOracleRegistration(redeemer, oracleConfig.stewardSignatures);
  return submitTransaction(tx);
}
```

## Data Flow Architecture

```
                          +------------------+
                          |  External APIs   |
                          |  (Sensors, DBs)  |
                          +--------+---------+
                                   |
                          +--------v---------+
                          |  Oracle Operator |
                          |  (Aggregation)   |
                          +--------+---------+
                                   |
                          +--------v---------+
                          |  Signing (PKH)   |
                          +--------+---------+
                                   |
                          +--------v---------+
                          |  Oracle Contract |
                          |  (Validation)    |
                          +--------+---------+
                                   |
                          +--------v---------+
                          |  On-Chain Datum  |
                          +--------+---------+
                                   |
              +--------------------+--------------------+
              |                    |                    |
     +--------v-------+   +--------v-------+   +--------v-------+
     | UBI Validator  |   | Impact Market  |   | Governance     |
     +----------------+   +----------------+   +----------------+
```

## Security Considerations

### Multi-Oracle Aggregation

For critical data, use multiple oracles:

```javascript
async function getAggregatedPrice(category, bioregion) {
  // Fetch from multiple oracles
  const oracles = await getRegisteredOracles(category, bioregion);

  if (oracles.length < 3) {
    throw new Error('Insufficient oracle coverage');
  }

  const prices = await Promise.all(
    oracles.map(o => fetchOraclePrice(o, category))
  );

  // Filter stale data
  const freshPrices = prices.filter(p =>
    Date.now() / 1000 - p.timestamp < MAX_STALENESS
  );

  if (freshPrices.length < 2) {
    throw new Error('Insufficient fresh data');
  }

  // Calculate median (resistant to manipulation)
  return {
    price: calculateMedian(freshPrices.map(p => p.value)),
    confidence: calculateAggregateConfidence(freshPrices),
    oracleCount: freshPrices.length,
  };
}
```

### Stake and Slashing

Oracles must stake tokens to participate:

```javascript
export const ORACLE_STAKE_CONFIG = {
  // Minimum stake by oracle type
  minStake: {
    Price: 10000,        // 10,000 ULTRA
    Environmental: 5000,  // 5,000 ULTRA
    Impact: 15000,       // 15,000 ULTRA
    Population: 20000,   // 20,000 ULTRA
  },

  // Slashing conditions
  slashing: {
    // Deviation from consensus > 20%
    deviationThreshold: 0.20,
    deviationPenalty: 0.10, // 10% of stake

    // Stale data (missed updates)
    missedUpdates: 3,
    missPenalty: 0.05, // 5% per miss

    // Proven false data
    falsePenalty: 1.0, // 100% of stake
  },

  // Reputation system
  reputation: {
    initialScore: 50,
    maxScore: 100,
    accuracyBonus: 1,    // Per accurate update
    inaccuracyPenalty: 5, // Per inaccurate update
  },
};
```

### Timestamp Validation

Always validate oracle timestamps:

```javascript
function validateOracleData(datum, currentSlot) {
  // Check staleness
  const age = currentSlot - datum.updated_at;
  const maxAge = getMaxStaleness(datum.oracle_type);

  if (age > maxAge) {
    throw new Error(`Oracle data stale: ${age} slots old, max ${maxAge}`);
  }

  // Check update frequency
  if (datum.update_count > 0) {
    const expectedUpdates = Math.floor(age / getUpdateInterval(datum.oracle_type));
    if (expectedUpdates - datum.update_count > 2) {
      console.warn('Oracle may have missed updates');
    }
  }

  return true;
}
```

## Integration Checklist

- [ ] Choose oracle provider (Charli3, Switchboard, or custom)
- [ ] Configure API keys and endpoints
- [ ] Register oracle through Genesis contract
- [ ] Implement data collection pipeline
- [ ] Set up aggregation and validation
- [ ] Deploy oracle update scripts
- [ ] Configure monitoring and alerting
- [ ] Test staleness handling
- [ ] Implement failover for multiple sources
- [ ] Set up stake management
- [ ] Document methodology for transparency

## Example: Complete Price Oracle Setup

```javascript
// oracle-price.mjs
import { BlockfrostProvider, MeshWallet, MeshTxBuilder } from '@meshsdk/core';
import { config } from './config.mjs';

const PRICE_ORACLE_CONFIG = {
  oracleId: 'price_oracle_001',
  updateInterval: 3600, // 1 hour
  sources: [
    { name: 'coinmarketcap', weight: 0.4 },
    { name: 'coingecko', weight: 0.3 },
    { name: 'blockfrost', weight: 0.3 },
  ],
};

async function runPriceOracle() {
  const provider = new BlockfrostProvider(config.blockfrostKey);
  const wallet = new MeshWallet({
    networkId: config.network === 'mainnet' ? 1 : 0,
    fetcher: provider,
    submitter: provider,
    key: { type: 'mnemonic', words: config.oracleMnemonic.split(' ') },
  });

  while (true) {
    try {
      // 1. Fetch prices from all sources
      const prices = await fetchAllPrices();

      // 2. Calculate weighted average
      const weightedPrice = calculateWeightedPrice(prices, PRICE_ORACLE_CONFIG.sources);

      // 3. Build datum
      const currentSlot = await getCurrentSlot(provider);
      const datum = {
        oracle_id: PRICE_ORACLE_CONFIG.oracleId,
        prices: [
          {
            category: 'Crypto',
            item_code: 'ADA_USD',
            median_price: Math.round(weightedPrice.ADA_USD * 1000000),
            sample_size: prices.length,
            confidence: weightedPrice.confidence,
          },
        ],
        updated_at: currentSlot,
        update_count: await getUpdateCount() + 1,
      };

      // 4. Submit update
      const tx = await buildOracleUpdateTx(wallet, datum);
      const txHash = await provider.submitTx(tx);
      console.log(`Oracle updated: ${txHash}`);

    } catch (error) {
      console.error('Oracle update failed:', error.message);
    }

    // Wait for next update interval
    await sleep(PRICE_ORACLE_CONFIG.updateInterval * 1000);
  }
}

runPriceOracle();
```

## Monitoring

Set up monitoring for oracle health:

```javascript
// oracle-monitor.mjs
export const MONITORING_CONFIG = {
  alerts: {
    staleness: {
      warning: 0.8,  // 80% of max staleness
      critical: 1.0, // At max staleness
    },
    deviation: {
      warning: 0.10, // 10% from consensus
      critical: 0.20, // 20% from consensus
    },
    missedUpdates: {
      warning: 1,
      critical: 3,
    },
  },

  endpoints: {
    slack: process.env.SLACK_WEBHOOK,
    email: process.env.ALERT_EMAIL,
    pagerduty: process.env.PAGERDUTY_KEY,
  },
};
```
