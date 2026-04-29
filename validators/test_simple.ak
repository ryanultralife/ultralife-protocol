// =============================================================================
// Simple Test Validator — No Parameters
// =============================================================================
// A minimal validator for testing reference script deployment.
// Always succeeds (for testnet only!)
// =============================================================================

use cardano/transaction.{Transaction}

/// Simple spend validator that always succeeds
/// For testnet deployment testing only
validator test_simple {
  spend(_datum: Option<Data>, _redeemer: Data, _self: Data, _tx: Transaction) {
    True
  }

  else(_) {
    fail
  }
}
