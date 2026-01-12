# UltraLife Economic Model: Universal Impact & Bioregional Stake Pools

## Token Supply

**Total Supply: 400 billion ULTRA** (single pool)

Everything comes from one bonding curve:

```
price(n) = n / 400,000,000,000

All distributions move the curve:
├── Purchases (investors)
├── Founder ($10k/month at curve price)
├── Bootstrap grants (50 ULTRA per verified pNFT)
├── UBI distributions (engagement-based)
└── Ecosystem grants
```

See [Token Distribution](TOKEN_DISTRIBUTION.md) for bonding curve math, founder calculation, and UBI engagement rules.

## UBI: Engagement-Based, Not Flat

UBI rewards **participation**, not just existence:

```
FULL SHARE: ≥5 transactions + ≥2 counterparties per cycle
PARTIAL SHARE: Below thresholds = fractional UBI
FLOOR: Nobody gets zero (10% minimum)

UBI = Base × RegionFactor × ImpactScore × Engagement + LevelBonus
```

Your transactions help your whole bioregion's UBI multiplier.

## Core Principle: The Token IS the Economy

UltraLife is not a cryptocurrency layered on top of Cardano. It IS the economy—a complete system where every transaction:
- Moves value between DNA-verified identities
- Records physical impact on planetary systems
- Creates data that drives algorithmic UBI
- Contributes to bioregional economic health

## Universal Impact: There Is No Neutral

### The Physical Reality

Every action transforms matter and energy. Every transaction has consequence. The "neutral" category in traditional systems is a lie—a convenient fiction that allows extractive operations to externalize costs.

In UltraLife:
```
Transaction = Movement of Value + Declaration of Physical Consequence
```

### Impact Categories (Physical Systems)

These are not abstract metrics. These are the molecular and energetic flows that sustain carbon-based life:

| Category | Code | What It Measures |
|----------|------|------------------|
| Carbon | 0x0500 | CO2, CH4, soil carbon, biomass |
| Water | 0x0510 | Aquifer, watershed, contamination, evapotranspiration |
| Biodiversity | 0x0520 | Habitat, species, genetics, pollinators |
| Soil | 0x0530 | Microbes, fungi, organic matter, erosion |
| Air | 0x0540 | Oxygen, particulates, ozone, NOx/SOx |
| Waste | 0x0550 | Materials, toxins, resources, entropy |
| Energy | 0x0560 | Renewable, fossil, efficiency, storage |
| Land Use | 0x0570 | Agriculture, forest, urban, conversion |

### Impact Structure

```
Impact {
  category: ImpactCategory,      // Which physical system
  compound_code: ByteArray,      // Specific compound (CO2, CH4, etc.)
  magnitude: Int,                // SIGNED: + regenerative, - extractive
  unit: ByteArray,               // Measurement unit (kg, liters, m2)
  confidence: Int,               // 0-100 certainty of measurement
  locality: ImpactLocality,      // Site/Local/Regional/Global
}
```

### Example: Farm Paying Worker

A "simple" labor payment actually has multiple physical consequences:

```
Farm → Worker: 15 tokens for harvest work

Impacts: [
  { category: Biodiversity, magnitude: +45, unit: "m2_preserved", confidence: 90 },
  { category: Soil, magnitude: +12, unit: "kg_structure", confidence: 85 },
  { category: Carbon, magnitude: +8, unit: "kg_co2e", confidence: 95 },
  { category: Energy, magnitude: -2, unit: "kwh", confidence: 70 }
]

Net Impact: +63 (regenerative)
Evidence: ipfs://Qm... (photos, soil test, methodology)
Attestors: [neighbor_pnft_1, neighbor_pnft_2]
```

## Remediation Market: Consequence Has a Price

### When Net Impact Is Negative

If your transaction's net impact is extractive (sum of magnitude × confidence < 0), you MUST remediate:

1. **Immediate**: Burn impact tokens in same transaction
2. **Bonded**: Post collateral, remediate later (deadline)
3. **Purchased**: Buy impact tokens from regenerators
4. **Direct**: Physical action verified by Verified+ attestors

### Impact Tokens as Tradeable Consequence

Positive impacts can be minted as tradeable tokens:

```
ImpactDatum {
  bioregion: "sierra_nevada",
  category: Carbon,
  magnitude: 100,              // ALWAYS POSITIVE for tokens
  evidence_hash: "ipfs://...", // Lab results, photos
  generator: farm_pnft,        // Who created this impact
  attestations: [...],         // Verified+ users who confirmed
  retired: False,              // Has it been used for offset?
}
```

### The Market Loop

```
EXTRACTIVE OPERATIONS              REGENERATIVE OPERATIONS
       │                                  │
       │ Net negative impact              │ Net positive impact
       │ MUST remediate                   │ CAN tokenize
       │                                  │
       ▼                                  ▼
  ┌──────────────────────────────────────────────┐
  │          IMPACT TOKEN MARKET                 │
  │                                              │
  │  Price discovery: What is clean air worth?  │
  │  What is soil life worth? What is habitat   │
  │  worth? The market decides.                 │
  │                                              │
  │  Extractors PAY regenerators.               │
  │  Not charity. Consequence.                  │
  └──────────────────────────────────────────────┘
```

## Bioregional Stake Pools: Economic Infrastructure

### The Bridge: Cardano Consensus ↔ UltraLife Economy

Stake pools are where Cardano's block production meets UltraLife's bioregional economics:

```
Traditional Cardano Pool:
- Validates blocks
- Earns ADA rewards
- Delegators share rewards

UltraLife Bioregional Pool:
- Validates blocks (same)
- Earns ADA + UltraLife rewards
- Registered to specific bioregion
- Commits to impact transparency
- Treasury contribution (min 5%)
- Impact-modified rewards
```

### Pool Registration Requirements

1. **Operator pNFT**: Must be Verified+ level in the target bioregion
2. **Steward Endorsements**: 3 Stewards from the bioregion must endorse
3. **Minimum Stake**: 10,000 UltraLife tokens
4. **Impact Commitment**: Must declare:
   - Energy source (renewable?)
   - Carbon footprint per epoch
   - Treasury contribution percentage
   - Local reinvestment commitment
   - Evidence hash for verification

### Delegation Model

Users delegate UltraLife tokens to bioregion pools:

```
StakeDelegation {
  delegator: pnft_id,
  pool_id: "pool1abc...",
  amount: 5000,
  start_epoch: 500,
  auto_compound: True,
  lock_epochs: 10,      // Optional lock for higher rewards
}
```

### Reward Distribution

Each epoch, pools distribute rewards:

```
Total Rewards = Block Rewards + UltraLife Inflation Share

Distribution:
├── Operator Share: (margin %) — capped at 50%
├── Treasury Share: (commitment %) — minimum 5%
├── Delegator Share: remainder
└── Impact Modifier: ±% based on pool's verified impact score
```

### Economic Signals

The stake pool system creates powerful information:

| Signal | Meaning |
|--------|---------|
| High bioregion stake | Economic confidence in that region |
| Pool impact scores | Environmental leadership visible |
| Treasury accumulation | Project funding capacity |
| Delegation flow | Capital allocation decisions |
| Cross-bioregion staking | Economic interconnection |

## Complete Transaction Flow

### 1. User Sends Transaction

```
Alice (pnft_alice) sends 50 tokens to Bob (pnft_bob)

TransactionMeta {
  tx_type: Goods {
    product_code: "0x0312",  // Organic produce
    quantity: 10,
    unit_code: "kg"
  },
  impacts: [
    { category: Carbon, magnitude: +15, ... },
    { category: Soil, magnitude: +8, ... },
    { category: Energy, magnitude: -3, ... }
  ],
  evidence_hash: "ipfs://Qm...",
  attestors: [neighbor_1, neighbor_2],
  measured_at: 98234567
}
```

### 2. Token Validator Checks 8 Rules

1. ✓ Alice has valid pNFT
2. ✓ Alice is Standard+ level
3. ✓ Both Alice and Bob have bioregion assignment
4. ✓ Alice signed the transaction
5. ✓ Bob has pNFT (no anonymous recipient)
6. ✓ Metadata valid: **impacts non-empty**, evidence provided
7. ✓ Net impact = +20 (no remediation needed)
8. ✓ TransactionRecord created

### 3. Record Created On-Chain

```
TransactionRecord {
  sender: pnft_alice,
  sender_bioregion: "sierra_nevada",
  recipient: pnft_bob,
  recipient_bioregion: "sierra_nevada",
  amount: 50,
  tx_type: Goods { ... },
  impacts: [...],
  net_impact: +20,
  cycle: 47,
  slot: 98234567,
  evidence_hash: "ipfs://Qm..."
}
```

### 4. Statistics Updated

- Alice's AvatarCycleStats: tx_sent++, volume_sent += 50, impact_score += 20
- Bob's AvatarCycleStats: tx_received++, volume_received += 50
- Bioregion's BioregionCycleStats: total_transactions++, net_impact += 20

### 5. UBI Calculation Uses This Data

Alice's next UBI = Base × Health × Participation × Impact + Level_Bonus

Where Impact factor = f(Alice's impact_score relative to bioregion average)

## Product to Market: The Farm Example

### Setup

1. Farm owner gets pNFT (DNA verified)
2. Workers get pNFTs (DNA verified)
3. Farm registers in Sierra Nevada bioregion
4. Farm delegates 10,000 tokens to local pool

### Daily Operations

Every payment to workers:
- Declares labor type and hours
- Declares impacts (soil preserved, carbon sequestered, energy used)
- Creates permanent record
- Contributes to bioregion economic velocity

### Supply Chain

```
Seeds → Farm → Harvest → Distributor → Retailer → Consumer

EVERY ARROW is a transaction with:
- Impact declaration
- Evidence hash
- Attestor verification
```

### Consumer Product Label

Scanning QR code reveals:

```
🍅 ORGANIC TOMATOES - LOT #2024-47
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ORIGIN
├── Bioregion: Sierra Nevada (Health: 72%)
├── Farm: Verified pNFT (Steward level)
└── Pool Stake: 10,000 tokens (local commitment)

LABOR VERIFICATION  
├── 12 workers paid (all DNA-verified)
├── Total: 340 tokens in wages
└── Zero anonymous transactions

IMPACT CHAIN
├── Growing: +420 net impact
├── Transport: -45 impact (offset purchased)
├── Packaging: +12 impact (recycled materials)
└── Net: +387 regenerative

SUPPLY CHAIN INTEGRITY
├── 47 transactions recorded
├── All parties DNA-verified
├── Full trace available on-chain
└── EU DPP Compliant ✓
```

## Why This Works

### Truth Through Consequence

1. **DNA-locked identity**: Lying follows you forever
2. **Bidirectional verification**: Can't fake workers/suppliers
3. **Token conservation**: Math is on-chain
4. **Attestation requirement**: Neighbors verify claims
5. **Impact market**: Extractors pay regenerators

### Economic Alignment

1. **Regenerative farming becomes profitable** through impact token sales
2. **Extractive operations face real costs** through mandatory remediation
3. **Bioregions compete** for stake through ecological health
4. **Validators earn more** by operating sustainably
5. **Consumers can verify** with no trust required

### The Invisible Interface

None of this complexity is visible to users. They simply:

"Pay Maria 15 tokens for today's harvest work"

The LLM interface:
- Verifies identities
- Calculates impacts (from context)
- Finds attestors
- Submits transaction
- Records everything

**The bar for participation: Can you talk?**

## Technical Implementation Status

### Contracts Complete
- ✅ token.ak — Universal impact enforcement
- ✅ stake_pool.ak — Bioregional pool management
- ✅ types_v2.ak — Complete type definitions
- ✅ All 14 validators implemented
- ✅ 148+ unit tests

### What's Needed
- Aiken compilation and testing
- Integration tests across validators
- Front-end LLM interface
- IPFS evidence storage
- Pool registration UI
- Consumer verification app

## The Vision

This is not "blockchain for sustainability." This is:

**A complete economic system where physical consequence is the unit of account.**

Every token moved. Every impact recorded. Every bioregion measured. Every person accountable.

The economy stops lying about its costs. Regeneration becomes profitable. Extraction faces consequences.

The planet becomes the balance sheet.
