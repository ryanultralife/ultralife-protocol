# Impact Market Mechanics

## Overview

The Impact Market creates true price discovery for ecosystem health. It enables:

1. **Regenerators** to sell verified positive impacts
2. **Extractors** to buy offsets or fund remediation projects
3. **Market-determined** value for planetary health
4. **Project funding** when no tokens are available

This is not carbon credit theater - it is DNA-verified, multi-surveyor verified, real physical measurement with market-determined value.

## Order Book Mechanics

### Order Types

```
Order Types:
  - SELL: Regenerators listing impact tokens
  - BUY: Extractors seeking offsets
  - FUND_PROJECT: Request project funding when no supply
```

### Order Book Structure

```
CARBON IMPACT ORDERBOOK (Sierra Nevada)

SELL ORDERS (Asks) - Sorted by price ascending:
┌─────────┬──────────┬───────────────────┬───────────┐
│ Price   │ Quantity │ Seller            │ Order ID  │
├─────────┼──────────┼───────────────────┼───────────┤
│ 10.50   │ 500      │ land_steward_001  │ order_a1  │
│ 11.00   │ 1,200    │ regen_farm_042    │ order_a2  │
│ 12.00   │ 800      │ forest_preserve   │ order_a3  │
│ 12.50   │ 2,000    │ wetland_coop_007  │ order_a4  │
│ 15.00   │ 300      │ coastal_trust     │ order_a5  │
└─────────┴──────────┴───────────────────┴───────────┘
Best Ask: 10.50

BUY ORDERS (Bids) - Sorted by price descending:
┌─────────┬──────────┬───────────────────┬───────────┐
│ Price   │ Quantity │ Buyer             │ Order ID  │
├─────────┼──────────┼───────────────────┼───────────┤
│ 9.50    │ 1,000    │ factory_001       │ order_b1  │
│ 9.00    │ 750      │ transport_co_012  │ order_b2  │
│ 8.50    │ 2,000    │ mining_op_007     │ order_b3  │
│ 8.00    │ 500      │ logistics_inc     │ order_b4  │
│ 7.00    │ 3,000    │ airline_abc       │ order_b5  │
└─────────┴──────────┴───────────────────┴───────────┘
Best Bid: 9.50

Spread: 1.00 ULTRA (10.50 - 9.50)
Mid Price: 10.00 ULTRA
Last Trade: 10.00 ULTRA @ 500 units
24h Volume: 15,000 units
```

### Order Lifecycle

```
ORDER LIFECYCLE:

1. CREATION
   │
   ├── Seller/Buyer submits order
   ├── Assets escrowed (tokens or ULTRA)
   ├── Order enters book
   └── Status: Open

2. MATCHING
   │
   ├── Automatic if crosses spread
   ├── Manual fill for specific orders
   └── Partial fills allowed (if enabled)

3. EXECUTION
   │
   ├── Tokens transferred to buyer
   ├── Payment released to seller
   ├── Fee collected
   ├── Market state updated
   └── Status: Filled or PartiallyFilled

4. SETTLEMENT
   │
   ├── Trade record created
   ├── Price history updated
   └── Liquidity scores recalculated

5. COMPLETION/CANCELLATION
   │
   ├── Order fully filled → Closed
   ├── Order cancelled → Assets returned
   └── Order expired → Assets returned
```

### Partial Fills

Orders can allow partial fills:

```javascript
// Place sell order with partial fill
npm run impact:sell -- \
  --token <impact_token_id> \
  --quantity 1000 \
  --price 10.50 \
  --partial true

// Fill only part of the order
npm run impact:fill -- \
  --order <order_id> \
  --quantity 300  // Fills 300 of 1000
```

After partial fill:
```
Original: 1000 units @ 10.50
Filled: 300 units
Remaining: 700 units @ 10.50
Status: PartiallyFilled
```

## Pricing Model

### Base Price Discovery

Price is determined by supply and demand:

```
market_price = f(supply, demand, last_trades)

Where:
  supply = sum(sell_order_quantities)
  demand = sum(buy_order_quantities)
  last_trades = recent execution prices
```

### Default Prices (When No Market)

When no market exists for a category:

```javascript
const DEFAULT_PRICES = {
  Carbon: 10,        // 10 ULTRA per tCO2
  Water: 15,         // 15 ULTRA per 1000L
  Biodiversity: 25,  // 25 ULTRA per biodiversity index point
  Soil: 12,          // 12 ULTRA per soil health unit
  Air: 8,            // 8 ULTRA per air quality unit
  Waste: 5,          // 5 ULTRA per kg diverted
  Energy: 7,         // 7 ULTRA per kWh saved
  LandUse: 20,       // 20 ULTRA per hectare-year
};
```

### Price Bounds

To prevent manipulation:

```javascript
const PRICE_BOUNDS = {
  // Maximum price change per epoch
  max_epoch_change: 0.25,  // 25%

  // Minimum price (prevents worthless credits)
  min_price: 1,  // 1 ULTRA minimum

  // Maximum price (prevents artificial scarcity)
  max_price: 10000,  // 10,000 ULTRA maximum

  // Circuit breaker
  circuit_breaker: {
    trigger: 0.5,     // 50% change in hour
    cooldown: 3600,   // 1 hour pause
  },
};
```

### Bioregion Price Factors

Prices vary by bioregion based on local conditions:

```javascript
const BIOREGION_FACTORS = {
  sierra_nevada: {
    Carbon: 1.1,      // High forest value
    Water: 1.3,       // Drought conditions
    Biodiversity: 1.2,
  },
  pacific_northwest: {
    Carbon: 1.0,
    Water: 0.9,       // Abundant water
    Biodiversity: 1.1,
  },
  sonoran_desert: {
    Carbon: 0.9,
    Water: 2.0,       // Water is precious
    Biodiversity: 1.5,
  },
};
```

### Price Calculation Example

```
Category: Carbon
Bioregion: Sierra Nevada
Market Last Price: 10.00 ULTRA
Bioregion Factor: 1.1

Effective Price: 10.00 * 1.1 = 11.00 ULTRA per tCO2
```

## Credit Generation Formulas

### Carbon Credits

```
carbon_credits = sequestration_rate * area * time * verification_factor

Where:
  sequestration_rate = tCO2/ha/year (by land type)
  area = hectares
  time = years
  verification_factor = 0.8 to 1.0 (based on survey quality)
```

**Land Type Sequestration Rates:**
| Land Type | Rate (tCO2/ha/year) |
|-----------|---------------------|
| Forest | 5.0 |
| Wetland | 3.0 |
| Grassland | 1.0 |
| Agricultural | 0.5 |
| Urban | 0.1 |
| Coastal | 2.5 |
| Desert | 0.05 |

**Example:**
```
Land: 100 hectares of forest
Duration: 1 year
Verification: 0.9 (high quality surveys)

Credits = 5.0 * 100 * 1 * 0.9 = 450 tCO2 credits
```

### Water Credits

```
water_credits = water_flow * quality_improvement * time

Where:
  water_flow = liters per day
  quality_improvement = 0 to 1 (contaminant reduction)
  time = days
```

### Biodiversity Credits

```
biodiversity_credits = baseline_index * change_factor * area

Where:
  baseline_index = starting biodiversity score
  change_factor = improvement ratio
  area = hectares protected
```

### Impact Token Structure

```aiken
type ImpactDatum {
  // Identity
  token_id: AssetName,
  owner: AssetName,  // Owner pNFT

  // Impact details
  category: ImpactCategory,
  compound_code: ByteArray,
  magnitude: Int,  // Quantity of impact

  // Origin
  source_land: Option<AssetName>,  // Land NFT if applicable
  bioregion: ByteArray,
  generation_slot: Int,

  // Verification
  surveys: List<ByteArray>,  // Survey IDs
  verification_score: Int,   // 0-100

  // Status
  retired: Bool,
  retired_for: Option<ByteArray>,  // Transaction offset
}
```

## Debt Offset Calculations

### Impact Debt Generation

Every transaction can generate impact debt:

```
impact_debt = sum(compound_flows * debt_factors)

Where:
  compound_flows = negative impact flows from transaction
  debt_factors = category-specific conversion rates
```

**Debt Factors:**
| Compound | Factor | Unit |
|----------|--------|------|
| CO2 | 1.0 | per kg |
| CH4 | 25.0 | per kg (GWP equivalent) |
| N2O | 298.0 | per kg (GWP equivalent) |
| H2O (consumed) | 0.001 | per liter |
| Waste | 0.5 | per kg |

### Debt Accumulation

```
DEBT LEDGER (pnft_user_001)

Category      | Debt   | Offset | Net     | Status
───────────────────────────────────────────────────
Carbon        | 2.45   | 0.00   | 2.45    | OPEN
Water         | 1200 L | 800 L  | 400 L   | PARTIAL
Biodiversity  | 15 idx | 15 idx | 0 idx   | CLEAR
───────────────────────────────────────────────────

Total Carbon Equivalent: 2.65 tCO2e
Offset Cost (at 10 ULTRA/tCO2): 26.50 ULTRA
```

### Offset Requirements

```javascript
const OFFSET_REQUIREMENTS = {
  // Mandatory offset thresholds
  thresholds: {
    Carbon: 1.0,         // Must offset if debt > 1 tCO2
    Water: 10000,        // Must offset if debt > 10,000 L
    Biodiversity: 10,    // Must offset if debt > 10 index points
  },

  // Grace period (cycles)
  grace_period: 2,

  // Penalties for non-compliance
  penalties: {
    cycle_1: 0.1,   // 10% surcharge
    cycle_2: 0.2,   // 20% surcharge
    cycle_3: 0.5,   // 50% surcharge
    cycle_4: 1.0,   // 100% surcharge (double cost)
  },

  // Offset ratio (more than 1:1 required)
  offset_ratio: 1.1,  // 10% buffer
};
```

### Offset Calculation

```
offset_cost = debt * market_price * offset_ratio * penalty_factor

Example:
  Carbon debt: 2.45 tCO2
  Market price: 10 ULTRA/tCO2
  Offset ratio: 1.1
  Penalty: None (within grace)

  Cost = 2.45 * 10 * 1.1 * 1.0 = 26.95 ULTRA
```

## Project Funding Mechanism

When no impact tokens are available, extractors must fund regeneration projects.

### Project Proposal

```
PROJECT FUNDING FLOW:

1. NEED IDENTIFICATION
   │
   ├── Extractor has debt to offset
   ├── Market has insufficient supply
   └── Project funding triggered

2. PROJECT PROPOSAL
   │
   ├── Define target impact category
   ├── Specify magnitude needed
   ├── Set bioregion
   ├── Calculate funding (at market rate)
   └── Status: Proposed

3. FUNDING
   │
   ├── Primary funder commits ULTRA
   ├── Additional funders can contribute
   ├── Fully funded → Status: Funded
   └── Partial → Remain Proposed

4. IMPLEMENTATION
   │
   ├── Land steward accepts project
   ├── Preservation grant created
   ├── Work begins
   └── Status: InProgress

5. VERIFICATION
   │
   ├── Required surveys conducted
   ├── Impact verified
   ├── Tokens minted
   └── Status: Verified

6. COMPLETION
   │
   ├── Tokens assigned to funder
   ├── Immediately retired as offset
   └── Status: Complete
```

### Funding Calculation

```
funding_required = target_magnitude * market_price * project_overhead

Where:
  target_magnitude = impact units needed
  market_price = current or estimated market price
  project_overhead = 1.2 (20% for implementation costs)
```

**Example:**
```
Target: 100 tCO2 carbon sequestration
Market Price: 10 ULTRA/tCO2
Overhead: 1.2

Funding = 100 * 10 * 1.2 = 1,200 ULTRA
```

### Project Implementation

```javascript
// Accept project as land steward
npm run impact:accept-project -- --project <project_id>

// This creates:
//   - Preservation grant for funding amount
//   - Timeline for delivery
//   - Survey requirements
//   - Milestone schedule
```

### Project Verification

```javascript
// Verify project completion
npm run impact:verify-project -- \
  --project <project_id> \
  --surveys survey_001,survey_002,survey_003

// Requirements:
//   - Minimum 2 surveys
//   - Surveyor level: Verified+
//   - Cumulative impact >= target
```

## Market Operations

### Place Orders

```bash
# Place sell order
npm run impact:sell -- \
  --token <impact_token_id> \
  --quantity 500 \
  --price 10.5 \
  --partial true \
  --expires-in 604800  # 7 days

# Place buy order
npm run impact:buy -- \
  --category Carbon \
  --quantity 1000 \
  --max-price 12.0 \
  --partial true \
  --bioregion sierra_nevada
```

### Fill Orders

```bash
# Fill sell order (buyer takes listed tokens)
npm run impact:fill -- --order <order_id> --quantity 300

# Fill buy order (seller accepts bid)
npm run impact:fill-bid -- \
  --order <order_id> \
  --token <impact_token_id> \
  --quantity 500
```

### Cancel Orders

```bash
npm run impact:cancel -- --order <order_id>
# Returns escrowed assets to creator
```

### View Orderbook

```bash
npm run impact:orderbook -- --category Carbon --bioregion sierra_nevada
```

### View Market Statistics

```bash
npm run impact:market -- --category Carbon

Output:
CARBON IMPACT MARKET
────────────────────────────────────────
Global Statistics:
  Total Supply: 45,000 tCO2
  Total Demand: 62,000 tCO2
  24h Volume: 15,000 tCO2
  24h Value: 150,000 ULTRA

Price Statistics:
  Last Price: 10.00 ULTRA
  24h High: 11.50 ULTRA
  24h Low: 9.20 ULTRA
  7d Average: 10.25 ULTRA

Liquidity Score: 72/100

By Bioregion:
  sierra_nevada: 12,000 tCO2 supply
  pacific_northwest: 18,000 tCO2 supply
  great_lakes: 8,000 tCO2 supply
  gulf_coast: 7,000 tCO2 supply
────────────────────────────────────────
```

## Fee Structure

### Market Fees

| Action | Fee | Recipient |
|--------|-----|-----------|
| Place Order | 0 | - |
| Fill Order | 1% | 50% Treasury, 50% Bioregion |
| Cancel Order | 0 | - |
| Retire Tokens | 0 | - |
| Project Funding | 2% | Treasury |

### Fee Calculation

```
fill_fee = trade_value * 0.01

Example:
  Trade: 500 tCO2 @ 10 ULTRA = 5,000 ULTRA
  Fee: 5,000 * 0.01 = 50 ULTRA
    → 25 ULTRA to Treasury
    → 25 ULTRA to Bioregion
```

## Configuration Parameters

```javascript
// impact_market_config.mjs
export const IMPACT_MARKET_CONFIG = {
  // Order settings
  min_order_size: 1,
  max_order_size: 100000,
  default_expiry_slots: 604800,  // ~7 days

  // Market fee (basis points)
  market_fee_bps: 100,  // 1%

  // Fee split
  fee_treasury_share: 0.5,
  fee_bioregion_share: 0.5,

  // Price bounds
  min_price: 1,
  max_price: 10000,
  max_price_change_per_epoch: 0.25,

  // Default prices
  default_prices: {
    Carbon: 10,
    Water: 15,
    Biodiversity: 25,
    Soil: 12,
    Air: 8,
    Waste: 5,
    Energy: 7,
    LandUse: 20,
  },

  // Project funding
  project_overhead: 1.2,
  min_surveyors: 2,
  surveyor_level: 'Verified',

  // Offset requirements
  offset_ratio: 1.1,
  grace_period_cycles: 2,

  // Liquidity incentives
  liquidity_mining_rate: 0.001,  // 0.1% of trade value
};
```

## Market Health Indicators

### Liquidity Score

```
liquidity_score = f(spread, depth, volume)

Where:
  spread_factor = 1 - (spread / reference_price)
  depth_factor = min(total_supply, total_demand) / threshold
  volume_factor = volume_24h / volume_threshold

liquidity_score = (spread_factor * 0.3) + (depth_factor * 0.4) + (volume_factor * 0.3)
Scale: 0-100
```

### Market Classification

| Score | Classification | Description |
|-------|---------------|-------------|
| 80-100 | Deep | High liquidity, tight spread |
| 60-79 | Healthy | Good liquidity, reasonable spread |
| 40-59 | Developing | Moderate liquidity |
| 20-39 | Thin | Low liquidity, wide spread |
| 0-19 | Illiquid | No market, project funding likely |

## Trade Settlement

### On-Chain Settlement

All trades settle on-chain with atomic swap:

```
ATOMIC TRADE SETTLEMENT:

Inputs:
  - Sell order UTxO (with impact tokens)
  - Buy order UTxO (with ULTRA payment)

Outputs:
  - Impact tokens → Buyer address
  - ULTRA payment → Seller address
  - Fee → Treasury + Bioregion
  - Updated order UTxOs (if partial)

All-or-nothing: Transaction fails if any output invalid.
```

### Settlement Transaction

```javascript
// settlement_tx.mjs
async function settleTrade(sellOrder, buyOrder, quantity) {
  const txBuilder = new MeshTxBuilder({ fetcher, submitter });

  // Calculate values
  const price = sellOrder.price_per_unit;
  const payment = quantity * price;
  const fee = Math.floor(payment * MARKET_FEE_BPS / 10000);

  // Build transaction
  txBuilder
    // Spend sell order
    .spendFromScript(
      sellOrderUtxo,
      sellOrderScript,
      FillBuyOrderRedeemer(quantity)
    )
    // Spend buy order
    .spendFromScript(
      buyOrderUtxo,
      buyOrderScript,
      FillSellOrderRedeemer(quantity)
    )
    // Impact tokens to buyer
    .sendAssets(buyerAddress, impactTokens)
    // Payment to seller
    .sendAssets(sellerAddress, payment - fee)
    // Fee to treasury
    .sendAssets(treasuryAddress, fee / 2)
    // Fee to bioregion
    .sendAssets(bioregionAddress, fee / 2);

  return txBuilder.complete();
}
```

## Economic Loop

```
THE IMPACT MARKET ECONOMIC LOOP:

EXTRACTION                          REGENERATION
    │                                    │
    │ Creates negative impact            │ Creates positive impact
    │ Generates debt                     │ Generates credits
    │                                    │
    ▼                                    ▼
┌───────────────────────────────────────────────────────┐
│                  IMPACT TOKEN MARKET                   │
│                                                        │
│  If supply exists:                                     │
│    → Extractors BUY from regenerators                  │
│    → Price = supply/demand determined                  │
│    → Tokens RETIRED as offset                          │
│                                                        │
│  If no supply:                                         │
│    → Extractors FUND regeneration projects             │
│    → Land stewards IMPLEMENT                           │
│    → Surveyors VERIFY completion                       │
│    → Tokens CREATED and RETIRED                        │
│                                                        │
│  Either way:                                           │
│    EXTRACTION PAYS FOR REGENERATION AT MARKET RATE    │
└───────────────────────────────────────────────────────┘
    │                                    │
    │                                    │
    ▼                                    ▼
DEBT CLEARED                      REVENUE RECEIVED
    │                                    │
    │                                    │
    └────────────────┬───────────────────┘
                     │
                     ▼
              ECOSYSTEM HEALTH
              (Measurable improvement)
```

## Summary

The Impact Market creates:

1. **True Price Discovery** - Market determines value of ecosystem health
2. **DNA-Verified Accountability** - Every participant is identified
3. **Multi-Surveyor Verification** - Real physical measurement
4. **Project Funding** - Automatically funds regeneration when supply is low
5. **Mandatory Offset** - Extractors cannot escape environmental costs
6. **Bioregion Integration** - Local factors influence pricing

The result: Regenerative practices become profitable, and extraction bears its true cost.
