-- =============================================================================
-- UltraLife Protocol — Biometric Validator Verification
-- =============================================================================
--
-- Formal verification of the biometric identity authentication gate.
-- Models validators/biometric.ak and proves security properties.
--
-- Key properties verified:
--   1. Authentication requires Active status
--   2. Low confidence is rejected
--   3. Replay attacks (live_hash == enrollment_hash) are rejected
--   4. Enrollment updates require high confidence (≥ 92)
--   5. Suspended identities cannot authenticate
--   6. Revoked identities cannot authenticate
--   7. Only Active identities can be suspended
-- =============================================================================

import Blaster
import Verification.PlutusLedgerAPI

open UltraLife.PlutusLedgerAPI

namespace UltraLife.Biometric

-- =============================================================================
-- Validator Logic (mirrors validators/biometric.ak)
-- =============================================================================

/-- Verify device signature (abstracted — always true in current Aiken code) -/
def verify_device_sig (_device_pubkey : Hash) (_sig : Nat) : Bool := true

/-- Verify recovery proof (abstracted — always true in current Aiken code) -/
def verify_recovery_proof (_proof : Nat) : Bool := true

/-- Core biometric authentication check.
    Mirrors the Authenticate branch of identity.spend in biometric.ak -/
def authenticate
    (datum : IdentityDatum)
    (live_hash : Hash)
    (confidence : Nat)
    (auth_time : Nat)
    (device_sig : Nat)
    (tx_lower_bound : Nat) : Bool :=
  -- 1. Identity must be active
  (datum.status == IdentityStatus.Active) &&
  -- 2. Confidence must meet minimum threshold
  (confidence >= datum.min_confidence) &&
  -- 3. Authentication must be recent (within 5 minutes = 300,000 ms)
  (auth_time >= tx_lower_bound - 300000) &&
  -- 4. Device signature must be from enrolled device
  (verify_device_sig datum.device_pubkey device_sig) &&
  -- 5. Live hash must not equal enrollment hash (anti-replay)
  (live_hash != datum.enrollment_hash)

/-- Update enrollment check.
    Mirrors the UpdateEnrollment branch of identity.spend -/
def update_enrollment
    (datum : IdentityDatum)
    (new_hash : Hash)
    (confidence : Nat)
    (device_sig : Nat) : Bool :=
  (datum.status == IdentityStatus.Active) &&
  (confidence >= 92) &&
  (verify_device_sig datum.device_pubkey device_sig) &&
  (new_hash != datum.enrollment_hash)

/-- Suspend identity check.
    Mirrors the Suspend branch of identity.spend -/
def suspend_identity
    (datum : IdentityDatum)
    (device_sig : Nat) : Bool :=
  (datum.status == IdentityStatus.Active) &&
  (verify_device_sig datum.device_pubkey device_sig)

/-- Revoke identity check.
    Mirrors the Revoke branch of identity.spend -/
def revoke_identity
    (datum : IdentityDatum)
    (recovery_proof : Nat) : Bool :=
  verify_recovery_proof recovery_proof

/-- Full validator dispatch (mirrors identity.spend) -/
def identity_validator
    (datum : IdentityDatum)
    (action : IdentityAction)
    (tx_lower_bound : Nat) : Bool :=
  match action with
  | .Authenticate live_hash confidence auth_time device_sig =>
      authenticate datum live_hash confidence auth_time device_sig tx_lower_bound
  | .UpdateEnrollment new_hash confidence device_sig =>
      update_enrollment datum new_hash confidence device_sig
  | .Suspend device_sig =>
      suspend_identity datum device_sig
  | .Revoke recovery_proof =>
      revoke_identity datum recovery_proof

-- =============================================================================
-- THEOREM 1: Authentication requires Active status
-- =============================================================================

theorem auth_requires_active :
    ∀ (datum : IdentityDatum) (lh : Hash) (c at_ ds : Nat) (lb : Nat),
      authenticate datum lh c at_ ds lb = true →
      datum.status == IdentityStatus.Active = true := by
  intros datum lh c at_ ds lb h
  simp [authenticate] at h
  exact h.1

#blaster [auth_requires_active]

-- =============================================================================
-- THEOREM 2: Low confidence is rejected
-- =============================================================================

theorem low_confidence_rejected :
    ∀ (datum : IdentityDatum) (lh : Hash) (c at_ ds lb : Nat),
      datum.min_confidence = 90 →
      c < 90 →
      authenticate datum lh c at_ ds lb = false := by
  intros datum lh c at_ ds lb hmin hlow
  simp [authenticate]
  intro _
  simp [hmin]
  omega

#blaster [low_confidence_rejected]

-- =============================================================================
-- THEOREM 3: Replay attacks are rejected
-- =============================================================================

theorem replay_attack_rejected :
    ∀ (datum : IdentityDatum) (c at_ ds lb : Nat),
      authenticate datum datum.enrollment_hash c at_ ds lb = false := by
  intros datum c at_ ds lb
  simp [authenticate]
  simp [BEq.beq, instBEqHash]
  omega

#blaster [replay_attack_rejected]

-- =============================================================================
-- THEOREM 4: Enrollment update requires confidence ≥ 92
-- =============================================================================

theorem update_requires_high_confidence :
    ∀ (datum : IdentityDatum) (nh : Hash) (c ds : Nat),
      update_enrollment datum nh c ds = true →
      c ≥ 92 := by
  intros datum nh c ds h
  simp [update_enrollment] at h
  exact h.2.1

#blaster [update_requires_high_confidence]

-- =============================================================================
-- THEOREM 5: Suspended identity cannot authenticate
-- =============================================================================

theorem suspended_cannot_auth :
    ∀ (datum : IdentityDatum) (lh : Hash) (c at_ ds lb : Nat),
      datum.status = IdentityStatus.Suspended →
      authenticate datum lh c at_ ds lb = false := by
  intros datum lh c at_ ds lb hsusp
  simp [authenticate, hsusp]

#blaster [suspended_cannot_auth]

-- =============================================================================
-- THEOREM 6: Revoked identity cannot authenticate
-- =============================================================================

theorem revoked_cannot_auth :
    ∀ (datum : IdentityDatum) (lh : Hash) (c at_ ds lb : Nat),
      datum.status = IdentityStatus.Revoked →
      authenticate datum lh c at_ ds lb = false := by
  intros datum lh c at_ ds lb hrev
  simp [authenticate, hrev]

#blaster [revoked_cannot_auth]

-- =============================================================================
-- THEOREM 7: Only Active identities can be suspended
-- =============================================================================

theorem only_active_can_suspend :
    ∀ (datum : IdentityDatum) (ds : Nat),
      suspend_identity datum ds = true →
      datum.status = IdentityStatus.Active := by
  intros datum ds h
  simp [suspend_identity] at h
  exact h.1

#blaster [only_active_can_suspend]

-- =============================================================================
-- THEOREM 8: Successful auth implies confidence ≥ min_confidence
-- =============================================================================

theorem auth_implies_min_confidence :
    ∀ (datum : IdentityDatum) (lh : Hash) (c at_ ds lb : Nat),
      authenticate datum lh c at_ ds lb = true →
      c ≥ datum.min_confidence := by
  intros datum lh c at_ ds lb h
  simp [authenticate] at h
  exact h.2.1

#blaster [auth_implies_min_confidence]

-- =============================================================================
-- THEOREM 9: Update enrollment requires different hash
-- =============================================================================

theorem update_requires_different_hash :
    ∀ (datum : IdentityDatum) (c ds : Nat),
      update_enrollment datum datum.enrollment_hash c ds = false := by
  intros datum c ds
  simp [update_enrollment]
  simp [BEq.beq, instBEqHash]
  omega

#blaster [update_requires_different_hash]

-- =============================================================================
-- THEOREM 10: Authentication freshness — auth_time bounded by tx validity
-- =============================================================================

theorem auth_time_bounded :
    ∀ (datum : IdentityDatum) (lh : Hash) (c at_ ds lb : Nat),
      authenticate datum lh c at_ ds lb = true →
      at_ ≥ lb - 300000 := by
  intros datum lh c at_ ds lb h
  simp [authenticate] at h
  exact h.2.2.1

#blaster [auth_time_bounded]

end UltraLife.Biometric
