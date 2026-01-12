# UltraLife Protocol System Alignment

## Complete System Map

This document maps all 27 validators to their TypeScript types, MCP tools, and documentation.

---

## Validators → Types → Tools → Docs

### Identity Layer

| Validator | Aiken File | TypeScript Types | MCP Tools | Documentation |
|-----------|------------|------------------|-----------|---------------|
| **pnft** | `pnft.ak` | `PnftDatum`, `PnftRedeemer`, `VerificationLevel` | `get_pnft`, `get_pnft_by_address`, `list_pnfts`, `build_mint_pnft` | `ONBOARDING.md`, `COLLECTIVES_AND_RECOVERY.md` |
| **recovery** | `recovery.ak` | `PnftRedeemer.InitiateRecovery`, `PnftRedeemer.CompleteRecovery` | (via pnft tools) | `COLLECTIVES_AND_RECOVERY.md` |

### Token Layer

| Validator | Aiken File | TypeScript Types | MCP Tools | Documentation |
|-----------|------------|------------------|-----------|---------------|
| **token** | `token.ak` | `token_policy`, `token_spend` | `get_token_balance`, `build_transfer_tokens` | `ECONOMIC_MODEL.md` |
| **treasury** | `treasury.ak` | `TreasuryDatum`, `EpochQueue`, `TreasuryRedeemer` | `get_token_price`, `simulate_purchase`, `get_treasury_status`, `get_founder_status`, `build_purchase_tokens` | `TOKEN_DISTRIBUTION.md`, `EXTERNAL_VALUE_FLOW.md` |

### Marketplace Layer

| Validator | Aiken File | TypeScript Types | MCP Tools | Documentation |
|-----------|------------|------------------|-----------|---------------|
| **marketplace** | `marketplace.ak` | `Offering`, `WhatOffered`, `Terms`, `LocationScope`, `TimeScope` | `list_offerings`, `get_offering`, `build_create_offering`, `build_accept_offering` | `UNIVERSAL_FRAMEWORK.md`, `PUT_YOUR_LIFE_ONLINE.md` |
| **work_auction** | `work_auction.ak` | `Need`, `WhatNeeded`, `Budget`, `Agreement` | `list_needs`, `get_need` | `UNIVERSAL_FRAMEWORK.md` |

### Records & Registry Layer

| Validator | Aiken File | TypeScript Types | MCP Tools | Documentation |
|-----------|------------|------------------|-----------|---------------|
| **records** | `records.ak` | `ActivityRecord`, `TransactionType` | (via other tools) | `IMPACT_COMPOUNDS.md` |
| **registry** | `registry.ak` | `RegistryEntry`, `RegistryAuthority`, `RegistryStatus`, `CategoryRef` | (internal) | `UNIVERSAL_FRAMEWORK.md` |
| **memory** | `memory.ak` | (Living Memory Framework) | (internal) | `IMPLEMENTATION_SPEC.md` |

### Bioregion & Land Layer

| Validator | Aiken File | TypeScript Types | MCP Tools | Documentation |
|-----------|------------|------------------|-----------|---------------|
| **bioregion** | `bioregion.ak` | `BioregionIndex`, `IndexValue` | `list_bioregions`, `get_bioregion` | `UNIVERSAL_FRAMEWORK.md`, `WHAT_IT_DOES.md` |
| **land_rights** | `land_rights.ak` | (LandNFT types) | (future tools) | `PUT_YOUR_LIFE_ONLINE.md` |
| **commons** | `commons.ak` | (Commons types) | (future tools) | `UNIVERSAL_FRAMEWORK.md` |

### Staking & Governance Layer

| Validator | Aiken File | TypeScript Types | MCP Tools | Documentation |
|-----------|------------|------------------|-----------|---------------|
| **stake_pool** | `stake_pool.ak` | `Stake`, `StakeTarget`, `StakeReturns` | (future tools) | `VALIDATOR_NETWORK.md` |
| **governance** | `governance.ak` | (Governance types) | (future tools) | `ECONOMIC_MODEL.md` |
| **ubi** | `ubi.ak` | (UBI types) | (future tools) | `ECONOMIC_MODEL.md` |

### Impact Layer

| Validator | Aiken File | TypeScript Types | MCP Tools | Documentation |
|-----------|------------|------------------|-----------|---------------|
| **impact** | `impact.ak` | `CompoundFlow`, `CompoundBalance`, `ImpactDestination` | (via other tools) | `IMPACT_COMPOUNDS.md` |
| **impact_market** | `impact_market.ak` | (Impact market types) | (future tools) | `IMPACT_COMPOUNDS.md`, `COMPARATIVE_VALUE.md` |
| **asset_impact** | `asset_impact.ak` | `ActivityRecord` | (via other tools) | `IMPACT_COMPOUNDS.md` |
| **remediation** | `remediation.ak` | (Remediation types) | (future tools) | `IMPACT_COMPOUNDS.md` |
| **preservation** | `preservation.ak` | (Preservation types) | (future tools) | `IMPACT_COMPOUNDS.md` |

### Collectives & Care Layer

| Validator | Aiken File | TypeScript Types | MCP Tools | Documentation |
|-----------|------------|------------------|-----------|---------------|
| **collective** | `collective.ak` | `Collective` | `list_collectives`, `get_collective`, `build_create_collective`, `build_add_collective_member` | `COLLECTIVES_AND_RECOVERY.md` |
| **care** | `care.ak` | (Care types) | (future tools) | `UNIVERSAL_FRAMEWORK.md` |

### Infrastructure Layer

| Validator | Aiken File | TypeScript Types | MCP Tools | Documentation |
|-----------|------------|------------------|-----------|---------------|
| **energy** | `energy.ak` | (Energy types) | (future tools) | `CARDANO_SCALING_INTEGRATION.md` |
| **grants** | `grants.ak` | (Grants types) | (future tools) | `ECONOMIC_MODEL.md` |
| **genesis** | `genesis.ak` | (Genesis types) | (internal - deployment only) | `DEPLOYMENT.md` |

### Hydra Layer

| Validator | Aiken File | TypeScript Types | MCP Tools | Documentation |
|-----------|------------|------------------|-----------|---------------|
| **spending_bucket** | `spending_bucket.ak` | `BucketConfig`, `BucketState`, `SpendingBucketDatum`, `BucketPeriod`, `BucketTemplate` | `list_buckets`, `get_bucket`, `build_create_bucket`, `build_fund_bucket`, `build_spend_bucket`, `build_transfer_between_buckets` | `SPENDING_BUCKETS.md` |
| **ultralife_validator** | `ultralife_validator.ak` | `UltraLifeValidatorDatum`, `ValidatorStatus` | (future tools) | `VALIDATOR_NETWORK.md`, `FEE_STRUCTURE.md` |
| **fee_pool** | (in ultralife_validator.ak) | `FeePoolDatum` | (future tools) | `VALIDATOR_NETWORK.md`, `FEE_STRUCTURE.md` |

---

## MCP Tools Summary

### Currently Implemented (25 tools)

**Information**
- `get_ultralife_info` - Protocol concepts
- `get_protocol_stats` - Overall statistics

**Identity (pNFT)**
- `get_pnft` - Get pNFT by ID
- `get_pnft_by_address` - Find pNFT by wallet
- `get_token_balance` - Token balance
- `list_pnfts` - List with filters
- `build_mint_pnft` - Create pNFT

**Bioregions**
- `list_bioregions` - All bioregions
- `get_bioregion` - Bioregion details

**Marketplace**
- `list_offerings` - Offerings with filters
- `get_offering` - Offering details
- `list_needs` - Needs with filters
- `get_need` - Need details
- `build_create_offering` - Create offering
- `build_accept_offering` - Accept offering

**Collectives**
- `list_collectives` - List collectives
- `get_collective` - Collective details
- `build_create_collective` - Create collective
- `build_add_collective_member` - Add member

**Tokens**
- `build_transfer_tokens` - Transfer tokens
- `build_purchase_from_pool` - Buy from dev pool

**Spending Buckets**
- `list_buckets` - List all buckets
- `get_bucket` - Bucket details
- `build_create_bucket` - Create bucket
- `build_fund_bucket` - Add funds
- `build_spend_bucket` - Spend from bucket
- `build_transfer_between_buckets` - Move between buckets

### Future Tools (Phase 2)

- Staking tools (`build_stake`, `build_unstake`, `claim_rewards`)
- Impact tools (`get_impact_history`, `build_offset_impact`)
- Governance tools (`build_proposal`, `build_vote`)
- UBI tools (`claim_ubi`)
- Validator tools (`build_register_validator`, `claim_validator_fees`)
- Care tools (`build_care_credit`, `transfer_care`)

---

## Data Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER                                             │
│                    "Create a daily spending bucket"                          │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  LLM (via MCP)                                                                │
│                                                                               │
│  Calls: build_create_bucket                                                   │
│  Params: { pnft_id, name: "Daily", template: "daily_spending" }             │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  MCP SERVER (src/mcp/index.ts)                                               │
│                                                                               │
│  Routes to: buildCreateBucket()                                              │
│  Uses: TypeScript types from src/types/index.ts                             │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  TX BUILDER (src/builder/index.ts)                                           │
│                                                                               │
│  Builds: SpendingBucketDatum                                                 │
│  References: spending_bucket reference script                                │
│  Returns: Unsigned CBOR transaction                                          │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  INDEXER (src/indexer/index.ts)                                              │
│                                                                               │
│  Queries: Blockfrost API                                                     │
│  Decodes: On-chain datums                                                    │
│  Returns: Typed data                                                         │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  CARDANO (via Blockfrost/Node)                                               │
│                                                                               │
│  Reference Scripts: All 27 validators deployed                               │
│  UTxOs: Protocol state                                                       │
│  Validation: spending_bucket.ak                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Validator Dependencies

```
                    ┌─────────────┐
                    │   genesis   │ (deploys everything)
                    └─────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │    pnft     │ │    token    │ │  bioregion  │
    └─────────────┘ └─────────────┘ └─────────────┘
           │               │               │
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  recovery   │ │  treasury   │ │ land_rights │
    └─────────────┘ └─────────────┘ └─────────────┘
           │               │               │
           ▼               ▼               ▼
    ┌─────────────────────────────────────────────┐
    │                 collective                   │
    │   (pNFTs + resources + governance)          │
    └─────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │ marketplace │ │ work_auction│ │    care     │
    └─────────────┘ └─────────────┘ └─────────────┘
           │               │               │
           ▼               ▼               ▼
    ┌─────────────────────────────────────────────┐
    │                  records                     │
    │   (all transactions recorded)                │
    └─────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │   impact    │ │asset_impact │ │   memory    │
    └─────────────┘ └─────────────┘ └─────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │              impact_market                   │
    │   (compound trading)                         │
    └─────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │remediation  │ │preservation │ │   commons   │
    └─────────────┘ └─────────────┘ └─────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │                stake_pool                    │
    │   (bioregion economic health)                │
    └─────────────────────────────────────────────┘
                           │
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │     ubi     │ │ governance  │ │   grants    │
    └─────────────┘ └─────────────┘ └─────────────┘
                           │
                           ▼
    ┌─────────────────────────────────────────────┐
    │  HYDRA LAYER (L2)                            │
    ├─────────────┬─────────────┬─────────────────┤
    │spending_    │ultralife_   │fee_pool         │
    │bucket       │validator    │                 │
    └─────────────┴─────────────┴─────────────────┘
```

---

## File Counts

| Component | Count | Lines |
|-----------|-------|-------|
| Aiken Validators | 27 | ~25,000 |
| Aiken Types/Libs | 6 | ~5,000 |
| Aiken Tests | 5 | ~2,000 |
| TypeScript Service | 7 | ~3,500 |
| Documentation | 32 | ~15,000 |
| **Total** | **77** | **~50,000** |

---

## Deployment Order

1. **Genesis** - Deploy reference scripts
2. **Token** - Mint initial supply
3. **pNFT** - Enable identity creation
4. **Bioregion** - Create initial bioregions
5. **Collective** - Enable organizations
6. **Marketplace/Work Auction** - Enable commerce
7. **Records/Registry** - Enable tracking
8. **Impact/Asset Impact** - Enable impact recording
9. **Stake Pool/UBI** - Enable staking and UBI
10. **Spending Bucket** - Enable Hydra personal finance
11. **Ultralife Validator** - Enable ULTRA-native validation

---

## Testing Checklist

### Phase 1: Core Identity
- [ ] Mint pNFT with simulated DNA
- [ ] Upgrade pNFT level
- [ ] Transfer tokens between pNFTs
- [ ] Create collective
- [ ] Add member to collective

### Phase 2: Marketplace
- [ ] Create offering
- [ ] List offerings by bioregion
- [ ] Accept offering (create agreement)
- [ ] Complete agreement
- [ ] Record impact compounds

### Phase 3: Spending Buckets
- [ ] Create daily spending bucket
- [ ] Fund bucket
- [ ] Spend from bucket
- [ ] Advance period (test rollover)
- [ ] Transfer between buckets

### Phase 4: Validation
- [ ] Register as UltraLife validator
- [ ] Stake ULTRA
- [ ] Earn fees
- [ ] Fee pool operation

---

## Gap Analysis

### Implemented ✅
- All 27 validators
- Core TypeScript types
- 25 MCP tools
- Indexer for main entities
- Transaction builder for core operations
- Comprehensive documentation

### Needs Implementation 🔧
- Bucket builder methods in builder/index.ts
- Bucket indexer methods in indexer/index.ts
- Validator network tools
- Impact tools
- Governance tools
- UBI claim tools

### Future Phases 📋
- Hydra head integration
- Leios input endorser integration
- Starstream privacy layer
- Cross-bioregion settlement
- Partner chain evaluation
