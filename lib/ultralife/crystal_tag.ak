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
// Every building interaction names both tags. UltraLife records are the
// ingestion layer. The payload stays off the datum. The commit is the hash.

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

/// KYC commit is 32 bytes. The waveform is not an argument.
pub fn kyc_commit_ok(commit: ByteArray) -> Bool {
  bytearray.length(commit) == 32
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
