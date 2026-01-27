/**
 * UltraLife Protocol — Redeemer Builders
 *
 * Builds CBOR-encoded redeemers for UltraLife validators.
 */

import { Data } from '@lucid-evolution/lucid';

// =============================================================================
// pNFT REDEEMERS
// =============================================================================

/**
 * pNFT redeemer for minting a Basic pNFT
 * @param {string} owner Owner's verification key hash
 * @returns {string} CBOR-encoded redeemer
 */
export function mintBasicPnft(owner) {
  // MintBasic { owner: VerificationKeyHash }
  return Data.to({
    constructor: 0, // MintBasic variant
    fields: [owner],
  });
}

/**
 * pNFT redeemer for minting a Ward pNFT
 * @param {Object} params Ward parameters
 * @returns {string} CBOR-encoded redeemer
 */
export function mintWardPnft({ wardOwner, guardianPnft, wardAttestation }) {
  // MintWard { ward_owner, guardian_pnft, ward_attestation }
  return Data.to({
    constructor: 1, // MintWard variant
    fields: [
      wardOwner,
      guardianPnft,
      {
        witness_type: { constructor: wardAttestation.witnessType || 0, fields: [] },
        witness_pnft: wardAttestation.witnessPnft,
        ward_since: BigInt(wardAttestation.wardSince),
        location_hash: wardAttestation.locationHash,
        signature: wardAttestation.signature,
      },
    ],
  });
}

/**
 * pNFT redeemer for upgrading to Standard (DNA verification)
 * @param {Object} params Upgrade parameters
 * @returns {string} CBOR-encoded redeemer
 */
export function upgradeToStandard({ dnaHash, attestations }) {
  // UpgradeStandard { dna_hash, attestations }
  return Data.to({
    constructor: 2, // UpgradeStandard variant
    fields: [
      dnaHash,
      attestations,
    ],
  });
}

/**
 * pNFT redeemer for upgrading to Verified (bioregion residency)
 * @param {Object} params Upgrade parameters
 * @returns {string} CBOR-encoded redeemer
 */
export function upgradeToVerified({ residencyProof }) {
  // UpgradeVerified { residency_proof }
  return Data.to({
    constructor: 4, // UpgradeVerified variant
    fields: [
      {
        tx_hash: residencyProof.txHash,
        output_index: BigInt(residencyProof.outputIndex),
      },
    ],
  });
}

/**
 * pNFT redeemer for upgrading to Steward
 * @param {Object} params Upgrade parameters
 * @returns {string} CBOR-encoded redeemer
 */
export function upgradeToSteward({ endorsements, required }) {
  // UpgradeSteward { endorsements, required }
  return Data.to({
    constructor: 5, // UpgradeSteward variant
    fields: [
      endorsements,
      BigInt(required),
    ],
  });
}

/**
 * pNFT redeemer for burning
 * @param {Object} params Burn parameters
 * @returns {string} CBOR-encoded redeemer
 */
export function burnPnft({ proofHash, attestation }) {
  // Burn { proof_hash, attestation }
  return Data.to({
    constructor: 7, // Burn variant
    fields: [
      proofHash,
      attestation,
    ],
  });
}

// =============================================================================
// UBI REDEEMERS
// =============================================================================

/**
 * UBI redeemer for funding the pool
 * @param {Object} params Fund parameters
 * @returns {string} CBOR-encoded redeemer
 */
export function fundUbiPool({ cycle, amount }) {
  // FundPool { cycle, amount }
  return Data.to({
    constructor: 0, // FundPool variant
    fields: [
      BigInt(cycle),
      BigInt(amount),
    ],
  });
}

/**
 * UBI redeemer for claiming distribution
 * @param {Object} params Claim parameters
 * @returns {string} CBOR-encoded redeemer
 */
export function claimUbi({ pnft, cycle }) {
  // ClaimUBI { pnft, cycle }
  return Data.to({
    constructor: 1, // ClaimUBI variant
    fields: [
      pnft,
      BigInt(cycle),
    ],
  });
}

/**
 * UBI redeemer for closing a cycle
 * @param {Object} params Close parameters
 * @returns {string} CBOR-encoded redeemer
 */
export function closeCycle({ cycle }) {
  // CloseCycle { cycle }
  return Data.to({
    constructor: 2, // CloseCycle variant
    fields: [
      BigInt(cycle),
    ],
  });
}

// =============================================================================
// GENESIS REDEEMERS
// =============================================================================

/**
 * Genesis redeemer for founder self-verification
 * @param {Object} params Verification parameters
 * @returns {string} CBOR-encoded redeemer
 */
export function founderSelfVerify({ pnft, dnaHash }) {
  // FounderSelfVerify { pnft, dna_hash }
  return Data.to({
    constructor: 1, // FounderSelfVerify variant
    fields: [
      pnft,
      dnaHash,
    ],
  });
}

/**
 * Genesis redeemer for founder becoming steward
 * @param {Object} params Steward parameters
 * @returns {string} CBOR-encoded redeemer
 */
export function founderBecomeSteward({ pnft }) {
  // FounderBecomeSteward { pnft }
  return Data.to({
    constructor: 2, // FounderBecomeSteward variant
    fields: [
      pnft,
    ],
  });
}

/**
 * Genesis redeemer for DNA verification by founders
 * @param {Object} params Verification parameters
 * @returns {string} CBOR-encoded redeemer
 */
export function genesisVerifyDna({ pnft, dnaHash, founderAttestations }) {
  // GenesisVerifyDNA { pnft, dna_hash, founder_attestations }
  return Data.to({
    constructor: 0, // GenesisVerifyDNA variant
    fields: [
      pnft,
      dnaHash,
      founderAttestations,
    ],
  });
}

/**
 * Genesis redeemer for registering an oracle
 * @param {Object} params Oracle parameters
 * @returns {string} CBOR-encoded redeemer
 */
export function registerOracle({ partnerId, signingKey, metadataHash }) {
  // RegisterOracle { partner_id, signing_key, metadata_hash }
  return Data.to({
    constructor: 5, // RegisterOracle variant
    fields: [
      partnerId,
      signingKey,
      metadataHash,
    ],
  });
}

/**
 * Genesis redeemer for ending genesis period
 * @returns {string} CBOR-encoded redeemer
 */
export function endGenesis() {
  // EndGenesis
  return Data.to({
    constructor: 8, // EndGenesis variant
    fields: [],
  });
}

// =============================================================================
// TOKEN REDEEMERS
// =============================================================================

/**
 * Token spending redeemer for economic transactions
 * @param {Object} params Transaction metadata
 * @returns {string} CBOR-encoded redeemer
 */
export function tokenSpend(transactionMeta) {
  // The token validator uses TransactionMeta as the redeemer
  return transactionMeta;
}

// =============================================================================
// TREASURY REDEEMERS
// =============================================================================

/**
 * Treasury redeemer for distributing tokens
 * @param {Object} params Distribution parameters
 * @returns {string} CBOR-encoded redeemer
 */
export function distributeTreasury({ amount, recipient, purpose }) {
  return Data.to({
    constructor: 0, // Distribute variant
    fields: [
      BigInt(amount),
      recipient,
      purpose,
    ],
  });
}

/**
 * Treasury redeemer for updating reserves
 * @param {Object} params Reserve parameters
 * @returns {string} CBOR-encoded redeemer
 */
export function updateReserves({ adaReserves, btcReserves }) {
  return Data.to({
    constructor: 1, // UpdateReserves variant
    fields: [
      BigInt(adaReserves),
      BigInt(btcReserves),
    ],
  });
}

export default {
  // pNFT
  mintBasicPnft,
  mintWardPnft,
  upgradeToStandard,
  upgradeToVerified,
  upgradeToSteward,
  burnPnft,
  // UBI
  fundUbiPool,
  claimUbi,
  closeCycle,
  // Genesis
  founderSelfVerify,
  founderBecomeSteward,
  genesisVerifyDna,
  registerOracle,
  endGenesis,
  // Token
  tokenSpend,
  // Treasury
  distributeTreasury,
  updateReserves,
};
