// =============================================================================
// UltraLife Protocol — Work Auction
// =============================================================================
//
// MARKETPLACE FOR WORK: pNFTs list work they need, workers bid on it
//
// The flow:
// 1. Asset owner (pNFT) creates work request with expected impacts
// 2. Request goes to marketplace as auction
// 3. Qualified workers (pNFTs) submit bids with:
//    - Price
//    - Expected compound flows (their efficiency)
//    - Timeline
//    - Certifications
// 4. Owner accepts bid → Escrow created
// 5. Worker performs work, submits evidence
// 6. Verification (surveyors/attestors verify)
// 7. Payment released, impacts recorded (accrue to asset, then to consumer)
//
// =============================================================================

use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/interval
use cardano/address.{Script, VerificationKey}
use cardano/assets.{AssetName, PolicyId, Value, flatten, quantity_of}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}
use ultralife/types.{
  ActivityImpact, AssetActivityRecord, CompoundCode, CompoundFlow, MassUnit,
  MeasurementMethod, PnftDatum, Standard, Steward, VerificationLevel, Verified,
  can_transact, voting_weight,
}
