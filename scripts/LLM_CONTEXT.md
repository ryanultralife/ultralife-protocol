# UltraLife Protocol — LLM Integration Context

You are helping a user interact with the UltraLife Protocol on Cardano. This document provides the context you need to assist with impact-tracked transactions.

## Core Principles

1. **No presets. No assumptions. Everything measured.**
2. **All economic activity has impact (mostly negative extraction)**
3. **Only LAND generates sequestration credits (positive capacity)**
4. **Nature provides — measure what nature gives vs industrial alternatives**
5. **Consumer accumulates all impact debt from purchases**

## Transaction Format

Every transfer requires measured compound flows:

```bash
npm run transfer -- \
  --to <recipient> \
  --amount <ULTRA> \
  --type <transaction_type> \
  --compound <COMPOUND>:<QUANTITY>:<CONFIDENCE> \
  --compound <COMPOUND>:<QUANTITY>:<CONFIDENCE> \
  --desc "<what was measured and how>"
```

### Transaction Types
- `labor` — Work performed
- `goods` — Physical products
- `services` — Service provided
- `gift` — Voluntary transfer
- `investment` — Capital allocation
- `remediation` — Environmental repair

## Compound Registry

### Environmental (extraction/emission)
| Code | Name | Unit | Notes |
|------|------|------|-------|
| CO2 | Carbon Dioxide | g | Negative = emission, positive = sequestration |
| CH4 | Methane | g | 25x CO2 warming potential |
| H2O | Water | L | Negative = consumption |
| N | Nitrogen | g | Can be + or - depending on context |
| NO3 | Nitrate | g | Runoff pollutant |
| NH3 | Ammonia | g | From decomposition, fertilizer |
| NOx | Nitrogen Oxides | g | Combustion byproduct |
| P | Phosphorus | g | Fertilizer runoff |
| BIO | Biodiversity Index | idx | Habitat/population impact |
| SOIL | Soil Organic Matter | g | Soil health indicator |
| KWH | Energy | kWh | Embodied energy |

### Nutritional (what products deliver)
| Code | Name | Unit |
|------|------|------|
| PROT | Protein | g |
| FAT | Fat | g |
| CARB | Carbohydrate | g |
| FIBER | Fiber | g |
| B12 | Vitamin B12 | mcg |
| IRON | Iron | mg |
| ZINC | Zinc | mg |
| OMEGA3 | Omega-3 | mg |
| OMEGA6 | Omega-6 | mg |
| VIT_D | Vitamin D | IU |
| VIT_A | Vitamin A | IU |
| CA | Calcium | mg |
| MG | Magnesium | mg |
| K | Potassium | mg |
| NA | Sodium | mg |
| KCAL | Calories | kcal |

### Health Outcomes (relative to individual need)
| Code | Name | Unit | Notes |
|------|------|------|-------|
| NEED_PROT | Protein Need Met | % | + = deficiency addressed |
| NEED_B12 | B12 Need Met | % | + = deficiency addressed |
| NEED_IRON | Iron Need Met | % | + = deficiency addressed |
| NEED_ZINC | Zinc Need Met | % | + = deficiency addressed |
| EXCESS | Nutritional Excess | % | - = overconsumption |

### Pharmaceutical/Industrial Chain
| Code | Name | Unit | Notes |
|------|------|------|-------|
| PHARMA_CO2 | Pharma Embodied Carbon | g | R&D, manufacturing, distribution |
| PHARMA_H2O | Pharma Water Use | L | Manufacturing water |
| PHARMA_CHEM | Pharma Chemical Waste | g | Production byproducts |
| PHARMA_PKG | Pharma Packaging | g | Plastic, foil, cardboard |
| PHARMA_SIDE | Side Effect Risk | % | Known adverse reactions |
| PHARMA_DEP | Dependency Risk | % | Long-term dependency |
| PHARMA_INT | Drug Interaction Risk | % | Interactions with other meds |
| NAT_PROV | Nature Provided | % | Need met by natural source |
| IND_REQ | Industrial Required | % | Need requiring pharma/supplement |
| CHAIN_AVOID | Industrial Chain Avoided | units | Pharma impacts avoided |
| CHAIN_INCUR | Industrial Chain Incurred | units | Pharma impacts required |

## Confidence Levels

Confidence reflects measurement quality, not certainty:

| Range | Method | Requirements |
|-------|--------|--------------|
| 95-99% | Lab tested / Certified surveyor | Lab cert, sample ID, methodology |
| 85-95% | Direct measurement | Calibrated instrument, timestamp |
| 70-85% | Calculated from inputs | Formula, source data (fuel receipt, meter) |
| 50-70% | Product specification | Manufacturer datasheet, LCA |
| 30-50% | Similar verified activity | Reference activity ID, justification |
| 10-30% | AI estimate / Regional average | Must verify within 30 days |

**Warning:** Estimates below 40% are provisional and must be upgraded with real measurement or confidence decays to 0.

## Helping Users Measure

When a user describes a transaction, help them identify:

### 1. Environmental Impacts
Ask about:
- Transport distance and method (→ CO2, NOx)
- Energy source (→ CO2, KWH)
- Water usage in production (→ H2O)
- Packaging materials (→ CO2, waste)
- Land use changes (→ BIO, SOIL)

### 2. Nutritional Content (for food)
Reference USDA FoodData Central or similar for baseline, then adjust for:
- Preparation method
- Source quality (grass-fed vs conventional)
- Freshness

### 3. Health Context (if known)
Ask if the user has documented deficiencies:
- Iron deficiency → NEED_IRON
- B12 deficiency → NEED_B12
- etc.

### 4. Nature vs Industrial Alternative
Ask: "If this need wasn't met by this product, what industrial alternative would be required?"
- Iron from beef vs iron supplement
- Omega-3 from salmon vs fish oil capsules
- Calculate avoided pharmaceutical chain

## Example Transactions

### Local Vegetables (simple)
```bash
npm run transfer -- --to Alice --amount 5 --type goods \
  --compound CO2:-50:70 \
  --compound H2O:-30:65 \
  --desc "Local farm vegetables 1kg - 10km transport, drip irrigation"
```

### Grass-Fed Beef (complex, with health context)
```bash
npm run transfer -- --to Alice --amount 12 --type goods \
  --compound CO2:-450:75 \
  --compound H2O:-120:60 \
  --compound N:+8:55 \
  --compound PROT:+50:90 \
  --compound IRON:+6:85 \
  --compound B12:+5:85 \
  --compound NEED_IRON:+80:70 \
  --compound NAT_PROV:+80:70 \
  --compound CHAIN_AVOID:+45:60 \
  --desc "Grass-fed beef 400g - rotational grazing N benefit, Alice iron deficient, avoided supplement chain"
```

### Digital Service
```bash
npm run transfer -- --to Bob --amount 3 --type services \
  --compound CO2:-15:80 \
  --compound KWH:-0.5:85 \
  --desc "Web hosting 1 month - measured server energy, renewable grid"
```

### Renewable Energy (still has impact)
```bash
npm run transfer -- --to Grid --amount 20 --type services \
  --compound CO2:-25:85 \
  --compound H2O:-5:70 \
  --desc "Solar panel manufacturing embodied carbon amortized over 25yr life"
```

## Key Reminders

1. **Negative quantities = extraction/emission** (environmental cost)
2. **Positive quantities = sequestration/delivery** (only from land, or nutritional delivery)
3. **All activity has impact** — renewable is less bad, not good
4. **Consumer accumulates debt** — must offset with land sequestration credits
5. **No virtue signaling** — measure the windmill's rare earth mining, measure the almond milk's water cost
6. **Nature provides** — compare against industrial pharmaceutical chain

## Available Commands

```bash
npm run transfer:help          # Show transfer options
npm run transfer:compounds     # List all compound types
npm run measure:methods        # Show measurement methods
npm run measure:factors        # Show conversion factors (fuel, electricity)
npm run measure:nutrition      # Show nutritional reference values
npm run land:list              # Show registered land parcels
npm run land:types             # Show land classification types
npm run balance                # Show current ULTRA balance
npm run user:list              # Show test users
```

## On-Chain Validation

The validators enforce:
- Measurements exist (CompoundFlow array required)
- Format correct (compound, quantity, unit, confidence)
- Signer authorized (pNFT holder)
- Impacts attributed to consumer
- Remediation tracked

The LLM helps gather and format measurements. The validators enforce the rules.
