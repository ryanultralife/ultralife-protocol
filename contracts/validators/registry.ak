// =============================================================================
// UltraLife Protocol — Universal Registry
// =============================================================================
//
// HIERARCHICAL CLASSIFICATION SYSTEM
//
// A simple, agile structure for universal identifiers.
// Classifications emerge from use — those versed in a field create and
// govern their domain through natural conversation with any LLM.
//
// CORE PRINCIPLE:
// Clear hierarchy of assignments. Parent governs children.
// Specialists create subcategories. The taxonomy grows organically.
//
// HIERARCHY:
//   Root (Steward creates)
//     └─ Category (governor creates)
//          └─ Subcategory (governor or delegate creates)
//               └─ ... (as deep as needed)
//
// Anyone can propose. Governor approves. Specialists govern their domains.
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{PolicyId, AssetName}
use cardano/transaction.{Transaction, OutputReference, InlineDatum}
use ultralife/types.{VerificationLevel, Verified, Steward}

// =============================================================================
// TYPES
// =============================================================================

/// Registry entry — any node in the hierarchy
pub type RegistryEntryDatum {
  /// Unique identifier
  entry_id: ByteArray,
  /// Parent entry ID (None = root)
  parent: Option<ByteArray>,
  /// Name hash
  name_hash: ByteArray,
  /// Specification hash (IPFS — definition, standards, etc.)
  spec_hash: ByteArray,
  /// Governor pNFT (controls this node, can create children)
  governor: AssetName,
  /// Delegates (can also create children under this node)
  delegates: List<AssetName>,
  /// Creation slot
  created_at: Int,
  /// Active flag
  active: Bool,
}

/// Product/thing instance — references a registry category
pub type ThingDatum {
  /// Registry entry this thing belongs to
  category_id: ByteArray,
  /// Unique instance ID
  instance_id: ByteArray,
  /// Current owner pNFT
  owner: AssetName,
  /// Current location (bioregion)
  location: ByteArray,
  /// What this was before (transformation reference)
  origin: Option<OriginRef>,
  /// Aggregated impact summary
  impact: ImpactSummary,
  /// Metadata hash
  metadata_hash: ByteArray,
  /// Created slot
  created_at: Int,
}

/// Reference to what something was before transformation
pub type OriginRef {
  /// Input instance IDs
  inputs: List<ByteArray>,
  /// Process category ID (how it was transformed)
  process_id: ByteArray,
  /// Who transformed it
  transformer: AssetName,
  /// When
  transformed_at: Int,
}

/// Aggregated impact (not full chain, just totals)
pub type ImpactSummary {
  /// Net values by category (positive = good, negative = bad)
  carbon_net: Int,
  water_net: Int,
  biodiversity_net: Int,
  /// Transformation count in chain
  steps: Int,
  /// Impact token references for verification
  proof_refs: List<ByteArray>,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type RegistryRedeemer {
  /// Create root category (Steward only)
  CreateRoot { name_hash: ByteArray, spec_hash: ByteArray }
  /// Create child under existing category
  CreateChild { parent_id: ByteArray, name_hash: ByteArray, spec_hash: ByteArray }
  /// Add delegate to a category
  AddDelegate { entry_id: ByteArray, delegate: AssetName }
  /// Remove delegate
  RemoveDelegate { entry_id: ByteArray, delegate: AssetName }
  /// Update specification
  UpdateSpec { entry_id: ByteArray, new_spec_hash: ByteArray }
  /// Transfer governance
  TransferGovernance { entry_id: ByteArray, new_governor: AssetName }
  /// Deactivate (cannot delete, only deactivate)
  Deactivate { entry_id: ByteArray }
}

pub type ThingRedeemer {
  /// Register new thing (origin point in supply chain)
  Register { category_id: ByteArray, metadata_hash: ByteArray, impact: ImpactSummary }
  /// Transform thing(s) into new thing
  Transform { inputs: List<ByteArray>, process_id: ByteArray, output_category: ByteArray, impact: ImpactSummary }
  /// Transfer ownership
  Transfer { new_owner: AssetName }
  /// Update metadata
  UpdateMetadata { new_hash: ByteArray }
}

// =============================================================================
// CONFIG
// =============================================================================

pub type RegistryConfig {
  pnft_policy: PolicyId,
}

// =============================================================================
// REGISTRY VALIDATOR
// =============================================================================

validator registry(config: RegistryConfig) {
  spend(
    datum: Option<RegistryEntryDatum>,
    redeemer: RegistryRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      // Root categories require Steward
      CreateRoot { name_hash, spec_hash } -> {
        let creator = get_signer_pnft(tx, config.pnft_policy)
        expect Some(c) = creator
        c.level == Steward && list.has(tx.extra_signatories, c.owner)
      }
      
      // Children require governor or delegate of parent
      CreateChild { parent_id, name_hash, spec_hash } -> {
        expect Some(parent) = datum
        let actor = get_signer_pnft(tx, config.pnft_policy)
        expect Some(a) = actor
        let authorized = a.pnft == parent.governor || list.has(parent.delegates, a.pnft)
        authorized && list.has(tx.extra_signatories, a.owner)
      }
      
      // Only governor can add delegates
      AddDelegate { entry_id, delegate } -> {
        expect Some(entry) = datum
        let actor = get_signer_pnft(tx, config.pnft_policy)
        expect Some(a) = actor
        a.pnft == entry.governor && list.has(tx.extra_signatories, a.owner)
      }
      
      // Only governor can remove delegates
      RemoveDelegate { entry_id, delegate } -> {
        expect Some(entry) = datum
        let actor = get_signer_pnft(tx, config.pnft_policy)
        expect Some(a) = actor
        a.pnft == entry.governor && list.has(tx.extra_signatories, a.owner)
      }
      
      // Governor or delegate can update spec
      UpdateSpec { entry_id, new_spec_hash } -> {
        expect Some(entry) = datum
        let actor = get_signer_pnft(tx, config.pnft_policy)
        expect Some(a) = actor
        let authorized = a.pnft == entry.governor || list.has(entry.delegates, a.pnft)
        authorized && list.has(tx.extra_signatories, a.owner)
      }
      
      // Only governor can transfer governance
      TransferGovernance { entry_id, new_governor } -> {
        expect Some(entry) = datum
        let actor = get_signer_pnft(tx, config.pnft_policy)
        expect Some(a) = actor
        a.pnft == entry.governor && list.has(tx.extra_signatories, a.owner)
      }
      
      // Only governor can deactivate
      Deactivate { entry_id } -> {
        expect Some(entry) = datum
        let actor = get_signer_pnft(tx, config.pnft_policy)
        expect Some(a) = actor
        a.pnft == entry.governor && list.has(tx.extra_signatories, a.owner)
      }
    }
  }
}

// =============================================================================
// THING VALIDATOR
// =============================================================================

validator thing(config: RegistryConfig) {
  spend(
    datum: Option<ThingDatum>,
    redeemer: ThingRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      // Register origin — Verified+ can register new things
      Register { category_id, metadata_hash, impact } -> {
        let registrar = get_signer_pnft(tx, config.pnft_policy)
        expect Some(r) = registrar
        let level_ok = r.level == Verified || r.level == Steward
        level_ok && list.has(tx.extra_signatories, r.owner)
      }
      
      // Transform — must own all inputs
      Transform { inputs, process_id, output_category, impact } -> {
        let transformer = get_signer_pnft(tx, config.pnft_policy)
        expect Some(t) = transformer
        // Verify ownership of inputs would be checked here
        list.has(tx.extra_signatories, t.owner)
      }
      
      // Transfer — current owner must sign
      Transfer { new_owner } -> {
        expect Some(thing) = datum
        let owner = get_owner_key(tx, thing.owner, config.pnft_policy)
        expect Some(o) = owner
        list.has(tx.extra_signatories, o)
      }
      
      // Update metadata — owner signs
      UpdateMetadata { new_hash } -> {
        expect Some(thing) = datum
        let owner = get_owner_key(tx, thing.owner, config.pnft_policy)
        expect Some(o) = owner
        list.has(tx.extra_signatories, o)
      }
    }
  }
}

// =============================================================================
// HELPERS
// =============================================================================

fn get_signer_pnft(tx: Transaction, policy: PolicyId) -> Option<{pnft: AssetName, owner: VerificationKeyHash, level: VerificationLevel}> {
  None  // Implementation would find pNFT in inputs
}

fn get_owner_key(tx: Transaction, pnft: AssetName, policy: PolicyId) -> Option<VerificationKeyHash> {
  None  // Implementation would look up owner from pNFT datum
}

// =============================================================================
// HOW IT WORKS
// =============================================================================
//
// HIERARCHY EMERGES FROM USE
// ──────────────────────────
//
// 1. Steward creates root: "Materials"
//      └─ governor: materials_steward_pnft
//
// 2. Materials governor creates child: "Metals"
//      └─ governor: materials_steward_pnft (or delegates to metals_expert)
//
// 3. Metals governor (or delegate) creates: "Steel", "Aluminum", "Copper"
//      └─ each can have its own governor/delegates
//
// 4. Steel specialist creates: "Structural", "Stainless", "Tool Steel"
//      └─ and so on, as deep as the domain requires
//
// NO PREDEFINED TAXONOMY
// ──────────────────────
//
// The hierarchy grows as needed. If no one has created "Artisanal Cheeses"
// yet, a cheese expert can:
//
// 1. Find existing parent: Food → Dairy → Cheese (or create if missing)
// 2. Create "Artisanal" under Cheese
// 3. Become governor of that subdomain
// 4. Define standards in spec_hash
// 5. Delegate to regional cheese experts
//
// TRANSFORMATION & IMPACT
// ───────────────────────
//
// When things transform (ore → ingot → component):
//
// - NEW thing created with new instance_id
// - origin.inputs references what it was
// - impact AGGREGATES (sum of inputs + transformation)
// - proof_refs point to impact tokens for verification
//
// The thing knows its TOTAL impact without carrying full chain.
//
// THROUGH ANY LLM
// ───────────────
//
// User: "I want to register a new category for heritage grain varieties"
// LLM: [searches registry for existing grain categories]
// LLM: "I found 'Food > Grain > Wheat'. I can create 'Heritage' under Wheat.
//       You'll be the governor. What specifications should I include?"
// User: "Must be open-pollinated, documented lineage back 50+ years..."
// LLM: [creates registry entry with spec_hash pointing to IPFS definition]
//
// The bar for participation: can you talk?
//
// =============================================================================
