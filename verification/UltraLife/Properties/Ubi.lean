/-
  UltraLife Protocol - UBI Validator Properties

  Universal Basic Income distribution system.
  Funded 100% from transaction fees - no accrual, no separate pool.

  Critical properties:
  1. No double-claiming per cycle
  2. Distribution is fair (proportional to engagement)
  3. Survival floor is always met
  4. Claims only valid in UBI window
-/

import CardanoLedgerApi.V3
import PlutusCore.Prep
import Blaster

namespace UltraLife.Ubi

-- =============================================================================
-- CONSTANTS
-- =============================================================================

/-- Survival floor: minimum UBI per person regardless of engagement -/
def SURVIVAL_FLOOR : Int := 20

/-- Maximum UBI per person (cap to prevent whale effects) -/
def MAX_UBI_PER_PERSON : Int := 500

/-- Target UBI per person (algorithm adjusts to approach this) -/
def TARGET_UBI_PER_PERSON : Int := 100

/-- Minimum transactions for full engagement share -/
def MIN_ENGAGEMENT_TX : Nat := 5

/-- Minimum unique counterparties for full engagement share -/
def MIN_ENGAGEMENT_COUNTERPARTIES : Nat := 2

/-- UBI window: first 3.7 days of each 37-day cycle (in slots) -/
def UBI_WINDOW : Int := 319_680

/-- Zero engagement floor: minimum share even with no activity (10% in bps) -/
def ZERO_ENGAGEMENT_FLOOR : Int := 1000

-- =============================================================================
-- TYPE DEFINITIONS
-- =============================================================================

/-- UBI pool state -/
structure UbiPoolDatum where
  cycle                    : Int
  bioregion               : ByteArray
  ubi_pool                : Int       -- Tokens available for distribution
  eligible_count          : Int       -- Number of eligible claimants
  total_engagement_weight : Int       -- Sum of all engagement weights
  claims_count            : Int       -- Number of claims processed
deriving Repr

/-- Individual claim record -/
structure UbiClaimDatum where
  pnft   : ByteArray
  cycle  : Int
  amount : Int
deriving Repr

/-- Avatar cycle statistics (for engagement calculation) -/
structure AvatarCycleStats where
  pnft                 : ByteArray
  cycle                : Int
  tx_sent              : Int
  tx_received          : Int
  unique_counterparties : Int
  labor_count          : Int
  remediation_count    : Int
  net_impact           : Int
deriving Repr

/-- UBI redeemer actions -/
inductive UbiRedeemer where
  | FundPool (cycle : Int) (amount : Int)
  | ClaimUBI (pnft : ByteArray) (cycle : Int)
  | CloseCycle (cycle : Int)
deriving Repr

-- =============================================================================
-- ENGAGEMENT CALCULATIONS
-- =============================================================================

/--
  Calculate engagement ramp percentage (basis points)
  0 tx = 0%, 1 tx = 25%, 2 tx = 50%, 3 tx = 70%, 4 tx = 85%, 5+ tx w/ 2+ counterparties = 100%
-/
def calculateRamp (total_tx counterparties : Nat) : Int :=
  if total_tx >= MIN_ENGAGEMENT_TX ∧ counterparties >= MIN_ENGAGEMENT_COUNTERPARTIES
  then 10000  -- 100%
  else if total_tx >= 4 then 8500
  else if total_tx >= 3 then 7000
  else if total_tx >= 2 then 5000
  else if total_tx >= 1 then 2500
  else 0

/--
  Calculate engagement weight from stats
-/
def calculateEngagementWeight (stats : AvatarCycleStats) : Int :=
  let base := 1000
  let tx_weight := (stats.tx_sent + stats.tx_received) * 100
  let counterparty_weight := stats.unique_counterparties * 500
  let labor_weight := stats.labor_count * 1000
  let remediation_weight := stats.remediation_count * 2000
  base + tx_weight + counterparty_weight + labor_weight + remediation_weight

/--
  Calculate UBI amount for a claimant
  SURVIVAL FLOOR + ENGAGEMENT RAMP
-/
def calculateUbiAmount (pool : UbiPoolDatum) (stats : AvatarCycleStats) : Int :=
  let floor := SURVIVAL_FLOOR
  let total_tx := stats.tx_sent + stats.tx_received
  let ramp := calculateRamp total_tx.toNat stats.unique_counterparties.toNat
  let engagement_weight := calculateEngagementWeight stats

  let pool_after_floors := pool.ubi_pool - pool.eligible_count * SURVIVAL_FLOOR
  let variable_share :=
    if pool.total_engagement_weight > 0 ∧ pool_after_floors > 0
    then engagement_weight * pool_after_floors / pool.total_engagement_weight
    else 0
  let ramped_share := variable_share * ramp / 10000

  let total := floor + ramped_share
  min total MAX_UBI_PER_PERSON

where
  min (a b : Int) : Int := if a < b then a else b

-- =============================================================================
-- VALIDATOR IMPORT (placeholder)
-- =============================================================================

-- #import_uplc ubiSpend "scripts/ubi_spend.flat"
-- #prep_uplc ubiSpendPrepped ubiSpend 2000

-- =============================================================================
-- PROPERTY 1: NO DOUBLE CLAIMING
-- =============================================================================

/--
  CRITICAL: Each pNFT can claim UBI only once per cycle

  A claim record is created for each claim.
  Prior claims are checked via reference inputs.
-/
theorem no_double_claim
  (ctx : ScriptContext)
  (h_valid : validSpendingContext ctx)
  (pnft : ByteArray)
  (cycle : Int)
  (h_redeemer : ctx.redeemer = UbiRedeemer.ClaimUBI pnft cycle)
  (h_prior_claim : hasPriorClaim ctx.txInfo.referenceInputs pnft cycle)
  : ¬ validatorSucceeds ctx := by
  -- verify_no_prior_claim() returns False if claim exists
  sorry -- Placeholder: actual proof via blaster

where
  hasPriorClaim : List TxIn -> ByteArray -> Int -> Prop := fun _ _ _ => True
  validatorSucceeds : ScriptContext -> Prop := fun _ => True

/--
  Successful claim creates a claim record
-/
theorem claim_creates_record
  (ctx : ScriptContext)
  (h_valid : validSpendingContext ctx)
  (pnft : ByteArray)
  (cycle : Int)
  (h_redeemer : ctx.redeemer = UbiRedeemer.ClaimUBI pnft cycle)
  (h_success : True)
  : ctx.txInfo.outputs.any (fun o => hasClaimRecord o pnft cycle) := by
  -- verify_claim_record() enforces this
  sorry -- Placeholder: actual proof via blaster

where
  hasClaimRecord : TxOut -> ByteArray -> Int -> Bool := fun _ _ _ => false

-- =============================================================================
-- PROPERTY 2: FAIR DISTRIBUTION
-- =============================================================================

/--
  CRITICAL: Distribution is proportional to engagement

  Higher engagement = higher share of variable pool.
  Engagement weight is calculated from on-chain transaction records.
-/
theorem distribution_proportional_to_engagement
  (ctx : ScriptContext)
  (h_valid : validSpendingContext ctx)
  (pool : UbiPoolDatum)
  (stats1 stats2 : AvatarCycleStats)
  (h_same_cycle : stats1.cycle = stats2.cycle)
  (h_higher_engagement : calculateEngagementWeight stats1 > calculateEngagementWeight stats2)
  : calculateUbiAmount pool stats1 >= calculateUbiAmount pool stats2 := by
  -- calculateUbiAmount is monotonic in engagement_weight
  sorry -- Placeholder: actual proof via blaster

/--
  Zero engagement still gets survival floor
-/
theorem zero_engagement_gets_floor
  (pool : UbiPoolDatum)
  (stats : AvatarCycleStats)
  (h_zero : stats.tx_sent = 0 ∧ stats.tx_received = 0)
  (h_pool_ok : pool.ubi_pool >= pool.eligible_count * SURVIVAL_FLOOR)
  : calculateUbiAmount pool stats >= SURVIVAL_FLOOR := by
  -- Floor is added unconditionally in calculateUbiAmount
  simp [calculateUbiAmount, SURVIVAL_FLOOR]
  sorry -- Placeholder: verify ramp = 0 case

-- =============================================================================
-- PROPERTY 3: SURVIVAL FLOOR GUARANTEE
-- =============================================================================

/--
  CRITICAL: Everyone receives at least survival floor

  Regardless of engagement level, minimum UBI is guaranteed.
-/
theorem survival_floor_guaranteed
  (ctx : ScriptContext)
  (h_valid : validSpendingContext ctx)
  (pool : UbiPoolDatum)
  (pnft : ByteArray)
  (cycle : Int)
  (amount : Int)
  (h_redeemer : ctx.redeemer = UbiRedeemer.ClaimUBI pnft cycle)
  (h_amount : claimAmount ctx = amount)
  (h_success : True)
  : amount >= SURVIVAL_FLOOR := by
  -- calculate_ubi_amount() always includes floor
  sorry -- Placeholder: actual proof via blaster

where
  claimAmount : ScriptContext -> Int := fun _ => 0

/--
  Pool must have enough for all floors before variable distribution
-/
theorem pool_covers_floors
  (ctx : ScriptContext)
  (h_valid : validSpendingContext ctx)
  (pool : UbiPoolDatum)
  (pnft : ByteArray)
  (cycle : Int)
  (h_redeemer : ctx.redeemer = UbiRedeemer.ClaimUBI pnft cycle)
  (h_success : True)
  : pool.ubi_pool >= pool.eligible_count * SURVIVAL_FLOOR := by
  -- Implicit in pool initialization
  -- Claims fail if insufficient_funds (sufficient_funds check)
  sorry -- Placeholder: actual proof via blaster

-- =============================================================================
-- PROPERTY 4: CLAIM WINDOW ENFORCEMENT
-- =============================================================================

/--
  CRITICAL: Claims only valid in UBI window (first 3.7 days of cycle)

  After window closes, unclaimed tokens return to treasury.
-/
theorem claim_requires_window
  (ctx : ScriptContext)
  (h_valid : validSpendingContext ctx)
  (pnft : ByteArray)
  (cycle : Int)
  (h_redeemer : ctx.redeemer = UbiRedeemer.ClaimUBI pnft cycle)
  (h_outside_window : ¬ inUbiWindow ctx.txInfo.validRange cycle)
  : ¬ validatorSucceeds ctx := by
  -- in_window check must pass for ClaimUBI
  sorry -- Placeholder: actual proof via blaster

where
  inUbiWindow : ValidityRange -> Int -> Prop := fun _ _ => True
  validatorSucceeds : ScriptContext -> Prop := fun _ => True

/--
  Close cycle only allowed after UBI window
-/
theorem close_requires_window_end
  (ctx : ScriptContext)
  (h_valid : validSpendingContext ctx)
  (cycle : Int)
  (h_redeemer : ctx.redeemer = UbiRedeemer.CloseCycle cycle)
  (h_still_in_window : inUbiWindow ctx.txInfo.validRange cycle)
  : ¬ validatorSucceeds ctx := by
  -- after_window check in validate_close_cycle()
  sorry -- Placeholder: actual proof via blaster

where
  inUbiWindow : ValidityRange -> Int -> Prop := fun _ _ => True
  validatorSucceeds : ScriptContext -> Prop := fun _ => True

-- =============================================================================
-- PROPERTY 5: MAX CAP ENFORCEMENT
-- =============================================================================

/--
  UBI capped at MAX_UBI_PER_PERSON to prevent whale effects
-/
theorem max_cap_enforced
  (pool : UbiPoolDatum)
  (stats : AvatarCycleStats)
  : calculateUbiAmount pool stats <= MAX_UBI_PER_PERSON := by
  -- min(total, MAX_UBI_PER_PERSON) in calculateUbiAmount
  simp [calculateUbiAmount]
  sorry -- Placeholder: verify min function

-- =============================================================================
-- PROPERTY 6: CLAIMANT AUTHORIZATION
-- =============================================================================

/--
  CRITICAL: Claimant must have Standard+ pNFT in the bioregion

  Basic and Ward levels cannot claim UBI.
-/
theorem claimant_must_have_valid_pnft
  (ctx : ScriptContext)
  (h_valid : validSpendingContext ctx)
  (pool : UbiPoolDatum)
  (pnft : ByteArray)
  (cycle : Int)
  (h_redeemer : ctx.redeemer = UbiRedeemer.ClaimUBI pnft cycle)
  (h_success : True)
  : hasPnftWithLevel ctx pnft pool.bioregion StandardOrHigher := by
  -- verify_claimant_pnft() checks level != Basic
  sorry -- Placeholder: actual proof via blaster

where
  StandardOrHigher := true
  hasPnftWithLevel : ScriptContext -> ByteArray -> ByteArray -> Bool -> Prop := fun _ _ _ _ => True

/--
  Claimant must sign the transaction
-/
theorem claimant_must_sign
  (ctx : ScriptContext)
  (h_valid : validSpendingContext ctx)
  (pnft : ByteArray)
  (owner : ByteArray)
  (cycle : Int)
  (h_redeemer : ctx.redeemer = UbiRedeemer.ClaimUBI pnft cycle)
  (h_owner : pnftOwner ctx pnft = some owner)
  (h_success : True)
  : owner ∈ ctx.txInfo.signatories := by
  -- claimant_signed check
  sorry -- Placeholder: actual proof via blaster

where
  pnftOwner : ScriptContext -> ByteArray -> Option ByteArray := fun _ _ => none

-- =============================================================================
-- PROPERTY 7: TOKENS SENT TO CLAIMANT
-- =============================================================================

/--
  Tokens must go to claimant's address
-/
theorem tokens_sent_to_claimant
  (ctx : ScriptContext)
  (h_valid : validSpendingContext ctx)
  (pnft : ByteArray)
  (owner : ByteArray)
  (cycle : Int)
  (amount : Int)
  (h_redeemer : ctx.redeemer = UbiRedeemer.ClaimUBI pnft cycle)
  (h_owner : pnftOwner ctx pnft = some owner)
  (h_amount : claimAmount ctx = amount)
  (h_success : True)
  : tokensToOwner ctx owner >= amount := by
  -- verify_tokens_to_claimant() enforces this
  sorry -- Placeholder: actual proof via blaster

where
  pnftOwner : ScriptContext -> ByteArray -> Option ByteArray := fun _ _ => none
  claimAmount : ScriptContext -> Int := fun _ => 0
  tokensToOwner : ScriptContext -> ByteArray -> Int := fun _ _ => 0

-- =============================================================================
-- PROPERTY 8: POOL DATUM UPDATE
-- =============================================================================

/--
  Pool datum correctly updated after claim
-/
theorem pool_updated_correctly
  (ctx : ScriptContext)
  (h_valid : validSpendingContext ctx)
  (old_pool : UbiPoolDatum)
  (pnft : ByteArray)
  (cycle : Int)
  (amount : Int)
  (h_redeemer : ctx.redeemer = UbiRedeemer.ClaimUBI pnft cycle)
  (h_old : extractPoolDatum ctx.txInfo.inputs = some old_pool)
  (h_amount : claimAmount ctx = amount)
  (h_success : True)
  : ∃ (new_pool : UbiPoolDatum),
      extractPoolDatum ctx.txInfo.outputs = some new_pool ∧
      new_pool.ubi_pool = old_pool.ubi_pool - amount ∧
      new_pool.claims_count = old_pool.claims_count + 1 := by
  -- verify_pool_datum_updated() enforces this
  sorry -- Placeholder: actual proof via blaster

where
  extractPoolDatum : List TxIn -> Option UbiPoolDatum := fun _ => none
  claimAmount : ScriptContext -> Int := fun _ => 0

-- =============================================================================
-- SECURITY PROPERTIES
-- =============================================================================

/--
  SECURITY: Unclaimed tokens return to treasury after window

  CloseCycle sends remaining tokens to treasury, not lost.
-/
theorem unclaimed_returns_to_treasury
  (ctx : ScriptContext)
  (h_valid : validSpendingContext ctx)
  (pool : UbiPoolDatum)
  (treasury : ByteArray)
  (cycle : Int)
  (h_redeemer : ctx.redeemer = UbiRedeemer.CloseCycle cycle)
  (h_pool : extractPoolDatum ctx.txInfo.inputs = some pool)
  (h_success : True)
  : tokensToTreasury ctx treasury >= pool.ubi_pool := by
  -- verify_tokens_to_treasury() enforces this
  sorry -- Placeholder: actual proof via blaster

where
  extractPoolDatum : List TxIn -> Option UbiPoolDatum := fun _ => none
  tokensToTreasury : ScriptContext -> ByteArray -> Int := fun _ _ => 0

/--
  SECURITY: Cycle must match pool's cycle

  Cannot claim from wrong pool.
-/
theorem cycle_must_match
  (ctx : ScriptContext)
  (h_valid : validSpendingContext ctx)
  (pool : UbiPoolDatum)
  (pnft : ByteArray)
  (cycle : Int)
  (h_redeemer : ctx.redeemer = UbiRedeemer.ClaimUBI pnft cycle)
  (h_pool : extractPoolDatum ctx.txInfo.inputs = some pool)
  (h_mismatch : cycle ≠ pool.cycle)
  : ¬ validatorSucceeds ctx := by
  -- cycle_matches check in validate_claim_ubi()
  sorry -- Placeholder: actual proof via blaster

where
  extractPoolDatum : List TxIn -> Option UbiPoolDatum := fun _ => none
  validatorSucceeds : ScriptContext -> Prop := fun _ => True

end UltraLife.Ubi
