# Machinery & Vehicle Impact Tracking

## The Problem

A new electric truck might have lower operational emissions than an old diesel, but manufacturing it released 50 tons of CO2. If the diesel has 5 years of life left, is replacement worth it?

**You can't answer this without tracking embodied impact from extraction through operation.**

## Machinery NFT: Complete Supply Chain in One Token

When a machine is manufactured, it gets its **own NFT** that carries ALL accumulated impact from the entire supply chain:

```
MACHINERY NFT MINTING

Supply Chain Data (accumulated before mint):
├── EXTRACTION: Iron ore mined in Brazil (12,000 kg CO2)
├── PROCESSING: Steel smelted in Korea (8,500 kg CO2)
├── COMPONENTS: Engine from Japan (6,200 kg CO2)
├── ASSEMBLY: Final in USA (3,100 kg CO2)
└── TRANSPORT: Ship + truck (2,200 kg CO2)

                    ▼

┌─────────────────────────────────────────────┐
│ MACHINERY NFT: Excavator CAT-320-2024-12345 │
├─────────────────────────────────────────────┤
│ machine_id: hash(serial + manufacturer)     │
│ manufacturer: caterpillar_pnft              │
│ manufactured_at: slot_12345                 │
│                                             │
│ SUPPLY CHAIN IMPACT:                        │
│ ├── Extraction: 12,000 kg CO2               │
│ ├── Processing: 8,500 kg CO2                │
│ ├── Components: 6,200 kg CO2                │
│ ├── Assembly: 3,100 kg CO2                  │
│ ├── Transport: 2,200 kg CO2                 │
│ └── TOTAL EMBODIED: 32,000 kg CO2           │
│                                             │
│ current_owner: construction_co_pnft         │
│ condition: 100%                             │
│ lifetime_usage: 0 hours                     │
└─────────────────────────────────────────────┘
```

## Supply Chain Phases

Each phase records its impact BEFORE the final NFT is minted:

### 1. Extraction (MaterialImpact)

```
Mining iron ore in Brazil:
├── material_code: "iron_ore"
├── quantity: 45,000 kg
├── extraction_bioregion: "south-america-brazil-minas-gerais"
├── extractor: vale_mining_pnft
├── compounds: [{ CO2: +12,000 kg }, { particulates: +50 kg }]
└── extracted_at: slot_10000
```

### 2. Processing (ProcessingImpact)

```
Smelting steel in Korea:
├── process_code: "steel_smelting"
├── input_materials: ["iron_ore_batch_123"]
├── output_material: "steel_sheet"
├── processor: posco_pnft
├── processing_bioregion: "asia-korea-pohang"
├── compounds: [{ CO2: +8,500 kg }, { SO2: +120 kg }]
└── processed_at: slot_10500
```

### 3. Components (ComponentImpact)

```
Manufacturing engine in Japan:
├── component_id: "engine_v8_diesel_001"
├── component_type: "engine"
├── inputs: ["steel_sheet_456", "aluminum_block_789"]
├── manufacturer: komatsu_engines_pnft
├── manufacturing_bioregion: "asia-japan-osaka"
├── compounds: [{ CO2: +6,200 kg }]
└── manufactured_at: slot_11000
```

### 4. Assembly (AssemblyImpact)

```
Final assembly in USA:
├── assembly_line: "cat_peoria_line_3"
├── components_used: ["engine_001", "chassis_002", "hydraulics_003", ...]
├── assembler: caterpillar_peoria_pnft
├── assembly_bioregion: "north-america-usa-illinois"
├── compounds: [{ CO2: +3,100 kg }]
└── assembled_at: slot_11500
```

### 5. Transport (TransportImpact)

```
Ship from Korea to USA:
├── leg_id: "transport_001"
├── from: "asia-korea-busan"
├── to: "north-america-usa-california-long-beach"
├── distance_km: 9,500
├── transport_mode: Sea { vessel_type: "container_ship" }
├── carrier: maersk_pnft
├── compounds: [{ CO2: +1,800 kg }]
└── transported_at: slot_11200

Truck to dealer:
├── leg_id: "transport_002"
├── from: "north-america-usa-california-long-beach"
├── to: "north-america-usa-california-fresno"
├── distance_km: 350
├── transport_mode: Road { vehicle_type: "flatbed_truck" }
├── carrier: local_trucking_pnft
├── compounds: [{ CO2: +400 kg }]
└── transported_at: slot_11400
```

## NFT Minting

When all supply chain data is recorded, the machinery NFT is minted:

```
MintMachineryNft {
  serial_hash: hash("CAT320-2024-12345"),
  machine_type: Excavator { bucket_m3: 1200, operating_weight_kg: 22000 },
  supply_chain: SupplyChainImpact {
    extraction: [iron_ore_impact, copper_impact, ...],
    processing: [steel_smelting_impact, ...],
    components: [engine_impact, chassis_impact, ...],
    assembly: final_assembly_impact,
    transport: [ship_impact, truck_impact],
    total_embodied: [{ CO2: 32,000 kg }, ...],
    data_completeness_bps: 9500,  // 95% of supply chain tracked
  },
  initial_owner: first_buyer_pnft,
  manufacturer_attestation: caterpillar_signature,
}
```

## Operational Tracking

After minting, operations are recorded against the NFT:

```
RecordOperation {
  machine_id: excavator_nft_001,
  operation: OperationalImpact {
    usage_amount: 8,
    usage_unit: PerHour,
    fuel_consumed: 160,
    fuel_type: Diesel,
    operational_compounds: [{ CO2: +432 kg }],
    amortized_embodied: [{ CO2: +17.1 kg }],  // 32,000 / 15,000 hrs × 8
    operator: operator_pnft,
    operation_bioregion: "north-america-california-sierra",
  },
}

NFT UPDATED:
├── lifetime_usage: 8 hours
├── total_operational: +432 kg CO2
├── amortized_embodied: +17.1 kg CO2
└── remaining_embodied: 31,982.9 kg CO2
```

## Ownership Transfer

When machinery is sold, the NFT transfers with all history:

```
Transfer {
  machine_id: excavator_nft_001,
  from_owner: construction_co_pnft,
  to_owner: new_buyer_pnft,
  transfer_price: 180000,
}

NFT UPDATED:
├── current_owner: new_buyer_pnft
├── ownership_transfers: 2
├── Entire history preserved
└── New owner inherits remaining embodied responsibility
```

## Retirement/Scrapping

When retired, NFT is burned with final impact recorded:

```
Retire {
  machine_id: excavator_nft_001,
  scrap_impact: [
    { steel_recycled: -8,000 kg CO2 },  // Recycling credit
    { disposal: +200 kg CO2 },           // Disposal impact
  ],
  final_owner: scrap_yard_pnft,
}

RESULT:
├── NFT burned
├── Net remaining embodied at retirement recorded
├── If scrapped early: "wasted" embodied = remaining unamortized
└── Final impact attributed to final owner
```

## Data Completeness

Not all supply chains are fully tracked. The `data_completeness_bps` field shows how much is known:

```
DATA COMPLETENESS SCORING

10000 (100%): Every gram tracked from mine to assembly
9000 (90%):   Some minor materials estimated
7500 (75%):   Major components tracked, some processing estimated
5000 (50%):   Assembly known, supply chain partially estimated
2500 (25%):   Basic embodied estimate, limited traceability
0 (0%):       No supply chain data (legacy equipment)
```

## Fleet Comparison

Compare machines across your fleet or the entire system:

```
"Compare excavators by lifecycle efficiency"

┌─────────────────┬──────────────┬─────────────┬──────────────┬──────────┐
│ Machine         │ Embodied     │ Op/hr       │ Total/hr     │ Complete │
├─────────────────┼──────────────┼─────────────┼──────────────┼──────────┤
│ CAT-320-2024    │ 32,000 kg    │ 54 kg       │ 56.1 kg      │ 95%      │
│ Komatsu-210     │ 28,500 kg    │ 58 kg       │ 60.0 kg      │ 88%      │
│ Volvo-EC220     │ 30,200 kg    │ 51 kg       │ 53.0 kg      │ 92%      │
│ Old-CAT-315     │ ? (est 35k)  │ 72 kg       │ ~74 kg       │ 12%      │
└─────────────────┴──────────────┴─────────────┴──────────────┴──────────┘

INSIGHT: Volvo has best total lifecycle efficiency
         Old CAT has poor data but clearly least efficient
```

## DPP Compliance

This system provides **EU Digital Product Passport** compliance:

- ✓ Complete material traceability
- ✓ Carbon footprint per product
- ✓ Recyclability information
- ✓ Durability and repairability data
- ✓ Hazardous substance tracking
- ✓ Supply chain due diligence
