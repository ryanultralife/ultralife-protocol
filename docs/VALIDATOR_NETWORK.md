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
