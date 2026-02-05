# UltraLife Protocol — Business Onboarding

## The Protocol IS Your Business Infrastructure

UltraLife isn't a separate SaaS layer—it's the infrastructure itself. Every business operation maps directly to protocol components:

| Business Need | Protocol Component |
|--------------|-------------------|
| Business identity | **pNFT** (owner/collective) |
| Register property | **Land Registry** |
| Track environmental impact | **Impact Compounds** |
| List products/services | **Marketplace** |
| Hire workers | **Work Auction** |
| Generate carbon credits | **Land → Impact Credits** |
| Sell credits | **Impact Market** |
| Accept payments | **ULTRA Token** |
| Local governance | **Bioregion Governance** |
| Form partnerships | **Collectives** |

---

## Quick Start for Small Farms

### Step 1: Get Your Identity (pNFT)

Every business starts with human identity. The farm owner creates a pNFT.

```bash
# Create your pNFT
npm run identity:create

# Verify to Standard level (DNA or attestation)
npm run identity:verify

# Upgrade to Verified (prove bioregion residency)
npm run identity:upgrade -- --level verified
```

**Why pNFT for business?**
- Your reputation travels with you
- Impact history is permanent
- Customers see your track record
- No anonymous bad actors

### Step 2: Register Your Land

Your land is where value is created and impact is tracked.

```bash
# Register your farm
npm run land:register -- \
  --name "Sunny Meadow Farm" \
  --coordinates "39.2,-120.5" \
  --area 100000 \
  --classification agricultural \
  --bioregion sierra_nevada
```

**Land data tracked:**
- Soil health index
- Water usage/retention
- Biodiversity score
- Carbon stock
- Sequestration rate

### Step 3: Initial Health Assessment

Before you can generate credits, establish baseline.

```bash
# Record initial land health
npm run land:assess -- \
  --land-id land_abc123 \
  --soil 45 \
  --water 60 \
  --biodiversity 35 \
  --carbon-stock 800
```

This creates your starting point. Future improvements generate credits.

### Step 4: List Your Products

Every product carries its impact story.

```bash
# List a product
npm run market:list -- \
  --title "Organic Tomatoes - 5lb" \
  --price 15 \
  --category food \
  --land-source land_abc123 \
  --compounds "CO2:-0.5,H2O:50,BIO:0.2,LABOR:0.5"
```

**Impact compounds on products:**
| Compound | Meaning |
|----------|---------|
| CO2 | Carbon footprint (negative = sequestered) |
| H2O | Water used (liters) |
| BIO | Biodiversity impact |
| LABOR | Human hours |
| SOIL | Soil impact |
| ENERGY | Energy used |

### Step 5: Hire Seasonal Workers

Need help? Use work auctions.

```bash
# Post a job
npm run work:post -- \
  --title "Tomato Harvest Help - 3 days" \
  --category agriculture \
  --budget 300 \
  --deadline 2026-02-15 \
  --requirements "physical_labor"
```

Workers bid, you accept, they complete, payment releases from escrow.

### Step 6: Generate Impact Credits

As you improve your land, you generate sellable credits.

```bash
# After 6 months of regenerative practice
npm run land:assess -- \
  --land-id land_abc123 \
  --soil 65 \
  --water 75 \
  --biodiversity 50 \
  --carbon-stock 1200

# Credits automatically generated from improvement delta
npm run land:credits -- --land-id land_abc123
```

**Credit generation formula:**
```
CO2 credits = (new_carbon_stock - old_carbon_stock) × verification_factor
H2O credits = water_retention_improvement × area
BIO credits = biodiversity_delta × ecosystem_multiplier
```

### Step 7: Sell Credits on Impact Market

```bash
# List credits for sale
npm run impact:sell -- \
  --compound CO2 \
  --quantity 10 \
  --price-per-unit 50 \
  --land-source land_abc123
```

Extractors (high-impact businesses) buy to offset their debt.

---

## Business Types & Their Flows

### Small Farm (Regenerative Agriculture)

```
FARM FLOW
─────────────────────────────────────────────────────

1. IDENTITY
   Owner pNFT → Verified level

2. LAND
   Register parcels → Initial assessment

3. OPERATIONS
   ├── Plant crops (log activities)
   ├── Hire workers (work auction)
   ├── Track inputs (water, fertilizer, labor)
   └── Record outputs (yield, quality)

4. PRODUCTS
   List on marketplace with:
   ├── Land source (provenance)
   ├── Impact compounds (auto-calculated)
   ├── Growing practices
   └── Worker treatment

5. CREDITS
   ├── Soil improvement → SOIL credits
   ├── Carbon sequestration → CO2 credits
   ├── Water retention → H2O credits
   └── Habitat creation → BIO credits

6. REVENUE
   ├── Product sales (ULTRA)
   ├── Credit sales (ULTRA)
   └── Ecosystem services (bioregion payments)
```

### Food Producer (Value-Added Processing)

```
PRODUCER FLOW
─────────────────────────────────────────────────────

1. IDENTITY
   Business owner pNFT + Collective for business

2. FACILITY
   Register processing facility

3. SUPPLY CHAIN
   ├── Source from registered farms
   ├── Track ingredient provenance
   └── Aggregate impact from sources

4. PROCESSING
   ├── Energy usage (tracked)
   ├── Water usage (tracked)
   ├── Waste generated (tracked)
   └── Labor hours (work auction or direct)

5. PRODUCTS
   List with FULL supply chain impact:
   ├── Ingredient impacts (from source farms)
   ├── Processing impacts (your facility)
   ├── Packaging impacts
   └── Total compound footprint

6. CERTIFICATION
   Automatic based on:
   ├── Source transparency
   ├── Impact thresholds
   └── Verification status
```

### Artisan/Maker (Crafts, Goods)

```
ARTISAN FLOW
─────────────────────────────────────────────────────

1. IDENTITY
   Individual pNFT (Verified level)

2. WORKSPACE
   Register if applicable (home workshop, studio)

3. MATERIALS
   ├── Track sourcing (where from?)
   ├── Log material impacts
   └── Document sustainable practices

4. LABOR
   ├── Your hours (self-tracked)
   ├── Apprentices (work auction)
   └── Fair compensation visible

5. PRODUCTS
   List with:
   ├── Material origins
   ├── Labor hours
   ├── Energy used
   └── Your story/craft

6. REPUTATION
   ├── Review history
   ├── Impact track record
   └── Community endorsements
```

### Local Retailer (Store, Market)

```
RETAILER FLOW
─────────────────────────────────────────────────────

1. IDENTITY
   Owner pNFT + Store Collective

2. LOCATION
   Register storefront

3. SOURCING
   ├── Buy from registered producers
   ├── Track all suppliers
   └── Aggregate store inventory impact

4. OPERATIONS
   ├── Energy (from grid vs renewable)
   ├── Waste management
   ├── Employee treatment (work auction compatible)
   └── Community engagement

5. SALES
   When customer purchases:
   ├── Impact transfers to buyer's pNFT
   ├── Producer gets revenue
   ├── You get margin
   └── Full chain visible

6. STORE RATING
   Automatic based on:
   ├── Average product impact
   ├── Local sourcing %
   └── Operational footprint
```

### Service Provider (Restaurant, Salon, Repair)

```
SERVICE FLOW
─────────────────────────────────────────────────────

1. IDENTITY
   Owner pNFT + Business Collective

2. LOCATION
   Register service location

3. INPUTS
   ├── Track supplies used
   ├── Energy consumption
   └── Material waste

4. LABOR
   ├── Employees via work auction OR
   ├── Direct hire with logged hours
   └── Fair wage verification

5. SERVICES
   List on marketplace:
   ├── Service description
   ├── Time required
   ├── Materials used
   └── Impact per service

6. CUSTOMER EXPERIENCE
   ├── Book via marketplace
   ├── Impact recorded on their pNFT
   └── Review and rating
```

---

## Collectives for Business

When you need organizational structure:

```bash
# Create a business collective
npm run collective:create -- \
  --name "Sunny Meadow Farm LLC" \
  --type producer \
  --members "pnft_owner123" \
  --bioregion sierra_nevada
```

**Collective types:**
| Type | Use Case |
|------|----------|
| `producer` | Farm, manufacturer, maker |
| `retailer` | Store, market, distribution |
| `service` | Restaurant, repair, professional |
| `cooperative` | Shared ownership, worker co-op |
| `nonprofit` | Community org, land trust |

**Collective features:**
- Multi-signature transactions
- Shared treasury
- Member voting on decisions
- Combined impact tracking
- Group reputation

---

## Impact Tracking Deep Dive

### Automatic vs Manual Tracking

**Automatic (from land registry):**
- Sequestration credits from land improvement
- Water retention from soil health
- Biodiversity from ecosystem surveys

**Manual (you log):**
- Production inputs (fertilizer, water, energy)
- Labor hours
- Transportation
- Packaging materials

### Compound Categories

```
ENVIRONMENTAL
├── CO2  — Carbon dioxide (negative = sequestered)
├── H2O  — Water (liters used)
├── N    — Nitrogen (runoff potential)
├── P    — Phosphorus (runoff potential)
├── BIO  — Biodiversity impact
├── SOIL — Soil health impact
└── WASTE — Waste generated

SOCIAL
├── LABOR    — Human hours
├── WAGE     — Fair wage indicator
├── SAFETY   — Working conditions
└── COMMUNITY — Local benefit

SUPPLY CHAIN
├── DISTANCE — Transport miles
├── HANDLING — Number of handlers
├── STORAGE  — Storage conditions
└── FRESHNESS — Time from harvest
```

### Impact Calculation Example

A jar of organic tomato sauce:

```
INGREDIENT IMPACTS (from source farms)
├── Tomatoes (5 lb from Farm A)
│   ├── CO2: -0.3 (sequestered by farm)
│   ├── H2O: 100L
│   └── LABOR: 0.2 hrs
├── Basil (0.5 lb from Farm B)
│   ├── CO2: -0.1
│   ├── H2O: 20L
│   └── LABOR: 0.1 hrs
└── Garlic (0.25 lb from Farm C)
    ├── CO2: -0.05
    ├── H2O: 10L
    └── LABOR: 0.05 hrs

PROCESSING IMPACTS (your facility)
├── Energy: 0.5 kWh → CO2: +0.2
├── Water: 5L
├── Labor: 0.3 hrs
└── Packaging: glass jar → CO2: +0.1

TRANSPORT (to market)
└── 20 miles → CO2: +0.05

TOTAL PRODUCT IMPACT
├── CO2: -0.3 -0.1 -0.05 +0.2 +0.1 +0.05 = -0.1 (net negative!)
├── H2O: 135L
├── LABOR: 0.65 hrs
└── DISTANCE: 20 miles

DISPLAYED TO BUYER:
"Carbon negative tomato sauce from Sierra Nevada farms"
```

---

## Work Auction for Hiring

### Posting Jobs

```bash
# Seasonal harvest help
npm run work:post -- \
  --title "Apple Harvest - 2 weeks" \
  --description "Pick apples, sort, pack. 6am-2pm daily." \
  --category agriculture \
  --budget 2000 \
  --duration "14 days" \
  --requirements "physical_labor,early_morning"

# Skilled trade
npm run work:post -- \
  --title "Irrigation System Repair" \
  --description "Fix drip irrigation in greenhouse" \
  --category maintenance \
  --budget 500 \
  --requirements "plumbing,irrigation_experience"
```

### Receiving and Accepting Bids

```bash
# View bids on your job
npm run work:bids -- --job-id job_abc123

# Accept a bid
npm run work:accept -- --job-id job_abc123 --bid-id bid_xyz789
```

### Completion and Payment

```bash
# Worker submits completion
npm run work:complete -- --job-id job_abc123 --evidence "photos,notes"

# You confirm, payment releases
npm run work:confirm -- --job-id job_abc123
```

**Benefits over traditional hiring:**
- Escrow protects both parties
- Worker reputation visible
- Fair wage transparency
- No intermediary fees
- Instant payment on completion

---

## Revenue Streams for Businesses

### 1. Product/Service Sales

Direct sales through marketplace in ULTRA tokens.

```
Sale: 1 jar tomato sauce
├── Price: 15 ULTRA
├── To seller: 14.7 ULTRA (after 2% bioregion fee)
└── Impact transferred to buyer's pNFT
```

### 2. Impact Credit Sales

If you're a regenerator, sell credits to extractors.

```
Your farm sequesters 50 tons CO2/year
├── Keep some for your products (net negative)
├── Sell surplus: 30 tons × 50 ULTRA = 1500 ULTRA
└── Extractors buy to offset their debt
```

### 3. Ecosystem Service Payments

Bioregion treasury pays for:
- Watershed protection
- Habitat preservation
- Pollinator support
- Fire fuel reduction

```bash
# Apply for ecosystem service recognition
npm run bioregion:apply-service -- \
  --land-id land_abc123 \
  --service watershed_protection \
  --evidence "upstream_from_city,riparian_buffer"
```

### 4. Premium Pricing

Transparent impact = premium value.

```
Conventional tomatoes: 5 ULTRA
Your regenerative tomatoes: 8 ULTRA

Customers pay more because:
├── They see the full impact
├── They know it's net-positive
├── Their pNFT reflects conscious choices
└── They're investing in land health
```

---

## Integration Options

### API Access

The protocol web server provides endpoints:

```bash
# Start the server
cd service && npm run serve

# Endpoints available:
GET /spec                 # Full protocol spec
GET /spec/compounds       # All impact compounds
GET /deployment           # Current deployment state
GET /health               # Service health
```

### Webhook Events

Subscribe to events for your business:
- New order received
- Payment completed
- Credit generated
- Health index updated

### POS Integration

For retail:
```javascript
// When customer checks out
const sale = {
  items: [
    { productId: 'prod_abc', quantity: 2 }
  ],
  buyerPnft: 'pnft_customer123',
  sellerPnft: 'pnft_yourstore'
};

// Submit to protocol
await marketplace.completeSale(sale);
```

### Inventory Sync

Track inventory with impact:
```javascript
// Log inventory received
await inventory.receive({
  product: 'tomatoes',
  quantity: 100,
  source: 'land_farm_abc',
  impactPerUnit: { CO2: -0.3, H2O: 50 }
});
```

---

## Fees & Economics

### Transaction Fees

| Action | Fee | Goes To |
|--------|-----|---------|
| Marketplace sale | 2% | Bioregion treasury |
| Impact credit trade | 1% | Protocol treasury |
| Work auction completion | 1.5% | Bioregion treasury |
| Land registration | 5 ULTRA | Protocol treasury |

### No Hidden Costs

- No monthly SaaS fees
- No per-seat licensing
- No data extraction
- No platform lock-in

You pay transaction fees when value moves. That's it.

### Credit Generation Economics

```
Your land improves soil health by 20 points
├── Generates 10 SOIL credits
├── Market price: 30 ULTRA each
├── Potential revenue: 300 ULTRA
└── Minus 1% trade fee: 297 ULTRA net
```

---

## Getting Started Checklist

### Day 1: Identity
- [ ] Create pNFT for business owner
- [ ] Complete verification (Standard minimum)
- [ ] Join your bioregion

### Week 1: Registration
- [ ] Register land/facility
- [ ] Complete initial health assessment
- [ ] Set up wallet for ULTRA

### Week 2: First Listings
- [ ] List 3-5 products
- [ ] Add impact compounds
- [ ] Test a purchase flow

### Month 1: Full Operations
- [ ] Track all inputs/outputs
- [ ] Post first work auction
- [ ] Generate first credits
- [ ] Join local collective

### Ongoing
- [ ] Regular health assessments
- [ ] Update product impacts
- [ ] Sell surplus credits
- [ ] Participate in governance

---

## CLI Quick Reference

```bash
# Identity
npm run identity:create          # Create pNFT
npm run identity:verify          # Verify identity
npm run identity:show            # View your pNFT

# Land
npm run land:register            # Register land
npm run land:assess              # Health assessment
npm run land:credits             # Generate credits
npm run land:activities          # Log activities

# Marketplace
npm run market:list              # List product
npm run market:browse            # Browse listings
npm run market:update            # Update listing
npm run market:my                # Your listings

# Work
npm run work:post                # Post job
npm run work:bids                # View bids
npm run work:accept              # Accept bid
npm run work:confirm             # Confirm completion

# Impact
npm run impact:sell              # Sell credits
npm run impact:buy               # Buy credits
npm run impact:orderbook         # View market

# Governance
npm run govern:propose           # Create proposal
npm run govern:vote              # Vote
npm run govern:list              # View proposals

# Bioregion
npm run bioregion:list           # List bioregions
npm run bioregion:join           # Join bioregion
npm run bioregion:delegate       # Delegate to pool
```

---

## Support

- **Documentation:** `/docs/` directory
- **Protocol Spec:** `protocol-spec.json`
- **Issues:** GitHub issues
- **Community:** Bioregion governance

The protocol is the platform. Your business is native to it.
