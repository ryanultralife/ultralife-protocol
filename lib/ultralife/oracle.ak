// =============================================================================
// UltraLife Protocol - Charli3 Oracle Integration
// =============================================================================
//
// Provides trustless verification of real-world environmental data.
// Integrates with Charli3 oracle feeds for:
// - Environmental sensor data (CO2, temperature, humidity, air quality)
// - Satellite/remote sensing data for bioregion health
// - Price feeds for impact token valuation
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{Blake2b_224, Hash, Script, VerificationKeyHash}
use aiken/interval.{Finite}
use cardano/assets.{AssetName, PolicyId, flatten}
use cardano/transaction.{InlineDatum, Input, Transaction}

// =============================================================================
// CHARLI3 ORACLE DATUM TYPES
// =============================================================================

/// Validator hash type for oracle identification
pub type ValidatorHash =
  Hash<Blake2b_224, Script>

/// Price map - key-value pairs for oracle data
/// Index 0: price/value
/// Index 1: timestamp
/// Index 2: expiry
pub type PriceMap =
  Pairs<Int, Int>

/// Oracle data variants for different use cases
pub type OracleData {
  /// Shared data for multi-oracle consensus
  SharedData
  /// Extended data for additional oracle features
  ExtendedData
  /// Generic data with price map (most common)
  GenericData { price_map: PriceMap }
}

/// Main oracle datum structure (Charli3 compatible)
pub type OracleDatum {
  price_data: OracleData,
}

// =============================================================================
// ULTRALIFE ORACLE EXTENSIONS
// =============================================================================

/// Environmental data feed types
pub type EnvironmentalFeedType {
  /// CO2 concentration in ppm
  CO2Concentration
  /// Temperature in Celsius * 100 (for precision)
  Temperature
  /// Humidity percentage * 100
  Humidity
  /// Air Quality Index
  AirQualityIndex
  /// Water Quality Index
  WaterQualityIndex
  /// Soil moisture percentage * 100
  SoilMoisture
  /// NDVI (Normalized Difference Vegetation Index) * 10000
  NDVI
  /// Carbon sequestration rate kg/ha/day * 100
  CarbonSequestration
  /// Biodiversity index * 100
  BiodiversityIndex
  /// Custom environmental metric
  CustomEnvironmental { metric_code: ByteArray }
}

/// Oracle feed configuration for UltraLife
pub type OracleFeedConfig {
  /// Charli3 oracle policy ID
  oracle_policy: PolicyId,
  /// Oracle operator verification key
  oracle_operator: VerificationKeyHash,
  /// Feed identifier
  feed_id: ByteArray,
  /// Expected data type
  feed_type: EnvironmentalFeedType,
  /// Maximum age in slots (staleness check)
  max_age_slots: Int,
  /// Minimum confidence threshold (0-100)
  min_confidence: Int,
}

/// Environmental oracle reading with metadata
pub type EnvironmentalReading {
  /// Feed type
  feed_type: EnvironmentalFeedType,
  /// Value (scaled integer)
  value: Int,
  /// Unit code
  unit: ByteArray,
  /// Measurement timestamp (slot)
  timestamp: Int,
  /// Data source identifier
  source_id: ByteArray,
  /// Confidence score (0-100)
  confidence: Int,
  /// Expiry timestamp
  expiry: Int,
}

/// Aggregated oracle data for bioregion health
pub type BioregionOracleData {
  /// Bioregion identifier
  bioregion_id: ByteArray,
  /// Multiple environmental readings
  readings: List<EnvironmentalReading>,
  /// Computed health index (0-10000)
  computed_health_index: Int,
  /// Oracle consensus achieved
  oracle_count: Int,
  /// Minimum oracle consensus required
  min_oracle_consensus: Int,
  /// Data collection slot
  collection_slot: Int,
}

/// Impact verification oracle data
pub type ImpactOracleData {
  /// Impact claim being verified
  claim_id: ByteArray,
  /// Claimed compound code
  compound: ByteArray,
  /// Claimed quantity
  claimed_quantity: Int,
  /// Oracle-verified quantity
  verified_quantity: Int,
  /// Verification method
  verification_method: VerificationMethod,
  /// Satellite/sensor reference
  sensor_reference: ByteArray,
  /// Verification timestamp
  verified_at: Int,
  /// Verification confidence (0-100)
  confidence: Int,
}

/// Methods for oracle verification
pub type VerificationMethod {
  /// Satellite imagery analysis
  SatelliteImagery { satellite_id: ByteArray, resolution_m: Int }
  /// Ground sensor network
  GroundSensors { sensor_network: ByteArray, sensor_count: Int }
  /// IoT device mesh
  IoTMesh { mesh_id: ByteArray, device_count: Int }
  /// Third-party attestation
  ThirdPartyAttestation { attestor_id: ByteArray }
  /// Multi-source aggregation
  MultiSource { sources: List<ByteArray> }
}

// =============================================================================
// CHARLI3 HELPER FUNCTIONS
// =============================================================================

/// Get price/value from oracle datum
pub fn get_oracle_value(datum: OracleDatum) -> Int {
  get_price(datum.price_data)
}

/// Get timestamp from oracle datum
pub fn get_oracle_timestamp(datum: OracleDatum) -> Int {
  get_timestamp(datum.price_data)
}

/// Get expiry from oracle datum
pub fn get_oracle_expiry(datum: OracleDatum) -> Int {
  get_expiry(datum.price_data)
}

/// Check if oracle data is valid (not expired)
pub fn is_oracle_valid(datum: OracleDatum, current_time: Int) -> Bool {
  let expiry = get_oracle_expiry(datum)
  current_time < expiry
}

/// Extract price from price data
fn get_price(price_data: OracleData) -> Int {
  when price_data is {
    GenericData { price_map } -> get_value_at_index(price_map, 0)
    _ -> fail @"Oracle price data must be GenericData"
  }
}

/// Extract timestamp from price data
fn get_timestamp(price_data: OracleData) -> Int {
  when price_data is {
    GenericData { price_map } -> get_value_at_index(price_map, 1)
    _ -> fail @"Oracle price data must be GenericData"
  }
}

/// Extract expiry from price data
fn get_expiry(price_data: OracleData) -> Int {
  when price_data is {
    GenericData { price_map } -> get_value_at_index(price_map, 2)
    _ -> fail @"Oracle price data must be GenericData"
  }
}

/// Get value at specific index in price map
fn get_value_at_index(price_map: PriceMap, index: Int) -> Int {
  when price_map is {
    [] -> fail @"Oracle price map missing expected index"
    [Pair(key, value), ..rest] ->
      if key == index {
        value
      } else {
        get_value_at_index(rest, index)
      }
  }
}

/// Create oracle datum with standard structure
pub fn create_oracle_datum(price: Int, timestamp: Int, expiry: Int) -> OracleDatum {
  OracleDatum {
    price_data: GenericData {
      price_map: [Pair(0, price), Pair(1, timestamp), Pair(2, expiry)],
    },
  }
}

// =============================================================================
// ORACLE VALIDATION HELPERS
// =============================================================================

/// Find oracle reference input by policy
pub fn find_oracle_input(
  reference_inputs: List<Input>,
  oracle_policy: PolicyId,
) -> Option<OracleDatum> {
  list.find_map(
    reference_inputs,
    fn(input) {
      let has_oracle =
        list.any(
          flatten(input.output.value),
          fn(asset) {
            let (p, _, qty) = asset
            p == oracle_policy && qty > 0
          },
        )
      if has_oracle {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: OracleDatum = data
            Some(datum)
          }
          _ -> None
        }
      } else {
        None
      }
    },
  )
}

/// Validate oracle data freshness
pub fn validate_oracle_freshness(
  datum: OracleDatum,
  current_slot: Int,
  max_age_slots: Int,
) -> Bool {
  let timestamp = get_oracle_timestamp(datum)
  let age = current_slot - timestamp
  age >= 0 && age <= max_age_slots
}

/// Validate oracle value is within expected range
pub fn validate_oracle_range(datum: OracleDatum, min: Int, max: Int) -> Bool {
  let value = get_oracle_value(datum)
  value >= min && value <= max
}

/// Extract current slot from transaction validity range
pub fn get_tx_slot(tx: Transaction) -> Int {
  when tx.validity_range.lower_bound.bound_type is {
    Finite(slot) -> slot
    _ -> 0
  }
}

// =============================================================================
// ENVIRONMENTAL DATA VALIDATION
// =============================================================================

/// Validate environmental reading meets requirements
pub fn validate_environmental_reading(
  reading: EnvironmentalReading,
  current_slot: Int,
  min_confidence: Int,
) -> Bool {
  // Check reading is not expired
  let not_expired = current_slot < reading.expiry
  // Check confidence meets threshold
  let confidence_ok = reading.confidence >= min_confidence
  // Check reading is not from the future
  let timestamp_ok = reading.timestamp <= current_slot
  not_expired && confidence_ok && timestamp_ok
}

/// Validate bioregion oracle data for health update
pub fn validate_bioregion_oracle_data(
  data: BioregionOracleData,
  bioregion_id: ByteArray,
  current_slot: Int,
  max_age_slots: Int,
) -> Bool {
  // Check correct bioregion
  let bioregion_match = data.bioregion_id == bioregion_id
  // Check oracle consensus
  let has_consensus = data.oracle_count >= data.min_oracle_consensus
  // Check data freshness
  let is_fresh = current_slot - data.collection_slot <= max_age_slots
  // Check health index is valid
  let health_valid = data.computed_health_index >= 0 && data.computed_health_index <= 10000
  // Validate all readings
  let readings_valid =
    list.all(
      data.readings,
      fn(reading) { validate_environmental_reading(reading, current_slot, 50) },
    )
  bioregion_match && has_consensus && is_fresh && health_valid && readings_valid
}

/// Validate impact verification oracle data
pub fn validate_impact_oracle_data(
  data: ImpactOracleData,
  claim_id: ByteArray,
  current_slot: Int,
  max_age_slots: Int,
  min_confidence: Int,
) -> Bool {
  // Check correct claim
  let claim_match = data.claim_id == claim_id
  // Check data freshness
  let is_fresh = current_slot - data.verified_at <= max_age_slots
  // Check confidence threshold
  let confidence_ok = data.confidence >= min_confidence
  // Check verified quantity is reasonable (within 200% of claimed)
  let quantity_reasonable =
    data.verified_quantity >= 0 && data.verified_quantity <= data.claimed_quantity * 2
  claim_match && is_fresh && confidence_ok && quantity_reasonable
}

// =============================================================================
// ORACLE CONSENSUS HELPERS
// =============================================================================

/// Count valid oracle attestations in reference inputs
pub fn count_oracle_attestations(
  reference_inputs: List<Input>,
  oracle_policy: PolicyId,
  current_slot: Int,
) -> Int {
  list.foldl(
    reference_inputs,
    0,
    fn(input, count) {
      let has_oracle =
        list.any(
          flatten(input.output.value),
          fn(asset) {
            let (p, _, qty) = asset
            p == oracle_policy && qty > 0
          },
        )
      if has_oracle {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: OracleDatum = data
            if is_oracle_valid(datum, current_slot) {
              count + 1
            } else {
              count
            }
          }
          _ -> count
        }
      } else {
        count
      }
    },
  )
}

/// Aggregate oracle values with simple average
pub fn aggregate_oracle_values(
  reference_inputs: List<Input>,
  oracle_policy: PolicyId,
  current_slot: Int,
) -> Option<Int> {
  let (sum, count) =
    list.foldl(
      reference_inputs,
      (0, 0),
      fn(input, acc) {
        let (s, c) = acc
        let has_oracle =
          list.any(
            flatten(input.output.value),
            fn(asset) {
              let (p, _, qty) = asset
              p == oracle_policy && qty > 0
            },
          )
        if has_oracle {
          when input.output.datum is {
            InlineDatum(data) -> {
              expect datum: OracleDatum = data
              if is_oracle_valid(datum, current_slot) {
                let value = get_oracle_value(datum)
                (s + value, c + 1)
              } else {
                acc
              }
            }
            _ -> acc
          }
        } else {
          acc
        }
      },
    )
  if count > 0 {
    Some(sum / count)
  } else {
    None
  }
}

// =============================================================================
// TESTS
// =============================================================================

test create_oracle_datum_structure() {
  let datum = create_oracle_datum(5000, 1000, 2000)
  get_oracle_value(datum) == 5000 && get_oracle_timestamp(datum) == 1000 && get_oracle_expiry(
    datum,
  ) == 2000
}

test oracle_valid_before_expiry() {
  let datum = create_oracle_datum(100, 1000, 2000)
  is_oracle_valid(datum, 1500)
}

test oracle_invalid_after_expiry() {
  let datum = create_oracle_datum(100, 1000, 2000)
  !is_oracle_valid(datum, 2500)
}

test validate_oracle_freshness_fresh_data() {
  let datum = create_oracle_datum(100, 1000, 2000)
  validate_oracle_freshness(datum, 1100, 200)
}

test validate_oracle_freshness_stale_data() {
  let datum = create_oracle_datum(100, 1000, 2000)
  !validate_oracle_freshness(datum, 1500, 200)
}

test validate_oracle_range_in_bounds() {
  let datum = create_oracle_datum(5000, 1000, 2000)
  validate_oracle_range(datum, 0, 10000)
}

test validate_oracle_range_out_of_bounds() {
  let datum = create_oracle_datum(15000, 1000, 2000)
  !validate_oracle_range(datum, 0, 10000)
}

test environmental_reading_valid() {
  let reading =
    EnvironmentalReading {
      feed_type: CO2Concentration,
      value: 415,
      unit: "ppm",
      timestamp: 1000,
      source_id: "sensor_001",
      confidence: 95,
      expiry: 2000,
    }
  validate_environmental_reading(reading, 1500, 80)
}

test environmental_reading_expired() {
  let reading =
    EnvironmentalReading {
      feed_type: Temperature,
      value: 2500,
      unit: "cC",
      timestamp: 1000,
      source_id: "sensor_002",
      confidence: 90,
      expiry: 1200,
    }
  !validate_environmental_reading(reading, 1500, 80)
}

test environmental_reading_low_confidence() {
  let reading =
    EnvironmentalReading {
      feed_type: AirQualityIndex,
      value: 50,
      unit: "aqi",
      timestamp: 1000,
      source_id: "sensor_003",
      confidence: 60,
      expiry: 2000,
    }
  !validate_environmental_reading(reading, 1500, 80)
}
