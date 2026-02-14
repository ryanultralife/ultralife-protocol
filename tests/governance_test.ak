// =============================================================================
// UltraLife Protocol — Governance Validator Tests
// =============================================================================
//
// Tests for the governance contract including:
// - CreateProposal, Vote, Execute, Close redeemers
// - Quorum calculations
// - Voting weight by level
// - Voting period validation
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{AssetName}
use ultralife/prc37.{
  current_cycle, cycle_end, cycle_slots, cycle_start, genesis_slot,
  majority_reached, quorum_reached, supermajority_reached,
}
use ultralife/types.{
  Active, Basic, Budget, Constitutional, Emergency, Executed, Expired, Failed,
  Passed, Policy, ProposalDatum, ProposalStatus, ProposalType, Standard, Steward,
  VerificationLevel, Verified, VoteDatum, Ward, can_propose, voting_weight,
}

// =============================================================================
// CONSTANTS
// =============================================================================

const min_voting_period = 604800

const emergency_voting_period = 86400

const constitutional_voting_period = 3196800

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

fn mock_proposal(
  proposer: AssetName,
  bioregion: ByteArray,
  proposal_type: ProposalType,
  start: Int,
  end: Int,
  status: ProposalStatus,
  votes_for: Int,
  votes_against: Int,
) -> ProposalDatum {
  ProposalDatum {
    proposal_id: #"70726f70303031",
    proposer,
    bioregion,
    proposal_type,
    content_hash: #"636f6e74656e745f68617368",
    voting_start: start,
    voting_end: end,
    votes_for,
    votes_against,
    status,
  }
}

fn mock_vote(
  proposal_id: ByteArray,
  voter: AssetName,
  vote_for: Bool,
  weight: Int,
  slot: Int,
) -> VoteDatum {
  VoteDatum { proposal_id, voter, vote_for, weight, slot }
}

// =============================================================================
// VOTING WEIGHT TESTS
// =============================================================================

test basic_has_no_voting_weight() {
  voting_weight(Basic) == 0
}

test ward_has_no_voting_weight() {
  voting_weight(Ward) == 0
}

test standard_has_voting_weight_1() {
  voting_weight(Standard) == 1
}

test verified_has_voting_weight_2() {
  voting_weight(Verified) == 2
}

test steward_has_voting_weight_3() {
  voting_weight(Steward) == 3
}

test voting_weights_are_ordered() {
  voting_weight(Basic) < voting_weight(Standard) && voting_weight(Standard) < voting_weight(
    Verified,
  ) && voting_weight(Verified) < voting_weight(Steward)
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

test only_verified_and_steward_can_propose() {
  !can_propose(Basic) && !can_propose(Ward) && !can_propose(Standard) && can_propose(
    Verified,
  ) && can_propose(Steward)
}

// =============================================================================
// QUORUM CALCULATION TESTS
// =============================================================================

test quorum_exactly_37_percent() {
  quorum_reached(37, 100)
}

test quorum_above_threshold() {
  quorum_reached(50, 100)
}

test quorum_below_threshold_fails() {
  !quorum_reached(36, 100)
}

test quorum_at_zero_votes_fails() {
  !quorum_reached(0, 100)
}

test quorum_with_large_numbers() {
  quorum_reached(370000, 1000000)
}

test quorum_just_below_threshold_fails() {
  !quorum_reached(3699, 10000)
}

test quorum_just_at_threshold() {
  quorum_reached(3700, 10000)
}

test quorum_with_zero_eligible_passes() {
  quorum_reached(0, 0)
}

// =============================================================================
// SUPERMAJORITY TESTS
// =============================================================================

test supermajority_exactly_63_percent() {
  supermajority_reached(63, 100)
}

test supermajority_above_threshold() {
  supermajority_reached(70, 100)
}

test supermajority_below_threshold_fails() {
  !supermajority_reached(62, 100)
}

test supermajority_at_zero_fails() {
  !supermajority_reached(0, 100)
}

test supermajority_with_large_numbers() {
  supermajority_reached(630000, 1000000)
}

test supermajority_just_below_threshold_fails() {
  !supermajority_reached(6299, 10000)
}

test supermajority_just_at_threshold() {
  supermajority_reached(6300, 10000)
}

// =============================================================================
// MAJORITY TESTS
// =============================================================================

test majority_simple_win() {
  majority_reached(51, 49)
}

test majority_tie_fails() {
  !majority_reached(50, 50)
}

test majority_loss_fails() {
  !majority_reached(40, 60)
}

test majority_with_large_margin() {
  majority_reached(1000000, 1)
}

test majority_minimal_win() {
  majority_reached(2, 1)
}

test majority_zero_vs_zero_fails() {
  !majority_reached(0, 0)
}

// =============================================================================
// VOTING PERIOD TESTS
// =============================================================================

fn get_voting_period(proposal_type: ProposalType) -> Int {
  when proposal_type is {
    Budget { .. } -> min_voting_period
    Policy { .. } -> min_voting_period
    Emergency { .. } -> emergency_voting_period
    Constitutional { .. } -> constitutional_voting_period
  }
}

test budget_proposal_has_7_day_voting_period() {
  let proposal_type = Budget { amount: 1000, recipient: #"7472656173757279" }
  get_voting_period(proposal_type) == min_voting_period
}

test policy_proposal_has_7_day_voting_period() {
  let proposal_type = Policy { policy_hash: #"706f6c6963793132" }
  get_voting_period(proposal_type) == min_voting_period
}

test emergency_proposal_has_1_day_voting_period() {
  let proposal_type = Emergency { action_hash: #"656d657267656e6379" }
  get_voting_period(proposal_type) == emergency_voting_period
}

test constitutional_proposal_has_37_day_voting_period() {
  let proposal_type = Constitutional { amendment_hash: #"616d656e646d656e" }
  get_voting_period(proposal_type) == constitutional_voting_period
}

test emergency_period_is_shorter_than_standard() {
  emergency_voting_period < min_voting_period
}

test constitutional_period_is_longer_than_standard() {
  constitutional_voting_period > min_voting_period
}

// =============================================================================
// PROPOSAL STATUS TESTS
// =============================================================================

fn can_vote_on_proposal(status: ProposalStatus) -> Bool {
  status == Active
}

test can_vote_on_active_proposal() {
  can_vote_on_proposal(Active)
}

test cannot_vote_on_passed_proposal() {
  !can_vote_on_proposal(Passed)
}

test cannot_vote_on_failed_proposal() {
  !can_vote_on_proposal(Failed)
}

test cannot_vote_on_executed_proposal() {
  !can_vote_on_proposal(Executed)
}

test cannot_vote_on_expired_proposal() {
  !can_vote_on_proposal(Expired)
}

// =============================================================================
// VOTING PERIOD VALIDATION TESTS
// =============================================================================

fn in_voting_period(
  current_slot: Int,
  voting_start: Int,
  voting_end: Int,
) -> Bool {
  current_slot >= voting_start && current_slot <= voting_end
}

test vote_at_start_of_period_valid() {
  in_voting_period(1000, 1000, 2000)
}

test vote_at_end_of_period_valid() {
  in_voting_period(2000, 1000, 2000)
}

test vote_in_middle_of_period_valid() {
  in_voting_period(1500, 1000, 2000)
}

test vote_before_period_invalid() {
  !in_voting_period(999, 1000, 2000)
}

test vote_after_period_invalid() {
  !in_voting_period(2001, 1000, 2000)
}

// =============================================================================
// PROPOSAL CREATION VALIDATION TESTS
// =============================================================================

fn validate_create_proposal(
  proposer_level: VerificationLevel,
  stake_amount: Int,
  required_stake: Int,
) -> Bool {
  can_propose(proposer_level) && stake_amount >= required_stake
}

test verified_can_create_proposal_with_stake() {
  validate_create_proposal(Verified, 100, 100)
}

test steward_can_create_proposal_with_stake() {
  validate_create_proposal(Steward, 100, 100)
}

test standard_cannot_create_proposal() {
  !validate_create_proposal(Standard, 100, 100)
}

test basic_cannot_create_proposal() {
  !validate_create_proposal(Basic, 100, 100)
}

test insufficient_stake_fails() {
  !validate_create_proposal(Verified, 50, 100)
}

test exact_stake_amount_passes() {
  validate_create_proposal(Verified, 100, 100)
}

test excess_stake_amount_passes() {
  validate_create_proposal(Verified, 150, 100)
}

// =============================================================================
// VOTE RECORDING TESTS
// =============================================================================

fn update_vote_totals(
  current_for: Int,
  current_against: Int,
  vote_for: Bool,
  weight: Int,
) -> (Int, Int) {
  if vote_for {
    (current_for + weight, current_against)
  } else {
    (current_for, current_against + weight)
  }
}

test vote_for_increases_for_count() {
  let (new_for, new_against) = update_vote_totals(10, 5, True, 2)
  new_for == 12 && new_against == 5
}

test vote_against_increases_against_count() {
  let (new_for, new_against) = update_vote_totals(10, 5, False, 2)
  new_for == 10 && new_against == 7
}

test verified_vote_adds_weight_2() {
  let weight = voting_weight(Verified)
  let (new_for, _) = update_vote_totals(0, 0, True, weight)
  new_for == 2
}

test steward_vote_adds_weight_3() {
  let weight = voting_weight(Steward)
  let (new_for, _) = update_vote_totals(0, 0, True, weight)
  new_for == 3
}

// =============================================================================
// DUPLICATE VOTE PREVENTION TESTS
// =============================================================================

fn has_voted(
  votes: List<VoteDatum>,
  voter: AssetName,
  proposal_id: ByteArray,
) -> Bool {
  list.any(votes, fn(v) { v.voter == voter && v.proposal_id == proposal_id })
}

test new_voter_can_vote() {
  let votes: List<VoteDatum> = []
  let voter = mock_pnft_name(1)
  !has_voted(votes, voter, #"70726f70303031")
}

test existing_voter_cannot_vote_again() {
  let voter = mock_pnft_name(1)
  let existing_vote = mock_vote(#"70726f70303031", voter, True, 2, 1000)
  let votes = [existing_vote]
  has_voted(votes, voter, #"70726f70303031")
}

test voter_can_vote_on_different_proposal() {
  let voter = mock_pnft_name(1)
  let existing_vote = mock_vote(#"70726f70303031", voter, True, 2, 1000)
  let votes = [existing_vote]
  !has_voted(votes, voter, #"70726f70303032")
}

test different_voter_can_vote() {
  let voter1 = mock_pnft_name(1)
  let voter2 = mock_pnft_name(2)
  let existing_vote = mock_vote(#"70726f70303031", voter1, True, 2, 1000)
  let votes = [existing_vote]
  !has_voted(votes, voter2, #"70726f70303031")
}

// =============================================================================
// PROPOSAL OUTCOME TESTS
// =============================================================================

fn proposal_passed(
  proposal_type: ProposalType,
  votes_for: Int,
  votes_against: Int,
  total_votes: Int,
  eligible_voters: Int,
) -> Bool {
  let has_quorum = quorum_reached(total_votes, eligible_voters)
  let has_approval =
    when proposal_type is {
      Constitutional { .. } -> supermajority_reached(votes_for, total_votes)
      _ -> majority_reached(votes_for, votes_against)
    }
  has_quorum && has_approval
}

test budget_proposal_passes_with_majority_and_quorum() {
  let proposal_type = Budget { amount: 1000, recipient: #"74726561737572" }
  proposal_passed(proposal_type, 60, 40, 100, 200)
}

test budget_proposal_fails_without_quorum() {
  let proposal_type = Budget { amount: 1000, recipient: #"74726561737572" }
  !proposal_passed(proposal_type, 6, 4, 10, 200)
}

test budget_proposal_fails_without_majority() {
  let proposal_type = Budget { amount: 1000, recipient: #"74726561737572" }
  !proposal_passed(proposal_type, 40, 60, 100, 200)
}

test constitutional_proposal_needs_supermajority() {
  let proposal_type = Constitutional { amendment_hash: #"616d656e646d656e" }
  proposal_passed(proposal_type, 63, 37, 100, 200)
}

test constitutional_proposal_fails_without_supermajority() {
  let proposal_type = Constitutional { amendment_hash: #"616d656e646d656e" }
  !proposal_passed(proposal_type, 62, 38, 100, 200)
}

test emergency_proposal_passes_with_majority_and_quorum() {
  let proposal_type = Emergency { action_hash: #"656d657267656e6379" }
  proposal_passed(proposal_type, 55, 45, 100, 200)
}

// =============================================================================
// STAKE RETURN TESTS
// =============================================================================

fn stake_handling(quorum_met: Bool, _proposal_passed_result: Bool) -> Int {
  if quorum_met {
    1
  } else {
    2
  }
}

test stake_returned_when_passed() {
  stake_handling(True, True) == 1
}

test stake_returned_when_failed_with_quorum() {
  stake_handling(True, False) == 1
}

test stake_forfeited_without_quorum() {
  stake_handling(False, False) == 2
}

// =============================================================================
// BIOREGION SCOPING TESTS
// =============================================================================

fn voter_in_bioregion(
  voter_bioregion: Option<ByteArray>,
  proposal_bioregion: ByteArray,
) -> Bool {
  voter_bioregion == Some(proposal_bioregion)
}

test voter_in_same_bioregion_can_vote() {
  voter_in_bioregion(Some(#"62696f726567696f6e31"), #"62696f726567696f6e31")
}

test voter_in_different_bioregion_cannot_vote() {
  !voter_in_bioregion(Some(#"62696f726567696f6e32"), #"62696f726567696f6e31")
}

test voter_without_bioregion_cannot_vote() {
  !voter_in_bioregion(None, #"62696f726567696f6e31")
}

// =============================================================================
// EXECUTION VALIDATION TESTS
// =============================================================================

fn can_execute(
  status: ProposalStatus,
  current_slot: Int,
  voting_end: Int,
  passed: Bool,
) -> Bool {
  status == Active && current_slot > voting_end && passed
}

test can_execute_passed_proposal_after_voting() {
  can_execute(Active, 2001, 2000, True)
}

test cannot_execute_during_voting() {
  !can_execute(Active, 1500, 2000, True)
}

test cannot_execute_failed_proposal() {
  !can_execute(Active, 2001, 2000, False)
}

test cannot_execute_already_executed() {
  !can_execute(Executed, 2001, 2000, True)
}

// =============================================================================
// CLOSE VALIDATION TESTS
// =============================================================================

fn can_close(
  status: ProposalStatus,
  current_slot: Int,
  voting_end: Int,
  passed: Bool,
) -> Bool {
  status == Active && current_slot > voting_end && !passed
}

test can_close_failed_proposal_after_voting() {
  can_close(Active, 2001, 2000, False)
}

test cannot_close_during_voting() {
  !can_close(Active, 1500, 2000, False)
}

test cannot_close_passed_proposal() {
  !can_close(Active, 2001, 2000, True)
}

// =============================================================================
// EDGE CASES
// =============================================================================

test zero_weight_voters_do_not_affect_outcome() {
  let basic_weight = voting_weight(Basic)
  let (new_for, new_against) = update_vote_totals(10, 10, True, basic_weight)
  new_for == 10 && new_against == 10
}

test multiple_steward_votes_accumulate() {
  let weight = voting_weight(Steward)
  let (vote1_for, _) = update_vote_totals(0, 0, True, weight)
  let (vote2_for, _) = update_vote_totals(vote1_for, 0, True, weight)
  let (vote3_for, _) = update_vote_totals(vote2_for, 0, True, weight)
  vote3_for == 9
}

test mixed_level_votes_sum_correctly() {
  let standard_w = voting_weight(Standard)
  let verified_w = voting_weight(Verified)
  let steward_w = voting_weight(Steward)
  let total = standard_w + verified_w + steward_w
  total == 6
}

test proposal_datum_preserved_on_vote() {
  let proposer = mock_pnft_name(1)
  let proposal =
    mock_proposal(
      proposer,
      #"62696f726567696f6e31",
      Budget { amount: 100, recipient: #"74726561737572" },
      1000,
      2000,
      Active,
      0,
      0,
    )
  let (new_for, new_against) =
    update_vote_totals(proposal.votes_for, proposal.votes_against, True, 2)
  new_for == 2 && new_against == 0 && proposal.proposal_id == #"70726f70303031" && proposal.bioregion == #"62696f726567696f6e31" && proposal.status == Active
}

test cycle_timing_for_proposals() {
  let cycle_0_start = cycle_start(0)
  let cycle_0_end = cycle_end(0)
  let cycle_length = cycle_0_end - cycle_0_start + 1
  cycle_length == cycle_slots
}
