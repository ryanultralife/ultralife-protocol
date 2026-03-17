-- =============================================================================
-- UltraLife Protocol — Marketplace Validator Verification
-- =============================================================================
--
-- Formal verification of the marketplace listing lifecycle.
-- Models validators/marketplace.ak and proves:
--   - Only Active listings can be paused
--   - Only Paused listings can be resumed
--   - Only Active/Paused listings can be cancelled
--   - Sold listings cannot be modified
--   - Interest count only increments
--   - Seller cannot express interest in own listing
--   - Listing status transitions are valid
-- =============================================================================

import Blaster
import Verification.PlutusLedgerAPI

open UltraLife.PlutusLedgerAPI

namespace UltraLife.Marketplace

-- =============================================================================
-- Listing Status Predicates
-- =============================================================================

/-- Is a listing currently Active? -/
def is_active (status : ListingStatus) : Bool :=
  match status with
  | .Active => true
  | _       => false

/-- Is a listing currently Paused? -/
def is_paused (status : ListingStatus) : Bool :=
  match status with
  | .Paused _ => true
  | _         => false

/-- Can a listing be cancelled? (Active or Paused) -/
def can_cancel (status : ListingStatus) : Bool :=
  match status with
  | .Active   => true
  | .Paused _ => true
  | _         => false

/-- Is a listing in a terminal state? (Sold, Expired, Cancelled) -/
def is_terminal (status : ListingStatus) : Bool :=
  match status with
  | .Sold _ _  => true
  | .Expired   => true
  | .Cancelled => true
  | _          => false

-- =============================================================================
-- Listing Lifecycle Validators
-- =============================================================================

/-- Validate pause transition: Active → Paused.
    Mirrors validate_pause_listing from marketplace.ak -/
def validate_pause
    (listing : ListingDatum)
    (signer_pnft : AssetName)
    (reason : Option Nat) : Bool :=
  -- Must be active
  is_active listing.status &&
  -- Seller must be signer
  (signer_pnft == listing.seller)

/-- Validate resume transition: Paused → Active.
    Mirrors validate_resume_listing from marketplace.ak -/
def validate_resume
    (listing : ListingDatum)
    (signer_pnft : AssetName) : Bool :=
  -- Must be paused
  is_paused listing.status &&
  -- Seller must be signer
  (signer_pnft == listing.seller)

/-- Validate cancel transition: Active|Paused → Cancelled.
    Mirrors validate_cancel_listing from marketplace.ak -/
def validate_cancel
    (listing : ListingDatum)
    (signer_pnft : AssetName) : Bool :=
  -- Must be cancellable
  can_cancel listing.status &&
  -- Seller must be signer
  (signer_pnft == listing.seller)

/-- Validate mark-sold transition: Active → Sold.
    Mirrors validate_mark_sold from marketplace.ak -/
def validate_mark_sold
    (listing : ListingDatum)
    (signer_pnft : AssetName)
    (buyer : AssetName) : Bool :=
  -- Must be active
  is_active listing.status &&
  -- Either seller or buyer can mark sold
  (signer_pnft == listing.seller || signer_pnft == buyer)

/-- Validate express interest: increments interest_count.
    Mirrors validate_express_interest from marketplace.ak -/
def validate_express_interest
    (listing : ListingDatum)
    (interested_pnft : AssetName)
    (new_interest_count : Nat) : Bool :=
  -- Must be active
  is_active listing.status &&
  -- Interested party cannot be seller
  (interested_pnft != listing.seller) &&
  -- Interest count incremented by exactly 1
  (new_interest_count == listing.interest_count + 1)

-- =============================================================================
-- THEOREM 1: Only Active listings can be paused
-- =============================================================================

theorem pause_requires_active :
    ∀ (listing : ListingDatum) (signer : AssetName) (reason : Option Nat),
      validate_pause listing signer reason = true →
      is_active listing.status = true := by
  intros listing signer reason h
  simp [validate_pause] at h
  exact h.1

#blaster [pause_requires_active]

-- =============================================================================
-- THEOREM 2: Only Paused listings can be resumed
-- =============================================================================

theorem resume_requires_paused :
    ∀ (listing : ListingDatum) (signer : AssetName),
      validate_resume listing signer = true →
      is_paused listing.status = true := by
  intros listing signer h
  simp [validate_resume] at h
  exact h.1

#blaster [resume_requires_paused]

-- =============================================================================
-- THEOREM 3: Sold listings cannot be paused
-- =============================================================================

theorem sold_cannot_be_paused :
    ∀ (listing : ListingDatum) (signer : AssetName) (reason : Option Nat)
      (buyer : AssetName) (sold_at : Nat),
      listing.status = ListingStatus.Sold buyer sold_at →
      validate_pause listing signer reason = false := by
  intros listing signer reason buyer sold_at hsold
  simp [validate_pause, is_active, hsold]

#blaster [sold_cannot_be_paused]

-- =============================================================================
-- THEOREM 4: Sold listings cannot be resumed
-- =============================================================================

theorem sold_cannot_be_resumed :
    ∀ (listing : ListingDatum) (signer : AssetName)
      (buyer : AssetName) (sold_at : Nat),
      listing.status = ListingStatus.Sold buyer sold_at →
      validate_resume listing signer = false := by
  intros listing signer buyer sold_at hsold
  simp [validate_resume, is_paused, hsold]

#blaster [sold_cannot_be_resumed]

-- =============================================================================
-- THEOREM 5: Sold listings cannot be cancelled
-- =============================================================================

theorem sold_cannot_be_cancelled :
    ∀ (listing : ListingDatum) (signer : AssetName)
      (buyer : AssetName) (sold_at : Nat),
      listing.status = ListingStatus.Sold buyer sold_at →
      validate_cancel listing signer = false := by
  intros listing signer buyer sold_at hsold
  simp [validate_cancel, can_cancel, hsold]

#blaster [sold_cannot_be_cancelled]

-- =============================================================================
-- THEOREM 6: Terminal states cannot be cancelled
-- =============================================================================

theorem expired_cannot_be_cancelled :
    ∀ (listing : ListingDatum) (signer : AssetName),
      listing.status = ListingStatus.Expired →
      validate_cancel listing signer = false := by
  intros listing signer hexp
  simp [validate_cancel, can_cancel, hexp]

theorem cancelled_cannot_be_cancelled :
    ∀ (listing : ListingDatum) (signer : AssetName),
      listing.status = ListingStatus.Cancelled →
      validate_cancel listing signer = false := by
  intros listing signer hcan
  simp [validate_cancel, can_cancel, hcan]

#blaster [expired_cannot_be_cancelled]
#blaster [cancelled_cannot_be_cancelled]

-- =============================================================================
-- THEOREM 7: Only seller can pause (authorization)
-- =============================================================================

theorem pause_only_by_seller :
    ∀ (listing : ListingDatum) (signer : AssetName) (reason : Option Nat),
      validate_pause listing signer reason = true →
      signer = listing.seller := by
  intros listing signer reason h
  simp [validate_pause] at h
  exact h.2

#blaster [pause_only_by_seller]

-- =============================================================================
-- THEOREM 8: Only seller can resume (authorization)
-- =============================================================================

theorem resume_only_by_seller :
    ∀ (listing : ListingDatum) (signer : AssetName),
      validate_resume listing signer = true →
      signer = listing.seller := by
  intros listing signer h
  simp [validate_resume] at h
  exact h.2

#blaster [resume_only_by_seller]

-- =============================================================================
-- THEOREM 9: Seller cannot express interest in own listing
-- =============================================================================

theorem seller_cannot_self_interest :
    ∀ (listing : ListingDatum) (new_count : Nat),
      validate_express_interest listing listing.seller new_count = false := by
  intros listing new_count
  simp [validate_express_interest]

#blaster [seller_cannot_self_interest]

-- =============================================================================
-- THEOREM 10: Interest count strictly increases
-- =============================================================================

theorem interest_count_increases :
    ∀ (listing : ListingDatum) (interested : AssetName) (new_count : Nat),
      validate_express_interest listing interested new_count = true →
      new_count = listing.interest_count + 1 := by
  intros listing interested new_count h
  simp [validate_express_interest] at h
  exact h.2.2

#blaster [interest_count_increases]

-- =============================================================================
-- THEOREM 11: Mark sold requires active status
-- =============================================================================

theorem mark_sold_requires_active :
    ∀ (listing : ListingDatum) (signer buyer : AssetName),
      validate_mark_sold listing signer buyer = true →
      is_active listing.status = true := by
  intros listing signer buyer h
  simp [validate_mark_sold] at h
  exact h.1

#blaster [mark_sold_requires_active]

-- =============================================================================
-- THEOREM 12: Active is not terminal
-- =============================================================================

theorem active_not_terminal :
    is_terminal ListingStatus.Active = false := by
  simp [is_terminal]

theorem paused_not_terminal :
    ∀ (reason : Option Nat),
      is_terminal (ListingStatus.Paused reason) = false := by
  intro reason
  simp [is_terminal]

#blaster [active_not_terminal]
#blaster [paused_not_terminal]

-- =============================================================================
-- THEOREM 13: Cancellable iff not terminal and not expired
-- =============================================================================

theorem cancellable_iff_active_or_paused :
    ∀ (status : ListingStatus),
      can_cancel status = true ↔
      (is_active status = true ∨ is_paused status = true) := by
  intro status
  cases status <;> simp [can_cancel, is_active, is_paused]

#blaster [cancellable_iff_active_or_paused]

end UltraLife.Marketplace
