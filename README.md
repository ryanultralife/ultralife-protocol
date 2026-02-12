# UltraLife Protocol

**Management Software for Life on Earth**

*"The bar for participation is: can you talk?"*

Built on Cardano • 34 Aiken Validators • LLM Interface

**[Testnet Status: Live on Preprod](docs/TESTNET_STATUS.md)** | [Quick Start](docs/NASEC_TESTNET_GUIDE.md) | [LLM Agent Guide](docs/LLM_AGENT_GUIDE.md)

---

## Start Here

| # | Document | What You'll Learn |
|---|----------|-------------------|
| 1 | [The Invisible Interface](docs/INVISIBLE_INTERFACE.md) | No app, no UI - just conversation with any LLM |
| 2 | [What It Does](docs/WHAT_IT_DOES.md) | Complete system overview |
| 3 | [Put Your Life Online](docs/PUT_YOUR_LIFE_ONLINE.md) | List skills, products, land rights |
| 4 | [Shopping Experience](docs/SHOPPING_EXPERIENCE.md) | Buy local through conversation |
| 5 | [Comparative Value](docs/COMPARATIVE_VALUE.md) | How transparent pricing works |

---

## Core Concepts

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

---

## Economics

| Document | Description |
|----------|-------------|
| [Token Distribution](docs/TOKEN_DISTRIBUTION.md) | Bonding curve ($1/400B→$1), epoch settlement, founder ($10k/month) |
| [Fee Structure](docs/FEE_STRUCTURE.md) | L1/L2 fees, validator rewards |
| [External Value Flow](docs/EXTERNAL_VALUE_FLOW.md) | ADA/BTC treasury, founder compensation |
| [Economic Model](docs/ECONOMIC_MODEL.md) | 400B single pool, UBI, impact markets |
| [Validator Network](docs/VALIDATOR_NETWORK.md) | ULTRA staking, bioregion validation |

---

## Technical

| Document | Description |
|----------|-------------|
| [System Alignment](docs/SYSTEM_ALIGNMENT.md) | All 27 validators mapped |
| [Implementation Spec](docs/IMPLEMENTATION_SPEC.md) | Architecture details |
| [Cardano Scaling](docs/CARDANO_SCALING_INTEGRATION.md) | Hydra, Leios, Starstream |
| [L2 Scaling Menu](docs/L2_SCALING_MENU.md) | Pluggable L2s (Hydra, Hydrozoa, future) |
| [L2 Security: pNFT Termination](docs/L2_SECURITY_PNFT.md) | Every L2 tx must end at verified pNFT |
| [Fraud Analysis](docs/FRAUD_ANALYSIS.md) | Attack vectors, mitigations, residual risks |
| [Philosophical Comparison](docs/PHILOSOPHICAL_COMPARISON.md) | UltraLife vs. Haldeman & Technocracy |
| [LLM Security Model](docs/LLM_SECURITY_MODEL.md) | Why conversation interface is secure |
| [Oracle Specification](docs/ORACLE_SPECIFICATION.md) | Real-world data feeds |
| [Deployment](docs/DEPLOYMENT.md) | How to deploy to mainnet |
| [SPO Quick Brief](docs/SPO_QUICK_BRIEF.md) | For technical testers |

---

## The System

### 34 Smart Contracts (Deployed on Preprod)

| Category | Validators |
|----------|------------|
| **Identity** | pnft, recovery |
| **Token** | token, treasury |
| **Marketplace** | marketplace, work_auction |
| **Records** | records, registry, memory |
| **Bioregion** | bioregion, land_rights, commons |
| **Staking** | stake_pool, governance, ubi |
| **Impact** | impact, impact_market, asset_impact, remediation, preservation |
| **Collectives** | collective, care |
| **Infrastructure** | energy, grants, genesis |
| **Hydra** | spending_bucket, ultralife_validator, fee_pool |

### MCP Service

| Component | Purpose |
|-----------|---------|
| Indexer | Read chain state via Blockfrost |
| Builder | Construct unsigned transactions |
| MCP Server | 31 tools for LLM interaction |

---

## How It Works

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

## Quick Start

```bash
# Build contracts
cd contracts && aiken build

# Run MCP service
cd service && npm install && npm start

# Connect your LLM
# Add MCP server to Claude Desktop or similar
```

---

## The Vision

A parallel economy where:

- ✓ Every person has permanent identity
- ✓ Every action has measured impact  
- ✓ Every impact is accountable
- ✓ Every negative impact is remediated
- ✓ Every positive impact is rewarded
- ✓ Every bioregion has infrastructure
- ✓ Every resident receives UBI

**Carbon-based life in abundance, with full accountability and dignity.**

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
