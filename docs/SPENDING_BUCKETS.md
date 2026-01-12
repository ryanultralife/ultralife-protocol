# Hydra Spending Buckets

## Personal Finance on Cardano

Every pNFT can have **spending buckets** — pre-allocated funds for different purposes that operate inside Hydra heads for instant, feeless transactions.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  YOUR pNFT                                                                   │
│                                                                              │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │  Daily          │ │  Monthly        │ │  Emergency      │               │
│  │  Spending       │ │  Bills          │ │  Fund           │               │
│  │                 │ │                 │ │                 │               │
│  │  50 ULTRA/day   │ │  500 ULTRA/mo   │ │  1000 ULTRA     │               │
│  │                 │ │                 │ │  (locked)       │               │
│  │  Balance: 73    │ │  Balance: 312   │ │  Balance: 2847  │               │
│  │                 │ │                 │ │                 │               │
│  │  ✓ Rollover     │ │  ✗ Rollover     │ │  ✓ Rollover     │               │
│  │  Max: 100       │ │  Reset monthly  │ │  Max: 5000      │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
│                                                                              │
│  Total: 3,232 ULTRA across 3 buckets                                        │
│  Operating in: Sierra Nevada Hydra Head                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Why Buckets?

### Budget Discipline
- Can't overspend a category
- Separate purposes stay separate
- Clear visibility into where money goes

### Rollover Capability
- Unused daily spending accumulates
- Save up for larger purchases
- Emergency fund grows over time
- Caps prevent runaway accumulation

### Instant Spending
- Buckets operate in Hydra heads
- Transactions are instant (sub-second)
- No transaction fees within head
- Settlement to L1 batches multiple transactions

---

## How It Works

### Creating a Bucket

```
User: "Create a daily spending bucket with 50 ULTRA per day"

LLM: [Calls build_create_bucket]

Creating bucket:
- Type: Daily Spending
- Allocation: 50 ULTRA/day
- Rollover: Yes (up to 4 days = 200 ULTRA max)
- Initial funding: 50 ULTRA

Sign to create your spending bucket.
```

### Spending from a Bucket

```
User: "Pay Alice 15 ULTRA for coffee"

LLM: [In Hydra head, instant]

✓ Paid 15 ULTRA from Daily Spending
  - Previous balance: 73 ULTRA
  - New balance: 58 ULTRA
  - Recipient: Alice (pnft_alice...)
```

### Period Rollover

```
Midnight (automatic):

Daily Spending bucket:
- Yesterday's balance: 23 ULTRA (unused)
- Today's allocation: +50 ULTRA
- New balance: 73 ULTRA (capped at 100 max)

Monthly Bills bucket:
- End of month balance: 87 ULTRA (unused)
- No rollover configured
- New balance: 500 ULTRA (reset to full allocation)
```

---

## Bucket Templates

Pre-configured templates for common needs:

### Daily Spending
```
Allocation: 50 ULTRA/day
Rollover: Yes
Max Balance: 200 ULTRA (4 days)
Use: Coffee, lunch, small purchases
```

### Weekly Groceries
```
Allocation: 150 ULTRA/week
Rollover: No
Use: Food shopping, resets weekly
```

### Monthly Bills
```
Allocation: 500 ULTRA/month
Rollover: No
Use: Rent, utilities, subscriptions
```

### Emergency Fund
```
Allocation: 100 ULTRA/month
Rollover: Yes
Max Balance: 5,000 ULTRA
Min Balance: 1,000 ULTRA (can't go below)
Use: Emergencies only, builds over time
```

### Savings Goal
```
Allocation: Calculated to reach target
Rollover: Yes
Locked Until: Target date
Use: Vacation, large purchase, education
```

### Child Allowance
```
Allocation: 10 ULTRA/day
Rollover: No
Use: Kids can spend daily allowance, doesn't accumulate
```

### Business Expenses
```
Allocation: 1,000 ULTRA/month
Rollover: Yes (up to 3 months)
Categories: Restricted to business-related
Use: Work expenses, tracked separately
```

---

## Hydra Integration

### Why Hydra?

| Without Hydra | With Hydra |
|---------------|------------|
| ~20 second confirmation | Instant (<1 second) |
| ~0.17 ADA fee per tx | Zero fees in head |
| Every purchase hits L1 | Batch settlement |
| Limited throughput | Unlimited in head |

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│  HYDRA HEAD (Bioregion-local)                                   │
│                                                                  │
│  Your Buckets ←→ Local Merchants ←→ Other pNFTs                 │
│                                                                  │
│  All transactions instant and free                              │
└─────────────────────────────────────────────────────────────────┘
         │
         │ Daily/Weekly settlement
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  CARDANO L1                                                      │
│                                                                  │
│  Final state recorded                                            │
│  One transaction = hundreds of bucket spends                    │
└─────────────────────────────────────────────────────────────────┘
```

### Enter Hydra

When you enter a Hydra head:
1. Your bucket state is locked on L1
2. State transitions happen off-chain in the head
3. Spend instantly from any bucket
4. All participants see consistent state

### Exit Hydra

When you exit (or head closes):
1. Final bucket states are settled to L1
2. One L1 transaction captures all activity
3. Your updated balances are on-chain
4. Ready to enter another head or transact on L1

---

## Security Features

### Can't Overspend
- Bucket enforces balance limits
- Period allocation caps spending rate
- Min balance protects emergency funds

### Category Restrictions
- Business bucket only for business vendors
- Groceries bucket only for food merchants
- Verified by recipient's category registration

### Locked Funds
- Savings goals locked until target date
- Emergency fund minimum can't be touched
- Emergency withdrawal possible but penalized (10%)

### Emergency Withdrawal
If you absolutely need funds from a locked bucket:
```
Emergency withdraw 500 ULTRA from Emergency Fund

WARNING: 10% penalty applies
- Withdraw: 500 ULTRA
- Penalty: 50 ULTRA (to bioregion treasury)
- You receive: 450 ULTRA

Confirm emergency withdrawal?
```

---

## Example: A Day in the Life

### Morning
```
7:30 AM - Coffee
Bucket: Daily Spending
Amount: 8 ULTRA
Balance: 50 → 42 ULTRA
[Instant in Hydra head]
```

### Midday
```
12:15 PM - Lunch
Bucket: Daily Spending
Amount: 25 ULTRA
Balance: 42 → 17 ULTRA
[Instant in Hydra head]
```

### Afternoon
```
3:00 PM - Groceries
Bucket: Weekly Groceries
Amount: 67 ULTRA
Balance: 150 → 83 ULTRA
[Instant in Hydra head]
```

### Evening
```
6:00 PM - Rent payment
Bucket: Monthly Bills
Amount: 400 ULTRA
Balance: 500 → 100 ULTRA
[Settled to L1 - larger transaction]
```

### End of Day
```
11:59 PM - Rollover
Daily Spending: 17 ULTRA unused
Next day allocation: +50 ULTRA
New balance: 67 ULTRA
```

---

## For Developers

### Bucket Datum

```aiken
pub type BucketState {
  config: BucketConfig,
  balance: Int,
  period_start: Int,
  spent_this_period: Int,
  total_spent: Int,
  last_activity: Int,
}

pub type BucketConfig {
  bucket_id: ByteArray,
  allocation: Int,
  period: BucketPeriod,
  rollover: Bool,
  max_balance: Int,
  min_balance: Int,
  allowed_categories: List<ByteArray>,
  locked_until: Int,
}
```

### Redeemers

```aiken
pub type BucketRedeemer {
  CreateBucket { config, initial_funding }
  FundBucket { bucket_id, amount }
  Spend { bucket_id, amount, recipient, purpose }
  AdvancePeriod { bucket_id }
  TransferBetweenBuckets { from, to, amount }
  CloseBucket { bucket_id }
  EnterHydra { head_id }
  ExitHydra { final_state }
  EmergencyWithdraw { amount, reason }
}
```

### MCP Tools

```
build_create_bucket     - Create new spending bucket
build_fund_bucket       - Add funds to bucket
build_spend_bucket      - Spend from bucket
build_advance_period    - Trigger rollover (permissionless)
build_transfer_buckets  - Move between buckets
build_close_bucket      - Close and withdraw bucket
```

---

## Summary

| Feature | Benefit |
|---------|---------|
| **Buckets** | Organize spending by purpose |
| **Periods** | Daily/weekly/monthly allocations |
| **Rollover** | Unused funds accumulate (optional) |
| **Caps** | Prevent over-accumulation |
| **Hydra** | Instant, feeless transactions |
| **Settlement** | Batch to L1 for efficiency |
| **Templates** | Easy setup for common patterns |
| **Security** | Locks, minimums, category restrictions |

**Your money. Your rules. Instant spending.**
