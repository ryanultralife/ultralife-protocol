/**
 * MCP Handler Tests
 *
 * Tests all 14 MCP tool handlers with mock data
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { LocalModeHandlers } from '../mcp/handlers-local.js';

// =============================================================================
// MOCK DATA
// =============================================================================

const MOCK_DEPLOYMENT_DATA = {
  testUsers: [
    {
      name: 'Alice',
      address: 'addr_test1alice',
      mnemonic: 'test mnemonic alice',
      pnftId: 'pnft_alice_001',
      bioregion: 'sierra_nevada',
      createdAt: '2026-01-01T00:00:00.000Z'
    },
    {
      name: 'Bob',
      address: 'addr_test1bob',
      mnemonic: 'test mnemonic bob',
      pnftId: 'pnft_bob_002',
      bioregion: 'cascadia',
      createdAt: '2026-01-02T00:00:00.000Z'
    }
  ],
  pnfts: [
    {
      id: 'pnft_alice_001',
      owner: 'addr_test1alice',
      level: 'Verified',
      bioregion: 'sierra_nevada',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdSlot: 1000,
      status: 'minted',
      testnetSimulated: true,
      lands_stewarded: ['land_001']
    },
    {
      id: 'pnft_bob_002',
      owner: 'addr_test1bob',
      level: 'Basic',
      bioregion: 'cascadia',
      createdAt: '2026-01-02T00:00:00.000Z',
      createdSlot: 2000,
      status: 'minted',
      testnetSimulated: true
    },
    {
      id: 'pnft_charlie_003',
      owner: 'addr_test1charlie',
      level: 'Steward',
      bioregion: 'sierra_nevada',
      createdAt: '2026-01-03T00:00:00.000Z',
      createdSlot: 3000,
      status: 'minted',
      testnetSimulated: true
    }
  ],
  ultraBalances: {
    'addr_test1alice': 100.5,
    'addr_test1bob': 50.25,
    'addr_test1charlie': 200.75
  },
  signupGrants: [
    {
      pnftId: 'pnft_alice_001',
      pnftOwner: 'addr_test1alice',
      amount: 50,
      claimedAt: '2026-01-01T00:00:00.000Z',
      testnetSimulated: true
    }
  ],
  lands: [
    {
      landId: 'land_001',
      name: 'Test Forest Parcel',
      boundsHash: 'hash123',
      area_m2: 100000,
      bioregion: 'sierra_nevada',
      classification: {
        name: 'Forest',
        terrain: 'Mountainous',
        ecosystem: 'Forest',
        sequestrationRate: 5
      },
      health: {
        overall_index: 75,
        soil_health: 70,
        water_health: 80,
        biodiversity_index: 70,
        carbon_stock: 1000,
        last_survey: null
      },
      primarySteward: 'pnft_alice_001',
      stewardAddress: 'addr_test1alice',
      rights: {},
      registered_at: 1000,
      registeredAt: '2026-01-01T00:00:00.000Z',
      testnetSimulated: true
    },
    {
      landId: 'land_002',
      name: 'Test Grassland Parcel',
      boundsHash: 'hash456',
      area_m2: 50000,
      bioregion: 'cascadia',
      classification: {
        name: 'Grassland',
        terrain: 'Plains',
        ecosystem: 'Grassland',
        sequestrationRate: 2
      },
      health: {
        overall_index: 65,
        soil_health: 60,
        water_health: 70,
        biodiversity_index: 65,
        carbon_stock: 500,
        last_survey: null
      },
      primarySteward: 'pnft_bob_002',
      stewardAddress: 'addr_test1bob',
      rights: {},
      registered_at: 2000,
      registeredAt: '2026-01-02T00:00:00.000Z',
      testnetSimulated: true
    }
  ],
  bioregionStats: {
    sierra_nevada: {
      totalLandArea: 100000,
      landsRegistered: 1,
      totalSequestrationCapacity: 50
    },
    cascadia: {
      totalLandArea: 50000,
      landsRegistered: 1,
      totalSequestrationCapacity: 10
    }
  },
  transactions: [
    {
      txHash: 'tx_001',
      sender: 'pnft_alice_001',
      senderAddress: 'addr_test1alice',
      senderBioregion: 'sierra_nevada',
      recipient: 'pnft_bob_002',
      recipientAddress: 'addr_test1bob',
      recipientBioregion: 'cascadia',
      amount: 10,
      txType: {
        code: 1,
        name: 'Transfer',
        description: 'Token transfer'
      },
      impact: {
        description: 'Test impact',
        compounds: [
          {
            compound: 'CO2',
            quantity: 5,
            unit: 'kg',
            confidence: 80
          }
        ],
        netImpact: 5,
        evidenceHash: 'evidence123'
      },
      note: 'Test transaction',
      slot: 5000,
      timestamp: '2026-01-05T00:00:00.000Z',
      testnetSimulated: true
    }
  ],
  bioregionImpact: {
    sierra_nevada: {
      totalTransactions: 5,
      totalVolume: 100,
      netImpact: 25,
      byType: {
        Transfer: 3,
        Trade: 2
      },
      byCompound: {
        CO2: 25,
        H2O: 10
      }
    }
  },
  impactTokens: [
    {
      tokenId: 'token_001',
      amount: 100,
      category: 'Carbon',
      compounds: [
        {
          compound: 'CO2',
          quantity: 100,
          unit: 'kg',
          confidence: 90
        }
      ],
      mintedAt: '2026-01-01T00:00:00.000Z',
      mintedBy: 'pnft_alice_001',
      bioregion: 'sierra_nevada',
      txHash: 'tx_001'
    }
  ],
  impactTokenBalances: {
    'addr_test1alice': [
      {
        tokenId: 'token_001',
        amount: 100,
        category: 'Carbon'
      }
    ]
  },
  impactDebt: {
    'addr_test1bob': 5.5
  },
  sequestrationCredits: [
    {
      creditId: 'credit_001',
      landId: 'land_001',
      landName: 'Test Forest Parcel',
      steward: 'pnft_alice_001',
      stewardAddress: 'addr_test1alice',
      bioregion: 'sierra_nevada',
      amount: 10,
      unit: 'tCO2',
      cyclesGenerated: 1,
      generatedAt: '2026-01-01T00:00:00.000Z',
      landType: 'Forest',
      sequestrationRate: 5,
      confidence: 85,
      status: 'Available',
      testnetSimulated: true
    }
  ],
  creditBalances: {
    'addr_test1alice': {
      total: 10,
      available: 8,
      sold: 2,
      byLand: {
        'land_001': 10
      }
    }
  },
  lastCreditGeneration: {
    'land_001': '2026-01-01T00:00:00.000Z'
  },
  creditPurchases: [
    {
      purchaseId: 'purchase_001',
      buyer: 'pnft_bob_002',
      seller: 'pnft_alice_001',
      amount: 2,
      unit: 'tCO2',
      price: 5,
      priceUnit: 'ULTRA',
      debtBefore: 10,
      debtAfter: 5.5,
      purchasedAt: '2026-01-05T00:00:00.000Z',
      testnetSimulated: true
    }
  ],
  marketplace: [
    {
      id: 'offering_001',
      offerer: 'pnft_alice_001',
      what: 'Apples',
      description: 'Fresh organic apples',
      price: 5,
      status: 'Active',
      bioregion: 'sierra_nevada',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  ],
  care: [
    {
      id: 'need_001',
      needer: 'pnft_bob_002',
      description: 'Need help with harvesting',
      status: 'Open',
      bioregion: 'cascadia',
      createdAt: '2026-01-02T00:00:00.000Z'
    }
  ]
};

const MOCK_PROTOCOL_SPEC = {
  protocol: 'UltraLife',
  version: '1.0.0',
  network: 'cardano',
  description: 'Impact-tracked economy on Cardano',
  principles: [
    'Transparency',
    'Accountability',
    'Sustainability'
  ],
  compounds: {
    carbon: {
      CO2: {
        name: 'Carbon Dioxide',
        unit: 'kg',
        direction: 'negative'
      }
    }
  },
  confidence_levels: {
    estimated: {
      method: 'Estimated',
      description: 'Rough estimate',
      verify_days: null
    }
  },
  transaction_types: {
    transfer: {
      code: 1,
      description: 'Token transfer',
      example: 'Alice sends 10 ULTRA to Bob'
    }
  },
  land_sequestration: {
    description: 'Carbon sequestration from land',
    rates_tCO2_per_ha_per_year: {
      Forest: 5,
      Grassland: 2
    },
    credit_price_ultra: 5,
    credit_generation: 'Every 30 days'
  },
  llm_instructions: {
    general: ['Be helpful', 'Be accurate']
  }
};

// =============================================================================
// TEST SETUP
// =============================================================================

let testDir: string;
let deploymentPath: string;
let protocolSpecPath: string;
let handlers: LocalModeHandlers;

beforeAll(async () => {
  // Create temp test directory
  testDir = join(process.cwd(), '.test-temp');
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }

  // Write mock data
  deploymentPath = join(testDir, 'deployment.json');
  protocolSpecPath = join(testDir, 'protocol-spec.json');

  writeFileSync(deploymentPath, JSON.stringify(MOCK_DEPLOYMENT_DATA, null, 2));
  writeFileSync(protocolSpecPath, JSON.stringify(MOCK_PROTOCOL_SPEC, null, 2));

  // Initialize handlers
  handlers = new LocalModeHandlers(deploymentPath, protocolSpecPath);
  await handlers.initialize();
});

afterAll(() => {
  // Cleanup
  try {
    unlinkSync(deploymentPath);
    unlinkSync(protocolSpecPath);
  } catch (error) {
    // Ignore cleanup errors
  }
});

// =============================================================================
// INFORMATION TOOLS TESTS
// =============================================================================

describe('Information Tools', () => {
  describe('get_ultralife_info', () => {
    it('should return general info when no topic specified', () => {
      const result = handlers.getUltraLifeInfo();
      expect(result).toHaveProperty('overview');
      expect(result).toHaveProperty('available_topics');
      expect(result).toHaveProperty('mode', 'local');
    });

    it('should return specific topic info', () => {
      const result = handlers.getUltraLifeInfo('identity');
      expect(result).toHaveProperty('topic', 'identity');
      expect(result).toHaveProperty('what');
      expect(result).toHaveProperty('levels');
      expect(result).toHaveProperty('mode', 'local');
    });

    it('should return compounds info', () => {
      const result = handlers.getUltraLifeInfo('compounds');
      expect(result).toHaveProperty('topic', 'compounds');
      expect(result).toHaveProperty('mode', 'local');
    });
  });

  describe('get_protocol_stats', () => {
    it('should return aggregated protocol statistics', () => {
      const result = handlers.getProtocolStats();
      expect(result).toHaveProperty('mode', 'local');
      expect(result).toHaveProperty('total_pnfts', 3);
      expect(result).toHaveProperty('total_bioregions', 2);
      expect(result).toHaveProperty('total_lands', 2);
      expect(result).toHaveProperty('total_transactions', 1);
      expect(result).toHaveProperty('total_volume_ultra', 10);
    });

    it('should calculate total value locked correctly', () => {
      const result = handlers.getProtocolStats() as any;
      const expectedTVL = 100.5 + 50.25 + 200.75;
      expect(result.total_value_locked).toBe(expectedTVL);
    });
  });
});

// =============================================================================
// pNFT TOOLS TESTS
// =============================================================================

describe('pNFT Tools', () => {
  describe('get_pnft', () => {
    it('should retrieve pNFT by ID', () => {
      const result = handlers.getPnft('pnft_alice_001') as any;
      expect(result).toHaveProperty('id', 'pnft_alice_001');
      expect(result).toHaveProperty('owner', 'addr_test1alice');
      expect(result).toHaveProperty('level', 'Verified');
      expect(result).toHaveProperty('bioregion', 'sierra_nevada');
      expect(result).toHaveProperty('token_balance', 100.5);
      expect(result).toHaveProperty('mode', 'local');
    });

    it('should return error for non-existent pNFT', () => {
      const result = handlers.getPnft('pnft_nonexistent') as any;
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('not found');
      expect(result).toHaveProperty('mode', 'local');
    });

    it('should include user name when available', () => {
      const result = handlers.getPnft('pnft_alice_001') as any;
      expect(result).toHaveProperty('user_name', 'Alice');
    });

    it('should include impact debt', () => {
      const result = handlers.getPnft('pnft_bob_002') as any;
      expect(result).toHaveProperty('impact_debt', 5.5);
    });
  });

  describe('get_pnft_by_address', () => {
    it('should find pNFT by wallet address', () => {
      const result = handlers.getPnftByAddress('addr_test1alice') as any;
      expect(result).toHaveProperty('id', 'pnft_alice_001');
      expect(result).toHaveProperty('owner', 'addr_test1alice');
    });

    it('should return error for unknown address', () => {
      const result = handlers.getPnftByAddress('addr_test1unknown') as any;
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('No pNFT found');
    });
  });

  describe('get_token_balance', () => {
    it('should return balance for pNFT', () => {
      const result = handlers.getTokenBalance('pnft_alice_001') as any;
      expect(result).toHaveProperty('pnft_id', 'pnft_alice_001');
      expect(result).toHaveProperty('balance', '100.5');
      expect(result).toHaveProperty('balance_formatted', '100.500000 ULTRA');
      expect(result).toHaveProperty('mode', 'local');
    });

    it('should return error for non-existent pNFT', () => {
      const result = handlers.getTokenBalance('pnft_nonexistent') as any;
      expect(result).toHaveProperty('error');
    });
  });

  describe('list_pnfts', () => {
    it('should list all pNFTs without filters', () => {
      const result = handlers.listPnfts() as any;
      expect(result).toHaveProperty('count', 3);
      expect(result).toHaveProperty('total', 3);
      expect(result).toHaveProperty('pnfts');
      expect(result.pnfts).toHaveLength(3);
      expect(result).toHaveProperty('mode', 'local');
    });

    it('should filter by bioregion', () => {
      const result = handlers.listPnfts({ bioregion: 'sierra_nevada' }) as any;
      expect(result).toHaveProperty('count', 2);
      expect(result.pnfts.every((p: any) => p.bioregion === 'sierra_nevada')).toBe(true);
    });

    it('should filter by minimum level', () => {
      const result = handlers.listPnfts({ minLevel: 2 }) as any;
      expect(result.count).toBeGreaterThanOrEqual(1);
      // Should include Verified and Steward, exclude Basic
    });

    it('should respect limit parameter', () => {
      const result = handlers.listPnfts({ limit: 1 }) as any;
      expect(result).toHaveProperty('count', 1);
      expect(result.pnfts).toHaveLength(1);
    });

    it('should enrich pNFTs with token balances', () => {
      const result = handlers.listPnfts() as any;
      result.pnfts.forEach((pnft: any) => {
        expect(pnft).toHaveProperty('token_balance');
      });
    });
  });
});

// =============================================================================
// BIOREGION TOOLS TESTS
// =============================================================================

describe('Bioregion Tools', () => {
  describe('list_bioregions', () => {
    it('should list all bioregions', () => {
      const result = handlers.listBioregions() as any;
      expect(result).toHaveProperty('count', 2);
      expect(result).toHaveProperty('bioregions');
      expect(result.bioregions).toHaveLength(2);
      expect(result).toHaveProperty('mode', 'local');
    });

    it('should include bioregion stats', () => {
      const result = handlers.listBioregions() as any;
      const sierra = result.bioregions.find((b: any) => b.id === 'sierra_nevada');
      expect(sierra).toBeDefined();
      expect(sierra).toHaveProperty('totalLandArea', 100000);
      expect(sierra).toHaveProperty('landsRegistered', 1);
    });

    it('should include impact data when available', () => {
      const result = handlers.listBioregions() as any;
      const sierra = result.bioregions.find((b: any) => b.id === 'sierra_nevada');
      expect(sierra).toHaveProperty('impact');
      expect(sierra.impact).toHaveProperty('totalTransactions', 5);
      expect(sierra.impact).toHaveProperty('totalVolume', 100);
    });
  });

  describe('get_bioregion', () => {
    it('should retrieve specific bioregion details', () => {
      const result = handlers.getBioregion('sierra_nevada') as any;
      expect(result).toHaveProperty('id', 'sierra_nevada');
      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('lands_count', 1);
      expect(result).toHaveProperty('pnfts_count', 2);
      expect(result).toHaveProperty('mode', 'local');
    });

    it('should return error for non-existent bioregion', () => {
      const result = handlers.getBioregion('nonexistent') as any;
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('not found');
    });
  });
});

// =============================================================================
// LAND TOOLS TESTS
// =============================================================================

describe('Land Tools', () => {
  describe('get_land', () => {
    it('should retrieve land by ID', () => {
      const result = handlers.getLand('land_001') as any;
      expect(result).toHaveProperty('landId', 'land_001');
      expect(result).toHaveProperty('name', 'Test Forest Parcel');
      expect(result).toHaveProperty('area_m2', 100000);
      expect(result).toHaveProperty('bioregion', 'sierra_nevada');
      expect(result).toHaveProperty('mode', 'local');
    });

    it('should include sequestration credits', () => {
      const result = handlers.getLand('land_001') as any;
      expect(result).toHaveProperty('sequestration_credits');
      expect(result.sequestration_credits).toBeInstanceOf(Array);
      expect(result).toHaveProperty('total_credits_generated', 10);
    });

    it('should return error for non-existent land', () => {
      const result = handlers.getLand('land_nonexistent') as any;
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('not found');
    });
  });

  describe('list_lands', () => {
    it('should list all lands without filters', () => {
      const result = handlers.listLands() as any;
      expect(result).toHaveProperty('count', 2);
      expect(result).toHaveProperty('total', 2);
      expect(result).toHaveProperty('lands');
      expect(result.lands).toHaveLength(2);
      expect(result).toHaveProperty('mode', 'local');
    });

    it('should filter by bioregion', () => {
      const result = handlers.listLands({ bioregion: 'sierra_nevada' }) as any;
      expect(result).toHaveProperty('count', 1);
      expect(result.lands[0]).toHaveProperty('bioregion', 'sierra_nevada');
    });

    it('should filter by steward', () => {
      const result = handlers.listLands({ steward: 'pnft_alice_001' }) as any;
      expect(result).toHaveProperty('count', 1);
      expect(result.lands[0]).toHaveProperty('steward', 'pnft_alice_001');
    });

    it('should respect limit parameter', () => {
      const result = handlers.listLands({ limit: 1 }) as any;
      expect(result).toHaveProperty('count', 1);
      expect(result.lands).toHaveLength(1);
    });

    it('should include key land attributes in summary', () => {
      const result = handlers.listLands() as any;
      result.lands.forEach((land: any) => {
        expect(land).toHaveProperty('id');
        expect(land).toHaveProperty('name');
        expect(land).toHaveProperty('area_m2');
        expect(land).toHaveProperty('classification');
        expect(land).toHaveProperty('health_index');
        expect(land).toHaveProperty('sequestration_rate');
      });
    });
  });
});

// =============================================================================
// MARKETPLACE TOOLS TESTS
// =============================================================================

describe('Marketplace Tools', () => {
  describe('list_offerings', () => {
    it('should list marketplace offerings', () => {
      const result = handlers.listOfferings() as any;
      expect(result).toHaveProperty('count', 1);
      expect(result).toHaveProperty('total', 1);
      expect(result).toHaveProperty('offerings');
      expect(result).toHaveProperty('mode', 'local');
    });

    it('should filter by bioregion', () => {
      const result = handlers.listOfferings({ bioregion: 'sierra_nevada' }) as any;
      expect(result).toHaveProperty('count', 1);
    });

    it('should filter by offerer', () => {
      const result = handlers.listOfferings({ offerer: 'pnft_alice_001' }) as any;
      expect(result).toHaveProperty('count', 1);
    });

    it('should filter by status', () => {
      const result = handlers.listOfferings({ status: 'Active' }) as any;
      expect(result).toHaveProperty('count', 1);
    });

    it('should handle empty marketplace data', () => {
      // Temporarily modify data
      const deployment = JSON.parse(JSON.stringify(MOCK_DEPLOYMENT_DATA));
      deployment.marketplace = [];
      writeFileSync(deploymentPath, JSON.stringify(deployment, null, 2));

      const emptyHandlers = new LocalModeHandlers(deploymentPath, protocolSpecPath);
      const result = emptyHandlers.listOfferings() as any;

      expect(result).toHaveProperty('count', 0);
      expect(result).toHaveProperty('offerings');

      // Restore data
      writeFileSync(deploymentPath, JSON.stringify(MOCK_DEPLOYMENT_DATA, null, 2));
    });
  });

  describe('list_needs', () => {
    it('should list care/needs', () => {
      const result = handlers.listNeeds() as any;
      expect(result).toHaveProperty('count', 1);
      expect(result).toHaveProperty('total', 1);
      expect(result).toHaveProperty('needs');
      expect(result).toHaveProperty('mode', 'local');
    });

    it('should filter by bioregion', () => {
      const result = handlers.listNeeds({ bioregion: 'cascadia' }) as any;
      expect(result).toHaveProperty('count', 1);
    });

    it('should filter by needer', () => {
      const result = handlers.listNeeds({ needer: 'pnft_bob_002' }) as any;
      expect(result).toHaveProperty('count', 1);
    });

    it('should filter by status', () => {
      const result = handlers.listNeeds({ status: 'Open' }) as any;
      expect(result).toHaveProperty('count', 1);
    });
  });
});

// =============================================================================
// TRANSACTION TOOLS TESTS
// =============================================================================

describe('Transaction Tools', () => {
  describe('list_transactions', () => {
    it('should list all transactions', () => {
      const result = handlers.listTransactions() as any;
      expect(result).toHaveProperty('count', 1);
      expect(result).toHaveProperty('total', 1);
      expect(result).toHaveProperty('transactions');
      expect(result).toHaveProperty('mode', 'local');
    });

    it('should filter by sender', () => {
      const result = handlers.listTransactions({ sender: 'pnft_alice_001' }) as any;
      expect(result).toHaveProperty('count', 1);
      expect(result.transactions[0]).toHaveProperty('sender', 'pnft_alice_001');
    });

    it('should filter by recipient', () => {
      const result = handlers.listTransactions({ recipient: 'pnft_bob_002' }) as any;
      expect(result).toHaveProperty('count', 1);
      expect(result.transactions[0]).toHaveProperty('recipient', 'pnft_bob_002');
    });

    it('should filter by bioregion', () => {
      const result = handlers.listTransactions({ bioregion: 'sierra_nevada' }) as any;
      expect(result).toHaveProperty('count', 1);
    });

    it('should respect limit parameter', () => {
      const result = handlers.listTransactions({ limit: 1 }) as any;
      expect(result).toHaveProperty('count', 1);
      expect(result.transactions).toHaveLength(1);
    });
  });
});

// =============================================================================
// SEQUESTRATION CREDITS TESTS
// =============================================================================

describe('Sequestration Credits', () => {
  describe('get_sequestration_credits', () => {
    it('should return all credit information', () => {
      const result = handlers.getSequestrationCredits() as any;
      expect(result).toHaveProperty('total_credits', 1);
      expect(result).toHaveProperty('credits');
      expect(result).toHaveProperty('balances');
      expect(result).toHaveProperty('purchases');
      expect(result).toHaveProperty('mode', 'local');
    });

    it('should include credit details', () => {
      const result = handlers.getSequestrationCredits() as any;
      expect(result.credits).toHaveLength(1);
      expect(result.credits[0]).toHaveProperty('creditId', 'credit_001');
      expect(result.credits[0]).toHaveProperty('amount', 10);
      expect(result.credits[0]).toHaveProperty('unit', 'tCO2');
    });

    it('should include credit balances by address', () => {
      const result = handlers.getSequestrationCredits() as any;
      expect(result.balances).toHaveProperty('addr_test1alice');
      expect(result.balances['addr_test1alice']).toHaveProperty('total', 10);
      expect(result.balances['addr_test1alice']).toHaveProperty('available', 8);
      expect(result.balances['addr_test1alice']).toHaveProperty('sold', 2);
    });

    it('should include purchase history', () => {
      const result = handlers.getSequestrationCredits() as any;
      expect(result.purchases).toHaveLength(1);
      expect(result.purchases[0]).toHaveProperty('purchaseId', 'purchase_001');
      expect(result.purchases[0]).toHaveProperty('buyer', 'pnft_bob_002');
      expect(result.purchases[0]).toHaveProperty('amount', 2);
    });
  });
});

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

describe('Error Handling', () => {
  it('should handle missing deployment file gracefully', () => {
    const badPath = join(testDir, 'nonexistent.json');
    expect(() => {
      new LocalModeHandlers(badPath);
    }).not.toThrow();
  });

  it('should handle missing protocol spec file gracefully', () => {
    const badSpecPath = join(testDir, 'nonexistent-spec.json');
    const testHandlers = new LocalModeHandlers(deploymentPath, badSpecPath);
    const result = testHandlers.getUltraLifeInfo();
    expect(result).toBeDefined();
  });

  it('should handle corrupted deployment data', () => {
    const corruptPath = join(testDir, 'corrupt.json');
    writeFileSync(corruptPath, '{ invalid json }');

    expect(() => {
      const corruptHandlers = new LocalModeHandlers(corruptPath);
      corruptHandlers.getProtocolStats();
    }).toThrow();

    unlinkSync(corruptPath);
  });
});
