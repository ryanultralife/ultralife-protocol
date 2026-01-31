/**
 * UltraLife Chain Indexer
 *
 * Reads chain state via Blockfrost and provides typed access to UltraLife data.
 * This is what the LLM uses to query current state.
 */
import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import * as cbor from 'cbor';
// =============================================================================
// INDEXER CLASS
// =============================================================================
export class UltraLifeIndexer {
    api;
    config;
    // Caches for fast queries (refreshed periodically)
    pnftCache = new Map();
    bioregionCache = new Map();
    offeringCache = new Map();
    needCache = new Map();
    lastSync = 0;
    syncInterval = 30000; // 30 seconds
    constructor(config) {
        this.config = config;
        this.api = new BlockFrostAPI({
            projectId: config.blockfrostApiKey,
            network: config.network === 'mainnet' ? 'mainnet' : 'preprod',
        });
    }
    // ===========================================================================
    // INITIALIZATION
    // ===========================================================================
    async initialize() {
        console.log('Initializing UltraLife indexer...');
        await this.syncState();
        console.log('Indexer initialized');
    }
    async syncState() {
        const now = Date.now();
        if (now - this.lastSync < this.syncInterval) {
            return; // Skip if recently synced
        }
        console.log('Syncing chain state...');
        // Sync in parallel
        await Promise.all([
            this.syncPnfts(),
            this.syncBioregions(),
            this.syncOfferings(),
            this.syncNeeds(),
        ]);
        this.lastSync = now;
        console.log(`Synced: ${this.pnftCache.size} pNFTs, ${this.bioregionCache.size} bioregions, ${this.offeringCache.size} offerings`);
    }
    // ===========================================================================
    // pNFT QUERIES
    // ===========================================================================
    async getPnft(pnftId) {
        // Check cache first
        if (this.pnftCache.has(pnftId)) {
            return this.pnftCache.get(pnftId);
        }
        // Query chain
        try {
            const assetId = this.config.contracts.pnft_policy + pnftId;
            const addresses = await this.api.assetsAddresses(assetId);
            if (addresses.length === 0) {
                return null;
            }
            const utxos = await this.api.addressesUtxos(addresses[0].address);
            const utxo = utxos.find(u => u.amount.some(a => a.unit === assetId));
            if (!utxo || !utxo.inline_datum) {
                return null;
            }
            const datum = this.decodePnftDatum(utxo.inline_datum);
            this.pnftCache.set(pnftId, datum);
            return datum;
        }
        catch (error) {
            console.error(`Error fetching pNFT ${pnftId}:`, error);
            return null;
        }
    }
    async getPnftByOwner(ownerAddress) {
        try {
            const utxos = await this.api.addressesUtxos(ownerAddress);
            for (const utxo of utxos) {
                const pnftAsset = utxo.amount.find(a => a.unit.startsWith(this.config.contracts.pnft_policy) && a.unit.length > 56);
                if (pnftAsset && utxo.inline_datum) {
                    return this.decodePnftDatum(utxo.inline_datum);
                }
            }
            return null;
        }
        catch (error) {
            console.error(`Error fetching pNFT for owner ${ownerAddress}:`, error);
            return null;
        }
    }
    async listPnfts(options) {
        await this.syncState();
        let results = Array.from(this.pnftCache.values());
        if (options?.bioregion) {
            results = results.filter(p => p.bioregion === options.bioregion);
        }
        if (options?.minLevel !== undefined) {
            const levelOrder = { 'Basic': 0, 'Ward': 0, 'Standard': 1, 'Verified': 2, 'Steward': 3 };
            results = results.filter(p => (levelOrder[p.level] ?? 0) >= options.minLevel);
        }
        if (options?.limit) {
            results = results.slice(0, options.limit);
        }
        return results;
    }
    // ===========================================================================
    // BIOREGION QUERIES
    // ===========================================================================
    async getBioregion(bioregionId) {
        if (this.bioregionCache.has(bioregionId)) {
            return this.bioregionCache.get(bioregionId);
        }
        try {
            const utxos = await this.api.addressesUtxos(this.config.contracts.bioregion);
            for (const utxo of utxos) {
                if (utxo.inline_datum) {
                    const datum = this.decodeBioregionDatum(utxo.inline_datum);
                    if (datum.bioregion === bioregionId) {
                        this.bioregionCache.set(bioregionId, datum);
                        return datum;
                    }
                }
            }
            return null;
        }
        catch (error) {
            console.error(`Error fetching bioregion ${bioregionId}:`, error);
            return null;
        }
    }
    async listBioregions() {
        await this.syncState();
        return Array.from(this.bioregionCache.values());
    }
    // ===========================================================================
    // OFFERING QUERIES
    // ===========================================================================
    async getOffering(offeringId) {
        if (this.offeringCache.has(offeringId)) {
            return this.offeringCache.get(offeringId);
        }
        try {
            const utxos = await this.api.addressesUtxos(this.config.contracts.marketplace);
            for (const utxo of utxos) {
                if (utxo.inline_datum) {
                    const datum = this.decodeOfferingDatum(utxo.inline_datum);
                    if (datum.offering_id === offeringId) {
                        this.offeringCache.set(offeringId, datum);
                        return datum;
                    }
                }
            }
            return null;
        }
        catch (error) {
            console.error(`Error fetching offering ${offeringId}:`, error);
            return null;
        }
    }
    async listOfferings(options) {
        await this.syncState();
        let results = Array.from(this.offeringCache.values());
        if (options?.bioregion) {
            results = results.filter(o => {
                if (o.location.type === 'Bioregional') {
                    return o.location.bioregion === options.bioregion;
                }
                if (o.location.type === 'Specific') {
                    return o.location.bioregion === options.bioregion;
                }
                return o.location.type === 'Anywhere' || o.location.type === 'Remote';
            });
        }
        if (options?.offerer) {
            results = results.filter(o => o.offerer === options.offerer);
        }
        if (options?.status) {
            results = results.filter(o => o.status === options.status);
        }
        if (options?.limit) {
            results = results.slice(0, options.limit);
        }
        return results;
    }
    // ===========================================================================
    // NEED QUERIES
    // ===========================================================================
    async getNeed(needId) {
        if (this.needCache.has(needId)) {
            return this.needCache.get(needId);
        }
        try {
            const utxos = await this.api.addressesUtxos(this.config.contracts.work_auction);
            for (const utxo of utxos) {
                if (utxo.inline_datum) {
                    const datum = this.decodeNeedDatum(utxo.inline_datum);
                    if (datum.need_id === needId) {
                        this.needCache.set(needId, datum);
                        return datum;
                    }
                }
            }
            return null;
        }
        catch (error) {
            console.error(`Error fetching need ${needId}:`, error);
            return null;
        }
    }
    async listNeeds(options) {
        await this.syncState();
        let results = Array.from(this.needCache.values());
        if (options?.bioregion) {
            results = results.filter(n => {
                if (n.location.type === 'Bioregional') {
                    return n.location.bioregion === options.bioregion;
                }
                return true;
            });
        }
        if (options?.needer) {
            results = results.filter(n => n.needer === options.needer);
        }
        if (options?.status) {
            results = results.filter(n => n.status === options.status);
        }
        if (options?.limit) {
            results = results.slice(0, options.limit);
        }
        return results;
    }
    // ===========================================================================
    // TOKEN BALANCE QUERIES
    // ===========================================================================
    async getTokenBalance(address) {
        try {
            const utxos = await this.api.addressesUtxos(address);
            let balance = 0n;
            for (const utxo of utxos) {
                const tokenAmount = utxo.amount.find(a => a.unit === this.config.contracts.token_policy);
                if (tokenAmount) {
                    balance += BigInt(tokenAmount.quantity);
                }
            }
            return balance;
        }
        catch (error) {
            console.error(`Error fetching token balance for ${address}:`, error);
            return 0n;
        }
    }
    async getPnftTokenBalance(pnftId) {
        const pnft = await this.getPnft(pnftId);
        if (!pnft)
            return 0n;
        // Find the address holding this pNFT
        const assetId = this.config.contracts.pnft_policy + pnftId;
        const addresses = await this.api.assetsAddresses(assetId);
        if (addresses.length === 0)
            return 0n;
        return this.getTokenBalance(addresses[0].address);
    }
    // ===========================================================================
    // SPENDING BUCKET QUERIES
    // ===========================================================================
    async getSpendingBuckets(pnftId) {
        try {
            const utxos = await this.api.addressesUtxos(this.config.contracts.spending_bucket);
            for (const utxo of utxos) {
                if (utxo.inline_datum) {
                    const datum = this.decodeSpendingBucketDatum(utxo.inline_datum);
                    if (datum.owner_pnft === pnftId) {
                        return datum;
                    }
                }
            }
            return null;
        }
        catch (error) {
            console.error(`Error fetching spending buckets for ${pnftId}:`, error);
            return null;
        }
    }
    async getBucket(pnftId, bucketId) {
        const buckets = await this.getSpendingBuckets(pnftId);
        if (!buckets)
            return null;
        return buckets.buckets.find(b => b.config.bucket_id === bucketId) || null;
    }
    async listBuckets(pnftId) {
        const buckets = await this.getSpendingBuckets(pnftId);
        return buckets?.buckets || [];
    }
    decodeSpendingBucketDatum(inlineDatum) {
        const decoded = cbor.decode(Buffer.from(inlineDatum, 'hex'));
        return {
            owner_pnft: decoded[0]?.toString('hex') || '',
            buckets: (decoded[1] || []).map((b) => this.decodeBucketState(b)),
            total_funds: BigInt(decoded[2] || 0),
            hydra_head: decoded[3]?.toString('hex') || null,
            last_settlement: Number(decoded[4]) || 0,
            created_at: Number(decoded[5]) || 0,
        };
    }
    decodeBucketState(value) {
        return {
            config: {
                bucket_id: value[0]?.[0]?.toString('hex') || '',
                name_hash: value[0]?.[1]?.toString('hex') || '',
                allocation: BigInt(value[0]?.[2] || 0),
                period: this.decodeBucketPeriod(value[0]?.[3]),
                rollover: Boolean(value[0]?.[4]),
                max_balance: BigInt(value[0]?.[5] || 0),
                min_balance: BigInt(value[0]?.[6] || 0),
                allowed_categories: (value[0]?.[7] || []).map((c) => c.toString('hex')),
                locked_until: Number(value[0]?.[8]) || 0,
            },
            balance: BigInt(value[1] || 0),
            period_start: Number(value[2]) || 0,
            spent_this_period: BigInt(value[3] || 0),
            total_spent: BigInt(value[4] || 0),
            last_activity: Number(value[5]) || 0,
        };
    }
    decodeBucketPeriod(value) {
        const periods = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Yearly'];
        return periods[value] || 'Daily';
    }
    // ===========================================================================
    // COLLECTIVE QUERIES
    // ===========================================================================
    async getCollective(collectiveId) {
        try {
            const utxos = await this.api.addressesUtxos(this.config.contracts.collective);
            for (const utxo of utxos) {
                if (utxo.inline_datum) {
                    const datum = this.decodeCollectiveDatum(utxo.inline_datum);
                    if (datum.collective_id === collectiveId) {
                        return datum;
                    }
                }
            }
            return null;
        }
        catch (error) {
            console.error(`Error fetching collective ${collectiveId}:`, error);
            return null;
        }
    }
    async listCollectives(options) {
        try {
            const utxos = await this.api.addressesUtxos(this.config.contracts.collective);
            const collectives = [];
            for (const utxo of utxos) {
                if (utxo.inline_datum) {
                    const datum = this.decodeCollectiveDatum(utxo.inline_datum);
                    if (options?.bioregion && datum.bioregion !== options.bioregion) {
                        continue;
                    }
                    if (options?.member && !datum.members.includes(options.member)) {
                        continue;
                    }
                    collectives.push(datum);
                }
            }
            return collectives;
        }
        catch (error) {
            console.error('Error listing collectives:', error);
            return [];
        }
    }
    // ===========================================================================
    // REGISTRY QUERIES
    // ===========================================================================
    async getRegistryEntry(code) {
        try {
            const utxos = await this.api.addressesUtxos(this.config.contracts.registry);
            for (const utxo of utxos) {
                if (utxo.inline_datum) {
                    const datum = this.decodeRegistryDatum(utxo.inline_datum);
                    if (datum.code === code) {
                        return datum;
                    }
                }
            }
            return null;
        }
        catch (error) {
            console.error(`Error fetching registry entry ${code}:`, error);
            return null;
        }
    }
    async listRegistryEntries(options) {
        try {
            const utxos = await this.api.addressesUtxos(this.config.contracts.registry);
            const entries = [];
            for (const utxo of utxos) {
                if (utxo.inline_datum) {
                    const datum = this.decodeRegistryDatum(utxo.inline_datum);
                    if (options?.parent && datum.parent !== options.parent) {
                        continue;
                    }
                    if (options?.authority_type && datum.defined_by.type !== options.authority_type) {
                        continue;
                    }
                    entries.push(datum);
                }
            }
            return entries;
        }
        catch (error) {
            console.error('Error listing registry entries:', error);
            return [];
        }
    }
    // ===========================================================================
    // TREASURY & BONDING CURVE QUERIES
    // ===========================================================================
    /**
     * Get current bonding curve state
     * Price formula: tokens_distributed / 400B (linear curve)
     */
    async getTreasuryState() {
        try {
            const utxos = await this.api.addressesUtxos(this.config.contracts.treasury);
            // Find treasury datum UTxO
            let treasuryData = {
                totalSupply: 400000000000000000n, // 400B tokens (with 6 decimals)
                distributed: 0n,
                reserved: 400000000000000000n,
                adaReserve: 0n,
                currentPrice: 0.0000000025, // Starting: 1 ADA = 400B tokens
                nextEpochQueue: 0n,
                founderAccrued: 0n,
                founderClaimed: 0n,
                lastSettlement: 0,
            };
            for (const utxo of utxos) {
                // Sum up ADA in treasury
                const adaAmount = utxo.amount.find(a => a.unit === 'lovelace');
                if (adaAmount) {
                    treasuryData.adaReserve += BigInt(adaAmount.quantity);
                }
                // Decode treasury datum if present
                if (utxo.inline_datum) {
                    try {
                        const decoded = this.decodeTreasuryDatum(utxo.inline_datum);
                        treasuryData = { ...treasuryData, ...decoded };
                    }
                    catch {
                        // Skip malformed datums
                    }
                }
            }
            // Calculate current price based on distribution
            // Linear bonding curve: price = distributed / totalSupply
            const distributedRatio = Number(treasuryData.distributed) / Number(treasuryData.totalSupply);
            treasuryData.currentPrice = distributedRatio > 0
                ? distributedRatio
                : 0.0000000025; // Floor price
            return treasuryData;
        }
        catch (error) {
            console.error('Error fetching treasury state:', error);
            // Return default state
            return {
                totalSupply: 400000000000000000n,
                distributed: 0n,
                reserved: 400000000000000000n,
                adaReserve: 0n,
                currentPrice: 0.0000000025,
                nextEpochQueue: 0n,
                founderAccrued: 0n,
                founderClaimed: 0n,
                lastSettlement: 0,
            };
        }
    }
    /**
     * Get current token price from bonding curve
     */
    async getTokenPrice() {
        const treasury = await this.getTreasuryState();
        const pricePerToken = treasury.currentPrice;
        const pricePerAda = pricePerToken > 0 ? 1 / pricePerToken : 400_000_000_000;
        const percentDistributed = (Number(treasury.distributed) / Number(treasury.totalSupply)) * 100;
        return {
            pricePerToken,
            pricePerAda,
            distributed: this.formatTokenAmount(treasury.distributed),
            remaining: this.formatTokenAmount(treasury.reserved),
            percentDistributed,
        };
    }
    /**
     * Simulate token purchase - calculate tokens received for ADA amount
     */
    async simulatePurchase(adaAmount) {
        const treasury = await this.getTreasuryState();
        const lovelace = BigInt(Math.floor(adaAmount * 1_000_000));
        // Calculate tokens using bonding curve integral
        // For linear curve: tokens = sqrt(2 * ada * totalSupply / slope) - distributed
        // Simplified: tokens = ada / currentPrice (approximate for small purchases)
        const currentPrice = treasury.currentPrice;
        const tokensReceived = currentPrice > 0
            ? BigInt(Math.floor(Number(lovelace) / currentPrice))
            : 0n;
        // Calculate new state after purchase
        const newDistributed = treasury.distributed + tokensReceived;
        const newPrice = Number(newDistributed) / Number(treasury.totalSupply);
        // Price impact = (newPrice - currentPrice) / currentPrice * 100
        const priceImpact = currentPrice > 0
            ? ((newPrice - currentPrice) / currentPrice) * 100
            : 0;
        const averagePrice = tokensReceived > 0n
            ? Number(lovelace) / Number(tokensReceived)
            : currentPrice;
        return {
            adaSpent: adaAmount,
            tokensReceived: this.formatTokenAmount(tokensReceived),
            averagePrice,
            priceImpact,
            newPrice,
        };
    }
    /**
     * Get founder compensation status
     * $10,000/month since Jan 2020, settled per epoch at curve price
     */
    async getFounderStatus() {
        const treasury = await this.getTreasuryState();
        const startDate = new Date('2020-01-01');
        const now = new Date();
        const totalMonths = (now.getFullYear() - startDate.getFullYear()) * 12 +
            (now.getMonth() - startDate.getMonth());
        const totalOwed = totalMonths * 10000; // $10,000/month
        // Founder tokens are accrued based on curve price at each epoch
        // This is tracked in the treasury datum
        const tokensAccrued = treasury.founderAccrued;
        const tokensClaimed = treasury.founderClaimed;
        const tokensAvailable = tokensAccrued - tokensClaimed;
        // Next settlement at epoch boundary (every 5 days on Cardano)
        const epochLength = 5 * 24 * 60 * 60 * 1000; // 5 days in ms
        const lastSettlement = treasury.lastSettlement || Date.now();
        const nextSettlement = new Date(lastSettlement + epochLength);
        return {
            monthlyUsd: 10000,
            startDate: '2020-01-01',
            totalMonths,
            totalOwed,
            tokensAccrued: this.formatTokenAmount(tokensAccrued),
            tokensClaimed: this.formatTokenAmount(tokensClaimed),
            tokensAvailable: this.formatTokenAmount(tokensAvailable),
            nextSettlement: nextSettlement.toISOString(),
        };
    }
    decodeTreasuryDatum(inlineDatum) {
        const decoded = cbor.decode(Buffer.from(inlineDatum, 'hex'));
        return {
            distributed: BigInt(decoded[0] || 0),
            reserved: BigInt(decoded[1] || 0),
            nextEpochQueue: BigInt(decoded[2] || 0),
            founderAccrued: BigInt(decoded[3] || 0),
            founderClaimed: BigInt(decoded[4] || 0),
            lastSettlement: Number(decoded[5]) || 0,
        };
    }
    formatTokenAmount(amount) {
        const withDecimals = Number(amount) / 1_000_000;
        if (withDecimals >= 1_000_000_000) {
            return `${(withDecimals / 1_000_000_000).toFixed(2)}B`;
        }
        else if (withDecimals >= 1_000_000) {
            return `${(withDecimals / 1_000_000).toFixed(2)}M`;
        }
        else if (withDecimals >= 1_000) {
            return `${(withDecimals / 1_000).toFixed(2)}K`;
        }
        return withDecimals.toFixed(2);
    }
    // ===========================================================================
    // PROTOCOL STATS
    // ===========================================================================
    async getProtocolStats() {
        await this.syncState();
        const activeOfferings = Array.from(this.offeringCache.values())
            .filter(o => o.status === 'Active').length;
        const activeNeeds = Array.from(this.needCache.values())
            .filter(n => n.status === 'Open').length;
        // Get treasury balance as proxy for TVL
        let tvl = 0n;
        try {
            tvl = await this.getTokenBalance(this.config.contracts.treasury);
        }
        catch {
            // Ignore
        }
        return {
            totalPnfts: this.pnftCache.size,
            totalBioregions: this.bioregionCache.size,
            activeOfferings,
            activeNeeds,
            totalValueLocked: tvl,
        };
    }
    // ===========================================================================
    // PRIVATE: SYNC METHODS
    // ===========================================================================
    async syncPnfts() {
        try {
            // Get all assets under pNFT policy
            const assets = await this.api.assetsPolicyByIdAll(this.config.contracts.pnft_policy);
            for (const asset of assets) {
                if (asset.asset.length > 56) { // Has asset name
                    const assetName = asset.asset.slice(56);
                    const addresses = await this.api.assetsAddresses(asset.asset);
                    if (addresses.length > 0) {
                        const utxos = await this.api.addressesUtxos(addresses[0].address);
                        const utxo = utxos.find(u => u.amount.some(a => a.unit === asset.asset));
                        if (utxo?.inline_datum) {
                            const datum = this.decodePnftDatum(utxo.inline_datum);
                            this.pnftCache.set(assetName, datum);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('Error syncing pNFTs:', error);
        }
    }
    async syncBioregions() {
        try {
            const utxos = await this.api.addressesUtxos(this.config.contracts.bioregion);
            for (const utxo of utxos) {
                if (utxo.inline_datum) {
                    const datum = this.decodeBioregionDatum(utxo.inline_datum);
                    this.bioregionCache.set(datum.bioregion, datum);
                }
            }
        }
        catch (error) {
            console.error('Error syncing bioregions:', error);
        }
    }
    async syncOfferings() {
        try {
            const utxos = await this.api.addressesUtxos(this.config.contracts.marketplace);
            this.offeringCache.clear();
            for (const utxo of utxos) {
                if (utxo.inline_datum) {
                    try {
                        const datum = this.decodeOfferingDatum(utxo.inline_datum);
                        this.offeringCache.set(datum.offering_id, datum);
                    }
                    catch {
                        // Skip malformed datums
                    }
                }
            }
        }
        catch (error) {
            console.error('Error syncing offerings:', error);
        }
    }
    async syncNeeds() {
        try {
            const utxos = await this.api.addressesUtxos(this.config.contracts.work_auction);
            this.needCache.clear();
            for (const utxo of utxos) {
                if (utxo.inline_datum) {
                    try {
                        const datum = this.decodeNeedDatum(utxo.inline_datum);
                        this.needCache.set(datum.need_id, datum);
                    }
                    catch {
                        // Skip malformed datums
                    }
                }
            }
        }
        catch (error) {
            console.error('Error syncing needs:', error);
        }
    }
    // ===========================================================================
    // PRIVATE: DATUM DECODERS
    // ===========================================================================
    decodePnftDatum(inlineDatum) {
        const decoded = cbor.decode(Buffer.from(inlineDatum, 'hex'));
        // Map CBOR structure to TypeScript type
        // Matches Aiken PnftDatum: pnft_id, owner, level, bioregion, dna_hash, guardian, ward_since, created_at, upgraded_at, consumer_impacts, care_credits
        return {
            pnft_id: decoded[0]?.toString('hex') || '',
            owner: decoded[1]?.toString('hex') || '',
            level: this.decodeVerificationLevel(decoded[2]),
            bioregion: decoded[3]?.toString('hex') || null,
            dna_hash: decoded[4]?.toString('hex') || null,
            guardian: decoded[5]?.toString('hex') || null,
            ward_since: decoded[6] ? Number(decoded[6]) : null,
            created_at: Number(decoded[7]) || 0,
            upgraded_at: decoded[8] ? Number(decoded[8]) : null,
            consumer_impacts: decoded[9] ? this.decodeCompoundBalances(decoded[9]) : null,
            care_credits: BigInt(decoded[10] || 0),
        };
    }
    decodeBioregionDatum(inlineDatum) {
        const decoded = cbor.decode(Buffer.from(inlineDatum, 'hex'));
        return {
            bioregion: decoded[0]?.toString('hex') || '',
            cycle: Number(decoded[1]) || 0,
            water_index: this.decodeIndexValue(decoded[2]),
            land_index: this.decodeIndexValue(decoded[3]),
            air_index: this.decodeIndexValue(decoded[4]),
            energy_index: this.decodeIndexValue(decoded[5]),
            health_index: this.decodeIndexValue(decoded[6]),
            education_index: this.decodeIndexValue(decoded[7]),
            housing_index: this.decodeIndexValue(decoded[8]),
            food_security_index: this.decodeIndexValue(decoded[9]),
            care_availability_index: this.decodeIndexValue(decoded[10]),
            offerings_active: Number(decoded[11]) || 0,
            needs_active: Number(decoded[12]) || 0,
            agreements_completed: Number(decoded[13]) || 0,
            value_transacted: BigInt(decoded[14] || 0),
            care_hours: Number(decoded[15]) || 0,
            compound_balances: decoded[16] ? this.decodeCompoundBalances(decoded[16]) : [],
            health_score: Number(decoded[17]) || 0,
            updated_at: Number(decoded[18]) || 0,
        };
    }
    decodeOfferingDatum(inlineDatum) {
        const decoded = cbor.decode(Buffer.from(inlineDatum, 'hex'));
        return {
            offering_id: decoded[0]?.toString('hex') || '',
            offerer: decoded[1]?.toString('hex') || '',
            category: this.decodeCategoryRef(decoded[2]),
            what: this.decodeWhatOffered(decoded[3]),
            location: this.decodeLocationScope(decoded[4]),
            availability: this.decodeTimeScope(decoded[5]),
            terms: this.decodeTerms(decoded[6]),
            expected_compounds: decoded[7] ? this.decodeCompoundFlows(decoded[7]) : [],
            evidence: decoded[8]?.map((e) => e.toString('hex')) || [],
            status: this.decodeOfferingStatus(decoded[9]),
            created_at: Number(decoded[10]) || 0,
        };
    }
    decodeNeedDatum(inlineDatum) {
        const decoded = cbor.decode(Buffer.from(inlineDatum, 'hex'));
        return {
            need_id: decoded[0]?.toString('hex') || '',
            needer: decoded[1]?.toString('hex') || '',
            category: this.decodeCategoryRef(decoded[2]),
            what: this.decodeWhatNeeded(decoded[3]),
            location: this.decodeLocationScope(decoded[4]),
            when_needed: this.decodeTimeScope(decoded[5]),
            budget: this.decodeBudget(decoded[6]),
            requirements: decoded[7] ? this.decodeRequirements(decoded[7]) : [],
            impact_limits: decoded[8] ? this.decodeCompoundLimits(decoded[8]) : null,
            status: this.decodeNeedStatus(decoded[9]),
            created_at: Number(decoded[10]) || 0,
            deadline: decoded[11] ? Number(decoded[11]) : null,
        };
    }
    decodeCollectiveDatum(inlineDatum) {
        const decoded = cbor.decode(Buffer.from(inlineDatum, 'hex'));
        return {
            collective_id: decoded[0]?.toString('hex') || '',
            name_hash: decoded[1]?.toString('hex') || '',
            members: decoded[2]?.map((m) => m.toString('hex')) || [],
            resources: decoded[3]?.map((r) => r.toString('hex')) || [],
            governance_hash: decoded[4]?.toString('hex') || '',
            treasury: decoded[5]?.toString('hex') || '',
            bioregion: decoded[6]?.toString('hex') || '',
        };
    }
    decodeRegistryDatum(inlineDatum) {
        const decoded = cbor.decode(Buffer.from(inlineDatum, 'hex'));
        return {
            code: decoded[0]?.toString('hex') || '',
            parent: decoded[1]?.toString('hex') || null,
            name_hash: decoded[2]?.toString('hex') || '',
            description_hash: decoded[3]?.toString('hex') || '',
            defined_by: this.decodeRegistryAuthority(decoded[4]),
            typical_compounds: decoded[5]?.map((c) => c.toString('hex')) || [],
            status: this.decodeRegistryStatus(decoded[6]),
        };
    }
    // Helper decoders
    decodeVerificationLevel(value) {
        const levels = ['Basic', 'Ward', 'Standard', 'Verified', 'Steward'];
        return levels[value] || 'Basic';
    }
    decodeIndexValue(value) {
        if (!value)
            return { value: 0, trend: 0, confidence: 0 };
        return {
            value: Number(value[0]) || 0,
            trend: Number(value[1]) || 0,
            confidence: Number(value[2]) || 0,
        };
    }
    decodeCompoundBalances(value) {
        return value.map(v => ({
            compound: v[0]?.toString('hex') || '',
            quantity: BigInt(v[1] || 0),
            unit: v[2]?.toString('hex') || '',
        }));
    }
    decodeCompoundFlows(value) {
        return value.map(v => ({
            compound: v[0]?.toString('hex') || '',
            quantity: BigInt(v[1] || 0),
            unit: v[2]?.toString('hex') || '',
            measurement: v[3]?.toString('hex') || '',
            confidence: Number(v[4]) || 0,
        }));
    }
    decodeCategoryRef(value) {
        if (value[0] === 0) {
            return { type: 'Registry', code: value[1]?.toString('hex') };
        }
        return { type: 'Custom', description_hash: value[1]?.toString('hex') };
    }
    decodeWhatOffered(value) {
        const types = ['Thing', 'Work', 'Access', 'Knowledge', 'Care'];
        return { type: types[value[0]] || 'Thing', ...value[1] };
    }
    decodeWhatNeeded(value) {
        const types = ['Thing', 'Work', 'Access', 'Knowledge', 'Care'];
        return { type: types[value[0]] || 'Thing', ...value[1] };
    }
    decodeLocationScope(value) {
        const types = ['Specific', 'Bioregional', 'Mobile', 'Remote', 'Anywhere'];
        return { type: types[value[0]] || 'Anywhere', ...value[1] };
    }
    decodeTimeScope(value) {
        const types = ['Now', 'Scheduled', 'Recurring', 'OnDemand'];
        return { type: types[value[0]] || 'Now', ...value[1] };
    }
    decodeTerms(value) {
        const types = ['Priced', 'Range', 'Auction', 'Trade', 'Gift', 'CommunityService'];
        return { type: types[value[0]] || 'Priced', ...value[1] };
    }
    decodeBudget(value) {
        const types = ['Fixed', 'Range', 'Negotiable', 'Trade'];
        return { type: types[value[0]] || 'Negotiable', ...value[1] };
    }
    decodeRequirements(value) {
        return value.map(v => {
            const types = ['MinVerification', 'Credential', 'Residency', 'MinEfficiency', 'Custom'];
            return { type: types[v[0]] || 'Custom', ...v[1] };
        });
    }
    decodeCompoundLimits(value) {
        return value.map(v => ({
            compound: v[0]?.toString('hex') || '',
            max_quantity: BigInt(v[1] || 0),
            unit: v[2]?.toString('hex') || '',
        }));
    }
    decodeOfferingStatus(value) {
        const statuses = ['Active', 'Paused', 'Fulfilled', 'Expired', 'Cancelled'];
        return statuses[value] || 'Active';
    }
    decodeNeedStatus(value) {
        const statuses = ['Open', 'InProgress', 'Fulfilled', 'Cancelled', 'Expired'];
        return statuses[value] || 'Open';
    }
    decodeRegistryAuthority(value) {
        const types = ['Global', 'Bioregional', 'Collective', 'Individual'];
        return { type: types[value[0]] || 'Global', ...value[1] };
    }
    decodeRegistryStatus(value) {
        if (value[0] === 0)
            return { type: 'Active' };
        return { type: 'Deprecated', replacement: value[1]?.toString('hex') };
    }
}
export default UltraLifeIndexer;
//# sourceMappingURL=index.js.map