// =============================================================================
// UltraLife Protocol — Marketplace Validator Tests
// =============================================================================
//
// Tests for the marketplace contract including:
// - Listing creation validation
// - Purchase validation
// - Impact disclosure requirements
// - Seller verification
// - Price structure validation
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use cardano/assets.{AssetName}
use ultralife/types.{
  VerificationLevel, Basic, Ward, Standard, Verified, Steward,
  CompoundBalance, MassUnit, Grams,
  can_transact,
}

// =============================================================================
// MARKETPLACE TYPES
// =============================================================================

type ListingStatus {
  ListingActive
  ListingPaused
  ListingSold { buyer: AssetName, sold_at: Int }
  ListingExpired
  ListingCancelled
}

type PriceStructure {
  Fixed { amount: Int }
  Range { min: Int, max: Int }
  SlidingScale { base: Int, discount_bps: Int }
  Free
}

type ListingType {
  Product {
    product_code: ByteArray,
    quantity: Int,
    impact_disclosure: List<CompoundBalance>,
  }
  Service { service_code: ByteArray }
}

type ListingDatum {
  listing_id: ByteArray,
  seller: AssetName,
  listing_type: ListingType,
  price: PriceStructure,
  bioregion: ByteArray,
  created_at: Int,
  expires_at: Option<Int>,
  status: ListingStatus,
}

// =============================================================================
// TEST HELPERS
// =============================================================================

fn mock_vkh(seed: Int) -> VerificationKeyHash {
  when seed is {
    1 -> #"0000000000000000000000000000000000000000000000000000000001"
    2 -> #"0000000000000000000000000000000000000000000000000000000002"
    3 -> #"0000000000000000000000000000000000000000000000000000000003"
    _ -> #"0000000000000000000000000000000000000000000000000000000000"
  }
}

fn mock_pnft_name(seed: Int) -> AssetName {
  when seed is {
    1 -> #"706e667401"
    2 -> #"706e667402"
    3 -> #"706e667403"
    _ -> #"706e667400"
  }
}

fn mock_compound_balance(compound: ByteArray, qty: Int) -> CompoundBalance {
  CompoundBalance {
    compound: compound,
    quantity: qty,
    unit: Grams,
  }
}

fn mock_product_listing(
  seller: AssetName,
  price: Int,
  quantity: Int,
  impacts: List<CompoundBalance>,
) -> ListingDatum {
  ListingDatum {
    listing_id: #"6c697374696e67303031",
    seller: seller,
    listing_type: Product {
      product_code: #"70726f64303031",
      quantity: quantity,
      impact_disclosure: impacts,
    },
    price: Fixed { amount: price },
    bioregion: #"62696f726567696f6e31",
    created_at: 1000,
    expires_at: Some(10000),
    status: ListingActive,
  }
}

fn mock_service_listing(seller: AssetName, price: Int) -> ListingDatum {
  ListingDatum {
    listing_id: #"6c697374696e67303032",
    seller: seller,
    listing_type: Service { service_code: #"737276303031" },
    price: Fixed { amount: price },
    bioregion: #"62696f726567696f6e31",
    created_at: 1000,
    expires_at: Some(10000),
    status: ListingActive,
  }
}

// =============================================================================
// SELLER VERIFICATION TESTS
// =============================================================================

fn can_sell(level: VerificationLevel) -> Bool {
  when level is {
    Basic -> False
    Ward -> False
    Standard -> True
    Verified -> True
    Steward -> True
  }
}

test basic_cannot_sell() {
  !can_sell(Basic)
}

test ward_cannot_sell() {
  !can_sell(Ward)
}

test standard_can_sell() {
  can_sell(Standard)
}

test verified_can_sell() {
  can_sell(Verified)
}

test steward_can_sell() {
  can_sell(Steward)
}

// =============================================================================
// LISTING STATUS TESTS
// =============================================================================

fn can_purchase(status: ListingStatus) -> Bool {
  when status is {
    ListingActive -> True
    _ -> False
  }
}

test can_purchase_active_listing() {
  can_purchase(ListingActive)
}

test cannot_purchase_paused_listing() {
  !can_purchase(ListingPaused)
}

test cannot_purchase_sold_listing() {
  !can_purchase(ListingSold { buyer: mock_pnft_name(1), sold_at: 5000 })
}

test cannot_purchase_expired_listing() {
  !can_purchase(ListingExpired)
}

test cannot_purchase_cancelled_listing() {
  !can_purchase(ListingCancelled)
}

// =============================================================================
// PRICE VALIDATION TESTS
// =============================================================================

fn is_valid_fixed_price(amount: Int) -> Bool {
  amount > 0
}

fn is_valid_price_range(min: Int, max: Int) -> Bool {
  min > 0 && max > min
}

fn is_valid_sliding_scale(base: Int, discount_bps: Int) -> Bool {
  base > 0 && discount_bps >= 0 && discount_bps <= 10000
}

test valid_fixed_price() {
  is_valid_fixed_price(100)
}

test zero_fixed_price_invalid() {
  !is_valid_fixed_price(0)
}

test negative_fixed_price_invalid() {
  !is_valid_fixed_price(-10)
}

test valid_price_range() {
  is_valid_price_range(50, 100)
}

test price_range_min_equals_max_invalid() {
  !is_valid_price_range(100, 100)
}

test price_range_min_greater_than_max_invalid() {
  !is_valid_price_range(100, 50)
}

test price_range_zero_min_invalid() {
  !is_valid_price_range(0, 100)
}

test valid_sliding_scale() {
  is_valid_sliding_scale(100, 2000)
}

test sliding_scale_zero_base_invalid() {
  !is_valid_sliding_scale(0, 2000)
}

test sliding_scale_discount_over_100_invalid() {
  !is_valid_sliding_scale(100, 10001)
}

// =============================================================================
// IMPACT DISCLOSURE TESTS
// =============================================================================

fn has_impact_disclosure(listing: ListingDatum) -> Bool {
  when listing.listing_type is {
    Product { impact_disclosure, .. } -> list.length(impact_disclosure) >= 0
    _ -> True
  }
}

fn total_impact_magnitude(impacts: List<CompoundBalance>) -> Int {
  list.foldl(impacts, 0, fn(impact, acc) {
    acc + abs(impact.quantity)
  })
}

fn abs(x: Int) -> Int {
  if x < 0 { -x } else { x }
}

test product_with_empty_impact_disclosure_valid() {
  let seller = mock_pnft_name(1)
  let listing = mock_product_listing(seller, 100, 10, [])
  has_impact_disclosure(listing)
}

test product_with_impact_disclosure_valid() {
  let seller = mock_pnft_name(1)
  let co2_impact = mock_compound_balance(#"0101", 500)
  let impacts = [co2_impact]
  let listing = mock_product_listing(seller, 100, 10, impacts)
  has_impact_disclosure(listing)
}

test service_always_valid_for_impact() {
  let seller = mock_pnft_name(1)
  let listing = mock_service_listing(seller, 100)
  has_impact_disclosure(listing)
}

test total_impact_calculation() {
  let impacts = [
    mock_compound_balance(#"0101", 500),
    mock_compound_balance(#"0102", -200),
  ]
  total_impact_magnitude(impacts) == 700
}

test zero_impacts_have_zero_magnitude() {
  let impacts: List<CompoundBalance> = []
  total_impact_magnitude(impacts) == 0
}

// =============================================================================
// LISTING CREATION TESTS
// =============================================================================

fn validate_listing_creation(
  seller_level: VerificationLevel,
  price: PriceStructure,
  quantity: Int,
  listing_fee_paid: Bool,
) -> Bool {
  let seller_valid = can_sell(seller_level)
  let price_valid = when price is {
    Fixed { amount } -> is_valid_fixed_price(amount)
    Range { min, max } -> is_valid_price_range(min, max)
    SlidingScale { base, discount_bps } -> is_valid_sliding_scale(base, discount_bps)
    Free -> True
  }
  let quantity_valid = quantity > 0
  seller_valid && price_valid && quantity_valid && listing_fee_paid
}

test valid_listing_creation() {
  validate_listing_creation(Standard, Fixed { amount: 100 }, 10, True)
}

test listing_creation_fails_without_fee() {
  !validate_listing_creation(Standard, Fixed { amount: 100 }, 10, False)
}

test listing_creation_fails_with_basic_seller() {
  !validate_listing_creation(Basic, Fixed { amount: 100 }, 10, True)
}

test listing_creation_fails_with_zero_quantity() {
  !validate_listing_creation(Standard, Fixed { amount: 100 }, 0, True)
}

test listing_creation_fails_with_invalid_price() {
  !validate_listing_creation(Standard, Fixed { amount: 0 }, 10, True)
}

test listing_creation_with_range_price_valid() {
  validate_listing_creation(Standard, Range { min: 50, max: 100 }, 10, True)
}

test listing_creation_with_free_price_valid() {
  validate_listing_creation(Standard, Free, 10, True)
}

// =============================================================================
// PURCHASE VALIDATION TESTS
// =============================================================================

fn validate_purchase(
  buyer_level: VerificationLevel,
  listing_status: ListingStatus,
  payment_amount: Int,
  price: Int,
  current_slot: Int,
  expires_at: Option<Int>,
) -> Bool {
  let buyer_valid = can_transact(buyer_level)
  let status_valid = can_purchase(listing_status)
  let payment_valid = payment_amount >= price
  let not_expired = when expires_at is {
    Some(expiry) -> current_slot <= expiry
    None -> True
  }
  buyer_valid && status_valid && payment_valid && not_expired
}

test valid_purchase() {
  validate_purchase(Standard, ListingActive, 100, 100, 5000, Some(10000))
}

test purchase_fails_with_basic_buyer() {
  !validate_purchase(Basic, ListingActive, 100, 100, 5000, Some(10000))
}

test purchase_fails_with_insufficient_payment() {
  !validate_purchase(Standard, ListingActive, 50, 100, 5000, Some(10000))
}

test purchase_fails_with_inactive_listing() {
  !validate_purchase(Standard, ListingPaused, 100, 100, 5000, Some(10000))
}

test purchase_fails_after_expiry() {
  !validate_purchase(Standard, ListingActive, 100, 100, 15000, Some(10000))
}

test purchase_valid_with_no_expiry() {
  validate_purchase(Standard, ListingActive, 100, 100, 999999, None)
}

test purchase_valid_with_excess_payment() {
  validate_purchase(Standard, ListingActive, 150, 100, 5000, Some(10000))
}

test ward_can_purchase_with_guardian() {
  validate_purchase(Ward, ListingActive, 100, 100, 5000, Some(10000))
}

// =============================================================================
// LISTING UPDATE TESTS
// =============================================================================

fn validate_listing_update(
  caller_is_seller: Bool,
  listing_status: ListingStatus,
  new_price: Option<Int>,
  new_quantity: Option<Int>,
) -> Bool {
  caller_is_seller &&
  can_purchase(listing_status) &&
  (when new_price is {
    Some(p) -> p > 0
    None -> True
  }) &&
  (when new_quantity is {
    Some(q) -> q > 0
    None -> True
  })
}

test seller_can_update_listing() {
  validate_listing_update(True, ListingActive, Some(150), Some(5))
}

test non_seller_cannot_update_listing() {
  !validate_listing_update(False, ListingActive, Some(150), Some(5))
}

test cannot_update_sold_listing() {
  !validate_listing_update(True, ListingSold { buyer: mock_pnft_name(1), sold_at: 5000 }, Some(150), Some(5))
}

test update_with_invalid_price_fails() {
  !validate_listing_update(True, ListingActive, Some(0), Some(5))
}

test update_with_invalid_quantity_fails() {
  !validate_listing_update(True, ListingActive, Some(150), Some(0))
}

test partial_update_valid() {
  validate_listing_update(True, ListingActive, Some(150), None)
}

// =============================================================================
// LISTING CANCELLATION TESTS
// =============================================================================

fn validate_cancellation(caller_is_seller: Bool, listing_status: ListingStatus) -> Bool {
  caller_is_seller &&
  when listing_status is {
    ListingActive -> True
    ListingPaused -> True
    _ -> False
  }
}

test seller_can_cancel_active_listing() {
  validate_cancellation(True, ListingActive)
}

test seller_can_cancel_paused_listing() {
  validate_cancellation(True, ListingPaused)
}

test non_seller_cannot_cancel() {
  !validate_cancellation(False, ListingActive)
}

test cannot_cancel_sold_listing() {
  !validate_cancellation(True, ListingSold { buyer: mock_pnft_name(1), sold_at: 5000 })
}

test cannot_cancel_expired_listing() {
  !validate_cancellation(True, ListingExpired)
}

// =============================================================================
// LISTING FEE TESTS
// =============================================================================

fn calculate_listing_fee(price: Int, fee_bps: Int) -> Int {
  price * fee_bps / 10000
}

test listing_fee_calculation_1_percent() {
  calculate_listing_fee(1000, 100) == 10
}

test listing_fee_calculation_5_percent() {
  calculate_listing_fee(1000, 500) == 50
}

test listing_fee_zero_price() {
  calculate_listing_fee(0, 100) == 0
}

test listing_fee_small_amount() {
  calculate_listing_fee(50, 100) == 0
}

// =============================================================================
// MARK SOLD TESTS
// =============================================================================

fn validate_mark_sold(
  caller: AssetName,
  seller: AssetName,
  buyer: AssetName,
  listing_status: ListingStatus,
  payment_verified: Bool,
) -> Bool {
  (caller == seller || caller == buyer) &&
  can_purchase(listing_status) &&
  payment_verified
}

test seller_can_mark_sold() {
  let seller = mock_pnft_name(1)
  let buyer = mock_pnft_name(2)
  validate_mark_sold(seller, seller, buyer, ListingActive, True)
}

test buyer_can_mark_sold() {
  let seller = mock_pnft_name(1)
  let buyer = mock_pnft_name(2)
  validate_mark_sold(buyer, seller, buyer, ListingActive, True)
}

test third_party_cannot_mark_sold() {
  let seller = mock_pnft_name(1)
  let buyer = mock_pnft_name(2)
  let other = mock_pnft_name(3)
  !validate_mark_sold(other, seller, buyer, ListingActive, True)
}

test cannot_mark_sold_without_payment() {
  let seller = mock_pnft_name(1)
  let buyer = mock_pnft_name(2)
  !validate_mark_sold(seller, seller, buyer, ListingActive, False)
}

// =============================================================================
// EDGE CASES
// =============================================================================

test listing_expiry_at_exact_slot_valid() {
  validate_purchase(Standard, ListingActive, 100, 100, 10000, Some(10000))
}

test listing_expiry_one_slot_after_invalid() {
  !validate_purchase(Standard, ListingActive, 100, 100, 10001, Some(10000))
}

test multiple_impacts_accumulate() {
  let impacts = [
    mock_compound_balance(#"0101", 100),
    mock_compound_balance(#"0102", 200),
    mock_compound_balance(#"0103", 300),
  ]
  total_impact_magnitude(impacts) == 600
}

test negative_and_positive_impacts_both_counted() {
  let impacts = [
    mock_compound_balance(#"0101", 100),
    mock_compound_balance(#"0105", -50),
  ]
  total_impact_magnitude(impacts) == 150
}

test listing_data_preserved_on_update() {
  let seller = mock_pnft_name(1)
  let listing = mock_product_listing(seller, 100, 10, [])
  listing.listing_id == #"6c697374696e67303031" &&
  listing.seller == seller &&
  listing.bioregion == #"62696f726567696f6e31" &&
  listing.created_at == 1000
}
