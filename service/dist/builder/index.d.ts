/**
 * UltraLife Transaction Builder
 *
 * Builds unsigned transactions for UltraLife operations.
 * Uses Lucid for transaction construction and references on-chain scripts.
 */
import { TxComplete } from 'lucid-cardano';
import type { UltraLifeConfig, CompoundFlow, Terms, CategoryRef, WhatOffered, LocationScope, TimeScope, VerificationMethod } from '../types/index.js';
import { UltraLifeIndexer } from '../indexer/index.js';
export declare class UltraLifeTxBuilder {
    private lucid;
    private config;
    private indexer;
    constructor(config: UltraLifeConfig, indexer: UltraLifeIndexer);
    initialize(): Promise<void>;
    /**
     * Build transaction to mint a new pNFT
     */
    buildMintPnft(params: {
        userAddress: string;
        dnaHash: string;
        verificationProof: string;
    }): Promise<{
        tx: TxComplete;
        summary: TxSummary;
    }>;
    /**
     * Build transaction to upgrade pNFT verification level
     */
    buildUpgradePnft(params: {
        pnftId: string;
        newLevel: 'Verified' | 'Steward';
        proof: string;
    }): Promise<{
        tx: TxComplete;
        summary: TxSummary;
    }>;
    /**
     * Build transaction to create a new offering
     */
    buildCreateOffering(params: {
        offererPnft: string;
        category: CategoryRef;
        what: WhatOffered;
        location: LocationScope;
        availability: TimeScope;
        terms: Terms;
        expectedCompounds: CompoundFlow[];
        evidence: string[];
    }): Promise<{
        tx: TxComplete;
        summary: TxSummary;
    }>;
    /**
     * Build transaction to accept an offering (create agreement)
     */
    buildAcceptOffering(params: {
        offeringId: string;
        accepterPnft: string;
        payment: bigint;
        completeBy: number;
        verification: VerificationMethod;
    }): Promise<{
        tx: TxComplete;
        summary: TxSummary;
    }>;
    /**
     * Build transaction to create a collective ("business")
     */
    buildCreateCollective(params: {
        founderPnft: string;
        name: string;
        bioregion: string;
        governanceRules: string;
    }): Promise<{
        tx: TxComplete;
        summary: TxSummary;
    }>;
    /**
     * Build transaction to add member to collective
     */
    buildAddCollectiveMember(params: {
        collectiveId: string;
        newMemberPnft: string;
        approverPnft: string;
    }): Promise<{
        tx: TxComplete;
        summary: TxSummary;
    }>;
    /**
     * Build transaction to transfer tokens between pNFTs
     */
    buildTransferTokens(params: {
        senderPnft: string;
        senderAddress: string;
        recipientPnft: string;
        recipientAddress: string;
        amount: bigint;
        purpose: string;
        compoundFlows?: CompoundFlow[];
    }): Promise<{
        tx: TxComplete;
        summary: TxSummary;
    }>;
    /**
     * Build transaction to purchase tokens from development pool
     */
    buildPurchaseFromPool(params: {
        buyerAddress: string;
        adaAmount: bigint;
    }): Promise<{
        tx: TxComplete;
        summary: TxSummary;
    }>;
    /**
     * Build transaction to create a new spending bucket
     */
    buildCreateBucket(params: {
        pnftId: string;
        name: string;
        template: string;
        allocation?: bigint;
        period?: string;
        rollover?: boolean;
        maxBalance?: bigint;
        initialFunding?: bigint;
    }): Promise<{
        tx: TxComplete;
        summary: TxSummary;
    }>;
    /**
     * Build transaction to fund a bucket
     */
    buildFundBucket(params: {
        pnftId: string;
        bucketId: string;
        amount: bigint;
    }): Promise<{
        tx: TxComplete;
        summary: TxSummary;
    }>;
    /**
     * Build transaction to spend from a bucket
     */
    buildSpendBucket(params: {
        pnftId: string;
        bucketId: string;
        recipientPnft: string;
        recipientAddress: string;
        amount: bigint;
        purpose?: string;
    }): Promise<{
        tx: TxComplete;
        summary: TxSummary;
    }>;
    /**
     * Build transaction to transfer between buckets
     */
    buildTransferBetweenBuckets(params: {
        pnftId: string;
        fromBucket: string;
        toBucket: string;
        amount: bigint;
    }): Promise<{
        tx: TxComplete;
        summary: TxSummary;
    }>;
    private getBucketConfigFromTemplate;
    private encodePeriod;
    private findBucketUtxo;
    private generateId;
    private hashString;
    private addressToKeyHash;
    private generateTreasuryAddress;
    private getRefScriptUtxo;
    private findPnftUtxo;
    private findCollectiveUtxo;
    private encodeCategoryRef;
    private encodeWhatOffered;
    private encodeLocationScope;
    private encodeTimeScope;
    private encodeTerms;
    private encodeVerificationMethod;
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
export default UltraLifeTxBuilder;
//# sourceMappingURL=index.d.ts.map