/**
 * UltraLife Indexer Tests
 *
 * Tests for the chain indexer with mocked Blockfrost API.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
// Mock Blockfrost
vi.mock('@blockfrost/blockfrost-js', () => {
    return {
        BlockFrostAPI: vi.fn().mockImplementation(() => ({
            addressesUtxos: vi.fn().mockResolvedValue([]),
            assetsAddresses: vi.fn().mockResolvedValue([]),
            assetsPolicyByIdAll: vi.fn().mockResolvedValue([]),
        })),
    };
});
// Import after mocking
import { UltraLifeIndexer } from '../indexer/index.js';
// Test configuration
const testConfig = {
    network: 'preprod',
    blockfrostApiKey: 'test_key',
    contracts: {
        pnft_policy: 'test_pnft_policy',
        pnft_spend: 'addr_test1_pnft',
        recovery: 'addr_test1_recovery',
        token_policy: 'test_token_policy',
        token_spend: 'addr_test1_token',
        treasury: 'addr_test1_treasury',
        marketplace: 'addr_test1_marketplace',
        work_auction: 'addr_test1_work',
        records: 'addr_test1_records',
        registry: 'addr_test1_registry',
        memory: 'addr_test1_memory',
        bioregion: 'addr_test1_bioregion',
        land_rights: 'addr_test1_land',
        commons: 'addr_test1_commons',
        stake_pool: 'addr_test1_stake',
        governance: 'addr_test1_governance',
        ubi: 'addr_test1_ubi',
        impact: 'addr_test1_impact',
        impact_market: 'addr_test1_impact_market',
        asset_impact: 'addr_test1_asset_impact',
        remediation: 'addr_test1_remediation',
        preservation: 'addr_test1_preservation',
        collective: 'addr_test1_collective',
        care: 'addr_test1_care',
        energy: 'addr_test1_energy',
        grants: 'addr_test1_grants',
        genesis: 'addr_test1_genesis',
        spending_bucket: 'addr_test1_bucket',
        ultralife_validator: 'addr_test1_ultralife',
        fee_pool: 'addr_test1_fee',
    },
    referenceScripts: {
        pnft_mint: { txHash: 'test_tx', outputIndex: 0 },
        pnft_spend: { txHash: 'test_tx', outputIndex: 0 },
        recovery: { txHash: 'test_tx', outputIndex: 0 },
        token: { txHash: 'test_tx', outputIndex: 0 },
        treasury: { txHash: 'test_tx', outputIndex: 0 },
        marketplace: { txHash: 'test_tx', outputIndex: 0 },
        work_auction: { txHash: 'test_tx', outputIndex: 0 },
        records: { txHash: 'test_tx', outputIndex: 0 },
        registry: { txHash: 'test_tx', outputIndex: 0 },
        memory: { txHash: 'test_tx', outputIndex: 0 },
        bioregion: { txHash: 'test_tx', outputIndex: 0 },
        land_rights: { txHash: 'test_tx', outputIndex: 0 },
        commons: { txHash: 'test_tx', outputIndex: 0 },
        stake_pool: { txHash: 'test_tx', outputIndex: 0 },
        governance: { txHash: 'test_tx', outputIndex: 0 },
        ubi: { txHash: 'test_tx', outputIndex: 0 },
        impact: { txHash: 'test_tx', outputIndex: 0 },
        impact_market: { txHash: 'test_tx', outputIndex: 0 },
        asset_impact: { txHash: 'test_tx', outputIndex: 0 },
        remediation: { txHash: 'test_tx', outputIndex: 0 },
        preservation: { txHash: 'test_tx', outputIndex: 0 },
        collective: { txHash: 'test_tx', outputIndex: 0 },
        care: { txHash: 'test_tx', outputIndex: 0 },
        energy: { txHash: 'test_tx', outputIndex: 0 },
        grants: { txHash: 'test_tx', outputIndex: 0 },
        genesis: { txHash: 'test_tx', outputIndex: 0 },
        spending_bucket: { txHash: 'test_tx', outputIndex: 0 },
        ultralife_validator: { txHash: 'test_tx', outputIndex: 0 },
        fee_pool: { txHash: 'test_tx', outputIndex: 0 },
    },
};
describe('UltraLifeIndexer', () => {
    let indexer;
    beforeEach(() => {
        indexer = new UltraLifeIndexer(testConfig);
    });
    describe('Treasury State', () => {
        it('should return default treasury state when no data on chain', async () => {
            const state = await indexer.getTreasuryState();
            expect(state.totalSupply).toBe(400000000000000000n);
            expect(state.distributed).toBe(0n);
            expect(state.reserved).toBe(400000000000000000n);
            expect(state.currentPrice).toBeCloseTo(0.0000000025);
        });
        it('should have valid total supply of 400B tokens', async () => {
            const state = await indexer.getTreasuryState();
            // 400B tokens with 6 decimals = 400_000_000_000_000_000
            const expectedSupply = 400000000000n * 1000000n;
            expect(state.totalSupply).toBe(expectedSupply);
        });
    });
    describe('Token Price', () => {
        it('should return token price information', async () => {
            const price = await indexer.getTokenPrice();
            expect(price).toHaveProperty('pricePerToken');
            expect(price).toHaveProperty('pricePerAda');
            expect(price).toHaveProperty('distributed');
            expect(price).toHaveProperty('remaining');
            expect(price).toHaveProperty('percentDistributed');
        });
        it('should start with 0% distributed', async () => {
            const price = await indexer.getTokenPrice();
            expect(price.percentDistributed).toBe(0);
        });
        it('should have inverse relationship between pricePerToken and pricePerAda', async () => {
            const price = await indexer.getTokenPrice();
            // At floor price: 1 ADA should get many tokens
            expect(price.pricePerAda).toBeGreaterThan(0);
            expect(price.pricePerToken).toBeGreaterThan(0);
        });
    });
    describe('Purchase Simulation', () => {
        it('should simulate purchase with ADA amount', async () => {
            const simulation = await indexer.simulatePurchase(100); // 100 ADA
            expect(simulation).toHaveProperty('adaSpent', 100);
            expect(simulation).toHaveProperty('tokensReceived');
            expect(simulation).toHaveProperty('averagePrice');
            expect(simulation).toHaveProperty('priceImpact');
            expect(simulation).toHaveProperty('newPrice');
        });
        it('should show tokens received for purchase', async () => {
            const simulation = await indexer.simulatePurchase(100);
            // Should receive some tokens
            expect(simulation.tokensReceived).toBeDefined();
        });
        it('should show price impact increases with larger purchases', async () => {
            const small = await indexer.simulatePurchase(10);
            const large = await indexer.simulatePurchase(10000);
            // Larger purchases should have higher impact
            expect(large.priceImpact).toBeGreaterThanOrEqual(small.priceImpact);
        });
    });
    describe('Founder Status', () => {
        it('should return founder compensation details', async () => {
            const status = await indexer.getFounderStatus();
            expect(status.monthlyUsd).toBe(10000);
            expect(status.startDate).toBe('2020-01-01');
            expect(status).toHaveProperty('totalMonths');
            expect(status).toHaveProperty('totalOwed');
            expect(status).toHaveProperty('tokensAccrued');
            expect(status).toHaveProperty('tokensClaimed');
            expect(status).toHaveProperty('tokensAvailable');
            expect(status).toHaveProperty('nextSettlement');
        });
        it('should calculate months since January 2020', async () => {
            const status = await indexer.getFounderStatus();
            const now = new Date();
            const start = new Date('2020-01-01');
            const expectedMonths = (now.getFullYear() - start.getFullYear()) * 12 +
                (now.getMonth() - start.getMonth());
            expect(status.totalMonths).toBe(expectedMonths);
        });
        it('should calculate total owed as months * $10,000', async () => {
            const status = await indexer.getFounderStatus();
            expect(status.totalOwed).toBe(status.totalMonths * 10000);
        });
    });
    describe('Protocol Stats', () => {
        it('should return protocol statistics', async () => {
            const stats = await indexer.getProtocolStats();
            expect(stats).toHaveProperty('totalPnfts');
            expect(stats).toHaveProperty('totalBioregions');
            expect(stats).toHaveProperty('activeOfferings');
            expect(stats).toHaveProperty('activeNeeds');
            expect(stats).toHaveProperty('totalValueLocked');
        });
        it('should start with zero stats on empty chain', async () => {
            const stats = await indexer.getProtocolStats();
            expect(stats.totalPnfts).toBe(0);
            expect(stats.totalBioregions).toBe(0);
            expect(stats.activeOfferings).toBe(0);
            expect(stats.activeNeeds).toBe(0);
        });
    });
    describe('pNFT Queries', () => {
        it('should return null for non-existent pNFT', async () => {
            const pnft = await indexer.getPnft('nonexistent_id');
            expect(pnft).toBeNull();
        });
        it('should return null for address without pNFT', async () => {
            const pnft = await indexer.getPnftByOwner('addr_test1_random');
            expect(pnft).toBeNull();
        });
        it('should return empty list when no pNFTs exist', async () => {
            const pnfts = await indexer.listPnfts({ limit: 10 });
            expect(Array.isArray(pnfts)).toBe(true);
            expect(pnfts.length).toBe(0);
        });
    });
    describe('Bioregion Queries', () => {
        it('should return null for non-existent bioregion', async () => {
            const bioregion = await indexer.getBioregion('nonexistent_id');
            expect(bioregion).toBeNull();
        });
        it('should return empty list when no bioregions exist', async () => {
            const bioregions = await indexer.listBioregions();
            expect(Array.isArray(bioregions)).toBe(true);
            expect(bioregions.length).toBe(0);
        });
    });
    describe('Offering Queries', () => {
        it('should return null for non-existent offering', async () => {
            const offering = await indexer.getOffering('nonexistent_id');
            expect(offering).toBeNull();
        });
        it('should return empty list when no offerings exist', async () => {
            const offerings = await indexer.listOfferings({ limit: 10 });
            expect(Array.isArray(offerings)).toBe(true);
            expect(offerings.length).toBe(0);
        });
    });
    describe('Collective Queries', () => {
        it('should return null for non-existent collective', async () => {
            const collective = await indexer.getCollective('nonexistent_id');
            expect(collective).toBeNull();
        });
        it('should return empty list when no collectives exist', async () => {
            const collectives = await indexer.listCollectives({});
            expect(Array.isArray(collectives)).toBe(true);
            expect(collectives.length).toBe(0);
        });
    });
    describe('Spending Bucket Queries', () => {
        it('should return null for pNFT without buckets', async () => {
            const buckets = await indexer.getSpendingBuckets('some_pnft_id');
            expect(buckets).toBeNull();
        });
        it('should return empty list when no buckets exist', async () => {
            const buckets = await indexer.listBuckets('some_pnft_id');
            expect(Array.isArray(buckets)).toBe(true);
            expect(buckets.length).toBe(0);
        });
    });
});
//# sourceMappingURL=indexer.test.js.map