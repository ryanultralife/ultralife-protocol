# UltraLife Protocol: LLM Interface Security Model

## For Cardano Stake Pool Operators & Protocol Developers

**Version:** 1.0  
**Audience:** Technical reviewers familiar with Cardano architecture

---

## Executive Summary

UltraLife uses an LLM (Large Language Model) as the user interface layer, translating natural language into blockchain transactions. This document addresses the critical question:

**How does conversational AI maintain blockchain security guarantees?**

Short answer: **The LLM never holds keys. The blockchain validates everything. The LLM is just a transaction builder that users can verify before signing.**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER                                            │
│                    "Send 100 tokens to Alice"                               │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Natural Language
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LLM INTERFACE LAYER                                  │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  • Parses user intent                                               │   │
│   │  • Queries chain state (READ ONLY)                                  │   │
│   │  • Builds UNSIGNED transaction                                      │   │
│   │  • Calculates impacts                                               │   │
│   │  • Presents summary to user                                         │   │
│   │                                                                     │   │
│   │  ⚠️  NO PRIVATE KEYS                                                │   │
│   │  ⚠️  CANNOT SIGN TRANSACTIONS                                       │   │
│   │  ⚠️  CANNOT SUBMIT WITHOUT USER WALLET                             │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Unsigned Transaction (CBOR)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         USER'S WALLET                                        │
│                    (Nami, Eternl, Lace, etc.)                               │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  • Shows transaction details                                        │   │
│   │  • User reviews BEFORE signing                                      │   │
│   │  • User signs with THEIR private key                                │   │
│   │  • Wallet submits to network                                        │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Signed Transaction
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CARDANO NETWORK                                         │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  • Validates signatures                                             │   │
│   │  • Executes Plutus validators                                       │   │
│   │  • Enforces ALL protocol rules                                      │   │
│   │  • Rejects invalid transactions                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Security Model: Trust Boundaries

### What the LLM CAN Do

| Capability | Security Implication |
|------------|---------------------|
| Read chain state | Public data, no risk |
| Build transactions | Unsigned, user must approve |
| Calculate impacts | Informational only |
| Present options | User makes final choice |
| Query oracles | Read-only |

### What the LLM CANNOT Do

| Forbidden Action | Why |
|------------------|-----|
| Sign transactions | No access to private keys |
| Submit without wallet | Requires wallet connection |
| Bypass validators | On-chain code enforces rules |
| Forge pNFT identity | DNA verification required |
| Steal funds | No key access |
| Create fake impacts | Validators reject invalid data |

### Trust Hierarchy

```
HIGHEST TRUST: Cardano L1 (consensus, Plutus validators)
              ↑ Validates everything, rejects invalid txs
              │
              │ On-chain code enforced
              │
MEDIUM TRUST: User's Wallet (key custody, signing)
              ↑ User reviews before signing
              │
              │ Unsigned transaction
              │
LOWEST TRUST: LLM Interface (tx builder, state reader)
              ↑ Can be wrong/malicious, but can't cause harm
              │ without user signing
              │
              User's Natural Language Input
```

---

## Attack Vectors & Mitigations

### Attack 1: Malicious LLM Builds Wrong Transaction

**Scenario:** LLM builds a transaction sending funds to attacker instead of intended recipient.

**Mitigation:**
1. User's wallet displays transaction details BEFORE signing
2. User sees: recipient address, amount, impacts, fees
3. User must explicitly approve
4. If user doesn't verify, this is social engineering (not protocol breach)

**Defense in Depth:**
```typescript
// Transaction summary shown to user BEFORE wallet signing
interface TransactionSummary {
  action: "Payment" | "Purchase" | "Stake" | ...;
  recipient: {
    pnft_name: string;      // Human-readable
    address: string;        // Full address for verification
    verification_level: VerificationLevel;
  };
  amount: {
    tokens: number;
    ada_for_fees: number;
  };
  impacts: Impact[];        // What this costs the Earth
  warnings: string[];       // Any anomalies detected
}
```

### Attack 2: LLM Lies About Chain State

**Scenario:** LLM claims user has 1000 tokens when they have 10.

**Mitigation:**
1. Transaction will fail on-chain (insufficient funds)
2. No funds lost, just failed tx
3. User can verify balance directly via explorer

**Why It Doesn't Matter:**
```
LLM says: "You have 1000 tokens"
User tries to spend 500
Transaction built, user signs
Cardano network: "Invalid: insufficient balance"
Transaction rejected, no harm done
```

### Attack 3: LLM Omits Impact Declaration

**Scenario:** LLM builds transaction without required impact data.

**Mitigation:**
```aiken
// On-chain validator ENFORCES impact requirement
validator token(config: TokenConfig) {
  spend(datum, redeemer, ctx) {
    // EVERY transaction MUST have impact declaration
    expect Some(impact) = find_impact_output(ctx.transaction.outputs)
    
    // Impact must be signed by transactor
    expect verify_impact_attestation(impact, ctx.transaction.extra_signatories)
    
    // Cannot proceed without valid impact
    True
  }
}
```

If LLM omits impacts → validator rejects → transaction fails → no harm.

### Attack 4: Compromised LLM Provider

**Scenario:** The LLM service itself is compromised.

**Mitigation:**
1. LLM has no keys → can't steal directly
2. All transactions require user wallet signature
3. Users can use any LLM (Claude, GPT, Llama, self-hosted)
4. Protocol is LLM-agnostic

**Defense:**
```
User can:
1. Use different LLM provider
2. Build transactions manually (Masumi SDK)
3. Use direct wallet interface
4. Verify all txs on explorer before signing
```

### Attack 5: Man-in-the-Middle

**Scenario:** Attacker intercepts between LLM and wallet.

**Mitigation:**
1. Transaction is CBOR-encoded, signed by user's key
2. Modification after signing → invalid signature → rejected
3. Standard TLS for transport

### Attack 6: Fake pNFT Identity

**Scenario:** Attacker creates fake pNFT to impersonate someone.

**Mitigation:**
```aiken
// pNFT minting requires DNA verification proof
validator pnft_minting(config: PnftConfig) {
  mint(redeemer, ctx) {
    expect MintPnft { dna_hash, verification_proof } = redeemer
    
    // Must have valid verification from authorized facility
    expect verify_dna_attestation(verification_proof, config.authorized_verifiers)
    
    // DNA hash must be unique (never minted before)
    expect !dna_exists_on_chain(dna_hash, ctx)
    
    // One pNFT per human, ever
    True
  }
}
```

You cannot fake a pNFT because:
1. Requires physical DNA verification
2. DNA hash is permanent and unique
3. Authorized facilities sign attestations
4. On-chain uniqueness enforced

---

## The Masumi Bridge: Technical Details

### What Is Masumi?

Masumi is a protocol for LLM-to-blockchain communication. For UltraLife:

```typescript
interface MasumiAdapter {
  // READ operations (no security risk)
  queryState(contract: string, filter: any): Promise<Datum[]>;
  getUtxos(address: string): Promise<UTxO[]>;
  getOracleData(oracleId: string): Promise<OracleDatum>;
  
  // BUILD operations (creates unsigned tx)
  buildTransaction(intent: Intent): Promise<UnsignedTx>;
  
  // SUBMIT operations (requires wallet)
  submitTransaction(signedTx: SignedTx): Promise<TxHash>;
  // ↑ This calls the user's wallet, which prompts for signing
}
```

### Transaction Flow (Detailed)

```
1. USER: "Pay Bob 50 tokens for the fence repair"
   
2. LLM PARSES:
   {
     intent: "payment",
     recipient: "Bob",
     amount: 50,
     purpose: "fence repair",
     category: "labor"
   }
   
3. LLM QUERIES CHAIN (via Masumi):
   - Find Bob's pNFT: ✓ Found, Verified level
   - Check user balance: ✓ 847 tokens available
   - Get impact reference: ✓ Labor/Maintenance = positive impact
   
4. LLM BUILDS UNSIGNED TX:
   {
     inputs: [user_utxo_with_50_tokens],
     outputs: [
       { address: bob_address, value: 50 tokens },
       { address: user_address, value: 797 tokens }, // change
       { address: impact_contract, datum: labor_impact }
     ],
     metadata: {
       purpose: "fence repair",
       labor_category: "maintenance"
     }
   }
   
5. LLM PRESENTS TO USER:
   "Paying Bob 50 tokens for fence repair.
    Impact: +15 (home maintenance labor)
    Your new balance: 797 tokens
    
    Confirm? [Review in Wallet]"
   
6. USER CLICKS CONFIRM:
   → Wallet opens
   → Shows: To: addr1_bob..., Amount: 50 ULTRA, Fee: 0.2 ADA
   → User clicks SIGN
   
7. WALLET SIGNS with user's private key

8. WALLET SUBMITS to Cardano network

9. VALIDATORS EXECUTE:
   - Check signature: ✓ Valid
   - Check balance: ✓ Sufficient
   - Check impact: ✓ Present and valid
   - Update state: ✓ Complete

10. CONFIRMATION:
    "✓ Payment complete. TX: abc123..."
```

---

## Validator Security: On-Chain Enforcement

### Every Transaction Is Validated

```aiken
// Example: Token transfer validator
validator token(config: TokenConfig) {
  spend(datum, redeemer, ctx) {
    when redeemer is {
      Transfer { recipient, amount, impact } -> {
        // 1. Sender must sign
        expect list.has(ctx.transaction.extra_signatories, datum.owner)
        
        // 2. Recipient must have valid pNFT
        expect verify_pnft_exists(recipient, config.pnft_policy, ctx)
        
        // 3. Amount must not exceed balance
        let sender_input = get_sender_value(ctx)
        expect amount <= sender_input
        
        // 4. Impact MUST be declared (Rule 6)
        expect Some(impact_output) = find_impact_output(ctx.transaction.outputs)
        expect impact_output.datum == impact
        
        // 5. Change must return to sender
        let change_output = find_change_output(ctx.transaction.outputs, datum.owner)
        expect change_output.value == sender_input - amount - fee
        
        True
      }
    }
  }
}
```

### What Validators Enforce

| Rule | Enforcement |
|------|-------------|
| Only owner can spend | Signature verification |
| Sufficient balance | Input/output balance |
| Valid recipient | pNFT existence check |
| Impact declared | Required output |
| Correct change | Amount accounting |
| Valid datum updates | State transition rules |

**The LLM cannot bypass these.** Even if the LLM builds a malicious transaction:
- Missing signature → rejected
- Insufficient funds → rejected
- Missing impact → rejected
- Invalid state transition → rejected

---

## pNFT Identity: The Foundation

### Why DNA Verification?

```
Traditional blockchain: Wallet = Identity
Problem: One person can have unlimited wallets

UltraLife: pNFT = Identity (one per human, DNA-verified)
Solution: Existential accountability
```

### Verification Flow

```
1. Human visits authorized verification facility
2. DNA sample collected (cheek swab)
3. DNA processed → hash generated
4. Hash checked against chain (must be unique)
5. Facility signs attestation
6. User's wallet mints pNFT
7. Bootstrap grant (50 tokens) issued

Result: One verified identity, permanent, unforgeable
```

### Security Properties

| Property | Mechanism |
|----------|-----------|
| Uniqueness | DNA hash checked on-chain |
| Permanence | pNFT cannot be burned |
| Verifiability | Attestation from authorized facility |
| Privacy | Only hash stored, not DNA |
| Recovery | Guardian network (other pNFTs vouch) |

---

## Comparison: Traditional Wallet vs LLM Interface

### Traditional Wallet Flow

```
User → Wallet UI → Build TX → Sign → Submit → Chain
        ↑
        Complex UI
        Technical knowledge required
        Error-prone
```

### LLM Interface Flow

```
User → Natural Language → LLM → Build TX → Wallet → Sign → Submit → Chain
                           ↑           ↑
                      Accessible    Still required!
                      Guided        User reviews
                      Impact-aware  User signs
```

### Security Comparison

| Aspect | Traditional | LLM Interface |
|--------|-------------|---------------|
| Key custody | User wallet | User wallet (same) |
| TX signing | User signs | User signs (same) |
| TX building | User/wallet | LLM builds, user reviews |
| Validation | On-chain | On-chain (same) |
| Error potential | High (manual) | Lower (guided) |
| Accessibility | Low (technical) | High (natural language) |
| Attack surface | Wallet security | Wallet + LLM (but LLM has no keys) |

**Key Insight:** The LLM adds accessibility without adding key-related risk because it never has access to private keys.

---

## For Stake Pool Operators: Integration Points

### Running a Bioregion Pool

UltraLife stake pools are organized by bioregion:

```aiken
pub type StakePoolDatum {
  pool_id: ByteArray,
  bioregion: ByteArray,          // Ecological boundary
  operator: AssetName,           // Operator's pNFT
  total_delegated: Int,
  delegators: List<Delegation>,
  fee_bps: Int,                  // Operator fee (basis points)
  impact_commitment: ByteArray,  // What the pool supports
}
```

### Pool Operator Requirements

1. **pNFT Verification:** Pool operator must have Verified+ pNFT
2. **Bioregion Association:** Pool linked to specific bioregion
3. **Impact Commitment:** Declare what environmental work the pool supports
4. **Transparent Fees:** On-chain fee structure

### Rewards Flow

```
Cardano Staking Rewards
        ↓
   UltraLife Pool
        ↓
   ┌────┴────┐
   ↓         ↓
Delegators  Bioregion Treasury
(proportional) (% for ecosystem)
```

### LLM Integration for Pools

```typescript
// User: "Stake 1000 tokens to Sierra Nevada"

// LLM queries available pools in bioregion
const pools = await masumi.queryPools({ bioregion: "sierra_nevada" });

// LLM presents options with impact info
// User selects pool
// LLM builds delegation tx
// User signs via wallet
// Delegation recorded on-chain
```

---

## Questions We Anticipate

### Q: What if the LLM hallucinates?

A: The blockchain doesn't care what the LLM thinks. Validators enforce rules. If the LLM builds an invalid transaction, it gets rejected. No harm done.

### Q: Can someone impersonate me via the LLM?

A: No. Transactions require your wallet's signature. The LLM can build a transaction saying "send all funds to attacker" but it can't sign it. Only your wallet can, and only with your approval.

### Q: What about LLM prompt injection?

A: Even if an attacker manipulates the LLM's behavior, the attacker cannot:
- Access your private keys
- Sign transactions on your behalf
- Bypass on-chain validators

The worst case: LLM builds a bad transaction. You see it in your wallet, don't sign it.

### Q: Why not just use a traditional wallet UI?

A: You can! The LLM interface is optional. It exists to make the protocol accessible to anyone who can talk. "Can you talk?" is the bar for participation.

### Q: How do I verify the LLM isn't lying?

A: Every transaction can be verified:
1. Review in your wallet before signing
2. Check chain state via explorer
3. Use multiple LLM providers and compare
4. Use the Masumi SDK directly

### Q: What about MEV / front-running?

A: Standard Cardano MEV considerations apply. The LLM doesn't add new MEV vectors because:
- Transactions are built locally
- Submitted via user's wallet
- No privileged mempool access

---

## Implementation Roadmap for Review

### Phase 1: Core Contracts (Complete)
- pNFT identity system
- Token mechanics
- Impact tracking
- UBI distribution
- Stake pools
- Governance

### Phase 2: Masumi Integration (In Progress)
- Transaction builder
- State queries
- Wallet interfaces
- Intent router

### Phase 3: LLM Templates (Planned)
- System prompts for each LLM provider
- Standard interaction patterns
- Error handling

### Phase 4: Testnet Deployment (Ready)
- Deploy contracts to Preview/Preprod
- Integration testing
- Security audit

### Phase 5: Community Review (Current)
- Stake pool operator feedback ← **You are here**
- Developer review
- Security audit
- Documentation refinement

---

## How to Review

### Contract Code
Repository: `ultralife-protocol-v2/contracts/`

Key files:
- `validators/pnft.ak` — Identity
- `validators/token.ak` — Economics
- `validators/stake_pool.ak` — Staking
- `lib/ultralife/types_universal.ak` — Core types

### Documentation
- `docs/UNIVERSAL_FRAMEWORK.md` — Philosophy
- `docs/IMPLEMENTATION_SPEC.md` — Technical architecture
- `docs/CARDANO_SCALING_INTEGRATION.md` — Scaling roadmap

### Questions & Feedback
Contact: [Your Discord/contact info]

---

## Summary

**The LLM interface is a convenience layer, not a trust layer.**

- Keys stay in your wallet
- Transactions require your signature
- On-chain validators enforce all rules
- LLM can be wrong, but can't cause harm without your consent

The bar for participation: **"Can you talk?"**

The security guarantee: **Same as traditional Cardano — your keys, your crypto.**
