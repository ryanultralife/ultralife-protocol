# UltraLife Bioregions

**Bioregions are ecological boundaries—watersheds, ecosystems, natural features—not political lines.**

---

## What is a Bioregion?

A bioregion is a geographic area defined by natural characteristics:
- Watersheds and river basins
- Mountain ranges and valleys
- Climate zones
- Native species distributions
- Soil types and geology

UltraLife uses bioregions instead of political borders because:
- Ecosystems don't follow country/state lines
- Environmental health is measured at ecological scale
- Local governance matches natural community boundaries
- Economic activity is geographically situated

---

## North American Bioregions (Initial Set)

### Sierra Nevada
```
ID:        sierra_nevada
Location:  California/Nevada, USA
Bounds:    35.5°N to 40.5°N, 122.0°W to 117.5°W
Features:  Mountain range, alpine lakes, forests, meadows
Watershed: Sacramento River, San Joaquin River basins
```

**Initial Health Metrics:**
| Metric | Score | Notes |
|--------|-------|-------|
| Air Quality | 75% | Wildfire smoke impacts |
| Water Quality | 80% | Snowpack decline concerns |
| Biodiversity | 70% | Species stress from drought |
| Carbon Balance | 65% | Forest fire carbon release |
| Soil Health | 75% | Generally healthy |
| **Overall** | **73%** | |

---

### Pacific Northwest
```
ID:        pacific_northwest
Location:  Oregon, Washington, British Columbia
Bounds:    42.0°N to 49.0°N, 124.5°W to 116.0°W
Features:  Temperate rainforest, Cascade Range, coastline
Watershed: Columbia River, Puget Sound
```

**Initial Health Metrics:**
| Metric | Score | Notes |
|--------|-------|-------|
| Air Quality | 80% | Generally good |
| Water Quality | 85% | Clean rivers and streams |
| Biodiversity | 80% | Rich salmon runs |
| Carbon Balance | 85% | Dense forest carbon sink |
| Soil Health | 80% | Healthy forest soils |
| **Overall** | **82%** | |

---

### Great Lakes
```
ID:        great_lakes
Location:  Michigan, Wisconsin, Minnesota, Ontario
Bounds:    41.0°N to 49.0°N, 92.0°W to 76.0°W
Features:  Five Great Lakes, boreal forest, wetlands
Watershed: Great Lakes Basin
```

**Initial Health Metrics:**
| Metric | Score | Notes |
|--------|-------|-------|
| Air Quality | 70% | Industrial legacy |
| Water Quality | 75% | Improving from historical pollution |
| Biodiversity | 70% | Invasive species pressure |
| Carbon Balance | 70% | Mixed forest/urban |
| Soil Health | 75% | Agricultural impacts |
| **Overall** | **72%** | |

---

### Gulf Coast
```
ID:        gulf_coast
Location:  Texas, Louisiana, Mississippi, Alabama, Florida
Bounds:    25.0°N to 31.0°N, 97.5°W to 80.0°W
Features:  Wetlands, bayous, barrier islands, estuaries
Watershed: Mississippi River Delta, Gulf of Mexico
```

**Initial Health Metrics:**
| Metric | Score | Notes |
|--------|-------|-------|
| Air Quality | 70% | Petrochemical industry |
| Water Quality | 65% | Nutrient runoff, dead zones |
| Biodiversity | 75% | Rich wetland ecosystems |
| Carbon Balance | 65% | Wetland loss |
| Soil Health | 70% | Subsidence issues |
| **Overall** | **69%** | |

---

### Sonoran Desert
```
ID:        sonoran_desert
Location:  Arizona, California, Sonora (Mexico)
Bounds:    28.0°N to 35.0°N, 117.0°W to 109.0°W
Features:  Desert, saguaro forests, mountain islands
Watershed: Colorado River, Gila River
```

**Initial Health Metrics:**
| Metric | Score | Notes |
|--------|-------|-------|
| Air Quality | 85% | Clean desert air |
| Water Quality | 50% | Severe water scarcity |
| Biodiversity | 65% | Unique but stressed |
| Carbon Balance | 55% | Limited vegetation |
| Soil Health | 60% | Desert soils |
| **Overall** | **63%** | |

---

## Health Index

Each bioregion has a health index (0-10000, displayed as 0-100%):

```
0%   - Ecological collapse
25%  - Severely degraded
50%  - Struggling but functional
75%  - Healthy with some stress
100% - Thriving ecosystem
```

### Health Updates

- Updated every 37-day cycle (aligned with protocol epochs)
- Requires Steward approval from the bioregion
- Based on environmental metrics with evidence hash
- Affects UBI distribution multiplier

### UBI Impact

UBI distribution is weighted by bioregion health:

```
Bioregion at 100% health → 1.0x base UBI
Bioregion at 73% health  → 0.73x base UBI
```

This creates incentive for environmental stewardship.

---

## Stake Pools Per Bioregion

Each bioregion can have multiple stake pools:

| Bioregion | Example Pools |
|-----------|---------------|
| Sierra Nevada | Sierra Nevada A, Sierra Nevada B, Sierra Nevada C |
| Pacific Northwest | Pacific Northwest A, Pacific Northwest B |
| Great Lakes | Great Lakes A, Great Lakes B |
| Gulf Coast | Gulf Coast A |
| Sonoran Desert | Sonoran Desert A |

Pools **cooperate** to serve their bioregion:
- Combined stake = Total bioregion credit capacity
- Each pool can underwrite up to 50% of stake
- Pools coordinate on regional projects

---

## Creating a New Bioregion

Requirements:
1. **Minimum founders** - 10 Verified-level pNFT holders
2. **Ecological justification** - Must be a natural boundary
3. **Name and bounds hash** - Geographic definition
4. **Steward endorsements** - Existing Stewards approve

Process:
```
1. Community identifies ecological boundary
2. 10+ Verified residents commit to founding
3. Submit CreateBioregion transaction
4. Beacon token minted for bioregion
5. Initial health set to 50%
6. Founders register residency
```

---

## Commands

```bash
# List all bioregions
npm run list:bioregions

# Register a pool for a bioregion
npm run register:bioregion --bioregion "Sierra Nevada"

# See bioregion health
# (tell your LLM agent)
"What's the health index of Sierra Nevada?"
```

---

## Data Model

```aiken
pub type BioregionDatum {
  bioregion_id: ByteArray,      // Unique identifier
  name_hash: ByteArray,         // Hash of name
  bounds_hash: ByteArray,       // Hash of geographic bounds
  health_index: Int,            // 0-10000 (0-100%)
  resident_count: Int,          // Number of registered residents
  created_at: Int,              // Slot when created
  last_health_update: Int,      // Last update cycle
  stake_pools: List<ByteArray>, // Registered pool IDs
}
```

---

**Bioregions organize UltraLife around natural boundaries, not political ones.**
