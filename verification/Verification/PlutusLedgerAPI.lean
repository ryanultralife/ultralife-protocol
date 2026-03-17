-- =============================================================================
-- UltraLife Protocol — Plutus Ledger API Types (Lean4 Model)
-- =============================================================================
--
-- Models the Cardano/Plutus types used across all UltraLife validators.
-- Mirrors the Aiken types from lib/ultralife/types.ak and cardano stdlib.
--
-- These are simplified/abstract models suitable for SMT verification.
-- The goal is to capture the logical structure, not byte-level encoding.
-- =============================================================================

namespace UltraLife.PlutusLedgerAPI

-- =============================================================================
-- Core Cardano Types
-- =============================================================================

/-- POSIX time in milliseconds -/
structure POSIXTime where
  time : Nat
deriving Repr, Inhabited, BEq, Ord

/-- Verification key hash (abstracted as Nat for SMT) -/
structure VerificationKeyHash where
  hash : Nat
deriving Repr, BEq, Inhabited

/-- Blake2b-256 hash (abstracted as Nat) -/
structure Hash where
  value : Nat
deriving Repr, BEq, Inhabited

/-- Policy ID for native tokens -/
structure PolicyId where
  id : Nat
deriving Repr, BEq, Inhabited

/-- Asset name -/
structure AssetName where
  name : Nat
deriving Repr, BEq, Inhabited

/-- Script purpose -/
inductive Purpose
  | Minting
  | Spending
  | Rewarding
  | Certifying
  | Voting
  | Proposing
deriving Repr, BEq

/-- Validity range for transactions -/
structure ValidityRange where
  lower_bound : Nat
  upper_bound : Nat
deriving Repr, BEq

/-- Simplified output reference -/
structure OutputReference where
  tx_hash : Nat
  index : Nat
deriving Repr, BEq, Inhabited

-- =============================================================================
-- Identity / pNFT Types
-- =============================================================================

/-- Verification levels for pNFT identity -/
inductive VerificationLevel
  | Basic
  | Ward
  | Standard
  | Verified
  | Steward
deriving Repr, BEq

/-- Numeric encoding of verification levels for comparison -/
def VerificationLevel.toNat : VerificationLevel → Nat
  | .Basic    => 0
  | .Ward     => 1
  | .Standard => 2
  | .Verified => 3
  | .Steward  => 4

/-- Level comparison: a ≥ b -/
def VerificationLevel.gte (a b : VerificationLevel) : Bool :=
  a.toNat >= b.toNat

/-- Can this level transact? (Standard+) -/
def VerificationLevel.canTransact : VerificationLevel → Bool
  | .Basic    => false
  | .Ward     => false
  | .Standard => true
  | .Verified => true
  | .Steward  => true

/-- pNFT Datum — core identity record -/
structure PnftDatum where
  pnft_id : AssetName
  owner : VerificationKeyHash
  level : VerificationLevel
  bioregion : Option Nat  -- ByteArray abstracted as Nat
  dna_hash : Option Nat
  guardian : Option AssetName
  ward_since : Option Nat
  created_at : Nat
deriving Repr, BEq

-- =============================================================================
-- Transaction Types
-- =============================================================================

/-- Simplified transaction output -/
structure TxOutput where
  address_key : Option VerificationKeyHash  -- None if script address
  address_script : Option Nat               -- Script hash if script address
  value_ada : Nat                           -- Lovelace
  value_tokens : List (PolicyId × AssetName × Int)  -- Native tokens
  datum : Option PnftDatum                  -- Simplified: only PnftDatum for now
deriving Repr

/-- Simplified transaction input -/
structure TxInput where
  output_reference : OutputReference
  output : TxOutput
deriving Repr

/-- Simplified transaction -/
structure Transaction where
  inputs : List TxInput
  reference_inputs : List TxInput
  outputs : List TxOutput
  mint : List (PolicyId × AssetName × Int)
  extra_signatories : List VerificationKeyHash
  validity_range : ValidityRange
deriving Repr

-- =============================================================================
-- Biometric Types
-- =============================================================================

/-- Identity status for biometric validator -/
inductive IdentityStatus
  | Active
  | Suspended
  | Revoked
deriving Repr, BEq

/-- Biometric identity datum -/
structure IdentityDatum where
  enrollment_hash : Hash
  device_pubkey : Hash
  enrollment_time : Nat
  min_confidence : Nat  -- 80-98, representing 0.80-0.98
  status : IdentityStatus
  version : Nat
deriving Repr, BEq

/-- Biometric identity actions (redeemers) -/
inductive IdentityAction
  | Authenticate (live_hash : Hash) (confidence : Nat) (auth_time : Nat) (device_sig : Nat)
  | UpdateEnrollment (new_hash : Hash) (confidence : Nat) (device_sig : Nat)
  | Suspend (device_sig : Nat)
  | Revoke (recovery_proof : Nat)
deriving Repr, BEq

-- =============================================================================
-- Treasury Types
-- =============================================================================

/-- Treasury datum -/
structure TreasuryDatum where
  tokens_distributed : Nat
  ada_reserves : Nat
  btc_reserves : Nat
deriving Repr, BEq

-- =============================================================================
-- Token Types (Economic Transactions)
-- =============================================================================

/-- Transaction types in the economy -/
inductive TransactionType
  | Labor (hours : Option Nat)
  | Goods (quantity : Nat)
  | Services
  | Gift
  | Investment (terms_hash : Nat)
  | Remediation (bond_id : Nat)
  | UBI (cycle : Nat)
  | GovernanceReward (proposal_id : Nat)
  | Internal
  | StakeReward (pool_id : Nat) (epoch : Nat)
  | ImpactTrade (impact_token_id : Nat)
deriving Repr, BEq

/-- Compound flow measurement -/
structure CompoundFlow where
  quantity : Int
  confidence : Nat  -- 0-100
deriving Repr, BEq

/-- Activity impact data -/
structure ActivityImpact where
  compound_flows : List CompoundFlow
  evidence_hash : Nat  -- 0 = empty
deriving Repr, BEq

/-- Transaction metadata -/
structure TransactionMeta where
  tx_type : TransactionType
  activity_impact : ActivityImpact
deriving Repr, BEq

-- =============================================================================
-- Marketplace Types
-- =============================================================================

/-- Listing status -/
inductive ListingStatus
  | Active
  | Paused (reason : Option Nat)
  | Sold (buyer : AssetName) (sold_at : Nat)
  | Expired
  | Cancelled
deriving Repr, BEq

/-- Simplified listing datum -/
structure ListingDatum where
  listing_id : Nat
  seller : AssetName
  bioregion : Nat
  created_at : Nat
  updated_at : Nat
  status : ListingStatus
  interest_count : Nat
deriving Repr, BEq

-- =============================================================================
-- Helper Functions
-- =============================================================================

/-- Check if a list contains an element (BEq) -/
def List.has [BEq α] (xs : List α) (a : α) : Bool :=
  xs.any (· == a)

/-- Check if any element satisfies a predicate -/
def List.anyP (xs : List α) (p : α → Bool) : Bool :=
  xs.any p

end UltraLife.PlutusLedgerAPI
