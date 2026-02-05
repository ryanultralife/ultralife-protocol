// =============================================================================
// UltraLife Protocol — pNFT Validator Tests
// =============================================================================
//
// Tests for the Personal NFT (pNFT) minting policy and spending validator.
// Tests cover: MintBasic, MintWard, UpgradeStandard redeemers, owner
// signature validation, and level transitions.
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{AssetName}
use ultralife/types.{
  VerificationLevel, Basic, Ward, Standard, Verified, Steward,
  PnftDatum,
  voting_weight, can_transact, can_propose,
}

// =============================================================================
// TEST HELPERS — Mock Data Generators
// =============================================================================

/// Create a mock verification key hash
fn mock_vkh(seed: Int) -> VerificationKeyHash {
  when seed is {
    1 -> #"0000000000000000000000000000000000000000000000000000000001"
    2 -> #"0000000000000000000000000000000000000000000000000000000002"
    3 -> #"0000000000000000000000000000000000000000000000000000000003"
    _ -> #"0000000000000000000000000000000000000000000000000000000000"
  }
}

/// Create a mock pNFT asset name
fn mock_pnft_name(seed: Int) -> AssetName {
  when seed is {
    1 -> #"706e667401"
    2 -> #"706e667402"
    3 -> #"706e667403"
    _ -> #"706e667400"
  }
}

/// Create a mock pNFT datum at Basic level
fn mock_basic_pnft(owner: VerificationKeyHash) -> PnftDatum {
  PnftDatum {
    pnft_id: #"0001",
    owner: owner,
    level: Basic,
    bioregion: None,
    dna_hash: None,
    guardian: None,
    ward_since: None,
    created_at: 1000,
    upgraded_at: None,
    consumer_impact: None,
    nutrition_profile: None,
  }
}

/// Create a mock pNFT datum at Ward level
fn mock_ward_pnft(owner: VerificationKeyHash, guardian: AssetName) -> PnftDatum {
  PnftDatum {
    pnft_id: #"0002",
    owner: owner,
    level: Ward,
    bioregion: None,
    dna_hash: None,
    guardian: Some(guardian),
    ward_since: Some(500),
    created_at: 500,
    upgraded_at: None,
    consumer_impact: None,
    nutrition_profile: None,
  }
}

/// Create a mock pNFT datum at Standard level
fn mock_standard_pnft(owner: VerificationKeyHash) -> PnftDatum {
  PnftDatum {
    pnft_id: #"0003",
    owner: owner,
    level: Standard,
    bioregion: None,
    dna_hash: Some(#"646e61313233"),
    guardian: None,
    ward_since: None,
    created_at: 1000,
    upgraded_at: Some(2000),
    consumer_impact: None,
    nutrition_profile: None,
  }
}

/// Create a mock pNFT datum at Verified level
fn mock_verified_pnft(owner: VerificationKeyHash, bioregion: ByteArray) -> PnftDatum {
  PnftDatum {
    pnft_id: #"0004",
    owner: owner,
    level: Verified,
    bioregion: Some(bioregion),
    dna_hash: Some(#"646e61343536"),
    guardian: None,
    ward_since: None,
    created_at: 1000,
    upgraded_at: Some(3000),
    consumer_impact: None,
    nutrition_profile: None,
  }
}

/// Create a mock pNFT datum at Steward level
fn mock_steward_pnft(owner: VerificationKeyHash, bioregion: ByteArray) -> PnftDatum {
  PnftDatum {
    pnft_id: #"0005",
    owner: owner,
    level: Steward,
    bioregion: Some(bioregion),
    dna_hash: Some(#"646e61373839"),
    guardian: None,
    ward_since: None,
    created_at: 1000,
    upgraded_at: Some(4000),
    consumer_impact: None,
    nutrition_profile: None,
  }
}

// =============================================================================
// VERIFICATION LEVEL TESTS
// =============================================================================

test basic_level_has_no_voting_weight() {
  voting_weight(Basic) == 0
}

test ward_level_has_no_voting_weight() {
  voting_weight(Ward) == 0
}

test standard_level_has_voting_weight_1() {
  voting_weight(Standard) == 1
}

test verified_level_has_voting_weight_2() {
  voting_weight(Verified) == 2
}

test steward_level_has_voting_weight_3() {
  voting_weight(Steward) == 3
}

// =============================================================================
// CAN_TRANSACT TESTS
// =============================================================================

test basic_cannot_transact() {
  !can_transact(Basic)
}

test ward_can_transact_with_guardian() {
  can_transact(Ward)
}

test standard_can_transact() {
  can_transact(Standard)
}

test verified_can_transact() {
  can_transact(Verified)
}

test steward_can_transact() {
  can_transact(Steward)
}

// =============================================================================
// CAN_PROPOSE TESTS
// =============================================================================

test basic_cannot_propose() {
  !can_propose(Basic)
}

test ward_cannot_propose() {
  !can_propose(Ward)
}

test standard_cannot_propose() {
  !can_propose(Standard)
}

test verified_can_propose() {
  can_propose(Verified)
}

test steward_can_propose() {
  can_propose(Steward)
}

// =============================================================================
// LEVEL TRANSITION VALIDATION TESTS
// =============================================================================

fn is_valid_level_transition(from: VerificationLevel, to: VerificationLevel) -> Bool {
  when (from, to) is {
    (Basic, Standard) -> True
    (Ward, Standard) -> True
    (Standard, Verified) -> True
    (Verified, Steward) -> True
    _ -> False
  }
}

test transition_basic_to_standard_valid() {
  is_valid_level_transition(Basic, Standard)
}

test transition_ward_to_standard_valid() {
  is_valid_level_transition(Ward, Standard)
}

test transition_standard_to_verified_valid() {
  is_valid_level_transition(Standard, Verified)
}

test transition_verified_to_steward_valid() {
  is_valid_level_transition(Verified, Steward)
}

test transition_basic_to_verified_invalid() {
  !is_valid_level_transition(Basic, Verified)
}

test transition_basic_to_steward_invalid() {
  !is_valid_level_transition(Basic, Steward)
}

test transition_standard_to_steward_invalid() {
  !is_valid_level_transition(Standard, Steward)
}

test transition_steward_to_basic_invalid() {
  !is_valid_level_transition(Steward, Basic)
}

test transition_verified_to_standard_invalid() {
  !is_valid_level_transition(Verified, Standard)
}

test transition_ward_to_verified_invalid() {
  !is_valid_level_transition(Ward, Verified)
}

// =============================================================================
// PNFT DATUM VALIDATION TESTS
// =============================================================================

fn is_valid_basic_datum(datum: PnftDatum) -> Bool {
  datum.level == Basic &&
  datum.bioregion == None &&
  datum.dna_hash == None &&
  datum.guardian == None &&
  datum.ward_since == None
}

fn is_valid_ward_datum(datum: PnftDatum) -> Bool {
  datum.level == Ward &&
  datum.guardian != None &&
  datum.ward_since != None &&
  datum.dna_hash == None
}

fn is_valid_standard_datum(datum: PnftDatum) -> Bool {
  datum.level == Standard &&
  datum.dna_hash != None &&
  datum.guardian == None
}

fn is_valid_verified_datum(datum: PnftDatum) -> Bool {
  datum.level == Verified &&
  datum.dna_hash != None &&
  datum.bioregion != None
}

fn is_valid_steward_datum(datum: PnftDatum) -> Bool {
  datum.level == Steward &&
  datum.dna_hash != None &&
  datum.bioregion != None
}

test basic_datum_valid() {
  let owner = mock_vkh(1)
  let datum = mock_basic_pnft(owner)
  is_valid_basic_datum(datum)
}

test basic_datum_with_bioregion_invalid() {
  let owner = mock_vkh(1)
  let datum = PnftDatum { ..mock_basic_pnft(owner), bioregion: Some(#"62696f31") }
  !is_valid_basic_datum(datum)
}

test basic_datum_with_dna_invalid() {
  let owner = mock_vkh(1)
  let datum = PnftDatum { ..mock_basic_pnft(owner), dna_hash: Some(#"646e6131") }
  !is_valid_basic_datum(datum)
}

test ward_datum_valid() {
  let owner = mock_vkh(1)
  let guardian = mock_pnft_name(2)
  let datum = mock_ward_pnft(owner, guardian)
  is_valid_ward_datum(datum)
}

test ward_datum_without_guardian_invalid() {
  let owner = mock_vkh(1)
  let guardian = mock_pnft_name(2)
  let datum = PnftDatum { ..mock_ward_pnft(owner, guardian), guardian: None }
  !is_valid_ward_datum(datum)
}

test ward_datum_without_ward_since_invalid() {
  let owner = mock_vkh(1)
  let guardian = mock_pnft_name(2)
  let datum = PnftDatum { ..mock_ward_pnft(owner, guardian), ward_since: None }
  !is_valid_ward_datum(datum)
}

test standard_datum_valid() {
  let owner = mock_vkh(1)
  let datum = mock_standard_pnft(owner)
  is_valid_standard_datum(datum)
}

test standard_datum_without_dna_invalid() {
  let owner = mock_vkh(1)
  let datum = PnftDatum { ..mock_standard_pnft(owner), dna_hash: None }
  !is_valid_standard_datum(datum)
}

test standard_datum_with_guardian_invalid() {
  let owner = mock_vkh(1)
  let guardian = mock_pnft_name(2)
  let datum = PnftDatum { ..mock_standard_pnft(owner), guardian: Some(guardian) }
  !is_valid_standard_datum(datum)
}

test verified_datum_valid() {
  let owner = mock_vkh(1)
  let datum = mock_verified_pnft(owner, #"62696f726567696f6e31")
  is_valid_verified_datum(datum)
}

test verified_datum_without_bioregion_invalid() {
  let owner = mock_vkh(1)
  let datum = PnftDatum { ..mock_verified_pnft(owner, #"62696f31"), bioregion: None }
  !is_valid_verified_datum(datum)
}

test steward_datum_valid() {
  let owner = mock_vkh(1)
  let datum = mock_steward_pnft(owner, #"62696f726567696f6e31")
  is_valid_steward_datum(datum)
}

test steward_datum_without_bioregion_invalid() {
  let owner = mock_vkh(1)
  let datum = PnftDatum { ..mock_steward_pnft(owner, #"62696f31"), bioregion: None }
  !is_valid_steward_datum(datum)
}

// =============================================================================
// OWNER SIGNATURE VALIDATION TESTS
// =============================================================================

fn owner_signed(datum: PnftDatum, signatories: List<VerificationKeyHash>) -> Bool {
  list.has(signatories, datum.owner)
}

test owner_must_sign_for_mint() {
  let owner = mock_vkh(1)
  let datum = mock_basic_pnft(owner)
  let signatories = [owner]
  owner_signed(datum, signatories)
}

test mint_fails_without_owner_signature() {
  let owner = mock_vkh(1)
  let other = mock_vkh(2)
  let datum = mock_basic_pnft(owner)
  let signatories = [other]
  !owner_signed(datum, signatories)
}

test mint_fails_with_empty_signatories() {
  let owner = mock_vkh(1)
  let datum = mock_basic_pnft(owner)
  let signatories: List<VerificationKeyHash> = []
  !owner_signed(datum, signatories)
}

test owner_can_be_among_multiple_signatories() {
  let owner = mock_vkh(1)
  let other1 = mock_vkh(2)
  let other2 = mock_vkh(3)
  let datum = mock_basic_pnft(owner)
  let signatories = [other1, owner, other2]
  owner_signed(datum, signatories)
}

// =============================================================================
// GUARDIAN SIGNATURE VALIDATION TESTS (FOR WARD)
// =============================================================================

fn guardian_must_sign_for_ward(
  ward_datum: PnftDatum,
  guardian_datum: PnftDatum,
  signatories: List<VerificationKeyHash>,
) -> Bool {
  when ward_datum.guardian is {
    Some(_guardian_pnft) -> {
      let guardian_level_valid = when guardian_datum.level is {
        Standard -> True
        Verified -> True
        Steward -> True
        _ -> False
      }
      let guardian_signed = list.has(signatories, guardian_datum.owner)
      guardian_level_valid && guardian_signed
    }
    None -> False
  }
}

test guardian_can_sign_for_ward_at_standard_level() {
  let ward_owner = mock_vkh(1)
  let guardian_owner = mock_vkh(2)
  let guardian_pnft = mock_pnft_name(2)
  let ward_datum = mock_ward_pnft(ward_owner, guardian_pnft)
  let guardian_datum = mock_standard_pnft(guardian_owner)
  let signatories = [guardian_owner]
  guardian_must_sign_for_ward(ward_datum, guardian_datum, signatories)
}

test guardian_can_sign_for_ward_at_verified_level() {
  let ward_owner = mock_vkh(1)
  let guardian_owner = mock_vkh(2)
  let guardian_pnft = mock_pnft_name(2)
  let ward_datum = mock_ward_pnft(ward_owner, guardian_pnft)
  let guardian_datum = mock_verified_pnft(guardian_owner, #"62696f31")
  let signatories = [guardian_owner]
  guardian_must_sign_for_ward(ward_datum, guardian_datum, signatories)
}

test guardian_can_sign_for_ward_at_steward_level() {
  let ward_owner = mock_vkh(1)
  let guardian_owner = mock_vkh(2)
  let guardian_pnft = mock_pnft_name(2)
  let ward_datum = mock_ward_pnft(ward_owner, guardian_pnft)
  let guardian_datum = mock_steward_pnft(guardian_owner, #"62696f31")
  let signatories = [guardian_owner]
  guardian_must_sign_for_ward(ward_datum, guardian_datum, signatories)
}

test guardian_at_basic_level_cannot_sign() {
  let ward_owner = mock_vkh(1)
  let guardian_owner = mock_vkh(2)
  let guardian_pnft = mock_pnft_name(2)
  let ward_datum = mock_ward_pnft(ward_owner, guardian_pnft)
  let guardian_datum = mock_basic_pnft(guardian_owner)
  let signatories = [guardian_owner]
  !guardian_must_sign_for_ward(ward_datum, guardian_datum, signatories)
}

test ward_without_guardian_fails() {
  let ward_owner = mock_vkh(1)
  let guardian_owner = mock_vkh(2)
  let guardian_pnft = mock_pnft_name(2)
  let ward_datum = PnftDatum { ..mock_ward_pnft(ward_owner, guardian_pnft), guardian: None }
  let guardian_datum = mock_standard_pnft(guardian_owner)
  let signatories = [guardian_owner]
  !guardian_must_sign_for_ward(ward_datum, guardian_datum, signatories)
}

// =============================================================================
// UPGRADE VALIDATION TESTS
// =============================================================================

fn validate_basic_to_standard_upgrade(
  old_datum: PnftDatum,
  new_datum: PnftDatum,
  dna_hash: ByteArray,
) -> Bool {
  old_datum.level == Basic &&
  new_datum.level == Standard &&
  old_datum.owner == new_datum.owner &&
  old_datum.pnft_id == new_datum.pnft_id &&
  new_datum.dna_hash == Some(dna_hash) &&
  old_datum.created_at == new_datum.created_at
}

test basic_to_standard_upgrade_valid() {
  let owner = mock_vkh(1)
  let old_datum = mock_basic_pnft(owner)
  let dna_hash = #"646e615f766572696669636174696f6e5f68617368"
  let new_datum = PnftDatum {
    ..old_datum,
    level: Standard,
    dna_hash: Some(dna_hash),
    upgraded_at: Some(5000),
  }
  validate_basic_to_standard_upgrade(old_datum, new_datum, dna_hash)
}

test basic_to_standard_fails_with_wrong_dna() {
  let owner = mock_vkh(1)
  let old_datum = mock_basic_pnft(owner)
  let dna_hash = #"646e615f766572696669636174696f6e5f68617368"
  let wrong_dna = #"77726f6e675f646e615f68617368"
  let new_datum = PnftDatum {
    ..old_datum,
    level: Standard,
    dna_hash: Some(wrong_dna),
    upgraded_at: Some(5000),
  }
  !validate_basic_to_standard_upgrade(old_datum, new_datum, dna_hash)
}

test basic_to_standard_fails_with_owner_change() {
  let owner = mock_vkh(1)
  let new_owner = mock_vkh(2)
  let old_datum = mock_basic_pnft(owner)
  let dna_hash = #"646e615f766572696669636174696f6e5f68617368"
  let new_datum = PnftDatum {
    ..old_datum,
    owner: new_owner,
    level: Standard,
    dna_hash: Some(dna_hash),
    upgraded_at: Some(5000),
  }
  !validate_basic_to_standard_upgrade(old_datum, new_datum, dna_hash)
}

test basic_to_standard_fails_with_pnft_id_change() {
  let owner = mock_vkh(1)
  let old_datum = mock_basic_pnft(owner)
  let dna_hash = #"646e615f766572696669636174696f6e5f68617368"
  let new_datum = PnftDatum {
    ..old_datum,
    pnft_id: #"6469666665726574696400",
    level: Standard,
    dna_hash: Some(dna_hash),
    upgraded_at: Some(5000),
  }
  !validate_basic_to_standard_upgrade(old_datum, new_datum, dna_hash)
}

fn validate_ward_to_standard_upgrade(
  old_datum: PnftDatum,
  new_datum: PnftDatum,
  dna_hash: ByteArray,
) -> Bool {
  old_datum.level == Ward &&
  new_datum.level == Standard &&
  old_datum.owner == new_datum.owner &&
  new_datum.dna_hash == Some(dna_hash) &&
  new_datum.guardian == None
}

test ward_to_standard_upgrade_valid() {
  let owner = mock_vkh(1)
  let guardian_pnft = mock_pnft_name(2)
  let old_datum = mock_ward_pnft(owner, guardian_pnft)
  let dna_hash = #"646e615f766572696669636174696f6e5f68617368"
  let new_datum = PnftDatum {
    ..old_datum,
    level: Standard,
    dna_hash: Some(dna_hash),
    guardian: None,
    upgraded_at: Some(5000),
  }
  validate_ward_to_standard_upgrade(old_datum, new_datum, dna_hash)
}

test ward_to_standard_fails_if_guardian_not_removed() {
  let owner = mock_vkh(1)
  let guardian_pnft = mock_pnft_name(2)
  let old_datum = mock_ward_pnft(owner, guardian_pnft)
  let dna_hash = #"646e615f766572696669636174696f6e5f68617368"
  let new_datum = PnftDatum {
    ..old_datum,
    level: Standard,
    dna_hash: Some(dna_hash),
    upgraded_at: Some(5000),
  }
  !validate_ward_to_standard_upgrade(old_datum, new_datum, dna_hash)
}

// =============================================================================
// SINGLE MINT VALIDATION TESTS
// =============================================================================

fn verify_single_mint(mint_amounts: List<(AssetName, Int)>) -> Bool {
  list.length(mint_amounts) == 1 &&
  list.all(mint_amounts, fn(pair) { pair.2nd == 1 })
}

test single_mint_valid() {
  let mint_amounts = [(mock_pnft_name(1), 1)]
  verify_single_mint(mint_amounts)
}

test single_mint_fails_with_multiple_tokens() {
  let mint_amounts = [(mock_pnft_name(1), 1), (mock_pnft_name(2), 1)]
  !verify_single_mint(mint_amounts)
}

test single_mint_fails_with_quantity_not_1() {
  let mint_amounts = [(mock_pnft_name(1), 2)]
  !verify_single_mint(mint_amounts)
}

test single_mint_fails_with_zero_quantity() {
  let mint_amounts = [(mock_pnft_name(1), 0)]
  !verify_single_mint(mint_amounts)
}

test single_mint_fails_with_empty_list() {
  let mint_amounts: List<(AssetName, Int)> = []
  !verify_single_mint(mint_amounts)
}

// =============================================================================
// BURN VALIDATION TESTS
// =============================================================================

fn verify_single_burn(mint_amounts: List<(AssetName, Int)>) -> Bool {
  list.length(mint_amounts) == 1 &&
  list.all(mint_amounts, fn(pair) { pair.2nd == -1 })
}

test single_burn_valid() {
  let mint_amounts = [(mock_pnft_name(1), -1)]
  verify_single_burn(mint_amounts)
}

test single_burn_fails_with_positive_quantity() {
  let mint_amounts = [(mock_pnft_name(1), 1)]
  !verify_single_burn(mint_amounts)
}

test single_burn_fails_with_multiple_tokens() {
  let mint_amounts = [(mock_pnft_name(1), -1), (mock_pnft_name(2), -1)]
  !verify_single_burn(mint_amounts)
}

// =============================================================================
// ORACLE ATTESTATION VALIDATION TESTS
// =============================================================================

fn verify_attestation_threshold(attestation_count: Int, required_threshold: Int) -> Bool {
  attestation_count >= required_threshold
}

test attestations_meet_threshold() {
  verify_attestation_threshold(3, 2)
}

test attestations_exactly_at_threshold() {
  verify_attestation_threshold(2, 2)
}

test attestations_below_threshold_fails() {
  !verify_attestation_threshold(1, 2)
}

test attestations_zero_fails() {
  !verify_attestation_threshold(0, 2)
}

// =============================================================================
// DNA UNIQUENESS VALIDATION TESTS
// =============================================================================

fn is_dna_unique(dna_hash: ByteArray, existing_hashes: List<ByteArray>) -> Bool {
  !list.has(existing_hashes, dna_hash)
}

test unique_dna_passes() {
  let dna = #"6e65775f646e615f68617368"
  let existing = [#"6578697374696e6731", #"6578697374696e6732"]
  is_dna_unique(dna, existing)
}

test duplicate_dna_fails() {
  let dna = #"6578697374696e6731"
  let existing = [#"6578697374696e6731", #"6578697374696e6732"]
  !is_dna_unique(dna, existing)
}

test dna_unique_with_empty_list() {
  let dna = #"616e795f646e615f68617368"
  let existing: List<ByteArray> = []
  is_dna_unique(dna, existing)
}

// =============================================================================
// SPENDING VALIDATOR REDEEMER TESTS
// =============================================================================

fn is_valid_spend_redeemer(current_level: VerificationLevel, redeemer_type: Int) -> Bool {
  when (current_level, redeemer_type) is {
    (Basic, 1) -> True
    (Ward, 2) -> True
    (Ward, 5) -> True
    (Standard, 3) -> True
    (Verified, 4) -> True
    (_, 6) -> True
    _ -> False
  }
}

test basic_can_upgrade_to_standard() {
  is_valid_spend_redeemer(Basic, 1)
}

test basic_cannot_upgrade_to_verified() {
  !is_valid_spend_redeemer(Basic, 3)
}

test ward_can_upgrade_to_standard() {
  is_valid_spend_redeemer(Ward, 2)
}

test ward_can_transfer_guardianship() {
  is_valid_spend_redeemer(Ward, 5)
}

test standard_can_upgrade_to_verified() {
  is_valid_spend_redeemer(Standard, 3)
}

test standard_cannot_upgrade_to_steward() {
  !is_valid_spend_redeemer(Standard, 4)
}

test verified_can_upgrade_to_steward() {
  is_valid_spend_redeemer(Verified, 4)
}

test any_level_can_burn() {
  is_valid_spend_redeemer(Basic, 6) &&
  is_valid_spend_redeemer(Ward, 6) &&
  is_valid_spend_redeemer(Standard, 6) &&
  is_valid_spend_redeemer(Verified, 6) &&
  is_valid_spend_redeemer(Steward, 6)
}

// =============================================================================
// EDGE CASES
// =============================================================================

test verification_level_ordering() {
  voting_weight(Basic) < voting_weight(Standard) &&
  voting_weight(Standard) < voting_weight(Verified) &&
  voting_weight(Verified) < voting_weight(Steward)
}

test ward_and_basic_have_same_voting_weight() {
  voting_weight(Ward) == voting_weight(Basic)
}

test transaction_capability_matches_voting_ability() {
  !can_transact(Basic) && voting_weight(Basic) == 0 &&
  can_transact(Standard) && voting_weight(Standard) > 0 &&
  can_transact(Verified) && voting_weight(Verified) > 0 &&
  can_transact(Steward) && voting_weight(Steward) > 0
}
