/**
 * Simulation Indexer Tests
 *
 * Tests the simulation indexer for loading and querying deployment.json data
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { SimulationIndexer } from '../indexer/simulation.js';

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_DEPLOYMENT = {
  testUsers: [
    {
      name: 'TestUser1',
      address: 'addr_test1user1',
      mnemonic: 'test mnemonic 1',
      pnftId: 'pnft_test_001',
      bioregion: 'test_region_1',
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      name: 'TestUser2',
      address: 'addr_test1user2',
      mnemonic: 'test mnemonic 2',
      pnftId: 'pnft_test_002',
      bioregion: 'test_region_2',
      createdAt: '2026-01-02T00:00:00.000Z'
    }
  ],
  pnfts: [
    {
      id: 'pnft_test_001',
      owner: 'addr_test1user1',
      level: 'Standard',
      bioregion: 'test_region_1',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdSlot: 1000,
      status: 'minted',
      testnetSimulated: true
    },
    {
      id: 'pnft_test_002',
      owner: 'addr_test1user2',
      level: 'Verified',
      bioregion: 'test_region_2',
      createdAt: '2026-01-02T00:00:00.000Z',
      createdSlot: 2000,
      status: 'minted',
      testnetSimulated: true
    },
    {
      id: 'pnft_test_003',
      owner: 'addr_test1user3',
      level: 'Steward',
      bioregion: 'test_region_1',
      createdAt: '2026-01-03T00:00:00.000Z',
      createdSlot: 3000,
      status: 'minted',
      testnetSimulated: true
    }
  ],
  ultraBalances: {
    'addr_test1user1': 100,
    'addr_test1user2': 200,
    'addr_test1user3': 300
  },
  signupGrants: [],
  lands: [
    {
      landId: 'land_test_001',
      name: 'Test Land 1',
      boundsHash: 'hash1',
      area_m2: 50000,
      bioregion: 'test_region_1',
      classification: {
        name: 'Forest',
        terrain: 'Mountainous',
        ecosystem: 'Forest',
        sequestrationRate: 5
      },
      health: {
        overall_index: 80,
        soil_health: 75,
        water_health: 85,
        biodiversity_index: 80,
        carbon_stock: 500,
        last_survey: null
      },
      primarySteward: 'pnft_test_001',
      stewardAddress: 'addr_test1user1',
      rights: {},
      traditional_territory: null,
      cultural_protocols: null,
      registered_at: 1000,
      registeredAt: '2026-01-01T00:00:00.000Z',
      testnetSimulated: true
    }
  ],
  bioregionStats: {
    test_region_1: {
      totalLandArea: 50000,
      landsRegistered: 1,
      totalSequestrationCapacity: 25
    },
    test_region_2: {
      totalLandArea: 0,
      landsRegistered: 0,
      totalSequestrationCapacity: 0
    }
  },
  transactions: [
    {
      txHash: 'tx_test_001',
      sender: 'pnft_test_001',
      senderAddress: 'addr_test1user1',
      senderBioregion: 'test_region_1',
      recipient: 'pnft_test_002',
      recipientAddress: 'addr_test1user2',
      recipientBioregion: 'test_region_2',
      amount: 50,
      txType: { code: 1, name: 'Transfer', description: 'Token transfer' },
      impact: {
        description: 'Test transaction',
        compounds: [
          { compound: 'CO2', quantity: 10, unit: 'kg', confidence: 80 }
        ],
        netImpact: 10,
        evidenceHash: 'evidence1'
      },
      timestamp: '2026-01-05T00:00:00.000Z',
      testnetSimulated: true
    }
  ],
  bioregionImpact: {
    test_region_1: {
      totalTransactions: 10,
      totalVolume: 500,
      netImpact: 100,
      byType: { Transfer: 8, Trade: 2 },
      byCompound: { CO2: 100, H2O: 50 }
    }
  },
  impactTokens: [],
  impactTokenBalances: {},
  impactDebt: {
    'addr_test1user2': 10.5
  },
  sequestrationCredits: [],
  creditBalances: {},
  lastCreditGeneration: {},
  creditPurchases: [],
  marketplace: {
    listings: [
      {
        id: 'offer_test_001',
        offerer: 'pnft_test_001',
        category: 'Food',
        description: 'Fresh vegetables',
        bioregion: 'test_region_1',
        price: 10,
        status: 'Active',
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    ]
  },
  care: {
    needs: [
      {
        id: 'need_test_001',
        needer: 'pnft_test_002',
        category: 'Help',
        description: 'Need help with farming',
        bioregion: 'test_region_2',
        budget: 20,
        status: 'Open',
        createdAt: '2026-01-02T00:00:00.000Z'
      }
    ]
  },
  collectives: [
    {
      collective_id: 'collective_test_001',
      name: 'Test Collective',
      name_hash: 'hash_collective_1',
      members: ['pnft_test_001', 'pnft_test_002'],
      resources: [],
      governance_hash: 'governance_hash_1',
      treasury: 'addr_treasury_1',
      bioregion: 'test_region_1'
    }
  ]
};

// =============================================================================
// TEST SETUP
// =============================================================================

let testDir: string;
let deploymentPath: string;
let indexer: SimulationIndexer;

beforeAll(async () => {
  // Create temp test directory
  testDir = join(process.cwd(), '.test-temp-indexer');
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }

  // Write mock data
  deploymentPath = join(testDir, 'deployment.json');
  writeFileSync(deploymentPath, JSON.stringify(MOCK_DEPLOYMENT, null, 2));

  // Initialize indexer
  indexer = new SimulationIndexer(deploymentPath);
  await indexer.initialize();
});

afterAll(() => {
  // Cleanup
  try {
    unlinkSync(deploymentPath);
  } catch (error) {
    // Ignore cleanup errors
  }
});

// =============================================================================
// INITIALIZATION TESTS
// =============================================================================

describe('Initialization', () => {
  it('should initialize successfully', async () => {
    const testIndexer = new SimulationIndexer(deploymentPath);
    await expect(testIndexer.initialize()).resolves.not.toThrow();
  });

  it('should handle missing deployment file gracefully', async () => {
    const badPath = join(testDir, 'nonexistent.json');
    const testIndexer = new SimulationIndexer(badPath);
    await expect(testIndexer.initialize()).resolves.not.toThrow();
  });

  it('should sync state without errors', async () => {
    await expect(indexer.syncState()).resolves.not.toThrow();
  });
});

// =============================================================================
// CACHING BEHAVIOR TESTS
// =============================================================================

describe('Caching Behavior', () => {
  it('should reload data on each query (hot reload)', async () => {
    const pnft1 = await indexer.getPnft('pnft_test_001');
    expect(pnft1).toBeTruthy();
    expect(pnft1?.pnft_id).toBe('pnft_test_001');

    // Modify deployment file
    const modifiedData = JSON.parse(JSON.stringify(MOCK_DEPLOYMENT));
    modifiedData.pnfts.push({
      id: 'pnft_test_004',
      owner: 'addr_test1user4',
      level: 'Basic',
      bioregion: 'test_region_1',
      createdAt: '2026-01-04T00:00:00.000Z',
      createdSlot: 4000,
      status: 'minted',
      testnetSimulated: true
    });
    writeFileSync(deploymentPath, JSON.stringify(modifiedData, null, 2));

    // Query again - should see new data
    const pnfts = await indexer.listPnfts();
    expect(pnfts.length).toBe(4); // Should include the new pNFT

    // Restore original data
    writeFileSync(deploymentPath, JSON.stringify(MOCK_DEPLOYMENT, null, 2));
  });
});

// =============================================================================
// pNFT QUERIES TESTS
// =============================================================================

describe('pNFT Queries', () => {
  it('should get pNFT by ID', async () => {
    const pnft = await indexer.getPnft('pnft_test_001');
    expect(pnft).toBeTruthy();
    expect(pnft?.pnft_id).toBe('pnft_test_001');
    expect(pnft?.owner).toBe('addr_test1user1');
    expect(pnft?.level).toBe('Standard');
    expect(pnft?.bioregion).toBe('test_region_1');
  });

  it('should return null for non-existent pNFT', async () => {
    const pnft = await indexer.getPnft('pnft_nonexistent');
    expect(pnft).toBeNull();
  });

  it('should get pNFT by owner address', async () => {
    const pnft = await indexer.getPnftByOwner('addr_test1user1');
    expect(pnft).toBeTruthy();
    expect(pnft?.pnft_id).toBe('pnft_test_001');
  });

  it('should list all pNFTs', async () => {
    const pnfts = await indexer.listPnfts();
    expect(pnfts).toHaveLength(3);
  });

  it('should filter pNFTs by bioregion', async () => {
    const pnfts = await indexer.listPnfts({ bioregion: 'test_region_1' });
    expect(pnfts.length).toBe(2);
    expect(pnfts.every(p => p.bioregion === 'test_region_1')).toBe(true);
  });

  it('should filter pNFTs by minimum level', async () => {
    const pnfts = await indexer.listPnfts({ minLevel: 2 }); // Verified and above
    expect(pnfts.length).toBeGreaterThanOrEqual(1);
    expect(pnfts.some(p => p.level === 'Verified' || p.level === 'Steward')).toBe(true);
  });

  it('should respect limit parameter', async () => {
    const pnfts = await indexer.listPnfts({ limit: 2 });
    expect(pnfts).toHaveLength(2);
  });
});

// =============================================================================
// TOKEN BALANCE TESTS
// =============================================================================

describe('Token Balance Queries', () => {
  it('should get token balance by address', async () => {
    const balance = await indexer.getTokenBalance('addr_test1user1');
    expect(balance).toBe(100_000_000n); // 100 tokens * 1,000,000 microtokens
  });

  it('should return 0 for unknown address', async () => {
    const balance = await indexer.getTokenBalance('addr_unknown');
    expect(balance).toBe(0n);
  });

  it('should get pNFT token balance', async () => {
    const balance = await indexer.getPnftTokenBalance('pnft_test_001');
    expect(balance).toBe(100_000_000n);
  });

  it('should return 0 for non-existent pNFT balance', async () => {
    const balance = await indexer.getPnftTokenBalance('pnft_nonexistent');
    expect(balance).toBe(0n);
  });
});

// =============================================================================
// BIOREGION QUERIES TESTS
// =============================================================================

describe('Bioregion Queries', () => {
  it('should list all bioregions', async () => {
    const bioregions = await indexer.listBioregions();
    expect(bioregions).toHaveLength(2);
  });

  it('should get specific bioregion', async () => {
    const bioregion = await indexer.getBioregion('test_region_1');
    expect(bioregion).toBeTruthy();
    expect(bioregion?.bioregion).toBe('test_region_1');
  });

  it('should return null for non-existent bioregion', async () => {
    const bioregion = await indexer.getBioregion('nonexistent');
    expect(bioregion).toBeNull();
  });

  it('should include compound balances in bioregion data', async () => {
    const bioregion = await indexer.getBioregion('test_region_1');
    expect(bioregion).toBeTruthy();
    expect(bioregion?.compound_balances).toBeDefined();
    expect(Array.isArray(bioregion?.compound_balances)).toBe(true);
  });

  it('should calculate bioregion statistics correctly', async () => {
    const bioregion = await indexer.getBioregion('test_region_1');
    expect(bioregion?.land_index.value).toBeGreaterThan(0);
  });
});

// =============================================================================
// OFFERING QUERIES TESTS
// =============================================================================

describe('Offering Queries', () => {
  it('should list all offerings', async () => {
    const offerings = await indexer.listOfferings();
    expect(offerings).toHaveLength(1);
  });

  it('should get offering by ID', async () => {
    const offering = await indexer.getOffering('offer_test_001');
    expect(offering).toBeTruthy();
    expect(offering?.offering_id).toBe('offer_test_001');
    expect(offering?.offerer).toBe('pnft_test_001');
  });

  it('should return null for non-existent offering', async () => {
    const offering = await indexer.getOffering('nonexistent');
    expect(offering).toBeNull();
  });

  it('should filter offerings by bioregion', async () => {
    const offerings = await indexer.listOfferings({ bioregion: 'test_region_1' });
    expect(offerings).toHaveLength(1);
  });

  it('should filter offerings by offerer', async () => {
    const offerings = await indexer.listOfferings({ offerer: 'pnft_test_001' });
    expect(offerings).toHaveLength(1);
  });

  it('should filter offerings by status', async () => {
    const offerings = await indexer.listOfferings({ status: 'Active' });
    expect(offerings).toHaveLength(1);
  });

  it('should respect limit parameter', async () => {
    const offerings = await indexer.listOfferings({ limit: 1 });
    expect(offerings).toHaveLength(1);
  });
});

// =============================================================================
// NEED QUERIES TESTS
// =============================================================================

describe('Need Queries', () => {
  it('should list all needs', async () => {
    const needs = await indexer.listNeeds();
    expect(needs).toHaveLength(1);
  });

  it('should get need by ID', async () => {
    const need = await indexer.getNeed('need_test_001');
    expect(need).toBeTruthy();
    expect(need?.need_id).toBe('need_test_001');
    expect(need?.needer).toBe('pnft_test_002');
  });

  it('should return null for non-existent need', async () => {
    const need = await indexer.getNeed('nonexistent');
    expect(need).toBeNull();
  });

  it('should filter needs by bioregion', async () => {
    const needs = await indexer.listNeeds({ bioregion: 'test_region_2' });
    expect(needs).toHaveLength(1);
  });

  it('should filter needs by needer', async () => {
    const needs = await indexer.listNeeds({ needer: 'pnft_test_002' });
    expect(needs).toHaveLength(1);
  });

  it('should filter needs by status', async () => {
    const needs = await indexer.listNeeds({ status: 'Open' });
    expect(needs).toHaveLength(1);
  });
});

// =============================================================================
// COLLECTIVE QUERIES TESTS
// =============================================================================

describe('Collective Queries', () => {
  it('should list all collectives', async () => {
    const collectives = await indexer.listCollectives();
    expect(collectives).toHaveLength(1);
  });

  it('should get collective by ID', async () => {
    const collective = await indexer.getCollective('collective_test_001');
    expect(collective).toBeTruthy();
    expect(collective?.collective_id).toBe('collective_test_001');
    expect(collective?.members).toContain('pnft_test_001');
  });

  it('should return null for non-existent collective', async () => {
    const collective = await indexer.getCollective('nonexistent');
    expect(collective).toBeNull();
  });

  it('should filter collectives by bioregion', async () => {
    const collectives = await indexer.listCollectives({ bioregion: 'test_region_1' });
    expect(collectives).toHaveLength(1);
  });

  it('should filter collectives by member', async () => {
    const collectives = await indexer.listCollectives({ member: 'pnft_test_001' });
    expect(collectives).toHaveLength(1);
  });
});

// =============================================================================
// PROTOCOL STATS TESTS
// =============================================================================

describe('Protocol Statistics', () => {
  it('should get protocol stats', async () => {
    const stats = await indexer.getProtocolStats();
    expect(stats).toHaveProperty('totalPnfts', 3);
    expect(stats).toHaveProperty('totalBioregions', 2);
    expect(stats).toHaveProperty('activeOfferings', 1);
    expect(stats).toHaveProperty('activeNeeds', 1);
    expect(stats).toHaveProperty('totalLands', 1);
    expect(stats).toHaveProperty('totalTransactions', 1);
  });

  it('should calculate total value locked correctly', async () => {
    const stats = await indexer.getProtocolStats();
    const expectedTVL = BigInt((100 + 200 + 300) * 1_000_000);
    expect(stats.totalValueLocked).toBe(expectedTVL);
  });
});

// =============================================================================
// LAND QUERIES TESTS
// =============================================================================

describe('Land Queries', () => {
  it('should list all lands', async () => {
    const lands = await indexer.listLands();
    expect(lands).toHaveLength(1);
  });

  it('should get land by ID', async () => {
    const land = await indexer.getLand('land_test_001');
    expect(land).toBeTruthy();
    expect(land?.landId).toBe('land_test_001');
    expect(land?.name).toBe('Test Land 1');
  });

  it('should return null for non-existent land', async () => {
    const land = await indexer.getLand('nonexistent');
    expect(land).toBeNull();
  });
});

// =============================================================================
// CREDIT BALANCE TESTS
// =============================================================================

describe('Credit Balance Queries', () => {
  it('should get all credit balances', async () => {
    const balances = await indexer.getCreditBalances();
    expect(balances).toBeDefined();
    expect(typeof balances).toBe('object');
  });

  it('should get credit balance for specific address', async () => {
    const balance = await indexer.getCreditBalance('addr_test1user1');
    // Should return null or default for test data
    expect(balance === null || typeof balance === 'object').toBe(true);
  });
});

// =============================================================================
// IMPACT DEBT TESTS
// =============================================================================

describe('Impact Debt Queries', () => {
  it('should get impact debt for address', async () => {
    const debt = await indexer.getImpactDebt('addr_test1user2');
    expect(debt).toBe(10.5);
  });

  it('should return 0 for address with no debt', async () => {
    const debt = await indexer.getImpactDebt('addr_test1user1');
    expect(debt).toBe(0);
  });

  it('should get all impact debt', async () => {
    const allDebt = await indexer.getAllImpactDebt();
    expect(allDebt).toHaveProperty('addr_test1user2', 10.5);
  });
});

// =============================================================================
// SPENDING BUCKET TESTS
// =============================================================================

describe('Spending Bucket Queries', () => {
  it('should get spending buckets for pNFT', async () => {
    const buckets = await indexer.getSpendingBuckets('pnft_test_001');
    expect(buckets).toBeTruthy();
    expect(buckets?.owner_pnft).toBe('pnft_test_001');
    expect(buckets?.buckets).toBeInstanceOf(Array);
  });

  it('should return null bucket for non-existent bucket ID', async () => {
    const bucket = await indexer.getBucket('pnft_test_001', 'bucket_nonexistent');
    expect(bucket).toBeNull();
  });

  it('should list buckets for pNFT', async () => {
    const buckets = await indexer.listBuckets('pnft_test_001');
    expect(buckets).toBeInstanceOf(Array);
  });
});

// =============================================================================
// TREASURY & BONDING CURVE TESTS
// =============================================================================

describe('Treasury and Bonding Curve', () => {
  it('should get treasury state', async () => {
    const treasury = await indexer.getTreasuryState();
    expect(treasury).toHaveProperty('totalSupply');
    expect(treasury).toHaveProperty('distributed');
    expect(treasury).toHaveProperty('reserved');
    expect(treasury).toHaveProperty('currentPrice');
    expect(treasury.totalSupply).toBeGreaterThan(0n);
  });

  it('should get token price', async () => {
    const price = await indexer.getTokenPrice();
    expect(price).toHaveProperty('pricePerToken');
    expect(price).toHaveProperty('pricePerAda');
    expect(price).toHaveProperty('distributed');
    expect(price).toHaveProperty('remaining');
    expect(price).toHaveProperty('percentDistributed');
  });

  it('should simulate purchase', async () => {
    const simulation = await indexer.simulatePurchase(100); // 100 ADA
    expect(simulation).toHaveProperty('adaSpent', 100);
    expect(simulation).toHaveProperty('tokensReceived');
    expect(simulation).toHaveProperty('averagePrice');
    expect(simulation).toHaveProperty('priceImpact');
    expect(simulation).toHaveProperty('newPrice');
  });

  it('should get founder status', async () => {
    const founder = await indexer.getFounderStatus();
    expect(founder).toHaveProperty('monthlyUsd');
    expect(founder).toHaveProperty('startDate');
    expect(founder).toHaveProperty('totalMonths');
    expect(founder).toHaveProperty('tokensAccrued');
    expect(founder).toHaveProperty('tokensClaimed');
  });
});

// =============================================================================
// TRANSACTION HISTORY TESTS
// =============================================================================

describe('Transaction History', () => {
  it('should get all transactions', async () => {
    const txs = await indexer.getTransactions();
    expect(txs).toHaveLength(1);
  });

  it('should filter transactions by address', async () => {
    const txs = await indexer.getTransactions({ address: 'addr_test1user1' });
    expect(txs).toHaveLength(1);
    expect(txs[0].senderAddress).toBe('addr_test1user1');
  });

  it('should filter transactions by pNFT ID', async () => {
    const txs = await indexer.getTransactions({ pnftId: 'pnft_test_002' });
    expect(txs).toHaveLength(1);
    expect(txs[0].recipient).toBe('pnft_test_002');
  });

  it('should filter transactions by bioregion', async () => {
    const txs = await indexer.getTransactions({ bioregion: 'test_region_1' });
    expect(txs.length).toBeGreaterThanOrEqual(1);
  });

  it('should respect limit parameter', async () => {
    const txs = await indexer.getTransactions({ limit: 1 });
    expect(txs).toHaveLength(1);
  });
});

// =============================================================================
// SEQUESTRATION CREDITS TESTS
// =============================================================================

describe('Sequestration Credits', () => {
  it('should get sequestration credits', async () => {
    const credits = await indexer.getSequestrationCredits();
    expect(credits).toBeInstanceOf(Array);
  });

  it('should get credit purchases', async () => {
    const purchases = await indexer.getCreditPurchases();
    expect(purchases).toBeInstanceOf(Array);
  });
});

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

describe('Error Handling', () => {
  it('should handle missing deployment file gracefully', async () => {
    const badPath = join(testDir, 'nonexistent.json');
    const badIndexer = new SimulationIndexer(badPath);
    await badIndexer.initialize();

    const stats = await badIndexer.getProtocolStats();
    expect(stats).toBeDefined();
    expect(stats.totalPnfts).toBe(0);
  });

  it('should handle corrupted JSON gracefully', async () => {
    const corruptPath = join(testDir, 'corrupt.json');
    writeFileSync(corruptPath, '{ invalid json }');

    const corruptIndexer = new SimulationIndexer(corruptPath);
    await corruptIndexer.initialize();

    // Should fall back to defaults
    const stats = await corruptIndexer.getProtocolStats();
    expect(stats.totalPnfts).toBe(0);

    unlinkSync(corruptPath);
  });

  it('should handle empty deployment data', async () => {
    const emptyPath = join(testDir, 'empty.json');
    const emptyData = {
      testUsers: [],
      pnfts: [],
      ultraBalances: {},
      signupGrants: [],
      lands: [],
      bioregionStats: {},
      transactions: [],
      bioregionImpact: {},
      impactTokens: [],
      impactTokenBalances: {},
      impactDebt: {},
      sequestrationCredits: [],
      creditBalances: {},
      lastCreditGeneration: {},
      creditPurchases: []
    };
    writeFileSync(emptyPath, JSON.stringify(emptyData, null, 2));

    const emptyIndexer = new SimulationIndexer(emptyPath);
    await emptyIndexer.initialize();

    const pnfts = await emptyIndexer.listPnfts();
    expect(pnfts).toHaveLength(0);

    unlinkSync(emptyPath);
  });
});
