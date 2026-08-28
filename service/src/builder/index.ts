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
