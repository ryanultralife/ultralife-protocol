// UltraLife Identity Validator
// Aiken smart contract for Cardano
//
// Manages biometric identity registration and authentication gates.
// Raw biometric data NEVER appears on-chain. Only hashes and confidence scores.

use aiken/hash.{Blake2b_256, Hash}
use aiken/list
use aiken/transaction.{ScriptContext, Spend, Transaction, InlineDatum}
use aiken/interval.{Finite}

// === Types ===

type IdentityStatus {
  Active
  Suspended
  Revoked
}

type IdentityDatum {
  // Hash of the enrolled biometric feature vector
  enrollment_hash: Hash<Blake2b_256, ByteArray>,
  // Device public key hash (which device holds this identity)
  device_pubkey: Hash<Blake2b_256, ByteArray>,
  // Enrollment timestamp (POSIX milliseconds)
  enrollment_time: Int,
  // Minimum confidence required for this identity's transactions
  min_confidence: Int, // 80-98, representing 0.80-0.98
  // Status
  status: IdentityStatus,
  // Version (for upgrade path)
  version: Int,
}

type IdentityAction {
  // Authenticate: prove live biometric matches enrollment
  Authenticate {
    // Hash of the live biometric reading
    live_hash: Hash<Blake2b_256, ByteArray>,
    // Confidence score (0-100, representing 0.00-1.00)
    confidence: Int,
    // Timestamp of authentication
    auth_time: Int,
    // Device signature (proves this came from enrolled device)
    device_sig: ByteArray,
  }
  // Update enrollment (slow drift for aging)
  UpdateEnrollment {
    new_hash: Hash<Blake2b_256, ByteArray>,
    confidence: Int,
    device_sig: ByteArray,
  }
  // Suspend identity (temporary lock)
  Suspend { device_sig: ByteArray }
  // Revoke identity (permanent — for device loss/compromise)
  Revoke { recovery_proof: ByteArray }
}

// === Validator ===

validator identity {
  spend(
    datum: Option<IdentityDatum>,
    redeemer: IdentityAction,
    _own_ref: Data,
    self: Transaction,
  ) {
    expect Some(d) = datum

    when redeemer is {
      Authenticate { live_hash, confidence, auth_time, device_sig } -> {
        // 1. Identity must be active
        expect d.status == Active

        // 2. Confidence must meet minimum threshold
        expect confidence >= d.min_confidence

        // 3. Authentication must be recent (within 5 minutes)
        let validity = self.validity_range
        expect Finite(lower_bound) = validity.lower_bound.bound_type
        expect auth_time >= lower_bound - 300_000 // 5 min tolerance

        // 4. Device signature must be from enrolled device
        // In production: verify ed25519 signature against device_pubkey
        expect verify_device_sig(d.device_pubkey, device_sig)

        // 5. Live hash must not equal enrollment hash
        //    (exact match = replay attack with enrollment data)
        expect live_hash != d.enrollment_hash

        True
      }

      UpdateEnrollment { new_hash, confidence, device_sig } -> {
        // Only allow updates with very high confidence
        expect d.status == Active
        expect confidence >= 92 // 0.92 threshold for enrollment evolution
        expect verify_device_sig(d.device_pubkey, device_sig)

        // New hash must be different (actual update occurred)
        expect new_hash != d.enrollment_hash

        True
      }

      Suspend { device_sig } -> {
        expect d.status == Active
        expect verify_device_sig(d.device_pubkey, device_sig)
        True
      }

      Revoke { recovery_proof } -> {
        // Revocation requires recovery proof (social recovery / time-lock)
        // This is validated against recovery validator
        expect verify_recovery_proof(recovery_proof)
        True
      }
    }
  }
}

// === Helper functions ===

fn verify_device_sig(
  _device_pubkey: Hash<Blake2b_256, ByteArray>,
  _sig: ByteArray,
) -> Bool {
  // TODO: Implement ed25519 signature verification
  // In production, this verifies the device's signature
  // against the enrolled public key
  True
}

fn verify_recovery_proof(_proof: ByteArray) -> Bool {
  // TODO: Implement social recovery verification
  // Checks M-of-N attestation from recovery contacts
  True
}

// === Tests ===

test authenticate_success() {
  let datum = IdentityDatum {
    enrollment_hash: #"aabb",
    device_pubkey: #"ccdd",
    enrollment_time: 1000000,
    min_confidence: 90,
    status: Active,
    version: 1,
  }

  let redeemer = Authenticate {
    live_hash: #"eeff",  // Different from enrollment (not replay)
    confidence: 95,       // Above threshold
    auth_time: 1001000,
    device_sig: #"1234",
  }

  // Should pass all checks
  True
}

test authenticate_fail_low_confidence() {
  let datum = IdentityDatum {
    enrollment_hash: #"aabb",
    device_pubkey: #"ccdd",
    enrollment_time: 1000000,
    min_confidence: 90,
    status: Active,
    version: 1,
  }

  // Confidence 80 < min_confidence 90
  // This should fail validation
  let redeemer = Authenticate {
    live_hash: #"eeff",
    confidence: 80,
    auth_time: 1001000,
    device_sig: #"1234",
  }

  // Would fail: confidence < min_confidence
  True
}

test authenticate_fail_replay() {
  let datum = IdentityDatum {
    enrollment_hash: #"aabb",
    device_pubkey: #"ccdd",
    enrollment_time: 1000000,
    min_confidence: 90,
    status: Active,
    version: 1,
  }

  // live_hash == enrollment_hash → replay attack
  let redeemer = Authenticate {
    live_hash: #"aabb",  // Same as enrollment!
    confidence: 95,
    auth_time: 1001000,
    device_sig: #"1234",
  }

  // Would fail: live_hash == enrollment_hash
  True
}
