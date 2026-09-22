// Crystal compute tag. Man and machine.
//
// The identifier is the crystal compute tag from the Resonance device work:
// a 25mm hexagonal lapel crystal for a person, and the same class of tag
// mounted on a separator, door, or other machine. ResonantCompute (RCM-1)
// is the module. It is not a general-purpose computer.
//
// Biometric KYC is the person's lapel. The body waveform never leaves the
// crystal. UltraLife stores the enrollment hash already defined in
// validators/biometric.ak. A machine has no body. Its tag is identified by
// the crystal's own key, mounted on that asset.
//
// Every building interaction names both tags and the operator's live
// waveform. UltraLife records are the ingestion layer. The samples stay
// off the public datum. The log keeps the live hash and the lapel's
// enrollment hash, and they must differ.

use aiken/primitive/bytearray

pub type TagKind {
  Enroll
  Access
  Operate
  Check
}

pub type TagBearer {
  Person
  Machine
}

/// person is the lapel tag. machine is the separator, door, or other asset tag.
pub fn interaction_ok(person: ByteArray, machine: ByteArray) -> Bool {
  bytearray.length(person) > 0 && bytearray.length(machine) > 0 && person != machine
}

/// A waveform hash is 32 bytes.
pub fn kyc_commit_ok(commit: ByteArray) -> Bool {
  bytearray.length(commit) == 32
}

/// Live lapel reading versus the enrolled waveform. Equal hashes are a replay.
pub fn waveform_log_ok(live: ByteArray, enrolled: ByteArray) -> Bool {
  kyc_commit_ok(live) && kyc_commit_ok(enrolled) && live != enrolled
}

/// The person who creates a tag, or walks one, is a pNFT. Empty is refused.
pub fn creator_pnft_ok(pnft: ByteArray) -> Bool {
  bytearray.length(pnft) > 0
}

test door_requires_lapel_and_door() {
  interaction_ok("lapel-op-1", "door-a")
}

test separator_operate_names_both() {
  interaction_ok("lapel-op-1", "sep-3")
}

test machine_alone_is_refused() {
  interaction_ok("", "sep-3") == False
}

test lapel_alone_is_refused() {
  interaction_ok("lapel-op-1", "") == False
}

test a_tag_cannot_witness_itself() {
  interaction_ok("sep-3", "sep-3") == False
}

test kyc_commit_is_32_bytes() {
  kyc_commit_ok("0123456789abcdef0123456789abcdef") && kyc_commit_ok("short") == False
}

test live_waveform_must_differ_from_enrollment() {
  waveform_log_ok(
    "0123456789abcdef0123456789abcdef",
    "fedcba9876543210fedcba9876543210",
  )
}

test replay_of_enrolled_waveform_is_refused() {
  waveform_log_ok(
    "0123456789abcdef0123456789abcdef",
    "0123456789abcdef0123456789abcdef",
  ) == False
}

test tag_creation_names_a_pnft() {
  creator_pnft_ok("pnft-creator") && creator_pnft_ok("") == False
}
