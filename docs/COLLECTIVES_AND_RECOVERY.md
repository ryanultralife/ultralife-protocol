# Collectives & Recovery

## Core Principle

**Everything in UltraLife traces back to a human with a pNFT.**

There are no abstract entities. No corporate persons. No oracles as disembodied systems.

- A "business" is humans (pNFTs) + land + rights + escrow + bonds
- An "oracle" is a human (pNFT) with a specific role
- "Recovery" is humans (pNFTs) vouching for another human

---

## Part 1: What is a "Business"?

### Not This (Traditional)

```
CORPORATION
├── Legal fiction
├── Can own things
├── Can sue and be sued
├── Limited liability
├── Exists independently of humans
└── "Corporate personhood"
```

### This (UltraLife)

```
COLLECTIVE = Configuration of primitives, all traceable to humans

Mountain Yoga Studio:
├── Sarah's pNFT (human, 60% governance weight)
│   └── DNA-verified, accountable person
├── Miguel's pNFT (human, 40% governance weight)
│   └── DNA-verified, accountable person
├── Land NFT for 123 Main St
│   ├── Steward: Sarah's pNFT
│   └── Rights: Surface, Building (leased/owned)
├── Escrow Contract
│   └── Holds payments until service delivered
├── Quality Bond
│   └── Tokens staked by Sarah & Miguel
├── Collective Governance Datum
│   └── Links everything, defines decision rules
└── Transaction History
    └── Every payment, every impact, every customer
```

### The Difference

| Traditional Business | UltraLife Collective |
|---------------------|---------------------|
| Abstract legal entity | No entity - just relationships |
| Owns property directly | Humans own, collective coordinates |
| Limited liability | Full accountability to humans |
| Can hide ownership | Transparent governance weights |
| Separate from humans | IS the humans + their resources |
| Can exist forever | Exists while humans participate |

### How It Works

**Formation:**
```
Sarah: "I want to start a yoga studio with Miguel"

System does:
1. Both Sarah and Miguel's pNFTs sign
2. Creates CollectiveDatum linking:
   - Their pNFTs (60/40 split)
   - Governance rules (1-of-2 for daily, 2-of-2 for major)
   - Business categories (HealthWellness)
   - Bioregion (Sierra Nevada)
3. No new NFT minted - just a datum
```

**Adding Resources:**
```
Sarah: "Add our studio building to the collective"

System does:
1. Verifies Sarah's pNFT owns/stewards the Land NFT
2. Adds Land reference to collective's resources
3. Now the building is "part of" the yoga studio
```

**Receiving Payment:**
```
Customer: "Book a yoga class"

System does:
1. Customer's pNFT sends 15 tokens
2. Tokens go to collective's escrow
3. After class delivered, escrow releases
4. Split: 9 tokens to Sarah, 6 to Miguel (60/40)
5. Impact recorded: +8 wellness to customer's stats
6. Collective stats updated: +1 transaction, +8 impact
```

**Making a Decision:**
```
Sarah: "Let's hire Jamie as instructor"

System does:
1. Sarah initiates decision (AddMember)
2. Miguel approves (membership threshold = 2-of-2)
3. Jamie added with:
   - 0% ownership (employee, not partner)
   - Staff role
   - 50 token daily solo limit
4. Jamie can now process payments up to 50 tokens
```

---

## Part 2: Recovery (pNFT-to-pNFT)

### Core Principle

**Recovery is always humans vouching for humans.**

There is no "oracle" as an abstract system. When we say "DNA oracle," we mean:
- A human who works at a DNA verification lab
- That human has their own pNFT
- When they verify your identity, their pNFT signs the attestation
- If they lie, their pNFT carries that forever

### Recovery Layers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RECOVERY OPTIONS                                     │
│                    (All are pNFT-to-pNFT)                                   │
│                                                                              │
│  LAYER 1: Social Recovery                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  WHO: Guardians you've designated (friends, family with pNFTs)       │   │
│  │  HOW: 3-of-5 guardians sign attestation                             │   │
│  │  DELAY: 48-72 hours (security)                                      │   │
│  │  USE CASE: Lost phone, compromised key                              │   │
│  │                                                                      │   │
│  │  Guardians:                                                         │   │
│  │  ├── Mom's pNFT                                                     │   │
│  │  ├── Best friend's pNFT                                             │   │
│  │  ├── Business partner's pNFT                                        │   │
│  │  ├── Neighbor's pNFT                                                │   │
│  │  └── Colleague's pNFT                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  LAYER 2: DNA Lab Recovery                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  WHO: Lab technicians at DNA verification facilities                 │   │
│  │  HOW: Go to lab, provide DNA sample, tech verifies match            │   │
│  │  ATTESTATION: Lab tech's pNFT signs verification                    │   │
│  │  THRESHOLD: 2 techs required (prevents single point of failure)     │   │
│  │  USE CASE: Guardians unavailable, need definitive proof             │   │
│  │                                                                      │   │
│  │  Lab Tech Process:                                                  │   │
│  │  1. You walk into certified DNA lab                                 │   │
│  │  2. Provide sample (cheek swab)                                     │   │
│  │  3. Tech runs comparison against your pNFT's DNA hash               │   │
│  │  4. If match: Tech's pNFT signs recovery attestation                │   │
│  │  5. Second tech verifies and co-signs                               │   │
│  │  6. Recovery executes                                               │   │
│  │                                                                      │   │
│  │  Accountability: If tech signs false attestation, their pNFT        │   │
│  │  carries that attestation forever. Their reputation is at stake.    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  LAYER 3: Steward Recovery (Emergency)                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  WHO: Bioregion stewards (trusted community members)                 │   │
│  │  HOW: In-person vouching by multiple stewards                       │   │
│  │  THRESHOLD: Higher (e.g., 5-of-7 stewards)                          │   │
│  │  USE CASE: Remote area, no DNA lab nearby, guardians unavailable    │   │
│  │                                                                      │   │
│  │  Steward Process:                                                   │   │
│  │  1. Contact local bioregion stewards                                │   │
│  │  2. Meet in person with multiple stewards                           │   │
│  │  3. Stewards verify your identity through personal knowledge        │   │
│  │  4. Each vouching steward's pNFT signs attestation                  │   │
│  │  5. Higher threshold provides security                              │   │
│  │  6. Recovery executes                                               │   │
│  │                                                                      │   │
│  │  Note: This is more cumbersome by design. DNA/Social should be      │   │
│  │  primary. This is for edge cases.                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  LAYER 0: Key Rotation (No Recovery Needed)                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  WHO: Just you                                                       │   │
│  │  HOW: Sign with both old and new key                                │   │
│  │  USE CASE: Upgrading device, planned key change                     │   │
│  │                                                                      │   │
│  │  If you still have access to old key, you can rotate to new key     │   │
│  │  without involving anyone else.                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Who Are DNA Verifiers?

DNA verification labs employ humans. Those humans have pNFTs like everyone else.

```
Certified DNA Lab "Sierra Genetics":

Employees (all pNFT holders):
├── Dr. Maria Chen (pNFT: maria_chen_2024...)
│   ├── Role: Lab Director
│   ├── Badge: DNA_VERIFIER (certified)
│   └── Can sign recovery attestations
├── James Wilson (pNFT: james_wilson_2023...)
│   ├── Role: Lab Technician
│   ├── Badge: DNA_VERIFIER (certified)
│   └── Can sign recovery attestations
├── Sarah Park (pNFT: sarah_park_2024...)
│   ├── Role: Lab Technician  
│   ├── Badge: DNA_VERIFIER (certified)
│   └── Can sign recovery attestations
└── ...

When you need DNA recovery:
1. Visit Sierra Genetics
2. Maria or James processes your sample
3. Their pNFT signs: "I verified [your_pnft] DNA matches stored hash"
4. Second tech co-signs
5. Both attestations on-chain, tied to their human identities
```

### Guardian Setup Flow

```
SETTING UP GUARDIANS (while you have access)

You: "Set up my recovery guardians"

Claude: "I'll help you set up social recovery. You'll choose 3-7 people 
         you trust. If you ever lose access, any 3 of them can help you 
         recover.
         
         Who do you want as guardians?"

You: "My mom, my sister, my business partner Miguel, and my friend Alex"

Claude: "I found their pNFTs:
         • Mom: alice_johnson_2022... (your bioregion)
         • Sister: emma_johnson_2023... (your bioregion)
         • Miguel: miguel_santos_2023... (your bioregion)
         • Alex: alex_rivera_2024... (neighboring bioregion)
         
         Recommended settings:
         • Threshold: 3 of 4 (any 3 must approve)
         • Delay: 48 hours (gives you time to cancel if fraudulent)
         
         Set this up?"

You: "Yes"

Claude: "Guardian recovery is now active. 
         
         If you ever lose access:
         1. Contact any 3 of your guardians
         2. They'll approve your recovery request
         3. After 48 hours, you'll have access again
         
         Important: Your guardians can't take your assets - they can only
         help you regain access. And you can always cancel a recovery 
         request if you regain access before the delay expires."
```

### Recovery Flow

```
SCENARIO: Lost phone, no backup

Day 1, 10am: Realize you can't access your pNFT

Option A - Social Recovery:

10:30am: Contact guardians
You: "Mom, I lost my phone. Can you help me recover?"
Mom: Opens UltraLife, sees recovery request
Mom: "I can see your recovery request. Approving now."

11:00am: Contact more guardians  
Sister: Approves
Miguel: Approves

11:15am: Threshold met (3 of 4)
System: "Recovery approved. Will execute at Day 3, 11:15am (48hr delay)"

Day 3, 11:15am: Recovery executes
- Your pNFT now controlled by your new key
- Old key automatically invalidated
- Full access restored

---

Option B - DNA Recovery (if guardians unavailable):

11:00am: Go to Sierra Genetics lab

11:30am: Provide DNA sample
Dr. Chen: Runs comparison against your pNFT's stored hash
Dr. Chen: "Match confirmed. I'll sign the attestation."
Dr. Chen's pNFT signs recovery attestation

11:45am: Second verification
James: Independently verifies match
James's pNFT co-signs attestation

12:00pm: Threshold met (2 DNA verifiers)
Recovery executes immediately (no delay for DNA - it's definitive)
- Your pNFT now controlled by your new key
- Full access restored
```

---

## Part 3: The Yoga Studio, Fully Realized

Now let's see how it all fits together:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     MOUNTAIN YOGA STUDIO                                     │
│                  (A Collective, Not an Entity)                              │
└─────────────────────────────────────────────────────────────────────────────┘

HUMANS INVOLVED:
┌─────────────────────────────────────────────────────────────────────────────┐
│ Sarah (pNFT: sarah_mountain_2023...)                                        │
│ ├── Verification: Verified (DNA + Residency)                                │
│ ├── Governance weight: 60%                                                  │
│ ├── Role: Founder, Lead Instructor                                          │
│ ├── Solo limit: Unlimited (owner)                                           │
│ └── Recovery guardians: Mom, Sister, Miguel, Alex                          │
│                                                                              │
│ Miguel (pNFT: miguel_santos_2023...)                                        │
│ ├── Verification: Verified (DNA + Residency)                                │
│ ├── Governance weight: 40%                                                  │
│ ├── Role: Co-owner, Business Manager                                        │
│ ├── Solo limit: Unlimited (owner)                                           │
│ └── Recovery guardians: Sarah, Wife, Brother, Colleague                    │
│                                                                              │
│ Jamie (pNFT: jamie_instructor_2024...)                                      │
│ ├── Verification: Standard (DNA)                                            │
│ ├── Governance weight: 0% (employee)                                        │
│ ├── Role: Staff Instructor                                                  │
│ ├── Solo limit: 100 tokens (can process class payments)                    │
│ └── Not in collective governance, just authorized to transact              │
└─────────────────────────────────────────────────────────────────────────────┘

RESOURCES LINKED:
┌─────────────────────────────────────────────────────────────────────────────┐
│ Land NFT: 123 Main St, Quincy CA                                            │
│ ├── Steward: Sarah's pNFT                                                   │
│ ├── Rights held by collective:                                              │
│ │   ├── Building rights (owned outright)                                   │
│ │   └── Surface rights (5-year lease from original steward)                │
│ ├── Size: 2,500 sq ft                                                       │
│ └── Health index: 72/100                                                    │
│                                                                              │
│ Escrow Contract: Class Payments                                             │
│ ├── Purpose: Hold class payments until service delivered                    │
│ ├── Auto-release: 24 hours after class time                                │
│ └── Current balance: 340 tokens                                             │
│                                                                              │
│ Quality Bond: Service Guarantee                                             │
│ ├── Amount: 500 tokens (staked by Sarah 60%, Miguel 40%)                   │
│ ├── Purpose: Customer refunds if service fails                             │
│ └── Expires: Cycle 52 (renewable)                                           │
│                                                                              │
│ Equipment (tracked assets):                                                  │
│ ├── Yoga mats (50) - value: 200 tokens                                     │
│ ├── Sound system - value: 150 tokens                                       │
│ └── Props/blocks - value: 80 tokens                                        │
└─────────────────────────────────────────────────────────────────────────────┘

GOVERNANCE RULES:
┌─────────────────────────────────────────────────────────────────────────────┐
│ Daily Operations (any owner):                                               │
│ ├── Accept class payments                                                   │
│ ├── Pay expenses up to 500 tokens                                          │
│ ├── Update schedule                                                         │
│ └── Threshold: 40% (either Sarah OR Miguel)                                │
│                                                                              │
│ Membership Changes:                                                          │
│ ├── Add/remove staff                                                        │
│ ├── Change governance weights                                               │
│ └── Threshold: 100% (Sarah AND Miguel)                                     │
│                                                                              │
│ Major Decisions:                                                             │
│ ├── Sell/transfer building rights                                          │
│ ├── Dissolve collective                                                     │
│ ├── Take on debt/bonds                                                      │
│ ├── Threshold: 100% (Sarah AND Miguel)                                     │
│ └── Delay: 7 days (time to reconsider)                                     │
└─────────────────────────────────────────────────────────────────────────────┘

TRANSACTION HISTORY (transparent):
┌─────────────────────────────────────────────────────────────────────────────┐
│ This Cycle (Cycle 37):                                                       │
│                                                                              │
│ Revenue: 2,340 tokens                                                        │
│ ├── 156 class sessions (1,890 tokens)                                       │
│ │   └── Average: 12.1 tokens per class                                     │
│ ├── 3 workshops (450 tokens)                                                │
│ │   └── "Intro to Meditation" was most popular                             │
│ └── All from 89 unique pNFTs (customers)                                   │
│                                                                              │
│ Expenses: 890 tokens                                                         │
│ ├── Rent to landlord (pNFT: landlord_smith...) - 500 tokens                │
│ ├── Utilities (paid to Sierra Energy collective) - 120 tokens              │
│ ├── Supplies from local vendor (pNFT: vendor_jones...) - 180 tokens        │
│ └── Jamie's wages - 90 tokens                                               │
│                                                                              │
│ Net: 1,450 tokens                                                            │
│ ├── Sarah's share (60%): 870 tokens                                        │
│ └── Miguel's share (40%): 580 tokens                                       │
│                                                                              │
│ Impact Generated: +1,248                                                     │
│ ├── Wellness: +890 (direct health impact)                                  │
│ ├── Community: +212 (local gathering place)                                │
│ └── Local economy: +146 (all suppliers local)                              │
│                                                                              │
│ Badges Earned:                                                               │
│ ├── "Community Wellness Provider" - 100+ sessions this cycle               │
│ └── "Local First" - 95% local suppliers                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Customer Experience

```
Customer: "I want to take a yoga class"

Claude: "Mountain Yoga Studio is 2km from you in the Sierra Nevada bioregion.
         
         They offer:
         • Drop-in class: 15 tokens (+8 impact)
         • 10-class pass: 120 tokens (+95 impact) 
         • Monthly unlimited: 80 tokens (+150 impact)
         
         Next class: Vinyasa Flow tomorrow at 9am with Jamie.
         
         The studio is run by Sarah and Miguel, both Verified-level pNFTs 
         with excellent impact scores. They've taught 156 classes this 
         cycle and have a 'Community Wellness Provider' badge.
         
         Book a drop-in?"

Customer: "Yes"

Claude: "Done! 15 tokens sent to Mountain Yoga's escrow.
         
         Here's what happened:
         • Your payment is held in escrow until after the class
         • After the 9am class, it auto-releases
         • Sarah gets 9 tokens (60%), Miguel gets 6 tokens (40%)
         • You get +8 wellness impact on your pNFT
         
         See you tomorrow at 9am!"

---

AFTER THE CLASS:

Customer: "That was great! Jamie was an excellent instructor."

Claude: "Glad you enjoyed it! Your payment has been released from escrow.
         
         The collective now shows:
         • Your transaction recorded (privacy: only you see details)
         • +8 impact added to your lifetime wellness score
         • Mountain Yoga's cycle stats updated
         
         Want to leave a tip for Jamie directly?"

Customer: "Sure, 5 tokens"

Claude: "Sent 5 tokens directly to Jamie's pNFT.
         That's a +2 labor dignity impact for supporting workers directly."
```

---

## Summary

| Traditional Concept | UltraLife Reality |
|--------------------|--------------------|
| Corporation | Collective = pNFTs + Resources + Governance |
| Business entity | No entity - just coordinated humans |
| Oracle | A human with a pNFT and a role |
| Account recovery | Other humans vouching (pNFT-to-pNFT) |
| Corporate ownership | Individual stewardship, collective coordination |
| Limited liability | Full accountability to human identities |
| Business bank account | Escrow contracts, transparent to all |
| Corporate reputation | Collective impact score (sum of all transactions) |

**The bar for participation: Can you talk?**
**The accountability: Every action traces to a DNA-verified human.**
**The transparency: Every transaction visible, every impact recorded.**

---

## Part 1: Recovery Mechanisms

### The Problem

Current system: pNFT is tied to a wallet key. If you lose that key, you lose access to your identity and all associated assets.

### The Solution: Multi-Layer Recovery

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         RECOVERY OPTIONS                                     │
│                                                                              │
│  LAYER 1: Device Recovery                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Biometric backup on secure enclave                                │   │
│  │  • Encrypted seed phrase backup to cloud                             │   │
│  │  • Hardware wallet backup                                            │   │
│  │  → Self-service, immediate                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  LAYER 2: Social Recovery                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Pre-designated guardians (3-5 people you trust)                   │   │
│  │  • Threshold signatures (e.g., 3 of 5 guardians)                     │   │
│  │  • Time-locked (24-72 hour delay for security)                       │   │
│  │  → Requires guardian participation, 1-3 days                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  LAYER 3: DNA Recovery                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Return to DNA verification facility                               │   │
│  │  • Re-verify identity against stored hash                            │   │
│  │  • Oracle attestation of identity match                              │   │
│  │  → Ultimate fallback, requires physical presence                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Smart Contract Additions

```aiken
// =============================================================================
// RECOVERY TYPES
// =============================================================================

/// Guardian configuration for social recovery
pub type GuardianConfig {
  /// List of guardian pNFT identifiers
  guardians: List<AssetName>,
  /// Number of guardians required to approve recovery
  threshold: Int,
  /// Delay before recovery executes (in slots)
  recovery_delay: Int,
}

/// Recovery request status
pub type RecoveryRequest {
  /// pNFT being recovered
  pnft: AssetName,
  /// New owner key hash
  new_owner: VerificationKeyHash,
  /// Approving guardians so far
  approvals: List<AssetName>,
  /// When request was initiated
  initiated_at: Int,
  /// Recovery type
  recovery_type: RecoveryType,
}

/// Types of recovery
pub type RecoveryType {
  /// Social recovery via guardians
  SocialRecovery
  /// DNA re-verification
  DNARecovery {
    /// New DNA attestation
    attestation: ByteArray,
  }
  /// Hardware key rotation (same person, new key)
  KeyRotation {
    /// Proof of control over both keys
    old_key_signature: ByteArray,
  }
}

// =============================================================================
// PNFT RECOVERY REDEEMERS
// =============================================================================

pub type RecoveryRedeemer {
  /// Set up guardians (when everything is fine)
  SetupGuardians {
    config: GuardianConfig,
  }
  
  /// Update guardian list
  UpdateGuardians {
    new_config: GuardianConfig,
  }
  
  /// Initiate social recovery
  InitiateRecovery {
    new_owner: VerificationKeyHash,
  }
  
  /// Guardian approves recovery
  ApproveRecovery {
    guardian_pnft: AssetName,
  }
  
  /// Execute recovery after delay and threshold met
  ExecuteRecovery
  
  /// Cancel recovery (by original owner if they regain access)
  CancelRecovery
  
  /// DNA-based recovery
  DNARecovery {
    new_owner: VerificationKeyHash,
    attestations: List<ByteArray>,
  }
  
  /// Simple key rotation (same person, new device)
  RotateKey {
    new_owner: VerificationKeyHash,
    /// Signature from both old and new key
    dual_signature: ByteArray,
  }
}

// =============================================================================
// RECOVERY VALIDATOR
// =============================================================================

validator recovery(pnft_policy: PolicyId, oracle_keys: List<VerificationKeyHash>) {
  spend(
    datum: RecoveryDatum,
    redeemer: RecoveryRedeemer,
    _own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      SetupGuardians { config } -> {
        // Must own the pNFT
        let owns_pnft = verify_pnft_ownership(tx, datum.pnft)
        // Valid guardian config
        let valid_config = verify_guardian_config(config)
        // Creates guardian datum
        let creates_datum = verify_guardian_datum_created(tx, datum.pnft, config)
        
        owns_pnft && valid_config && creates_datum
      }
      
      InitiateRecovery { new_owner } -> {
        // Must be signed by a guardian
        let guardian_signed = verify_any_guardian_signed(tx, datum.guardians)
        // Creates recovery request
        let creates_request = verify_recovery_request_created(
          tx, datum.pnft, new_owner, datum.recovery_delay
        )
        // Cannot initiate if one already pending
        let no_pending = !has_pending_recovery(tx.reference_inputs, datum.pnft)
        
        guardian_signed && creates_request && no_pending
      }
      
      ApproveRecovery { guardian_pnft } -> {
        // Guardian must sign
        let guardian_signed = verify_pnft_signed(tx, guardian_pnft)
        // Guardian is in list
        let is_guardian = list.has(datum.guardians.guardians, guardian_pnft)
        // Not already approved
        let not_duplicate = !list.has(datum.request.approvals, guardian_pnft)
        // Updates approval list
        let updates_correctly = verify_approval_added(tx, datum, guardian_pnft)
        
        guardian_signed && is_guardian && not_duplicate && updates_correctly
      }
      
      ExecuteRecovery -> {
        // Threshold met
        let threshold_met = 
          list.length(datum.request.approvals) >= datum.guardians.threshold
        // Delay passed
        let delay_passed = 
          tx.validity_range.lower_bound >= datum.request.initiated_at + datum.guardians.recovery_delay
        // Updates pNFT owner
        let updates_owner = verify_pnft_owner_updated(tx, datum.pnft, datum.request.new_owner)
        
        threshold_met && delay_passed && updates_owner
      }
      
      CancelRecovery -> {
        // Original owner can cancel
        verify_original_owner_signed(tx, datum.pnft)
      }
      
      DNARecovery { new_owner, attestations } -> {
        // Oracle attestations valid
        let oracles_valid = verify_oracle_attestations(attestations, oracle_keys, 2)
        // DNA matches (attestation includes hash verification)
        let dna_matches = verify_dna_attestation_matches(attestations, datum.pnft)
        // Updates owner
        let updates_owner = verify_pnft_owner_updated(tx, datum.pnft, new_owner)
        
        oracles_valid && dna_matches && updates_owner
      }
      
      RotateKey { new_owner, dual_signature } -> {
        // Both old and new key signed
        let dual_signed = verify_dual_signature(tx, datum.current_owner, new_owner, dual_signature)
        // Updates owner
        let updates_owner = verify_pnft_owner_updated(tx, datum.pnft, new_owner)
        
        dual_signed && updates_owner
      }
    }
  }
}
```

### Recovery UX Flow

```
SCENARIO: User loses phone

1. User realizes they've lost access
   └── Opens UltraLife on new device
       └── "I need to recover my account"

2. Recovery options presented:
   ├── "I have my seed phrase" → Immediate restore
   ├── "Contact my guardians" → Social recovery
   └── "Visit verification center" → DNA recovery

3. Social Recovery Flow:
   Day 1: User initiates from new device
          └── 3 of 5 guardians notified
   
   Day 1-2: Guardians approve via their apps
            └── "Alex is trying to recover their account"
            └── [Approve] [Suspicious - Decline]
   
   Day 3: Once 3 approvals + 48 hour delay
          └── Recovery executes automatically
          └── User has full access on new device
          └── Old device access revoked

4. DNA Recovery Flow (if no guardians or guardians unavailable):
   Day 1: User visits verification facility
          └── DNA sample provided
          └── Oracle verifies match to stored hash
          └── New key generated at facility
          └── User has full access
```

---

## Part 2: Business Entities

### The Problem

Current system assumes every participant is a human with DNA. But businesses need to participate:
- Yoga studios, farms, restaurants
- Cooperatives, DAOs, nonprofits
- Any organization that provides goods/services

### The Solution: Entity NFTs (eNFTs)

Businesses get their own identity token, but it's fundamentally different from personal pNFTs:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    IDENTITY TYPES                                            │
│                                                                              │
│  ┌─────────────────────────┐      ┌─────────────────────────┐              │
│  │        pNFT             │      │        eNFT             │              │
│  │    (Personal NFT)       │      │    (Entity NFT)         │              │
│  ├─────────────────────────┤      ├─────────────────────────┤              │
│  │ • One per human         │      │ • One per organization  │              │
│  │ • DNA-verified          │      │ • Multi-sig controlled  │              │
│  │ • Cannot transfer       │      │ • Can transfer (sell)   │              │
│  │ • Receives UBI          │      │ • No UBI                │              │
│  │ • Votes as individual   │      │ • Votes by stake weight │              │
│  │ • Full privacy rights   │      │ • Transparent operations│              │
│  └─────────────────────────┘      └─────────────────────────┘              │
│                                                                              │
│  RELATIONSHIP: Every eNFT must have human stewards (pNFT holders)           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Entity NFT Structure

```aiken
// =============================================================================
// ENTITY NFT TYPES
// =============================================================================

/// Entity type classification
pub type EntityType {
  /// Sole proprietor (single pNFT controls)
  SoleProprietor
  /// Partnership (multiple pNFTs with ownership %)
  Partnership
  /// Cooperative (member-owned)
  Cooperative
  /// Nonprofit (mission-locked)
  Nonprofit
  /// DAO (token-governed)
  DAO
}

/// Entity NFT Datum
pub type EntityDatum {
  /// Unique entity identifier
  entity_id: ByteArray,
  /// Human-readable name
  name: ByteArray,
  /// Entity type
  entity_type: EntityType,
  /// Bioregion of primary operations
  primary_bioregion: ByteArray,
  /// Additional operating bioregions
  operating_bioregions: List<ByteArray>,
  /// Controlling stewards (pNFT holders)
  stewards: List<StewardRole>,
  /// Multi-sig configuration
  multisig: MultisigConfig,
  /// Registration timestamp
  registered_at: Int,
  /// Verification level
  verification: EntityVerification,
  /// Business categories
  categories: List<BusinessCategory>,
  /// Impact history summary
  impact_stats: EntityImpactStats,
  /// Badges earned
  badges: List<Badge>,
}

/// Steward role within an entity
pub type StewardRole {
  /// The human's pNFT
  pnft: AssetName,
  /// Role type
  role: Role,
  /// Ownership percentage (for partnerships)
  ownership_percent: Int,
  /// Can sign transactions
  can_sign: Bool,
  /// Added timestamp
  added_at: Int,
}

/// Roles within an entity
pub type Role {
  /// Full control
  Owner
  /// Can operate but not transfer/dissolve
  Manager
  /// Limited operations
  Staff
  /// View only
  Observer
}

/// Multi-sig configuration
pub type MultisigConfig {
  /// Total signers possible
  total_signers: Int,
  /// Required for normal operations
  operations_threshold: Int,
  /// Required for ownership changes
  ownership_threshold: Int,
  /// Required to dissolve entity
  dissolution_threshold: Int,
}

/// Entity verification levels
pub type EntityVerification {
  /// Basic registration
  Registered
  /// Location verified
  LocationVerified
  /// Operations verified
  OperationsVerified
  /// Certified (third-party audit)
  Certified {
    certifier: AssetName,
    certification_type: ByteArray,
    expires: Int,
  }
}

/// Business categories
pub type BusinessCategory {
  /// Food and agriculture
  FoodAgriculture
  /// Health and wellness
  HealthWellness
  /// Education
  Education
  /// Professional services
  ProfessionalServices
  /// Retail
  Retail
  /// Manufacturing
  Manufacturing
  /// Construction
  Construction
  /// Transportation
  Transportation
  /// Energy
  Energy
  /// Arts and culture
  ArtsCulture
  /// Other
  Other { description: ByteArray }
}

/// Entity impact statistics
pub type EntityImpactStats {
  /// Total transactions processed
  total_transactions: Int,
  /// Net impact generated
  net_impact: Int,
  /// Impact by category
  impact_by_category: List<(ImpactCategory, Int)>,
  /// Cycles in operation
  cycles_active: Int,
  /// Customers served
  customers_served: Int,
}

// =============================================================================
// ENTITY NFT REDEEMERS
// =============================================================================

pub type EntityRedeemer {
  /// Register a new entity
  RegisterEntity {
    name: ByteArray,
    entity_type: EntityType,
    initial_stewards: List<StewardRole>,
    categories: List<BusinessCategory>,
  }
  
  /// Add a steward
  AddSteward {
    new_steward: StewardRole,
  }
  
  /// Remove a steward
  RemoveSteward {
    steward_pnft: AssetName,
  }
  
  /// Update multi-sig config
  UpdateMultisig {
    new_config: MultisigConfig,
  }
  
  /// Transfer ownership (sell business)
  TransferOwnership {
    new_stewards: List<StewardRole>,
    sale_price: Int,
  }
  
  /// Upgrade verification level
  UpgradeVerification {
    verification_proof: ByteArray,
  }
  
  /// Dissolve entity
  Dissolve {
    reason: ByteArray,
  }
  
  /// Receive payment (for tracking)
  ReceivePayment {
    from_pnft: AssetName,
    amount: Int,
    purpose: ByteArray,
  }
  
  /// Make payment
  MakePayment {
    to: PaymentRecipient,
    amount: Int,
    purpose: ByteArray,
  }
}

/// Payment can go to person or entity
pub type PaymentRecipient {
  ToPerson { pnft: AssetName }
  ToEntity { enft: AssetName }
}
```

### How a Yoga Studio Would Work

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MOUNTAIN YOGA STUDIO                                      │
│                    Entity NFT Example                                        │
└─────────────────────────────────────────────────────────────────────────────┘

REGISTRATION:
┌─────────────────────────────────────────────────────────────────────────────┐
│ Entity Name: Mountain Yoga Studio                                           │
│ Entity Type: Partnership                                                    │
│ Primary Bioregion: Sierra Nevada                                            │
│ Categories: [HealthWellness, Education]                                     │
│                                                                              │
│ Stewards:                                                                    │
│ ┌─────────────────────────────────────────────────────────────────────┐    │
│ │ Sarah (pNFT: sarah_2024...) - Owner - 60% - Can Sign ✓             │    │
│ │ Miguel (pNFT: miguel_2023...) - Owner - 40% - Can Sign ✓           │    │
│ │ Jamie (pNFT: jamie_2024...) - Manager - 0% - Can Sign ✓            │    │
│ └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│ Multi-sig:                                                                   │
│ • Operations: 1 of 3 (any steward can process day-to-day)                   │
│ • Ownership: 2 of 2 owners (both Sarah and Miguel for big decisions)        │
│ • Dissolution: 2 of 2 owners                                                │
│                                                                              │
│ Verification: LocationVerified                                               │
│ Registered: Cycle 12                                                         │
└─────────────────────────────────────────────────────────────────────────────┘

DAILY OPERATIONS:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│ Customer Experience (via LLM interface):                                    │
│                                                                              │
│ Customer: "I want to take a yoga class at Mountain Yoga"                    │
│                                                                              │
│ Claude: "Mountain Yoga offers:                                              │
│          • Drop-in class: 15 tokens (+8 impact - wellness)                  │
│          • 10-class pass: 120 tokens (+95 impact)                           │
│          • Monthly unlimited: 80 tokens (+150 impact)                       │
│                                                                              │
│          They're in your bioregion, 2km from your usual location.           │
│          Next class: Vinyasa Flow at 9am tomorrow.                          │
│          Book it?"                                                          │
│                                                                              │
│ Customer: "Yes, drop-in for tomorrow"                                       │
│                                                                              │
│ Claude: "Booked! 15 tokens sent to Mountain Yoga Studio.                    │
│          Your impact: +8 (wellness contribution to community)               │
│          Confirmation sent. See you at 9am!"                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

TRANSACTION FLOW:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│ Customer (pNFT)                                                             │
│      │                                                                       │
│      │ 15 tokens                                                            │
│      │ + Impact: Wellness +8                                                │
│      │ + Record: "Yoga class drop-in"                                       │
│      ▼                                                                       │
│ Mountain Yoga (eNFT)                                                        │
│      │                                                                       │
│      │ Automatic splits:                                                    │
│      │ ├── 60% to Sarah (9 tokens)                                         │
│      │ ├── 40% to Miguel (6 tokens)                                        │
│      │ └── (Jamie paid separately as employee)                             │
│      │                                                                       │
│      │ Entity stats updated:                                                │
│      │ └── +1 transaction, +1 customer, +8 impact                          │
│      ▼                                                                       │
│ Records Contract                                                            │
│      │                                                                       │
│      └── Permanent record:                                                  │
│          • From: [customer pNFT]                                            │
│          • To: Mountain Yoga (eNFT)                                         │
│          • Amount: 15 tokens                                                │
│          • Purpose: Service - Wellness                                      │
│          • Impact: +8                                                       │
│          • Bioregion: Sierra Nevada                                         │
│          • Timestamp: [block time]                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

MONTHLY OPERATIONS:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│ Studio Manager View:                                                        │
│                                                                              │
│ "Show me the studio's performance this cycle"                               │
│                                                                              │
│ Claude: "Mountain Yoga Studio - Cycle 15 Summary                            │
│                                                                              │
│          Revenue: 2,340 tokens                                              │
│          • Classes: 1,890 tokens (156 sessions)                             │
│          • Workshops: 450 tokens (3 events)                                 │
│                                                                              │
│          Expenses: 890 tokens                                               │
│          • Rent (to landlord eNFT): 500 tokens                             │
│          • Utilities: 120 tokens                                            │
│          • Supplies (local vendor): 180 tokens                             │
│          • Staff wages: 90 tokens to Jamie                                  │
│                                                                              │
│          Net: 1,450 tokens                                                  │
│          • Sarah's share: 870 tokens                                        │
│          • Miguel's share: 580 tokens                                       │
│                                                                              │
│          Impact Generated: +1,248                                           │
│          • Wellness: +890                                                   │
│          • Community: +212                                                  │
│          • Local economy: +146                                              │
│                                                                              │
│          Badges Earned: 'Community Wellness Provider'"                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

INTEGRATION BENEFITS:
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│ For the Business:                                                           │
│ ✓ Automatic bookkeeping (every transaction recorded)                        │
│ ✓ Transparent ownership splits                                              │
│ ✓ Impact tracking for marketing ("We generated +15,000 community impact")  │
│ ✓ Customer relationships (see returning customers, not just transactions)  │
│ ✓ Integration with suppliers (order supplies via same system)              │
│ ✓ No payment processor fees (just network fees)                            │
│ ✓ Reputation through badges and impact scores                               │
│                                                                              │
│ For Customers:                                                               │
│ ✓ Know impact of every purchase                                             │
│ ✓ See business's full history and reputation                               │
│ ✓ Easy booking via any interface (voice, chat, app)                        │
│ ✓ Supports local economy (bioregion tracking)                              │
│ ✓ Data contributes to their UBI calculation                                │
│                                                                              │
│ For the Bioregion:                                                          │
│ ✓ Real economic data from actual transactions                              │
│ ✓ See what services exist where                                            │
│ ✓ Identify gaps (no yoga studios in subregion X)                           │
│ ✓ Support local business development                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Entity Registration Flow

```
1. Human decides to register a business
   └── Must have verified pNFT (at least Standard level)

2. Registration via LLM:
   User: "I want to register my yoga studio as a business"
   
   Claude: "Great! I'll help you set up an Entity NFT for your studio.
            
            What's the business name?"
   
   User: "Mountain Yoga Studio"
   
   Claude: "Got it. What type of entity?
            • Sole proprietor (just you)
            • Partnership (you + others)
            • Cooperative (member-owned)
            • Nonprofit"
   
   User: "Partnership - me and my partner Miguel"
   
   Claude: "I'll need Miguel's pNFT to add them. What's the ownership split?"
   
   User: "60% me, 40% Miguel"
   
   Claude: "Okay. For multi-sig:
            • Day-to-day operations: either of you can approve?
            • Big decisions: both of you needed?
            • I'll set it up this way. 
            
            Registration costs 25 tokens (one-time).
            Ready to register?"
   
   User: "Yes"
   
   Claude: "Mountain Yoga Studio is now registered!
            Entity ID: mountain_yoga_sierra_2024...
            
            Next steps:
            • Verify your location (visit will confirm)
            • Add your services (classes, workshops)
            • Start accepting customers
            
            Want to add your class schedule now?"

3. Entity NFT minted
   └── Controlled by multi-sig of owner pNFTs
   └── Listed in bioregion registry
   └── Can transact immediately
```

### Business Categories & Impact

Different business types generate different impact categories:

```typescript
interface BusinessImpactMapping {
  // Health & Wellness
  HealthWellness: {
    primary_impact: 'Social',
    compound: 'WELLNESS',
    typical_magnitude: '+5 to +20 per service',
  };
  
  // Food & Agriculture
  FoodAgriculture: {
    primary_impact: 'Multiple',
    compounds: ['FOOD_SECURITY', 'CARBON', 'BIODIVERSITY'],
    depends_on: 'production methods',
  };
  
  // Education
  Education: {
    primary_impact: 'Social',
    compound: 'EDUCATION',
    typical_magnitude: '+10 to +50 per course',
  };
  
  // Manufacturing
  Manufacturing: {
    primary_impact: 'Multiple (often negative)',
    compounds: ['CARBON', 'WASTE', 'WATER'],
    must_offset: true,
  };
}
```

---

## Part 3: Contract Additions Needed

### Files to Create

1. **recovery.ak** — Recovery validator
2. **entity.ak** — Entity NFT minting and management
3. **entity_registry.ak** — Business registry by bioregion

### Files to Modify

1. **types_complete.ak** — Add `EntityDatum`, `GuardianConfig`, etc.
2. **pnft.ak** — Add guardian setup capability
3. **token.ak** — Allow entity NFTs to transact
4. **records.ak** — Track entity transactions

### Migration Path

Current contracts can be deployed without these additions. Recovery and entity support can be added via:
1. New policy IDs for eNFTs
2. Upgrade to pNFT contract (or parallel recovery contract)
3. Registry updates to include entities

---

## Summary

| Feature | Current State | After Addition |
|---------|---------------|----------------|
| **Human Identity** | ✅ DNA-verified pNFT | ✅ Same + recovery options |
| **Key Recovery** | ❌ Lose key = lose access | ✅ 3-layer recovery |
| **Business Participation** | ❌ Only humans | ✅ Entity NFTs |
| **Multi-sig Control** | ❌ Single owner only | ✅ Configurable multi-sig |
| **Business Types** | ❌ None | ✅ Sole/Partnership/Coop/Nonprofit/DAO |
| **B2B Transactions** | ❌ Not explicit | ✅ Entity-to-entity tracked |

The yoga studio example shows how a real business would:
1. Register as an entity
2. Add partners/employees
3. Accept payments
4. Track revenue/expenses
5. Generate and display impact
6. Build reputation through badges
7. Participate in the bioregional economy

All through natural language, with the blockchain invisible.
