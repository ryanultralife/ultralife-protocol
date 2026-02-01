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
│  │ Farmers │──delegate──▶  │   Pool A    │──5%──▶│ Bioregion │ │
│  │ Makers  │     ULTRA     │   Pool B    │       │ Treasury  │ │
│  │ Artists │◀──rewards───  │   Pool C    │       │           │ │
│  └─────────┘               └──────┬──────┘       └─────┬─────┘ │
│                                   │                    │       │
│                       Track Metrics + Underwrite  Fund Projects │
│                                   │                    │       │
│                            ┌──────▼──────┐      ┌──────▼─────┐ │
│                            │ Health Index │      │ Restoration│ │
│                            │ Credit Cap   │      │ UBI Boost  │ │
│                            │ Impact Data  │      │ Grants     │ │
│                            └─────────────┘      └────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### What SPOs Track

**For Their Pool:**
- Total ULTRA delegated
- Number of delegators
- Underwriting capacity (50% of stake)
- Active projects backed

**For The Bioregion (Aggregated):**
- Combined stake = Credit capacity
- Health indices (air, water, biodiversity, carbon, soil)
- Transaction volume = Economic activity
- Treasury balance = Project funding capacity

### Delegation Flow

Anyone with a pNFT can delegate ULTRA to a bioregion pool:

```bash
# Tell your LLM agent:
"Delegate 1000 ULTRA to Sierra Nevada Pool A"
"Show me the pools in my bioregion"
"What's the credit capacity of Sierra Nevada?"
```

**Why delegate?**
1. Increase your bioregion's credit capacity
2. Earn ULTRA rewards (share of pool epoch earnings)
3. Support local projects (your stake backs real work)
4. Participate in governance (delegators can vote)

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

### Impact Tracking

Pools track their impact the same as any transaction—no special treatment:

- Pool operations generate impact (energy, hardware, etc.)
- Impact is measured and recorded on-chain
- Consumer of pool services accrues the impact
- No bonuses or penalties—just transparent tracking

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
npm run register:pool:sierra-a

# Or with custom parameters
node register-bioregion-pool.mjs \
  --bioregion "Sierra Nevada" \
  --pool-id pool1abc... \
  --ticker SNA
```

### Requirements to Register

1. **pNFT** — On-chain identity
2. **Bioregion selection** — Which bioregion to serve
3. **Commitment** — Ready to underwrite the bioregion's credit needs

---

## Multi-Pool Bioregions

Large bioregions can have multiple pools working together:

| Pool | Stake | Underwriting Capacity | Focus Area |
|------|-------|----------------------|------------|
| Sierra Nevada A | 1.25M ULTRA | 625K credit | General infrastructure |
| Sierra Nevada B | 890K ULTRA | 445K credit | Water/watershed projects |
| Sierra Nevada C | 2.1M ULTRA | 1.05M credit | Conservation/restoration |

**Total Sierra Nevada stake: 4.24M ULTRA**
**Total Bioregion Credit Capacity: ~2.1M ULTRA**

Pools don't compete—they **cooperate to support the bioregion**:
- Combined stake = Total bioregion credit capacity
- Each pool can underwrite projects up to 50% of their stake
- Pools coordinate on large regional projects
- Specialization by area (water, energy, agriculture, etc.)

---

## Credit Underwriting

### Pools as Bioregion Credit Unions

A stake pool's delegation determines how much credit it can extend to the bioregion:

```
Pool Stake: 1,000,000 ULTRA
      │
      ├── Underwriting Capacity: 500,000 ULTRA (50% of stake)
      │
      ├── Can back:
      │     • Restoration projects
      │     • Local business loans
      │     • Emergency response
      │     • Infrastructure improvements
      │
      └── Risk: Pool's stake backs the credit
            If project fails, pool absorbs loss
```

### How Credit Works

1. **Community proposes project** ("Restore 100 acres of watershed")
2. **Pool evaluates and underwrites** (commits portion of stake as backing)
3. **Treasury releases funds** against the pool's guarantee
4. **Project executes** with on-chain milestones
5. **Success:** Pool earns bonus, stake unlocked
6. **Failure:** Pool stake partially slashed to cover losses

### Underwriting Example

```
Project: Sierra Nevada Reforestation
Cost: 200,000 ULTRA
Duration: 24 epochs

Underwriters:
  Sierra Nevada A:  100,000 ULTRA (50%)
  Sierra Nevada B:   60,000 ULTRA (30%)
  Sierra Nevada C:   40,000 ULTRA (20%)

On success: Pools earn 5% bonus on underwritten amount
On failure: Pools lose up to 30% of underwritten amount
```

### Credit Capacity by Bioregion

The total stake delegated to a bioregion = its credit capacity:

| Bioregion | Total Stake | Credit Capacity | Active Projects |
|-----------|-------------|-----------------|-----------------|
| Sierra Nevada | 4.24M ULTRA | 2.12M ULTRA | 12 |
| Pacific Northwest | 6.8M ULTRA | 3.4M ULTRA | 18 |
| Great Lakes | 3.1M ULTRA | 1.55M ULTRA | 8 |
| Gulf Coast | 2.5M ULTRA | 1.25M ULTRA | 6 |

**Higher stake = more credit = more projects funded = healthier bioregion**

This creates a direct link between community confidence (delegation) and the bioregion's ability to fund improvements.
