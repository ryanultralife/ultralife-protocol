# UltraLife Protocol: Universal Framework for Carbon-Based Life Abundance

## Core Realization

**We are not defining every sector and classification. We are creating the transparent framework through which ALL economic activity flows — enabling the greatest abundance of carbon-based life ever.**

The system doesn't need to know what a "plumber" is. It needs to know:
- A human (pNFT) offers work
- Another human (pNFT) needs work done
- They agree on terms
- Work happens, compounds flow
- Payment happens, impacts accrue
- Everyone sees everything

---

## The Framework: Six Universal Interactions

Every economic activity in human civilization reduces to these six interactions:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     THE SIX UNIVERSAL INTERACTIONS                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   1. OFFER          "I have something / can do something"                   │
│   2. NEED           "I want something / need something done"                │
│   3. AGREE          "We match — here are the terms"                         │
│   4. PERFORM        "Work/transfer happens, compounds flow"                 │
│   5. VERIFY         "This actually happened as described"                   │
│   6. SETTLE         "Payment transfers, impacts accrue"                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

That's it. Whether you're:
- Farming rice
- Writing software  
- Teaching children
- Mining minerals
- Caring for elders
- Building rockets
- Making art

...it all flows through the same six interactions.

---

## The Registry: Self-Describing Classifications

Instead of hardcoding sectors, we have a **living registry** where communities define their own classifications:

```aiken
/// Universal registry entry — communities define their own codes
pub type RegistryEntry {
  /// Unique code (hierarchical: 01.02.03.04)
  code: ByteArray,
  /// Parent code (for hierarchy)
  parent: Option<ByteArray>,
  /// Human-readable name hash
  name_hash: ByteArray,
  /// Description hash (IPFS)
  description_hash: ByteArray,
  /// Which bioregion defined this (or global)
  defined_by: RegistryAuthority,
  /// Typical compound flows (reference, not mandatory)
  typical_compounds: List<CompoundReference>,
  /// Related codes
  related: List<ByteArray>,
  /// Active/deprecated
  status: RegistryStatus,
}

pub type RegistryAuthority {
  /// Global standard (W3C, ISO, etc.)
  Global { standard: ByteArray }
  /// Bioregion-specific
  Bioregional { bioregion: ByteArray }
  /// Collective-specific
  Collective { collective_id: ByteArray }
  /// Individual definition
  Individual { pnft: AssetName }
}
```

A bioregion in the Amazon can define "forest stewardship" differently than one in Norway. Both are valid. The framework doesn't judge — it just makes everything transparent.

---

## Universal Offering Type

Everything offered follows one pattern:

```aiken
/// Universal offering — works for ANY economic activity
pub type Offering {
  /// Who's offering
  offerer: AssetName,
  
  /// What category (from registry, or custom)
  category: CategoryReference,
  
  /// What specifically (flexible description)
  what: WhatIsOffered,
  
  /// Where (bioregion, or remote/anywhere)
  where_: LocationScope,
  
  /// When available
  when_: Availability,
  
  /// Terms (price, trade, gift, etc.)
  terms: OfferingTerms,
  
  /// Expected compound flows (transparency)
  expected_impacts: List<CompoundFlow>,
  
  /// Evidence/credentials supporting this offering
  evidence: List<ByteArray>,
}

pub type CategoryReference {
  /// From global/bioregional registry
  Registry { code: ByteArray }
  /// Custom description (for novel offerings)
  Custom { description_hash: ByteArray }
}

pub type WhatIsOffered {
  /// Physical thing
  Thing { 
    description_hash: ByteArray,
    quantity: Option<Int>,
    unit: Option<ByteArray>,
  }
  /// Capability/skill
  Capability {
    description_hash: ByteArray,
    duration: Option<Int>,
  }
  /// Space/access
  Access {
    asset: AssetName,
    access_type: ByteArray,
    duration: Option<Int>,
  }
  /// Knowledge/information
  Knowledge {
    description_hash: ByteArray,
    format: ByteArray,
  }
  /// Care/support
  Care {
    description_hash: ByteArray,
    duration: Option<Int>,
  }
}

pub type LocationScope {
  /// Specific location
  Specific { bioregion: ByteArray, location_hash: ByteArray }
  /// Within bioregion
  Bioregional { bioregion: ByteArray }
  /// Can travel
  Mobile { range: List<ByteArray> }
  /// Remote/virtual
  Remote
  /// Anywhere
  Anywhere
}

pub type OfferingTerms {
  /// Token price
  Priced { amount: Int, negotiable: Bool }
  /// Range
  Range { min: Int, max: Int }
  /// Auction
  Auction { starting: Int, reserve: Option<Int> }
  /// Trade
  Trade { accepts: ByteArray }
  /// Gift
  Gift { conditions: Option<ByteArray> }
  /// Community service (for care credits)
  CommunityService
}
```

---

## Universal Need Type

Everything needed follows one pattern:

```aiken
/// Universal need — works for ANY requirement
pub type Need {
  /// Who needs it
  needer: AssetName,
  
  /// What category (from registry, or custom)
  category: CategoryReference,
  
  /// What specifically
  what: WhatIsNeeded,
  
  /// Where
  where_: LocationScope,
  
  /// When needed
  when_: TimeRequirement,
  
  /// Budget/offer
  budget: NeedBudget,
  
  /// Requirements for who can fulfill
  requirements: List<Requirement>,
  
  /// Maximum acceptable compound flows
  impact_limits: Option<List<CompoundLimit>>,
}

pub type WhatIsNeeded {
  /// Matches WhatIsOffered categories
  Thing { description_hash: ByteArray, quantity: Option<Int> }
  Work { description_hash: ByteArray, scope_hash: ByteArray }
  Access { asset_type: ByteArray, duration: Option<Int> }
  Knowledge { topic_hash: ByteArray }
  Care { care_description: ByteArray, duration: Option<Int> }
}

pub type Requirement {
  /// Minimum verification level
  VerificationLevel { min: VerificationLevel }
  /// Specific credential
  Credential { credential_type: ByteArray }
  /// Bioregion residency
  Residency { bioregion: ByteArray }
  /// Efficiency rating
  Efficiency { compound: CompoundCode, max_rating: Int }
  /// Custom requirement
  Custom { description_hash: ByteArray }
}

pub type CompoundLimit {
  compound: CompoundCode,
  max_quantity: Int,
  unit: MassUnit,
}
```

---

## Universal Agreement

When offer meets need:

```aiken
/// Universal agreement — the contract between parties
pub type Agreement {
  /// Unique ID
  agreement_id: ByteArray,
  
  /// The offering being accepted
  offering_id: ByteArray,
  offerer: AssetName,
  
  /// The need being fulfilled
  need_id: Option<ByteArray>,
  needer: AssetName,
  
  /// Agreed terms
  terms: AgreedTerms,
  
  /// Expected compound flows (combined from both sides)
  expected_compounds: List<CompoundFlow>,
  
  /// Timeline
  timeline: Timeline,
  
  /// Escrow (if applicable)
  escrow: Option<EscrowTerms>,
  
  /// Verification method
  verification: VerificationMethod,
  
  /// Status
  status: AgreementStatus,
}

pub type AgreedTerms {
  /// What will be provided
  deliverable: ByteArray,
  /// Payment amount
  payment: Int,
  /// Additional conditions hash
  conditions: Option<ByteArray>,
}

pub type VerificationMethod {
  /// Self-reported (lowest trust)
  SelfReported
  /// Counterparty confirms
  CounterpartyConfirm
  /// Community attestation
  CommunityAttestation { min_attestors: Int }
  /// Designated verifier
  DesignatedVerifier { verifier: AssetName }
  /// Automatic (sensor/oracle)
  Automatic { oracle_hash: ByteArray }
}
```

---

## The Compound Flow: Universal Impact

Every activity produces compound flows. The framework doesn't care what the activity is — it just tracks what flowed:

```aiken
/// Every activity records what actually happened chemically
pub type ActivityRecord {
  /// The agreement this fulfills
  agreement_id: ByteArray,
  
  /// Who performed
  performer: AssetName,
  
  /// What compounds flowed
  compound_flows: List<CompoundFlow>,
  
  /// Evidence hash
  evidence: ByteArray,
  
  /// When
  timestamp: Int,
  
  /// Verification
  verified_by: List<AssetName>,
  
  /// Where impacts accrue
  impacts_to: ImpactDestination,
}

pub type ImpactDestination {
  /// To an asset (for later transfer to consumer)
  Asset { asset_id: AssetName }
  /// Directly to consumer
  Consumer { consumer_pnft: AssetName }
  /// To the commons (public good)
  Commons { bioregion: ByteArray }
}
```

---

## Bioregion Index: The Living Dashboard

Each bioregion tracks its health across universal categories:

```aiken
/// Bioregion health index — self-reporting, transparent
pub type BioregionIndex {
  bioregion: ByteArray,
  cycle: Int,
  
  /// Natural resources
  natural_resources: ResourceIndex,
  
  /// Human wellbeing
  human_wellbeing: WellbeingIndex,
  
  /// Economic activity
  economic_activity: ActivityIndex,
  
  /// Compound balances (net flows)
  compound_balances: List<CompoundBalance>,
  
  /// Overall health score (derived)
  health_score: Int,
}

pub type ResourceIndex {
  /// Water (surface, ground, quality)
  water: IndexValue,
  /// Land (soil health, biodiversity)
  land: IndexValue,
  /// Air (quality, carbon balance)
  air: IndexValue,
  /// Energy (renewable %, capacity)
  energy: IndexValue,
  /// Minerals/materials
  materials: IndexValue,
}

pub type WellbeingIndex {
  /// Population health
  health: IndexValue,
  /// Education access
  education: IndexValue,
  /// Housing quality
  housing: IndexValue,
  /// Food security
  food_security: IndexValue,
  /// Safety
  safety: IndexValue,
  /// Cultural vitality
  cultural_vitality: IndexValue,
  /// Care availability
  care_availability: IndexValue,
}

pub type ActivityIndex {
  /// Total offerings
  offerings_active: Int,
  /// Total needs posted
  needs_active: Int,
  /// Agreements completed this cycle
  agreements_completed: Int,
  /// Total value transacted
  value_transacted: Int,
  /// Care hours recorded
  care_hours: Int,
}

pub type IndexValue {
  /// Current value (0-10000 = 0-100.00%)
  value: Int,
  /// Trend (+/- change from last cycle)
  trend: Int,
  /// Data confidence (0-100)
  confidence: Int,
  /// Last updated
  updated: Int,
}
```

---

## The Transparent Flow: How Everything Connects

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        THE TRANSPARENT ECONOMY                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  EVERY HUMAN has a pNFT (verified identity)                                 │
│       │                                                                      │
│       ├── Can OFFER anything (work, goods, knowledge, care, access)         │
│       │        └── Visible to all, searchable, with expected impacts        │
│       │                                                                      │
│       ├── Can NEED anything (work done, goods, knowledge, care, access)     │
│       │        └── Visible to all, biddable, with impact limits             │
│       │                                                                      │
│       ├── Can AGREE with any other pNFT on terms                            │
│       │        └── Escrow created, timeline set, verification chosen        │
│       │                                                                      │
│       ├── Can PERFORM and record compound flows                             │
│       │        └── Actual chemistry tracked, evidence linked                │
│       │                                                                      │
│       ├── Can VERIFY others' work (building reputation)                     │
│       │        └── Community attestation, designated verification           │
│       │                                                                      │
│       └── Can SETTLE — payment flows, impacts accrue                        │
│                └── Consumer accountable, worker has efficiency rating       │
│                                                                              │
│  EVERY ASSET (land, building, product)                                      │
│       │                                                                      │
│       ├── Accumulates compound flows through its lifecycle                  │
│       ├── Transfers ALL impacts to consumer on purchase                     │
│       └── Visible history: who did what, what flowed                        │
│                                                                              │
│  EVERY BIOREGION                                                             │
│       │                                                                      │
│       ├── Aggregates all activity within its bounds                         │
│       ├── Tracks resource health, human wellbeing, economic activity        │
│       ├── Distributes UBI based on natural capacity                         │
│       └── Governs through collective of resident pNFTs                      │
│                                                                              │
│  THE RESULT                                                                  │
│       │                                                                      │
│       ├── Every transaction visible                                          │
│       ├── Every impact tracked                                               │
│       ├── Every choice informed                                              │
│       ├── Markets optimize for life (not extraction)                        │
│       └── Greatest abundance of carbon-based life ever                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Liquid Staking: Cross-Sector Capital Flow

Anyone can stake in anything:

```aiken
/// Universal stake — support any activity
pub type Stake {
  staker: AssetName,
  
  /// What you're supporting
  target: StakeTarget,
  
  /// Amount staked
  amount: Int,
  
  /// Duration
  duration: (Int, Int),
  
  /// What you get back
  returns: StakeReturns,
}

pub type StakeTarget {
  /// A specific offering
  Offering { offering_id: ByteArray }
  /// A collective
  Collective { collective_id: ByteArray }
  /// A bioregion's index fund
  BioregionFund { bioregion: ByteArray, category: ByteArray }
  /// A specific asset's development
  AssetDevelopment { asset_id: AssetName }
  /// Research/knowledge
  Research { research_id: ByteArray }
  /// General stake pool
  Pool { pool_id: ByteArray }
}

pub type StakeReturns {
  /// Token yield
  Yield { rate_bps: Int }
  /// Access rights
  Access { access_type: ByteArray }
  /// Product rights (CSA-style)
  ProductRights { allocation: ByteArray }
  /// Governance rights
  Governance { weight: Int }
  /// Impact credits
  ImpactCredits { compound: CompoundCode, multiplier: Int }
}
```

---

## What We're NOT Doing

We are NOT:
- Defining every job type
- Classifying every product
- Enumerating every service
- Hardcoding economic sectors

We ARE:
- Creating universal patterns for offer/need/agree/perform/verify/settle
- Making all compound flows visible
- Letting communities define their own classifications
- Enabling transparent price discovery based on true cost
- Ensuring consumer accountability for their demand
- Tracking what actually matters: the flourishing of carbon-based life

---

## The Contracts We Need

Just these core contracts handle everything:

| Contract | Purpose |
|----------|---------|
| **pnft.ak** | Human identity (who) |
| **offering.ak** | Universal offerings (what's available) |
| **need.ak** | Universal needs (what's wanted) |
| **agreement.ak** | Universal agreements (matched parties) |
| **activity.ak** | Universal activity records (what happened) |
| **compound.ak** | Compound flow tracking (chemistry) |
| **asset.ak** | Asset impact accumulation |
| **bioregion.ak** | Regional aggregation and index |
| **stake.ak** | Liquid staking (capital flow) |
| **token.ak** | Payment settlement |
| **ubi.ak** | Distribution based on bioregion health |
| **governance.ak** | Collective decision-making |
| **registry.ak** | Community-defined classifications |

---

## The Vision Realized

**Transparency creates accountability.**
**Accountability creates choice.**
**Choice creates markets.**
**Markets optimize for what's measured.**
**We measure compound flows.**
**Therefore: markets optimize for carbon-based life.**

Every human can:
- See what's offered anywhere
- See what's needed anywhere
- See the true impact of every choice
- Make informed decisions
- Be accountable for their consumption
- Contribute their unique gifts
- Have their care work recognized
- Participate in governance
- Stake in what they believe in
- Receive UBI based on their bioregion's health

The framework doesn't judge activities. It makes them transparent. The collective wisdom of billions of informed choices — visible to all — creates the greatest abundance of carbon-based life ever.

**That's the framework. Everything else is detail.**
