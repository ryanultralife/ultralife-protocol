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

export class UltraLifeTxBuilder {
  private lucid: Lucid | null = null;
  private config: UltraLifeConfig;
  private indexer: UltraLifeIndexer;
  constructor(config: UltraLifeConfig, indexer: UltraLifeIndexer) {
    this.config = config;
    this.indexer = indexer;
  }
}

export interface TxSummary {
  action: string;
  description: string;
  costs: { ada?: string; tokens?: bigint };
}

export type { WorkAuctionBuildResult, WorkAuctionAction } from './work-auction.js';
export { buildWorkAuction, loadWorkAuctionDatums } from './work-auction.js';
export default UltraLifeTxBuilder;
