# Impact Compounds: The Chemistry of Activity

## Core Principle

**Impacts are not abstract metrics. They are actual chemical compounds that result from physical activity.**

When you pour concrete, you don't generate "carbon impact" — you release specific molecules:
- CO₂ (carbon dioxide)
- Ca(OH)₂ (calcium hydroxide)
- NOₓ (nitrogen oxides)
- PM₂.₅ (fine particulates)

When a forest grows, it doesn't create "biodiversity impact" — it:
- Fixes CO₂ into C₆H₁₂O₆ (glucose) → cellulose, lignin
- Transpires H₂O
- Produces O₂
- Creates habitat (physical structure, not a compound)

The impact system must track **actual chemistry**, not abstract categories.

---

## Part 1: Impact System Architecture

```
ACTIVITY → COMPOUNDS PRODUCED/CONSUMED → SYSTEM DOMAIN AFFECTED

Example: Concrete Foundation
├── Activity: Pour 400 m² foundation
│
├── Compounds Produced:
│   ├── CO₂: 112.5 kg (cement calcination + equipment)
│   ├── NOₓ: 0.32 kg (equipment exhaust)
│   ├── PM₂.₅: 0.08 kg (dust, exhaust)
│   ├── SOₓ: 0.05 kg (diesel sulfur)
│   └── Waste calcium hydroxide: trace
│
├── Compounds Consumed:
│   ├── H₂O: 2,350 L (concrete mix, curing)
│   ├── O₂: 45 kg (combustion)
│   └── Cite calcium carbonate (limestone): 1,800 kg
│
└── System Domains Affected:
    ├── Carbon Cycle: +112.5 kg CO₂ released
    ├── Air Quality: +NOₓ, +PM₂.₅, +SOₓ
    ├── Water Cycle: -2,350 L consumed
    └── Geology: -1,800 kg limestone extracted
```

---

## Part 2: Compound Registry

### Carbon Compounds

```
CARBON_COMPOUNDS:
├── CO₂ (Carbon Dioxide)
│   ├── Formula: CO₂
│   ├── Molecular weight: 44.01 g/mol
│   ├── Climate forcing: ~1.0 (reference)
│   ├── Persistence: Centuries
│   └── System: Global atmosphere
│
├── CH₄ (Methane)
│   ├── Formula: CH₄
│   ├── Molecular weight: 16.04 g/mol
│   ├── Climate forcing: ~84 (20yr), ~28 (100yr)
│   ├── Persistence: ~12 years
│   └── System: Global atmosphere
│
├── CO (Carbon Monoxide)
│   ├── Formula: CO
│   ├── Molecular weight: 28.01 g/mol
│   ├── Toxicity: High (hemoglobin binding)
│   ├── Persistence: ~2 months
│   └── System: Local/Regional atmosphere
│
├── C₆H₁₂O₆ (Glucose/Sugar)
│   ├── Formula: C₆H₁₂O₆
│   ├── Molecular weight: 180.16 g/mol
│   ├── Biosphere role: Energy storage
│   └── System: Biosphere
│
├── (C₆H₁₀O₅)ₙ (Cellulose)
│   ├── Formula: (C₆H₁₀O₅)ₙ
│   ├── Biosphere role: Structural carbon
│   ├── Carbon content: ~44% by mass
│   └── System: Biosphere (plants)
│
├── Lignin (complex polymer)
│   ├── Approximate: C₉H₁₀O₂ (monomer)
│   ├── Biosphere role: Structural carbon (wood)
│   ├── Carbon content: ~60-65% by mass
│   └── System: Biosphere (woody plants)
│
├── Humus/Soil Carbon
│   ├── Highly variable organic matter
│   ├── Carbon content: Variable
│   └── System: Pedosphere (soil)
│
└── Biochar
    ├── Formula: C (elemental, structured)
    ├── Carbon content: 70-90% by mass
    ├── Persistence: Centuries to millennia
    └── System: Pedosphere (applied to soil)
```

### Nitrogen Compounds

```
NITROGEN_COMPOUNDS:
├── N₂ (Diatomic Nitrogen)
│   ├── Formula: N₂
│   ├── Atmosphere: 78%
│   └── Biologically inert (mostly)
│
├── NOₓ (Nitrogen Oxides)
│   ├── NO (Nitric Oxide): Combustion product
│   ├── NO₂ (Nitrogen Dioxide): Combustion, smog precursor
│   ├── Toxicity: Respiratory irritant
│   └── System: Local/Regional atmosphere
│
├── N₂O (Nitrous Oxide)
│   ├── Formula: N₂O
│   ├── Climate forcing: ~273 (100yr)
│   ├── Sources: Agriculture, combustion
│   └── System: Global atmosphere
│
├── NH₃ (Ammonia)
│   ├── Formula: NH₃
│   ├── Sources: Agriculture, decomposition
│   ├── Toxicity: Irritant, water pollutant
│   └── System: Local atmosphere, water
│
├── NO₃⁻ (Nitrate)
│   ├── Formula: NO₃⁻
│   ├── Water pollutant: Eutrophication
│   └── System: Hydrosphere
│
└── N-Organic (Proteins, etc.)
    ├── Various amino acids, proteins
    └── System: Biosphere
```

### Sulfur Compounds

```
SULFUR_COMPOUNDS:
├── SO₂ (Sulfur Dioxide)
│   ├── Formula: SO₂
│   ├── Source: Fossil fuel combustion
│   ├── Effect: Acid rain precursor
│   └── System: Local/Regional atmosphere
│
├── SO₃ (Sulfur Trioxide)
│   ├── Formula: SO₃
│   ├── Effect: Reacts to form sulfuric acid
│   └── System: Atmosphere
│
├── H₂S (Hydrogen Sulfide)
│   ├── Formula: H₂S
│   ├── Toxicity: Highly toxic
│   ├── Source: Decomposition, industrial
│   └── System: Local atmosphere
│
└── SO₄²⁻ (Sulfate)
    ├── Formula: SO₄²⁻
    └── System: Water, soil
```

### Water & Oxygen

```
WATER_OXYGEN_COMPOUNDS:
├── H₂O (Water)
│   ├── Formula: H₂O
│   ├── States: Liquid, vapor, ice
│   └── System: Hydrosphere, atmosphere
│
├── O₂ (Oxygen)
│   ├── Formula: O₂
│   ├── Atmosphere: 21%
│   ├── Source: Photosynthesis
│   └── System: Atmosphere, biosphere
│
└── O₃ (Ozone)
    ├── Formula: O₃
    ├── Stratospheric: Protective
    ├── Tropospheric: Pollutant
    └── System: Atmosphere
```

### Phosphorus Compounds

```
PHOSPHORUS_COMPOUNDS:
├── PO₄³⁻ (Phosphate)
│   ├── Formula: PO₄³⁻
│   ├── Essential nutrient
│   ├── Water pollutant: Eutrophication
│   └── System: Pedosphere, hydrosphere
│
└── P-Organic (ATP, DNA, etc.)
    ├── Various phosphorus-containing biomolecules
    └── System: Biosphere
```

### Metals & Minerals

```
METALS_MINERALS:
├── Fe compounds
│   ├── Fe₂O₃ (Hematite/rust)
│   ├── FeS₂ (Pyrite)
│   └── System: Lithosphere, industrial
│
├── Al compounds
│   ├── Al₂O₃ (Alumina)
│   └── System: Lithosphere, industrial
│
├── Heavy metals
│   ├── Pb (Lead)
│   ├── Hg (Mercury)
│   ├── Cd (Cadmium)
│   ├── As (Arsenic)
│   └── System: Toxic pollutants
│
└── Ca compounds
    ├── CaCO₃ (Calcium carbonate/limestone)
    ├── Ca(OH)₂ (Calcium hydroxide/lime)
    └── System: Lithosphere, construction
```

### Particulates

```
PARTICULATES:
├── PM₁₀ (Coarse particulate matter)
│   ├── Size: <10 μm
│   └── System: Local atmosphere
│
├── PM₂.₅ (Fine particulate matter)
│   ├── Size: <2.5 μm
│   ├── Health impact: High (respiratory)
│   └── System: Local/regional atmosphere
│
├── Black carbon (soot)
│   ├── Source: Incomplete combustion
│   ├── Climate forcing: High (short-lived)
│   └── System: Atmosphere, cryosphere
│
└── Dust (various minerals)
    ├── Source: Wind erosion, construction
    └── System: Local atmosphere
```

---

## Part 3: Compound Codes for Smart Contracts

```aiken
/// Compound identifier — actual chemical formula
/// First byte: Element group, remaining bytes: specific compound
pub type CompoundCode = ByteArray

// Carbon compounds (0x01xx)
const CO2: CompoundCode = #"0101"      // Carbon dioxide
const CH4: CompoundCode = #"0102"      // Methane
const CO: CompoundCode = #"0103"       // Carbon monoxide
const C6H12O6: CompoundCode = #"0104"  // Glucose
const CELLULOSE: CompoundCode = #"0105" // Cellulose polymer
const LIGNIN: CompoundCode = #"0106"   // Lignin polymer
const HUMUS: CompoundCode = #"0107"    // Soil organic carbon
const BIOCHAR: CompoundCode = #"0108"  // Biochar

// Nitrogen compounds (0x02xx)
const N2: CompoundCode = #"0201"       // Diatomic nitrogen
const NO: CompoundCode = #"0202"       // Nitric oxide
const NO2: CompoundCode = #"0203"      // Nitrogen dioxide
const N2O: CompoundCode = #"0204"      // Nitrous oxide
const NH3: CompoundCode = #"0205"      // Ammonia
const NO3: CompoundCode = #"0206"      // Nitrate ion
const N_ORGANIC: CompoundCode = #"0207" // Organic nitrogen

// Sulfur compounds (0x03xx)
const SO2: CompoundCode = #"0301"      // Sulfur dioxide
const SO3: CompoundCode = #"0302"      // Sulfur trioxide
const H2S: CompoundCode = #"0303"      // Hydrogen sulfide
const SO4: CompoundCode = #"0304"      // Sulfate ion

// Water & oxygen (0x04xx)
const H2O: CompoundCode = #"0401"      // Water
const O2: CompoundCode = #"0402"       // Oxygen
const O3: CompoundCode = #"0403"       // Ozone

// Phosphorus (0x05xx)
const PO4: CompoundCode = #"0501"      // Phosphate
const P_ORGANIC: CompoundCode = #"0502" // Organic phosphorus

// Particulates (0x06xx)
const PM10: CompoundCode = #"0601"     // Coarse particulates
const PM25: CompoundCode = #"0602"     // Fine particulates
const BLACK_CARBON: CompoundCode = #"0603" // Soot
const DUST: CompoundCode = #"0604"     // Mineral dust

// Metals (0x07xx)
const FE: CompoundCode = #"0701"       // Iron compounds
const AL: CompoundCode = #"0702"       // Aluminum compounds
const PB: CompoundCode = #"0703"       // Lead
const HG: CompoundCode = #"0704"       // Mercury
const CD: CompoundCode = #"0705"       // Cadmium
const AS: CompoundCode = #"0706"       // Arsenic

// Calcium (0x08xx)
const CALCIUM_ITE: CompoundCode = #"0801"  // CaCO3
const CALCIUM_HYDROXIDE: CompoundCode = #"0802" // Ca(OH)2
```

---

## Part 4: Impact Structure (Revised)

```aiken
/// A single compound flow — what actually moved in the physical world
pub type CompoundFlow {
  /// Which compound
  compound: CompoundCode,
  /// Direction: Positive = released/produced, Negative = consumed/sequestered
  quantity: Int,
  /// Unit (grams, kg, liters, mol)
  unit: MassUnit,
  /// Measurement method
  measurement: MeasurementMethod,
  /// Confidence in this measurement (0-100)
  confidence: Int,
}

/// Unit of mass/volume
pub type MassUnit {
  Grams
  Kilograms
  MetricTons
  Liters
  CubicMeters
  Moles
}

/// How was this measured?
pub type MeasurementMethod {
  /// Direct measurement (sensor, lab test)
  Direct { 
    instrument: ByteArray,
    calibration_date: Int,
  }
  /// Calculated from activity data
  Calculated {
    formula: ByteArray,
    input_sources: List<ByteArray>,
  }
  /// Estimated from similar activities
  Estimated {
    reference: ByteArray,
    similarity: Int, // 0-100
  }
  /// Certified by surveyor
  Surveyed {
    surveyor_pnft: AssetName,
    survey_date: Int,
  }
}

/// Complete impact record for an activity
pub type ActivityImpact {
  /// What activity occurred
  activity_type: ActivityType,
  /// All compounds that flowed
  compound_flows: List<CompoundFlow>,
  /// Where this occurred
  location: Location,
  /// When (start, end)
  time_range: (Int, Int),
  /// Who performed the activity (pNFT)
  performer: AssetName,
  /// What asset was affected
  asset: AssetReference,
  /// Evidence
  evidence: EvidenceBundle,
}

/// Activity types that generate impacts
pub type ActivityType {
  // Construction
  ConcreteFoundation { area: Int, thickness: Int }
  SteelErection { weight: Int }
  WoodFraming { volume: Int }
  Excavation { volume: Int }
  Paving { area: Int, material: ByteArray }
  
  // Agriculture
  Planting { area: Int, crop: ByteArray }
  Harvesting { area: Int, yield: Int }
  Tillage { area: Int, depth: Int }
  Irrigation { volume: Int }
  Fertilization { type_: ByteArray, quantity: Int }
  PesticideApplication { type_: ByteArray, quantity: Int }
  
  // Forestry
  TreePlanting { count: Int, species: ByteArray }
  SelectiveHarvest { volume: Int }
  ClearCut { area: Int }
  ForestRegeneration { area: Int }
  
  // Transport
  VehicleTrip { distance: Int, vehicle_type: ByteArray, fuel: ByteArray }
  Shipping { weight: Int, distance: Int, mode: ByteArray }
  
  // Energy
  ElectricityGeneration { kwh: Int, source: ByteArray }
  ElectricityConsumption { kwh: Int }
  FuelCombustion { fuel_type: ByteArray, quantity: Int }
  
  // Manufacturing
  MaterialProcessing { input: ByteArray, output: ByteArray, quantity: Int }
  
  // Living
  Respiration { hours: Int } // Yes, humans breathe too
  FoodConsumption { calories: Int, food_type: ByteArray }
  
  // Ecosystem Services (passive)
  Photosynthesis { area: Int, vegetation_type: ByteArray }
  Decomposition { mass: Int }
  WatershedFiltration { volume: Int }
}

/// Evidence bundle for verification
pub type EvidenceBundle {
  /// Photo hashes (IPFS)
  photos: List<ByteArray>,
  /// Sensor data hashes
  sensor_data: List<ByteArray>,
  /// Material receipts/manifests
  receipts: List<ByteArray>,
  /// GPS/location logs
  location_logs: ByteArray,
  /// Third-party attestations
  attestations: List<Attestation>,
}

/// Third-party attestation
pub type Attestation {
  /// Who attested (pNFT)
  attester: AssetName,
  /// What they attested to
  statement_hash: ByteArray,
  /// When
  timestamp: Int,
  /// Their qualifications relevant to this attestation
  qualifications: List<ByteArray>,
}
```

---

## Part 5: Example — Concrete Foundation (Corrected)

### Work Request

```json
{
  "activity": {
    "type": "ConcreteFoundation",
    "area": 400,
    "thickness": 0.15
  },
  "asset": {
    "id": "LandNFT_123",
    "bioregion": "BioregionNFT_456"
  },
  "expected_compounds": {
    "produced": [
      {"compound": "CO2", "quantity": {"min": 100, "max": 130}, "unit": "kg"},
      {"compound": "NOx", "quantity": {"min": 0.2, "max": 0.4}, "unit": "kg"},
      {"compound": "PM25", "quantity": {"min": 0.05, "max": 0.1}, "unit": "kg"}
    ],
    "consumed": [
      {"compound": "H2O", "quantity": {"min": 2000, "max": 2500}, "unit": "L"},
      {"compound": "CaCO3", "quantity": {"min": 1500, "max": 2000}, "unit": "kg"}
    ]
  }
}
```

### Work Completion

```json
{
  "activity": {
    "type": "ConcreteFoundation",
    "area": 400,
    "thickness": 0.15,
    "start": "2025-03-01T08:00:00Z",
    "end": "2025-03-04T12:00:00Z"
  },
  "performer": "DNA_NFT_Worker1",
  "compound_flows": [
    {
      "compound": "CO2",
      "quantity": 112500,
      "unit": "grams",
      "measurement": {
        "type": "Calculated",
        "formula": "cement_kg * 0.05 + diesel_L * 2.68",
        "input_sources": ["cement_receipt", "fuel_receipt"]
      },
      "confidence": 85
    },
    {
      "compound": "NO2",
      "quantity": 280,
      "unit": "grams",
      "measurement": {
        "type": "Calculated",
        "formula": "diesel_L * 0.007",
        "input_sources": ["fuel_receipt"]
      },
      "confidence": 75
    },
    {
      "compound": "PM25",
      "quantity": 80,
      "unit": "grams",
      "measurement": {
        "type": "Estimated",
        "reference": "EPA_construction_dust_factors",
        "similarity": 70
      },
      "confidence": 60
    },
    {
      "compound": "H2O",
      "quantity": -2350000,
      "unit": "grams",
      "measurement": {
        "type": "Direct",
        "instrument": "water_meter_001",
        "calibration_date": "2025-01-15"
      },
      "confidence": 95,
      "note": "Negative = consumed"
    },
    {
      "compound": "CaCO3",
      "quantity": -1800000,
      "unit": "grams",
      "measurement": {
        "type": "Direct",
        "instrument": "scale_receipt",
        "calibration_date": "2025-02-28"
      },
      "confidence": 98,
      "note": "Negative = consumed (mined limestone)"
    }
  ],
  "evidence": {
    "photos": ["hash_start_1", "hash_progress_2", "hash_complete_3"],
    "receipts": ["cement_receipt_hash", "fuel_receipt_hash", "water_bill_hash"],
    "location_logs": "gps_log_hash",
    "attestations": [
      {
        "attester": "inspector_pnft_789",
        "statement_hash": "foundation_inspection_passed",
        "timestamp": "2025-03-04T14:00:00Z",
        "qualifications": ["OSHA30", "FoundationCert"]
      }
    ]
  }
}
```

### Impact Tokens Generated

```json
[
  {
    "token_id": "ImpactToken_CO2_20250304_001",
    "compound": "CO2",
    "quantity": 112.5,
    "unit": "kg",
    "direction": "Produced",
    "source": {
      "activity": "ConcreteFoundation",
      "asset": "LandNFT_123",
      "performer": "DNA_NFT_Worker1",
      "bioregion": "BioregionNFT_456",
      "timestamp": "2025-03-04T12:00:00Z"
    },
    "measurement_confidence": 85,
    "remediation_status": "Unremediated",
    "remediation_options": [
      {
        "method": "Tree planting",
        "provider": "ForestProject_789",
        "sequestration_rate": "20 kg CO2/tree/year",
        "trees_needed": 6,
        "time_to_offset": "1 year"
      },
      {
        "method": "Biochar application",
        "provider": "FarmCollective_456",
        "sequestration_rate": "3 kg CO2/kg biochar",
        "biochar_needed": "38 kg",
        "time_to_offset": "Immediate"
      }
    ]
  },
  {
    "token_id": "ImpactToken_NO2_20250304_001",
    "compound": "NO2",
    "quantity": 0.28,
    "unit": "kg",
    "direction": "Produced",
    "source": {
      "activity": "ConcreteFoundation",
      "asset": "LandNFT_123",
      "performer": "DNA_NFT_Worker1",
      "bioregion": "BioregionNFT_456"
    },
    "measurement_confidence": 75,
    "remediation_status": "Unremediated",
    "remediation_options": [
      {
        "method": "Green buffer planting",
        "provider": "UrbanForest_123",
        "absorption_rate": "0.05 kg NO2/tree/year",
        "trees_needed": 6,
        "time_to_offset": "1 year"
      }
    ]
  },
  {
    "token_id": "ImpactToken_H2O_20250304_001",
    "compound": "H2O",
    "quantity": 2350,
    "unit": "L",
    "direction": "Consumed",
    "source": {
      "activity": "ConcreteFoundation",
      "asset": "LandNFT_123",
      "performer": "DNA_NFT_Worker1",
      "bioregion": "BioregionNFT_456"
    },
    "measurement_confidence": 95,
    "water_source": "Municipal",
    "remediation_status": "Unremediated",
    "remediation_options": [
      {
        "method": "Rainwater harvesting installation",
        "provider": "WaterSystems_456",
        "capacity": "5000 L",
        "replenishment_time": "2 rain events"
      },
      {
        "method": "Watershed restoration",
        "provider": "WatershedTrust_789",
        "contribution": "2350 L equivalent"
      }
    ]
  }
]
```

---

## Part 6: Life's Formulas — The Photosynthesis Example

When a forest sequesters carbon, here's the actual chemistry:

### Photosynthesis (the core equation)

```
6 CO₂ + 6 H₂O + light energy → C₆H₁₂O₆ + 6 O₂

In UltraLife:
├── Compound flows (per kg glucose produced):
│   ├── CO2: -2.64 kg (consumed)
│   ├── H2O: -1.08 kg (consumed, some released)
│   └── O2: +1.92 kg (produced)
│
├── Then glucose → cellulose:
│   └── C₆H₁₂O₆ → (C₆H₁₀O₅)ₙ + H₂O
│
└── Net carbon sequestration:
    └── ~1.83 kg CO₂ per kg dry biomass produced
```

### Forest Plot Recording

```json
{
  "activity": {
    "type": "Photosynthesis",
    "area": 10000,
    "vegetation_type": "mixed_oak_pine",
    "measurement_period": "2025-Q1"
  },
  "asset": "LandNFT_ForestPlot_123",
  "performer": "Ecosystem", // Not a human — passive process
  "surveyor": "carlos_surveyor_pnft",
  "compound_flows": [
    {
      "compound": "CO2",
      "quantity": -45000000,
      "unit": "grams",
      "measurement": {
        "type": "Surveyed",
        "surveyor_pnft": "carlos_surveyor_pnft",
        "method": "Biomass increment sampling + allometric equations"
      },
      "confidence": 80,
      "note": "Negative = sequestered (removed from atmosphere)"
    },
    {
      "compound": "O2",
      "quantity": 32700000,
      "unit": "grams",
      "measurement": {
        "type": "Calculated",
        "formula": "CO2_sequestered * 0.727",
        "input_sources": ["photosynthesis_stoichiometry"]
      },
      "confidence": 80
    },
    {
      "compound": "CELLULOSE",
      "quantity": 24500000,
      "unit": "grams",
      "measurement": {
        "type": "Surveyed",
        "method": "Biomass sampling"
      },
      "confidence": 75,
      "note": "Positive = produced (stored in trees)"
    }
  ]
}
```

### Impact Tokens Generated (Forest)

```json
[
  {
    "token_id": "ImpactToken_CO2_Forest_2025Q1_001",
    "compound": "CO2",
    "quantity": -45000,
    "unit": "kg",
    "direction": "Sequestered",
    "source": {
      "activity": "Photosynthesis",
      "asset": "LandNFT_ForestPlot_123",
      "performer": "Ecosystem",
      "surveyor": "carlos_surveyor_pnft",
      "bioregion": "SierraNevada_456"
    },
    "measurement_confidence": 80,
    "tradeable": true,
    "market_status": "Available",
    "current_price": "0.15 tokens/kg",
    "note": "This is a NEGATIVE impact token — it represents carbon REMOVED from atmosphere. Tradeable to offset positive (released) carbon."
  }
]
```

---

## Part 7: Remediation Through Chemistry

When someone needs to offset their CO₂ production, they're not buying an abstract "carbon credit" — they're paying for actual sequestration to happen:

```
REMEDIATION TRANSACTION:

ConcreteWorker needs to offset 112.5 kg CO₂
ForestProject has -45,000 kg CO₂ available (sequestered)

Transaction:
├── ConcreteWorker pays 16.88 tokens (112.5 kg × 0.15 tokens/kg)
├── ForestProject transfers 112.5 kg of sequestration claim
├── Both tokens are RETIRED (cancelled against each other)
│   ├── ImpactToken_CO2_20250304_001 (+112.5 kg, produced) → Retired
│   └── ImpactToken_CO2_Forest_2025Q1_001 (-112.5 kg portion) → Retired
│
└── Net result:
    ├── Atmosphere: Neutral (112.5 produced, 112.5 sequestered)
    ├── ConcreteWorker: Paid real cost of impact
    ├── ForestProject: Received payment for actual sequestration
    └── Chemistry balanced
```

---

## Part 8: Impact Categories vs Compounds

To clarify the relationship:

```
SYSTEM DOMAINS (Categories)     COMPOUNDS (Actual chemistry)
─────────────────────────────   ────────────────────────────
Carbon Cycle                    CO₂, CH₄, CO, Cellulose, Lignin, Humus
Nitrogen Cycle                  N₂O, NOₓ, NH₃, NO₃⁻, Proteins
Water Cycle                     H₂O (liquid, vapor)
Air Quality                     PM₂.₅, PM₁₀, O₃, SO₂, NOₓ
Soil Health                     Humus, minerals, microbial biomass
Biodiversity                    (Not a compound — tracking structure/habitat)
```

Biodiversity is special — it's not a chemical compound, it's a **structural/informational property** of ecosystems. We track it differently:

```json
{
  "activity": "HabitatAssessment",
  "asset": "LandNFT_123",
  "biodiversity_metrics": {
    "species_richness": 47,
    "shannon_index": 3.2,
    "habitat_connectivity": 0.85,
    "native_species_ratio": 0.92
  },
  "surveyor": "ecologist_pnft_456"
}
```

---

## Summary

**The old way (wrong):**
```
Activity → "Carbon Impact" → Abstract metric → Carbon credit
```

**The UltraLife way (correct):**
```
Activity → Actual compounds (CO₂, NOₓ, H₂O, PM₂.₅) → Chemistry balanced → Life flourishes
```

Every impact token represents **actual molecules** that moved in the physical world. Remediation means **actual chemistry** to balance those flows. Not abstractions. Not metrics. Real atoms, real molecules, real life.

This is the formula of life.
