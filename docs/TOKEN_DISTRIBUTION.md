# Token Distribution & Bonding Curve

## Single Pool Model

**Total Supply: 400 billion ULTRA**

All tokens come from ONE pool. The bonding curve prices everything.

```
price(n) = n / 400,000,000,000

Token 1:     $0.0000000000025
Token 1B:    $0.0000025
Token 10B:   $0.000025
Token 100B:  $0.00025
Token 200B:  $0.0005
Token 400B:  $1.00
```

---

## What Comes From The Pool

| Distribution | Source | Settlement |
|--------------|--------|------------|
| **Purchases** | Bonding curve | Epoch |
| **Founder** | Bonding curve | Epoch |
| **Bootstrap grants** | Pool (fixed 50 ULTRA) | Immediate |
| **UBI** | Pool | Epoch |
| **Ecosystem grants** | Pool (governance) | Varies |

Everything uses the same pool. Everything moves the curve.

---

## Founder Calculation

### The Formula

**$10,000/month at the curve price at each epoch, since January 2020.**

```
Epochs per month: ~6 (5-day Cardano epochs)
Founder per epoch: $10,000 / 6 ≈ $1,667

Tokens received = $1,667 / price(current_position)
```

### Historical Calculation

Let's calculate from January 2020 (epoch 0) assuming ONLY founder distributions initially:

```
FOUNDER ACCRUAL SINCE JANUARY 2020

Assumptions:
- Start: January 2020 (call it epoch 0)
- Current: December 2024 (~60 months = ~360 epochs)
- $1,667 per epoch
- No other distributions initially (founder is first)

Epoch 0: Position = 0
├── Price ≈ $0 (effectively free at start)
├── $1,667 buys: Need a floor to avoid infinity
└── CAP: Max 1B tokens per epoch early on

With 1B/epoch cap for first epochs until price stabilizes:

Epoch 0-10: ~1B each = 10B tokens, position moves to 10B
├── After 10B distributed, price = 10B/400B = $0.000025

Epoch 11: Position = 10B, price = $0.000025
├── $1,667 / $0.000025 = 66,680,000 tokens (66.68M)
├── Position moves to 10.067B

Epoch 12: Position = 10.067B, price = $0.0000252
├── $1,667 / $0.0000252 = 66,150,000 tokens (66.15M)
└── And so on...
```

### Simplified Model: Integral Approach

For $10k/month over time, integrating the curve:

```
Cost to acquire T tokens starting at position N:

cost = ∫[N to N+T] (x / 400B) dx
     = (1/400B) × [(N+T)² - N²] / 2
     = (1/800B) × [2NT + T²]

Solving for T given cost C:
T = -N + √(N² + 800B×C)
```

### Actual Founder Tokens (60 months)

```
MONTH-BY-MONTH FOUNDER ACCRUAL

Month 1 (Jan 2020): Start position 0
├── $10,000 at near-zero price
├── Integral: T = √(800B × $10,000) = √(8×10¹⁵)
├── T = 89,442,719 tokens (89.4M)
├── But this moves position to 89.4M, price now $0.000000224
└── Cap at 5B to prevent early drain? Or let math work?

Let's let the math work with integral:

Month 1: C=$10,000, N=0
T = √(800×10⁹ × 10,000) = √(8×10¹⁵) = 89,442,719,100 (89.4B)

WAIT - that's more than the pool!

The issue: At near-zero prices, any USD amount buys enormous tokens.
```

### Realistic Model: Position Starts Higher

If we assume some initial distribution (genesis allocation) before founder accrual:

```
GENESIS DISTRIBUTION (before founder accrual starts)

Initial position: 10B tokens distributed at genesis
├── To bootstrap nodes, initial liquidity, etc.
├── Price at 10B: $0.000025

THEN founder accrual begins:

Month 1: N=10B, C=$10,000
├── T = -10B + √((10B)² + 800B×$10,000)
├── T = -10B + √(10²×10¹⁸ + 8×10¹⁵)
├── T = -10B + √(100.008×10¹⁸)
├── T = -10B + 10.0004B
├── T ≈ 400,000,000 (400M tokens)
└── Position: 10B → 10.4B

Month 2: N=10.4B, C=$10,000
├── T = -10.4B + √((10.4B)² + 800B×$10,000)
├── T ≈ 385,000,000 (385M tokens)
└── Position: 10.4B → 10.785B

... and so on, each month getting slightly fewer tokens as price rises
```

### 60-Month Summary (Estimated)

```
FOUNDER TOKENS AFTER 60 MONTHS

Starting position: 10B (genesis)
Monthly $10,000 at curve price

Approximate accumulation:
├── Months 1-12: ~4.5B tokens (price ~$0.000025-0.00003)
├── Months 13-24: ~3.8B tokens (price ~$0.00003-0.000035)
├── Months 25-36: ~3.2B tokens (price ~$0.000035-0.00004)
├── Months 37-48: ~2.8B tokens (price ~$0.00004-0.000045)
├── Months 49-60: ~2.5B tokens (price ~$0.000045-0.00005)
└── TOTAL: ~16.8B tokens

Final position: ~27B (10B genesis + ~17B founder)
Current price: 27B/400B = $0.0000675

Value of founder holdings at current price:
16.8B × $0.0000675 = $1,134,000 USD equivalent
```

---

## Current State Query

```
"What's the founder status?"

Position: 27B distributed
├── Genesis: 10B
├── Founder: ~17B
├── Sales: 0 (pre-launch)

Founder holdings: ~17B ULTRA
Current price: $0.0000675
Current value: ~$1.1M USD equivalent

Next epoch accrual: 
├── $1,667 / $0.0000675 = ~24.7M tokens
```

---

## Bootstrap Grants

**50 ULTRA per verified pNFT. Immediate. From the pool.**

```
Each bootstrap grant:
├── Moves position by 50 tokens
├── Price impact: negligible (50/400B)
└── Settlement: IMMEDIATE (no epoch wait)
```

At 1 million verified users:
- Total bootstrap: 50M tokens
- Price impact: 50M/400B = 0.0125% price increase

---

## Contract State

```aiken
type PoolDatum {
  position: Int,              // Tokens distributed (all sources)
  founder_accrued: Int,       // Founder tokens to date
  founder_claimed: Int,       // Founder tokens withdrawn
  bootstrap_issued: Int,      // Bootstrap grants issued
  last_epoch: Int,            // Last settlement epoch
  ada_collected: Int,         // From purchases
}
```

---

## Epoch Settlement

Each epoch (~5 days):

1. Calculate total USD to distribute (purchases + founder $1,667)
2. Integrate curve from current position
3. Distribute tokens proportionally
4. Update position
5. Founder can claim anytime

```
EPOCH SETTLEMENT EXAMPLE

Start position: 27B
Queued:
├── Purchases: $5,000
├── Founder: $1,667
├── Total: $6,667

Tokens for $6,667 at position 27B:
T = -27B + √((27B)² + 800B×$6,667)
T ≈ 98.8M tokens

Distribution:
├── Purchases: 74.1M (75% of total)
├── Founder: 24.7M (25% of total)

New position: 27.0988B
New price: $0.0000677
```

---

## Summary

| Question | Answer |
|----------|--------|
| Total supply? | 400B ULTRA |
| Founder tokens (60 months)? | ~17B ULTRA |
| Current founder value? | ~$1.1M USD |
| Bootstrap grant? | 50 ULTRA immediate |
| Next epoch founder? | ~25M tokens (~$1,667) |

**One pool. One curve. Everyone pays the same price.**

---

## UBI Distribution (Fee-Funded)

### No Separate Pool - Fees Fund Everything

UBI is NOT minted from a reserve. It comes from transaction fees each epoch.

```
EPOCH FEE ALLOCATION (No Accrual)

Fees Collected This Epoch: 10,000 ULTRA
          │
    ┌─────┴─────┐
    │   Split   │
    └─────┬─────┘
          │
    ┌─────┼─────┬─────────┐
    ▼     ▼     ▼         ▼
  5,000  3,000  2,000    (0)
   UBI  Valid  Treas  Accrual
```

### Dynamic Fee Adjustment (30-70% Range)

The UBI share of fees adjusts **monthly** based on whether recipients are receiving target amounts:

```
UBI FEE SHARE ALGORITHM

TARGET: ~100 ULTRA per person per epoch

IF avg_ubi < target:
  → Increase UBI share by 5% (up to 70% max)
  
IF avg_ubi > target × 1.5:
  → Decrease UBI share by 5% (down to 30% min)
  
OTHERWISE:
  → No change
```

**Why 30-70%?**

- **30% floor**: Validators and treasury always get something (system sustainability)
- **70% ceiling**: UBI is redistribution, not the whole economy
- **Self-balancing**: High activity → high UBI → attracts participation → more activity

**No governance votes. No human intervention. Algorithm runs.**

### Survival Floor + Engagement Ramp

Everyone gets a **survival floor** (enough for 1-2 food transactions).
Additional UBI scales with engagement:

```
UBI = SURVIVAL_FLOOR + (VARIABLE_SHARE × RAMP%)

SURVIVAL FLOOR: 20 ULTRA (everyone gets this)

ENGAGEMENT RAMP:
├── 0 transactions: Floor only (20 ULTRA)
├── 1 transaction:  Floor + 25% of share
├── 2 transactions: Floor + 50% of share
├── 3 transactions: Floor + 70% of share
├── 4 transactions: Floor + 85% of share
└── 5+ tx, 2+ counterparties: Floor + 100% of share
```

### Why 20 ULTRA Buys Survival Food

**Traditional food pricing includes intermediary AND obfuscation costs:**

```
TRADITIONAL GROCERY STORE PRICING:

Farm gate price:        $1.00
+ Processing:           $0.50 (adding sugar, seed oils, preservatives)
+ Branding:             $0.40 (marketing garbage as "food")
+ Certification:        $0.25 (paying for "organic" stickers)
+ Wholesale:            $0.30 (distributor margin)
+ Retail:               $0.60 (grocery store margin)
+ Health externalities: $0.50 (costs passed to healthcare)
─────────────────────────────
Consumer pays:          $3.55 (3.5x actual value)
+ Hidden health costs:  $1.00+ (inflammation, disease)
```

**UltraLife transparent economy eliminates ALL of this:**

```
BIOREGION DIRECT FOOD (TRANSPARENT):

Producer price:         $1.00
+ Protocol fee (2%):    $0.02
+ Local delivery:       $0.10
+ Certification:        $0.00 (transparency IS certification)
+ Health externalities: $0.00 (real food, no damage)
─────────────────────────────
Consumer pays:          $1.12 (near actual value)
```

**20 ULTRA in traditional system:** ~$6 worth of "food" + future health costs
**20 ULTRA in UltraLife system:** ~$18 worth of real food + peak health

### Transparency Replaces Certification

The certification industry exists because you **can't see what happened**.
In UltraLife, you CAN see:

**"Organic" - Traditional vs Transparent:**
```
TRADITIONAL:
├── Pay certification body $5,000/year
├── Inspector visits once per year
├── Fill out paperwork, get sticker
└── PROBLEM: Fraud is easy, verification is theater

ULTRALIFE:
├── Every input purchase is on-chain
├── Farmer's transaction history shows:
│   ├── Seeds: heirloom_seeds_collective
│   ├── Fertilizer: compost_coop (0 synthetic)
│   ├── Pesticides: NONE
│   └── Labor: fair wages visible
├── Consumer queries: "Show inputs for this tomato"
└── NO CERTIFICATION NEEDED - DATA IS VISIBLE
```

**Is the meat antibiotic-free?**
```
Query rancher's purchases:
├── Last antibiotic purchase: NEVER
├── Vet visits: 3/year (preventive only)
├── Feed: grass_fed_coop, minerals
└── VERIFIABLE, not trusted
```

**Is the mechanic maintaining equipment properly?**
```
Query machinery NFT:
├── Service intervals: every 250 hours ✓
├── Parts: OEM from verified_supplier
├── Mechanic pNFT: certified, 847 machines serviced
└── VERIFIABLE service with verified parts
```

**Is the welder certified for this job?**
```
Query welder's pNFT:
├── Certification: AWS D1.1 (attested by testing_facility)
├── Equipment: miller_welder_nft
├── Last calibration: 30 days ago ✓
├── Welds performed: 2,341 (all logged)
├── Inspection pass rate: 99.7%
└── THIS JOB: Correct equipment, certified for process
```

**Are building materials to spec?**
```
Query PRPO (Public Record Purchase Order):
├── Spec: Grade 60 rebar
├── Purchased: grade_60_rebar from steel_mill_pnft
├── Mill certificate: attached to material NFT
├── Installed by: ironworker_pnft (certified)
└── EVERY MATERIAL TRACEABLE mine→install
```

### DNA-Optimized Nutrition

The survival floor isn't for Doritos. It's for **what your body actually needs**.

```
DNA PROFILE → NUTRITIONAL NEEDS → FOOD MATCHING

Your pNFT includes (optional, privacy-protected):
├── Genetic markers for nutrient processing
├── Known allergies/intolerances
├── Metabolic characteristics
└── Deficiency risks

FOOD MATCHING:
"I need to spend my 20 ULTRA survival floor on food"

System matches:
├── Bioregion producers with matching foods
├── No added sugars (your markers show insulin sensitivity)
├── No seed oils (inflammatory for your genotype)
├── High iron sources (your markers show absorption issues)
└── Local, seasonal, minimally processed
```

**What's EXCLUDED from survival-floor eligible food:**

- Added sugars beyond natural occurrence
- Industrial seed oils (canola, soybean, corn)
- Artificial preservatives
- Ultra-processed ingredients
- Foods with impact scores above threshold

**Why This Matters:**

Traditional food industry profits from:
1. **Addiction**: Sugar, salt, fat engineering
2. **Shelf life**: Preservatives that harm you
3. **Cheap inputs**: Seed oils that inflame
4. **Overconsumption**: Packaging that hides portions

UltraLife food system optimizes for:
1. **Your health**: DNA-matched nutrition
2. **Sustainability**: Local, seasonal
3. **Real food**: Minimal processing
4. **Peak performance**: What your body actually needs

### Example Epoch

```
Sierra Nevada Bioregion - Epoch 1234

Fees collected: 50,000 ULTRA
UBI share (50%): 25,000 ULTRA
Eligible pNFTs: 500

Alice (active engagement):
├── Floor: 20 ULTRA
├── Variable share: 55 ULTRA
├── TOTAL: 75 ULTRA
├── Food purchasing power: ~$65 worth (direct)
└── vs traditional: ~$25 worth (3x markup)

Carol (survival only):
├── Floor: 20 ULTRA
├── Variable share: 0 ULTRA
├── TOTAL: 20 ULTRA
├── Food purchasing power: ~$18 worth (direct)
└── Covers: ~2 weeks of basic nutrition
```
```

### Why This Works

- **Dignity**: Nobody starves (floor covers basic food)
- **Incentive**: More participation = more UBI
- **Gradual**: Ramp encourages incremental engagement
- **Fair**: Those contributing most get most

---

## Monthly Fee Adjustment Algorithm

The UBI fee percentage isn't fixed - it adjusts monthly based on economic conditions.

### The Algorithm

```
TARGET: 100 ULTRA per person per epoch
ADJUSTMENT PERIOD: 6 epochs (~1 month)

AT END OF EACH PERIOD:
├── Calculate: avg_ubi = total_distributed / total_claimants
│
├── IF avg_ubi < 100 (too low):
│   └── Increase UBI fee share by 5%
│
├── IF avg_ubi > 150 (too high):
│   └── Decrease UBI fee share by 5%
│
└── IF 100 ≤ avg_ubi ≤ 150 (balanced):
    └── No change

BOUNDS:
├── Minimum: 30% of fees go to UBI
├── Maximum: 70% of fees go to UBI
└── Starting: 50%
```

### Example Adjustment Cycle

```
MONTH 1: Starting state
├── Fee share: 50%
├── Fees collected: 100,000 ULTRA
├── UBI pool: 50,000 ULTRA
├── Claimants: 800
├── Avg UBI: 62.5 ULTRA (below target)
└── ADJUSTMENT: +5% → 55%

MONTH 2: After adjustment
├── Fee share: 55%
├── Fees collected: 110,000 ULTRA
├── UBI pool: 60,500 ULTRA
├── Claimants: 850
├── Avg UBI: 71.2 ULTRA (still below)
└── ADJUSTMENT: +5% → 60%

MONTH 3: Continued growth
├── Fee share: 60%
├── Fees collected: 130,000 ULTRA
├── UBI pool: 78,000 ULTRA
├── Claimants: 700 (some left)
├── Avg UBI: 111.4 ULTRA (in range!)
└── ADJUSTMENT: none → stays 60%

MONTH 4: Economy booms
├── Fee share: 60%
├── Fees collected: 200,000 ULTRA
├── UBI pool: 120,000 ULTRA
├── Claimants: 600
├── Avg UBI: 200 ULTRA (too high!)
└── ADJUSTMENT: -5% → 55%
```

### No Human Intervention

- Algorithm runs automatically at epoch boundaries
- No governance votes needed
- No reserve management
- System finds equilibrium naturally
