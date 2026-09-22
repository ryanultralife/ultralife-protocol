// Plant control. Shared by isotope lots, work_auction needs, and marketplace offerings.
// Aiken libraries live in lib/. This module is ultralife/control.
//
// Restricted Produce / Transfer fails closed without a live attestation.
// Unrestricted goods carry an empty need. Keys never sit in these datums.

use aiken/collection/list

pub type ControlClass {
  Unrestricted
  DualUse
  Medical
  Nuclear
  Other
}

pub type CredType {
  PersonClass
  EndUser
  ExportLicense
  ImportPermit
  SanctionsScreen
  FacilityClearance
}

pub type ControlBlock {
  class: ControlClass,
  dest_policy: ByteArray,
  need: List<CredType>,
  qty_cap: Int,
  issuer_set: List<ByteArray>,
}

/// Live witness. Issuer is a key hash, not a key. Expiry is a slot.
pub type ControlAttest {
  cred: CredType,
  subject: ByteArray,
  class: ControlClass,
  dest_policy: ByteArray,
  expiry_slot: Int,
  issuer: ByteArray,
}

pub type RecordSchema {
  Hire
  Credential
  Task
  Run
  LotLink
  ClaimLink
  /// Live control witness. Same row the brief calls ControlAttest.
  Witness
  Reveal
  MerkleRoot
  ShiftClose
  InvoiceHash
  /// Crystal-compute tag interaction. Subject is the lapel. Asset is the machine tag.
  TagEvent
}

pub type RecordAuth {
  holders: List<ByteArray>,
  key_hashes: List<ByteArray>,
  threshold: Int,
  recovery: ByteArray,
}

/// Spine record. commit = blake2b(payload || nonce). seal is optional ciphertext.
/// Reveal carries no plaintext field.
pub type RecordDatum {
  schema: RecordSchema,
  collective: ByteArray,
  bioregion: ByteArray,
  asset: Option<ByteArray>,
  subject: ByteArray,
  prev: Option<ByteArray>,
  commit: ByteArray,
  seal: Option<ByteArray>,
  auth: RecordAuth,
  slot: Int,
}

pub type Tranche {
  T0
  T1
  T2
  T3
}

pub type WorkAccount {
  Design
  Machine
  Hours
  Civil
  Remediation
  Rent
}

/// Face value is units * price in fiat, accounted on the ticket. Not ULTRA NAV.
pub type GrantNote {
  ticket_id: ByteArray,
  plant: ByteArray,
  bioregion: ByteArray,
  tranche: Tranche,
  account: WorkAccount,
  units: Int,
  units_remaining: Int,
  price: Int,
  cap_ada_exit_bps: Int,
  seed_lock_ultra: Int,
  fee_skim_bps: Int,
  milestone_commit: ByteArray,
  refund_slot: Int,
  senior: Bool,
}

pub type OfftakeClaim {
  claim_id: ByteArray,
  sku: ByteArray,
  qty: Int,
  qty_remaining: Int,
  window_start: Int,
  window_end: Int,
  plant: ByteArray,
  bioregion: ByteArray,
  control: ControlBlock,
  parent_grant: Option<ByteArray>,
  senior: Bool,
}

/// Same field order as fee_pool's FeePoolDatum so a reference input decodes.
pub type FeePoolView {
  ada_balance: Int,
  ultra_fees_collected: Int,
  epoch: Int,
  ultra_fee_rate: Int,
  min_ada_reserve: Int,
  admin: ByteArray,
}

pub fn unrestricted() -> ControlBlock {
  ControlBlock {
    class: Unrestricted,
    dest_policy: #"",
    need: [],
    qty_cap: 0,
    issuer_set: [],
  }
}

pub fn class_rank(class: ControlClass) -> Int {
  when class is {
    Unrestricted -> 0
    Other -> 1
    DualUse -> 2
    Medical -> 3
    Nuclear -> 4
  }
}

/// Task class must be covered by the worker's PersonClass (deemed export).
pub fn class_covered(task: ControlClass, worker: ControlClass) -> Bool {
  class_rank(task) <= class_rank(worker)
}

pub fn control_well_formed(block: ControlBlock) -> Bool {
  when block.class is {
    Unrestricted -> list.length(block.need) == 0
    _ -> list.length(block.need) > 0 && block.dest_policy != #""
  }
}

pub fn control_allows(
  block: ControlBlock,
  attests: List<ControlAttest>,
  slot: Int,
  subject: ByteArray,
) -> Bool {
  when block.class is {
    Unrestricted -> list.length(block.need) == 0
    _ ->
      control_well_formed(block) && list.all(
        block.need,
        fn(cred) {
          list.any(
            attests,
            fn(a) {
              a.cred == cred && a.subject == subject && a.dest_policy == block.dest_policy && a.expiry_slot > slot && list.has(
                block.issuer_set,
                a.issuer,
              )
            },
          )
        },
      )
  }
}

pub fn person_class_covers(
  task: ControlClass,
  attests: List<ControlAttest>,
  slot: Int,
) -> Bool {
  when task is {
    Unrestricted -> True
    _ ->
      list.any(
        attests,
        fn(a) {
          a.cred == PersonClass && a.expiry_slot > slot && class_covered(
            task,
            a.class,
          )
        },
      )
  }
}

pub fn l1_mint_open(pool: FeePoolView, floor: Int) -> Bool {
  pool.ada_balance >= pool.min_ada_reserve && pool.ada_balance >= floor
}

fn sample_medical() -> ControlBlock {
  ControlBlock {
    class: Medical,
    dest_policy: "intec",
    need: [FacilityClearance, SanctionsScreen, ExportLicense],
    qty_cap: 1,
    issuer_set: ["issuer"],
  }
}

fn sample_attest(cred: CredType, slot: Int) -> ControlAttest {
  ControlAttest {
    cred,
    subject: "lot",
    class: Medical,
    dest_policy: "intec",
    expiry_slot: slot,
    issuer: "issuer",
  }
}

test groceries_pass_with_empty_need() {
  control_allows(unrestricted(), [], 10, "lot") && control_well_formed(
    unrestricted(),
  )
}

test restricted_transfer_fails_without_attest() {
  control_allows(sample_medical(), [], 10, "lot") == False
}

test restricted_transfer_passes_with_live_attests() {
  let attests =
    [
      sample_attest(FacilityClearance, 20),
      sample_attest(SanctionsScreen, 20),
      sample_attest(ExportLicense, 20),
    ]
  control_allows(sample_medical(), attests, 10, "lot")
}

test expired_attest_fails() {
  let attests =
    [
      sample_attest(FacilityClearance, 5),
      sample_attest(SanctionsScreen, 20),
      sample_attest(ExportLicense, 20),
    ]
  control_allows(sample_medical(), attests, 10, "lot") == False
}

test stripped_dest_policy_fails() {
  let moved =
    ControlAttest { ..sample_attest(FacilityClearance, 20), dest_policy: "" }
  control_allows(sample_medical(), [moved], 10, "lot") == False
}

test nuclear_worker_covers_medical_task() {
  class_covered(Medical, Nuclear) && class_covered(Nuclear, DualUse) == False
}
