// =============================================================================
// UltraLife Protocol — Land Rights Validator Tests
// =============================================================================
//
// Tests for the land rights and stewardship contract including:
// - Land registration
// - Steward validation
// - Credit generation
// - Rights transfer
// - Impact attribution
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{AssetName}
use ultralife/types.{
  Basic, Standard, Steward, VerificationLevel, Verified, Ward, can_transact,
}

// =============================================================================
// LAND TYPES
// =============================================================================

type RightType {
  SurfaceRight
  SubsurfaceRight
  WaterRight
  AirRight
  CelluloseRight
  DevelopmentRight
  CarbonRight
  AccessRight
}

type AcquisitionType {
  Original
  Transfer
  Lease
  Inheritance
  Collective
  Traditional
  Grant
}

type RightHolder {
  holder: AssetName,
  acquisition: AcquisitionType,
  acquired_at: Int,
  transferable: Bool,
  expires: Option<Int>,
  steward_share: Int,
  bioregion_share: Int,
}

type LandHealth {
  overall_index: Int,
  soil_health: Int,
  water_health: Int,
  biodiversity_index: Int,
  carbon_stock: Int,
  carbon_flux: Int,
}

type HealthTrend {
  Improving
  Stable
  Declining
  Unknown
}

type ImpactLocality {
  Site
  Local
  Regional
  Global
}

type Impact {
  category: ByteArray,
  compound_code: ByteArray,
  magnitude: Int,
  unit: ByteArray,
  confidence: Int,
  locality: ImpactLocality,
}

// =============================================================================
// CONSTANTS
// =============================================================================

const min_area = 100

const default_steward_share = 7000

const default_bioregion_share = 2000

// =============================================================================
// TEST HELPERS
// =============================================================================

fn mock_vkh(seed: Int) -> VerificationKeyHash {
  when seed is {
    1 -> #"0000000000000000000000000000000000000000000000000000000001"
    2 -> #"0000000000000000000000000000000000000000000000000000000002"
    3 -> #"0000000000000000000000000000000000000000000000000000000003"
    _ -> #"0000000000000000000000000000000000000000000000000000000000"
  }
}

fn mock_pnft_name(seed: Int) -> AssetName {
  when seed is {
    1 -> #"706e667401"
    2 -> #"706e667402"
    3 -> #"706e667403"
    _ -> #"706e667400"
  }
}

fn mock_right_holder(
  holder: AssetName,
  acquisition: AcquisitionType,
  expires: Option<Int>,
) -> RightHolder {
  RightHolder {
    holder,
    acquisition,
    acquired_at: 1000,
    transferable: True,
    expires,
    steward_share: default_steward_share,
    bioregion_share: default_bioregion_share,
  }
}

fn mock_land_health(
  overall: Int,
  soil: Int,
  water: Int,
  biodiversity: Int,
) -> LandHealth {
  LandHealth {
    overall_index: overall,
    soil_health: soil,
    water_health: water,
    biodiversity_index: biodiversity,
    carbon_stock: 1000,
    carbon_flux: 50,
  }
}

fn mock_impact(magnitude: Int, confidence: Int) -> Impact {
  Impact {
    category: #"636172626f6e",
    compound_code: #"0101",
    magnitude,
    unit: #"6b67",
    confidence,
    locality: Site,
  }
}

// =============================================================================
// STEWARD VERIFICATION TESTS
// =============================================================================

fn can_steward_land(level: VerificationLevel) -> Bool {
  level == Verified || level == Steward
}

test basic_cannot_steward_land() {
  !can_steward_land(Basic)
}

test ward_cannot_steward_land() {
  !can_steward_land(Ward)
}

test standard_cannot_steward_land() {
  !can_steward_land(Standard)
}

test verified_can_steward_land() {
  can_steward_land(Verified)
}

test steward_can_steward_land() {
  can_steward_land(Steward)
}

// =============================================================================
// LAND REGISTRATION TESTS
// =============================================================================

fn validate_registration(
  registrant_level: VerificationLevel,
  registrant_bioregion: Option<ByteArray>,
  land_bioregion: ByteArray,
  area_m2: Int,
  has_survey: Bool,
) -> Bool {
  let level_valid = can_steward_land(registrant_level)
  let bioregion_valid = registrant_bioregion == Some(land_bioregion)
  let area_valid = area_m2 >= min_area
  level_valid && bioregion_valid && area_valid && has_survey
}

test valid_land_registration() {
  validate_registration(
    Verified,
    Some(#"62696f726567696f6e31"),
    #"62696f726567696f6e31",
    500,
    True,
  )
}

test registration_fails_with_standard_level() {
  !validate_registration(
    Standard,
    Some(#"62696f726567696f6e31"),
    #"62696f726567696f6e31",
    500,
    True,
  )
}

test registration_fails_with_different_bioregion() {
  !validate_registration(
    Verified,
    Some(#"62696f726567696f6e32"),
    #"62696f726567696f6e31",
    500,
    True,
  )
}

test registration_fails_with_small_area() {
  !validate_registration(
    Verified,
    Some(#"62696f726567696f6e31"),
    #"62696f726567696f6e31",
    50,
    True,
  )
}

test registration_fails_without_survey() {
  !validate_registration(
    Verified,
    Some(#"62696f726567696f6e31"),
    #"62696f726567696f6e31",
    500,
    False,
  )
}

test registration_with_minimum_area_valid() {
  validate_registration(
    Verified,
    Some(#"62696f726567696f6e31"),
    #"62696f726567696f6e31",
    100,
    True,
  )
}

test registration_with_no_bioregion_fails() {
  !validate_registration(Verified, None, #"62696f726567696f6e31", 500, True)
}

// =============================================================================
// RIGHT HOLDER QUALIFICATION TESTS
// =============================================================================

fn holder_qualified_for_right(
  level: VerificationLevel,
  right_type: RightType,
) -> Bool {
  when right_type is {
    SubsurfaceRight -> can_steward_land(level)
    WaterRight -> can_steward_land(level)
    SurfaceRight -> level != Basic
    AirRight -> level != Basic
    CelluloseRight -> level != Basic
    DevelopmentRight -> level != Basic
    CarbonRight -> level != Basic
    AccessRight -> level != Basic
  }
}

test standard_can_hold_surface_right() {
  holder_qualified_for_right(Standard, SurfaceRight)
}

test standard_cannot_hold_subsurface_right() {
  !holder_qualified_for_right(Standard, SubsurfaceRight)
}

test verified_can_hold_subsurface_right() {
  holder_qualified_for_right(Verified, SubsurfaceRight)
}

test standard_cannot_hold_water_right() {
  !holder_qualified_for_right(Standard, WaterRight)
}

test verified_can_hold_water_right() {
  holder_qualified_for_right(Verified, WaterRight)
}

test basic_cannot_hold_any_right() {
  !holder_qualified_for_right(Basic, SurfaceRight) && !holder_qualified_for_right(
    Basic,
    CarbonRight,
  )
}

test steward_can_hold_all_rights() {
  holder_qualified_for_right(Steward, SurfaceRight) && holder_qualified_for_right(
    Steward,
    SubsurfaceRight,
  ) && holder_qualified_for_right(Steward, WaterRight) && holder_qualified_for_right(
    Steward,
    CarbonRight,
  )
}

// =============================================================================
// RIGHT TRANSFER TESTS
// =============================================================================

fn validate_transfer(
  current_holder: AssetName,
  signer: AssetName,
  transferable: Bool,
  new_holder_qualified: Bool,
) -> Bool {
  current_holder == signer && transferable && new_holder_qualified
}

test valid_right_transfer() {
  let holder = mock_pnft_name(1)
  validate_transfer(holder, holder, True, True)
}

test transfer_fails_without_holder_signature() {
  let holder = mock_pnft_name(1)
  let other = mock_pnft_name(2)
  !validate_transfer(holder, other, True, True)
}

test transfer_fails_for_non_transferable_right() {
  let holder = mock_pnft_name(1)
  !validate_transfer(holder, holder, False, True)
}

test transfer_fails_with_unqualified_recipient() {
  let holder = mock_pnft_name(1)
  !validate_transfer(holder, holder, True, False)
}

// =============================================================================
// LEASE VALIDATION TESTS
// =============================================================================

fn validate_lease(
  current_holder: AssetName,
  signer: AssetName,
  lessee_qualified: Bool,
  duration_cycles: Int,
  payment: Int,
) -> Bool {
  current_holder == signer && lessee_qualified && duration_cycles > 0 && payment > 0
}

test valid_lease_creation() {
  let holder = mock_pnft_name(1)
  validate_lease(holder, holder, True, 4, 1000)
}

test lease_fails_without_holder_signature() {
  let holder = mock_pnft_name(1)
  let other = mock_pnft_name(2)
  !validate_lease(holder, other, True, 4, 1000)
}

test lease_fails_with_zero_duration() {
  let holder = mock_pnft_name(1)
  !validate_lease(holder, holder, True, 0, 1000)
}

test lease_fails_with_zero_payment() {
  let holder = mock_pnft_name(1)
  !validate_lease(holder, holder, True, 4, 0)
}

// =============================================================================
// LEASE RETURN TESTS
// =============================================================================

fn validate_lease_return(
  current_holder: AssetName,
  signer: AssetName,
  current_slot: Int,
  expiry: Option<Int>,
) -> Bool {
  when expiry is {
    Some(exp) -> current_slot >= exp || current_holder == signer
    None -> False
  }
}

test lease_returns_after_expiry() {
  let lessee = mock_pnft_name(2)
  let other = mock_pnft_name(3)
  validate_lease_return(lessee, other, 10000, Some(5000))
}

test lessee_can_return_early() {
  let lessee = mock_pnft_name(2)
  validate_lease_return(lessee, lessee, 2000, Some(5000))
}

test cannot_return_non_leased_right() {
  let holder = mock_pnft_name(1)
  !validate_lease_return(holder, holder, 5000, None)
}

test lease_not_expired_requires_lessee_signature() {
  let lessee = mock_pnft_name(2)
  let other = mock_pnft_name(3)
  !validate_lease_return(lessee, other, 2000, Some(5000))
}

// =============================================================================
// REVENUE SHARE TESTS
// =============================================================================

fn calculate_payment_distribution(
  payment: Int,
  steward_share: Int,
  bioregion_share: Int,
) -> (Int, Int, Int) {
  let to_steward = payment * steward_share / 10000
  let to_bioregion = payment * bioregion_share / 10000
  let to_right_holder = payment - to_steward - to_bioregion
  (to_steward, to_bioregion, to_right_holder)
}

test default_payment_distribution() {
  let (steward, bioregion, holder) =
    calculate_payment_distribution(10000, 7000, 2000)
  steward == 7000 && bioregion == 2000 && holder == 1000
}

test equal_share_distribution() {
  let (steward, bioregion, _holder) =
    calculate_payment_distribution(9000, 3333, 3333)
  steward == 2999 && bioregion == 2999
}

test zero_bioregion_share() {
  let (steward, bioregion, holder) =
    calculate_payment_distribution(10000, 8000, 0)
  steward == 8000 && bioregion == 0 && holder == 2000
}

fn validate_share_update(steward_share: Int, bioregion_share: Int) -> Bool {
  steward_share >= 0 && bioregion_share >= 0 && steward_share + bioregion_share <= 10000
}

test valid_share_update() {
  validate_share_update(7000, 2000)
}

test share_update_fails_over_100_percent() {
  !validate_share_update(8000, 3000)
}

test share_update_allows_100_percent() {
  validate_share_update(6000, 4000)
}

test share_update_allows_zero_shares() {
  validate_share_update(0, 0)
}

// =============================================================================
// IMPACT RECORDING TESTS
// =============================================================================

fn calculate_net_impact(impacts: List<Impact>) -> Int {
  list.foldl(
    impacts,
    0,
    fn(impact, acc) {
      let weighted = impact.magnitude * impact.confidence / 100
      acc + weighted
    },
  )
}

fn requires_remediation(net_impact: Int) -> Bool {
  net_impact < 0
}

test positive_impact_no_remediation() {
  let impacts = [mock_impact(100, 80)]
  let net = calculate_net_impact(impacts)
  !requires_remediation(net)
}

test negative_impact_requires_remediation() {
  let impacts = [mock_impact(-100, 80)]
  let net = calculate_net_impact(impacts)
  requires_remediation(net)
}

test mixed_impact_calculation() {
  let impacts = [mock_impact(100, 80), mock_impact(-50, 100)]
  let net = calculate_net_impact(impacts)
  net == 30
}

test zero_impact_no_remediation() {
  let net = 0
  !requires_remediation(net)
}

test confidence_affects_impact() {
  let high_confidence = mock_impact(100, 100)
  let low_confidence = mock_impact(100, 50)
  let impacts_high = [high_confidence]
  let impacts_low = [low_confidence]
  calculate_net_impact(impacts_high) > calculate_net_impact(impacts_low)
}

// =============================================================================
// STEWARDSHIP TRANSFER TESTS
// =============================================================================

fn validate_stewardship_transfer(
  current_steward: AssetName,
  signer: AssetName,
  new_steward_level: VerificationLevel,
  new_steward_bioregion: Option<ByteArray>,
  land_bioregion: ByteArray,
  governance_approved: Bool,
) -> Bool {
  let steward_signed = current_steward == signer
  let new_qualified = can_steward_land(new_steward_level)
  let bioregion_valid =
    new_steward_bioregion == Some(land_bioregion) || governance_approved
  steward_signed && new_qualified && bioregion_valid
}

test valid_stewardship_transfer() {
  let old = mock_pnft_name(1)
  validate_stewardship_transfer(
    old,
    old,
    Verified,
    Some(#"62696f726567696f6e31"),
    #"62696f726567696f6e31",
    False,
  )
}

test transfer_fails_without_steward_signature() {
  let old = mock_pnft_name(1)
  let other = mock_pnft_name(2)
  !validate_stewardship_transfer(
    old,
    other,
    Verified,
    Some(#"62696f726567696f6e31"),
    #"62696f726567696f6e31",
    False,
  )
}

test transfer_fails_with_standard_new_steward() {
  let old = mock_pnft_name(1)
  !validate_stewardship_transfer(
    old,
    old,
    Standard,
    Some(#"62696f726567696f6e31"),
    #"62696f726567696f6e31",
    False,
  )
}

test cross_bioregion_transfer_needs_governance() {
  let old = mock_pnft_name(1)
  !validate_stewardship_transfer(
    old,
    old,
    Verified,
    Some(#"62696f726567696f6e32"),
    #"62696f726567696f6e31",
    False,
  )
}

test cross_bioregion_transfer_with_governance_approved() {
  let old = mock_pnft_name(1)
  validate_stewardship_transfer(
    old,
    old,
    Verified,
    Some(#"62696f726567696f6e32"),
    #"62696f726567696f6e31",
    True,
  )
}

// =============================================================================
// TRADITIONAL RIGHTS TESTS
// =============================================================================

fn validate_traditional_claim(
  governance_approved: Bool,
  has_evidence: Bool,
) -> Bool {
  governance_approved && has_evidence
}

test traditional_claim_with_approval_and_evidence() {
  validate_traditional_claim(True, True)
}

test traditional_claim_fails_without_approval() {
  !validate_traditional_claim(False, True)
}

test traditional_claim_fails_without_evidence() {
  !validate_traditional_claim(True, False)
}

// =============================================================================
// LAND HEALTH TESTS
// =============================================================================

fn calculate_overall_health(soil: Int, water: Int, biodiversity: Int) -> Int {
  ( soil + water + biodiversity ) / 3
}

fn determine_trend(current: Int, previous: Int) -> HealthTrend {
  if current > previous + 500 {
    Improving
  } else if current < previous - 500 {
    Declining
  } else {
    Stable
  }
}

test health_calculation() {
  calculate_overall_health(8000, 7000, 6000) == 7000
}

test improving_trend() {
  let trend = determine_trend(8000, 7000)
  when trend is {
    Improving -> True
    _ -> False
  }
}

test declining_trend() {
  let trend = determine_trend(6000, 7000)
  when trend is {
    Declining -> True
    _ -> False
  }
}

test stable_trend() {
  let trend = determine_trend(7200, 7000)
  when trend is {
    Stable -> True
    _ -> False
  }
}

// =============================================================================
// ACCESS RIGHTS TESTS
// =============================================================================

fn validate_access(
  public_access: Bool,
  min_level: VerificationLevel,
  requester_level: VerificationLevel,
  allowed_pnfts: Option<List<AssetName>>,
  requester: AssetName,
) -> Bool {
  if public_access {
    level_gte(requester_level, min_level)
  } else {
    when allowed_pnfts is {
      Some(allowed) -> list.has(allowed, requester)
      None -> False
    }
  }
}

fn level_gte(a: VerificationLevel, b: VerificationLevel) -> Bool {
  level_to_int(a) >= level_to_int(b)
}

fn level_to_int(level: VerificationLevel) -> Int {
  when level is {
    Basic -> 0
    Ward -> 1
    Standard -> 2
    Verified -> 3
    Steward -> 4
  }
}

test public_access_with_sufficient_level() {
  validate_access(True, Standard, Verified, None, mock_pnft_name(1))
}

test public_access_denied_with_low_level() {
  !validate_access(True, Verified, Standard, None, mock_pnft_name(1))
}

test private_access_with_allowed_pnft() {
  let allowed = [mock_pnft_name(1), mock_pnft_name(2)]
  validate_access(False, Basic, Standard, Some(allowed), mock_pnft_name(1))
}

test private_access_denied_for_non_allowed() {
  let allowed = [mock_pnft_name(1), mock_pnft_name(2)]
  !validate_access(False, Basic, Standard, Some(allowed), mock_pnft_name(3))
}

// =============================================================================
// EDGE CASES
// =============================================================================

test minimum_area_boundary() {
  validate_registration(Verified, Some(#"62696f31"), #"62696f31", 100, True) && !validate_registration(
    Verified,
    Some(#"62696f31"),
    #"62696f31",
    99,
    True,
  )
}

test all_right_types_have_holder() {
  let holder = mock_pnft_name(1)
  let surface = mock_right_holder(holder, Original, None)
  let subsurface = mock_right_holder(holder, Original, None)
  let water = mock_right_holder(holder, Original, None)
  surface.holder == holder && subsurface.holder == holder && water.holder == holder
}

test lease_expiry_exactly_at_slot() {
  let lessee = mock_pnft_name(2)
  let other = mock_pnft_name(3)
  validate_lease_return(lessee, other, 5000, Some(5000))
}

test share_sums_correctly() {
  let (steward, bioregion, holder) =
    calculate_payment_distribution(10000, 7000, 2000)
  steward + bioregion + holder == 10000
}

test empty_impacts_list() {
  let impacts: List<Impact> = []
  calculate_net_impact(impacts) == 0
}

test carbon_right_transferable_by_standard() {
  holder_qualified_for_right(Standard, CarbonRight)
}

test traditional_acquisition_recognized() {
  let holder = mock_right_holder(mock_pnft_name(1), Traditional, None)
  when holder.acquisition is {
    Traditional -> True
    _ -> False
  }
}
