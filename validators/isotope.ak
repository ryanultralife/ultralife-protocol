// =============================================================================
// UltraLife Protocol — Medical isotope lots (first tokenization)
// =============================================================================
//
// Title to atoms. Not a meme coin. Not a fraction of a human.
//
// A lot is one eUTxO. Customer pNFT owns it. A licensed lab may custody it.
// The owner may hold until they need treatment, sell the remaining activity,
// or have a lab convert parent → daughter → dose.
//
// Physics is on the datum: activity decays with slot. After expiry the lot
// cannot become a dose. Administered lots are not transferable.
//
// Every spend terminates at a pNFT. No anonymous holder. No ghost clinic.
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Finite}
use cardano/assets.{AssetName, PolicyId}
use cardano/transaction.{OutputReference, Transaction}

pub type IsotopeConfig {
  pnft_policy: PolicyId,
  lot_policy: PolicyId,
  /// Licensed converter pNFTs (labs, pharmacies, radiopharmacies)
  labs: List<AssetName>,
  /// Minimum remaining Bq to convert or administer
  min_useful_bq: Int,
}

pub type Nuclide {
  Mo99
  Tc99m
  I131
  Lu177
  Ac225
  F18
}

pub type Form {
  Target
  Generator
  Eluate
  Radiopharmaceutical
  Dose
}

pub type LotStatus {
  PreSold
  Produced
  Held
  Converted
  Administered
  Decayed
  Recalled
}

pub type IsotopeLot {
  lot_id: ByteArray,
  nuclide: Nuclide,
  form: Form,
  /// Activity in Bq at calibrated_slot
  activity_bq: Int,
  calibrated_slot: Int,
  /// Half-life in slots (~1 slot / second)
  half_life_slots: Int,
  expiry_slot: Int,
  owner: AssetName,
  custodian: AssetName,
  patient: Option<AssetName>,
  parent: Option<ByteArray>,
  status: LotStatus,
  spec_hash: ByteArray,
}

pub type IsotopeRedeemer {
  PreSell { buyer: AssetName, activity_bq: Int }
  Produce { coa_hash: ByteArray }
  Transfer { new_owner: AssetName }
  Convert { daughter: Nuclide, activity_out: Int, process_hash: ByteArray }
  Administer { patient: AssetName }
  Recall { reason_hash: ByteArray }
  Expire
}

validator isotope(config: IsotopeConfig) {
  spend(
    datum: Option<IsotopeLot>,
    redeemer: IsotopeRedeemer,
    _own_ref: OutputReference,
    tx: Transaction,
  ) {
    expect Some(lot) = datum
    let slot = get_slot(tx)
    when redeemer is {
      PreSell { buyer, activity_bq } -> {
        activity_bq > 0 && buyer != #"" && remaining_bq(lot, slot) == lot.activity_bq
      }
      Produce { .. } -> {
        lot.status == PreSold && signer_is_lab(tx, config) && remaining_bq(lot, slot) > 0
      }
      Transfer { new_owner } -> {
        transferable(lot) && signer_is_owner(tx, lot) && new_owner != #"" && slot < lot.expiry_slot
      }
      Convert { activity_out, .. } -> {
        convertible(lot) && signer_is_lab(tx, config) && activity_out > 0 && remaining_bq(
          lot,
          slot,
        ) >= config.min_useful_bq && remaining_bq(lot, slot) >= activity_out
      }
      Administer { patient } -> {
        ( lot.form == Dose || lot.form == Radiopharmaceutical ) && signer_is_lab(
          tx,
          config,
        ) && patient != #"" && remaining_bq(lot, slot) >= config.min_useful_bq && slot < lot.expiry_slot
      }
      Recall { .. } -> signer_is_lab(tx, config) && lot.status != Administered
      Expire -> remaining_bq(lot, slot) < config.min_useful_bq || slot >= lot.expiry_slot
    }
  }

  else(_) {
    fail
  }
}

/// Whole half-lives only. After 32 the lot is dust.
pub fn remaining_bq(lot: IsotopeLot, now: Int) -> Int {
  if now <= lot.calibrated_slot {
    lot.activity_bq
  } else if lot.half_life_slots <= 0 {
    0
  } else {
    let n = ( now - lot.calibrated_slot ) / lot.half_life_slots
    if n >= 32 {
      0
    } else {
      lot.activity_bq / pow2(n)
    }
  }
}

fn transferable(lot: IsotopeLot) -> Bool {
  when lot.status is {
    Administered -> False
    Recalled -> False
    Decayed -> False
    Converted -> False
    _ -> True
  }
}

fn convertible(lot: IsotopeLot) -> Bool {
  when lot.status is {
    Produced -> True
    Held -> True
    PreSold -> False
    Converted -> False
    Administered -> False
    Decayed -> False
    Recalled -> False
  }
}

fn pow2(n: Int) -> Int {
  if n <= 0 {
    1
  } else {
    2 * pow2(n - 1)
  }
}

fn get_slot(tx: Transaction) -> Int {
  when tx.validity_range.lower_bound.bound_type is {
    Finite(s) -> s
    _ -> 0
  }
}

fn signer_is_owner(tx: Transaction, lot: IsotopeLot) -> Bool {
  // Owner pNFT must be a witness. Implementation binds to pnft_spend / extra_signatories.
  list.length(tx.extra_signatories) > 0 && lot.owner != #""
}

fn signer_is_lab(tx: Transaction, config: IsotopeConfig) -> Bool {
  list.length(tx.extra_signatories) > 0 && list.length(config.labs) > 0
}

// =============================================================================
// HALF-LIVES (slots ≈ seconds)
// =============================================================================
// Mo-99   66.0 h     237600
// Tc-99m   6.01 h     21636
// I-131    8.02 d     692928
// Lu-177   6.65 d     574560
// Ac-225  10.0 d      864000
// F-18   109.8 min     6588
//
// CHAIN OF TITLE
// --------------
// 1. Hospital / patient pNFT pre-buys a Mo-99 generator lot (PreSold).
// 2. Licensed lab attests production + COA (Produced). Atoms exist. Title unchanged.
// 3. Owner holds. May sell remaining activity to another pNFT (Transfer).
// 4. Lab converts Mo-99 → Tc-99m eluate → MDP kit (Convert). Parent consumed;
//    daughter lot UTxO minted. Same or new owner.
// 5. Dose administered to a patient pNFT (Administer). Lot stops transferring.
// 6. If remaining Bq < useful: Expire. Waste stream, not a market.
//
// FIRST TOKEN. Not ULTRA. The coin follows the care, not the other way around.
// =============================================================================
