# UltraLife Validator Network (UVN)

## The Goal

Allow validators (SPOs and others) to:
1. **Stake ULTRA tokens** (not ADA)
2. **Validate UltraLife transactions**
3. **Earn fees in ULTRA** (not ADA)
4. **Operate without ADA** (protocol subsidizes L1 fees)

---

## The Problem

Cardano L1 requires ADA for:
- Transaction fees (~0.17 ADA typical)
- Minimum UTxO (~1-2 ADA)
- Staking deposits (500 ADA for pools)

This creates barriers for ULTRA-native participation.

---

## The Solution: Fee Subsidy Pool

```
┌─────────────────────────────────────────────────────────────────┐
│  USER                                                            │
│  "Transfer 100 tokens to Alice"                                  │
│  Pays: 0.5 ULTRA fee                                             │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ ULTRA fee
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  FEE SUBSIDY POOL                                                │
│                                                                  │
│  Holds: ADA (for L1 fees)                                       │
│  Collects: ULTRA (from users)                                   │
│                                                                  │
│  Action: Pays ~0.17 ADA to Cardano L1                           │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ ADA fee to L1
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  CARDANO L1                                                      │
│  Transaction validated and included in block                    │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ Each epoch
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ULTRALIFE VALIDATORS                                            │
│                                                                  │
│  Staked: ULTRA (not ADA)                                        │
│  Earn: ULTRA fees (from pool)                                   │
│  Work: Validate UltraLife transactions                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## How It Works

### For Users

1. User initiates transaction (transfer, offering, etc.)
2. User pays fee in **ULTRA** (not ADA)
3. Transaction executes on Cardano
4. User never touches ADA

### For Validators

1. Stake **ULTRA tokens** to become validator
2. Validate UltraLife transactions
3. Earn **ULTRA fees** proportional to:
   - Amount staked
   - Uptime score
   - Transactions validated
4. No ADA required to participate

### Fee Pool Funding

The ADA in the fee pool comes from:
- **Protocol Treasury** — From impact token sales
- **Bioregion Funds** — Percentage of bioregion activity
- **Stake Pool Rewards** — ADA rewards converted to ULTRA
- **Initial Allocation** — Bootstrap funding

---

## Validator Economics

### Staking

| Parameter | Value |
|-----------|-------|
| Minimum Stake | 100,000 ULTRA |
| Unbonding Period | 21 epochs (~21 days) |
| Maximum Slash | 30% of stake |

### Earnings

```
Validator Fee Share = (Validator Stake / Total Staked) × Epoch Fees × Performance Score
```

Performance Score (0-100%) based on:
- Uptime (40%)
- Transactions validated (30%)
- Response time (20%)
- No slashing history (10%)

### Example

```
Epoch fees collected: 10,000 ULTRA
Your stake: 500,000 ULTRA
Total staked: 5,000,000 ULTRA
Your performance: 95%

Your share = (500,000 / 5,000,000) × 10,000 × 0.95
           = 0.1 × 10,000 × 0.95
           = 950 ULTRA
```

---

## For Existing SPOs

### Migration Path

1. **Keep your Cardano pool** — Nothing changes there
2. **Register as UltraLife Validator** — Stake ULTRA
3. **Earn both**:
   - ADA from Cardano staking
   - ULTRA from UltraLife validation

### Why Both?

| Cardano Staking | UltraLife Validation |
|-----------------|---------------------|
| Validate blocks | Validate UltraLife txs |
| Earn ADA | Earn ULTRA |
| Requires ADA stake | Requires ULTRA stake |
| Delegators stake ADA | Delegators stake ULTRA |

**You can do both simultaneously.**

### Bioregion Integration

Your UltraLife validator can serve a specific bioregion:
- Validate transactions in that bioregion
- Earn higher fees for local activity
- Build reputation in that community
- Your Cardano pool and UltraLife validator share infrastructure

---

## For Businesses

### Migrate Your Operation

1. **Create Collective** — Your business becomes a collective
2. **Members get pNFTs** — Employees/partners verified
3. **Stake ULTRA** — Business stake for validation rights
4. **Earn from activity** — Every transaction your collective processes

### Benefits

- **No ADA fees** — Pay in ULTRA only
- **Transparent accounting** — All transactions on-chain
- **Impact tracked** — Know your environmental footprint
- **Governance rights** — Stake = voice in protocol decisions

---

## Technical Details

### Fee Pool Contract

```aiken
pub type FeePoolDatum {
  ada_balance: Int,           // ADA for subsidies
  ultra_fees_collected: Int,  // ULTRA collected this epoch
  ultra_fee_rate: Int,        // ULTRA per tx (scaled)
  min_ada_reserve: Int,       // Never go below this
}

pub type FeePoolRedeemer {
  SubsidizeFee { ultra_amount, tx_size }  // User pays ULTRA
  ReplenishAda { amount }                  // Treasury adds ADA
  DistributeFees { epoch, validators }     // Pay validators
}
```

### Validator Contract

```aiken
pub type UltraLifeValidatorDatum {
  validator_pnft: AssetName,
  ultra_staked: Int,
  bioregion: ByteArray,
  fees_earned_epoch: Int,
  uptime_score: Int,
  status: ValidatorStatus,
}

pub type ValidatorRedeemer {
  Register { stake_amount, bioregion }
  AddStake { amount }
  ClaimFees { epoch }
  BeginUnstake { amount }
}
```

---

## Roadmap

### Phase 1: Fee Subsidy (Now)
- [x] Fee pool contract
- [x] Validator registration
- [x] ULTRA fee collection
- [ ] Fee distribution logic
- [ ] Integration with MCP service

### Phase 2: Hydra Integration (Q2 2025)
- [ ] Hydra heads for high-frequency txs
- [ ] Batched L1 settlement
- [ ] Near-zero ADA requirements

### Phase 3: Partner Chain Evaluation (2026)
- [ ] Volume analysis
- [ ] Full ULTRA-native chain if justified

---

## Questions SPOs Will Ask

**Q: Do I need ADA to be a validator?**
A: No. Stake ULTRA, earn ULTRA. The fee pool handles ADA.

**Q: Can I run both Cardano pool and UltraLife validator?**
A: Yes. Same infrastructure, two income streams.

**Q: What if the fee pool runs out of ADA?**
A: Treasury replenishes. If treasury is low, fee rate increases (fewer txs until equilibrium).

**Q: How are validators selected?**
A: By stake weight and performance. More stake + better uptime = more transactions = more fees.

**Q: Can my delegators stake ULTRA too?**
A: Yes. They delegate ULTRA to your validator, share in fees proportionally.

---

## Summary

| Old Model | UltraLife Model |
|-----------|-----------------|
| Users pay ADA | Users pay ULTRA |
| Validators stake ADA | Validators stake ULTRA |
| Validators earn ADA | Validators earn ULTRA |
| ADA required everywhere | ADA abstracted away |

**The protocol absorbs ADA complexity. Validators operate in ULTRA.**

---

## Bioregion Economic Infrastructure

### SPOs as "Central Banks"

In UltraLife, stake pools aren't just validators—they're the economic infrastructure for their bioregion:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SIERRA NEVADA BIOREGION                      │
│                                                                 │
│  Community Members          Stake Pools            Treasury     │
│  ┌─────────┐               ┌─────────────┐       ┌───────────┐ │
│  │ Farmers │──delegate──▶  │   NASEC     │──5%──▶│ Bioregion │ │
│  │ Makers  │     ULTRA     │   TAHOE     │       │ Treasury  │ │
│  │ Artists │◀──rewards───  │   YOSEMITE  │       │           │ │
│  └─────────┘               └──────┬──────┘       └─────┬─────┘ │
│                                   │                    │       │
│                            Track Metrics         Fund Projects │
│                                   │                    │       │
│                            ┌──────▼──────┐      ┌──────▼─────┐ │
│                            │ Health Index │      │ Restoration│ │
│                            │ Economics    │      │ UBI Boost  │ │
│                            │ Impact Data  │      │ Grants     │ │
│                            └─────────────┘      └────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### What SPOs Track

**For Their Pool:**
- Total ULTRA delegated
- Number of delegators
- Renewable energy status
- Carbon footprint (kg CO2e/epoch)
- Uptime and performance

**For The Bioregion (Aggregated):**
- Combined stake = Economic confidence indicator
- Health indices (air, water, biodiversity, carbon, soil)
- Transaction volume = Economic activity
- Treasury balance = Project funding capacity

### Delegation Flow

Anyone with a pNFT can delegate ULTRA to a bioregion pool:

```bash
# Tell your LLM agent:
"Delegate 1000 ULTRA to the NASEC pool in Sierra Nevada"
"Lock my delegation for 12 epochs for bonus rewards"
"Enable auto-compound on my delegation"
```

**Why delegate?**
1. Earn ULTRA rewards (share of pool epoch earnings)
2. Support your bioregion (stake = economic confidence signal)
3. Participate in governance (delegators can vote)
4. Impact alignment (pools with better environmental scores earn more)

### Reward Distribution

Each epoch, pools distribute rewards:

```
Total Epoch Rewards: 10,000 ULTRA
│
├── Operator Share (2%):      200 ULTRA → Pool operator
├── Treasury Share (5%):      500 ULTRA → Bioregion treasury
├── Local Reinvestment (10%): 1,000 ULTRA → Local projects
└── Delegator Share (83%):    8,300 ULTRA → Pro-rata to delegators
```

### Impact Modifier

Pools with better environmental performance earn bonus rewards:

| Carbon Footprint | Reward Modifier |
|------------------|-----------------|
| 0 kg (fully renewable) | +15% bonus |
| < 50 kg | +10% bonus |
| < 100 kg | +5% bonus |
| < 200 kg | 0% (baseline) |
| > 200 kg | -5% penalty |

### Economic Signal

A bioregion's total delegated stake is a **real-time economic health indicator**:

```
High stake = Community confidence
  → More treasury funding
  → More local projects funded
  → Better health indices
  → Attracts more delegation (positive feedback)

Low stake = Economic concern
  → Limited treasury funds
  → Fewer projects possible
  → Signal to address issues
  → Call to action for community
```

This creates a **decentralized economic indicator** that:
- Cannot be manipulated by central authorities
- Reflects genuine community confidence
- Incentivizes environmental stewardship
- Automatically funds local action

### SPO Registration for Bioregion

```bash
# List available bioregions
npm run list:bioregions

# Register your pool for Sierra Nevada
npm run register:pool:sierra

# Or with custom parameters
node register-bioregion-pool.mjs \
  --bioregion "Sierra Nevada" \
  --pool-id pool1abc... \
  --ticker NASEC \
  --margin 2 \
  --renewable \
  --carbon-footprint 25
```

### Requirements to Register

1. **Verified pNFT** — At least Basic level identity
2. **Steward endorsements** — 3 Stewards from the bioregion
3. **Minimum stake** — Lock 10,000 ULTRA
4. **Impact commitment** — Declare energy source and carbon footprint

---

## Multi-Pool Bioregions

Large bioregions can have multiple pools competing:

| Pool | Total Stake | Renewable | Carbon | Delegators |
|------|-------------|-----------|--------|------------|
| NASEC | 1.25M ULTRA | Yes | 15 kg | 47 |
| TAHOE | 890K ULTRA | Yes | 0 kg | 31 |
| YOSEMITE | 2.1M ULTRA | Partial | 85 kg | 89 |

**Total Sierra Nevada stake: 4.24M ULTRA**

Pools compete on:
- Lower carbon footprint
- Higher renewable percentage
- Better uptime
- Lower operator margin
- Community engagement and trust
