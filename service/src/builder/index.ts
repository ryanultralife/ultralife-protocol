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

const VerificationLevelSchema = Data.Enum([
  Data.Literal('Basic'),
  Data.Literal('Ward'),
  Data.Literal('Standard'),
  Data.Literal('Verified'),
  Data.Literal('Steward'),
]);

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
    if (result.blocker) throw new Error(result.blocker);
    return {
      unsigned: result,
      summary: {
        action: 'Post Job',
        description: 'UNSIGNED CreateRequest — Ryan must sign on preprod',
        costs: { ada: '~2.5 ADA' },
      },
    };
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
    if (result.blocker) throw new Error(result.blocker);
    return { unsigned: result, summary: { action: 'Bid', description: 'UNSIGNED SubmitBid — Ryan must sign', costs: { ada: '~2 ADA' } } };
  }

  async buildAcceptBid(params: Record<string, unknown>) {
    const result = await buildWorkAuctionUnsigned('accept_bid', params, {
      network: this.config.network,
      blockfrostApiKey: this.config.blockfrostApiKey,
      walletAddress: String(params.user_address || ''),
      contracts: this.config.contracts as any,
      referenceScripts: { work_auction: (this.config.referenceScripts as any)?.work_auction },
    });
    if (result.blocker) throw new Error(result.blocker);
    return { unsigned: result, summary: { action: 'Accept Bid', description: 'UNSIGNED AcceptBid escrow lock', costs: { ada: '~2 ADA' } } };
  }

  async buildSubmitWork(params: Record<string, unknown>) {
    const result = await buildWorkAuctionUnsigned('submit_work', params, {
      network: this.config.network,
      blockfrostApiKey: this.config.blockfrostApiKey,
      walletAddress: String(params.user_address || ''),
      contracts: this.config.contracts as any,
      referenceScripts: { work_auction: (this.config.referenceScripts as any)?.work_auction },
    });
    if (result.blocker) throw new Error(result.blocker);
    return { unsigned: result, summary: { action: 'Submit Work', description: 'UNSIGNED SubmitWork — evidence required, no demo hash', costs: { ada: '~2 ADA' } } };
  }

  async buildReleasePayment(params: Record<string, unknown>) {
    const result = await buildWorkAuctionUnsigned('release_payment', params, {
      network: this.config.network,
      blockfrostApiKey: this.config.blockfrostApiKey,
      walletAddress: String(params.user_address || ''),
      contracts: this.config.contracts as any,
      referenceScripts: { work_auction: (this.config.referenceScripts as any)?.work_auction },
    });
    if (result.blocker) throw new Error(result.blocker);
    return { unsigned: result, summary: { action: 'Release Payment', description: 'UNSIGNED ReleasePayment (escrow must be Verified)', costs: { ada: '~2 ADA' } } };
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
  costs: {
    ada?: string;
    tokens?: bigint;
  };
  receives?: {
    pnft?: string;
    tokens?: bigint;
  };
}

export type { WorkAuctionBuildResult, WorkAuctionAction } from './work-auction.js';
export { buildWorkAuction, loadWorkAuctionDatums } from './work-auction.js';

export default UltraLifeTxBuilder;
