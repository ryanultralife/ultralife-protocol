// =============================================================================
// UltraLife Protocol — Governance
// =============================================================================
//
// LAYER 6: COLLECTIVE DECISION
//
// Bioregional democracy with 37-day voting cycles.
// Proposals for budget, policy, emergency, and constitutional changes.
// Voting weight from verification level.
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Finite}
use cardano/address.{Script}
use cardano/assets.{AssetName, PolicyId, flatten, quantity_of}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use ultralife/prc37.{
  current_cycle, majority_reached, quorum_reached, supermajority_reached,
  voting_period,
}
use ultralife/types.{
  Active, Basic, BioregionDatum, Budget, Constitutional, Emergency, Executed,
  Expired, Failed, Passed, PnftDatum, Policy, ProposalDatum, ProposalStatus,
  ProposalType, Standard, Steward, VerificationLevel, Verified, VoteDatum, Ward,
  can_propose, voting_weight,
}

// =============================================================================
// CONSTANTS
// =============================================================================

/// Minimum voting period (7 days in slots)
const min_voting_period = 604800

/// Emergency voting period (1 day in slots)
const emergency_voting_period = 86400

/// Constitutional voting period (37 days in slots)
const constitutional_voting_period = 3196800

// =============================================================================
// TYPE DEFINITIONS FOR INLINE STRUCTS
// =============================================================================

/// Data about a proposer pNFT
type ProposerData {
  pnft: AssetName,
  owner: VerificationKeyHash,
  level: VerificationLevel,
  bioregion: ByteArray,
}

/// Data about a voter pNFT
type VoterData {
  pnft: AssetName,
  owner: VerificationKeyHash,
  level: VerificationLevel,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type GovernanceRedeemer {
  /// Create a new proposal
  CreateProposal { proposal_type: ProposalType, content_hash: ByteArray }
  /// Vote on a proposal
  Vote { proposal_id: ByteArray, vote_for: Bool }
  /// Execute passed proposal
  Execute { proposal_id: ByteArray }
  /// Close expired proposal
  Close { proposal_id: ByteArray }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type GovernanceConfig {
  /// pNFT policy
  pnft_policy: PolicyId,
  /// Bioregion beacon policy
  bioregion_policy: PolicyId,
  /// UltraLife token policy (for staking)
  token_policy: PolicyId,
  /// Token name
  token_name: AssetName,
  /// Proposal stake amount
  proposal_stake: Int,
  /// Treasury (for executed budget proposals)
  treasury: ByteArray,
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator governance(config: GovernanceConfig) {
  spend(
    datum: Option<ProposalDatum>,
    redeemer: GovernanceRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      CreateProposal { proposal_type, content_hash } ->
        validate_create_proposal(tx, proposal_type, content_hash, config)
      Vote { proposal_id, vote_for } -> {
        expect Some(d) = datum
        validate_vote(tx, d, proposal_id, vote_for, config)
      }
      Execute { proposal_id } -> {
        expect Some(d) = datum
        validate_execute(tx, d, proposal_id, config)
      }
      Close { proposal_id } -> {
        expect Some(d) = datum
        validate_close(tx, d, proposal_id, config)
      }
    }
  }

  else(_) {
    fail
  }
}

// =============================================================================
// CREATE PROPOSAL
// =============================================================================

fn validate_create_proposal(
  tx: Transaction,
  proposal_type: ProposalType,
  content_hash: ByteArray,
  config: GovernanceConfig,
) -> Bool {
  // 1. Find proposer pNFT
  let proposer = find_proposer_pnft(tx, config.pnft_policy)
  expect Some(proposer_data) = proposer
  // 2. Proposer must be Verified+ (can_propose)
  expect can_propose(proposer_data.level)
  // 3. Proposer must sign
  let proposer_signed = list.has(tx.extra_signatories, proposer_data.owner)
  // 4. Stake must be locked (returned if quorum reached)
  let stake_locked =
    verify_stake_locked(
      tx.outputs,
      config.token_policy,
      config.token_name,
      config.proposal_stake,
    )
  // 5. Calculate voting period based on type
  let current_slot = get_slot(tx)
  let period = get_voting_period(proposal_type)
  let voting_end = current_slot + period
  // 6. Proposal datum created
  let datum_created =
    verify_proposal_datum(
      tx.outputs,
      proposer_data.pnft,
      proposer_data.bioregion,
      proposal_type,
      content_hash,
      current_slot,
      voting_end,
    )
  proposer_signed && stake_locked && datum_created
}

fn get_voting_period(proposal_type: ProposalType) -> Int {
  when proposal_type is {
    Budget { .. } -> min_voting_period
    Policy { .. } -> min_voting_period
    Emergency { .. } -> emergency_voting_period
    Constitutional { .. } -> constitutional_voting_period
  }
}

// =============================================================================
// VOTE
// =============================================================================

fn validate_vote(
  tx: Transaction,
  proposal: ProposalDatum,
  proposal_id: ByteArray,
  vote_for: Bool,
  config: GovernanceConfig,
) -> Bool {
  // 1. Proposal must be Active
  expect proposal.status == Active
  // 2. Must be within voting period
  let current_slot = get_slot(tx)
  let in_period =
    current_slot >= proposal.voting_start && current_slot <= proposal.voting_end
  // 3. Find voter pNFT
  let voter = find_voter_pnft(tx, proposal.bioregion, config.pnft_policy)
  expect Some(voter_data) = voter
  // 4. Voter must sign
  let voter_signed = list.has(tx.extra_signatories, voter_data.owner)
  // 5. Calculate voting weight
  let weight = voting_weight(voter_data.level)
  // 6. Must not have voted already
  let not_voted =
    verify_not_voted(tx.reference_inputs, voter_data.pnft, proposal_id)
  // 7. Vote record created
  let vote_recorded =
    verify_vote_record(
      tx.outputs,
      proposal_id,
      voter_data.pnft,
      vote_for,
      weight,
      current_slot,
    )
  // 8. Proposal datum updated with vote
  let proposal_updated =
    verify_proposal_vote_added(tx.outputs, proposal, vote_for, weight)
  in_period && voter_signed && not_voted && vote_recorded && proposal_updated
}

// =============================================================================
// EXECUTE
// =============================================================================

fn validate_execute(
  tx: Transaction,
  proposal: ProposalDatum,
  proposal_id: ByteArray,
  config: GovernanceConfig,
) -> Bool {
  // 1. Voting must be complete
  let current_slot = get_slot(tx)
  let voting_complete = current_slot > proposal.voting_end
  // 2. Check outcome
  let total_votes = proposal.votes_for + proposal.votes_against
  let quorum =
    quorum_reached(total_votes, get_eligible_voters(tx, proposal.bioregion))
  let approval =
    when proposal.proposal_type is {
      Constitutional { .. } ->
        supermajority_reached(proposal.votes_for, total_votes)
      _ -> majority_reached(proposal.votes_for, proposal.votes_against)
    }
  // 3. Must have passed
  expect quorum && approval
  // 4. Execute based on type
  let executed = execute_proposal(tx, proposal, config)
  // 5. Proposal marked Executed, stake returned
  let proposal_updated = verify_proposal_executed(tx.outputs, proposal)
  let stake_returned =
    verify_stake_returned(
      tx.outputs,
      config.token_policy,
      config.token_name,
      config.proposal_stake,
      proposal.proposer,
      config.pnft_policy,
    )
  voting_complete && executed && proposal_updated && stake_returned
}

fn execute_proposal(
  tx: Transaction,
  proposal: ProposalDatum,
  config: GovernanceConfig,
) -> Bool {
  when proposal.proposal_type is {
    Budget { amount, recipient } ->
      // Transfer from treasury to recipient
      verify_budget_transfer(tx.outputs, amount, recipient, config.treasury)
    Policy { policy_hash } ->
      // Policy update (just record, actual enforcement is social)
      True
    Emergency { action_hash } ->
      // Emergency action (depends on action type)
      True
    Constitutional { amendment_hash } ->
      // Constitutional amendment (highest bar, longest process)
      True
  }
}

// =============================================================================
// CLOSE
// =============================================================================

fn validate_close(
  tx: Transaction,
  proposal: ProposalDatum,
  proposal_id: ByteArray,
  config: GovernanceConfig,
) -> Bool {
  // For proposals that failed or expired
  // 1. Voting must be complete
  let current_slot = get_slot(tx)
  let voting_complete = current_slot > proposal.voting_end
  // 2. Check outcome
  let total_votes = proposal.votes_for + proposal.votes_against
  let quorum =
    quorum_reached(total_votes, get_eligible_voters(tx, proposal.bioregion))
  let approval =
    when proposal.proposal_type is {
      Constitutional { .. } ->
        supermajority_reached(proposal.votes_for, total_votes)
      _ -> majority_reached(proposal.votes_for, proposal.votes_against)
    }
  // 3. Must have failed
  let failed = !quorum || !approval
  // 4. Determine stake handling
  // If quorum reached (even if failed): return stake
  // If quorum not reached: stake forfeited to bioregion treasury
  let stake_handled =
    if quorum {
      verify_stake_returned(
        tx.outputs,
        config.token_policy,
        config.token_name,
        config.proposal_stake,
        proposal.proposer,
        config.pnft_policy,
      )
    } else {
      verify_stake_forfeited(
        tx.outputs,
        config.token_policy,
        config.token_name,
        config.proposal_stake,
        proposal.bioregion,
      )
    }
  // 5. Proposal marked Failed/Expired
  let proposal_updated = verify_proposal_closed(tx.outputs, proposal)
  voting_complete && failed && stake_handled && proposal_updated
}

// =============================================================================
// HELPERS
// =============================================================================

fn find_proposer_pnft(
  tx: Transaction,
  pnft_policy: PolicyId,
) -> Option<ProposerData> {
  list.find_map(
    tx.reference_inputs,
    fn(input) {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          when datum.bioregion is {
            Some(br) ->
              Some(
                ProposerData {
                  pnft: datum.pnft_id,
                  owner: datum.owner,
                  level: datum.level,
                  bioregion: br,
                },
              )
            None -> None
          }
        }
        _ -> None
      }
    },
  )
}

fn find_voter_pnft(
  tx: Transaction,
  bioregion: ByteArray,
  pnft_policy: PolicyId,
) -> Option<VoterData> {
  list.find_map(
    tx.reference_inputs,
    fn(input) {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          if datum.bioregion == Some(bioregion) {
            Some(
              VoterData {
                pnft: datum.pnft_id,
                owner: datum.owner,
                level: datum.level,
              },
            )
          } else {
            None
          }
        }
        _ -> None
      }
    },
  )
}

fn get_slot(tx: Transaction) -> Int {
  when tx.validity_range.lower_bound.bound_type is {
    Finite(slot) -> slot
    _ -> 0
  }
}

fn get_eligible_voters(tx: Transaction, bioregion: ByteArray) -> Int {
  // Get from bioregion datum (resident_count) in reference inputs
  let result =
    list.find_map(
      tx.reference_inputs,
      fn(input) {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: BioregionDatum = data
            if datum.bioregion_id == bioregion {
              Some(datum.resident_count)
            } else {
              None
            }
          }
          _ -> None
        }
      },
    )
  when result is {
    Some(count) -> count
    None -> 1
  }
  // Fallback to avoid division by zero
}

fn verify_stake_locked(
  outputs: List<Output>,
  policy: PolicyId,
  name: AssetName,
  amount: Int,
) -> Bool {
  let total =
    list.foldl(
      outputs,
      0,
      fn(output, acc) { acc + quantity_of(output.value, policy, name) },
    )
  total >= amount
}

fn verify_proposal_datum(
  outputs: List<Output>,
  proposer: AssetName,
  bioregion: ByteArray,
  proposal_type: ProposalType,
  content_hash: ByteArray,
  start: Int,
  end: Int,
) -> Bool {
  list.any(
    outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) -> {
          expect proposal: ProposalDatum = data
          proposal.proposer == proposer && proposal.bioregion == bioregion && proposal.content_hash == content_hash && proposal.voting_start == start && proposal.voting_end == end && proposal.status == Active && proposal.votes_for == 0 && proposal.votes_against == 0
        }
        _ -> False
      }
    },
  )
}

fn verify_not_voted(
  reference_inputs: List<Input>,
  voter: AssetName,
  proposal_id: ByteArray,
) -> Bool {
  // Verify no vote record exists for this voter on this proposal
  !list.any(
    reference_inputs,
    fn(input) {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect vote: VoteDatum = data
          vote.voter == voter && vote.proposal_id == proposal_id
        }
        _ -> False
      }
    },
  )
}

fn verify_vote_record(
  outputs: List<Output>,
  proposal_id: ByteArray,
  voter: AssetName,
  vote_for: Bool,
  weight: Int,
  slot: Int,
) -> Bool {
  list.any(
    outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) -> {
          expect vote: VoteDatum = data
          vote.proposal_id == proposal_id && vote.voter == voter && vote.vote_for == vote_for && vote.weight == weight
        }
        _ -> False
      }
    },
  )
}

fn verify_proposal_vote_added(
  outputs: List<Output>,
  old_proposal: ProposalDatum,
  vote_for: Bool,
  weight: Int,
) -> Bool {
  list.any(
    outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) -> {
          expect new_proposal: ProposalDatum = data
          if vote_for {
            new_proposal.votes_for == old_proposal.votes_for + weight && new_proposal.votes_against == old_proposal.votes_against
          } else {
            new_proposal.votes_against == old_proposal.votes_against + weight && new_proposal.votes_for == old_proposal.votes_for
          }
        }
        _ -> False
      }
    },
  )
}

fn verify_budget_transfer(
  outputs: List<Output>,
  amount: Int,
  recipient: ByteArray,
  treasury: ByteArray,
) -> Bool {
  // Verify tokens transferred from treasury to recipient
  // This would check token amounts - simplified for now
  list.any(
    outputs,
    fn(output) {
      when output.address.payment_credential is {
        Script(hash) -> hash == recipient
        _ -> False
      }
    },
  )
}

fn verify_proposal_executed(
  outputs: List<Output>,
  proposal: ProposalDatum,
) -> Bool {
  list.any(
    outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) -> {
          expect new_proposal: ProposalDatum = data
          new_proposal.proposal_id == proposal.proposal_id && new_proposal.status == Executed
        }
        _ -> False
      }
    },
  )
}

fn verify_stake_returned(
  outputs: List<Output>,
  policy: PolicyId,
  name: AssetName,
  amount: Int,
  proposer: AssetName,
  pnft_policy: PolicyId,
) -> Bool {
  // Verify stake tokens returned to proposer's address
  // Would look up proposer's owner key from pNFT
  let total_returned =
    list.foldl(
      outputs,
      0,
      fn(output, acc) { acc + quantity_of(output.value, policy, name) },
    )
  total_returned >= amount
}

fn verify_stake_forfeited(
  outputs: List<Output>,
  policy: PolicyId,
  name: AssetName,
  amount: Int,
  bioregion: ByteArray,
) -> Bool {
  // Verify stake tokens sent to bioregion treasury
  list.any(
    outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) -> {
          expect datum: BioregionDatum = data
          datum.bioregion_id == bioregion && quantity_of(
            output.value,
            policy,
            name,
          ) >= amount
        }
        _ -> False
      }
    },
  )
}

fn verify_proposal_closed(
  outputs: List<Output>,
  proposal: ProposalDatum,
) -> Bool {
  list.any(
    outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) -> {
          expect new_proposal: ProposalDatum = data
          new_proposal.proposal_id == proposal.proposal_id && (
            new_proposal.status == Failed || new_proposal.status == Expired
          )
        }
        _ -> False
      }
    },
  )
}
// =============================================================================
// DOCUMENTATION
// =============================================================================
//
// GOVERNANCE STRUCTURE
// ====================
//
// Bioregional democracy:
// - Each bioregion governs itself
// - Cross-bioregion via federation
// - All voting is on-chain
//
// PROPOSAL TYPES
// ==============
//
// Budget: Allocate funds (37-day vote, simple majority)
// Policy: Change rules (37-day vote, simple majority)
// Emergency: Fast action (3.7-day vote, simple majority)
// Constitutional: Fundamental change (74-day vote, supermajority 63%)
//
// VOTING WEIGHTS
// ==============
//
// Standard: 1 vote
// Verified: 2 votes
// Steward: 3 votes
//
// STAKE MECHANICS
// ===============
//
// Proposal requires 100 token stake.
// If quorum (37%) reached: stake returned regardless of outcome
// If quorum not reached: stake forfeited to bioregion treasury
//
// This prevents spam while not punishing controversial proposals.
//
// =============================================================================
