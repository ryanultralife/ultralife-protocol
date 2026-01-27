# UltraLife Protocol

**Management Software for Life on Earth**

*"The bar for participation is: can you talk?"*

Built on Cardano | 27 Aiken Validators | Plutus V3 | LLM Interface

---

## Status: Testnet Deployment Phase

> **Development Complete** — All 27 validators, 33 documentation files, and MCP service fully implemented.
> Now deploying to Cardano Preview Testnet.

| Milestone | Status |
|-----------|--------|
| Protocol Design | ✅ Complete |
| Validator Implementation (27) | ✅ Complete |
| Type System & Libraries | ✅ Complete |
| MCP Service (31 tools) | ✅ Complete |
| Documentation (33 files) | ✅ Complete |
| Testnet Deployment | 🔄 In Progress |
| Mainnet Launch | ⏳ Pending |

**Next Steps:**
1. Deploy reference scripts to Preview Testnet
2. Configure policy IDs and script addresses
3. Seed initial bioregions and genesis pNFTs
4. Community testing and feedback

---

## Overview

UltraLife Protocol is a regenerative economics system where:
- Every person has a permanent, DNA-verified identity (pNFT)
- Every transaction measures environmental impact in chemical compounds
- Every consumer accrues the full impact of their consumption
- Every bioregion operates with local governance and UBI
- Every interaction flows through conversation, not applications

**Key Stats:**
- 27 Smart Contracts (Aiken validators)
- 400 billion token single pool
- 37-day governance cycles
- Compound-based impact tracking (Carbon, Nitrogen, Sulfur, Water, Phosphorus, Particulates, Metals)

---

## Quick Start

```bash
# Build contracts
cd contracts && aiken build

# Run tests
aiken check

# Run MCP service
cd service && npm install && npm start

# Connect your LLM
# Add MCP server to Claude Desktop or similar
```

**Developer Guides:**
- [Getting Started](docs/GETTING_STARTED.md) - Developer onboarding
- [Architecture](docs/ARCHITECTURE.md) - System design overview
- [API Reference](docs/API.md) - Transaction formats and endpoints

---

## Documentation

### Start Here

| # | Document | What You'll Learn |
|---|----------|-------------------|
| 1 | [The Invisible Interface](docs/INVISIBLE_INTERFACE.md) | No app, no UI - just conversation with any LLM |
| 2 | [What It Does](docs/WHAT_IT_DOES.md) | Complete system overview |
| 3 | [Put Your Life Online](docs/PUT_YOUR_LIFE_ONLINE.md) | List skills, products, land rights |
| 4 | [Shopping Experience](docs/SHOPPING_EXPERIENCE.md) | Buy local through conversation |
| 5 | [Comparative Value](docs/COMPARATIVE_VALUE.md) | How transparent pricing works |

### Core Concepts

| Document | Description |
|----------|-------------|
| [Onboarding](docs/ONBOARDING.md) | How to join, verification levels |
| [Collectives & Recovery](docs/COLLECTIVES_AND_RECOVERY.md) | Organizations, identity recovery |
| [Spending Buckets](docs/SPENDING_BUCKETS.md) | Personal finance, Hydra L2 |
| [Universal Framework](docs/UNIVERSAL_FRAMEWORK.md) | The six interactions |
| [Impact Compounds](docs/IMPACT_COMPOUNDS.md) | Chemical compound tracking |
| [Machinery Impact](docs/MACHINERY_IMPACT.md) | Vehicles, equipment, embodied vs operational |
| [Sharing Economy](docs/SHARING_ECONOMY.md) | Turo, Airbnb, Uber, Upwork built-in |
| [Fortune 500 Disruption](docs/FORTUNE_500_DISRUPTION.md) | $6T market cap made obsolete |
| [Transparency Replaces Certification](docs/TRANSPARENCY_CERTIFICATION.md) | $50B/year in verification eliminated |

### Economics

| Document | Description |
|----------|-------------|
| [Token Distribution](docs/TOKEN_DISTRIBUTION.md) | Bonding curve ($1/400B to $1), epoch settlement |
| [Fee Structure](docs/FEE_STRUCTURE.md) | L1/L2 fees, validator rewards |
| [External Value Flow](docs/EXTERNAL_VALUE_FLOW.md) | ADA/BTC treasury, founder compensation |
| [Economic Model](docs/ECONOMIC_MODEL.md) | 400B single pool, UBI, impact markets |
| [Validator Network](docs/VALIDATOR_NETWORK.md) | ULTRA staking, bioregion validation |

### Technical

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System design and validator interactions |
| [API Reference](docs/API.md) | Transaction formats and endpoints |
| [Getting Started](docs/GETTING_STARTED.md) | Developer onboarding guide |
| [System Alignment](docs/SYSTEM_ALIGNMENT.md) | All 27 validators mapped |
| [Implementation Spec](docs/IMPLEMENTATION_SPEC.md) | Architecture details |
| [Cardano Scaling](docs/CARDANO_SCALING_INTEGRATION.md) | Hydra, Leios, Starstream |
| [L2 Scaling Menu](docs/L2_SCALING_MENU.md) | Pluggable L2s (Hydra, Hydrozoa, future) |
| [L2 Security: pNFT Termination](docs/L2_SECURITY_PNFT.md) | Every L2 tx must end at verified pNFT |
| [Fraud Analysis](docs/FRAUD_ANALYSIS.md) | Attack vectors, mitigations, residual risks |
| [Oracle Specification](docs/ORACLE_SPECIFICATION.md) | Real-world data feeds |
| [Deployment](docs/DEPLOYMENT.md) | How to deploy to mainnet |
| [SPO Quick Brief](docs/SPO_QUICK_BRIEF.md) | For technical testers |

---

## The 27 Validators

### Identity Layer

| Validator | File | Purpose |
|-----------|------|---------|
| **pNFT** | `pnft.ak` | One-per-human DNA-verified identity. Cannot be transferred. Foundation for all participation. Supports 5 verification levels: Basic, Ward, Standard, Verified, Steward. |
| **Recovery** | `recovery.ak` | 3-layer identity recovery: Social (guardians), DNA (lab workers), Bioregion Stewards. Human-vouches-for-human model. |

### Geographic Layer

| Validator | File | Purpose |
|-----------|------|---------|
| **Bioregion** | `bioregion.ak` | Ecological boundaries (not political). Tracks resident count, health index (0-100%), treasury, creation slot. Creates bioregion beacons for proof of residency. |
| **Land Rights** | `land_rights.ak` | Separates land rights: surface, subsurface, water, air, cellulose, carbon. No ownership—only stewardship. Revenue sharing: 70% steward, 20% bioregion, 10% right holder. |
| **Commons** | `commons.ak` | Public goods: infrastructure, emergency services, public spaces, utilities, healthcare, education. Funded by bioregion treasury, operated by collectives. |

### Economy Core

| Validator | File | Purpose |
|-----------|------|---------|
| **Token** | `token.ak` | Every transaction requires: valid pNFT, bioregion assignment, transaction type, impact declaration, valid recipient, evidence hash. No anonymous transfers. |
| **Treasury** | `treasury.ak` | External value bridge (ADA/BTC to UltraLife). Quadratic bonding curve: price = n/400B USD. Asymmetric pricing: buy at market, sell at 90%. |
| **Grants** | `grants.ak` | Bootstrap grants: 50 tokens per DNA-verified user from main 400B pool. Immediate settlement. Prevents double claims. |

### Marketplace & Work

| Validator | File | Purpose |
|-----------|------|---------|
| **Marketplace** | `marketplace.ak` | Listings for products (with impact disclosure), services, work capacity, asset sales/rentals. All listings require pNFT verification. |
| **Work Auction** | `work_auction.ak` | Work request auctions. Requesters specify work, budget, expected impacts. Workers bid with price, compound flows, timeline, certifications. Escrow system. |
| **Records** | `records.ak` | Accumulates transaction records into cycle aggregations: AvatarCycleStats (per-person) and BioregionCycleStats (per-bioregion). Drives UBI calculations. |

### Governance & Distribution

| Validator | File | Purpose |
|-----------|------|---------|
| **Governance** | `governance.ak` | Bioregional democracy with 37-day voting cycles. Proposal types: Budget, Policy, Emergency, Constitutional. Thresholds: 37% quorum, 50% majority, 63% supermajority. |
| **UBI** | `ubi.ak` | 100% funded from transaction fees. No accrual, no separate pool. Pool divided by engagement weight each epoch. Dynamic fee adjustment (30-70%) maintains target. Survival floor: 20 tokens. |
| **Genesis** | `genesis.ak` | Solves bootstrap problem. Founding founders have temporary powers during genesis for DNA verification, steward endorsement, bioregion bootstrap. |

### Impact & Remediation

| Validator | File | Purpose |
|-----------|------|---------|
| **Impact** | `impact.ak` | Verified environmental action tokens. Categories: Carbon, Water, Biodiversity, Soil, Air, Waste, Energy, Land Use. Compound-based measurement. |
| **Impact Market** | `impact_market.ak` | True market for planetary consequence. Regenerators SELL verified positive impacts. Extractors BUY offsets or fund remediation. Market-determined pricing. |
| **Remediation** | `remediation.ak` | Bonds for negative impact commitments. Poster provides bond amount, deadline, remediation magnitude. Bonds can be released, slashed, or completed. |
| **Asset Impact** | `asset_impact.ak` | Compounds flow to assets through lifecycle. Worker performs work and compounds recorded to asset. Consumer purchases asset and all accumulated compounds transfer to consumer. |

### Conservation & Stewardship

| Validator | File | Purpose |
|-----------|------|---------|
| **Preservation** | `preservation.ak` | Ecosystem stewardship. Certified surveyors document ecosystem health. Land stewards receive preservation grants for maintaining/restoring. Multiple surveyor cross-verification. |
| **Stake Pool** | `stake_pool.ak` | Bioregional economic infrastructure. Validators register pools with specific bioregions. Accept ULTRA delegations. Economic indicator per bioregion. |

### Organizations & Communities

| Validator | File | Purpose |
|-----------|------|---------|
| **Collective** | `collective.ak` | Business as pNFT configuration. Multiple pNFTs coordinate around shared resources. Governance weight configurable. Solo spending limits. No separate corporate entity. |
| **Care** | `care.ak` | Recognizes invisible labor: childcare, elder care, household management, community service. Boosts UBI calculations. Community-based verification. |

### Registry & Memory

| Validator | File | Purpose |
|-----------|------|---------|
| **Registry** | `registry.ak` | Hierarchical classification system. Root to Categories to Subcategories. Taxonomy emerges organically from specialist use. Community-governed. |
| **Memory** | `memory.ak` | Collective understanding registry. Interpretations marked with resonance score. When 37+ interpretations resonate, emergence occurs. Vitality decreases without resonance. |

### Infrastructure & Special Purpose

| Validator | File | Purpose |
|-----------|------|---------|
| **Energy** | `energy.ak` | Tracks energy from source to sink. Sources: Solar, Wind, Hydro, Geothermal, Biomass, Natural Gas (penalized), Coal (heavily penalized), Nuclear, Battery. |
| **Spending Bucket** | `spending_bucket.ak` | Personal finance layer. Pre-allocated funds by purpose (daily, monthly, emergency). Operates inside Hydra heads. Settles to L1 in batches. |
| **UltraLife Validator** | `ultralife_validator.ak` | Framework for validators to operate in UltraLife tokens. Options: Fee Subsidy Pool, Hydra UltraLife Heads, Partner Chain. |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  YOU: "I want to sell eggs from my farm"                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LLM (Claude, GPT, any) → MCP Server → Builds Transaction       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  YOUR WALLET: Review & Sign                                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  CARDANO: Validators enforce rules, transaction recorded        │
└─────────────────────────────────────────────────────────────────┘
```

**LLM = convenience layer (can build, can't sign)**
**Wallet = security layer (you control keys)**
**Chain = truth layer (validators enforce rules)**

---

## Key Principles

- **One identity per human** — DNA-verified pNFT, permanent
- **Every transaction has impact** — Tracked in chemical compounds
- **Bioregions not borders** — Organized by ecology, not politics
- **Consumer accrues impact** — Your demand drives the chain
- **Invisible infrastructure** — Technology disappears, just talk
- **No chokepoints** — Decentralized at every layer

---

## The Core Mechanism: Consumer Accrual

```
Worker performs work → compounds recorded to ASSET
                    ↓
        Consumer purchases ASSET
                    ↓
    ALL accumulated compounds transfer to CONSUMER
                    ↓
        Consumer is now ACCOUNTABLE
```

This makes **consumer demand drive accountability**—the inverse of traditional supply chains where workers carry all environmental cost.

---

## Why 37?

The number 37 appears throughout the protocol:
- **37-day cycles** — Cannot be gamed by calendar alignment (prime number)
- **37% quorum** — Minimum participation for valid governance
- **37 interpretations** — Threshold for emergence in memory
- **37 smoothing samples** — Statistical averaging

---

## Project Structure

```
ultralife-protocol/
├── contracts/
│   ├── validators/         # 27 Aiken smart contracts
│   ├── lib/ultralife/      # Shared types and helpers
│   │   ├── types.ak        # Core type definitions
│   │   ├── helpers.ak      # Common utilities
│   │   └── prc37.ak        # 37-day cycle functions
│   ├── tests/              # Test suites
│   └── aiken.toml          # Aiken configuration
├── docs/                   # 30+ documentation files
├── service/                # MCP service for LLM integration
│   ├── indexer/            # Read chain state via Blockfrost
│   ├── builder/            # Construct unsigned transactions
│   └── mcp/                # 31 tools for LLM interaction
├── scripts/                # Deployment/utility scripts
└── README.md               # This file
```

---

## MCP Service

| Component | Purpose |
|-----------|---------|
| Indexer | Read chain state via Blockfrost |
| Builder | Construct unsigned transactions |
| MCP Server | 31 tools for LLM interaction |

---

## Economic Parameters

| Parameter | Value |
|-----------|-------|
| Total Supply | 400 billion tokens |
| Cycle Duration | 37 days (3,196,800 slots) |
| Grant per User | 50 tokens |
| Quorum | 37% |
| Majority | 50% |
| Supermajority | 63% |
| Resonance Threshold | 37 interpretations |
| Base UBI | 100 tokens per cycle |
| Sell Discount | 90% of buy price |

---

## License

MIT

## Author

Ryan — Protocol Architecture & Design
- Founder compensation: $10,000/month since January 2020
- Algorithmic rate at time of each accrual
- [Details](docs/EXTERNAL_VALUE_FLOW.md)

---

*"The bar for participation is: can you talk?"*
