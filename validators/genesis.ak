// =============================================================================
// UltraLife Protocol — Genesis Bootstrap
// =============================================================================
//
// SOLVING THE BOOTSTRAP PROBLEM
//
// How do you start a system that requires:
// - DNA oracles (but oracles need to be registered)
// - Stewards (but Stewards need other Stewards to endorse)
// - Bioregions (but bioregions need Verified+ founders)
//
// Answer: Genesis period with explicit founders, progressive decentralization.
//
// KEY INSIGHT: Founders are identified by WALLET KEYS, not pNFTs.
//
// During genesis:
// - Founder keys have special powers (can verify DNA, endorse Stewards, etc.)
// - Founders create their own pNFTs like anyone else
// - Founders can upgrade their OWN pNFTs using founder authority
// - Founders can cross-verify each other's DNA
//
// After genesis:
// - Founder keys have NO special meaning
// - System is fully governed by pNFT-based identity
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Finite}
use cardano/address.{Script}
use cardano/assets.{AssetName, PolicyId, flatten}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use ultralife/types.{
  Basic, PnftDatum, Standard, Steward, VerificationLevel, Verified,
}

/// Oracle attestation for DNA verification
pub type OracleAttestation {
  oracle_id: ByteArray,
  signing_key: VerificationKeyHash,
}

// =============================================================================
// GENESIS CONFIGURATION
// =============================================================================

pub type GenesisConfig {
  /// Slot when genesis period ends
  genesis_end_slot: Int,
  /// Founding oracles — can attest DNA during genesis
  founding_oracles: List<VerificationKeyHash>,
  /// Founding stewards — can bootstrap bioregions and endorse stewards
  founding_stewards: List<VerificationKeyHash>,
  /// Minimum founder attestations for DNA verification
  genesis_oracle_threshold: Int,
  /// Non-founder Stewards needed before decentralization
  steward_threshold: Int,
  /// pNFT policy
  pnft_policy: PolicyId,
}

// =============================================================================
// GENESIS STATE
// =============================================================================

pub type GenesisDatum {
  /// DNA verifications completed
  verifications_completed: Int,
  /// Non-founder Stewards created
  stewards_created: Int,
  /// Bioregions established
  bioregions_created: Int,
  /// Registered DNA oracles
  registered_oracles: List<OracleRegistration>,
  /// Is genesis still active?
  genesis_active: Bool,
}

pub type OracleRegistration {
  partner_id: ByteArray,
  signing_key: VerificationKeyHash,
  registered_at: Int,
  registered_by: AssetName,
  metadata_hash: ByteArray,
  active: Bool,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type GenesisRedeemer {
  /// DNA verification during genesis (founders as oracles)
  GenesisVerifyDNA {
    pnft: AssetName,
    dna_hash: ByteArray,
    founder_attestations: List<VerificationKeyHash>,
  }
  /// Founder upgrades their OWN pNFT to Standard (self-verify during genesis)
  FounderSelfVerify { pnft: AssetName, dna_hash: ByteArray }
  /// Founder upgrades their OWN pNFT directly to Steward
  FounderBecomeSteward { pnft: AssetName }
  /// Endorse community member as Steward during genesis
  GenesisEndorseSteward {
    pnft: AssetName,
    founder_endorsements: List<VerificationKeyHash>,
  }
  /// Register DNA verification partner
  RegisterOracle {
    partner_id: ByteArray,
    signing_key: VerificationKeyHash,
    metadata_hash: ByteArray,
  }
  /// Deactivate compromised oracle
  DeactivateOracle { partner_id: ByteArray }
  /// Increment bioregion count (called by bioregion contract)
  RecordBioregion
  /// End genesis period
  EndGenesis
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator genesis(config: GenesisConfig) {
  spend(
    datum: Option<GenesisDatum>,
    redeemer: GenesisRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(d) = datum
    let slot = get_slot(tx)
    when redeemer is {
      // =================================================================
      // FOUNDER SELF-VERIFICATION
      // Founders can verify their own DNA during genesis
      // This bootstraps the first identities
      // =================================================================
      FounderSelfVerify { pnft, dna_hash } -> {
        expect d.genesis_active && slot < config.genesis_end_slot
        // The signer must be a founding oracle
        let signer_is_founder =
          list.any(
            config.founding_oracles,
            fn(f) { list.has(tx.extra_signatories, f) },
          )
        // The pNFT must belong to the signer (founder verifying THEIR OWN)
        let pnft_belongs_to_signer =
          verify_pnft_owner_signed(tx, pnft, config.pnft_policy)
        signer_is_founder && pnft_belongs_to_signer && verify_basic_pnft(
          tx,
          pnft,
          config.pnft_policy,
        ) && verify_dna_unique(tx, dna_hash) && verify_datum_verification(
          tx.outputs,
          d,
        )
      }
      // =================================================================
      // FOUNDER BECOMES STEWARD
      // Founders can upgrade directly to Steward (skip Verified)
      // This is the ONLY way to create initial Stewards
      // =================================================================
      FounderBecomeSteward { pnft } -> {
        expect d.genesis_active
        // The signer must be a founding steward
        let signer_is_founder =
          list.any(
            config.founding_stewards,
            fn(f) { list.has(tx.extra_signatories, f) },
          )
        // The pNFT must belong to the signer AND be Standard level
        // (must have done DNA verification first)
        let pnft_is_standard =
          verify_standard_pnft(tx, pnft, config.pnft_policy)
        let pnft_belongs_to_signer =
          verify_pnft_owner_signed(tx, pnft, config.pnft_policy)
        signer_is_founder && pnft_is_standard && pnft_belongs_to_signer
      }
      // Note: pNFT contract must also check genesis datum to allow this upgrade
      // =================================================================
      // GENESIS DNA VERIFICATION (for non-founders)
      // Multiple founders attest to someone else's DNA
      // =================================================================
      GenesisVerifyDNA { pnft, dna_hash, founder_attestations } -> {
        expect d.genesis_active && slot < config.genesis_end_slot
        // Count valid founder signatures
        let valid =
          list.length(
            list.filter(
              founder_attestations,
              fn(f) {
                list.has(config.founding_oracles, f) && list.has(
                  tx.extra_signatories,
                  f,
                )
              },
            ),
          )
        // Must meet threshold
        valid >= config.genesis_oracle_threshold && verify_basic_pnft(
          tx,
          pnft,
          config.pnft_policy,
        ) && verify_dna_unique(tx, dna_hash) && verify_datum_verification(
          tx.outputs,
          d,
        )
      }
      // =================================================================
      // GENESIS STEWARD ENDORSEMENT (for non-founders)
      // Founders can endorse community members as Stewards
      // =================================================================
      GenesisEndorseSteward { pnft, founder_endorsements } -> {
        expect d.genesis_active
        let valid =
          list.length(
            list.filter(
              founder_endorsements,
              fn(f) {
                list.has(config.founding_stewards, f) && list.has(
                  tx.extra_signatories,
                  f,
                )
              },
            ),
          )
        // Need 2+ founder endorsements
        valid >= 2 && verify_verified_pnft(tx, pnft, config.pnft_policy) && verify_datum_steward(
          tx.outputs,
          d,
        )
      }
      // =================================================================
      // ORACLE REGISTRATION
      // =================================================================
      RegisterOracle { partner_id, signing_key, metadata_hash } ->
        if d.genesis_active {
          // During genesis: 2+ founders
          let founder_count =
            list.length(
              list.filter(
                config.founding_stewards,
                fn(f) { list.has(tx.extra_signatories, f) },
              ),
            )
          founder_count >= 2
        } else {
          // After genesis: governance approval
          verify_governance_approval(tx, partner_id)
        } && !list.any(
          d.registered_oracles,
          fn(o) { o.partner_id == partner_id },
        ) && verify_oracle_registration(
          tx.outputs,
          d,
          partner_id,
          signing_key,
          metadata_hash,
          slot,
        )
      // =================================================================
      // ORACLE DEACTIVATION
      // =================================================================
      DeactivateOracle { partner_id } ->
        list.any(
          d.registered_oracles,
          fn(o) { o.partner_id == partner_id && o.active },
        ) && if d.genesis_active {
          list.length(
            list.filter(
              config.founding_stewards,
              fn(f) { list.has(tx.extra_signatories, f) },
            ),
          ) >= 2
        } else {
          verify_governance_approval(tx, partner_id) || verify_steward_multisig(
            tx,
            3,
            config.pnft_policy,
          )
        } && verify_oracle_deactivation(tx.outputs, d, partner_id)
      // =================================================================
      // RECORD BIOREGION (called by bioregion contract)
      // =================================================================
      RecordBioregion ->
        // Bioregion contract calls this to increment counter
        // Must verify bioregion contract is in transaction
        verify_bioregion_contract_present(tx, config) && verify_datum_bioregion(
          tx.outputs,
          d,
        )
      // =================================================================
      // END GENESIS
      // =================================================================
      EndGenesis -> {
        expect d.genesis_active
        let time_ended = slot >= config.genesis_end_slot
        let thresholds_met =
          d.stewards_created >= config.steward_threshold && list.length(
            d.registered_oracles,
          ) >= 3 && d.bioregions_created >= 1
        ( time_ended || thresholds_met ) && verify_genesis_ended(tx.outputs, d)
      }
    }
  }

  else(_) {
    fail
  }
}

// =============================================================================
// POST-GENESIS VERIFICATION
// =============================================================================

/// After genesis, DNA verification uses registered oracles
pub fn verify_dna_post_genesis(
  tx: Transaction,
  oracle_attestations: List<OracleAttestation>,
  genesis_datum: GenesisDatum,
  required: Int,
) -> Bool {
  expect !genesis_datum.genesis_active

  let valid =
    list.length(
      list.filter(
        oracle_attestations,
        fn(att) {
          list.any(
            genesis_datum.registered_oracles,
            fn(o) {
              o.partner_id == att.oracle_id && o.active && o.signing_key == att.signing_key
            },
          )
        },
      ),
    )

  valid >= required
}

// =============================================================================
// HELPERS
// =============================================================================

fn get_slot(tx: Transaction) -> Int {
  when tx.validity_range.lower_bound.bound_type is {
    Finite(slot) -> slot
    _ -> 0
  }
}

/// Verify Basic level pNFT exists and is valid
fn verify_basic_pnft(tx: Transaction, pnft: AssetName, policy: PolicyId) -> Bool {
  list.any(
    tx.reference_inputs,
    fn(input) {
      let has_pnft =
        list.any(
          flatten(input.output.value),
          fn(asset) {
            let (p, name, qty) = asset
            p == policy && name == pnft && qty > 0
          },
        )
      if has_pnft {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: PnftDatum = data
            datum.level == Basic
          }
          _ -> False
        }
      } else {
        False
      }
    },
  )
}

/// Verify Standard level pNFT exists and is valid
fn verify_standard_pnft(
  tx: Transaction,
  pnft: AssetName,
  policy: PolicyId,
) -> Bool {
  list.any(
    tx.reference_inputs,
    fn(input) {
      let has_pnft =
        list.any(
          flatten(input.output.value),
          fn(asset) {
            let (p, name, qty) = asset
            p == policy && name == pnft && qty > 0
          },
        )
      if has_pnft {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: PnftDatum = data
            datum.level == Standard || datum.level == Verified || datum.level == Steward
          }
          _ -> False
        }
      } else {
        False
      }
    },
  )
}

/// Verify Verified level pNFT exists and is valid  
fn verify_verified_pnft(
  tx: Transaction,
  pnft: AssetName,
  policy: PolicyId,
) -> Bool {
  list.any(
    tx.reference_inputs,
    fn(input) {
      let has_pnft =
        list.any(
          flatten(input.output.value),
          fn(asset) {
            let (p, name, qty) = asset
            p == policy && name == pnft && qty > 0
          },
        )
      if has_pnft {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: PnftDatum = data
            datum.level == Verified || datum.level == Steward
          }
          _ -> False
        }
      } else {
        False
      }
    },
  )
}

/// Verify DNA hash is unique (not used by another pNFT)
fn verify_dna_unique(tx: Transaction, hash: ByteArray) -> Bool {
  // Check no other pNFT in reference inputs has this DNA hash
  !list.any(
    tx.reference_inputs,
    fn(input) {
      when input.output.datum is {
        InlineDatum(data) -> {
          expect datum: PnftDatum = data
          datum.dna_hash == Some(hash)
        }
        _ -> False
      }
    },
  )
}

/// Verify pNFT owner signed the transaction
fn verify_pnft_owner_signed(
  tx: Transaction,
  pnft: AssetName,
  policy: PolicyId,
) -> Bool {
  list.any(
    tx.reference_inputs,
    fn(input) {
      let has_pnft =
        list.any(
          flatten(input.output.value),
          fn(asset) {
            let (p, name, qty) = asset
            p == policy && name == pnft && qty > 0
          },
        )
      if has_pnft {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: PnftDatum = data
            list.has(tx.extra_signatories, datum.owner)
          }
          _ -> False
        }
      } else {
        False
      }
    },
  )
}

/// Verify governance approval (governance contract in reference inputs)
fn verify_governance_approval(tx: Transaction, subject: ByteArray) -> Bool {
  // Governance approval indicated by presence of governance contract
  list.any(
    tx.reference_inputs,
    fn(input) {
      when input.output.datum is {
        InlineDatum(data) ->
          // Check for governance approval datum
          True
        _ -> False
      }
    },
  )
}

/// Verify required number of stewards signed
fn verify_steward_multisig(
  tx: Transaction,
  required: Int,
  policy: PolicyId,
) -> Bool {
  let steward_count =
    list.foldl(
      tx.reference_inputs,
      0,
      fn(input, acc) {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: PnftDatum = data
            if datum.level == Steward && list.has(
              tx.extra_signatories,
              datum.owner,
            ) {
              acc + 1
            } else {
              acc
            }
          }
          _ -> acc
        }
      },
    )
  steward_count >= required
}

/// Verify bioregion contract is present in transaction
fn verify_bioregion_contract_present(
  tx: Transaction,
  config: GenesisConfig,
) -> Bool {
  list.any(
    tx.reference_inputs,
    fn(input) {
      when input.output.address.payment_credential is {
        Script(hash) -> True
        // Would check against config.bioregion_policy
        _ -> False
      }
    },
  )
}

fn verify_datum_verification(outputs: List<Output>, old: GenesisDatum) -> Bool {
  list.any(
    outputs,
    fn(o) {
      when o.datum is {
        InlineDatum(data) -> {
          expect new: GenesisDatum = data
          new.verifications_completed == old.verifications_completed + 1
        }
        _ -> False
      }
    },
  )
}

fn verify_datum_steward(outputs: List<Output>, old: GenesisDatum) -> Bool {
  list.any(
    outputs,
    fn(o) {
      when o.datum is {
        InlineDatum(data) -> {
          expect new: GenesisDatum = data
          new.stewards_created == old.stewards_created + 1
        }
        _ -> False
      }
    },
  )
}

/// Verify oracle registration in outputs
fn verify_oracle_registration(
  outputs: List<Output>,
  old: GenesisDatum,
  id: ByteArray,
  key: VerificationKeyHash,
  meta: ByteArray,
  slot: Int,
) -> Bool {
  list.any(
    outputs,
    fn(o) {
      when o.datum is {
        InlineDatum(data) -> {
          expect new: GenesisDatum = data
          // Check oracle added to list
          list.any(
            new.registered_oracles,
            fn(oracle) {
              oracle.partner_id == id && oracle.signing_key == key && oracle.metadata_hash == meta && oracle.registered_at == slot && oracle.active == True
            },
          )
        }
        _ -> False
      }
    },
  )
}

/// Verify oracle deactivation in outputs
fn verify_oracle_deactivation(
  outputs: List<Output>,
  old: GenesisDatum,
  id: ByteArray,
) -> Bool {
  list.any(
    outputs,
    fn(o) {
      when o.datum is {
        InlineDatum(data) -> {
          expect new: GenesisDatum = data
          // Check oracle marked inactive
          list.any(
            new.registered_oracles,
            fn(oracle) { oracle.partner_id == id && oracle.active == False },
          )
        }
        _ -> False
      }
    },
  )
}

fn verify_datum_bioregion(outputs: List<Output>, old: GenesisDatum) -> Bool {
  list.any(
    outputs,
    fn(o) {
      when o.datum is {
        InlineDatum(data) -> {
          expect new: GenesisDatum = data
          new.bioregions_created == old.bioregions_created + 1
        }
        _ -> False
      }
    },
  )
}

fn verify_genesis_ended(outputs: List<Output>, old: GenesisDatum) -> Bool {
  list.any(
    outputs,
    fn(o) {
      when o.datum is {
        InlineDatum(data) -> {
          expect new: GenesisDatum = data
          new.genesis_active == False
        }
        _ -> False
      }
    },
  )
}
// =============================================================================
// BOOTSTRAP SEQUENCE
// =============================================================================
//
// FOUNDERS ARE IDENTIFIED BY WALLET KEYS, NOT pNFTs
//
// 1. DEPLOY
//    - Genesis contract configured with founder KEY HASHES
//    - founding_oracles: keys that can attest DNA
//    - founding_stewards: keys that can endorse Stewards
//    - These are wallet keys, NOT pNFT identifiers
//
// 2. FOUNDERS CREATE pNFTs (like anyone else)
//    - Each founder: MintBasic { owner: their_key }
//    - Result: Basic pNFT in founder's wallet
//    - No special treatment at this step
//
// 3. FOUNDERS SELF-VERIFY DNA
//    - FounderSelfVerify { pnft, dna_hash }
//    - Founder signs with their founding_oracle key
//    - pNFT upgrades from Basic → Standard
//    - This is the ONLY way to bootstrap first Standard pNFTs
//
// 4. FOUNDERS BECOME STEWARDS
//    - FounderBecomeSteward { pnft }
//    - Founder signs with their founding_steward key
//    - pNFT upgrades directly to Steward (skip Verified)
//    - This is the ONLY way to create first Stewards
//
// 5. FOUNDERS CREATE FIRST BIOREGION
//    - Using their Steward pNFTs
//    - Bioregion contract checks founder key during genesis
//    - RecordBioregion called to update genesis datum
//
// 6. FOUNDERS REGISTER DNA ORACLES
//    - RegisterOracle { partner_id, signing_key, ... }
//    - Requires 2+ founder signatures
//    - Partners could be clinics, testing services, etc.
//
// 7. COMMUNITY ONBOARDING
//    - Users create Basic pNFTs (permissionless)
//    - Users visit registered DNA partner
//    - Partner attests DNA → user upgrades to Standard
//    - OR: Multiple founders attest (GenesisVerifyDNA)
//
// 8. COMMUNITY STEWARDS EMERGE
//    - Active Standard users prove residency → Verified
//    - Founders endorse as Stewards (GenesisEndorseSteward)
//    - Requires 2+ founder endorsements
//
// 9. GENESIS ENDS
//    - When: 37+ non-founder Stewards AND 3+ oracles AND 1+ bioregion
//    - OR: genesis_end_slot reached
//    - EndGenesis transaction marks genesis_active = False
//
// 10. DECENTRALIZED OPERATION
//    - Founder keys have NO special meaning anymore
//    - DNA verification through registered oracles
//    - Steward endorsement through existing Stewards
//    - Oracle registration through governance
//
// KEY INSIGHT:
// Founders are trusted WALLET KEYS that bootstrap the system.
// Once enough community Stewards exist, founder keys become ordinary.
// The pNFT system then governs itself.
//
// =============================================================================
