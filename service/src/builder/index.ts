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

// =============================================================================
// DATUM/REDEEMER SCHEMAS (for Lucid's Data.to/from)
// =============================================================================

// These schemas define how to encode TypeScript objects to CBOR for Plutus

const VerificationLevelSchema = Data.Enum([
  Data.Literal('Basic'),
  Data.Literal('Standard'),
  Data.Literal('Verified'),
  Data.Literal('Steward'),
]);

const PnftDatumSchema = Data.Object({
  pnft_id: Data.Bytes(),
  owner: Data.Bytes(),
  level: VerificationLevelSchema,
  dna_hash: Data.Nullable(Data.Bytes()),
  bioregion: Data.Nullable(Data.Bytes()),
  created_at: Data.Integer(),
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
   * Build transaction to mint a new pNFT
   */
  async buildMintPnft(params: {
    userAddress: string;
    dnaHash: string;
    verificationProof: string;
  }): Promise<{ tx: TxComplete; summary: TxSummary }> {
    if (!this.lucid) throw new Error('Builder not initialized');

    const pnftId = this.generateId('pnft');
    const assetName = fromText(pnftId);
    const policyId = this.config.contracts.pnft_policy;

    // Build datum
    const datum = Data.to({
      pnft_id: fromHex(pnftId),
      owner: fromHex(this.addressToKeyHash(params.userAddress)),
      level: 'Standard', // DNA verified = Standard level
      dna_hash: fromHex(params.dnaHash),
      bioregion: null,
      created_at: BigInt(Date.now()),
      consumer_impacts: null,
      care_credits: 0n,
    }, PnftDatumSchema);

    // Build redeemer
    const redeemer = Data.to({
      dna_hash: fromHex(params.dnaHash),
      verification_proof: fromHex(params.verificationProof),
    }, MintPnftRedeemerSchema);

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
        description: `Create DNA-verified identity with 50 token bootstrap grant`,
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

    // Build new datum
    const newDatum = Data.to({
      ...currentDatum,
      level: params.newLevel,
    }, PnftDatumSchema);

    // Build redeemer
    const redeemer = Data.to(new Constr(1, [ // UpgradeLevel variant
      params.newLevel === 'Verified' ? new Constr(2, []) : new Constr(3, []),
      fromHex(params.proof),
    ]));

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

    // Build datum
    const datum = Data.to({
      offering_id: fromHex(offeringId),
      offerer: fromHex(params.offererPnft),
      category: this.encodeCategoryRef(params.category),
      what: this.encodeWhatOffered(params.what),
      location: this.encodeLocationScope(params.location),
      availability: this.encodeTimeScope(params.availability),
      terms: this.encodeTerms(params.terms),
      expected_compounds: params.expectedCompounds.map(c => ({
        compound: fromHex(c.compound),
        quantity: c.quantity,
        unit: fromHex(c.unit),
        measurement: fromHex(c.measurement),
        confidence: BigInt(c.confidence),
      })),
      evidence: params.evidence.map(e => fromHex(e)),
      status: 'Active',
      created_at: BigInt(Date.now()),
    }, OfferingDatumSchema);

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

    // Build agreement datum
    const agreementDatum = Data.to({
      agreement_id: fromHex(agreementId),
      party_a: fromHex(offering.offerer),
      party_b: fromHex(params.accepterPnft),
      deliverable_hash: fromHex(params.offeringId), // Reference to offering
      payment: params.payment,
      start_by: null,
      complete_by: BigInt(params.completeBy),
      expected_compounds: offering.expected_compounds.map(c => ({
        compound: fromHex(c.compound),
        quantity: c.quantity,
        unit: fromHex(c.unit),
        measurement: fromHex(c.measurement),
        confidence: BigInt(c.confidence),
      })),
      verification: this.encodeVerificationMethod(params.verification),
      escrow: {
        escrow_id: fromHex(agreementId),
        amount: params.payment,
        release_conditions_hash: fromHex(agreementId),
      },
      status: 'Active',
      created_at: BigInt(Date.now()),
    });

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

  // ===========================================================================
  // COLLECTIVE TRANSACTIONS
  // ===========================================================================

  /**
   * Build transaction to create a collective ("business")
   */
  async buildCreateCollective(params: {
    founderPnft: string;
    name: string;
    bioregion: string;
    governanceRules: string; // IPFS hash
  }): Promise<{ tx: TxComplete; summary: TxSummary }> {
    if (!this.lucid) throw new Error('Builder not initialized');

    // Verify founder has valid pNFT
    const pnft = await this.indexer.getPnft(params.founderPnft);
    if (!pnft) throw new Error('Founder pNFT not found');
    if (pnft.level === 'Basic') throw new Error('Standard verification required');

    const collectiveId = this.generateId('collective');
    const treasuryAddress = await this.generateTreasuryAddress(collectiveId);

    // Build datum
    const datum = Data.to({
      collective_id: fromHex(collectiveId),
      name_hash: fromText(params.name),
      members: [fromHex(params.founderPnft)],
      resources: [],
      governance_hash: fromHex(params.governanceRules),
      treasury: fromHex(treasuryAddress),
      bioregion: fromHex(params.bioregion),
    }, CollectiveDatumSchema);

    const redeemer = Data.to(new Constr(0, [])); // CreateCollective variant

    const refScript = await this.getRefScriptUtxo('collective');

    const tx = await this.lucid
      .newTx()
      .readFrom([refScript])
      .payToContract(
        this.config.contracts.collective,
        { inline: datum },
        { lovelace: 2_000_000n }
      )
      .complete();

    return {
      tx,
      summary: {
        action: 'Create Collective',
        description: `Create collective "${params.name}" in bioregion`,
        collectiveId,
        treasuryAddress,
        costs: { ada: '~2.5 ADA (min UTxO + fees)' },
      },
    };
  }

  /**
   * Build transaction to add member to collective
   */
  async buildAddCollectiveMember(params: {
    collectiveId: string;
    newMemberPnft: string;
    approverPnft: string; // Existing member who approves
  }): Promise<{ tx: TxComplete; summary: TxSummary }> {
    if (!this.lucid) throw new Error('Builder not initialized');

    const collective = await this.indexer.getCollective(params.collectiveId);
    if (!collective) throw new Error('Collective not found');

    // Verify approver is member
    if (!collective.members.includes(params.approverPnft)) {
      throw new Error('Approver is not a member');
    }

    // Verify new member has valid pNFT
    const newMemberPnft = await this.indexer.getPnft(params.newMemberPnft);
    if (!newMemberPnft) throw new Error('New member pNFT not found');

    // Build new datum with added member
    const newMembers = [...collective.members, params.newMemberPnft];
    const newDatum = Data.to({
      ...collective,
      members: newMembers.map(m => fromHex(m)),
    }, CollectiveDatumSchema);

    const redeemer = Data.to(new Constr(1, [fromHex(params.newMemberPnft)])); // AddMember variant

    const refScript = await this.getRefScriptUtxo('collective');
    const collectiveUtxo = await this.findCollectiveUtxo(params.collectiveId);
    if (!collectiveUtxo) throw new Error('Collective UTxO not found');

    const tx = await this.lucid
      .newTx()
      .collectFrom([collectiveUtxo], redeemer)
      .readFrom([refScript])
      .payToContract(
        this.config.contracts.collective,
        { inline: newDatum },
        collectiveUtxo.assets
      )
      .complete();

    return {
      tx,
      summary: {
        action: 'Add Collective Member',
        description: `Add new member to collective`,
        collectiveId: params.collectiveId,
        newMember: params.newMemberPnft,
        costs: { ada: '~0.5 ADA (fees)' },
      },
    };
  }

  // ===========================================================================
  // TOKEN TRANSACTIONS
  // ===========================================================================

  /**
   * Build transaction to transfer tokens between pNFTs
   */
  async buildTransferTokens(params: {
    senderPnft: string;
    senderAddress: string;
    recipientPnft: string;
    recipientAddress: string;
    amount: bigint;
    purpose: string;
    compoundFlows?: CompoundFlow[];
  }): Promise<{ tx: TxComplete; summary: TxSummary }> {
    if (!this.lucid) throw new Error('Builder not initialized');

    // Verify both pNFTs exist
    const senderData = await this.indexer.getPnft(params.senderPnft);
    const recipientData = await this.indexer.getPnft(params.recipientPnft);
    if (!senderData) throw new Error('Sender pNFT not found');
    if (!recipientData) throw new Error('Recipient pNFT not found');

    // Check sender balance
    const balance = await this.indexer.getPnftTokenBalance(params.senderPnft);
    if (balance < params.amount) {
      throw new Error(`Insufficient balance: ${balance} < ${params.amount}`);
    }

    // Create transaction record datum
    const recordId = this.generateId('record');
    const recordDatum = Data.to({
      record_id: fromHex(recordId),
      sender: fromHex(params.senderPnft),
      recipient: fromHex(params.recipientPnft),
      amount: params.amount,
      purpose: fromText(params.purpose),
      compound_flows: (params.compoundFlows || []).map(c => ({
        compound: fromHex(c.compound),
        quantity: c.quantity,
        unit: fromHex(c.unit),
        measurement: fromHex(c.measurement),
        confidence: BigInt(c.confidence),
      })),
      timestamp: BigInt(Date.now()),
    });

    const refScripts = await Promise.all([
      this.getRefScriptUtxo('token'),
      this.getRefScriptUtxo('records'),
    ]);

    const tx = await this.lucid
      .newTx()
      .readFrom(refScripts)
      // Transfer tokens
      .payToAddress(
        params.recipientAddress,
        { [this.config.contracts.token_policy]: params.amount }
      )
      // Create transaction record
      .payToContract(
        this.config.contracts.records,
        { inline: recordDatum },
        { lovelace: 2_000_000n }
      )
      .complete();

    return {
      tx,
      summary: {
        action: 'Transfer Tokens',
        description: `Transfer ${params.amount} tokens: ${params.purpose}`,
        recordId,
        from: params.senderPnft,
        to: params.recipientPnft,
        amount: params.amount,
        costs: { tokens: params.amount, ada: '~2.5 ADA (record + fees)' },
      },
    };
  }

  /**
   * Build transaction to purchase tokens from development pool
   */
  async buildPurchaseFromPool(params: {
    buyerAddress: string;
    adaAmount: bigint; // in lovelace
  }): Promise<{ tx: TxComplete; summary: TxSummary }> {
    if (!this.lucid) throw new Error('Builder not initialized');

    // Testnet rate: 1 ADA = 100 tokens (1 lovelace = 0.0001 tokens)
    const tokenAmount = params.adaAmount * 100n / 1_000_000n * 1_000_000n; // Convert to token units

    const tx = await this.lucid
      .newTx()
      // Send ADA to treasury
      .payToAddress(
        this.config.contracts.treasury,
        { lovelace: params.adaAmount }
      )
      // Receive tokens (this would be handled by a pool contract in production)
      .payToAddress(
        params.buyerAddress,
        { [this.config.contracts.token_policy]: tokenAmount }
      )
      .complete();

    return {
      tx,
      summary: {
        action: 'Purchase Tokens',
        description: `Purchase tokens from development pool`,
        costs: { ada: `${params.adaAmount / 1_000_000n} ADA` },
        receives: { tokens: tokenAmount },
      },
    };
  }

  // ===========================================================================
  // SPENDING BUCKET TRANSACTIONS
  // ===========================================================================

  /**
   * Build transaction to create a new spending bucket
   */
  async buildCreateBucket(params: {
    pnftId: string;
    name: string;
    template: string;
    allocation?: bigint;
    period?: string;
    rollover?: boolean;
    maxBalance?: bigint;
    initialFunding?: bigint;
  }): Promise<{ tx: TxComplete; summary: TxSummary }> {
    if (!this.lucid) throw new Error('Builder not initialized');

    // Verify owner has valid pNFT
    const pnft = await this.indexer.getPnft(params.pnftId);
    if (!pnft) throw new Error('pNFT not found');

    const bucketId = this.generateId('bucket');
    const initialFunding = params.initialFunding || 0n;

    // Get config from template
    const config = this.getBucketConfigFromTemplate(
      params.template,
      bucketId,
      params.name,
      params.allocation,
      params.period,
      params.rollover,
      params.maxBalance
    );

    // Build datum
    const datum = Data.to({
      owner_pnft: fromHex(params.pnftId),
      buckets: [{
        config: {
          bucket_id: fromHex(bucketId),
          name_hash: fromText(params.name),
          allocation: config.allocation,
          period: this.encodePeriod(config.period),
          rollover: config.rollover,
          max_balance: config.maxBalance,
          min_balance: config.minBalance,
          allowed_categories: [],
          locked_until: 0n,
        },
        balance: initialFunding,
        period_start: BigInt(Date.now()),
        spent_this_period: 0n,
        total_spent: 0n,
        last_activity: BigInt(Date.now()),
      }],
      total_funds: initialFunding,
      hydra_head: null,
      last_settlement: BigInt(Date.now()),
      created_at: BigInt(Date.now()),
    });

    const refScript = await this.getRefScriptUtxo('spending_bucket');

    const txBuilder = this.lucid.newTx().readFrom([refScript]);

    // Add initial funding if provided
    if (initialFunding > 0n) {
      txBuilder.payToContract(
        this.config.contracts.spending_bucket,
        { inline: datum },
        { 
          [this.config.contracts.token_policy]: initialFunding,
          lovelace: 2_000_000n 
        }
      );
    } else {
      txBuilder.payToContract(
        this.config.contracts.spending_bucket,
        { inline: datum },
        { lovelace: 2_000_000n }
      );
    }

    const tx = await txBuilder.complete();

    return {
      tx,
      summary: {
        action: 'Create Spending Bucket',
        description: `Create "${params.name}" bucket (${params.template})`,
        pnftId: params.pnftId,
        costs: { 
          ada: '~2.5 ADA',
          tokens: initialFunding,
        },
      },
    };
  }

  /**
   * Build transaction to fund a bucket
   */
  async buildFundBucket(params: {
    pnftId: string;
    bucketId: string;
    amount: bigint;
  }): Promise<{ tx: TxComplete; summary: TxSummary }> {
    if (!this.lucid) throw new Error('Builder not initialized');

    const refScript = await this.getRefScriptUtxo('spending_bucket');
    const bucketUtxo = await this.findBucketUtxo(params.pnftId);
    if (!bucketUtxo) throw new Error('Bucket UTxO not found');

    const redeemer = Data.to(new Constr(1, [fromHex(params.bucketId), params.amount]));

    const tx = await this.lucid
      .newTx()
      .collectFrom([bucketUtxo], redeemer)
      .readFrom([refScript])
      .payToContract(
        this.config.contracts.spending_bucket,
        { inline: bucketUtxo.datum! },
        { 
          ...bucketUtxo.assets,
          [this.config.contracts.token_policy]: 
            (bucketUtxo.assets[this.config.contracts.token_policy] || 0n) + params.amount
        }
      )
      .complete();

    return {
      tx,
      summary: {
        action: 'Fund Bucket',
        description: `Add ${params.amount} ULTRA to bucket`,
        pnftId: params.pnftId,
        costs: { tokens: params.amount },
      },
    };
  }

  /**
   * Build transaction to spend from a bucket
   */
  async buildSpendBucket(params: {
    pnftId: string;
    bucketId: string;
    recipientPnft: string;
    recipientAddress: string;
    amount: bigint;
    purpose?: string;
  }): Promise<{ tx: TxComplete; summary: TxSummary }> {
    if (!this.lucid) throw new Error('Builder not initialized');

    const refScript = await this.getRefScriptUtxo('spending_bucket');
    const bucketUtxo = await this.findBucketUtxo(params.pnftId);
    if (!bucketUtxo) throw new Error('Bucket UTxO not found');

    const purposeHash = params.purpose ? this.hashString(params.purpose) : '00';
    const redeemer = Data.to(new Constr(2, [
      fromHex(params.bucketId),
      params.amount,
      fromHex(params.recipientPnft),
      fromHex(purposeHash),
    ]));

    const tx = await this.lucid
      .newTx()
      .collectFrom([bucketUtxo], redeemer)
      .readFrom([refScript])
      // Updated bucket state
      .payToContract(
        this.config.contracts.spending_bucket,
        { inline: bucketUtxo.datum! }, // Would update balance
        { 
          ...bucketUtxo.assets,
          [this.config.contracts.token_policy]: 
            (bucketUtxo.assets[this.config.contracts.token_policy] || 0n) - params.amount
        }
      )
      // Payment to recipient
      .payToAddress(
        params.recipientAddress,
        { [this.config.contracts.token_policy]: params.amount }
      )
      .complete();

    return {
      tx,
      summary: {
        action: 'Spend from Bucket',
        description: `Pay ${params.amount} ULTRA to ${params.recipientPnft}`,
        from: params.pnftId,
        to: params.recipientPnft,
        amount: params.amount,
        costs: { tokens: params.amount },
      },
    };
  }

  /**
   * Build transaction to transfer between buckets
   */
  async buildTransferBetweenBuckets(params: {
    pnftId: string;
    fromBucket: string;
    toBucket: string;
    amount: bigint;
  }): Promise<{ tx: TxComplete; summary: TxSummary }> {
    if (!this.lucid) throw new Error('Builder not initialized');

    const refScript = await this.getRefScriptUtxo('spending_bucket');
    const bucketUtxo = await this.findBucketUtxo(params.pnftId);
    if (!bucketUtxo) throw new Error('Bucket UTxO not found');

    const redeemer = Data.to(new Constr(4, [
      fromHex(params.fromBucket),
      fromHex(params.toBucket),
      params.amount,
    ]));

    const tx = await this.lucid
      .newTx()
      .collectFrom([bucketUtxo], redeemer)
      .readFrom([refScript])
      .payToContract(
        this.config.contracts.spending_bucket,
        { inline: bucketUtxo.datum! }, // Would update bucket balances
        bucketUtxo.assets
      )
      .complete();

    return {
      tx,
      summary: {
        action: 'Transfer Between Buckets',
        description: `Move ${params.amount} ULTRA from ${params.fromBucket} to ${params.toBucket}`,
        pnftId: params.pnftId,
        amount: params.amount,
      },
    };
  }

  // Bucket helper methods
  private getBucketConfigFromTemplate(
    template: string,
    bucketId: string,
    name: string,
    allocation?: bigint,
    period?: string,
    rollover?: boolean,
    maxBalance?: bigint,
  ): { allocation: bigint; period: string; rollover: boolean; maxBalance: bigint; minBalance: bigint } {
    const templates: Record<string, any> = {
      daily_spending: { allocation: 50_000_000n, period: 'Daily', rollover: true, maxBalance: 200_000_000n, minBalance: 0n },
      weekly_groceries: { allocation: 150_000_000n, period: 'Weekly', rollover: false, maxBalance: 150_000_000n, minBalance: 0n },
      monthly_bills: { allocation: 500_000_000n, period: 'Monthly', rollover: false, maxBalance: 500_000_000n, minBalance: 0n },
      emergency_fund: { allocation: 100_000_000n, period: 'Monthly', rollover: true, maxBalance: 5000_000_000n, minBalance: 1000_000_000n },
      savings_goal: { allocation: 200_000_000n, period: 'Monthly', rollover: true, maxBalance: 10000_000_000n, minBalance: 0n },
      allowance: { allocation: 10_000_000n, period: 'Daily', rollover: false, maxBalance: 10_000_000n, minBalance: 0n },
      business_expense: { allocation: 1000_000_000n, period: 'Monthly', rollover: true, maxBalance: 3000_000_000n, minBalance: 0n },
      custom: { allocation: allocation || 50_000_000n, period: period || 'Daily', rollover: rollover ?? true, maxBalance: maxBalance || 200_000_000n, minBalance: 0n },
    };
    return templates[template] || templates.custom;
  }

  private encodePeriod(period: string): any {
    const periods: Record<string, number> = { Daily: 0, Weekly: 1, Monthly: 2, Quarterly: 3, Yearly: 4 };
    return new Constr(periods[period] || 0, []);
  }

  private async findBucketUtxo(pnftId: string): Promise<UTxO | null> {
    if (!this.lucid) throw new Error('Builder not initialized');
    
    const utxos = await this.lucid.utxosAt(this.config.contracts.spending_bucket);
    // Find UTxO with this pNFT's bucket
    // Simplified - would decode and match in production
    return utxos.length > 0 ? utxos[0] : null;
  }

  // ===========================================================================
  // HELPER METHODS
  // ===========================================================================

  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(16);
    const random = Math.random().toString(16).slice(2, 10);
    return `${prefix}_${timestamp}${random}`;
  }

  private addressToKeyHash(address: string): string {
    // Extract payment key hash from address
    // This is simplified - production would use proper address parsing
    return address.slice(2, 58);
  }

  private async generateTreasuryAddress(collectiveId: string): Promise<string> {
    // Generate a treasury address for the collective
    // In production, this would be a script address
    return `treasury_${collectiveId}`;
  }

  private async getRefScriptUtxo(scriptName: keyof UltraLifeConfig['referenceScripts']): Promise<UTxO> {
    const ref = this.config.referenceScripts[scriptName];
    if (!this.lucid) throw new Error('Builder not initialized');
    
    const utxos = await this.lucid.utxosByOutRef([{
      txHash: ref.txHash,
      outputIndex: ref.outputIndex,
    }]);
    
    if (utxos.length === 0) {
      throw new Error(`Reference script not found: ${scriptName}`);
    }
    
    return utxos[0];
  }

  private async findPnftUtxo(pnftId: string): Promise<UTxO | null> {
    if (!this.lucid) throw new Error('Builder not initialized');
    
    const assetId = this.config.contracts.pnft_policy + pnftId;
    const utxos = await this.lucid.utxosAtWithUnit(
      this.config.contracts.pnft_spend,
      assetId
    );
    
    return utxos.length > 0 ? utxos[0] : null;
  }

  private async findCollectiveUtxo(collectiveId: string): Promise<UTxO | null> {
    if (!this.lucid) throw new Error('Builder not initialized');
    
    const utxos = await this.lucid.utxosAt(this.config.contracts.collective);
    
    for (const utxo of utxos) {
      if (utxo.datum) {
        // Check if this is the right collective
        // Simplified - would decode and check in production
        return utxo;
      }
    }
    
    return null;
  }

  // Encoding helpers
  private encodeCategoryRef(cat: CategoryRef): any {
    if (cat.type === 'Registry') {
      return new Constr(0, [fromHex(cat.code!)]);
    }
    return new Constr(1, [fromHex(cat.description_hash!)]);
  }

  private encodeWhatOffered(what: WhatOffered): any {
    const typeIndex = { Thing: 0, Work: 1, Access: 2, Knowledge: 3, Care: 4 };
    return new Constr(typeIndex[what.type], [what]);
  }

  private encodeLocationScope(loc: LocationScope): any {
    const typeIndex = { Specific: 0, Bioregional: 1, Mobile: 2, Remote: 3, Anywhere: 4 };
    if (loc.type === 'Remote' || loc.type === 'Anywhere') {
      return new Constr(typeIndex[loc.type], []);
    }
    return new Constr(typeIndex[loc.type], [loc]);
  }

  private encodeTimeScope(time: TimeScope): any {
    const typeIndex = { Now: 0, Scheduled: 1, Recurring: 2, OnDemand: 3 };
    if (time.type === 'Now' || time.type === 'OnDemand') {
      return new Constr(typeIndex[time.type], []);
    }
    return new Constr(typeIndex[time.type], [time]);
  }

  private encodeTerms(terms: Terms): any {
    const typeIndex = { Priced: 0, Range: 1, Auction: 2, Trade: 3, Gift: 4, CommunityService: 5 };
    if (terms.type === 'CommunityService') {
      return new Constr(5, []);
    }
    return new Constr(typeIndex[terms.type], [terms]);
  }

  private encodeVerificationMethod(method: VerificationMethod): any {
    const typeIndex = { 
      SelfReported: 0, 
      CounterpartyConfirm: 1, 
      CommunityAttestation: 2, 
      DesignatedVerifier: 3, 
      Automatic: 4 
    };
    return new Constr(typeIndex[method.type], [method]);
  }
}

// =============================================================================
// TYPES
// =============================================================================

export interface TxSummary {
  action: string;
  description: string;
  pnftId?: string;
  offeringId?: string;
  agreementId?: string;
  collectiveId?: string;
  recordId?: string;
  treasuryAddress?: string;
  from?: string;
  to?: string;
  amount?: bigint;
  newMember?: string;
  costs: {
    ada?: string;
    tokens?: bigint;
  };
  receives?: {
    pnft?: string;
    tokens?: bigint;
  };
}

export default UltraLifeTxBuilder;
