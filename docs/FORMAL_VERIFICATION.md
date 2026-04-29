# Formal Verification for UltraLife Protocol

This document describes the formal verification infrastructure for UltraLife Protocol's 28 Aiken validators using the Blaster toolchain.

## Overview

Formal verification allows us to mathematically prove that validators behave correctly under all possible inputs, not just tested scenarios. We use Input Output's Blaster toolchain, which combines:

- **Lean4**: Interactive theorem prover
- **Blaster**: SMT-based reasoning tactic for Lean4
- **PlutusCoreBlaster**: UPLC formalization and CEK machine semantics
- **CardanoLedgerApiBlaster**: Cardano ledger API formalization (TxInfo, ScriptContext, etc.)

## Prerequisites

### System Requirements

- **Lean4**: Version 4.24.0 or compatible
- **Z3 SMT Solver**: Version 4.15.2 or compatible
- **Aiken**: Version 1.1.21+ (for compiling validators)
- **Lake**: Lean's build tool (bundled with Lean4)

### Installation

#### 1. Install Lean4 and Lake

```bash
# Using elan (recommended)
curl https://raw.githubusercontent.com/leanprover/elan/master/elan-init.sh -sSf | sh

# Verify installation
lean --version
lake --version
```

#### 2. Install Z3 SMT Solver

```bash
# Ubuntu/Debian
sudo apt-get install z3

# macOS
brew install z3

# Verify installation
z3 --version
```

#### 3. Install Aiken (if not already installed)

```bash
# Using cargo
cargo install aiken --version 1.1.21

# Verify installation
aiken --version
```

## Project Setup

### Directory Structure

```
ultralife-protocol/
├── verification/                    # Formal verification workspace
│   ├── lakefile.lean               # Lean project configuration
│   ├── lean-toolchain              # Lean version pinning
│   ├── UltraLife/                  # Lean sources
│   │   ├── Properties/             # Property specifications
│   │   │   ├── Pnft.lean          # pNFT properties
│   │   │   ├── Token.lean         # Token properties
│   │   │   ├── Treasury.lean      # Treasury properties
│   │   │   └── Ubi.lean           # UBI properties
│   │   └── Validators/            # Imported UPLC validators
│   └── scripts/                   # Flat file exports
├── validators/                     # Aiken source files
├── plutus.json                    # Compiled validator blueprints
└── scripts/
    └── verify-validators.sh       # Verification runner
```

### Initialize Verification Project

```bash
cd verification
lake init UltraLife
```

### Configure Dependencies (lakefile.lean)

```lean
import Lake
open Lake DSL

package UltraLife where
  precompileModules := true

require «Blaster» from git
  "https://github.com/input-output-hk/Lean-blaster" @ "main"

require «PlutusCore» from git
  "https://github.com/input-output-hk/PlutusCoreBlaster" @ "main"

require «CardanoLedgerApi» from git
  "https://github.com/input-output-hk/CardanoLedgerApiBlaster" @ "main"

@[default_target]
lean_lib UltraLife where
  roots := #[`UltraLife]
```

### Pin Lean Version (lean-toolchain)

```
leanprover/lean4:v4.24.0
```

## Workflow: From Aiken to Verified Properties

### Step 1: Compile Aiken Validators

```bash
cd /path/to/ultralife-protocol
aiken build
```

This generates `plutus.json` containing compiled UPLC bytecode for all validators.

### Step 2: Extract UPLC to Flat Format

The `plutus.json` contains Base16-encoded CBOR. Extract to `.flat` files:

```bash
# Use the extraction script
./scripts/verify-validators.sh extract
```

### Step 3: Import UPLC into Lean

In your Lean file:

```lean
import CardanoLedgerApi.V3
import PlutusCore.Prep
import Blaster

-- Import the compiled validator
#import_uplc pnftValidator "scripts/pnft.flat"

-- Prepare for symbolic execution with fuel limit
#prep_uplc pnftValidatorPrepped pnftValidator 1000
```

### Step 4: Specify Properties

Define properties as Lean theorems:

```lean
-- Example: pNFT uniqueness property
theorem pnft_uniqueness
  (ctx : ScriptContext)
  (h_valid : validMintingContext ctx)
  (h_success : pnftValidatorPrepped.prop ctx.txInfo ctx.redeemer = true)
  : -- Property: minting exactly 1 token
    ctx.txInfo.mint.count = 1 := by
  blaster (timeout: 30000)
```

### Step 5: Run Verification

```bash
cd verification
lake build

# Or run specific proofs
lake env lean UltraLife/Properties/Pnft.lean
```

## Property Specifications

### Critical Properties by Validator

#### pNFT Validator (`validators/pnft.ak`)

| Property | Description | Priority |
|----------|-------------|----------|
| Uniqueness | One pNFT per DNA hash | Critical |
| Level Monotonicity | Level can only increase (Basic->Standard->Verified->Steward) | Critical |
| Owner Immutability | Owner field cannot change after mint | Critical |
| Burn Authorization | Only oracle attestation can burn | High |

#### Token Validator (`validators/token.ak`)

| Property | Description | Priority |
|----------|-------------|----------|
| Supply Cap | Total supply never exceeds 400 billion | Critical |
| Mint Authorization | Only treasury can mint | Critical |
| Identity Required | All transfers require valid pNFT | Critical |
| Remediation Enforcement | Negative impact requires remediation commitment | High |

#### Treasury Validator (`validators/treasury.ak`)

| Property | Description | Priority |
|----------|-------------|----------|
| Conservation | ADA in = tokens out (bonding curve) | Critical |
| Price Monotonicity | Bonding curve price never decreases | Critical |
| Multi-sig Required | Emergency actions require threshold signatures | Critical |
| Governance Gating | Emergency withdrawal requires governance approval | High |

#### UBI Validator (`validators/ubi.ak`)

| Property | Description | Priority |
|----------|-------------|----------|
| No Double Claim | Each pNFT can claim once per cycle | Critical |
| Fair Distribution | Distribution proportional to engagement | High |
| Window Enforcement | Claims only valid in UBI window | Critical |
| Floor Guarantee | Everyone receives at least survival_floor | High |

## Example Verification Session

### Verifying pNFT Level Monotonicity

```lean
import CardanoLedgerApi.V3
import PlutusCore.Prep
import Blaster

namespace UltraLife.Pnft

-- Level ordering
inductive VerificationLevel where
  | Basic
  | Ward
  | Standard
  | Verified
  | Steward
deriving DecidableEq, Repr

def levelOrd : VerificationLevel -> Nat
  | .Basic => 0
  | .Ward => 1
  | .Standard => 2
  | .Verified => 3
  | .Steward => 4

-- Import validator
#import_uplc pnftSpend "scripts/pnft_spend.flat"
#prep_uplc pnftSpendPrepped pnftSpend 2000

-- Property: Level can only increase
theorem level_monotonicity
  (ctx : ScriptContext)
  (h_valid : validSpendingContext ctx)
  (old_level new_level : VerificationLevel)
  (h_datum_in : ctx.txInfo.inputs.find? (fun i => i.resolved.datum = some old_level))
  (h_datum_out : ctx.txInfo.outputs.find? (fun o => o.datum = some new_level))
  (h_success : pnftSpendPrepped.prop ctx = true)
  : levelOrd new_level >= levelOrd old_level := by
  -- Decompose by upgrade type
  by_cases h : new_level = old_level
  · simp [h]
  · blaster (timeout: 60000) (counterexample: 1)

end UltraLife.Pnft
```

### Verifying Token Supply Cap

```lean
import CardanoLedgerApi.V3
import PlutusCore.Prep
import Blaster

namespace UltraLife.Token

def MAX_SUPPLY : Int := 400_000_000_000

#import_uplc tokenPolicy "scripts/token_policy.flat"
#prep_uplc tokenPolicyPrepped tokenPolicy 1500

-- Property: Total supply never exceeds cap
theorem supply_cap_preserved
  (ctx : ScriptContext)
  (h_valid : validMintingContext ctx)
  (current_supply minted : Int)
  (h_supply : current_supply <= MAX_SUPPLY)
  (h_success : tokenPolicyPrepped.prop ctx = true)
  : current_supply + minted <= MAX_SUPPLY := by
  -- Genesis mint is exactly MAX_SUPPLY, subsequent mints impossible
  blaster (timeout: 30000)

-- Property: Only treasury can trigger mint
theorem treasury_only_mints
  (ctx : ScriptContext)
  (h_valid : validMintingContext ctx)
  (h_success : tokenPolicyPrepped.prop ctx = true)
  : ctx.txInfo.inputs.any (fun i => 
      i.resolved.address.credential = Script treasuryHash) := by
  blaster (timeout: 30000)

end UltraLife.Token
```

## Handling Verification Results

### Valid (Proved)

When Blaster returns `Valid`, the property holds for all possible inputs satisfying the hypotheses.

```
theorem xyz : ... := by
  blaster  -- Result: Valid
```

Note: Blaster currently uses `admit` for valid results (no proof reconstruction). For production audits, consider supplementing with manual Lean proofs for critical properties.

### Falsified (Counterexample Found)

When Blaster finds a counterexample, it means the property can be violated:

```
theorem xyz : ... := by
  blaster (counterexample: 1)
  -- Result: Falsified
  -- Counterexample: ctx.txInfo.mint = -500, ...
```

This indicates a potential vulnerability. Document and investigate.

### Undetermined

The SMT solver couldn't decide within the timeout. Options:
- Increase timeout: `blaster (timeout: 120000)`
- Decompose the goal manually with `by_cases`
- Simplify hypotheses

## Known Limitations

1. **No Proof Reconstruction**: Blaster uses `admit` for proved goals. The SMT solver declares validity, but no Lean proof term is generated.

2. **Indexed Inductive Types**: Not fully supported. Use explicit pattern matching.

3. **Large UPLC Programs**: May exceed fuel limits. Increase carefully.

4. **Implicit Induction**: Not automatic. Use explicit induction tactics alongside `blaster`.

## Alternative Approaches

If Blaster is not available or suitable, consider these alternatives:

### Property-Based Testing with Aiken

Aiken has built-in testing with `aiken check`:

```aiken
test mint_basic_requires_signature() {
  let ctx = mock_context()
  let redeemer = MintBasic { owner: mock_key_hash() }
  !validate_mint_basic(ctx.tx, ctx.policy_id, mock_key_hash())
}
```

This doesn't prove correctness but provides high confidence through randomized testing.

### Manual Audit Checklist

For critical validators, supplement formal verification with manual code review for:
- Double satisfaction attacks
- Datum manipulation
- Reference script attacks
- Missing authorization checks
- Integer overflow/underflow

## Running Verification

### Full Suite

```bash
./scripts/verify-validators.sh all
```

### Specific Validator

```bash
./scripts/verify-validators.sh verify pnft
./scripts/verify-validators.sh verify token
./scripts/verify-validators.sh verify treasury
./scripts/verify-validators.sh verify ubi
```

### Extract Only

```bash
./scripts/verify-validators.sh extract
```

## References

- [Lean-blaster GitHub](https://github.com/input-output-hk/Lean-blaster)
- [PlutusCoreBlaster GitHub](https://github.com/input-output-hk/PlutusCoreBlaster)
- [CardanoLedgerApiBlaster GitHub](https://github.com/input-output-hk/CardanoLedgerApiBlaster)
- [Aiken Documentation](https://aiken-lang.org/)
- [UPLC Specification](https://aiken-lang.org/uplc)
- [Input|Output Formal Verification Blog](https://www.iog.io/news/a-new-era-of-smart-contract-verification-on-cardano)

## Changelog

- 2026-04-29: Initial documentation for Blaster-based formal verification setup
