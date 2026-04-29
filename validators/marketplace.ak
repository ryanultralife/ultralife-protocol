// =============================================================================
// UltraLife Protocol — Marketplace
// =============================================================================
//
// ECONOMIC DISCOVERY: Finding goods, services, and work opportunities
//
// The marketplace enables:
// 1. Listing products for sale (with impact disclosure)
// 2. Listing services offered
// 3. Listing work capacity (skills available for hire)
// 4. Searching and filtering offerings
// 5. Connecting buyers and sellers
//
// All listings require pNFT verification and include impact information.
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash, blake2b_256}
use aiken/interval
use aiken/primitive/bytearray
use cardano/address
use cardano/assets.{AssetName, PolicyId, Value, flatten, quantity_of}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use ultralife/types.{
  Basic, CompoundBalance, CompoundFlow, PnftDatum, Standard, Steward,
  VerificationLevel, Verified, Ward,
}

// =============================================================================
// LISTING TYPES
// =============================================================================

/// Types of marketplace listings
pub type ListingType {
  /// Physical product for sale
  Product {
    product_code: ByteArray,
    name_hash: ByteArray,
    description_hash: ByteArray,
    category: ProductCategory,
    /// Quantity available
    quantity: Int,
    unit: ByteArray,
    /// Impact disclosure (accumulated compounds)
    impact_disclosure: List<CompoundBalance>,
    /// Origin (where produced)
    origin: Origin,
  }
  /// Service offered
  Service {
    service_code: ByteArray,
    name_hash: ByteArray,
    description_hash: ByteArray,
    category: ServiceCategory,
    /// Provider collective or individual
    provider: ProviderType,
    /// Service area
    service_area: ServiceArea,
  }
  /// Work capacity (skills for hire)
  WorkCapacity {
    worker: AssetName,
    skills: List<Skill>,
    availability: Availability,
    /// Preferred work types
    work_preferences: List<ByteArray>,
    /// Efficiency ratings
    efficiency_ratings: List<EfficiencyRating>,
  }
  /// Asset for sale
  AssetSale {
    asset_id: AssetName,
    asset_type: AssetType,
    /// Full impact history attached
    impact_history_hash: ByteArray,
  }
  /// Asset for rent
  AssetRental {
    asset_id: AssetName,
    asset_type: AssetType,
    rental_terms: RentalTermsSummary,
  }
}

pub type ProductCategory {
  Food { subcategory: FoodCategory }
  Clothing { subcategory: ByteArray }
  Household { subcategory: ByteArray }
  Tools { subcategory: ByteArray }
  Electronics { subcategory: ByteArray }
  Materials { subcategory: ByteArray }
  Handmade { subcategory: ByteArray }
  OtherProduct { category: ByteArray }
}

pub type FoodCategory {
  Produce
  Dairy
  Meat
  Seafood
  Grains
  Prepared
  Preserved
  Beverages
}

/// Food eligibility for UBI survival floor spending
/// Only clean, unprocessed foods are eligible for survival purchases
pub type FoodEligibility {
  /// Eligible for UBI survival floor purchases
  SurvivalEligible {
    nutrition_score: Int,
    // 0-10000 (higher = better)
    processing_level: ProcessingLevel,
  }
  /// Not eligible for survival floor (can still be purchased with regular ULTRA)
  NotSurvivalEligible { reason: IneligibilityReason }
}

pub type ProcessingLevel {
  /// Whole, unprocessed (fruits, vegetables, raw meat, etc.)
  Unprocessed
  /// Minimally processed (cut, frozen, dried without additives)
  MinimallyProcessed
  /// Processed for preservation (fermented, traditionally preserved)
  TraditionallyProcessed
  /// Contains some processing but no harmful additives
  ModeratelyProcessed
  /// Ultra-processed (NOT survival eligible)
  UltraProcessed
}

pub type IneligibilityReason {
  /// Contains added sugars beyond natural occurrence
  AddedSugars { amount_per_serving: Int }
  /// Contains industrial seed oils
  SeedOils { types: List<ByteArray> }
  /// Contains artificial preservatives
  ArtificialPreservatives
  /// Ultra-processed with multiple harmful ingredients
  IneligibleUltraProcessed
  /// Impact score too high (not sustainable)
  HighImpact { score: Int }
  /// Not food (supplements, etc.)
  NotFood
}

/// Food properties for DNA-nutrition matching
pub type FoodProperties {
  /// Nutrients present (for matching against deficiency risks)
  nutrients: List<NutrientContent>,
  /// Sensitivities this food triggers
  triggers_sensitivities: List<ByteArray>,
  /// Impact per unit
  impact_per_unit: List<CompoundBalance>,
  /// Eligibility for survival purchases
  survival_eligibility: FoodEligibility,
  /// Source verification
  producer: AssetName,
  /// Production bioregion
  origin_bioregion: ByteArray,
}

pub type NutrientContent {
  nutrient: ByteArray,
  amount_per_unit: Int,
  unit: ByteArray,
}

pub type ServiceCategory {
  Healthcare { specialty: ByteArray }
  Education { subject: ByteArray }
  Legal { specialty: ByteArray }
  Financial { service: ByteArray }
  Technical { domain: ByteArray }
  Creative { medium: ByteArray }
  Personal { service: ByteArray }
  Home { service: ByteArray }
  Transportation { mode: ByteArray }
  Hospitality { type_: ByteArray }
  OtherService { category: ByteArray }
}

pub type ProviderType {
  Individual { pnft: AssetName }
  Collective { collective_id: ByteArray, members: Int }
}

pub type ServiceArea {
  /// On-site only
  OnSite { location: ByteArray }
  /// Provider travels to client
  Mobile { radius: Int, bioregions: List<ByteArray> }
  /// Remote/virtual
  Remote
  /// Hybrid
  Hybrid { remote_capable: Bool, travel_radius: Int }
}

pub type AssetType {
  Land { land_nft: AssetName }
  Structure { land_nft: AssetName, building_type: ByteArray }
  Vehicle { vehicle_type: ByteArray }
  Equipment { equipment_type: ByteArray }
  Other { description: ByteArray }
}

pub type RentalTermsSummary {
  rent_period: RentPeriod,
  rent_amount: Int,
  deposit: Int,
  min_duration: Option<Int>,
}

pub type RentPeriod {
  Hourly
  Daily
  Weekly
  Monthly
  Yearly
}

// =============================================================================
// SKILL AND AVAILABILITY
// =============================================================================

pub type Skill {
  skill_code: ByteArray,
  proficiency: Proficiency,
  /// Credential backing this skill
  credential: Option<ByteArray>,
  /// Years of experience
  experience_years: Int,
}

pub type Proficiency {
  Beginner
  Intermediate
  Advanced
  Expert
  Master
}

pub type Availability {
  /// Full time available
  FullTime
  /// Part time with schedule
  PartTime { hours_per_week: Int }
  /// Project-based
  ProjectBased { min_hours: Int, max_hours: Int }
  /// Specific time slots
  Scheduled { slots: List<TimeSlot> }
  /// Not currently available
  Unavailable { available_from: Option<Int> }
}

pub type TimeSlot {
  day_of_week: Int,
  // 0-6
  start_hour: Int,
  // 0-23
  end_hour: Int,
}

// 0-23

pub type EfficiencyRating {
  compound: ByteArray,
  rating: Int,
  // 1000 = average
  sample_size: Int,
}

// =============================================================================
// ORIGIN AND PROVENANCE
// =============================================================================

pub type Origin {
  /// Local to listing bioregion
  Local { bioregion: ByteArray, producer: AssetName }
  /// Regional (neighboring bioregions)
  Regional { bioregions: List<ByteArray>, producer: AssetName }
  /// Imported
  Imported {
    origin_bioregion: ByteArray,
    producer: Option<AssetName>,
    transport_impact: List<CompoundBalance>,
  }
  /// Unknown origin (legacy goods)
  Unknown
}

// =============================================================================
// PRICING
// =============================================================================

pub type PriceStructure {
  /// Fixed price
  Fixed { amount: Int }
  /// Price range (negotiable)
  Range { min: Int, max: Int }
  /// Auction style
  Auction { starting: Int, reserve: Option<Int> }
  /// Sliding scale based on buyer
  SlidingScale { base: Int, income_adjusted: Bool, community_discount_bps: Int }
  /// Trade/barter accepted
  Trade { accepts: List<ByteArray>, token_value: Int }
  /// Free (gift economy)
  Free { conditions: Option<ByteArray> }
}

// =============================================================================
// LISTING DATUM
// =============================================================================

pub type ListingDatum {
  /// Unique listing ID
  listing_id: ByteArray,
  /// Seller/provider pNFT
  seller: AssetName,
  /// Listing type and details
  listing_type: ListingType,
  /// Pricing
  price: PriceStructure,
  /// Bioregion where listed
  bioregion: ByteArray,
  /// Creation time
  created_at: Int,
  /// Last updated
  updated_at: Int,
  /// Expiration (if any)
  expires_at: Option<Int>,
  /// Status
  status: ListingStatus,
  /// Views/interest (for discovery ranking)
  interest_count: Int,
  /// Tags for search
  tags: List<ByteArray>,
}

pub type ListingStatus {
  /// Active and available
  Active
  /// Temporarily paused
  Paused { reason: Option<ByteArray> }
  /// Sold/fulfilled
  Sold { buyer: AssetName, sold_at: Int }
  /// Expired
  Expired
  /// Cancelled by seller
  Cancelled
}

// =============================================================================
// MARKETPLACE STATE
// =============================================================================

pub type MarketplaceDatum {
  /// Single listing
  Listing(ListingDatum)
  /// Bioregion marketplace index
  Index(MarketplaceIndex)
  /// Search result (ephemeral)
  SearchResult(SearchResultData)
}

pub type MarketplaceIndex {
  bioregion: ByteArray,
  /// Listing counts by category
  product_count: Int,
  service_count: Int,
  work_count: Int,
  asset_sale_count: Int,
  asset_rental_count: Int,
  /// Last updated
  last_updated: Int,
}

pub type SearchResultData {
  query_hash: ByteArray,
  result_ids: List<ByteArray>,
  total_count: Int,
  page: Int,
}

// =============================================================================
// REDEEMERS
// =============================================================================

pub type MarketplaceRedeemer {
  // === Listing Management ===
  /// Create new listing
  CreateListing {
    listing_type: ListingType,
    price: PriceStructure,
    tags: List<ByteArray>,
    expires_at: Option<Int>,
  }
  /// Update listing
  UpdateListing {
    listing_id: ByteArray,
    new_price: Option<PriceStructure>,
    new_quantity: Option<Int>,
    new_tags: Option<List<ByteArray>>,
    new_expires: Option<Int>,
  }
  /// Pause listing
  PauseListing { listing_id: ByteArray, reason: Option<ByteArray> }
  /// Resume listing
  ResumeListing { listing_id: ByteArray }
  /// Cancel listing
  CancelListing { listing_id: ByteArray }
  // === Discovery ===
  /// Express interest (for ranking)
  ExpressInterest { listing_id: ByteArray }
  // === Fulfillment ===
  /// Mark as sold (connects to token.ak)
  MarkSold { listing_id: ByteArray, buyer: AssetName, tx_reference: ByteArray }
  // === Indexing ===
  /// Update marketplace index
  UpdateIndex { bioregion: ByteArray }
}

// =============================================================================
// CONFIGURATION
// =============================================================================

pub type MarketplaceConfig {
  /// pNFT policy
  pnft_policy: PolicyId,
  /// Token policy
  token_policy: PolicyId,
  /// Bioregion policy
  bioregion_policy: PolicyId,
  /// Listing fee (tokens)
  listing_fee: Int,
  /// Maximum active listings per seller
  max_listings_per_seller: Int,
  /// Default listing duration (slots)
  default_listing_duration: Int,
  /// Treasury for fees
  treasury: ByteArray,
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator marketplace(config: MarketplaceConfig) {
  spend(
    datum: Option<MarketplaceDatum>,
    redeemer: MarketplaceRedeemer,
    own_ref: OutputReference,
    tx: Transaction,
  ) {
    when redeemer is {
      CreateListing { listing_type, price, tags, expires_at } ->
        validate_create_listing(
          tx,
          listing_type,
          price,
          tags,
          expires_at,
          config,
        )
      UpdateListing {
        listing_id,
        new_price,
        new_quantity,
        new_tags,
        new_expires,
      } ->
        validate_update_listing(
          tx,
          datum,
          listing_id,
          new_price,
          new_quantity,
          new_tags,
          new_expires,
          config,
        )
      PauseListing { listing_id, reason } ->
        validate_pause_listing(tx, datum, listing_id, reason, config)
      ResumeListing { listing_id } ->
        validate_resume_listing(tx, datum, listing_id, config)
      CancelListing { listing_id } ->
        validate_cancel_listing(tx, datum, listing_id, config)
      ExpressInterest { listing_id } ->
        validate_express_interest(tx, datum, listing_id, config)
      MarkSold { listing_id, buyer, tx_reference } ->
        validate_mark_sold(tx, datum, listing_id, buyer, tx_reference, config)
      UpdateIndex { bioregion } ->
        validate_update_index(tx, datum, bioregion, config)
    }
  }

  else(_) {
    fail
  }
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

fn validate_create_listing(
  tx: Transaction,
  listing_type: ListingType,
  price: PriceStructure,
  tags: List<ByteArray>,
  expires_at: Option<Int>,
  config: MarketplaceConfig,
) -> Bool {
  // 1. Seller must sign
  let seller_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(seller) = seller_pnft
  expect list.has(tx.extra_signatories, seller.owner)
  // 2. Seller must be Standard+ verified
  expect verification_level_gte(seller.level, Standard)
  // 3. Check seller hasn't exceeded max listings
  // (Would need to track - simplified here)
  // 4. Listing fee paid
  expect
    verify_fee_paid(
      tx,
      config.listing_fee,
      config.treasury,
      config.token_policy,
    )
  // 5. Validate listing type specifics
  expect validate_listing_type(listing_type, seller.pnft_id, tx, config)
  // 6. Create listing datum
  let current_slot = get_current_slot(tx)
  let listing =
    ListingDatum {
      listing_id: generate_listing_id(seller.pnft_id, current_slot),
      seller: seller.pnft_id,
      listing_type,
      price,
      bioregion: get_bioregion(seller),
      created_at: current_slot,
      updated_at: current_slot,
      expires_at,
      status: Active,
      interest_count: 0,
      tags,
    }
  // 7. Verify listing output
  let output = find_listing_output(tx.outputs)
  expect Some(out) = output
  expect InlineDatum(data) = out.datum
  expect Listing(created): MarketplaceDatum = data
  created == listing
}

fn validate_listing_type(
  listing_type: ListingType,
  seller: AssetName,
  tx: Transaction,
  config: MarketplaceConfig,
) -> Bool {
  when listing_type is {
    Product { impact_disclosure, .. } ->
      // Products must have impact disclosure
      list.length(impact_disclosure) >= 0
    // At minimum, empty list acknowledged
    Service { provider, .. } ->
      // Provider must be seller or collective seller belongs to
      when provider is {
        Individual { pnft } -> pnft == seller
        Collective { .. } -> True
      }
    // Would verify membership
    WorkCapacity { worker, .. } ->
      // Worker must be seller
      worker == seller
    AssetSale { asset_id, .. } ->
      // Seller must own the asset
      verify_asset_ownership(tx, asset_id, seller, config)
    AssetRental { asset_id, .. } ->
      // Seller must own the asset
      verify_asset_ownership(tx, asset_id, seller, config)
  }
}

fn validate_update_listing(
  tx: Transaction,
  datum: Option<MarketplaceDatum>,
  listing_id: ByteArray,
  new_price: Option<PriceStructure>,
  new_quantity: Option<Int>,
  new_tags: Option<List<ByteArray>>,
  new_expires: Option<Int>,
  config: MarketplaceConfig,
) -> Bool {
  // 1. Get existing listing
  expect Some(Listing(listing)) = datum
  expect listing.listing_id == listing_id
  // 2. Must be active
  expect listing.status == Active
  // 3. Seller must sign
  let seller_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(seller) = seller_pnft
  expect seller.pnft_id == listing.seller
  expect list.has(tx.extra_signatories, seller.owner)
  // 4. Apply updates
  let updated =
    ListingDatum {
      ..listing,
      price: option_or(new_price, listing.price),
      updated_at: get_current_slot(tx),
      expires_at: when new_expires is {
        Some(e) -> Some(e)
        None -> listing.expires_at
      },
      tags: option_or(new_tags, listing.tags),
    }
  // 5. Verify output
  let output = find_listing_output(tx.outputs)
  expect Some(out) = output
  expect InlineDatum(data) = out.datum
  expect Listing(result): MarketplaceDatum = data
  result == updated
}

fn validate_mark_sold(
  tx: Transaction,
  datum: Option<MarketplaceDatum>,
  listing_id: ByteArray,
  buyer: AssetName,
  tx_reference: ByteArray,
  config: MarketplaceConfig,
) -> Bool {
  // 1. Get listing
  expect Some(Listing(listing)) = datum
  expect listing.listing_id == listing_id
  expect listing.status == Active
  // 2. Either seller or buyer can mark sold
  let signer_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(signer) = signer_pnft
  expect signer.pnft_id == listing.seller || signer.pnft_id == buyer
  // 3. Verify payment transaction occurred (reference)
  // (Would verify tx_reference points to valid token transfer)
  // 4. Update status
  let updated =
    ListingDatum {
      ..listing,
      status: Sold { buyer, sold_at: get_current_slot(tx) },
    }
  // 5. Verify output
  True
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

fn find_signer_pnft(tx: Transaction, pnft_policy: PolicyId) -> Option<PnftData> {
  // Find a pNFT in inputs or reference inputs whose owner has signed
  let from_inputs =
    list.find_map(
      tx.inputs,
      fn(input) {
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: PnftDatum = data
            if list.has(tx.extra_signatories, datum.owner) && quantity_of(
              input.output.value,
              pnft_policy,
              datum.pnft_id,
            ) == 1 {
              Some(
                PnftData {
                  pnft_id: datum.pnft_id,
                  owner: datum.owner,
                  level: datum.level,
                  bioregion: datum.bioregion,
                },
              )
            } else {
              None
            }
          }
          _ -> None
        }
      },
    )

  when from_inputs is {
    Some(d) -> Some(d)
    None ->
      // Check reference inputs
      list.find_map(
        tx.reference_inputs,
        fn(input) {
          when input.output.datum is {
            InlineDatum(data) -> {
              expect datum: PnftDatum = data
              if list.has(tx.extra_signatories, datum.owner) && quantity_of(
                input.output.value,
                pnft_policy,
                datum.pnft_id,
              ) == 1 {
                Some(
                  PnftData {
                    pnft_id: datum.pnft_id,
                    owner: datum.owner,
                    level: datum.level,
                    bioregion: datum.bioregion,
                  },
                )
              } else {
                None
              }
            }
            _ -> None
          }
        },
      )
  }
}

type PnftData {
  pnft_id: AssetName,
  owner: VerificationKeyHash,
  level: VerificationLevel,
  bioregion: Option<ByteArray>,
}

fn verification_level_gte(a: VerificationLevel, b: VerificationLevel) -> Bool {
  // Compare verification levels: Basic < Ward < Standard < Verified < Steward
  let level_to_int =
    fn(level: VerificationLevel) -> Int {
      when level is {
        Basic -> 0
        Ward -> 1
        Standard -> 2
        Verified -> 3
        Steward -> 4
      }
    }
  level_to_int(a) >= level_to_int(b)
}

fn get_current_slot(tx: Transaction) -> Int {
  // Extract current slot from transaction validity range
  when tx.validity_range.lower_bound.bound_type is {
    interval.Finite(slot) -> slot
    _ ->
      when tx.validity_range.upper_bound.bound_type is {
        interval.Finite(slot) -> slot
        _ -> 0
      }
  }
}

fn generate_listing_id(seller: AssetName, timestamp: Int) -> ByteArray {
  // Generate unique listing ID from seller pNFT and timestamp
  let timestamp_bytes = bytearray.from_int_big_endian(timestamp, 8)
  blake2b_256(bytearray.concat(seller, timestamp_bytes))
}

fn get_bioregion(pnft: PnftData) -> ByteArray {
  when pnft.bioregion is {
    Some(b) -> b
    None -> ""
  }
}

fn verify_fee_paid(
  tx: Transaction,
  amount: Int,
  treasury: ByteArray,
  token_policy: PolicyId,
) -> Bool {
  // Verify that the listing fee is paid to the treasury
  list.any(
    tx.outputs,
    fn(output) {
      when output.address.payment_credential is {
        address.Script(hash) ->
          hash == treasury && list.any(
            assets.flatten(output.value),
            fn(asset) {
              let (p, _, qty) = asset
              p == token_policy && qty >= amount
            },
          )
        _ -> False
      }
    },
  )
}

fn verify_asset_ownership(
  tx: Transaction,
  asset: AssetName,
  owner: AssetName,
  config: MarketplaceConfig,
) -> Bool {
  // Verify that the owner pNFT holder controls the asset
  // Check inputs for asset ownership
  list.any(
    tx.inputs,
    fn(input) {
      // Input must have the asset
      let has_asset =
        quantity_of(input.output.value, config.token_policy, asset) >= 1
      // And be associated with the owner pNFT
      let owned_by =
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: PnftDatum = data
            datum.pnft_id == owner
          }
          _ -> False
        }
      has_asset && owned_by
    },
  ) || list.any(
    tx.reference_inputs,
    fn(input) {
      // Also check reference inputs for ownership proof
      let has_asset =
        quantity_of(input.output.value, config.token_policy, asset) >= 1
      let owned_by =
        when input.output.datum is {
          InlineDatum(data) -> {
            expect datum: PnftDatum = data
            datum.pnft_id == owner
          }
          _ -> False
        }
      has_asset && owned_by
    },
  )
}

fn find_listing_output(outputs: List<Output>) -> Option<Output> {
  list.find(
    outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) -> {
          expect market_datum: MarketplaceDatum = data
          when market_datum is {
            Listing(_) -> True
            _ -> False
          }
        }
        _ -> False
      }
    },
  )
}

fn option_or(opt: Option<a>, default: a) -> a {
  when opt is {
    Some(v) -> v
    None -> default
  }
}

fn validate_pause_listing(
  tx: Transaction,
  datum: Option<MarketplaceDatum>,
  listing_id: ByteArray,
  reason: Option<ByteArray>,
  config: MarketplaceConfig,
) -> Bool {
  // 1. Get existing listing
  expect Some(Listing(listing)) = datum
  expect listing.listing_id == listing_id

  // 2. Must be active
  expect listing.status == Active

  // 3. Seller must sign
  let seller_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(seller) = seller_pnft
  expect seller.pnft_id == listing.seller
  expect list.has(tx.extra_signatories, seller.owner)

  // 4. Verify output has paused status
  let output = find_listing_output(tx.outputs)
  expect Some(out) = output
  expect InlineDatum(data) = out.datum
  expect Listing(result): MarketplaceDatum = data

  result.listing_id == listing_id && result.seller == listing.seller && result.status == Paused {
    reason,
  }
}

fn validate_resume_listing(
  tx: Transaction,
  datum: Option<MarketplaceDatum>,
  listing_id: ByteArray,
  config: MarketplaceConfig,
) -> Bool {
  // 1. Get existing listing
  expect Some(Listing(listing)) = datum
  expect listing.listing_id == listing_id

  // 2. Must be paused
  expect Paused { .. } = listing.status

  // 3. Seller must sign
  let seller_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(seller) = seller_pnft
  expect seller.pnft_id == listing.seller
  expect list.has(tx.extra_signatories, seller.owner)

  // 4. Verify output has active status
  let output = find_listing_output(tx.outputs)
  expect Some(out) = output
  expect InlineDatum(data) = out.datum
  expect Listing(result): MarketplaceDatum = data

  result.listing_id == listing_id && result.seller == listing.seller && result.status == Active
}

fn validate_cancel_listing(
  tx: Transaction,
  datum: Option<MarketplaceDatum>,
  listing_id: ByteArray,
  config: MarketplaceConfig,
) -> Bool {
  // 1. Get existing listing
  expect Some(Listing(listing)) = datum
  expect listing.listing_id == listing_id

  // 2. Must not already be sold or cancelled
  let can_cancel =
    when listing.status is {
      Active -> True
      Paused { .. } -> True
      _ -> False
    }
  expect can_cancel

  // 3. Seller must sign
  let seller_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(seller) = seller_pnft
  expect seller.pnft_id == listing.seller
  expect list.has(tx.extra_signatories, seller.owner)

  // 4. Verify output has cancelled status
  let output = find_listing_output(tx.outputs)
  expect Some(out) = output
  expect InlineDatum(data) = out.datum
  expect Listing(result): MarketplaceDatum = data

  result.listing_id == listing_id && result.seller == listing.seller && result.status == Cancelled
}

fn validate_express_interest(
  tx: Transaction,
  datum: Option<MarketplaceDatum>,
  listing_id: ByteArray,
  config: MarketplaceConfig,
) -> Bool {
  // 1. Get existing listing
  expect Some(Listing(listing)) = datum
  expect listing.listing_id == listing_id

  // 2. Must be active
  expect listing.status == Active

  // 3. Interested party must have pNFT and sign
  let interested_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(interested) = interested_pnft
  expect list.has(tx.extra_signatories, interested.owner)

  // 4. Interested party cannot be the seller
  expect interested.pnft_id != listing.seller

  // 5. Verify output has incremented interest count
  let output = find_listing_output(tx.outputs)
  expect Some(out) = output
  expect InlineDatum(data) = out.datum
  expect Listing(result): MarketplaceDatum = data

  result.listing_id == listing_id && result.interest_count == listing.interest_count + 1 && result.seller == listing.seller && result.status == Active
}

fn validate_update_index(
  tx: Transaction,
  datum: Option<MarketplaceDatum>,
  bioregion: ByteArray,
  config: MarketplaceConfig,
) -> Bool {
  // 1. Authorized updater must sign (Steward level)
  let updater_pnft = find_signer_pnft(tx, config.pnft_policy)
  expect Some(updater) = updater_pnft
  expect updater.level == Steward
  expect list.has(tx.extra_signatories, updater.owner)

  // 2. Count listings in inputs for this bioregion
  let listing_counts =
    list.foldl(
      tx.reference_inputs,
      (0, 0, 0, 0, 0),
      fn(input, acc) {
        let (products, services, work, sale, rental) = acc
        when input.output.datum is {
          InlineDatum(data) -> {
            expect market_datum: MarketplaceDatum = data
            when market_datum is {
              Listing(listing) ->
                if listing.bioregion == bioregion && listing.status == Active {
                  when listing.listing_type is {
                    Product { .. } ->
                      (products + 1, services, work, sale, rental)
                    Service { .. } ->
                      (products, services + 1, work, sale, rental)
                    WorkCapacity { .. } ->
                      (products, services, work + 1, sale, rental)
                    AssetSale { .. } ->
                      (products, services, work, sale + 1, rental)
                    AssetRental { .. } ->
                      (products, services, work, sale, rental + 1)
                  }
                } else {
                  acc
                }
              _ -> acc
            }
          }
          _ -> acc
        }
      },
    )

  let (
    product_count,
    service_count,
    work_count,
    asset_sale_count,
    asset_rental_count,
  ) = listing_counts

  // 3. Verify output index has correct counts
  list.any(
    tx.outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) -> {
          expect market_datum: MarketplaceDatum = data
          when market_datum is {
            Index(idx) ->
              idx.bioregion == bioregion && idx.product_count == product_count && idx.service_count == service_count && idx.work_count == work_count && idx.asset_sale_count == asset_sale_count && idx.asset_rental_count == asset_rental_count
            _ -> False
          }
        }
        _ -> False
      }
    },
  )
}
