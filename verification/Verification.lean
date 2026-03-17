-- UltraLife Protocol — Formal Verification of Plutus Contracts
-- Using Lean-blaster (SMT/Z3 backend) for automated theorem proving
--
-- This project models the core UltraLife Aiken validators in Lean4
-- and proves critical security properties using the #blaster tactic.
--
-- Validators verified:
--   1. Biometric (identity authentication gate)
--   2. pNFT (personal NFT identity — minting + spending)
--   3. Token (economic transaction rules)
--   4. Treasury (bonding curve + reserves)
--   5. Marketplace (listing lifecycle)

import Verification.PlutusLedgerAPI
import Verification.Biometric
import Verification.Pnft
import Verification.Token
import Verification.Treasury
import Verification.Marketplace
