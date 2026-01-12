// =============================================================================
// UltraLife Protocol — Types Library Tests
// =============================================================================

use ultralife/types.{
  VerificationLevel, Basic, Standard, Verified, Steward,
  TransactionType, Labor, Goods, Services, Gift, Investment, Remediation, UBI, GovernanceReward, Internal,
  ImpactClass, Positive, Neutral, Negative,
  RemediationType, Immediate,
  voting_weight, can_transact, can_propose, tx_type_code, impact_sign, impact_magnitude,
}

// =============================================================================
// VOTING WEIGHT TESTS
// =============================================================================

test voting_weight_basic_is_0() {
  voting_weight(Basic) == 0
}

test voting_weight_standard_is_1() {
  voting_weight(Standard) == 1
}

test voting_weight_verified_is_2() {
  voting_weight(Verified) == 2
}

test voting_weight_steward_is_3() {
  voting_weight(Steward) == 3
}

// =============================================================================
// CAN_TRANSACT TESTS
// =============================================================================

test basic_cannot_transact() {
  !can_transact(Basic)
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
// TX_TYPE_CODE TESTS
// =============================================================================

test tx_type_labor_is_1() {
  tx_type_code(Labor { work_code: "", hours: None }) == 1
}

test tx_type_goods_is_2() {
  tx_type_code(Goods { product_code: "", quantity: 1, unit_code: "" }) == 2
}

test tx_type_services_is_3() {
  tx_type_code(Services { service_code: "" }) == 3
}

test tx_type_gift_is_4() {
  tx_type_code(Gift) == 4
}

test tx_type_investment_is_5() {
  tx_type_code(Investment { terms_hash: "" }) == 5
}

test tx_type_remediation_is_6() {
  tx_type_code(Remediation { bond_id: "" }) == 6
}

test tx_type_ubi_is_7() {
  tx_type_code(UBI { cycle: 0 }) == 7
}

test tx_type_governance_reward_is_8() {
  tx_type_code(GovernanceReward { proposal_id: "" }) == 8
}

test tx_type_internal_is_9() {
  tx_type_code(Internal) == 9
}

// =============================================================================
// IMPACT_SIGN TESTS
// =============================================================================

test impact_sign_positive_is_1() {
  impact_sign(Positive { impact_code: "", magnitude: 100, unit_code: None }) == 1
}

test impact_sign_neutral_is_0() {
  impact_sign(Neutral) == 0
}

test impact_sign_negative_is_minus_1() {
  impact_sign(Negative { 
    impact_code: "", 
    magnitude: 100, 
    unit_code: None,
    remediation: Immediate { output_index: 0 }
  }) == -1
}

// =============================================================================
// IMPACT_MAGNITUDE TESTS
// =============================================================================

test impact_magnitude_positive() {
  impact_magnitude(Positive { impact_code: "", magnitude: 500, unit_code: None }) == 500
}

test impact_magnitude_neutral() {
  impact_magnitude(Neutral) == 0
}

test impact_magnitude_negative() {
  impact_magnitude(Negative { 
    impact_code: "", 
    magnitude: 750, 
    unit_code: None,
    remediation: Immediate { output_index: 0 }
  }) == 750
}

// =============================================================================
// VERIFICATION LEVEL ORDERING TESTS
// =============================================================================

test verification_levels_ordered_by_weight() {
  voting_weight(Basic) < voting_weight(Standard) &&
  voting_weight(Standard) < voting_weight(Verified) &&
  voting_weight(Verified) < voting_weight(Steward)
}

test transact_implies_vote() {
  // If you can transact, you should have voting weight
  can_transact(Standard) && voting_weight(Standard) > 0 &&
  can_transact(Verified) && voting_weight(Verified) > 0 &&
  can_transact(Steward) && voting_weight(Steward) > 0
}

test propose_requires_higher_level() {
  // Can propose requires higher level than can transact minimum
  !can_propose(Standard) && can_transact(Standard)
}
