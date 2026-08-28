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
    const currentSlot = BigInt(Math.floor(Date.now() / 1000));
    const none = new Constr(1, []);
    const datum = Data.to(new Constr(0, [
      fromHex(pnftId), fromHex(owner), new Constr(0, []), none, none, none, none, currentSlot, none, none, none,
    ]) as unknown as Data);
    const redeemer = Data.to(new Constr(0, [fromHex(owner)]) as unknown as Data);
    const refScript = await this.getRefScriptUtxo('pnft_mint');
    const tx = await this.lucid.newTx().mintAssets({ [policyId + assetName]: 1n }, redeemer).readFrom([refScript]).payToContract(this.config.contracts.pnft_spend, { inline: datum }, { [policyId + assetName]: 1n }).payToAddress(params.userAddress, { [this.config.contracts.token_policy]: 50_000_000n }).complete();
    return { tx, summary: { action: 'Mint pNFT', description: `Mint Basic pNFT (wallet signature only, not DNA-verified). Unsigned. Ryan signs.`, pnftId, costs: { ada: '~2 ADA (min UTxO + fees)' }, receives: { pnft: `${policyId}${assetName}`, tokens: 50_000_000n } } };
  }

  async buildPostJob(params: Record<string, unknown>): Promise<{ tx?: unknown; summary: TxSummary; unsigned?: object }> {
    const level = String(params.pnftLevel || params.level || '');
    const gate = laborGate(level);
    if (gate) throw new Error(gate);
    const result = await buildWorkAuctionUnsigned('post_job', params, {
      network: this.config.network,
      blockfrostApiKey: this.config.blockfrostApiKey,
      walletAddress: String(params.user_address || params.userAddress || ''),
      contracts: this.config.contracts as any,
      referenceScripts: { work_auction: (this.config.referenceScripts as any)?.work_auction },
    });
    if ((result as any).blocker) throw new Error((result as any).blocker);
    return { unsigned: result, summary: { action: 'Post Job', description: 'UNSIGNED CreateRequest — Ryan must sign on preprod', costs: { ada: '~2.5 ADA' } } };
  }

  async buildBid(params: Record<string, unknown>): Promise<{ tx?: unknown; summary: TxSummary; unsigned?: object }> {
    const level = String(params.pnftLevel || params.level || '');
    const gate = laborGate(level);
    if (gate) throw new Error(gate);
    const result = await buildWorkAuctionUnsigned('bid', params, {
      network: this.config.network,
      blockfrostApiKey: this.config.blockfrostApiKey,
      walletAddress: String(params.user_address || params.userAddress || ''),
      contracts: this.config.contracts as any,
      referenceScripts: { work_auction: (this.config.referenceScripts as any)?.work_auction },
    });
    if ((result as any).blocker) throw new Error((result as any).blocker);
    return { unsigned: result, summary: { action: 'Bid', description: 'UNSIGNED SubmitBid — Ryan must sign', costs: { ada: '~2 ADA' } } };
  }

  async buildAcceptBid(params: Record<string, unknown>) {
    const result = await buildWorkAuctionUnsigned('accept_bid', params, {
      network: this.config.network, blockfrostApiKey: this.config.blockfrostApiKey,
      walletAddress: String(params.user_address || ''), contracts: this.config.contracts as any,
      referenceScripts: { work_auction: (this.config.referenceScripts as any)?.work_auction },
    });
    if ((result as any).blocker) throw new Error((result as any).blocker);
    return { unsigned: result, summary: { action: 'Accept Bid', description: 'UNSIGNED AcceptBid escrow lock', costs: { ada: '~2 ADA' } } };
  }

  async buildSubmitWork(params: Record<string, unknown>) {
    const result = await buildWorkAuctionUnsigned('submit_work', params, {
      network: this.config.network, blockfrostApiKey: this.config.blockfrostApiKey,
      walletAddress: String(params.user_address || ''), contracts: this.config.contracts as any,
      referenceScripts: { work_auction: (this.config.referenceScripts as any)?.work_auction },
    });
    if ((result as any).blocker) throw new Error((result as any).blocker);
    return { unsigned: result, summary: { action: 'Submit Work', description: 'UNSIGNED SubmitWork — evidence required, no demo hash', costs: { ada: '~2 ADA' } } };
  }

  async buildReleasePayment(params: Record<string, unknown>) {
    const result = await buildWorkAuctionUnsigned('release_payment', params, {
      network: this.config.network, blockfrostApiKey: this.config.blockfrostApiKey,
      walletAddress: String(params.user_address || ''), contracts: this.config.contracts as any,
      referenceScripts: { work_auction: (this.config.referenceScripts as any)?.work_auction },
    });
    if ((result as any).blocker) throw new Error((result as any).blocker);
    return { unsigned: result, summary: { action: 'Release Payment', description: 'UNSIGNED ReleasePayment (escrow must be Verified)', costs: { ada: '~2 ADA' } } };
  }

  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(16);
    const random = Math.random().toString(16).slice(2, 10);
    return `${prefix}_${timestamp}${random}`;
  }
  private addressToKeyHash(address: string): string { return address.slice(2, 58); }
  private async getRefScriptUtxo(scriptName: keyof UltraLifeConfig['referenceScripts']): Promise<UTxO> {
    const ref = this.config.referenceScripts[scriptName];
    if (!this.lucid) throw new Error('Builder not initialized');
    const utxos = await this.lucid.utxosByOutRef([{ txHash: ref.txHash, outputIndex: ref.outputIndex }]);
    if (utxos.length === 0) throw new Error(`Reference script not found: ${scriptName}`);
    return utxos[0];
  }
}

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
  costs: { ada?: string; tokens?: bigint };
  receives?: { pnft?: string; tokens?: bigint };
}

export type { WorkAuctionBuildResult, WorkAuctionAction } from './work-auction.js';
export { buildWorkAuction, loadWorkAuctionDatums } from './work-auction.js';
export default UltraLifeTxBuilder;
