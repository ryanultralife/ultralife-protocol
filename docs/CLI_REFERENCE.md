# UltraLife Protocol CLI Reference

Complete reference for all CLI commands available in the UltraLife Protocol.

## Table of Contents

- [Identity Commands](#identity-commands)
- [Bioregion Commands](#bioregion-commands)
- [Marketplace Commands](#marketplace-commands)
- [Work Commands](#work-commands)
- [Care Commands](#care-commands)
- [Governance Commands](#governance-commands)
- [Impact Commands](#impact-commands)
- [Land Commands](#land-commands)
- [Transfer Commands](#transfer-commands)
- [Protocol Commands](#protocol-commands)
- [Deployment Commands](#deployment-commands)
- [Testing Commands](#testing-commands)

---

## Identity Commands

### Mint pNFT

Create a personal NFT (pNFT) for on-chain identity.

```bash
# Mint a Basic level pNFT
npm run mint:pnft:basic

# Mint with specific level
npm run mint:pnft -- --level <Level>

# Mint Standard level (requires DNA verification)
npm run mint:pnft:standard -- --dna-hash <hash>

# Full options
npm run mint:pnft -- --level <Level> --dna-hash <hash> --bioregion <id> --guardian <pnft_id>
```

**Verification Levels:**
| Level | Code | Requirements |
|-------|------|--------------|
| Basic | 0 | Wallet only |
| Ward | 1 | Guardian pNFT required |
| Standard | 2 | DNA verification |
| Verified | 3 | DNA + Bioregion residency |
| Steward | 4 | DNA + Bioregion + Community endorsement |

**Example Output:**
```
pNFT ID: pnft_m5k2a7_8f3c1d2e4a6b
Owner: addr_test1qz...
Level: Basic
Policy: 7a8b9c...
Tx: abc123...
```

### Show Wallet Address

```bash
npm run show:address
```

### Show Balance

```bash
npm run balance
```

### Create Test User

```bash
# Create a new test user
npm run user:create

# List all test users
npm run user:list
```

---

## Bioregion Commands

### List Bioregions

```bash
npm run bioregion:list
```

**Example Output:**
```
Available Bioregions:
  1. sierra_nevada (Health: 72%)
  2. pacific_northwest (Health: 85%)
  3. great_lakes (Health: 68%)
  4. gulf_coast (Health: 61%)
  5. sonoran_desert (Health: 55%)
```

### Show Bioregion Details

```bash
npm run bioregion:show -- --bioregion <bioregion_id>
```

### Update Health Index

```bash
npm run bioregion:health -- --bioregion <bioregion_id> --index <0-100>
```

### Stress Analysis

```bash
npm run bioregion:stress -- --bioregion <bioregion_id>
```

### Compound Priorities

```bash
npm run bioregion:priorities -- --bioregion <bioregion_id>
```

### Register Bioregion Pool

```bash
# Generic registration
npm run register:bioregion -- --bioregion <bioregion_id> --ticker <TICKER>

# Pre-configured pools
npm run register:pool:sierra-a    # Sierra Nevada (SNA)
npm run register:pool:pacific-nw  # Pacific Northwest (PNW)
npm run register:pool:great-lakes # Great Lakes (GLK)
npm run register:pool:gulf-coast  # Gulf Coast (GCT)
npm run register:pool:sonoran     # Sonoran Desert (SON)

# List bioregions
npm run list:bioregions
```

### Delegate to Pool

```bash
# Delegate to specific pool
npm run delegate -- --pool <TICKER> --amount <amount>

# Delegate to Sierra Nevada
npm run delegate:sna

# List delegation options
npm run delegate:list
```

---

## Marketplace Commands

### List Offerings

```bash
npm run market:list
```

**Flags:**
- `--category <category>` - Filter by category
- `--bioregion <id>` - Filter by bioregion
- `--price-max <amount>` - Maximum price filter

### Browse Marketplace

```bash
npm run market:browse -- --category <category>
```

### Create Listing

```bash
npm run market:list -- --create --title "<title>" --description "<desc>" --price <amount> --category <category>
```

### Purchase Item

```bash
npm run market:purchase -- --listing <listing_id>
```

### Update Listing

```bash
npm run market:update -- --listing <listing_id> --price <new_price>
```

### Cancel Listing

```bash
npm run market:cancel -- --listing <listing_id>
```

### Review Transaction

```bash
npm run market:review -- --listing <listing_id> --rating <1-5> --comment "<comment>"
```

### List Categories

```bash
npm run market:categories
```

**Example Output:**
```
Marketplace Categories:
  - Food & Agriculture
  - Services
  - Handmade & Crafts
  - Equipment & Tools
  - Housing & Shelter
  - Transportation
  - Education & Training
  - Healthcare
```

### Help

```bash
npm run market:help
```

---

## Work Commands

### Post a Job

```bash
npm run work:post -- --title "<title>" --description "<desc>" --budget <amount> --type <work_type>
```

**Work Types:**
```bash
npm run work:types
```

Output:
- Labor (physical work)
- Skilled (technical/professional)
- Creative (design, art, content)
- Agricultural (farming, harvesting)
- Construction (building, repair)
- Care (childcare, eldercare)
- Education (teaching, tutoring)
- Technical (IT, engineering)

### List Jobs

```bash
npm run work:list -- [--bioregion <id>] [--type <work_type>] [--status <status>]
```

### Show Job Details

```bash
npm run work:show -- --job <job_id>
```

### Place a Bid

```bash
npm run work:bid -- --job <job_id> --amount <bid_amount> --timeline "<timeline>"
```

### List Bids

```bash
npm run work:bids -- --job <job_id>
```

### Accept a Bid

```bash
npm run work:accept -- --job <job_id> --bid <bid_id>
```

### Start Work

```bash
npm run work:start -- --job <job_id>
```

### Complete Work

```bash
npm run work:complete -- --job <job_id> --evidence "<evidence_hash>"
```

### Confirm Completion

```bash
npm run work:confirm -- --job <job_id>
```

### Dispute Work

```bash
npm run work:dispute -- --job <job_id> --reason "<reason>"
```

### Cancel Job

```bash
npm run work:cancel -- --job <job_id>
```

### Withdraw Bid

```bash
npm run work:withdraw -- --bid <bid_id>
```

### My Jobs

```bash
npm run work:my
```

### Help

```bash
npm run work:help
```

---

## Care Commands

### Register Care Need

```bash
npm run care:register -- --type <care_type> --description "<desc>" --hours <hours_per_week>
```

**Care Types:**
- Childcare (infant, toddler, preschool, school-age, adolescent)
- ElderCare (independent, assisted, fulltime, medical, palliative)
- DisabilityCare
- HealthSupport
- Household
- CommunityService
- FamilySupport

### List Care Needs

```bash
npm run care:list -- [--bioregion <id>] [--type <care_type>]
```

### Fulfill Care Need

```bash
npm run care:fulfill -- --need <need_id> --hours <hours>
```

### Accept Care Assignment

```bash
npm run care:accept -- --assignment <assignment_id>
```

### Track Care Hours

```bash
npm run care:track -- --assignment <assignment_id> --hours <hours> --notes "<notes>"
```

### Complete Care Period

```bash
npm run care:complete -- --assignment <assignment_id>
```

### My Care Records

```bash
npm run care:my
```

**Example Output:**
```
My Care Records:
  Caregiver Credits: 450
  Hours This Cycle: 32

  Active Assignments:
    1. Childcare for Family_001 - 15 hrs/week
    2. ElderCare for Neighbor_042 - 10 hrs/week

  Pending Attestations: 2
```

### Help

```bash
npm run care:help
```

---

## Governance Commands

### Create Proposal

```bash
npm run govern:propose -- --title "<title>" --description "<desc>" --type <proposal_type>
```

**Proposal Types:**
- Parameter (change protocol parameters)
- Spending (treasury spending)
- Policy (policy changes)
- Emergency (urgent matters)

### List Proposals

```bash
npm run govern:list -- [--status <status>] [--bioregion <id>]
```

**Statuses:** Active, Passed, Failed, Executed, Cancelled

### Show Proposal Details

```bash
npm run govern:show -- --proposal <proposal_id>
```

### Vote on Proposal

```bash
npm run govern:vote -- --proposal <proposal_id> --vote <yes|no|abstain>
```

**Voting Weights by Level:**
| Level | Weight |
|-------|--------|
| Basic | 0 |
| Ward | 0 |
| Standard | 1 |
| Verified | 2 |
| Steward | 3 |

### Tally Votes

```bash
npm run govern:tally -- --proposal <proposal_id>
```

### Execute Passed Proposal

```bash
npm run govern:execute -- --proposal <proposal_id>
```

### My Votes

```bash
npm run govern:my-votes
```

### Current Cycle

```bash
npm run govern:cycle
```

**Output:**
```
Current Governance Cycle: 47
Cycle Start: Slot 150,371,200
Cycle End: Slot 153,568,000
Days Remaining: 23
Active Proposals: 5
```

### Help

```bash
npm run govern:help
```

---

## Impact Commands

### Impact Market Overview

```bash
npm run impact:market
```

### Place Sell Order (Regenerators)

```bash
npm run impact:sell -- --token <impact_token_id> --quantity <units> --price <price_per_unit>
```

### Place Buy Order (Offsetting)

```bash
npm run impact:buy -- --category <category> --quantity <units> --max-price <max_price_per_unit>
```

**Impact Categories:**
- Carbon (0x0500)
- Water (0x0510)
- Biodiversity (0x0520)
- Soil (0x0530)
- Air (0x0540)
- Waste (0x0550)
- Energy (0x0560)
- LandUse (0x0570)

### Fill Order

```bash
npm run impact:fill -- --order <order_id> --quantity <units>
```

### Cancel Order

```bash
npm run impact:cancel -- --order <order_id>
```

### View Orderbook

```bash
npm run impact:orderbook -- --category <category> [--bioregion <id>]
```

**Example Output:**
```
Carbon Impact Orderbook (Sierra Nevada)

SELL ORDERS (Asks):
  Price    Quantity   Seller
  10.5     500        land_steward_001
  11.0     1200       regen_farm_042
  12.0     800        forest_preserve_003

BUY ORDERS (Bids):
  Price    Quantity   Buyer
  9.5      1000       factory_001
  9.0      750        transport_co_012
  8.5      2000       mining_op_007

Spread: 1.0 ULTRA
Last Trade: 10.0 ULTRA (500 units)
```

### My Orders

```bash
npm run impact:my-orders
```

### Trade History

```bash
npm run impact:history -- [--category <category>] [--days <num_days>]
```

### Get Price

```bash
npm run impact:price -- --category <category> [--bioregion <id>]
```

---

## Land Commands

### Mint Land NFT

```bash
npm run land:mint -- --name "<name>" --area <area_m2> --type <land_type> --bioregion <bioregion_id>
```

**Land Types:**
```bash
npm run land:types
```

Output:
| Type | Sequestration Rate (tCO2/ha/year) |
|------|-----------------------------------|
| forest | 5.0 |
| wetland | 3.0 |
| grassland | 1.0 |
| agricultural | 0.5 |
| urban | 0.1 |
| coastal | 2.5 |
| desert | 0.05 |

**Example:**
```bash
npm run land:mint -- --name "Quincy Forest" --area 160000 --type forest --bioregion sierra_nevada
```

### List Land Holdings

```bash
npm run land:list
```

**Example Output:**
```
Your Land Holdings:
  1. Quincy Forest (forest)
     Area: 16.00 ha
     Bioregion: sierra_nevada
     Credits Generated: 80.00 tCO2

  2. River Wetland (wetland)
     Area: 5.00 ha
     Bioregion: sierra_nevada
     Credits Generated: 15.00 tCO2

Total Area: 21.00 ha
Total Credits: 95.00 tCO2
```

### Generate Credits

```bash
# Generate credits for all land
npm run credits:generate -- --all

# Generate for specific land
npm run credits:generate -- --land <land_id>
```

### List Available Credits

```bash
npm run credits:list
```

### Buy Credits (Offset Debt)

```bash
# Buy specific amount
npm run credits:buy -- --amount <tCO2>

# Offset all debt
npm run credits:buy -- --offset-all
```

### Check Impact Debt

```bash
npm run credits:debt
```

**Example Output:**
```
Your Impact Debt:
  Carbon: 2.45 tCO2
  Water: 1200 L
  Biodiversity: 15 idx

Offset Cost:
  Carbon: 12.25 ULTRA (at 5.0 per tCO2)

Available Credits in Market: 450.00 tCO2
```

### View Available Credits

```bash
npm run credits:available
```

---

## Transfer Commands

### Transfer ULTRA Tokens

```bash
npm run transfer -- --to <recipient> --amount <amount> --type <tx_type> [compound_flags] --desc "<description>"
```

**Transaction Types:**
| Type | Code | Description |
|------|------|-------------|
| labor | 1 | Work performed |
| goods | 2 | Physical products |
| services | 3 | Service provided |
| gift | 4 | Voluntary transfer |
| investment | 5 | Capital allocation |
| remediation | 6 | Environmental repair |

**Compound Flags:**
```bash
--compound <CODE>:<quantity>:<confidence>
```

**Example:**
```bash
npm run transfer -- --to Alice --amount 8 --type goods \
  --compound CO2:-450:75 \
  --compound H2O:-120:60 \
  --compound PROT:25:90 \
  --compound IRON:3:85 \
  --desc "Grass-fed beef 200g - transport CO2 from fuel receipt"
```

### List Compounds

```bash
npm run transfer:compounds
```

### Help

```bash
npm run transfer:help
```

---

## Protocol Commands

### Fetch Protocol Spec

```bash
npm run protocol
```

### Show Full Specification

```bash
npm run protocol:spec
```

### List Compounds

```bash
npm run protocol:compounds
```

**Example Output:**
```
Environmental Compounds:
  CO2  - Carbon Dioxide (g)
  CH4  - Methane (g)
  H2O  - Water (L)
  N    - Nitrogen (g)
  NO3  - Nitrate (g)
  ...

Nutritional Compounds:
  PROT - Protein (g)
  FAT  - Fat (g)
  CARB - Carbohydrate (g)
  ...

Health Compounds:
  NEED_PROT - Protein Need Met (%)
  NEED_B12  - B12 Need Met (%)
  ...
```

### Generate Example Transaction

```bash
npm run protocol:example
```

### LLM Prompt Generation

```bash
npm run protocol:llm
```

---

## Population Health Commands

### Generate Health Report

```bash
npm run pop:report -- --bioregion <bioregion_id>
```

### Show Population Data

```bash
npm run pop:show -- --bioregion <bioregion_id>
```

### List Deficiencies

```bash
npm run pop:deficiencies -- --bioregion <bioregion_id>
```

**Example Output:**
```
Population Deficiencies (Sierra Nevada):
  Iron: 23% of population
  Vitamin D: 45% of population
  B12: 12% of population
  Zinc: 8% of population

Priority Compounds: IRON, VIT_D, B12
```

### Chronic Conditions

```bash
npm run pop:conditions -- --bioregion <bioregion_id>
```

### Compound Needs

```bash
npm run pop:needs -- --bioregion <bioregion_id>
```

### Health Trends

```bash
npm run pop:trends -- --bioregion <bioregion_id> --cycles <num_cycles>
```

### List Bioregions with Health Data

```bash
npm run pop:bioregions
```

### Help

```bash
npm run pop:help
```

---

## Compound Discovery Commands

### Analyze Correlations

```bash
npm run discover:analyze -- --bioregion <bioregion_id>
```

### Correlate with Health Outcomes

```bash
npm run discover:correlate -- --compound <compound_code> --outcome <health_metric>
```

### Identify Tracking Gaps

```bash
npm run discover:gaps -- --bioregion <bioregion_id>
```

### Propose New Compound

```bash
npm run discover:propose -- --code <code> --name "<name>" --unit <unit> --direction <direction>
```

### Apply Proposed Compound

```bash
npm run discover:apply -- --proposal <proposal_id>
```

### Discovery History

```bash
npm run discover:history
```

---

## Measurement Helper Commands

### Measure Impact

```bash
npm run measure -- --activity "<activity_description>"
```

### List Measurement Methods

```bash
npm run measure:methods
```

**Output:**
```
Measurement Methods:
  95-100: Lab tested, certified surveyor
  85-94:  Direct measurement with calibrated equipment
  70-84:  Calculated from documented inputs
  50-69:  Product specification, supply chain documentation
  30-49:  Estimated from similar verified activity
  10-29:  AI estimate, regional average (MUST verify)
```

### List Conversion Factors

```bash
npm run measure:factors
```

**Output:**
```
Common Conversion Factors:
  Transport CO2:
    Diesel: 2.31 kg CO2 per liter
    Gasoline: 2.39 kg CO2 per liter

  Electricity CO2:
    Grid average: 0.4-0.9 kg CO2 per kWh (varies by region)
    Solar: 0.02 kg CO2 per kWh (amortized)

  Water:
    Agriculture: varies by crop
    Beef: ~15,000 L per kg
    Almonds: ~1,900 L per liter milk
```

### List Nutrition Values

```bash
npm run measure:nutrition
```

---

## IPFS Commands

### Publish to IPFS

```bash
npm run ipfs:publish
```

### Publish via Pinata

```bash
npm run ipfs:pinata
```

### Publish via Web3.Storage

```bash
npm run ipfs:web3
```

### Verify Publication

```bash
npm run ipfs:verify
```

### Publish Full State

```bash
npm run ipfs:full
```

### Dry Run

```bash
npm run ipfs:dry
```

### Help

```bash
npm run ipfs:help
```

---

## Deployment Commands

### Full Testnet Deployment

```bash
npm run deploy:testnet
```

### Deploy Reference Scripts

```bash
# Deploy all validators
npm run deploy:references

# Deploy specific validator
npm run deploy:references:one -- <validator_name>
```

### Initialize Genesis

```bash
npm run init:genesis
```

### Setup

```bash
# Run setup
npm run setup

# Generate new wallet
npm run setup:generate
```

---

## Testing Commands

### Run All Tests

```bash
npm run test
```

### Run Specific Phase

```bash
npm run test:phase -- <phase_number>
```

**Test Phases:**
1. Foundation (wallet, deployment, validators)
2. Identity (pNFT lifecycle)
3. Economy (tokens, treasury, grants)
4. Bioregion & UBI
5. Impact & Remediation
6. Governance

### Run User Journey

```bash
npm run test:journey
```

### On-Chain Tests

```bash
# Run all on-chain tests
npm run test:onchain:all

# Run specific test
npm run test:onchain -- --test <test_name>

# Available tests
npm run test:transfer
npm run test:datum
```

### End-to-End Tests

```bash
# Full E2E test
npm run test:e2e

# Quick E2E test
npm run test:e2e:quick

# Skip deployment
npm run test:e2e:skip-deploy
```

### Interaction Tests

```bash
# Setup interaction tests
npm run test:interact:setup

# Run specific flows
npm run test:interact:marketplace
npm run test:interact:work
npm run test:interact:governance
npm run test:interact:care
npm run test:interact:impact
npm run test:interact:land
```

---

## Environment Variables

All commands require these environment variables (set in `.env`):

```bash
# Required
BLOCKFROST_API_KEY=your_blockfrost_api_key
WALLET_SEED_PHRASE=your_24_word_seed_phrase
NETWORK=preprod  # or preview, mainnet

# Optional
IPFS_PROVIDER=pinata  # or web3storage
PINATA_API_KEY=your_pinata_key
PINATA_SECRET=your_pinata_secret
WEB3_STORAGE_TOKEN=your_web3storage_token
```

---

## Common Patterns

### Transfer with Impact Tracking

```bash
npm run transfer -- \
  --to Bob \
  --amount 50 \
  --type goods \
  --compound CO2:-450:75 \
  --compound H2O:-120:60 \
  --compound PROT:25:90 \
  --desc "Organic produce with verified transport emissions"
```

### Land Steward Workflow

```bash
# 1. Mint land NFT
npm run land:mint -- --name "My Forest" --area 100000 --type forest --bioregion sierra_nevada

# 2. Generate credits (each cycle)
npm run credits:generate -- --all

# 3. Sell credits on impact market
npm run impact:sell -- --token <credit_token> --quantity 50 --price 10
```

### Consumer Offset Workflow

```bash
# 1. Check impact debt
npm run credits:debt

# 2. View available credits
npm run credits:available

# 3. Buy credits to offset
npm run credits:buy -- --offset-all
```

### Governance Participation

```bash
# 1. View current cycle
npm run govern:cycle

# 2. List active proposals
npm run govern:list -- --status Active

# 3. View proposal details
npm run govern:show -- --proposal <id>

# 4. Cast vote
npm run govern:vote -- --proposal <id> --vote yes
```

---

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Missing configuration |
| 3 | Insufficient funds |
| 4 | Transaction failed |
| 5 | Validation error |
