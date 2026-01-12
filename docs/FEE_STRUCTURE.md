# Fee Structure

## The Fee Question

UltraLife has multiple layers where fees could apply:
- Cardano L1 (ADA fees, unavoidable)
- UltraLife Protocol (ULTRA fees, our design choice)
- Hydra L2 (feeless within heads, settlement costs)
- Validator rewards (ULTRA staking returns)

How do these interact? Who pays what? Where does it go?

---

## Fee Allocation (Per Epoch)

**All fees collected each epoch are distributed immediately. No accrual.**

```
TRANSACTION FEES COLLECTED
          │
          ▼
    ┌─────┴─────┐
    │  100% of  │
    │   fees    │
    └─────┬─────┘
          │
    ┌─────┼─────┬─────────┐
    ▼     ▼     ▼         ▼
   50%   30%   20%      (0%)
   UBI  Valid  Treas   Accrual
```

| Allocation | Percentage | Purpose |
|------------|------------|---------|
| **UBI Pool** | 50% | Distributed to eligible pNFTs by engagement |
| **Validators** | 30% | Rewards for block production & validation |
| **Treasury** | 20% | Protocol operations, fee subsidies, grants |
| **Accrual** | 0% | **Nothing accumulates** - all distributed |

### UBI Self-Balancing

```
HIGH ACTIVITY EPOCH:
├── More transactions → More fees
├── More fees → Bigger UBI pool
└── Same claimants → More per person

LOW ACTIVITY EPOCH:
├── Fewer transactions → Fewer fees
├── Fewer fees → Smaller UBI pool
└── Same claimants → Less per person

NO INFLATION/DEFLATION:
├── UBI comes from fees, not minting
├── Unclaimed UBI returns to fee pool
└── System is always in balance
```

---

## Current Cardano L1 Fees (Reference)

| Transaction Type | Approximate ADA Fee |
|------------------|---------------------|
| Simple transfer | ~0.17 ADA |
| Token transfer | ~0.20 ADA |
| Smart contract (simple) | ~0.30-0.50 ADA |
| Smart contract (complex) | ~0.50-2.00 ADA |
| Reference script usage | ~0.20-0.40 ADA |

At $0.50/ADA, a typical UltraLife transaction might cost **$0.10-0.25** in L1 fees.

---

## Fee Design Principles

### 1. Users Pay ULTRA, Not ADA

Users should never need ADA for daily transactions. The treasury's fee subsidy pool pays L1 fees.

```
USER EXPERIENCE
───────────────
User pays: X ULTRA
Treasury pays: Y ADA (to Cardano)
User never touches ADA
```

### 2. Fees Should Be Predictable

Users need to know what things cost. Variable fees create friction.

### 3. Fees Fund the Network

Validators need compensation. Protocol needs sustainability.

### 4. Hydra Should Be (Nearly) Free

L2 exists to make frequent small transactions viable.

---

## Proposed Fee Structure

### Layer 1 Transactions (Cardano Settlement)

These are transactions that must hit the Cardano blockchain:

| Transaction Type | ULTRA Fee | Treasury ADA Cost | Where ULTRA Goes |
|------------------|-----------|-------------------|------------------|
| **Mint pNFT** | 10 ULTRA | ~0.5 ADA | 100% Treasury |
| **Transfer tokens** | 2 ULTRA | ~0.2 ADA | 50% Validator / 50% Treasury |
| **Create offering** | 5 ULTRA | ~0.3 ADA | 50% Validator / 50% Bioregion |
| **Accept offering** | 5 ULTRA | ~0.3 ADA | 50% Validator / 50% Bioregion |
| **Create collective** | 20 ULTRA | ~0.5 ADA | 50% Validator / 50% Treasury |
| **Record impact** | 1 ULTRA | ~0.2 ADA | 50% Validator / 50% Impact Fund |
| **Claim UBI** | 0 ULTRA | ~0.2 ADA | Treasury covers (no fee for UBI) |
| **Governance vote** | 0 ULTRA | ~0.2 ADA | Treasury covers (no fee for voting) |

### Layer 2 Transactions (Hydra Heads)

Within a Hydra head, transactions are instant and nearly free:

| Transaction Type | ULTRA Fee | ADA Cost | Where ULTRA Goes |
|------------------|-----------|----------|------------------|
| **Spending bucket transfer** | 0.1 ULTRA | 0 ADA | 100% Head Operator |
| **Bucket to bucket (own)** | 0 ULTRA | 0 ADA | Free |
| **Micro-payment** | 0.1 ULTRA | 0 ADA | 100% Head Operator |
| **Local marketplace tx** | 0.5 ULTRA | 0 ADA | 50% Head Operator / 50% Bioregion |

### Settlement Transactions (Hydra → L1)

When Hydra heads settle to L1:

| Transaction Type | ULTRA Fee | ADA Cost | Where ULTRA Goes |
|------------------|-----------|----------|------------------|
| **Head open** | 10 ULTRA | ~1 ADA | 100% Treasury |
| **Head close/settle** | 5 ULTRA | ~0.5 ADA | 100% Treasury |
| **Batch settlement** | 2 ULTRA + 0.1/tx | ~0.5 ADA | 50% Validator / 50% Treasury |

---

## Fee Comparison: UltraLife vs Raw ADA

| Action | Raw ADA Cost | ULTRA Fee | Treasury ADA | Net User Cost |
|--------|--------------|-----------|--------------|---------------|
| Transfer tokens | ~$0.10 | 2 ULTRA | ~$0.10 | 2 ULTRA (~$0.002*) |
| Create offering | ~$0.15 | 5 ULTRA | ~$0.15 | 5 ULTRA (~$0.005*) |
| Complex contract | ~$0.50 | 10 ULTRA | ~$0.50 | 10 ULTRA (~$0.01*) |

*At hypothetical rate of 1 ULTRA = $0.001

**Key insight**: Users pay roughly the same in value, but in ULTRA instead of ADA. The treasury absorbs ADA costs, validators earn ULTRA.

---

## Validator Economics

### How Validators Earn

```
VALIDATOR INCOME STREAMS

1. TRANSACTION FEES (L1)
   ├── 50% of most transaction fees
   ├── Distributed proportionally to stake
   └── Paid in ULTRA

2. HYDRA HEAD OPERATION (L2)
   ├── 100% of in-head micro-fees
   ├── Goes to head operator
   └── Paid in ULTRA

3. STAKING REWARDS
   ├── Base APY from protocol inflation
   ├── Adjusted by uptime and performance
   └── Paid in ULTRA

4. SETTLEMENT PROCESSING
   ├── Share of batch settlement fees
   ├── Proportional to transactions validated
   └── Paid in ULTRA
```

### Example Validator Income

```
VALIDATOR: Sierra Nevada Node
Stake: 500,000 ULTRA
Uptime: 99.2%
Bioregion: Sierra Nevada

Monthly Income:
├── Transaction fees: 12,000 ULTRA
│   └── (50% of fees from 24,000 transactions)
├── Hydra head operation: 8,000 ULTRA
│   └── (Operating 3 local heads, 80,000 micro-txs)
├── Staking rewards: 2,500 ULTRA
│   └── (5% base APY on 500,000 stake)
└── TOTAL: 22,500 ULTRA/month

At $0.001/ULTRA = $22.50/month
At $0.01/ULTRA = $225/month
At $0.10/ULTRA = $2,250/month
```

---

## Treasury Economics

### Fee Subsidy Pool Sustainability

The treasury pays ADA for L1 fees. Is this sustainable?

```
FEE SUBSIDY ANALYSIS

Assumptions:
├── 100,000 L1 transactions/month
├── Average ADA cost: 0.3 ADA/tx
├── Total ADA needed: 30,000 ADA/month

Income to Treasury:
├── 50% of transaction fees: ~250,000 ULTRA/month
├── 100% of minting fees: ~50,000 ULTRA/month
├── Settlement fees: ~20,000 ULTRA/month
└── Total: ~320,000 ULTRA/month

If entry rate is 1 ADA = 1,000 ULTRA:
├── New entries needed: 30 ADA worth of entries
├── Per transaction equivalent
└── Very sustainable

If entry rate is 1 ADA = 100 ULTRA:
├── Treasury income: 320,000 ULTRA = 3,200 ADA value
├── ADA cost: 30,000 ADA
├── DEFICIT: Would need 26,800 ADA from reserves
└── Not sustainable at this rate
```

**Key insight**: The entry/exit rate must be calibrated so treasury ULTRA income covers ADA costs.

### Sustainable Rate Calculation

```
For sustainability:

Treasury ULTRA income × Exit Rate ≥ ADA fee costs

If ADA costs = 30,000 ADA/month
And ULTRA income = 320,000 ULTRA/month

Minimum exit rate: 30,000 / 320,000 = 0.09375 ADA per ULTRA
Or: ~10.67 ULTRA per ADA

At this rate, treasury breaks even on fees.
Higher volume = better economics (fees scale, ADA costs have efficiency gains).
```

---

## The Double Fee Question

You asked: Should we double fees compared to current ADA fees?

### Analysis

| Approach | Pros | Cons |
|----------|------|------|
| **Match ADA fees** | Competitive, easy to understand | Tight treasury margins |
| **2x ADA fees** | Sustainable treasury, better validator rewards | Users pay more |
| **Variable (market)** | Self-adjusting | Unpredictable for users |

### Recommendation: Slightly Higher Than ADA, With Hydra Discount

```
L1 FEES: ~1.5-2x raw ADA equivalent
├── Covers treasury ADA costs
├── Funds validator rewards
├── Maintains reserves
└── Still cheap in absolute terms

L2 FEES: ~0.1x of L1
├── Near-free for daily use
├── Encourages Hydra adoption
├── Head operators still earn
└── Settlement amortizes L1 costs
```

**Rationale**: 
- L1 is for "important" transactions (identity, offerings, settlements)
- L2 is for daily life (buying coffee, groceries, micro-payments)
- Making L2 nearly free drives adoption
- Making L1 slightly premium funds the network

---

## Complete Fee Schedule

### Identity & Registration

| Action | ULTRA Fee | Notes |
|--------|-----------|-------|
| Mint Basic pNFT | 10 ULTRA | One-time |
| Upgrade to Standard | 5 ULTRA | After DNA verification |
| Upgrade to Verified | 5 ULTRA | After residency proof |
| Upgrade to Steward | 10 ULTRA | After community endorsement |
| Recovery initiation | 20 ULTRA | Prevents spam |
| Recovery vouching | 0 ULTRA | Free to help someone |

### Marketplace (L1)

| Action | ULTRA Fee | Split |
|--------|-----------|-------|
| Create offering | 5 ULTRA | 50% validator / 50% bioregion |
| Update offering | 2 ULTRA | 50% validator / 50% bioregion |
| Cancel offering | 1 ULTRA | 100% validator |
| Accept offering | 5 ULTRA | 50% validator / 50% bioregion |
| Complete agreement | 2 ULTRA | 50% validator / 50% bioregion |
| Dispute initiation | 10 ULTRA | Held in escrow |

### Marketplace (L2 - Hydra)

| Action | ULTRA Fee | Split |
|--------|-----------|-------|
| Quick purchase | 0.5 ULTRA | 50% head operator / 50% bioregion |
| Micro-payment (<10 ULTRA) | 0.1 ULTRA | 100% head operator |
| Tip | 0 ULTRA | Free |

### Tokens & Transfers

| Action | ULTRA Fee | Split |
|--------|-----------|-------|
| L1 transfer | 2 ULTRA | 50% validator / 50% treasury |
| L2 transfer | 0.1 ULTRA | 100% head operator |
| L2 own-bucket transfer | 0 ULTRA | Free |
| Bulk transfer (>10 recipients) | 1 ULTRA + 0.5/recipient | 50/50 |

### Collectives

| Action | ULTRA Fee | Split |
|--------|-----------|-------|
| Create collective | 20 ULTRA | 50% validator / 50% treasury |
| Add member | 2 ULTRA | 100% collective treasury |
| Remove member | 2 ULTRA | 100% collective treasury |
| Collective proposal | 5 ULTRA | 100% collective treasury |
| Collective vote | 0 ULTRA | Free |

### Impact & Records

| Action | ULTRA Fee | Split |
|--------|-----------|-------|
| Record impact | 1 ULTRA | 50% validator / 50% impact fund |
| Verify impact (surveyor) | 5 ULTRA | 100% surveyor |
| Challenge impact | 10 ULTRA | Held in escrow |
| Buy impact credits | 1% of value | 100% to remediation pool |
| Sell impact credits | 1% of value | 50% validator / 50% bioregion |

### Governance

| Action | ULTRA Fee | Split |
|--------|-----------|-------|
| Create proposal | 10 ULTRA | 100% governance fund |
| Vote | 0 ULTRA | Free (democracy) |
| Delegate vote | 1 ULTRA | 100% treasury |

### UBI

| Action | ULTRA Fee | Split |
|--------|-----------|-------|
| Claim UBI | 0 ULTRA | Free (it's your right) |
| UBI auto-distribution | 0 ULTRA | Treasury covers |

### Staking & Validation

| Action | ULTRA Fee | Split |
|--------|-----------|-------|
| Register validator | 50 ULTRA | 100% treasury |
| Increase stake | 0 ULTRA | Free |
| Unstake (initiate) | 5 ULTRA | 100% treasury |
| Claim rewards | 0 ULTRA | Free |

### Hydra Operations

| Action | ULTRA Fee | Split |
|--------|-----------|-------|
| Open head | 10 ULTRA | 100% treasury |
| Join head | 2 ULTRA | 100% head operator |
| Leave head | 1 ULTRA | 100% head operator |
| Close/settle head | 5 ULTRA | 100% treasury |
| Batch settlement | 2 + 0.1/tx | 50% validator / 50% treasury |

---

## Fee Flow Diagram

```
USER TRANSACTION (L1)
        │
        ▼
┌───────────────────┐
│  ULTRA FEE PAID   │
│  (e.g., 5 ULTRA)  │
└───────────────────┘
        │
        ├──► 50% to VALIDATOR POOL (2.5 ULTRA)
        │         │
        │         └──► Distributed by stake weight
        │
        └──► 50% to BIOREGION/TREASURY (2.5 ULTRA)
                  │
                  └──► Local infrastructure, UBI, reserves

MEANWHILE:

┌───────────────────┐
│  TREASURY         │
│  Fee Subsidy Pool │
└───────────────────┘
        │
        ▼
   Pays ~0.3 ADA to Cardano L1
   (User never sees this)
```

```
USER TRANSACTION (L2 - Hydra)
        │
        ▼
┌───────────────────┐
│  ULTRA FEE PAID   │
│  (e.g., 0.5 ULTRA)│
└───────────────────┘
        │
        ├──► 50% to HEAD OPERATOR (0.25 ULTRA)
        │         │
        │         └──► Direct to operator pNFT
        │
        └──► 50% to BIOREGION (0.25 ULTRA)
                  │
                  └──► Local treasury

NO ADA COST (until settlement)

SETTLEMENT (periodic):
┌───────────────────┐
│  Batch of 1000 txs│
│  settles to L1    │
└───────────────────┘
        │
        ▼
   Treasury pays ~0.5 ADA
   Cost per tx: 0.0005 ADA
   (Amortized, very efficient)
```

---

## Summary

### User-Facing Fees

| Layer | Typical Fee | User Experience |
|-------|-------------|-----------------|
| **L1 (important stuff)** | 2-20 ULTRA | ~$0.01-0.10 equivalent |
| **L2 (daily stuff)** | 0-0.5 ULTRA | Nearly free |
| **UBI/Voting** | 0 ULTRA | Always free |

### Validator Earnings

| Source | Share | Volume-Dependent |
|--------|-------|------------------|
| L1 transaction fees | 50% | Yes |
| Hydra head operation | 100% of L2 | Yes |
| Staking rewards | Base APY | No |

### Treasury Sustainability

| Metric | Target |
|--------|--------|
| Fee income vs ADA costs | 1.5x coverage |
| Reserve ratio | 6 months fees |
| Entry/exit spread | 10-20% |

---

*"L1 for the important stuff, L2 for daily life, free for democracy and dignity."*
