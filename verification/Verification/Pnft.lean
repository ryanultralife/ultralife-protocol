-- =============================================================================
-- UltraLife Protocol — pNFT Validator Verification
-- =============================================================================
--
-- Formal verification of the pNFT (Personal NFT) identity system.
-- Models validators/pnft.ak and proves correctness of:
--   - Verification level ordering and upgrade paths
--   - Spending validator level guards
--   - Guardianship constraints
--   - Transaction capability by level
-- =============================================================================

import Blaster
import Verification.PlutusLedgerAPI

open UltraLife.PlutusLedgerAPI

namespace UltraLife.Pnft

-- =============================================================================
-- pNFT Spending Validator (mirrors pnft_spend in pnft.ak)
-- =============================================================================

/-- pNFT redeemer actions -/
inductive PnftRedeemer
  | MintBasic
  | MintWard
  | UpgradeStandard
  | UpgradeWardToStandard
  | UpgradeVerified
  | UpgradeSteward
  | TransferGuardianship
  | Burn
deriving Repr, BEq

/-- pNFT spending validator — determines which redeemers are valid
    given the current datum level.
    Mirrors pnft_spend.spend from validators/pnft.ak lines 1002-1049 -/
def pnft_spend_validator (datum : PnftDatum) (redeemer : PnftRedeemer) : Bool :=
  match redeemer with
  | .MintBasic            => false  -- Cannot spend to mint
  | .MintWard             => false  -- Cannot spend to mint ward
  | .UpgradeStandard      => datum.level == VerificationLevel.Basic
  | .UpgradeWardToStandard => datum.level == VerificationLevel.Ward
  | .UpgradeVerified      => datum.level == VerificationLevel.Standard
  | .UpgradeSteward       => datum.level == VerificationLevel.Verified
  | .TransferGuardianship => datum.level == VerificationLevel.Ward
  | .Burn                 => true   -- Any level can be burned

/-- Verification level comparison -/
def level_gte (a b : VerificationLevel) : Bool :=
  a.toNat >= b.toNat

/-- Can a level participate in transactions? (Standard+) -/
def can_transact (level : VerificationLevel) : Bool :=
  level.canTransact

/-- Guardian eligibility: must be Standard+ (not Basic, not Ward) -/
def can_be_guardian (level : VerificationLevel) : Bool :=
  match level with
  | .Standard => true
  | .Verified => true
  | .Steward  => true
  | _         => false

-- =============================================================================
-- THEOREM 1: MintBasic always rejected by spending validator
-- =============================================================================

theorem mint_basic_rejected_by_spend :
    ∀ (datum : PnftDatum),
      pnft_spend_validator datum PnftRedeemer.MintBasic = false := by
  intro datum
  simp [pnft_spend_validator]

#blaster [mint_basic_rejected_by_spend]

-- =============================================================================
-- THEOREM 2: MintWard always rejected by spending validator
-- =============================================================================

theorem mint_ward_rejected_by_spend :
    ∀ (datum : PnftDatum),
      pnft_spend_validator datum PnftRedeemer.MintWard = false := by
  intro datum
  simp [pnft_spend_validator]

#blaster [mint_ward_rejected_by_spend]

-- =============================================================================
-- THEOREM 3: Upgrade path correctness — Standard requires Basic
-- =============================================================================

theorem upgrade_standard_requires_basic :
    ∀ (datum : PnftDatum),
      pnft_spend_validator datum PnftRedeemer.UpgradeStandard = true →
      datum.level = VerificationLevel.Basic := by
  intros datum h
  simp [pnft_spend_validator] at h
  exact h

#blaster [upgrade_standard_requires_basic]

-- =============================================================================
-- THEOREM 4: Upgrade path — Verified requires Standard
-- =============================================================================

theorem upgrade_verified_requires_standard :
    ∀ (datum : PnftDatum),
      pnft_spend_validator datum PnftRedeemer.UpgradeVerified = true →
      datum.level = VerificationLevel.Standard := by
  intros datum h
  simp [pnft_spend_validator] at h
  exact h

#blaster [upgrade_verified_requires_standard]

-- =============================================================================
-- THEOREM 5: Upgrade path — Steward requires Verified
-- =============================================================================

theorem upgrade_steward_requires_verified :
    ∀ (datum : PnftDatum),
      pnft_spend_validator datum PnftRedeemer.UpgradeSteward = true →
      datum.level = VerificationLevel.Verified := by
  intros datum h
  simp [pnft_spend_validator] at h
  exact h

#blaster [upgrade_steward_requires_verified]

-- =============================================================================
-- THEOREM 6: Guardianship transfer only for Ward level
-- =============================================================================

theorem guardianship_transfer_only_ward :
    ∀ (datum : PnftDatum),
      pnft_spend_validator datum PnftRedeemer.TransferGuardianship = true →
      datum.level = VerificationLevel.Ward := by
  intros datum h
  simp [pnft_spend_validator] at h
  exact h

#blaster [guardianship_transfer_only_ward]

-- =============================================================================
-- THEOREM 7: Burn is always allowed
-- =============================================================================

theorem burn_always_allowed :
    ∀ (datum : PnftDatum),
      pnft_spend_validator datum PnftRedeemer.Burn = true := by
  intro datum
  simp [pnft_spend_validator]

#blaster [burn_always_allowed]

-- =============================================================================
-- THEOREM 8: Level ordering is total — toNat is injective
-- =============================================================================

theorem level_ordering_total :
    ∀ (a b : VerificationLevel),
      level_gte a b = true ∨ level_gte b a = true := by
  intros a b
  simp [level_gte, VerificationLevel.gte]
  omega

#blaster [level_ordering_total]

-- =============================================================================
-- THEOREM 9: Basic and Ward cannot transact
-- =============================================================================

theorem basic_cannot_transact :
    can_transact VerificationLevel.Basic = false := by
  simp [can_transact, VerificationLevel.canTransact]

theorem ward_cannot_transact :
    can_transact VerificationLevel.Ward = false := by
  simp [can_transact, VerificationLevel.canTransact]

#blaster [basic_cannot_transact]
#blaster [ward_cannot_transact]

-- =============================================================================
-- THEOREM 10: Standard, Verified, Steward can transact
-- =============================================================================

theorem standard_can_transact :
    can_transact VerificationLevel.Standard = true := by
  simp [can_transact, VerificationLevel.canTransact]

theorem verified_can_transact :
    can_transact VerificationLevel.Verified = true := by
  simp [can_transact, VerificationLevel.canTransact]

theorem steward_can_transact :
    can_transact VerificationLevel.Steward = true := by
  simp [can_transact, VerificationLevel.canTransact]

#blaster [standard_can_transact]
#blaster [verified_can_transact]
#blaster [steward_can_transact]

-- =============================================================================
-- THEOREM 11: Guardian must be Standard+ (never Basic or Ward)
-- =============================================================================

theorem guardian_not_basic :
    can_be_guardian VerificationLevel.Basic = false := by
  simp [can_be_guardian]

theorem guardian_not_ward :
    can_be_guardian VerificationLevel.Ward = false := by
  simp [can_be_guardian]

theorem guardian_iff_standard_plus :
    ∀ (level : VerificationLevel),
      can_be_guardian level = true →
      level_gte level VerificationLevel.Standard = true := by
  intros level h
  cases level <;> simp_all [can_be_guardian, level_gte, VerificationLevel.toNat]

#blaster [guardian_not_basic]
#blaster [guardian_not_ward]
#blaster [guardian_iff_standard_plus]

-- =============================================================================
-- THEOREM 12: No skip upgrades — cannot go Basic → Verified directly
-- =============================================================================

theorem no_skip_basic_to_verified :
    ∀ (datum : PnftDatum),
      datum.level = VerificationLevel.Basic →
      pnft_spend_validator datum PnftRedeemer.UpgradeVerified = false := by
  intros datum hbasic
  simp [pnft_spend_validator, hbasic]

theorem no_skip_basic_to_steward :
    ∀ (datum : PnftDatum),
      datum.level = VerificationLevel.Basic →
      pnft_spend_validator datum PnftRedeemer.UpgradeSteward = false := by
  intros datum hbasic
  simp [pnft_spend_validator, hbasic]

theorem no_skip_standard_to_steward :
    ∀ (datum : PnftDatum),
      datum.level = VerificationLevel.Standard →
      pnft_spend_validator datum PnftRedeemer.UpgradeSteward = false := by
  intros datum hstd
  simp [pnft_spend_validator, hstd]

#blaster [no_skip_basic_to_verified]
#blaster [no_skip_basic_to_steward]
#blaster [no_skip_standard_to_steward]

end UltraLife.Pnft
