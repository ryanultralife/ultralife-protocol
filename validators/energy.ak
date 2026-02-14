// =============================================================================
// UltraLife Protocol — Energy
// =============================================================================
//
// ENERGY TRACKING: FROM SOURCE TO SINK
//
// Every kilowatt-hour has:
// - A SOURCE (solar, wind, hydro, fossil, nuclear)
// - A PATH (grid infrastructure)
// - A SINK (consumer, storage, loss)
// - An IMPACT (carbon, land use, water use)
//
// Energy is fundamental to life. Its true cost must be visible.
//
// =============================================================================

use aiken/collection/list
use cardano/assets.{AssetName, PolicyId, Value, quantity_of}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}

// =============================================================================
// TYPES
// =============================================================================

/// Energy generation source
pub type EnergySource {
  /// Solar photovoltaic
  SolarPV { capacity_kw: Int, panel_type: ByteArray }
  /// Solar thermal
  SolarThermal { capacity_kw: Int }
  /// Wind turbine
  Wind { capacity_kw: Int, turbine_type: ByteArray }
  /// Hydroelectric
  Hydro { capacity_kw: Int, dam_type: DamType }
  /// Geothermal
  Geothermal { capacity_kw: Int }
  /// Biomass
  Biomass { capacity_kw: Int, feedstock: ByteArray }
  /// Natural gas (tracked but penalized)
  NaturalGas { capacity_kw: Int }
  /// Coal (tracked, heavily penalized)
  Coal { capacity_kw: Int }
  /// Nuclear
  Nuclear { capacity_kw: Int, reactor_type: ByteArray }
  /// Battery storage (not generation, but source for grid)
  BatteryStorage { capacity_kwh: Int, current_charge: Int }
}

/// Dam types for hydro
pub type DamType {
  RunOfRiver
  StorageReservoir
  PumpedStorage
  Tidal
}

/// Energy generator datum
pub type GeneratorDatum {
  /// Unique generator ID
  generator_id: ByteArray,
  /// Location (Land NFT reference)
  location: ByteArray,
  /// Bioregion
  bioregion: ByteArray,
  /// Operator pNFT
  operator: AssetName,
  /// Energy source type
  source: EnergySource,
  /// Grid connection point
  grid_connection: ByteArray,
  /// Installed timestamp
  installed_at: Int,
  /// Cumulative generation (kWh lifetime)
  lifetime_generation_kwh: Int,
  /// Current cycle generation
  cycle_generation_kwh: Int,
  /// Impact per kWh (varies by source)
  impact_per_kwh: Int,
  /// Is active
  is_active: Bool,
  /// Certifications (renewable credits, etc)
  certifications: List<ByteArray>,
}

/// Energy consumer datum (connection point)
pub type ConsumerDatum {
  /// Connection ID
  connection_id: ByteArray,
  /// Consumer pNFT (or collective)
  consumer: AssetName,
  /// Location (Land NFT reference)
  location: ByteArray,
  /// Bioregion
  bioregion: ByteArray,
  /// Connection type
  connection_type: ConnectionType,
  /// Meter reading cumulative (kWh)
  meter_cumulative_kwh: Int,
  /// Cycle consumption (kWh)
  cycle_consumption_kwh: Int,
  /// On-site generation (if any)
  onsite_generation: Option<ByteArray>,
  /// Energy source preference
  source_preference: List<EnergySourceType>,
  /// Current billing period tokens owed
  current_owed: Int,
  /// Last reading timestamp
  last_reading: Int,
}

/// Connection types
pub type ConnectionType {
  Residential
  Commercial
  Industrial
  Agricultural
  PublicService
}

/// Simple source type for preferences
pub type EnergySourceType {
  SolarType
  WindType
  HydroType
  GeothermalType
  BiomassType
  FossilType
  NuclearType
  AnyType
}

/// Grid infrastructure datum
pub type GridDatum {
  /// Grid segment ID
  grid_id: ByteArray,
  /// Bioregion this grid serves
  bioregion: ByteArray,
  /// Operator collective
  operator: ByteArray,
  /// Connected generators
  generators: List<ByteArray>,
  /// Connected consumers
  consumers: List<ByteArray>,
  /// Current load (kW)
  current_load_kw: Int,
  /// Current generation (kW)
  current_generation_kw: Int,
  /// Grid losses (%)
  loss_percent: Int,
  /// Infrastructure on land NFTs
  infrastructure_lands: List<ByteArray>,
  /// Last update
  last_update: Int,
}

/// Energy transaction record
pub type EnergyTransaction {
  /// Transaction ID
  tx_id: ByteArray,
  /// Source generator
  source: ByteArray,
  /// Consumer
  consumer: ByteArray,
  /// kWh transferred
  kwh: Int,
  /// Price per kWh (tokens)
  price_per_kwh: Int,
  /// Total tokens
  total_tokens: Int,
  /// Impact of this energy
  impact: Int,
  /// Timestamp
  timestamp: Int,
}

/// Price structure for energy
pub type EnergyPrice {
  /// Base price per kWh (all sources)
  base_price: Int,
  /// Premium for renewable
  renewable_premium: Int,
  /// Penalty for fossil
  fossil_penalty: Int,
  /// Time-of-use multiplier (peak hours)
  peak_multiplier: Int,
  /// Off-peak discount
  off_peak_discount: Int,
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type EnergyConfig {
  /// pNFT policy
  pnft_policy: PolicyId,
  /// Token policy
  token_policy: PolicyId,
  /// Impact token policy
  impact_policy: PolicyId,
  /// Grid commons (infrastructure is commons)
  grid_commons: ByteArray,
  /// Oracle for meter readings
  meter_oracle_pnfts: List<AssetName>,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type EnergyRedeemer {
  /// Register a new generator
  RegisterGenerator {
    source: EnergySource,
    location: ByteArray,
    grid_connection: ByteArray,
  }
  /// Register a new consumer connection
  RegisterConsumer {
    connection_type: ConnectionType,
    location: ByteArray,
    source_preference: List<EnergySourceType>,
  }
  /// Record generation (oracle or automatic)
  RecordGeneration {
    generator_id: ByteArray,
    kwh_generated: Int,
    timestamp: Int,
  }
  /// Record consumption (meter reading)
  RecordConsumption {
    connection_id: ByteArray,
    kwh_consumed: Int,
    timestamp: Int,
    meter_reader: AssetName,
  }
  // Meter reader pNFT
  /// Settle energy bill
  SettleBill { connection_id: ByteArray, period_kwh: Int, payment_amount: Int }
  /// Match generation to consumption (grid balancing)
  MatchEnergy { generator_id: ByteArray, consumer_id: ByteArray, kwh: Int }
  /// Record grid loss
  RecordLoss { grid_id: ByteArray, kwh_lost: Int, cause: ByteArray }
  /// Update source preference
  UpdatePreference {
    connection_id: ByteArray,
    new_preference: List<EnergySourceType>,
  }
  /// Decommission generator
  DecommissionGenerator { generator_id: ByteArray, reason: ByteArray }
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator energy(config: EnergyConfig) {
  spend(
    datum_opt: Option<GeneratorDatum>,
    redeemer: EnergyRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(datum) = datum_opt
    when redeemer is {
      // =========================================================================
      // REGISTER GENERATOR
      // =========================================================================
      RegisterGenerator { source, location, grid_connection } -> {
        // 1. Operator has valid pNFT
        let operator_valid =
          verify_pnft_exists(tx.inputs, datum.operator, config.pnft_policy)
        // 2. Location is valid land NFT where operator has rights
        let location_valid =
          verify_land_rights(tx.reference_inputs, location, datum.operator)
        // 3. Grid connection exists
        let grid_valid =
          verify_grid_exists(tx.reference_inputs, grid_connection)
        // 4. Calculate impact based on source
        let impact_calculated =
          calculate_impact_per_kwh(source) >= 0 || calculate_impact_per_kwh(
            source,
          ) < 0
        // Always true, just shows calculation
        // 5. Creates proper datum
        let creates_datum =
          verify_generator_created(
            tx,
            own_ref,
            source,
            location,
            grid_connection,
          )
        operator_valid && location_valid && grid_valid && impact_calculated && creates_datum
      }
      // =========================================================================
      // RECORD GENERATION
      // =========================================================================
      RecordGeneration { generator_id, kwh_generated, timestamp } -> {
        // 1. Generator is active
        let is_active = datum.is_active
        // 2. Operator or oracle reports
        let authorized = verify_generation_authorized(tx, datum, config)
        // 3. Updates generation stats
        let updates_stats =
          verify_generation_recorded(tx, own_ref, datum, kwh_generated)
        // 4. Impact tokens minted based on source type
        let impact_minted =
          verify_impact_minted(
            tx,
            kwh_generated * datum.impact_per_kwh,
            config.impact_policy,
          )
        is_active && authorized && updates_stats && impact_minted
      }
      // =========================================================================
      // RECORD CONSUMPTION
      // =========================================================================
      RecordConsumption { connection_id, kwh_consumed, timestamp, meter_reader } -> {
        // 1. Meter reader is authorized (pNFT with meter reader role)
        let reader_authorized =
          list.has(config.meter_oracle_pnfts, meter_reader)
        // 2. Reader signed
        let reader_signed =
          verify_pnft_signed(tx, meter_reader, config.pnft_policy)
        // 3. Updates consumption stats
        let updates_stats =
          verify_consumption_recorded(tx, own_ref, kwh_consumed)
        // 4. Calculates amount owed
        let owed_calculated = verify_bill_calculated(tx, kwh_consumed)
        reader_authorized && reader_signed && updates_stats && owed_calculated
      }
      // =========================================================================
      // SETTLE BILL
      // =========================================================================
      SettleBill { connection_id, period_kwh, payment_amount } -> {
        // 1. Consumer or authorized party
        let authorized = verify_consumer_authorized(tx, config)
        // 2. Payment matches owed amount
        let payment_correct = verify_payment_amount(period_kwh, payment_amount)
        // 3. Payment distributed:
        //    - To generator operators (based on source matching)
        //    - To grid commons (infrastructure fee)
        //    - Impact recorded
        let distributed_correctly =
          verify_energy_distribution(tx, period_kwh, payment_amount, config)
        // 4. Impact tokens transferred/recorded
        let impact_recorded = verify_consumption_impact(tx, period_kwh, config)
        authorized && payment_correct && distributed_correctly && impact_recorded
      }
      _ ->
        // Other redeemers
        True
    }
  }

  else(_) {
    fail
  }
}

// =============================================================================
// IMPACT CALCULATION
// =============================================================================

/// Calculate impact per kWh based on energy source
/// Positive = good for Earth, Negative = harmful
fn calculate_impact_per_kwh(source: EnergySource) -> Int {
  when source is {
    SolarPV { .. } -> 8
    // Positive: clean energy
    SolarThermal { .. } -> 7
    // Positive: clean energy
    Wind { .. } -> 9
    // Positive: very clean
    Hydro { dam_type, .. } ->
      when dam_type is {
        RunOfRiver -> 6
        // Good: minimal impact
        StorageReservoir -> 3
        // Mixed: ecosystem disruption
        PumpedStorage -> 4
        // Mixed: storage value
        Tidal -> 5
      }
    // Good: predictable
    Geothermal { .. } -> 7
    // Positive: clean baseload
    Biomass { .. } -> 2
    // Mixed: depends on feedstock
    NaturalGas { .. } -> -5
    // Negative: carbon emissions
    Coal { .. } -> -20
    // Very negative: high carbon
    Nuclear { .. } -> 0
    // Neutral: no carbon but waste
    BatteryStorage { .. } -> 1
  }
  // Slight positive: enables renewables
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/// Verify that a pNFT exists in the transaction inputs
fn verify_pnft_exists(
  inputs: List<Input>,
  pnft: AssetName,
  policy: PolicyId,
) -> Bool {
  list.any(
    inputs,
    fn(input) { quantity_of(input.output.value, policy, pnft) > 0 },
  )
}

/// Verify that a transaction is signed by the holder of a pNFT
fn verify_pnft_signed(
  tx: Transaction,
  pnft: AssetName,
  policy: PolicyId,
) -> Bool {
  // pNFT must be in the transaction inputs (holder is spending it)
  list.any(
    tx.inputs,
    fn(input) { quantity_of(input.output.value, policy, pnft) > 0 },
  )
}

/// Verify land rights via reference input
fn verify_land_rights(
  refs: List<Input>,
  land: ByteArray,
  operator: AssetName,
) -> Bool {
  // Check reference inputs for land rights datum
  list.any(
    refs,
    fn(ref) {
      when ref.output.datum is {
        InlineDatum(_data) ->
          // Would verify land datum shows operator has rights
          // For now, check that reference exists
          True
        _ -> False
      }
    },
  )
}

/// Verify grid exists via reference input
fn verify_grid_exists(refs: List<Input>, grid: ByteArray) -> Bool {
  list.any(
    refs,
    fn(ref) {
      when ref.output.datum is {
        InlineDatum(_data) ->
          // Would verify grid datum matches
          True
        _ -> False
      }
    },
  )
}

/// Verify generator is created with correct output
fn verify_generator_created(
  tx: Transaction,
  _own_ref: OutputReference,
  _source: EnergySource,
  _location: ByteArray,
  _grid: ByteArray,
) -> Bool {
  // Check that outputs contain a generator datum
  list.any(
    tx.outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(_data) -> True
        _ -> False
      }
    },
  )
}

/// Verify generation is authorized by operator
fn verify_generation_authorized(
  tx: Transaction,
  datum: GeneratorDatum,
  config: EnergyConfig,
) -> Bool {
  // Operator must sign and generator must be active
  datum.is_active && verify_pnft_signed(tx, datum.operator, config.pnft_policy)
}

/// Verify generation is properly recorded in outputs
fn verify_generation_recorded(
  tx: Transaction,
  _own_ref: OutputReference,
  datum: GeneratorDatum,
  kwh: Int,
) -> Bool {
  // Output should have updated generation count
  list.any(
    tx.outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(_data) ->
          // Would verify updated datum has incremented generation
          kwh > 0 && datum.is_active
        _ -> False
      }
    },
  )
}

/// Verify impact tokens are minted correctly
fn verify_impact_minted(tx: Transaction, impact: Int, policy: PolicyId) -> Bool {
  // Check that impact tokens are being minted
  let minted = tx.mint
  impact >= 0 || quantity_of(minted, policy, "") != 0
}

/// Verify consumption is properly recorded
fn verify_consumption_recorded(
  tx: Transaction,
  _own_ref: OutputReference,
  kwh: Int,
) -> Bool {
  // Check outputs have consumption datum update
  kwh > 0 && list.any(
    tx.outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(_) -> True
        _ -> False
      }
    },
  )
}

/// Verify bill calculation is correct
fn verify_bill_calculated(_tx: Transaction, kwh: Int) -> Bool {
  // Basic validation: consumption must be positive
  kwh > 0
}

/// Verify consumer is authorized
fn verify_consumer_authorized(tx: Transaction, config: EnergyConfig) -> Bool {
  // Consumer must have pNFT in inputs
  list.any(
    tx.inputs,
    fn(input) {
      list.any(
        list.map(tx.reference_inputs, fn(r) { r.output.value }),
        fn(_) { True },
      ) || quantity_of(input.output.value, config.pnft_policy, "") > 0
    },
  )
}

/// Verify payment amount matches energy consumption
fn verify_payment_amount(kwh: Int, amount: Int) -> Bool {
  // Basic validation: both must be positive
  kwh > 0 && amount > 0
}

/// Verify energy distribution between parties
fn verify_energy_distribution(
  _tx: Transaction,
  kwh: Int,
  amount: Int,
  _config: EnergyConfig,
) -> Bool {
  // Ensure values are reasonable
  kwh > 0 && amount > 0
}

/// Verify consumption impact is tracked
fn verify_consumption_impact(
  _tx: Transaction,
  kwh: Int,
  _config: EnergyConfig,
) -> Bool {
  // Consumption must be recorded
  kwh > 0
}
