/**
 * UltraLife Transaction Builder
 * 
 * Builds unsigned transactions for UltraLife operations.
 * Uses Lucid for transaction construction and references on-chain scripts.
 */

import {
  Lucid,
  Blockfrost,
  Data,
  fromText,
  toHex,
  fromHex,
  UTxO,
  TxComplete,
  Constr,
  Address,
} from 'lucid-cardano';
import type {
  UltraLifeConfig,
  PnftDatum,
  Offering,
  Need,
  Agreement,
  Collective,
  CompoundFlow,
  ByteArray,
  AssetName,
  Terms,
  CategoryRef,
  WhatOffered,
  LocationScope,
  TimeScope,
  VerificationMethod,
} from '../types/index.js';
import { UltraLifeIndexer } from '../indexer/index.js';
import { buildWorkAuctionUnsigned, laborGate } from './work-auction.js';

// =============================================================================
// DATUM/REDEEMER SCHEMAS (for Lucid's Data.to/from)
// =============================================================================

// These schemas define how to encode TypeScript objects to CBOR for Plutus

const VerificationLevelSchema = Data.Enum([
  Data.Literal('Basic'),
  Data.Literal('Ward'),
  Data.Literal('Standard'),
  Data.Literal('Verified'),
  Data.Literal('Steward'),
]);

const PnftDatumSchema = Data.Object({
  pnft_id: Data.Bytes(),
  owner: Data.Bytes(),
  level: VerificationLevelSchema,
  bioregion: Data.Nullable(Data.Bytes()),
  dna_hash: Data.Nullable(Data.Bytes()),
  guardian: Data.Nullable(Data.Bytes()),
  ward_since: Data.Nullable(Data.Integer()),
  created_at: Data.Integer(),
  upgraded_at: Data.Nullable(Data.Integer()),
  consumer_impacts: Data.Nullable(Data.Array(Data.Object({
    compound: Data.Bytes(),
    quantity: Data.Integer(),
    unit: Data.Bytes(),
  }))),
  care_credits: Data.Integer(),
});

const MintPnftRedeemerSchema = Data.Object({
  dna_hash: Data.Bytes(),
  verification_proof: Data.Bytes(),
});

const CompoundFlowSchema = Data.Object({
  compound: Data.Bytes(),
  quantity: Data.Integer(),
  unit: Data.Bytes(),
  measurement: Data.Bytes(),
  confidence: Data.Integer(),
});

const CategoryRefSchema = Data.Enum([
  Data.Object({ Registry: Data.Object({ code: Data.Bytes() }) }),
  Data.Object({ Custom: Data.Object({ description_hash: Data.Bytes() }) }),
]);

const WhatOfferedSchema = Data.Enum([
  Data.Object({ Thing: Data.Object({ 
    description_hash: Data.Bytes(), 
    quantity: Data.Nullable(Data.Integer()), 
    unit: Data.Nullable(Data.Bytes()) 
  }) }),
  Data.Object({ Work: Data.Object({ 
    description_hash: Data.Bytes(), 
    duration: Data.Nullable(Data.Integer()) 
  }) }),
  Data.Object({ Access: Data.Object({ 
    asset_id: Data.Bytes(), 
    access_type: Data.Bytes(), 
    duration: Data.Nullable(Data.Integer()) 
  }) }),
  Data.Object({ Knowledge: Data.Object({ description_hash: Data.Bytes() }) }),
  Data.Object({ Care: Data.Object({ 
    description_hash: Data.Bytes(), 
    duration: Data.Nullable(Data.Integer()) 
  }) }),
]);

const LocationScopeSchema = Data.Enum([
  Data.Object({ Specific: Data.Object({ bioregion: Data.Bytes(), location_hash: Data.Bytes() }) }),
  Data.Object({ Bioregional: Data.Object({ bioregion: Data.Bytes() }) }),
  Data.Object({ Mobile: Data.Object({ range: Data.Array(Data.Bytes()) }) }),
  Data.Literal('Remote'),
  Data.Literal('Anywhere'),
]);

const TimeScopeSchema = Data.Enum([
  Data.Literal('Now'),
  Data.Object({ Scheduled: Data.Object({ start: Data.Integer(), end: Data.Nullable(Data.Integer()) }) }),
  Data.Object({ Recurring: Data.Object({ pattern_hash: Data.Bytes() }) }),
  Data.Literal('OnDemand'),
]);

const TermsSchema = Data.Enum([
  Data.Object({ Priced: Data.Object({ amount: Data.Integer(), negotiable: Data.Boolean() }) }),
  Data.Object({ Range: Data.Object({ min: Data.Integer(), max: Data.Integer() }) }),
  Data.Object({ Auction: Data.Object({ starting: Data.Integer(), reserve: Data.Nullable(Data.Integer()) }) }),
  Data.Object({ Trade: Data.Object({ accepts_hash: Data.Bytes() }) }),
  Data.Object({ Gift: Data.Object({ conditions: Data.Nullable(Data.Bytes()) }) }),
  Data.Literal('CommunityService'),
]);

const OfferingDatumSchema = Data.Object({
  offering_id: Data.Bytes(),
  offerer: Data.Bytes(),
  category: CategoryRefSchema,
  what: WhatOfferedSchema,
  location: LocationScopeSchema,
  availability: TimeScopeSchema,
  terms: TermsSchema,
  expected_compounds: Data.Array(CompoundFlowSchema),
  evidence: Data.Array(Data.Bytes()),
  status: Data.Enum([
    Data.Literal('Active'),
    Data.Literal('Paused'),
    Data.Literal('Fulfilled'),
    Data.Literal('Expired'),
    Data.Literal('Cancelled'),
  ]),
  created_at: Data.Integer(),
});

const CollectiveDatumSchema = Data.Object({
  collective_id: Data.Bytes(),
  name_hash: Data.Bytes(),
  members: Data.Array(Data.Bytes()),
  resources: Data.Array(Data.Bytes()),
  governance_hash: Data.Bytes(),
  treasury: Data.Bytes(),
  bioregion: Data.Bytes(),
});

// =============================================================================
// TRANSACTION BUILDER
// =============================================================================

export class UltraLifeTxBuilder {
  private lucid: Lucid | null = null;
  private config: UltraLifeConfig;
  private indexer: UltraLifeIndexer;

  constructor(config: UltraLifeConfig, indexer: UltraLifeIndexer) {
    this.config = config;
    this.indexer = indexer;
  }

  async initialize(): Promise<void> {
    this.lucid = await Lucid.new(
      new Blockfrost(
        `https://cardano-${this.config.network}.blockfrost.io/api`,
        this.config.blockfrostApiKey
      ),
      this.config.network === 'mainnet' ? 'Mainnet' : 'Preprod'
    );
    console.log('Transaction builder initialized');
  }

  // ===========================================================================
  // pNFT TRANSACTIONS
  // ===========================================================================

  /**
   * Build UNSIGNED tx to mint a Basic pNFT (MintBasic).
   * Not DNA-verified. Standard upgrade is a separate Ryan-signed path.
   * Refuses dnaHash / verificationProof / non-Basic level. No fake DNA.
   */
  async buildMintPnft(params: {
    userAddress: string;
    dnaHash?: string;
    verificationProof?: string;
    level?: string;
  }): Promise<{ tx: TxComplete; summary: TxSummary }> {
    if (!this.lucid) throw new Error('Builder not initialized');

    if (params.dnaHash || params.verificationProof || (params.level && params.level !== 'Basic')) {
      throw new Error(
        'buildMintPnft mints Basic only (MintBasic, dna_hash None). Do not pass DNA or a higher level. Standard is Ryan-signed UpgradeStandard, not this builder.'
      );
    }

    const pnftId = this.generateId('pnft');
    const assetName = fromText(pnftId);
    const policyId = this.config.contracts.pnft_policy;
    const owner = this.addressToKeyHash(params.userAddress);

    // PnftDatum: pnft_id, owner, level, bioregion, dna_hash, guardian, ward_since, created_at, upgraded_at, consumer_impact, nutrition_profile
    const currentSlot = BigInt(Math.floor(Date.now() / 1000));
    const none = new Constr(1, []);
    const datum = Data.to(new Constr(0, [
      fromHex(pnftId),
      fromHex(owner),
      new Constr(0, []),                             // level = Basic
      none,                                          // bioregion = None
      none,                                          // dna_hash = None (Basic)
      none,                                          // guardian = None
      none,                                          // ward_since = None
      currentSlot,
      none,                                          // upgraded_at = None
      none,                                          // consumer_impact = None
      none,                                          // nutrition_profile = None
    ]) as unknown as Data);

    // MintBasic { owner }
    const redeemer = Data.to(new Constr(0, [
      fromHex(owner),
    ]) as unknown as Data);

    // Get reference script UTxO
    const refScript = await this.getRefScriptUtxo('pnft_mint');

    // Build transaction
    const tx = await this.lucid
      .newTx()
      .mintAssets(
        { [policyId + assetName]: 1n },
        redeemer
      )
      .readFrom([refScript])
      .payToContract(
        this.config.contracts.pnft_spend,
        { inline: datum },
        { [policyId + assetName]: 1n }
      )
      // Bootstrap grant: 50 tokens
      .payToAddress(
        params.userAddress,
        { [this.config.contracts.token_policy]: 50_000_000n }
      )
      .complete();

    return {
      tx,
      summary: {
        action: 'Mint pNFT',
        description: `Mint Basic pNFT (wallet signature only, not DNA-verified). Unsigned. Ryan signs.`,
        pnftId,
        costs: {
          ada: '~2 ADA (min UTxO + fees)',
        },
        receives: {
          pnft: `${policyId}${assetName}`,
          tokens: 50_000_000n,
        },
      },
    };
  }

  /**
   * Build transaction to upgrade pNFT verification level
   */
  async buildUpgradePnft(params: {
    pnftId: string;
    newLevel: 'Verified' | 'Steward';
    proof: string;
  }): Promise<{ tx: TxComplete; summary: TxSummary }> {
    if (!this.lucid) throw new Error('Builder not initialized');

    // Get current pNFT datum
    const currentDatum = await this.indexer.getPnft(params.pnftId);
    if (!currentDatum) throw new Error('pNFT not found');

    // Find UTxO with pNFT
    const pnftUtxo = await this.findPnftUtxo(params.pnftId);
    if (!pnftUtxo) throw new Error('pNFT UTxO not found');

    // Build new datum using Constr
    const levelIndex = params.newLevel === 'Verified' ? 3 : 4; // Verified=3, Steward=4
    const currentSlotUpgrade = BigInt(Math.floor(Date.now() / 1000));
    const newDatum = Data.to(new Constr(0, [
      fromHex(currentDatum.pnft_id),
      fromHex(currentDatum.owner),
      new Constr(levelIndex, []),
      currentDatum.bioregion ? new Constr(0, [fromHex(currentDatum.bioregion)]) : new Constr(1, []),
      currentDatum.dna_hash ? new Constr(0, [fromHex(currentDatum.dna_hash)]) : new Constr(1, []),
      currentDatum.guardian ? new Constr(0, [fromHex(currentDatum.guardian)]) : new Constr(1, []),
      currentDatum.ward_since ? new Constr(0, [BigInt(currentDatum.ward_since)]) : new Constr(1, []),
      BigInt(currentDatum.created_at),
      new Constr(0, [currentSlotUpgrade]),          // upgraded_at = Some(now)
      new Constr(1, []),                             // consumer_impacts
      currentDatum.care_credits,
    ]) as unknown as Data);

    // Build redeemer
    const redeemer = Data.to(new Constr(1, [ // UpgradeLevel variant
      params.newLevel === 'Verified' ? new Constr(2, []) : new Constr(3, []),
      fromHex(params.proof),
    ]) as unknown as Data);

    const refScript = await this.getRefScriptUtxo('pnft_spend');

    const tx = await this.lucid
      .newTx()
      .collectFrom([pnftUtxo], redeemer)
      .readFrom([refScript])
      .payToContract(
        this.config.contracts.pnft_spend,
        { inline: newDatum },
        pnftUtxo.assets
      )
      .complete();

    return {
      tx,
      summary: {
        action: 'Upgrade pNFT',
        description: `Upgrade verification level to ${params.newLevel}`,
        pnftId: params.pnftId,
        costs: { ada: '~0.5 ADA (fees)' },
      },
    };
  }

  // ===========================================================================
  // OFFERING TRANSACTIONS
  // ===========================================================================

  /**
   * Build transaction to create a new offering
   */
  async buildCreateOffering(params: {
    offererPnft: string;
    category: CategoryRef;
    what: WhatOffered;
    location: LocationScope;
    availability: TimeScope;
    terms: Terms;
    expectedCompounds: CompoundFlow[];
    evidence: string[];
  }): Promise<{ tx: TxComplete; summary: TxSummary }> {
    if (!this.lucid) throw new Error('Builder not initialized');

    // Verify offerer has valid pNFT
    const pnft = await this.indexer.getPnft(params.offererPnft);
    if (!pnft) throw new Error('Offerer pNFT not found');
    if (pnft.level === 'Basic') throw new Error('Standard verification required');

    const offeringId = this.generateId('offering');

    // Build datum using Constr encoding
    const datum = Data.to(new Constr(0, [
      fromHex(offeringId),                     // offering_id
      fromHex(params.offererPnft),             // offerer
      this.encodeCategoryRef(params.category), // category
      this.encodeWhatOffered(params.what),     // what
      this.encodeLocationScope(params.location), // location
      this.encodeTimeScope(params.availability), // availability
      this.encodeTerms(params.terms),          // terms
      [],                                      // expected_compounds (simplified)
      params.evidence.map(e => fromHex(e)),    // evidence
      new Constr(0, []),                       // status (Active)
      BigInt(Math.floor(Date.now() / 1000)),  // created_at
    ]) as unknown as Data);

    const redeemer = Data.to(new Constr(0, [])); // CreateListing variant

    const refScript = await this.getRefScriptUtxo('marketplace');

    const tx = await this.lucid
      .newTx()
      .readFrom([refScript])
      .payToContract(
        this.config.contracts.marketplace,
        { inline: datum },
        { lovelace: 2_000_000n } // Min UTxO
      )
      .complete();

    return {
      tx,
      summary: {
        action: 'Create Offering',
        description: `List ${params.what.type} offering in marketplace`,
        offeringId,
        costs: { ada: '~2.5 ADA (min UTxO + fees)' },
      },
    };
  }

  /**
   * Build transaction to accept an offering (create agreement)
   */
  async buildAcceptOffering(params: {
    offeringId: string;
    accepterPnft: string;
    payment: bigint;
    completeBy: number;
    verification: VerificationMethod;
  }): Promise<{ tx: TxComplete; summary: TxSummary }> {
    if (!this.lucid) throw new Error('Builder not initialized');

    // Get offering
    const offering = await this.indexer.getOffering(params.offeringId);
    if (!offering) throw new Error('Offering not found');
    if (offering.status !== 'Active') throw new Error('Offering not active');

    // Verify accepter has valid pNFT
    const accepterPnft = await this.indexer.getPnft(params.accepterPnft);
    if (!accepterPnft) throw new Error('Accepter pNFT not found');

    const agreementId = this.generateId('agreement');

    // Build agreement datum using Constr encoding
    const agreementDatum = Data.to(new Constr(0, [
      fromHex(agreementId),                    // agreement_id
      fromHex(offering.offerer),               // party_a
      fromHex(params.accepterPnft),            // party_b
      fromHex(params.offeringId),              // deliverable_hash
      params.payment,                          // payment
      new Constr(1, []),                       // start_by (None)
      BigInt(params.completeBy),               // complete_by
      [],                                      // compound_flows (simplified)
      new Constr(0, []),                       // verification (SelfReported)
      new Constr(0, [                          // escrow (Some)
        fromHex(agreementId),                  // escrow_id
        params.payment,                        // amount
        fromHex(agreementId),                  // release_conditions_hash
      ]),
      new Constr(1, []),                       // status (Active)
      BigInt(Math.floor(Date.now() / 1000)),  // created_at
    ]) as Data);

    const refScripts = await Promise.all([
      this.getRefScriptUtxo('marketplace'),
      this.getRefScriptUtxo('work_auction'),
    ]);

    // This transaction:
    // 1. Updates offering status to InProgress
    // 2. Creates agreement datum
    // 3. Locks payment in escrow

    const tx = await this.lucid
      .newTx()
      .readFrom(refScripts)
      // Lock payment in escrow
      .payToContract(
        this.config.contracts.work_auction,
        { inline: agreementDatum },
        { [this.config.contracts.token_policy]: params.payment, lovelace: 2_000_000n }
      )
      .complete();

    return {
      tx,
      summary: {
        action: 'Accept Offering',
        description: `Accept offering and create agreement`,
        agreementId,
        offeringId: params.offeringId,
        costs: { 
          tokens: params.payment,
          ada: '~2.5 ADA (min UTxO + fees)',
        },
      },
    };
  }
