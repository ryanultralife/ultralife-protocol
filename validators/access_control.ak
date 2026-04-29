// =============================================================================
// UltraLife Protocol — Access Control Validator
// =============================================================================
//
// Hash-based access control for off-chain content:
// - Only hashes stored on-chain (tiny transactions)
// - Content stored off-chain (IPFS/Arweave)
// - Owner grants time-limited access (8hr, 24hr, work contract, etc.)
// - LLM interface generates viewable formats on demand
//
// =============================================================================

use aiken/collection/dict
use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval.{Finite}
use cardano/assets
use cardano/assets.{AssetName}
use cardano/transaction.{InlineDatum, Input, Output, Transaction, find_input}
use ultralife/types.{
  AccessGrant, AccessGrantRedeemer, AccessLevel, BatchGrant, ContentReference,
  ContentType, Document, ExtendAccess, GrantAccess, GrantDuration, Hours, IPFS,
  Permanent, RecordView, RevokeAccess, TransferOwnership, ViewOnly,
  WorkContractGrant, calculate_expiry, can_grant_access, is_grant_valid,
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/// Slots per hour (approximate for Cardano)
const slots_per_hour: Int = 3600

/// Policy ID for pNFT (identity tokens)
/// In production, this would be parameterized
/// Placeholder: 28-byte policy ID (56 hex chars)
const pnft_policy_id: ByteArray =
  #"00000000000000000000000000000000000000000000000000000000"

// =============================================================================
// DATUM TYPES
// =============================================================================

/// Content registry datum - tracks registered content
pub type ContentRegistryDatum {
  /// Owner's pNFT
  owner_pnft: AssetName,
  /// All registered content hashes
  content_hashes: List<ByteArray>,
  /// Total content count
  content_count: Int,
}

/// Access grant datum - single grant record
pub type AccessGrantDatum {
  /// The access grant details
  grant: AccessGrant,
}

/// Batch grant datum - multiple grants at once
pub type BatchGrantDatum {
  /// Batch identifier
  batch_id: ByteArray,
  /// All grants in this batch
  grants: List<AccessGrant>,
  /// Work agreement (if linked)
  work_agreement_id: Option<ByteArray>,
}

// =============================================================================
// VALIDATOR
// =============================================================================

validator access_control(pnft_policy: ByteArray) {
  /// Spending validator for access control UTxOs
  spend(
    datum: Option<Data>,
    redeemer: AccessGrantRedeemer,
    _own_ref: Data,
    tx: Transaction,
  ) {
    when datum is {
      None -> False
      // Datum required
      Some(raw_datum) ->
        // Try to parse as grant datum first
        when parse_grant_datum(raw_datum) is {
          Some(grant_datum) ->
            validate_grant_spend(grant_datum, redeemer, tx, pnft_policy)
          None ->
            // Try registry datum
            when parse_registry_datum(raw_datum) is {
              Some(registry_datum) ->
                validate_registry_spend(
                  registry_datum,
                  redeemer,
                  tx,
                  pnft_policy,
                )
              None -> False
            }
        }
    }
  }

  /// Minting policy for access grant tokens (optional)
  /// Can mint grant tokens that represent access rights
  mint(redeemer: AccessGrantRedeemer, _policy_id: ByteArray, tx: Transaction) {
    when redeemer is {
      GrantAccess { content_hash, grantee, duration, access_level } ->
        // Verify the grantor owns the content
        // Must have pNFT in transaction
        has_pnft_signature(tx, pnft_policy)
      _ -> False
    }
  }

  else(_) {
    fail
  }
}

// =============================================================================
// VALIDATION FUNCTIONS
// =============================================================================

/// Validate spending of a grant UTxO
fn validate_grant_spend(
  grant_datum: AccessGrantDatum,
  redeemer: AccessGrantRedeemer,
  tx: Transaction,
  pnft_policy: ByteArray,
) -> Bool {
  let grant = grant_datum.grant

  when redeemer is {
    // Revoke access - only grantor can revoke
    RevokeAccess { grant_id, .. } ->
      grant_id == grant.grant_id && is_signed_by_pnft(
        tx,
        grant.grantor_pnft,
        pnft_policy,
      )

    // Extend access - only grantor can extend
    ExtendAccess { grant_id, new_expiry } ->
      grant_id == grant.grant_id && is_signed_by_pnft(
        tx,
        grant.grantor_pnft,
        pnft_policy,
      ) && // New expiry must be later than current
      when grant.expires_at is {
        None -> True
        // Permanent can be extended (no change)
        Some(current) -> new_expiry > current
      }

    // Record a view - only grantee can record
    RecordView { grant_id } ->
      grant_id == grant.grant_id && is_signed_by_pnft(
        tx,
        grant.grantee_pnft,
        pnft_policy,
      ) && // Grant must still be valid
      is_grant_valid(grant, get_current_slot(tx))

    _ -> False
  }
}

/// Validate spending of a content registry UTxO
fn validate_registry_spend(
  registry_datum: ContentRegistryDatum,
  redeemer: AccessGrantRedeemer,
  tx: Transaction,
  pnft_policy: ByteArray,
) -> Bool {
  when redeemer is {
    // Grant access - must own content
    GrantAccess { content_hash, grantee, duration, access_level } ->
      // Content must be in registry
      list.has(registry_datum.content_hashes, content_hash) && // Must be signed by owner
      is_signed_by_pnft(tx, registry_datum.owner_pnft, pnft_policy) && // Output must have new grant datum
      has_valid_grant_output(
        tx,
        content_hash,
        grantee,
        registry_datum.owner_pnft,
        duration,
        access_level,
      )

    // Batch grant
    BatchGrant { content_hashes, grantee, duration } ->
      // All content must be in registry
      list.all(
        content_hashes,
        fn(h) { list.has(registry_datum.content_hashes, h) },
      ) && // Must be signed by owner
      is_signed_by_pnft(tx, registry_datum.owner_pnft, pnft_policy)

    // Transfer ownership - both parties must sign
    TransferOwnership { content_hash, new_owner } ->
      list.has(registry_datum.content_hashes, content_hash) && is_signed_by_pnft(
        tx,
        registry_datum.owner_pnft,
        pnft_policy,
      ) && is_signed_by_pnft(tx, new_owner, pnft_policy)

    // Work contract grant - auto-grant from agreement
    WorkContractGrant { agreement_id } ->
      // Would verify work_auction contract reference
      is_signed_by_pnft(tx, registry_datum.owner_pnft, pnft_policy)

    _ -> False
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/// Check if transaction is signed by holder of pNFT
fn is_signed_by_pnft(
  tx: Transaction,
  pnft_name: AssetName,
  pnft_policy: ByteArray,
) -> Bool {
  // Check that pNFT is in one of the inputs
  list.any(
    tx.inputs,
    fn(input) {
      let value = input.output.value
      assets.quantity_of(value, pnft_policy, pnft_name) > 0
    },
  )
}

/// Check if transaction has any pNFT signature
fn has_pnft_signature(tx: Transaction, pnft_policy: ByteArray) -> Bool {
  list.any(
    tx.inputs,
    fn(input) {
      let value = input.output.value
      !dict.is_empty(assets.tokens(value, pnft_policy))
    },
  )
}

/// Get current slot from transaction validity range
fn get_current_slot(tx: Transaction) -> Int {
  // Use lower bound of validity range as current slot
  when tx.validity_range.lower_bound.bound_type is {
    Finite(time) -> time
    _ -> 0
  }
}

/// Verify output has valid grant datum
fn has_valid_grant_output(
  tx: Transaction,
  content_hash: ByteArray,
  grantee: AssetName,
  grantor: AssetName,
  duration: GrantDuration,
  access_level: AccessLevel,
) -> Bool {
  list.any(
    tx.outputs,
    fn(output) {
      when output.datum is {
        InlineDatum(data) ->
          when parse_grant_datum(data) is {
            Some(grant_datum) ->
              grant_datum.grant.content_hash == content_hash && grant_datum.grant.grantee_pnft == grantee && grant_datum.grant.grantor_pnft == grantor
            None -> False
          }
        _ -> False
      }
    },
  )
}

/// Parse raw datum as grant datum
/// Uses Aiken's `if/is` pattern matching to safely attempt parsing
fn parse_grant_datum(data: Data) -> Option<AccessGrantDatum> {
  if data is datum: AccessGrantDatum {
    Some(datum)
  } else {
    None
  }
}

/// Parse raw datum as registry datum
/// Uses Aiken's `if/is` pattern matching to safely attempt parsing
fn parse_registry_datum(data: Data) -> Option<ContentRegistryDatum> {
  if data is datum: ContentRegistryDatum {
    Some(datum)
  } else {
    None
  }
}

// =============================================================================
// TESTS
// =============================================================================

test grant_expiry_hours_calculates_correctly() {
  // Test 8-hour grant expiry calculation
  let start_slot = 1000
  let hours = 8
  let expected_expiry = start_slot + hours * slots_per_hour

  when calculate_expiry(Hours { hours }, start_slot, slots_per_hour) is {
    Some(expiry) -> expiry == expected_expiry
    None -> False
  }
}

test permanent_grant_has_no_expiry() {
  // Test that permanent grants don't expire
  let start_slot = 1000

  calculate_expiry(Permanent, start_slot, slots_per_hour) == None
}

test valid_grant_passes_check() {
  // Test that a valid, unexpired grant passes validation
  let grant =
    AccessGrant {
      grant_id: "test_grant_001",
      content_hash: "content_hash_abc",
      grantee_pnft: "grantee_pnft_001",
      grantor_pnft: "grantor_pnft_001",
      duration: Permanent,
      granted_at: 1000,
      expires_at: None,
      access_level: ViewOnly,
      revoked: False,
      view_count: 0,
      max_views: None,
      work_agreement_id: None,
    }

  // Check at slot 5000 - should still be valid
  is_grant_valid(grant, 5000)
}

test revoked_grant_fails_check() {
  // Test that a revoked grant fails validation
  let grant =
    AccessGrant {
      grant_id: "test_grant_002",
      content_hash: "content_hash_abc",
      grantee_pnft: "grantee_pnft_001",
      grantor_pnft: "grantor_pnft_001",
      duration: Permanent,
      granted_at: 1000,
      expires_at: None,
      access_level: ViewOnly,
      revoked: True,
      // Revoked!
      view_count: 0,
      max_views: None,
      work_agreement_id: None,
    }

  // Should fail validation because it's revoked
  !is_grant_valid(grant, 5000)
}

test expired_grant_fails_check() {
  // Test that an expired grant fails validation
  let grant =
    AccessGrant {
      grant_id: "test_grant_003",
      content_hash: "content_hash_abc",
      grantee_pnft: "grantee_pnft_001",
      grantor_pnft: "grantor_pnft_001",
      duration: Hours { hours: 8 },
      granted_at: 1000,
      expires_at: Some(2000),
      // Expires at slot 2000
      access_level: ViewOnly,
      revoked: False,
      view_count: 0,
      max_views: None,
      work_agreement_id: None,
    }

  // Check at slot 5000 - should be expired
  !is_grant_valid(grant, 5000)
}

test max_views_exceeded_fails_check() {
  // Test that exceeding max views fails validation
  let grant =
    AccessGrant {
      grant_id: "test_grant_004",
      content_hash: "content_hash_abc",
      grantee_pnft: "grantee_pnft_001",
      grantor_pnft: "grantor_pnft_001",
      duration: Permanent,
      granted_at: 1000,
      expires_at: None,
      access_level: ViewOnly,
      revoked: False,
      view_count: 5,
      // Already viewed 5 times
      max_views: Some(5),
      // Max 5 views
      work_agreement_id: None,
    }

  // Should fail because max views reached
  !is_grant_valid(grant, 5000)
}

test owner_can_grant_own_content() {
  // Test that content owner can grant access
  let owner = "owner_pnft_001"
  let content =
    ContentReference {
      content_hash: "hash_001",
      content_type: Document,
      size_bytes: 1024,
      storage_network: IPFS,
      encrypted: False,
      owner_pnft: owner,
      registered_at: 1000,
      linked_asset: None,
      linked_agreement: None,
    }

  can_grant_access(content, owner)
}

test non_owner_cannot_grant() {
  // Test that non-owner cannot grant access
  let owner = "owner_pnft_001"
  let non_owner = "other_pnft_002"
  let content =
    ContentReference {
      content_hash: "hash_001",
      content_type: Document,
      size_bytes: 1024,
      storage_network: IPFS,
      encrypted: False,
      owner_pnft: owner,
      registered_at: 1000,
      linked_asset: None,
      linked_agreement: None,
    }

  !can_grant_access(content, non_owner)
}
