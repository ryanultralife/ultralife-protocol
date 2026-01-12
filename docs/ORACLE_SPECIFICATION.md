# Oracle Specification

## Overview

UltraLife Protocol requires real-world data feeds for accurate impact tracking, UBI calculation, and ecosystem health monitoring. This document specifies the oracle architecture.

## Oracle Types

### 1. Price Oracles

Feed real-world prices into the system for UBI calculation.

```
┌─────────────────────────────────────────────────────────────────┐
│                      PRICE ORACLE                                │
├─────────────────────────────────────────────────────────────────┤
│  Data Points:                                                    │
│  - Food basket prices (by bioregion)                            │
│  - Housing costs (by locale)                                     │
│  - Energy prices (by type and region)                           │
│  - Healthcare costs (by service type)                           │
│  - Transportation costs                                          │
├─────────────────────────────────────────────────────────────────┤
│  Update Frequency: Daily                                         │
│  Sources: Transaction medians + external feeds                   │
└─────────────────────────────────────────────────────────────────┘
```

**Datum Structure:**
```aiken
type PriceOracleDatum {
  oracle_id: ByteArray,
  bioregion: ByteArray,
  prices: List<PricePoint>,
  updated_at: Int,
  update_count: Int,
  signature: ByteArray,
}

type PricePoint {
  category: PriceCategory,      // Food, Housing, Energy, Healthcare, Transport
  item_code: ByteArray,         // Specific item identifier
  median_price: Int,            // In UltraLife tokens (smallest unit)
  sample_size: Int,             // Number of transactions
  confidence: Int,              // 0-100
}
```

### 2. Environmental Oracles

Feed ecosystem health data from sensors and surveys.

```
┌─────────────────────────────────────────────────────────────────┐
│                  ENVIRONMENTAL ORACLE                            │
├─────────────────────────────────────────────────────────────────┤
│  Data Points:                                                    │
│  - Air quality (PM2.5, PM10, O3, CO2)                           │
│  - Water quality (pH, dissolved O2, turbidity)                  │
│  - Soil health (carbon, nitrogen, microbial)                    │
│  - Biodiversity indices                                          │
│  - Temperature and precipitation                                 │
├─────────────────────────────────────────────────────────────────┤
│  Update Frequency: Varies (hourly to seasonal)                   │
│  Sources: IoT sensors, surveyor reports, satellite data          │
└─────────────────────────────────────────────────────────────────┘
```

**Datum Structure:**
```aiken
type EnvironmentalOracleDatum {
  oracle_id: ByteArray,
  location_hash: ByteArray,
  bioregion: ByteArray,
  measurements: List<EnvironmentalMeasurement>,
  measured_at: Int,
  sensor_ids: List<ByteArray>,
  surveyor_verification: Option<AssetName>,
}

type EnvironmentalMeasurement {
  metric: EnvironmentalMetric,
  value: Int,                    // Scaled integer
  unit: ByteArray,               // Unit identifier
  quality: DataQuality,          // Raw, Validated, Verified
}

type EnvironmentalMetric {
  AirQuality_PM25
  AirQuality_PM10
  AirQuality_O3
  AirQuality_CO2
  WaterQuality_pH
  WaterQuality_DO
  WaterQuality_Turbidity
  SoilHealth_Carbon
  SoilHealth_Nitrogen
  SoilHealth_Microbial
  Biodiversity_Index
  Temperature
  Precipitation
}
```

### 3. Impact Verification Oracles

Verify claimed impacts through independent measurement.

```
┌─────────────────────────────────────────────────────────────────┐
│                IMPACT VERIFICATION ORACLE                        │
├─────────────────────────────────────────────────────────────────┤
│  Data Points:                                                    │
│  - Carbon sequestration (verified)                              │
│  - Emissions measurements                                        │
│  - Habitat restoration progress                                  │
│  - Species population counts                                     │
│  - Water flow and quality                                        │
├─────────────────────────────────────────────────────────────────┤
│  Update Frequency: Per survey/verification event                 │
│  Sources: Certified surveyors, automated sensors                 │
└─────────────────────────────────────────────────────────────────┘
```

**Datum Structure:**
```aiken
type ImpactVerificationDatum {
  verification_id: ByteArray,
  land_id: Option<ByteArray>,
  project_id: Option<ByteArray>,
  category: ImpactCategory,
  claimed_magnitude: Int,
  verified_magnitude: Int,
  verification_method: VerificationMethod,
  verifiers: List<AssetName>,    // Surveyor pNFTs
  evidence_hash: ByteArray,
  verified_at: Int,
}

type VerificationMethod {
  DirectMeasurement             // Sensor reading
  SurveyorAttestation          // Certified surveyor
  SatelliteImagery             // Remote sensing
  MultiSourceAggregation       // Combined sources
  PeerVerification             // Community attestation
}
```

### 4. Population Oracles

Track human population by bioregion for UBI distribution.

```
┌─────────────────────────────────────────────────────────────────┐
│                    POPULATION ORACLE                             │
├─────────────────────────────────────────────────────────────────┤
│  Data Points:                                                    │
│  - Verified pNFT count per bioregion                            │
│  - Active participants (transacted in last cycle)               │
│  - New verifications                                             │
│  - Migration patterns                                            │
├─────────────────────────────────────────────────────────────────┤
│  Update Frequency: Per cycle                                     │
│  Sources: On-chain pNFT registry                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Datum Structure:**
```aiken
type PopulationOracleDatum {
  bioregion: ByteArray,
  cycle: Int,
  total_verified: Int,
  active_count: Int,
  new_verifications: Int,
  departures: Int,
  arrivals: Int,
  updated_at: Int,
}
```

### 5. Carrying Capacity Oracles

Ecological limits for UBI calculation.

```
┌─────────────────────────────────────────────────────────────────┐
│                CARRYING CAPACITY ORACLE                          │
├─────────────────────────────────────────────────────────────────┤
│  Data Points:                                                    │
│  - Sustainable population estimate                               │
│  - Resource availability (water, food, energy)                   │
│  - Ecological footprint capacity                                 │
│  - Infrastructure capacity                                       │
├─────────────────────────────────────────────────────────────────┤
│  Update Frequency: Seasonal or annual                            │
│  Sources: Ecological surveys, resource assessments               │
└─────────────────────────────────────────────────────────────────┘
```

**Datum Structure:**
```aiken
type CarryingCapacityDatum {
  bioregion: ByteArray,
  assessment_date: Int,
  sustainable_population: Int,
  current_population: Int,
  resource_limits: List<ResourceLimit>,
  health_index: Int,             // 0-100
  trend: CapacityTrend,
  surveyor: AssetName,
  methodology_hash: ByteArray,
}

type ResourceLimit {
  resource_type: ResourceType,
  sustainable_rate: Int,
  current_rate: Int,
  status: ResourceStatus,        // Sustainable, Stressed, Critical
}
```

## Oracle Registration

Oracles are registered through the Genesis contract:

```aiken
// From genesis.ak
RegisterOracle { 
  oracle_id: ByteArray, 
  oracle_type: OracleType,
  public_key: VerificationKeyHash, 
  metadata_hash: ByteArray 
}
```

**Requirements:**
- Steward-level multi-sig approval
- Stake requirement (prevents spam)
- Public key for signature verification
- Metadata describing data sources and methodology

## Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   SENSORS   │────▶│   ORACLE    │────▶│  VALIDATOR  │
│  IoT/Manual │     │  CONTRACT   │     │  CONTRACTS  │
└─────────────┘     └─────────────┘     └─────────────┘
                          │
                          ▼
                    ┌─────────────┐
                    │  ON-CHAIN   │
                    │   DATUM     │
                    └─────────────┘
```

### Update Flow

1. **Data Collection**: Sensors or surveyors collect data
2. **Aggregation**: Oracle operator aggregates and validates
3. **Signing**: Operator signs with registered key
4. **Submission**: Update transaction submitted to oracle contract
5. **Validation**: Contract verifies signature and data bounds
6. **Storage**: New datum stored on-chain
7. **Consumption**: Validators reference oracle datum in transactions

## Oracle Contract

```aiken
validator oracle {
  spend(
    datum: OracleDatum,
    redeemer: OracleRedeemer,
    ctx: ScriptContext,
  ) -> Bool {
    when redeemer is {
      UpdateData { new_data, signature } -> {
        // Verify oracle is registered
        let registered = verify_oracle_registered(ctx, datum.oracle_id)
        
        // Verify signature from registered key
        let valid_sig = verify_signature(ctx, datum.public_key, new_data, signature)
        
        // Verify data within acceptable bounds
        let valid_bounds = verify_data_bounds(datum.oracle_type, new_data)
        
        // Verify update frequency respected
        let valid_timing = verify_update_timing(datum, ctx)
        
        // Verify output continues oracle
        let valid_output = verify_oracle_continued(ctx, datum.oracle_id, new_data)
        
        registered && valid_sig && valid_bounds && valid_timing && valid_output
      }
      
      DeactivateOracle -> {
        // Requires governance approval
        verify_governance_approval(ctx, datum.oracle_id)
      }
    }
  }
}
```

## Consuming Oracle Data

Validators consume oracle data through reference inputs:

```aiken
// In ubi.ak - consuming price oracle for UBI calculation
fn get_cost_of_living(tx: Transaction, bioregion: ByteArray) -> CostOfLiving {
  // Find price oracle in reference inputs
  let price_oracle = list.find(tx.reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect oracle: PriceOracleDatum = data
        oracle.bioregion == bioregion
      }
      _ -> False
    }
  })
  
  expect Some(oracle_input) = price_oracle
  expect InlineDatum(data) = oracle_input.output.datum
  expect oracle: PriceOracleDatum = data
  
  // Extract relevant prices
  CostOfLiving {
    food: find_price(oracle.prices, "FOOD_BASKET"),
    housing: find_price(oracle.prices, "HOUSING_MEDIAN"),
    energy: find_price(oracle.prices, "ENERGY_BASIC"),
    healthcare: find_price(oracle.prices, "HEALTHCARE_BASIC"),
    transport: find_price(oracle.prices, "TRANSPORT_BASIC"),
  }
}
```

## Decentralized Oracle Network

For critical data, multiple oracles can be aggregated:

```aiken
fn aggregate_environmental_data(
  tx: Transaction, 
  location: ByteArray,
  metric: EnvironmentalMetric
) -> AggregatedMeasurement {
  // Find all environmental oracles for this location
  let oracle_data = list.filter_map(tx.reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect oracle: EnvironmentalOracleDatum = data
        if oracle.location_hash == location {
          find_measurement(oracle.measurements, metric)
        } else {
          None
        }
      }
      _ -> None
    }
  })
  
  // Require minimum number of oracles
  expect list.length(oracle_data) >= 3
  
  // Calculate median value
  let median = calculate_median(list.map(oracle_data, fn(m) { m.value }))
  
  // Calculate confidence based on agreement
  let confidence = calculate_confidence(oracle_data, median)
  
  AggregatedMeasurement {
    metric: metric,
    value: median,
    oracle_count: list.length(oracle_data),
    confidence: confidence,
  }
}
```

## Security Considerations

### Attack Vectors

1. **Data Manipulation**: Corrupt oracle submits false data
   - Mitigation: Stake slashing, multi-oracle aggregation
   
2. **Front-Running**: Observing oracle updates to front-run
   - Mitigation: Commit-reveal schemes for sensitive data
   
3. **Stale Data**: Using outdated oracle data
   - Mitigation: Timestamp validation in validators
   
4. **Centralization**: Single oracle controls critical data
   - Mitigation: Required minimum oracle count for aggregation

### Stake and Slashing

```aiken
type OracleStake {
  oracle_id: ByteArray,
  stake_amount: Int,
  slash_events: List<SlashEvent>,
  reputation_score: Int,
}

// Oracles must stake tokens
// False data results in stake slashing
// Consistent accuracy increases reputation
```

## Integration Checklist

- [ ] Deploy oracle registration in Genesis
- [ ] Deploy price oracle contract
- [ ] Deploy environmental oracle contract  
- [ ] Deploy impact verification oracle contract
- [ ] Deploy population oracle contract
- [ ] Deploy carrying capacity oracle contract
- [ ] Set up oracle operator infrastructure
- [ ] Connect IoT sensors (environmental)
- [ ] Connect surveyor reporting interface
- [ ] Implement multi-oracle aggregation
- [ ] Set up monitoring and alerting
- [ ] Implement stake and slashing mechanism
