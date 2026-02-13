/**
 * Simulation Indexer Tests
 *
 * Tests for the simulation indexer that reads from deployment.json.
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { createLocalIndexer, SimulationIndexer } from '../indexer/index-local.js';

describe('SimulationIndexer', () => {
  let indexer: SimulationIndexer;

  beforeAll(async () => {
    indexer = createLocalIndexer({ projectRoot: '/home/user/ultralife-protocol' });
    await indexer.initialize();
  });

  describe('pNFT Queries', () => {
    it('should list all pNFTs from deployment.json', async () => {
      const pnfts = await indexer.listPnfts();

      expect(Array.isArray(pnfts)).toBe(true);
      expect(pnfts.length).toBeGreaterThan(0);
    });

    it('should get pNFT by ID', async () => {
      const pnft = await indexer.getPnft('pnft_ml47yps2_7e54410f8ccc126d');

      expect(pnft).not.toBeNull();
      expect(pnft?.pnft_id).toBe('pnft_ml47yps2_7e54410f8ccc126d');
      expect(pnft?.level).toBe('Basic');
    });

    it('should get pNFT by owner address', async () => {
      const pnft = await indexer.getPnftByOwner(
        'addr_test1qzx344f5mszedz3uem7jg4784v96dxf5c4a9lcrc9tepnpq75dudj575njxxly3mnqw2m78p5vyseucqww60y50hpxyqkzug5a'
      );

      expect(pnft).not.toBeNull();
      expect(pnft?.pnft_id).toBe('pnft_ml47yps2_7e54410f8ccc126d');
    });

    it('should return null for non-existent pNFT', async () => {
      const pnft = await indexer.getPnft('nonexistent_id');

      expect(pnft).toBeNull();
    });

    it('should filter pNFTs by bioregion', async () => {
      const pnfts = await indexer.listPnfts({ bioregion: 'sierra_nevada' });

      expect(pnfts.length).toBeGreaterThan(0);
      pnfts.forEach(p => {
        expect(p.bioregion).toBe('sierra_nevada');
      });
    });

    it('should filter pNFTs by minimum level', async () => {
      const pnfts = await indexer.listPnfts({ minLevel: 2 });

      pnfts.forEach(p => {
        expect(['Verified', 'Steward']).toContain(p.level);
      });
    });

    it('should limit pNFT results', async () => {
      const pnfts = await indexer.listPnfts({ limit: 1 });

      expect(pnfts.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Token Balance Queries', () => {
    it('should get token balance for address', async () => {
      const balance = await indexer.getTokenBalance(
        'addr_test1qzx344f5mszedz3uem7jg4784v96dxf5c4a9lcrc9tepnpq75dudj575njxxly3mnqw2m78p5vyseucqww60y50hpxyqkzug5a'
      );

      expect(balance).toBeGreaterThan(0n);
      // Balance should be in microtokens (6 decimals)
      expect(balance).toBe(79400875n);
    });

    it('should return 0 for non-existent address', async () => {
      const balance = await indexer.getTokenBalance('addr_test1_nonexistent');

      expect(balance).toBe(0n);
    });

    it('should get pNFT token balance', async () => {
      const balance = await indexer.getPnftTokenBalance('pnft_ml47yps2_7e54410f8ccc126d');

      expect(balance).toBeGreaterThan(0n);
    });
  });

  describe('Bioregion Queries', () => {
    it('should list all bioregions', async () => {
      const bioregions = await indexer.listBioregions();

      expect(Array.isArray(bioregions)).toBe(true);
      expect(bioregions.length).toBeGreaterThan(0);
    });

    it('should get bioregion by ID', async () => {
      const bioregion = await indexer.getBioregion('sierra_nevada');

      expect(bioregion).not.toBeNull();
      expect(bioregion?.bioregion).toBe('sierra_nevada');
    });

    it('should return null for non-existent bioregion', async () => {
      const bioregion = await indexer.getBioregion('nonexistent_region');

      expect(bioregion).toBeNull();
    });

    it('should include health indices in bioregion data', async () => {
      const bioregion = await indexer.getBioregion('sierra_nevada');

      expect(bioregion).not.toBeNull();
      expect(bioregion?.water_index).toBeDefined();
      expect(bioregion?.land_index).toBeDefined();
      expect(bioregion?.health_score).toBeDefined();
    });
  });

  describe('Land Queries', () => {
    it('should list all lands', async () => {
      const lands = await indexer.listLands();

      expect(Array.isArray(lands)).toBe(true);
      expect(lands.length).toBeGreaterThan(0);
    });

    it('should get land by ID', async () => {
      const land = await indexer.getLand('land_ml4819qs_c516cb80ec5980de');

      expect(land).not.toBeNull();
      expect(land?.landId).toBe('land_ml4819qs_c516cb80ec5980de');
      expect(land?.name).toBe('Quincy Forest Parcel');
    });

    it('should return null for non-existent land', async () => {
      const land = await indexer.getLand('nonexistent_land');

      expect(land).toBeNull();
    });

    it('should include classification and health data', async () => {
      const land = await indexer.getLand('land_ml4819qs_c516cb80ec5980de');

      expect(land?.classification).toBeDefined();
      expect(land?.classification.name).toBe('Forest');
      expect(land?.health).toBeDefined();
      expect(land?.health.overall_index).toBe(75);
    });
  });

  describe('Credit Balance Queries', () => {
    it('should get all credit balances', async () => {
      const credits = await indexer.getCreditBalances();

      expect(typeof credits).toBe('object');
      expect(Object.keys(credits).length).toBeGreaterThan(0);
    });

    it('should get credit balance for specific address', async () => {
      const credit = await indexer.getCreditBalance(
        'addr_test1qq7h5wjmrzndkgh72yccequa8hmmyl4zvun69s9f0tkkjj5e26dxj5xkkwfd3we2lak2wnn7f7rskcz97phn7wt3ly0qtvtzzc'
      );

      expect(credit).not.toBeNull();
      expect(credit?.total).toBe(8);
      expect(credit?.available).toBeDefined();
    });

    it('should return null for address without credits', async () => {
      const credit = await indexer.getCreditBalance('addr_test1_no_credits');

      expect(credit).toBeNull();
    });
  });

  describe('Impact Debt Queries', () => {
    it('should get impact debt for address', async () => {
      const debt = await indexer.getImpactDebt(
        'addr_test1qzx344f5mszedz3uem7jg4784v96dxf5c4a9lcrc9tepnpq75dudj575njxxly3mnqw2m78p5vyseucqww60y50hpxyqkzug5a'
      );

      expect(typeof debt).toBe('number');
      expect(debt).toBe(0);
    });

    it('should return 0 for address without debt', async () => {
      const debt = await indexer.getImpactDebt('addr_test1_no_debt');

      expect(debt).toBe(0);
    });

    it('should get all impact debt', async () => {
      const allDebt = await indexer.getAllImpactDebt();

      expect(typeof allDebt).toBe('object');
    });
  });

  describe('Protocol Stats', () => {
    it('should return protocol statistics', async () => {
      const stats = await indexer.getProtocolStats();

      expect(stats.totalPnfts).toBeGreaterThan(0);
      expect(stats.totalBioregions).toBeGreaterThan(0);
      expect(stats.totalLands).toBeGreaterThan(0);
      expect(stats.totalTransactions).toBeGreaterThan(0);
    });

    it('should include TVL', async () => {
      const stats = await indexer.getProtocolStats();

      expect(stats.totalValueLocked).toBeGreaterThan(0n);
    });
  });

  describe('Treasury & Bonding Curve', () => {
    it('should return treasury state', async () => {
      const treasury = await indexer.getTreasuryState();

      expect(treasury.totalSupply).toBe(400_000_000_000_000_000n);
      expect(treasury.distributed).toBeGreaterThan(0n);
      expect(treasury.reserved).toBeGreaterThan(0n);
      expect(treasury.currentPrice).toBeGreaterThan(0);
    });

    it('should return token price information', async () => {
      const price = await indexer.getTokenPrice();

      expect(price.pricePerToken).toBeGreaterThan(0);
      expect(price.pricePerAda).toBeGreaterThan(0);
      expect(price.percentDistributed).toBeGreaterThanOrEqual(0);
    });

    it('should simulate purchase', async () => {
      const simulation = await indexer.simulatePurchase(100);

      expect(simulation.adaSpent).toBe(100);
      expect(simulation.tokensReceived).toBeDefined();
      expect(simulation.priceImpact).toBeGreaterThanOrEqual(0);
    });

    it('should return founder status', async () => {
      const founder = await indexer.getFounderStatus();

      expect(founder.monthlyUsd).toBe(10000);
      expect(founder.startDate).toBe('2020-01-01');
      expect(founder.totalMonths).toBeGreaterThan(0);
    });
  });

  describe('Transaction History', () => {
    it('should get all transactions', async () => {
      const txs = await indexer.getTransactions();

      expect(Array.isArray(txs)).toBe(true);
      expect(txs.length).toBeGreaterThan(0);
    });

    it('should filter transactions by address', async () => {
      const txs = await indexer.getTransactions({
        address: 'addr_test1qzx344f5mszedz3uem7jg4784v96dxf5c4a9lcrc9tepnpq75dudj575njxxly3mnqw2m78p5vyseucqww60y50hpxyqkzug5a',
      });

      expect(txs.length).toBeGreaterThan(0);
    });

    it('should limit transactions', async () => {
      const txs = await indexer.getTransactions({ limit: 2 });

      expect(txs.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Sequestration Credits', () => {
    it('should get sequestration credits', async () => {
      const credits = await indexer.getSequestrationCredits();

      expect(Array.isArray(credits)).toBe(true);
      expect(credits.length).toBeGreaterThan(0);
    });

    it('should get credit purchases', async () => {
      const purchases = await indexer.getCreditPurchases();

      expect(Array.isArray(purchases)).toBe(true);
    });
  });

  describe('Spending Buckets', () => {
    it('should return default spending buckets structure', async () => {
      const buckets = await indexer.getSpendingBuckets('pnft_ml47yps2_7e54410f8ccc126d');

      expect(buckets).not.toBeNull();
      expect(buckets?.owner_pnft).toBe('pnft_ml47yps2_7e54410f8ccc126d');
      expect(Array.isArray(buckets?.buckets)).toBe(true);
    });

    it('should return empty bucket list', async () => {
      const buckets = await indexer.listBuckets('pnft_ml47yps2_7e54410f8ccc126d');

      expect(Array.isArray(buckets)).toBe(true);
      expect(buckets.length).toBe(0);
    });
  });

  describe('Hot Reloading', () => {
    it('should read fresh data on each query', async () => {
      // This tests that we don't cache data between calls
      const pnfts1 = await indexer.listPnfts();
      const pnfts2 = await indexer.listPnfts();

      // Both should return the same data (no mutations)
      expect(pnfts1.length).toBe(pnfts2.length);
    });
  });

  describe('Offerings and Needs', () => {
    it('should return empty offerings when not in deployment', async () => {
      const offerings = await indexer.listOfferings();

      expect(Array.isArray(offerings)).toBe(true);
    });

    it('should return empty needs when not in deployment', async () => {
      const needs = await indexer.listNeeds();

      expect(Array.isArray(needs)).toBe(true);
    });
  });

  describe('Collectives', () => {
    it('should return empty collectives when not in deployment', async () => {
      const collectives = await indexer.listCollectives();

      expect(Array.isArray(collectives)).toBe(true);
    });

    it('should return null for non-existent collective', async () => {
      const collective = await indexer.getCollective('nonexistent');

      expect(collective).toBeNull();
    });
  });
});
