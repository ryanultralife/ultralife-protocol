// =============================================================================
// UltraLife Protocol — Living Memory
// =============================================================================
//
// LAYER 7: COLLECTIVE UNDERSTANDING
//
// Interpretation registry for emergent meaning.
// When 37+ interpretations resonate on a substrate, emergence occurs.
// Drift-as-feature: understanding evolves over time.
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Finite}
use cardano/assets.{PolicyId, AssetName, quantity_of}
use cardano/transaction.{Transaction, Input, Output, OutputReference, InlineDatum}
use ultralife/types.{
  PnftDatum, InterpretationDatum, InterpreterType, Individual, Community, Collective,
}
use ultralife/prc37.{current_cycle, calculate_vitality}

/// Resonance threshold for interpretation emergence
const resonance_threshold = 37

// =============================================================================
// TYPE DEFINITIONS FOR INLINE STRUCTS
// =============================================================================

/// Information about an interpreter (pNFT holder)
type InterpreterInfo {
  pnft: AssetName,
  owner: VerificationKeyHash,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type MemoryRedeemer {
  RecordInterpretation { substrate_ref: ByteArray, content_hash: ByteArray }
  Resonate { interpretation_id: ByteArray }
  MarkEmergence { interpretation_id: ByteArray }
  Archive { interpretation_id: ByteArray }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type MemoryConfig {
  token_policy: PolicyId,
  token_name: AssetName,
  pnft_policy: PolicyId,
  initial_vitality: Int,
  resonance_pool: ByteArray,
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator memory(config: MemoryConfig) {
  spend(
    datum: Option<InterpretationDatum>,
    redeemer: MemoryRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      RecordInterpretation { substrate_ref, content_hash } -> {
        let interpreter = find_interpreter(tx, config.pnft_policy)
        expect Some(i) = interpreter
        let signed = list.has(tx.extra_signatories, i.owner)
        let fee_ok = verify_fee(tx.outputs, config)
        let slot = get_slot(tx)
        let cycle = current_cycle(slot)
        let datum_ok = verify_new_datum(tx.outputs, substrate_ref, i.pnft, content_hash, slot, config.initial_vitality, cycle)
        signed && fee_ok && datum_ok
      }
      
      Resonate { interpretation_id } -> {
        expect Some(d) = datum
        let resonator = find_interpreter(tx, config.pnft_policy)
        expect Some(r) = resonator
        let signed = list.has(tx.extra_signatories, r.owner)
        let not_self = r.pnft != d.interpreter_id
        let slot = get_slot(tx)
        let cycles = current_cycle(slot) - d.cycle
        let vitality = calculate_vitality(d.vitality, cycles)
        let vital = vitality > 0
        let updated = verify_resonance(tx.outputs, d, vitality)
        signed && not_self && vital && updated
      }
      
      MarkEmergence { interpretation_id } -> {
        expect Some(d) = datum
        let threshold = d.resonance >= resonance_threshold
        expect d.interpreter == Individual
        let upgraded = verify_upgrade(tx.outputs, d, Community)
        threshold && upgraded
      }
      
      Archive { interpretation_id } -> {
        expect Some(d) = datum
        let slot = get_slot(tx)
        let cycles = current_cycle(slot) - d.cycle
        let vitality = calculate_vitality(d.vitality, cycles)
        vitality == 0
      }
    }
  }
}

// =============================================================================
// HELPERS
// =============================================================================

fn find_interpreter(tx: Transaction, policy: PolicyId) -> Option<InterpreterInfo> {
  list.find_map(tx.reference_inputs, fn(input) {
    when input.output.datum is {
      InlineDatum(data) -> {
        expect datum: PnftDatum = data
        Some(InterpreterInfo { pnft: datum.pnft_id, owner: datum.owner })
      }
      _ -> None
    }
  })
}

fn get_slot(tx: Transaction) -> Int {
  when tx.validity_range.lower_bound.bound_type is {
    Finite(slot) -> slot
    _ -> 0
  }
}

/// Verify interpretation fee paid
fn verify_fee(outputs: List<Output>, config: MemoryConfig) -> Bool {
  list.any(outputs, fn(output) {
    let fee_amount = quantity_of(output.value, config.token_policy, config.token_name)
    fee_amount >= 1  // 1 token minimum fee
  })
}

/// Verify new interpretation datum created
fn verify_new_datum(outputs: List<Output>, substrate: ByteArray, interpreter_id: ByteArray, content: ByteArray, slot: Int, vitality: Int, cycle: Int) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: InterpretationDatum = data
        datum.substrate_ref == substrate &&
        datum.interpreter_id == interpreter_id &&
        datum.content_hash == content &&
        datum.created_at == slot &&
        datum.vitality == vitality &&
        datum.cycle == cycle
      }
      _ -> False
    }
  })
}

/// Verify resonance increased and vitality updated
fn verify_resonance(outputs: List<Output>, old: InterpretationDatum, vitality: Int) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: InterpretationDatum = data
        datum.substrate_ref == old.substrate_ref &&
        datum.resonance == old.resonance + 1 &&
        datum.vitality == vitality
      }
      _ -> False
    }
  })
}

/// Verify interpreter type upgraded
fn verify_upgrade(outputs: List<Output>, old: InterpretationDatum, new_type: InterpreterType) -> Bool {
  list.any(outputs, fn(output) {
    when output.datum is {
      InlineDatum(data) -> {
        expect datum: InterpretationDatum = data
        datum.substrate_ref == old.substrate_ref &&
        datum.interpreter == new_type
      }
      _ -> False
    }
  })
}

// =============================================================================
// DOCUMENTATION
// =============================================================================
//
// LIVING MEMORY — Collective meaning-making through interpretation
//
// PROCESS:
// 1. Record: Anyone interprets any substrate (1 token fee)
// 2. Resonate: Others agree → increases resonance + vitality
// 3. Emerge: 37+ resonances → Individual becomes Community
// 4. Archive: Zero vitality → dormant, preserved in history
//
// VITALITY: Decays -10% per cycle without resonance
// DRIFT: Understanding evolves through new interpretations
//
// =============================================================================
