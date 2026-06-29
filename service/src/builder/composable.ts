/**
 * UltraLife Composable Transaction Builder
 *
 * Enables Fallen Icarus-style transaction bundling for UltraLife Protocol.
 * Composes multiple DApp actions into single transactions for lower fees and better UX.
 *
 * Cardano's eUTxO model natively supports arbitrary action composition.
 * This builder implements a shopping cart pattern where actions are accumulated
 * and then built into a single optimized transaction.
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
  Tx,
  Constr,
  Address,
  Assets,
} from 'lucid-cardano';
import type {
  UltraLifeConfig,
  CategoryRef,
  WhatOffered,
  LocationScope,
  TimeScope,
  Terms,
  CompoundFlow,
  VerificationMethod,
} from '../types/index.js';
import { UltraLifeIndexer } from '../indexer/index.js';

// =============================================================================
// ACTION TYPES
// =============================================================================

export type TxActionType =
  | 'mint_pnft'
  | 'create_offering'
  | 'accept_offering'
  | 'transfer'
  | 'claim_ubi'
  | 'record_impact'
  | 'create_bucket'
  | 'fund_bucket'
  | 'spend_bucket'
  | 'create_collective'
  | 'add_collective_member'
  | 'claim_grant';

export interface MintPnftParams {
  userAddress: string;
  dnaHash: string;
  verificationProof: string;
}

export interface CreateOfferingParams {
  offererPnft: string;
  category: CategoryRef;
  what: WhatOffered;
  location: LocationScope;
  availability: TimeScope;
  terms: Terms;
  expectedCompounds: CompoundFlow[];
  evidence: string[];
}

export interface AcceptOfferingParams {
  offeringId: string;
  accepterPnft: string;
  payment: bigint;
  completeBy: number;
  verification: VerificationMethod;
}

export interface TransferParams {
  senderPnft: string;
  senderAddress: string;
  recipientPnft: string;
  recipientAddress: string;
  amount: bigint;
  purpose: string;
  compoundFlows?: CompoundFlow[];
}

export interface ClaimUbiParams {
  pnftId: string;
  pnftAddress: string;
  cycle: number;
}

export interface RecordImpactParams {
  actorPnft: string;
  compoundFlows: CompoundFlow[];
  evidenceHash: string;
  destinationType: 'Asset' | 'Consumer' | 'Commons';
  destinationId: string;
}

export interface CreateBucketParams {
  pnftId: string;
  name: string;
  template: string;
  allocation?: bigint;
  period?: string;
  rollover?: boolean;
  maxBalance?: bigint;
  initialFunding?: bigint;
}

export interface FundBucketParams {
  pnftId: string;
  bucketId: string;
  amount: bigint;
}

export interface SpendBucketParams {
  pnftId: string;
  bucketId: string;
  recipientPnft: string;
  recipientAddress: string;
  amount: bigint;
  purpose?: string;
}

export interface CreateCollectiveParams {
  founderPnft: string;
  name: string;
  bioregion: string;
  governanceRules: string;
}

export interface AddCollectiveMemberParams {
  collectiveId: string;
  newMemberPnft: string;
  approverPnft: string;
}

export interface ClaimGrantParams {
  pnftId: string;
  pnftAddress: string;
  grantId: string;
  amount: bigint;
}

export type TxActionParams =
  | { type: 'mint_pnft'; params: MintPnftParams }
  | { type: 'create_offering'; params: CreateOfferingParams }
  | { type: 'accept_offering'; params: AcceptOfferingParams }
  | { type: 'transfer'; params: TransferParams }
  | { type: 'claim_ubi'; params: ClaimUbiParams }
  | { type: 'record_impact'; params: RecordImpactParams }
  | { type: 'create_bucket'; params: CreateBucketParams }
  | { type: 'fund_bucket'; params: FundBucketParams }
  | { type: 'spend_bucket'; params: SpendBucketParams }
  | { type: 'create_collective'; params: CreateCollectiveParams }
  | { type: 'add_collective_member'; params: AddCollectiveMemberParams }
  | { type: 'claim_grant'; params: ClaimGrantParams };

export interface TxAction {
  id: string;
  action: TxActionParams;
  priority: number;
}

// =============================================================================
// COMPOSED TRANSACTION RESULT
// =============================================================================

export interface ComposedTx {
  tx: TxComplete;
  txHash: string;
  actions: TxAction[];
  summary: ComposedTxSummary;
}

export interface ComposedTxSummary {
  actionCount: number;
  actions: ActionSummary[];
  totalCosts: {
    ada: bigint;
    tokens: bigint;
  };
  totalReceives: {
    tokens: bigint;
    pnfts: string[];
  };
  estimatedFees: bigint;
  inputCount: number;
  outputCount: number;
  optimizations: string[];
}

export interface ActionSummary {
  id: string;
  type: TxActionType;
  description: string;
}

// =============================================================================
// INTERNAL TYPES FOR BUILDING
// =============================================================================

interface RequiredInput {
  utxo: UTxO;
  redeemer?: string;
  scriptRef?: string;
}

interface PlannedOutput {
  address: string;
  assets: Assets;
  datum?: string;
  datumHash?: string;
}

interface PlannedMint {
  policyId: string;
  assetName: string;
  quantity: bigint;
  redeemer: string;
  scriptRef: string;
}

// =============================================================================
// COMPOSABLE TRANSACTION BUILDER
// =============================================================================

export class ComposableTxBuilder {
  private actions: TxAction[] = [];
  private lucid: Lucid | null = null;
  private config: UltraLifeConfig;
  private indexer: UltraLifeIndexer;
  private actionCounter = 0;

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
  }

  /**
   * Select the payer as a READ-ONLY wallet (address + its on-chain UTxOs) so
   * build()'s `complete()` can run coin selection and set change WITHOUT a
   * signing key. The result is an UNSIGNED tx the payer later signs (wallet or
   * biometric pNFT). This keeps key custody with the human — the builder never
   * holds a private key.
   */
  async selectPayer(address: string): Promise<void> {
    if (!this.lucid) throw new Error('Builder not initialized');
    const utxos = await this.lucid.utxosAt(address);
    this.lucid.selectWalletFrom({ address, utxos });
  }

  // ===========================================================================
  // CHAINABLE ACTION METHODS
  // ===========================================================================

  addMintPnft(params: MintPnftParams): this {
    this.actions.push({
      id: this.generateActionId('mint_pnft'),
      action: { type: 'mint_pnft', params },
      priority: 10, // Minting should happen early
    });
    return this;
  }

  addCreateOffering(params: CreateOfferingParams): this {
    this.actions.push({
      id: this.generateActionId('create_offering'),
      action: { type: 'create_offering', params },
      priority: 50,
    });
    return this;
  }

  addAcceptOffering(params: AcceptOfferingParams): this {
    this.actions.push({
      id: this.generateActionId('accept_offering'),
      action: { type: 'accept_offering', params },
      priority: 50,
    });
    return this;
  }

  addTransfer(params: TransferParams): this {
    this.actions.push({
      id: this.generateActionId('transfer'),
      action: { type: 'transfer', params },
      priority: 60,
    });
    return this;
  }

  addClaimUbi(params: ClaimUbiParams): this {
    this.actions.push({
      id: this.generateActionId('claim_ubi'),
      action: { type: 'claim_ubi', params },
      priority: 20, // Claims should happen after mints
    });
    return this;
  }

  addRecordImpact(params: RecordImpactParams): this {
    this.actions.push({
      id: this.generateActionId('record_impact'),
      action: { type: 'record_impact', params },
      priority: 70,
    });
    return this;
  }

  addCreateBucket(params: CreateBucketParams): this {
    this.actions.push({
      id: this.generateActionId('create_bucket'),
      action: { type: 'create_bucket', params },
      priority: 30,
    });
    return this;
  }

  addFundBucket(params: FundBucketParams): this {
    this.actions.push({
      id: this.generateActionId('fund_bucket'),
      action: { type: 'fund_bucket', params },
      priority: 40,
    });
    return this;
  }

  addSpendBucket(params: SpendBucketParams): this {
    this.actions.push({
      id: this.generateActionId('spend_bucket'),
      action: { type: 'spend_bucket', params },
      priority: 60,
    });
    return this;
  }

  addCreateCollective(params: CreateCollectiveParams): this {
    this.actions.push({
      id: this.generateActionId('create_collective'),
      action: { type: 'create_collective', params },
      priority: 50,
    });
    return this;
  }

  addAddCollectiveMember(params: AddCollectiveMemberParams): this {
    this.actions.push({
      id: this.generateActionId('add_collective_member'),
      action: { type: 'add_collective_member', params },
      priority: 55,
    });
    return this;
  }

  addClaimGrant(params: ClaimGrantParams): this {
    this.actions.push({
      id: this.generateActionId('claim_grant'),
      action: { type: 'claim_grant', params },
      priority: 25,
    });
    return this;
  }

  /**
   * Add a raw action from the MCP input schema
   */
  addAction(actionInput: { type: string; params: Record<string, unknown> }): this {
    switch (actionInput.type) {
      case 'mint_pnft':
        return this.addMintPnft(actionInput.params as unknown as MintPnftParams);
      case 'create_offering':
        return this.addCreateOffering(actionInput.params as unknown as CreateOfferingParams);
      case 'accept_offering':
        return this.addAcceptOffering(actionInput.params as unknown as AcceptOfferingParams);
      case 'transfer':
        return this.addTransfer(actionInput.params as unknown as TransferParams);
      case 'claim_ubi':
        return this.addClaimUbi(actionInput.params as unknown as ClaimUbiParams);
      case 'record_impact':
        return this.addRecordImpact(actionInput.params as unknown as RecordImpactParams);
      case 'create_bucket':
        return this.addCreateBucket(actionInput.params as unknown as CreateBucketParams);
      case 'fund_bucket':
        return this.addFundBucket(actionInput.params as unknown as FundBucketParams);
      case 'spend_bucket':
        return this.addSpendBucket(actionInput.params as unknown as SpendBucketParams);
      case 'create_collective':
        return this.addCreateCollective(actionInput.params as unknown as CreateCollectiveParams);
      case 'add_collective_member':
        return this.addAddCollectiveMember(actionInput.params as unknown as AddCollectiveMemberParams);
      case 'claim_grant':
        return this.addClaimGrant(actionInput.params as unknown as ClaimGrantParams);
      default:
        throw new Error(`Unknown action type: ${actionInput.type}`);
    }
  }

  // ===========================================================================
  // BUILD & UTILITY METHODS
  // ===========================================================================

  /**
   * Build composed transaction from all added actions
   */
  async build(): Promise<ComposedTx> {
    if (!this.lucid) throw new Error('Builder not initialized');
    if (this.actions.length === 0) throw new Error('No actions to compose');

    // Sort actions by priority (lower = earlier in tx)
    const sortedActions = [...this.actions].sort((a, b) => a.priority - b.priority);

    // Collect all required inputs, outputs, mints, and reference scripts
    const requiredInputs: RequiredInput[] = [];
    const plannedOutputs: PlannedOutput[] = [];
    const plannedMints: PlannedMint[] = [];
    const requiredRefScripts: Set<string> = new Set();
    const optimizations: string[] = [];

    // Process each action
    for (const action of sortedActions) {
      const processed = await this.processAction(action);
      requiredInputs.push(...processed.inputs);
      plannedOutputs.push(...processed.outputs);
      plannedMints.push(...processed.mints);
      processed.refScripts.forEach(ref => requiredRefScripts.add(ref));
    }

    // Merge outputs where possible (same address)
    const mergedOutputs = this.mergeOutputs(plannedOutputs);
    if (mergedOutputs.length < plannedOutputs.length) {
      optimizations.push(`Merged ${plannedOutputs.length - mergedOutputs.length} outputs to same addresses`);
    }

    // Deduplicate inputs
    const uniqueInputs = this.deduplicateInputs(requiredInputs);
    if (uniqueInputs.length < requiredInputs.length) {
      optimizations.push(`Deduplicated ${requiredInputs.length - uniqueInputs.length} inputs`);
    }

    // Fetch all reference scripts
    const refScriptUtxos: UTxO[] = [];
    for (const scriptName of requiredRefScripts) {
      try {
        const refUtxo = await this.getRefScriptUtxo(scriptName as keyof UltraLifeConfig['referenceScripts']);
        refScriptUtxos.push(refUtxo);
      } catch {
        // Reference script not found - might be on different network
      }
    }
    if (refScriptUtxos.length > 0) {
      optimizations.push(`Using ${refScriptUtxos.length} reference scripts to reduce tx size`);
    }

    // Build the transaction
    let txBuilder: Tx = this.lucid.newTx();

    // Add reference scripts
    if (refScriptUtxos.length > 0) {
      txBuilder = txBuilder.readFrom(refScriptUtxos);
    }

    // Add inputs
    for (const input of uniqueInputs) {
      if (input.redeemer) {
        txBuilder = txBuilder.collectFrom([input.utxo], input.redeemer);
      }
    }

    // Add mints
    for (const mint of plannedMints) {
      const assetUnit = mint.policyId + mint.assetName;
      txBuilder = txBuilder.mintAssets({ [assetUnit]: mint.quantity }, mint.redeemer);
    }

    // Add outputs
    for (const output of mergedOutputs) {
      if (output.datum) {
        txBuilder = txBuilder.payToContract(
          output.address,
          { inline: output.datum },
          output.assets
        );
      } else {
        txBuilder = txBuilder.payToAddress(output.address, output.assets);
      }
    }

    // Complete the transaction
    const tx = await txBuilder.complete();

    // Calculate totals
    const totalCosts = this.calculateTotalCosts(uniqueInputs, mergedOutputs, plannedMints);
    const totalReceives = this.calculateTotalReceives(mergedOutputs, plannedMints);

    // Build action summaries
    const actionSummaries: ActionSummary[] = sortedActions.map(action => ({
      id: action.id,
      type: action.action.type,
      description: this.getActionDescription(action),
    }));

    return {
      tx,
      txHash: tx.toHash(),
      actions: sortedActions,
      summary: {
        actionCount: sortedActions.length,
        actions: actionSummaries,
        totalCosts,
        totalReceives,
        estimatedFees: 0n, // Will be calculated after fee estimation
        inputCount: uniqueInputs.length,
        outputCount: mergedOutputs.length,
        optimizations,
      },
    };
  }

  /**
   * Estimate fees for current composition without finalizing
   */
  async estimateFees(): Promise<bigint> {
    if (!this.lucid) throw new Error('Builder not initialized');
    if (this.actions.length === 0) return 0n;

    try {
      const composed = await this.build();
      // Extract fee from transaction
      // Note: Lucid calculates fees during complete()
      return composed.summary.estimatedFees;
    } catch {
      // Return estimate based on action count
      const baseFee = 200_000n; // ~0.2 ADA base
      const perActionFee = 50_000n; // ~0.05 ADA per action
      return baseFee + (BigInt(this.actions.length) * perActionFee);
    }
  }

  /**
   * Clear all actions
   */
  clear(): this {
    this.actions = [];
    this.actionCounter = 0;
    return this;
  }

  /**
   * Get current action count
   */
  getActionCount(): number {
    return this.actions.length;
  }

  /**
   * Get current actions (read-only)
   */
  getActions(): readonly TxAction[] {
    return this.actions;
  }

  // ===========================================================================
  // PRIVATE METHODS
  // ===========================================================================

  private generateActionId(type: string): string {
    return `${type}_${++this.actionCounter}_${Date.now().toString(16)}`;
  }

  private async processAction(action: TxAction): Promise<{
    inputs: RequiredInput[];
    outputs: PlannedOutput[];
    mints: PlannedMint[];
    refScripts: string[];
  }> {
    const inputs: RequiredInput[] = [];
    const outputs: PlannedOutput[] = [];
    const mints: PlannedMint[] = [];
    const refScripts: string[] = [];

    switch (action.action.type) {
      case 'mint_pnft': {
        const params = action.action.params;
        const pnftId = this.generateId('pnft');
        const assetName = fromText(pnftId);
        const currentSlot = BigInt(Math.floor(Date.now() / 1000));

        // Build datum
        const datum = Data.to(new Constr(0, [
          fromHex(pnftId),
          fromHex(this.addressToKeyHash(params.userAddress)),
          new Constr(2, []), // Standard level
          new Constr(1, []), // bioregion = None
          new Constr(0, [fromHex(params.dnaHash)]),
          new Constr(1, []), // guardian = None
          new Constr(1, []), // ward_since = None
          currentSlot,
          new Constr(1, []), // upgraded_at = None
          new Constr(1, []), // consumer_impacts = None
          0n,
        ]) as unknown as Data);

        const redeemer = Data.to(new Constr(0, [
          fromHex(params.dnaHash),
          fromHex(params.verificationProof),
        ]) as unknown as Data);

        mints.push({
          policyId: this.config.contracts.pnft_policy,
          assetName,
          quantity: 1n,
          redeemer,
          scriptRef: 'pnft_mint',
        });

        outputs.push({
          address: this.config.contracts.pnft_spend,
          assets: { [this.config.contracts.pnft_policy + assetName]: 1n, lovelace: 2_000_000n },
          datum,
        });

        // Bootstrap grant
        outputs.push({
          address: params.userAddress,
          assets: { [this.config.contracts.token_policy]: 50_000_000n },
        });

        refScripts.push('pnft_mint');
        break;
      }

      case 'create_offering': {
        const params = action.action.params;
        const offeringId = this.generateId('offering');

        const datum = Data.to(new Constr(0, [
          fromHex(offeringId),
          fromHex(params.offererPnft),
          this.encodeCategoryRef(params.category),
          this.encodeWhatOffered(params.what),
          this.encodeLocationScope(params.location),
          this.encodeTimeScope(params.availability),
          this.encodeTerms(params.terms),
          [],
          params.evidence.map(e => fromHex(e)),
          new Constr(0, []), // Active
          BigInt(Math.floor(Date.now() / 1000)),
        ]) as unknown as Data);

        outputs.push({
          address: this.config.contracts.marketplace,
          assets: { lovelace: 2_000_000n },
          datum,
        });

        refScripts.push('marketplace');
        break;
      }

      case 'transfer': {
        const params = action.action.params;
        const recordId = this.generateId('record');

        const recordDatum = Data.to(new Constr(0, [
          fromHex(recordId),
          fromHex(params.senderPnft),
          fromHex(params.recipientPnft),
          params.amount,
          fromText(params.purpose),
          [],
          BigInt(Math.floor(Date.now() / 1000)),
        ]) as unknown as Data);

        // Token transfer
        outputs.push({
          address: params.recipientAddress,
          assets: { [this.config.contracts.token_policy]: params.amount },
        });

        // Record
        outputs.push({
          address: this.config.contracts.records,
          assets: { lovelace: 2_000_000n },
          datum: recordDatum,
        });

        refScripts.push('token', 'records');
        break;
      }

      case 'create_bucket': {
        const params = action.action.params;
        const bucketId = this.generateId('bucket');
        const initialFunding = params.initialFunding || 0n;
        const currentTime = BigInt(Math.floor(Date.now() / 1000));

        const config = this.getBucketConfigFromTemplate(
          params.template,
          bucketId,
          params.name,
          params.allocation,
          params.period,
          params.rollover,
          params.maxBalance
        );

        const bucketConfig = new Constr(0, [
          fromHex(bucketId),
          fromText(params.name),
          config.allocation,
          this.encodePeriod(config.period),
          config.rollover ? 1n : 0n,
          config.maxBalance,
          config.minBalance,
          [],
          0n,
        ]);

        const bucketState = new Constr(0, [
          bucketConfig,
          initialFunding,
          currentTime,
          0n,
          0n,
          currentTime,
        ]);

        const datum = Data.to(new Constr(0, [
          fromHex(params.pnftId),
          [bucketState],
          initialFunding,
          new Constr(1, []),
          currentTime,
          currentTime,
        ]) as unknown as Data);

        const assets: Assets = { lovelace: 2_000_000n };
        if (initialFunding > 0n) {
          assets[this.config.contracts.token_policy] = initialFunding;
        }

        outputs.push({
          address: this.config.contracts.spending_bucket,
          assets,
          datum,
        });

        refScripts.push('spending_bucket');
        break;
      }

      case 'fund_bucket': {
        const params = action.action.params;
        // Would need to fetch and update existing bucket UTxO
        // Simplified for now
        refScripts.push('spending_bucket');
        break;
      }

      case 'claim_ubi': {
        const params = action.action.params;
        // UBI claims would interact with the ubi validator
        outputs.push({
          address: params.pnftAddress,
          assets: { [this.config.contracts.token_policy]: 100_000_000n }, // Example UBI amount
        });
        refScripts.push('ubi');
        break;
      }

      case 'record_impact': {
        const params = action.action.params;
        const recordId = this.generateId('impact');

        const impactDatum = Data.to(new Constr(0, [
          fromHex(recordId),
          fromHex('00'), // agreement_id placeholder
          fromHex(params.actorPnft),
          params.compoundFlows.map(flow => new Constr(0, [
            fromHex(flow.compound),
            flow.quantity,
            fromHex(flow.unit),
            fromHex(flow.measurement),
            BigInt(flow.confidence),
          ])),
          fromHex(params.evidenceHash),
          BigInt(Math.floor(Date.now() / 1000)),
          [],
          this.encodeImpactDestination(params.destinationType, params.destinationId),
        ]) as unknown as Data);

        outputs.push({
          address: this.config.contracts.impact,
          assets: { lovelace: 2_000_000n },
          datum: impactDatum,
        });

        refScripts.push('impact');
        break;
      }

      case 'claim_grant': {
        const params = action.action.params;
        outputs.push({
          address: params.pnftAddress,
          assets: { [this.config.contracts.token_policy]: params.amount },
        });
        refScripts.push('grants');
        break;
      }

      case 'create_collective': {
        const params = action.action.params;
        const collectiveId = this.generateId('collective');

        const datum = Data.to(new Constr(0, [
          fromHex(collectiveId),
          fromText(params.name),
          [fromHex(params.founderPnft)],
          [],
          fromHex(params.governanceRules),
          fromHex(`treasury_${collectiveId}`),
          fromHex(params.bioregion),
        ]) as unknown as Data);

        outputs.push({
          address: this.config.contracts.collective,
          assets: { lovelace: 2_000_000n },
          datum,
        });

        refScripts.push('collective');
        break;
      }

      // Additional action types can be implemented similarly
    }

    return { inputs, outputs, mints, refScripts };
  }

  private mergeOutputs(outputs: PlannedOutput[]): PlannedOutput[] {
    const merged: Map<string, PlannedOutput> = new Map();

    for (const output of outputs) {
      // Only merge outputs without datums to same addresses
      if (output.datum) {
        // Contract outputs with datums can't be merged
        merged.set(`${output.address}_${Date.now()}_${Math.random()}`, output);
        continue;
      }

      const existing = merged.get(output.address);
      if (existing && !existing.datum) {
        // Merge assets
        for (const [asset, amount] of Object.entries(output.assets)) {
          existing.assets[asset] = (existing.assets[asset] || 0n) + (amount as bigint);
        }
      } else {
        merged.set(output.address, { ...output, assets: { ...output.assets } });
      }
    }

    return Array.from(merged.values());
  }

  private deduplicateInputs(inputs: RequiredInput[]): RequiredInput[] {
    const seen = new Set<string>();
    return inputs.filter(input => {
      const key = `${input.utxo.txHash}#${input.utxo.outputIndex}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private calculateTotalCosts(
    inputs: RequiredInput[],
    outputs: PlannedOutput[],
    mints: PlannedMint[]
  ): { ada: bigint; tokens: bigint } {
    let ada = 0n;
    let tokens = 0n;

    // Sum up output costs
    for (const output of outputs) {
      ada += output.assets.lovelace || 0n;
      for (const [asset, amount] of Object.entries(output.assets)) {
        if (asset !== 'lovelace' && asset.startsWith(this.config.contracts.token_policy)) {
          tokens += amount as bigint;
        }
      }
    }

    return { ada, tokens };
  }

  private calculateTotalReceives(
    outputs: PlannedOutput[],
    mints: PlannedMint[]
  ): { tokens: bigint; pnfts: string[] } {
    let tokens = 0n;
    const pnfts: string[] = [];

    // Minted pNFTs
    for (const mint of mints) {
      if (mint.policyId === this.config.contracts.pnft_policy) {
        pnfts.push(mint.policyId + mint.assetName);
      }
    }

    // Bootstrap grants and other token outputs
    for (const output of outputs) {
      for (const [asset, amount] of Object.entries(output.assets)) {
        if (asset !== 'lovelace' && asset.startsWith(this.config.contracts.token_policy)) {
          tokens += amount as bigint;
        }
      }
    }

    return { tokens, pnfts };
  }

  private getActionDescription(action: TxAction): string {
    switch (action.action.type) {
      case 'mint_pnft':
        return 'Mint new pNFT identity';
      case 'create_offering':
        return `Create marketplace offering`;
      case 'accept_offering':
        return `Accept offering ${action.action.params.offeringId}`;
      case 'transfer':
        return `Transfer ${action.action.params.amount} ULTRA`;
      case 'claim_ubi':
        return 'Claim UBI distribution';
      case 'record_impact':
        return 'Record environmental impact';
      case 'create_bucket':
        return `Create spending bucket "${action.action.params.name}"`;
      case 'fund_bucket':
        return `Fund bucket with ${action.action.params.amount} ULTRA`;
      case 'spend_bucket':
        return `Spend ${action.action.params.amount} ULTRA from bucket`;
      case 'create_collective':
        return `Create collective "${action.action.params.name}"`;
      case 'add_collective_member':
        return `Add member to collective`;
      case 'claim_grant':
        return `Claim grant of ${action.action.params.amount} ULTRA`;
      default:
        return 'Unknown action';
    }
  }

  // ===========================================================================
  // HELPER METHODS (imported from original builder)
  // ===========================================================================

  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(16);
    const random = Math.random().toString(16).slice(2, 10);
    return `${prefix}_${timestamp}${random}`;
  }

  private addressToKeyHash(address: string): string {
    return address.slice(2, 58);
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

  private getBucketConfigFromTemplate(
    template: string,
    bucketId: string,
    name: string,
    allocation?: bigint,
    period?: string,
    rollover?: boolean,
    maxBalance?: bigint,
  ): { allocation: bigint; period: string; rollover: boolean; maxBalance: bigint; minBalance: bigint } {
    const templates: Record<string, { allocation: bigint; period: string; rollover: boolean; maxBalance: bigint; minBalance: bigint }> = {
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

  private encodePeriod(period: string): Constr<Data> {
    const periods: Record<string, number> = { Daily: 0, Weekly: 1, Monthly: 2, Quarterly: 3, Yearly: 4 };
    return new Constr(periods[period] || 0, []);
  }

  private encodeCategoryRef(cat: CategoryRef): Constr<Data> {
    if (cat.type === 'Registry') {
      return new Constr(0, [cat.code! as unknown as Data]);
    }
    return new Constr(1, [cat.description_hash! as unknown as Data]);
  }

  private encodeWhatOffered(what: WhatOffered): Constr<Data> {
    const typeIndex: Record<string, number> = { Thing: 0, Work: 1, Access: 2, Knowledge: 3, Care: 4 };
    return new Constr(typeIndex[what.type], [what as unknown as Data]);
  }

  private encodeLocationScope(loc: LocationScope): Constr<Data> {
    const typeIndex: Record<string, number> = { Specific: 0, Bioregional: 1, Mobile: 2, Remote: 3, Anywhere: 4 };
    if (loc.type === 'Remote' || loc.type === 'Anywhere') {
      return new Constr(typeIndex[loc.type], []);
    }
    return new Constr(typeIndex[loc.type], [loc as unknown as Data]);
  }

  private encodeTimeScope(time: TimeScope): Constr<Data> {
    const typeIndex: Record<string, number> = { Now: 0, Scheduled: 1, Recurring: 2, OnDemand: 3 };
    if (time.type === 'Now' || time.type === 'OnDemand') {
      return new Constr(typeIndex[time.type], []);
    }
    return new Constr(typeIndex[time.type], [time as unknown as Data]);
  }

  private encodeTerms(terms: Terms): Constr<Data> {
    const typeIndex: Record<string, number> = { Priced: 0, Range: 1, Auction: 2, Trade: 3, Gift: 4, CommunityService: 5 };
    if (terms.type === 'CommunityService') {
      return new Constr(5, []);
    }
    return new Constr(typeIndex[terms.type], [terms as unknown as Data]);
  }

  private encodeImpactDestination(type: string, id: string): Constr<Data> {
    const typeIndex: Record<string, number> = { Asset: 0, Consumer: 1, Commons: 2 };
    return new Constr(typeIndex[type] || 0, [id as unknown as Data]);
  }
}

// =============================================================================
// COMPOSITION BUNDLES (Common patterns)
// =============================================================================

/**
 * Common composition patterns for frequent use cases
 */
export const CompositionBundles = {
  /**
   * Onboarding bundle: mint_pnft + claim_grant + create_bucket
   */
  onboarding: (params: {
    userAddress: string;
    dnaHash: string;
    verificationProof: string;
    pnftId: string;
    grantId: string;
    grantAmount: bigint;
    bucketName: string;
    bucketTemplate: string;
  }) => {
    return [
      { type: 'mint_pnft', params: { userAddress: params.userAddress, dnaHash: params.dnaHash, verificationProof: params.verificationProof } },
      { type: 'claim_grant', params: { pnftId: params.pnftId, pnftAddress: params.userAddress, grantId: params.grantId, amount: params.grantAmount } },
      { type: 'create_bucket', params: { pnftId: params.pnftId, name: params.bucketName, template: params.bucketTemplate } },
    ];
  },

  /**
   * Marketplace setup bundle: create_offering + fund_bucket
   */
  marketplaceSetup: (params: {
    offeringParams: CreateOfferingParams;
    fundBucketParams: FundBucketParams;
  }) => {
    return [
      { type: 'create_offering', params: params.offeringParams },
      { type: 'fund_bucket', params: params.fundBucketParams },
    ];
  },

  /**
   * Settlement bundle: multiple transfers in one tx
   */
  settlement: (transfers: TransferParams[]) => {
    return transfers.map(params => ({ type: 'transfer', params }));
  },

  /**
   * Impact bundle: record multiple compound flows
   */
  impactRecord: (impacts: RecordImpactParams[]) => {
    return impacts.map(params => ({ type: 'record_impact', params }));
  },

  /**
   * Property OS — Lease rent settlement.
   * Atomic tx: rent (net) to the lessor + operator commission to the operator pNFT.
   * Realizes the operator's commission split (e.g. 600 bps = 6%) trustlessly in one tx.
   */
  leaseRentSettlement: (params: {
    payerPnft: string; payerAddress: string;
    lessorPnft: string; lessorAddress: string;
    operatorPnft: string; operatorAddress: string;
    rent: bigint; commissionBps: number;
  }) => {
    const commission = (params.rent * BigInt(params.commissionBps)) / 10000n;
    const net = params.rent - commission;
    return [
      { type: 'transfer', params: { senderPnft: params.payerPnft, senderAddress: params.payerAddress, recipientPnft: params.lessorPnft, recipientAddress: params.lessorAddress, amount: net, purpose: 'lease_rent' } },
      { type: 'transfer', params: { senderPnft: params.payerPnft, senderAddress: params.payerAddress, recipientPnft: params.operatorPnft, recipientAddress: params.operatorAddress, amount: commission, purpose: 'operator_commission' } },
    ];
  },

  /**
   * Property OS — Work settlement.
   * Atomic tx: pay the worker pNFT + (optionally) record the maintenance/build impact.
   */
  workSettlement: (params: {
    payerPnft: string; payerAddress: string;
    workerPnft: string; workerAddress: string;
    amount: bigint; impact?: RecordImpactParams;
  }) => {
    const actions: Array<{ type: string; params: unknown }> = [
      { type: 'transfer', params: { senderPnft: params.payerPnft, senderAddress: params.payerAddress, recipientPnft: params.workerPnft, recipientAddress: params.workerAddress, amount: params.amount, purpose: 'work_payment' } },
    ];
    if (params.impact) actions.push({ type: 'record_impact', params: params.impact });
    return actions;
  },

  /**
   * Property OS — Worker onboarding. Mints the worker's pNFT identity so they can
   * receive work-auction assignments and trustless pay.
   */
  workerOnboarding: (params: MintPnftParams) => {
    return [{ type: 'mint_pnft', params }];
  },
};

export default ComposableTxBuilder;
