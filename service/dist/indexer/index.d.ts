/**
 * UltraLife Chain Indexer
 *
 * Reads chain state via Blockfrost and provides typed access to UltraLife data.
 * This is what the LLM uses to query current state.
 */
import type { UltraLifeConfig, PnftDatum, Offering, Need, BioregionIndex, Collective, RegistryEntry, ByteArray, AssetName, Address, SpendingBucketDatum, BucketState } from '../types/index.js';
export declare class UltraLifeIndexer {
    private api;
    private config;
    private pnftCache;
    private bioregionCache;
    private offeringCache;
    private needCache;
    private lastSync;
    private syncInterval;
    constructor(config: UltraLifeConfig);
    initialize(): Promise<void>;
    syncState(): Promise<void>;
    getPnft(pnftId: AssetName): Promise<PnftDatum | null>;
    getPnftByOwner(ownerAddress: Address): Promise<PnftDatum | null>;
    listPnfts(options?: {
        bioregion?: ByteArray;
        minLevel?: number;
        limit?: number;
    }): Promise<PnftDatum[]>;
    getBioregion(bioregionId: ByteArray): Promise<BioregionIndex | null>;
    listBioregions(): Promise<BioregionIndex[]>;
    getOffering(offeringId: ByteArray): Promise<Offering | null>;
    listOfferings(options?: {
        bioregion?: ByteArray;
        offerer?: AssetName;
        category?: string;
        status?: string;
        limit?: number;
    }): Promise<Offering[]>;
    getNeed(needId: ByteArray): Promise<Need | null>;
    listNeeds(options?: {
        bioregion?: ByteArray;
        needer?: AssetName;
        status?: string;
        limit?: number;
    }): Promise<Need[]>;
    getTokenBalance(address: Address): Promise<bigint>;
    getPnftTokenBalance(pnftId: AssetName): Promise<bigint>;
    getSpendingBuckets(pnftId: AssetName): Promise<SpendingBucketDatum | null>;
    getBucket(pnftId: AssetName, bucketId: ByteArray): Promise<BucketState | null>;
    listBuckets(pnftId: AssetName): Promise<BucketState[]>;
    private decodeSpendingBucketDatum;
    private decodeBucketState;
    private decodeBucketPeriod;
    getCollective(collectiveId: ByteArray): Promise<Collective | null>;
    listCollectives(options?: {
        bioregion?: ByteArray;
        member?: AssetName;
    }): Promise<Collective[]>;
    getRegistryEntry(code: ByteArray): Promise<RegistryEntry | null>;
    listRegistryEntries(options?: {
        parent?: ByteArray;
        authority_type?: string;
    }): Promise<RegistryEntry[]>;
    /**
     * Get current bonding curve state
     * Price formula: tokens_distributed / 400B (linear curve)
     */
    getTreasuryState(): Promise<{
        totalSupply: bigint;
        distributed: bigint;
        reserved: bigint;
        adaReserve: bigint;
        currentPrice: number;
        nextEpochQueue: bigint;
        founderAccrued: bigint;
        founderClaimed: bigint;
        lastSettlement: number;
    }>;
    /**
     * Get current token price from bonding curve
     */
    getTokenPrice(): Promise<{
        pricePerToken: number;
        pricePerAda: number;
        distributed: string;
        remaining: string;
        percentDistributed: number;
    }>;
    /**
     * Simulate token purchase - calculate tokens received for ADA amount
     */
    simulatePurchase(adaAmount: number): Promise<{
        adaSpent: number;
        tokensReceived: string;
        averagePrice: number;
        priceImpact: number;
        newPrice: number;
    }>;
    /**
     * Get founder compensation status
     * $10,000/month since Jan 2020, settled per epoch at curve price
     */
    getFounderStatus(): Promise<{
        monthlyUsd: number;
        startDate: string;
        totalMonths: number;
        totalOwed: number;
        tokensAccrued: string;
        tokensClaimed: string;
        tokensAvailable: string;
        nextSettlement: string;
    }>;
    private decodeTreasuryDatum;
    private formatTokenAmount;
    getProtocolStats(): Promise<{
        totalPnfts: number;
        totalBioregions: number;
        activeOfferings: number;
        activeNeeds: number;
        totalValueLocked: bigint;
    }>;
    private syncPnfts;
    private syncBioregions;
    private syncOfferings;
    private syncNeeds;
    private decodePnftDatum;
    private decodeBioregionDatum;
    private decodeOfferingDatum;
    private decodeNeedDatum;
    private decodeCollectiveDatum;
    private decodeRegistryDatum;
    private decodeVerificationLevel;
    private decodeIndexValue;
    private decodeCompoundBalances;
    private decodeCompoundFlows;
    private decodeCategoryRef;
    private decodeWhatOffered;
    private decodeWhatNeeded;
    private decodeLocationScope;
    private decodeTimeScope;
    private decodeTerms;
    private decodeBudget;
    private decodeRequirements;
    private decodeCompoundLimits;
    private decodeOfferingStatus;
    private decodeNeedStatus;
    private decodeRegistryAuthority;
    private decodeRegistryStatus;
}
export default UltraLifeIndexer;
//# sourceMappingURL=index.d.ts.map