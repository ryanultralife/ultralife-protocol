// UltraLife Identity Validator
// Aiken smart contract for Cardano
//
// Manages biometric identity registration and authentication gates.
// Raw biometric data NEVER appears on-chain. Only hashes and confidence scores.

use aiken/crypto.{Blake2b_256, Hash, Signature, VerificationKey, blake2b_256, verify_ed25519_signature}
use aiken/interval.{Finite}
use aiken/collection/list
use aiken/primitive/bytearray
use cardano/transaction.{Transaction}

// === Types ===

pub type IdentityStatus {
  Active
  Suspended
  Revoked
}

pub type IdentityDatum {
  // Hash of the enrolled biometric feature vector
  enrollment_hash: Hash<Blake2b_256, ByteArray>,
  // Device public key hash (which device holds this identity)
  device_pubkey: Hash<Blake2b_256, ByteArray>,
  // Enrollment timestamp (POSIX milliseconds)
  enrollment_time: Int,
  // Minimum confidence required for this identity's transactions
  min_confidence: Int,
  // 80-98, representing 0.80-0.98
  // Status
  status: IdentityStatus,
  // Version (for upgrade path)
  version: Int,
}

pub type IdentityAction {
  // Authenticate: prove live biometric matches enrollment
  Authenticate {
    // Hash of the live biometric reading
    live_hash: Hash<Blake2b_256, ByteArray>,
    // Confidence score (0-100, representing 0.00-1.00)
    confidence: Int,
    // Timestamp of authentication
    auth_time: Int,
    // Device public key (verifies against stored hash)
    device_pubkey: VerificationKey,
    // Device signature over (live_hash ++ confidence ++ auth_time)
    device_sig: Signature,
  }
  // Update enrollment (slow drift for aging)
  UpdateEnrollment {
    new_hash: Hash<Blake2b_256, ByteArray>,
    confidence: Int,
    // Device public key (verifies against stored hash)
    device_pubkey: VerificationKey,
    device_sig: Signature,
  }
  // Suspend identity (temporary lock)
  Suspend {
    device_pubkey: VerificationKey,
    device_sig: Signature,
  }
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
      Authenticate { live_hash, confidence, auth_time, device_pubkey, device_sig } -> {
        // 1. Identity must be active
        expect d.status == Active

        // 2. Confidence must meet minimum threshold
        expect confidence >= d.min_confidence

        // 3. Authentication must be recent (within 5 minutes)
        let validity = self.validity_range
        expect Finite(lower_bound) = validity.lower_bound.bound_type
        expect auth_time >= lower_bound - 300_000

        // 5 min tolerance
        // 4. Verify provided pubkey matches enrolled device
        expect verify_pubkey_matches(d.device_pubkey, device_pubkey)

        // 5. Build message from auth data and verify signature
        let message = build_auth_message(live_hash, confidence, auth_time)
        expect verify_ed25519_signature(device_pubkey, message, device_sig)

        // 6. Live hash must not equal enrollment hash
        //    (exact match = replay attack with enrollment data)
        expect live_hash != d.enrollment_hash

        True
      }

      UpdateEnrollment { new_hash, confidence, device_pubkey, device_sig } -> {
        // Only allow updates with very high confidence
        expect d.status == Active
        expect confidence >= 92
        // 0.92 threshold for enrollment evolution

        // Verify pubkey matches enrolled device
        expect verify_pubkey_matches(d.device_pubkey, device_pubkey)

        // Build message and verify signature
        let message = build_update_message(new_hash, confidence)
        expect verify_ed25519_signature(device_pubkey, message, device_sig)

        // New hash must be different (actual update occurred)
        expect new_hash != d.enrollment_hash

        True
      }

      Suspend { device_pubkey, device_sig } -> {
        expect d.status == Active

        // Verify pubkey matches enrolled device
        expect verify_pubkey_matches(d.device_pubkey, device_pubkey)

        // Verify signature over "suspend" action
        let message = "suspend"
        expect verify_ed25519_signature(device_pubkey, message, device_sig)

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

  else(_) {
    fail
  }
}

// === Helper functions ===

/// Verify that the provided public key hashes to the stored device pubkey hash
fn verify_pubkey_matches(
  stored_hash: Hash<Blake2b_256, ByteArray>,
  provided_key: VerificationKey,
) -> Bool {
  // Hash the provided public key and compare to stored hash
  blake2b_256(provided_key) == stored_hash
}

/// Build the message for authentication signature
/// Message = live_hash ++ confidence_bytes ++ auth_time_bytes
fn build_auth_message(
  live_hash: Hash<Blake2b_256, ByteArray>,
  confidence: Int,
  auth_time: Int,
) -> ByteArray {
  // Concatenate hash with serialized confidence and time
  bytearray.concat(live_hash, bytearray.concat(int_to_bytes(confidence), int_to_bytes(auth_time)))
}

/// Build the message for enrollment update signature
/// Message = new_hash ++ confidence_bytes
fn build_update_message(
  new_hash: Hash<Blake2b_256, ByteArray>,
  confidence: Int,
) -> ByteArray {
  bytearray.concat(new_hash, int_to_bytes(confidence))
}

/// Convert integer to 8-byte big-endian representation
fn int_to_bytes(n: Int) -> ByteArray {
  // Simple serialization: 8 bytes, big-endian
  // For on-chain use, we use a deterministic encoding
  bytearray.from_int_big_endian(n, 8)
}

fn verify_recovery_proof(_proof: ByteArray) -> Bool {
  // TODO: Implement social recovery verification
  // Checks M-of-N attestation from recovery contacts
  // This would verify signatures from N guardians
  True
}

// === Tests ===

// Test public key (32 bytes for Ed25519)
const test_pubkey: ByteArray =
  #"0102030405060708091011121314151617181920212223242526272829303132"

// Test signature (64 bytes for Ed25519)
const test_sig: ByteArray =
  #"01020304050607080910111213141516171819202122232425262728293031320102030405060708091011121314151617181920212223242526272829303132"

test pubkey_hash_verification() {
  // Test that pubkey hashing and verification works
  let pubkey_hash = blake2b_256(test_pubkey)
  verify_pubkey_matches(pubkey_hash, test_pubkey)
}

test int_to_bytes_works() {
  // Test integer serialization
  let bytes = int_to_bytes(1000000)
  bytearray.length(bytes) == 8
}

test build_auth_message_works() {
  // Test message building for authentication
  let live_hash: Hash<Blake2b_256, ByteArray> =
    #"aabbccdd00112233445566778899aabbccdd00112233445566778899aabbccdd"
  let message = build_auth_message(live_hash, 95, 1001000)
  // Message should be: 32-byte hash + 8-byte confidence + 8-byte time = 48 bytes
  bytearray.length(message) == 48
}

test datum_structure_valid() {
  // Test that datum structure is correctly formed
  let pubkey_hash = blake2b_256(test_pubkey)
  let datum =
    IdentityDatum {
      enrollment_hash: #"aabbccdd00112233445566778899aabbccdd00112233445566778899aabbccdd",
      device_pubkey: pubkey_hash,
      enrollment_time: 1000000,
      min_confidence: 90,
      status: Active,
      version: 1,
    }

  datum.min_confidence == 90 && datum.status == Active && datum.version == 1
}

test redeemer_structure_authenticate() {
  // Test that Authenticate redeemer is correctly formed
  let redeemer =
    Authenticate {
      live_hash: #"eeff00112233445566778899aabbccdd00112233445566778899aabbccddeeff",
      confidence: 95,
      auth_time: 1001000,
      device_pubkey: test_pubkey,
      device_sig: test_sig,
    }

  when redeemer is {
    Authenticate { confidence, .. } -> confidence == 95
    _ -> False
  }
}

test redeemer_structure_update() {
  // Test that UpdateEnrollment redeemer is correctly formed
  let redeemer =
    UpdateEnrollment {
      new_hash: #"eeff00112233445566778899aabbccdd00112233445566778899aabbccddeeff",
      confidence: 93,
      device_pubkey: test_pubkey,
      device_sig: test_sig,
    }

  when redeemer is {
    UpdateEnrollment { confidence, .. } -> confidence == 93
    _ -> False
  }
}

test redeemer_structure_suspend() {
  // Test that Suspend redeemer is correctly formed
  let redeemer = Suspend { device_pubkey: test_pubkey, device_sig: test_sig }

  when redeemer is {
    Suspend { .. } -> True
    _ -> False
  }
}
