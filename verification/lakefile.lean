-- UltraLife Protocol Formal Verification Project
-- Lakefile configuration for Lean4 + Blaster verification

import Lake
open Lake DSL

package UltraLife where
  precompileModules := true

-- SMT-based reasoning core
require «Blaster» from git
  "https://github.com/input-output-hk/Lean-blaster" @ "main"

-- UPLC formalization (CEK machine, builtins, encoding)
require «PlutusCore» from git
  "https://github.com/input-output-hk/PlutusCoreBlaster" @ "main"

-- Cardano Ledger API formalization (TxInfo, ScriptContext, Value, etc.)
require «CardanoLedgerApi» from git
  "https://github.com/input-output-hk/CardanoLedgerApiBlaster" @ "main"

@[default_target]
lean_lib UltraLife where
  roots := #[`UltraLife]
  -- Increase memory for large validator verification
  moreLeanArgs := #["-DmaxRecDepth=2000", "-DmaxHeartbeats=500000"]
