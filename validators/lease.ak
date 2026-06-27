// =============================================================================
// UltraLife Protocol — Lease Validator  (Property OS · draft)
// =============================================================================
//
// A lease is a TIME-LIMITED, REVOCABLE access + payment agreement between a
// property asset-twin (held by a lessor pNFT) and a lessee pNFT, with an
// operator commission routed trustlessly on each rent settlement.
//
// Mirrors the hash-based, time-limited pattern in access_control.ak:
//   - property + parties identified by pNFT/asset twin (AssetName)
//   - validity enforced against the transaction validity range
//   - operator commission (basis points) enforced on PayRent
//   - every spend must be authorized by the relevant pNFT signature
//
// STATUS: draft — wire `signed_by` / commission checks to lib/ultralife helpers
// and run `aiken build` before deploying to preprod. Not yet in plutus.json.
// =============================================================================

use aiken/collection/list
use aiken/interval.{Finite}
use cardano/assets.{AssetName}
use cardano/transaction.{Transaction, Output, InlineDatum}

// =============================================================================
// TYPES
// =============================================================================

pub type LeaseStatus {
  Draft
  Active
  Expired
  Terminated
}

pub type LeaseDatum {
  /// On-chain property asset twin this lease grants access to
  property_twin: AssetName,
  /// Owner identity (pNFT) — must sign Activate / Terminate
  lessor_pnft: AssetName,
  /// Tenant identity (pNFT) — must sign PayRent
  lessee_pnft: AssetName,
  /// Operator (e.g. Christian) — receives commission
  operator_pnft: AssetName,
  /// Lease term, POSIX time (ms) bounds
  term_start: Int,
  term_end: Int,
  /// Rent per period, in lovelace or ULTRA
  base_rent: Int,
  /// Operator commission, basis points (600 = 6%)
  commission_bps: Int,
  status: LeaseStatus,
}

pub type LeaseRedeemer {
  /// Lessor activates the lease (status Draft -> Active)
  Activate
  /// Lessee pays rent for a period; commission routes to operator
  PayRent { period: Int }
  /// Either party terminates per terms; releases the access grant
  Terminate
  /// Extend the term (re-derives the time-limited permission)
  Renew { new_end: Int }
}

// =============================================================================
// HELPERS
// =============================================================================

/// True if the tx validity range starts at or after `start` and ends at or
/// before `end` — i.e. the action happens within the lease term.
fn within_term(tx: Transaction, start: Int, end: Int) -> Bool {
  let lower = tx.validity_range.lower_bound.bound_type
  let upper = tx.validity_range.upper_bound.bound_type
  when (lower, upper) is {
    (Finite(lo), Finite(hi)) -> lo >= start && hi <= end
    _ -> False
  }
}

/// True if any output pays at least `amount` to the holder identified by
/// `who` (operator/lessor). Identity binding to pNFT is enforced off-chain in
/// the builder + here via address datum tagging in production.
fn pays_at_least(tx: Transaction, who: AssetName, amount: Int) -> Bool {
  list.any(
    tx.outputs,
    fn(o: Output) {
      when o.datum is {
        InlineDatum(_) -> output_lovelace(o) >= amount && tagged_to(o, who)
        _ -> False
      }
    },
  )
}

fn output_lovelace(o: Output) -> Int {
  assets.lovelace_of(o.value)
}

/// Placeholder identity tag check — in production compares the output's datum
/// pNFT tag to `who`. Kept permissive in draft.
fn tagged_to(_o: Output, _who: AssetName) -> Bool {
  True
}

fn commission_amount(rent: Int, bps: Int) -> Int {
  rent * bps / 10000
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator lease {
  spend(
    datum: Option<LeaseDatum>,
    redeemer: LeaseRedeemer,
    _own_ref: Data,
    tx: Transaction,
  ) -> Bool {
    when datum is {
      None -> False
      Some(d) ->
        when redeemer is {
          // Lessor turns a Draft into an Active, within term bounds.
          Activate ->
            d.status == Draft && within_term(tx, d.term_start, d.term_end)

          // Tenant pays rent; operator commission must be paid out.
          PayRent { period: _ } -> {
            let commission = commission_amount(d.base_rent, d.commission_bps)
            and {
              d.status == Active,
              within_term(tx, d.term_start, d.term_end),
              pays_at_least(tx, d.lessor_pnft, d.base_rent - commission),
              pays_at_least(tx, d.operator_pnft, commission),
            }
          }

          // Either party may terminate (status -> Terminated handled in new datum).
          Terminate -> d.status == Active || d.status == Draft

          // Extend term; new end must be later than current.
          Renew { new_end } -> d.status == Active && new_end > d.term_end
        }
    }
  }
}
