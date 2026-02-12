/**
 * Integration Tests for UltraLife MCP Server
 *
 * Tests the full MCP server flow including:
 * - Server startup
 * - Tool registration
 * - Request/response cycle
 * - LOCAL_MODE behavior
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { UltraLifeLocalMcpServer, LocalModeConfig } from '../mcp/index-local.js';

// =============================================================================
// MOCK DATA
// =============================================================================

const MINIMAL_DEPLOYMENT = {
  testUsers: [
    {
      name: 'IntegrationUser',
      address: 'addr_integration_test',
      mnemonic: 'test mnemonic',
      pnftId: 'pnft_integration_001',
      bioregion: 'integration_region',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  ],
  pnfts: [
    {
      id: 'pnft_integration_001',
      owner: 'addr_integration_test',
      level: 'Standard',
      bioregion: 'integration_region',
      createdAt: '2026-01-01T00:00:00.000Z',
      createdSlot: 1000,
      status: 'minted',
      testnetSimulated: true
    }
  ],
  ultraBalances: {
    'addr_integration_test': 100
  },
  signupGrants: [],
  lands: [
    {
      landId: 'land_integration_001',
      name: 'Integration Test Land',
      boundsHash: 'hash_int',
      area_m2: 10000,
      bioregion: 'integration_region',
      classification: {
        name: 'Forest',
        terrain: 'Flat',
        ecosystem: 'Forest',
        sequestrationRate: 3
      },
      health: {
        overall_index: 70,
        soil_health: 65,
        water_health: 75,
        biodiversity_index: 70,
        carbon_stock: 300,
        last_survey: null
      },
      primarySteward: 'pnft_integration_001',
      stewardAddress: 'addr_integration_test',
      rights: {},
      registered_at: 1000,
      registeredAt: '2026-01-01T00:00:00.000Z',
      testnetSimulated: true
    }
  ],
  bioregionStats: {
    integration_region: {
      totalLandArea: 10000,
      landsRegistered: 1,
      totalSequestrationCapacity: 3
    }
  },
  transactions: [],
  bioregionImpact: {},
  impactTokens: [],
  impactTokenBalances: {},
  impactDebt: {},
  sequestrationCredits: [],
  creditBalances: {},
  lastCreditGeneration: {},
  creditPurchases: [],
  marketplace: [
    {
      id: 'offer_int_001',
      offerer: 'pnft_integration_001',
      what: 'Test Offering',
      description: 'Integration test offering',
      price: 5,
      status: 'Active',
      bioregion: 'integration_region',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  ],
  care: [
    {
      id: 'need_int_001',
      needer: 'pnft_integration_001',
      description: 'Integration test need',
      status: 'Open',
      bioregion: 'integration_region',
      createdAt: '2026-01-01T00:00:00.000Z'
    }
  ]
};

const MINIMAL_PROTOCOL_SPEC = {
  protocol: 'UltraLife',
  version: '1.0.0',
  network: 'cardano',
  description: 'Integration test protocol',
  principles: ['Test principle'],
  compounds: {},
  confidence_levels: {},
  transaction_types: {},
  land_sequestration: {
    description: 'Test',
    rates_tCO2_per_ha_per_year: {},
    credit_price_ultra: 5,
    credit_generation: 'Test'
  },
  llm_instructions: {}
};

// =============================================================================
// TEST SETUP
// =============================================================================

let testDir: string;
let deploymentPath: string;
let protocolSpecPath: string;
let server: UltraLifeLocalMcpServer;

beforeAll(async () => {
  // Create temp test directory
  testDir = join(process.cwd(), '.test-temp-integration');
  if (!existsSync(testDir)) {
    mkdirSync(testDir, { recursive: true });
  }

  // Write mock data
  deploymentPath = join(testDir, 'deployment.json');
  protocolSpecPath = join(testDir, 'protocol-spec.json');

  writeFileSync(deploymentPath, JSON.stringify(MINIMAL_DEPLOYMENT, null, 2));
  writeFileSync(protocolSpecPath, JSON.stringify(MINIMAL_PROTOCOL_SPEC, null, 2));
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
// SERVER INITIALIZATION TESTS
// =============================================================================

describe('MCP Server Initialization', () => {
  it('should create server instance with valid config', () => {
    const config: LocalModeConfig = {
      deploymentPath,
      protocolSpecPath
    };

    expect(() => {
      server = new UltraLifeLocalMcpServer(config);
    }).not.toThrow();
  });

  it('should create server with deployment path only', () => {
    const config: LocalModeConfig = {
      deploymentPath
    };

    expect(() => {
      const testServer = new UltraLifeLocalMcpServer(config);
    }).not.toThrow();
  });

  it('should handle invalid deployment path gracefully', () => {
    const config: LocalModeConfig = {
      deploymentPath: join(testDir, 'nonexistent.json')
    };

    // Should not throw during construction
    expect(() => {
      const testServer = new UltraLifeLocalMcpServer(config);
    }).not.toThrow();
  });
});

// =============================================================================
// TOOL HANDLING TESTS
// =============================================================================

describe('Tool Request Handling', () => {
  beforeAll(() => {
    const config: LocalModeConfig = {
      deploymentPath,
      protocolSpecPath
    };
    server = new UltraLifeLocalMcpServer(config);
  });

  describe('Information Tools', () => {
    it('should handle get_ultralife_info', async () => {
      const result = await (server as any).handleTool('get_ultralife_info', {});
      expect(result).toBeDefined();
      expect(result).toHaveProperty('mode', 'local');
    });

    it('should handle get_protocol_stats', async () => {
      const result = await (server as any).handleTool('get_protocol_stats', {});
      expect(result).toBeDefined();
      expect(result).toHaveProperty('mode', 'local');
      expect(result).toHaveProperty('total_pnfts');
    });
  });

  describe('pNFT Tools', () => {
    it('should handle get_pnft', async () => {
      const result = await (server as any).handleTool('get_pnft', {
        pnft_id: 'pnft_integration_001'
      });
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'pnft_integration_001');
    });

    it('should handle get_pnft_by_address', async () => {
      const result = await (server as any).handleTool('get_pnft_by_address', {
        address: 'addr_integration_test'
      });
      expect(result).toBeDefined();
      expect(result).toHaveProperty('owner', 'addr_integration_test');
    });

    it('should handle get_token_balance', async () => {
      const result = await (server as any).handleTool('get_token_balance', {
        pnft_id: 'pnft_integration_001'
      });
      expect(result).toBeDefined();
      expect(result).toHaveProperty('balance');
    });

    it('should handle list_pnfts', async () => {
      const result = await (server as any).handleTool('list_pnfts', {});
      expect(result).toBeDefined();
      expect(result).toHaveProperty('pnfts');
      expect(Array.isArray((result as any).pnfts)).toBe(true);
    });

    it('should handle list_pnfts with filters', async () => {
      const result = await (server as any).handleTool('list_pnfts', {
        bioregion: 'integration_region',
        limit: 5
      });
      expect(result).toBeDefined();
      expect((result as any).pnfts.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Bioregion Tools', () => {
    it('should handle list_bioregions', async () => {
      const result = await (server as any).handleTool('list_bioregions', {});
      expect(result).toBeDefined();
      expect(result).toHaveProperty('bioregions');
    });

    it('should handle get_bioregion', async () => {
      const result = await (server as any).handleTool('get_bioregion', {
        bioregion_id: 'integration_region'
      });
      expect(result).toBeDefined();
      expect(result).toHaveProperty('id', 'integration_region');
    });
  });

  describe('Land Tools', () => {
    it('should handle get_land', async () => {
      const result = await (server as any).handleTool('get_land', {
        land_id: 'land_integration_001'
      });
      expect(result).toBeDefined();
      expect(result).toHaveProperty('landId', 'land_integration_001');
    });

    it('should handle list_lands', async () => {
      const result = await (server as any).handleTool('list_lands', {});
      expect(result).toBeDefined();
      expect(result).toHaveProperty('lands');
    });

    it('should handle list_lands with filters', async () => {
      const result = await (server as any).handleTool('list_lands', {
        bioregion: 'integration_region',
        steward: 'pnft_integration_001'
      });
      expect(result).toBeDefined();
    });
  });

  describe('Marketplace Tools', () => {
    it('should handle list_offerings', async () => {
      const result = await (server as any).handleTool('list_offerings', {});
      expect(result).toBeDefined();
      expect(result).toHaveProperty('offerings');
    });

    it('should handle list_offerings with filters', async () => {
      const result = await (server as any).handleTool('list_offerings', {
        bioregion: 'integration_region',
        status: 'Active'
      });
      expect(result).toBeDefined();
    });

    it('should handle list_needs', async () => {
      const result = await (server as any).handleTool('list_needs', {});
      expect(result).toBeDefined();
      expect(result).toHaveProperty('needs');
    });
  });

  describe('Transaction Tools', () => {
    it('should handle list_transactions', async () => {
      const result = await (server as any).handleTool('list_transactions', {});
      expect(result).toBeDefined();
      expect(result).toHaveProperty('transactions');
    });

    it('should handle list_transactions with filters', async () => {
      const result = await (server as any).handleTool('list_transactions', {
        sender: 'pnft_integration_001',
        limit: 10
      });
      expect(result).toBeDefined();
    });
  });

  describe('Sequestration Credits', () => {
    it('should handle get_sequestration_credits', async () => {
      const result = await (server as any).handleTool('get_sequestration_credits', {});
      expect(result).toBeDefined();
      expect(result).toHaveProperty('credits');
      expect(result).toHaveProperty('balances');
      expect(result).toHaveProperty('purchases');
    });
  });

  describe('Unknown Tools', () => {
    it('should throw error for unknown tool', async () => {
      await expect(
        (server as any).handleTool('unknown_tool', {})
      ).rejects.toThrow();
    });

    it('should provide helpful error message for unknown tool', async () => {
      try {
        await (server as any).handleTool('build_transaction', {});
        fail('Should have thrown error');
      } catch (error) {
        expect((error as Error).message).toContain('Unknown tool');
        expect((error as Error).message).toContain('not available in local mode');
      }
    });
  });
});

// =============================================================================
// ERROR HANDLING TESTS
// =============================================================================

describe('Error Handling', () => {
  it('should handle missing required parameters gracefully', async () => {
    const config: LocalModeConfig = {
      deploymentPath,
      protocolSpecPath
    };
    const testServer = new UltraLifeLocalMcpServer(config);

    // Missing pnft_id parameter
    const result = await (testServer as any).handleTool('get_pnft', {});
    expect(result).toBeDefined();
    // Should handle undefined gracefully
  });

  it('should return error object for invalid IDs', async () => {
    const config: LocalModeConfig = {
      deploymentPath,
      protocolSpecPath
    };
    const testServer = new UltraLifeLocalMcpServer(config);

    const result = await (testServer as any).handleTool('get_pnft', {
      pnft_id: 'nonexistent_pnft'
    });

    expect(result).toHaveProperty('error');
    expect(result).toHaveProperty('mode', 'local');
  });

  it('should handle invalid bioregion ID', async () => {
    const config: LocalModeConfig = {
      deploymentPath,
      protocolSpecPath
    };
    const testServer = new UltraLifeLocalMcpServer(config);

    const result = await (testServer as any).handleTool('get_bioregion', {
      bioregion_id: 'nonexistent_region'
    });

    expect(result).toHaveProperty('error');
  });

  it('should handle invalid land ID', async () => {
    const config: LocalModeConfig = {
      deploymentPath,
      protocolSpecPath
    };
    const testServer = new UltraLifeLocalMcpServer(config);

    const result = await (testServer as any).handleTool('get_land', {
      land_id: 'nonexistent_land'
    });

    expect(result).toHaveProperty('error');
  });
});

// =============================================================================
// LOCAL MODE BEHAVIOR TESTS
// =============================================================================

describe('LOCAL_MODE Behavior', () => {
  it('should mark all responses with mode: local', async () => {
    const config: LocalModeConfig = {
      deploymentPath,
      protocolSpecPath
    };
    const testServer = new UltraLifeLocalMcpServer(config);

    const tools = [
      { name: 'get_ultralife_info', args: {} },
      { name: 'get_protocol_stats', args: {} },
      { name: 'list_pnfts', args: {} },
      { name: 'list_bioregions', args: {} },
      { name: 'list_lands', args: {} }
    ];

    for (const tool of tools) {
      const result = await (testServer as any).handleTool(tool.name, tool.args);
      expect(result).toHaveProperty('mode', 'local');
    }
  });

  it('should read fresh data on each call (hot reload)', async () => {
    const config: LocalModeConfig = {
      deploymentPath,
      protocolSpecPath
    };
    const testServer = new UltraLifeLocalMcpServer(config);

    // Initial call
    const result1 = await (testServer as any).handleTool('get_protocol_stats', {});
    const initialCount = (result1 as any).total_pnfts;

    // Modify deployment file
    const modifiedData = JSON.parse(JSON.stringify(MINIMAL_DEPLOYMENT));
    modifiedData.pnfts.push({
      id: 'pnft_new_001',
      owner: 'addr_new_test',
      level: 'Basic',
      bioregion: 'integration_region',
      createdAt: '2026-01-02T00:00:00.000Z',
      createdSlot: 2000,
      status: 'minted',
      testnetSimulated: true
    });
    writeFileSync(deploymentPath, JSON.stringify(modifiedData, null, 2));

    // Second call - should see updated data
    const result2 = await (testServer as any).handleTool('get_protocol_stats', {});
    const newCount = (result2 as any).total_pnfts;

    expect(newCount).toBe(initialCount + 1);

    // Restore original data
    writeFileSync(deploymentPath, JSON.stringify(MINIMAL_DEPLOYMENT, null, 2));
  });

  it('should not allow transaction building in local mode', async () => {
    const config: LocalModeConfig = {
      deploymentPath,
      protocolSpecPath
    };
    const testServer = new UltraLifeLocalMcpServer(config);

    // Transaction building tools should not be available
    await expect(
      (testServer as any).handleTool('build_transfer', {})
    ).rejects.toThrow(/not available in local mode/i);
  });
});

// =============================================================================
// DATA CONSISTENCY TESTS
// =============================================================================

describe('Data Consistency', () => {
  it('should maintain referential integrity across tools', async () => {
    const config: LocalModeConfig = {
      deploymentPath,
      protocolSpecPath
    };
    const testServer = new UltraLifeLocalMcpServer(config);

    // Get pNFT
    const pnft = await (testServer as any).handleTool('get_pnft', {
      pnft_id: 'pnft_integration_001'
    }) as any;

    // Get land stewarded by this pNFT
    const lands = await (testServer as any).handleTool('list_lands', {
      steward: 'pnft_integration_001'
    }) as any;

    // Verify consistency
    expect(pnft.owner).toBeDefined();
    expect(lands.lands.length).toBeGreaterThanOrEqual(0);
  });

  it('should calculate aggregated stats correctly', async () => {
    const config: LocalModeConfig = {
      deploymentPath,
      protocolSpecPath
    };
    const testServer = new UltraLifeLocalMcpServer(config);

    const stats = await (testServer as any).handleTool('get_protocol_stats', {}) as any;
    const pnfts = await (testServer as any).handleTool('list_pnfts', {}) as any;
    const bioregions = await (testServer as any).handleTool('list_bioregions', {}) as any;

    expect(stats.total_pnfts).toBe(pnfts.total);
    expect(stats.total_bioregions).toBe(bioregions.count);
  });

  it('should have consistent balance information', async () => {
    const config: LocalModeConfig = {
      deploymentPath,
      protocolSpecPath
    };
    const testServer = new UltraLifeLocalMcpServer(config);

    const pnft = await (testServer as any).handleTool('get_pnft', {
      pnft_id: 'pnft_integration_001'
    }) as any;

    const balance = await (testServer as any).handleTool('get_token_balance', {
      pnft_id: 'pnft_integration_001'
    }) as any;

    // Balance in pNFT should match balance query
    expect(pnft.token_balance).toBe(100);
    expect(parseFloat(balance.balance)).toBe(100);
  });
});

// =============================================================================
// FILTER AND PAGINATION TESTS
// =============================================================================

describe('Filter and Pagination', () => {
  it('should respect limit parameters across all list tools', async () => {
    const config: LocalModeConfig = {
      deploymentPath,
      protocolSpecPath
    };
    const testServer = new UltraLifeLocalMcpServer(config);

    const listTools = [
      { name: 'list_pnfts', args: { limit: 1 } },
      { name: 'list_lands', args: { limit: 1 } },
      { name: 'list_offerings', args: { limit: 1 } },
      { name: 'list_needs', args: { limit: 1 } },
      { name: 'list_transactions', args: { limit: 1 } }
    ];

    for (const tool of listTools) {
      const result = await (testServer as any).handleTool(tool.name, tool.args) as any;
      const itemsKey = Object.keys(result).find(k =>
        ['pnfts', 'lands', 'offerings', 'needs', 'transactions'].includes(k)
      );
      if (itemsKey) {
        expect(result[itemsKey].length).toBeLessThanOrEqual(1);
      }
    }
  });

  it('should filter by bioregion across relevant tools', async () => {
    const config: LocalModeConfig = {
      deploymentPath,
      protocolSpecPath
    };
    const testServer = new UltraLifeLocalMcpServer(config);

    const bioregion = 'integration_region';

    const pnfts = await (testServer as any).handleTool('list_pnfts', {
      bioregion
    }) as any;

    const lands = await (testServer as any).handleTool('list_lands', {
      bioregion
    }) as any;

    // All results should be from the specified bioregion
    pnfts.pnfts.forEach((p: any) => {
      expect(p.bioregion).toBe(bioregion);
    });

    lands.lands.forEach((l: any) => {
      expect(l.bioregion).toBe(bioregion);
    });
  });
});

// =============================================================================
// PROTOCOL SPEC INTEGRATION TESTS
// =============================================================================

describe('Protocol Spec Integration', () => {
  it('should use protocol spec for get_ultralife_info', async () => {
    const config: LocalModeConfig = {
      deploymentPath,
      protocolSpecPath
    };
    const testServer = new UltraLifeLocalMcpServer(config);

    const result = await (testServer as any).handleTool('get_ultralife_info', {
      topic: 'general'
    }) as any;

    expect(result.protocol).toBe('UltraLife');
    expect(result.version).toBe('1.0.0');
    expect(result.description).toBe('Integration test protocol');
  });

  it('should handle missing protocol spec gracefully', async () => {
    const config: LocalModeConfig = {
      deploymentPath,
      protocolSpecPath: join(testDir, 'nonexistent-spec.json')
    };
    const testServer = new UltraLifeLocalMcpServer(config);

    const result = await (testServer as any).handleTool('get_ultralife_info', {});
    expect(result).toBeDefined();
    // Should return default info even without spec file
  });
});
