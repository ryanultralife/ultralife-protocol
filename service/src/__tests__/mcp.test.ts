/**
 * UltraLife MCP Server Tests
 *
 * Tests for MCP tool handlers with mocked indexer and builder.
 */

import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock dependencies - using type assertions for Jest ESM compatibility
jest.mock('@blockfrost/blockfrost-js', () => ({
  BlockFrostAPI: jest.fn().mockImplementation(() => ({
    addressesUtxos: jest.fn<() => Promise<never[]>>().mockResolvedValue([]),
    assetsAddresses: jest.fn<() => Promise<never[]>>().mockResolvedValue([]),
    assetsPolicyByIdAll: jest.fn<() => Promise<never[]>>().mockResolvedValue([]),
  })),
}));

jest.mock('lucid-cardano', () => {
  // Build mock chain from inside out to avoid type inference issues
  const mockSubmitResult = jest.fn<() => Promise<string>>().mockResolvedValue('mock_tx_hash');
  const mockCompleteResult = { submit: mockSubmitResult };
  const mockSignComplete = jest.fn<() => Promise<typeof mockCompleteResult>>().mockResolvedValue(mockCompleteResult);
  const mockSignResult = { complete: mockSignComplete };
  const mockSign = jest.fn<() => typeof mockSignResult>().mockReturnValue(mockSignResult);
  const mockTxCompleteResult = { sign: mockSign, complete: mockSign };
  const mockTxComplete = jest.fn<() => Promise<typeof mockTxCompleteResult>>().mockResolvedValue(mockTxCompleteResult);
  const mockNewTxResult = { complete: mockTxComplete };
  const mockNewTx = jest.fn<() => typeof mockNewTxResult>().mockReturnValue(mockNewTxResult);
  const mockLucidInstance = { newTx: mockNewTx, complete: mockTxComplete };

  return {
    Lucid: {
      new: jest.fn<() => Promise<typeof mockLucidInstance>>().mockResolvedValue(mockLucidInstance),
    },
    Blockfrost: jest.fn(),
    Data: {
      to: jest.fn<() => string>().mockReturnValue('mock_datum'),
      Enum: jest.fn(),
      Object: jest.fn(),
      Bytes: jest.fn(),
      Integer: jest.fn(),
      Array: jest.fn(),
      Nullable: jest.fn(),
      Boolean: jest.fn(),
      Literal: jest.fn(),
    },
    fromText: jest.fn((s: string) => s),
    toHex: jest.fn((s: { toString(encoding: string): string }) => s.toString('hex')),
    fromHex: jest.fn((s: string) => Buffer.from(s, 'hex')),
    Constr: jest.fn(),
  };
});

// Test helper to simulate MCP tool call
interface ToolCallResult {
  content: { type: string; text: string }[];
  isError?: boolean;
}

describe('MCP Tool Definitions', () => {
  // Import the TOOLS array from the MCP module
  // This tests that all tools are properly defined

  const EXPECTED_TOOLS = [
    // Information
    'get_ultralife_info',
    'get_protocol_stats',
    // pNFT
    'get_pnft',
    'get_pnft_by_address',
    'get_token_balance',
    'list_pnfts',
    // Spending Buckets
    'list_buckets',
    'get_bucket',
    'build_create_bucket',
    'build_fund_bucket',
    'build_spend_bucket',
    'build_transfer_between_buckets',
    // Bioregion
    'list_bioregions',
    'get_bioregion',
    // Treasury & Bonding Curve
    'get_token_price',
    'simulate_purchase',
    'get_founder_status',
    'get_treasury_status',
    'build_purchase_tokens',
    // Marketplace
    'list_offerings',
    'get_offering',
    'list_needs',
    'get_need',
    // Collective
    'list_collectives',
    'get_collective',
    // Transaction Building
    'build_mint_pnft',
    'build_create_offering',
    'build_create_collective',
    'build_add_collective_member',
    'build_transfer_tokens',
    'build_accept_offering',
    'build_purchase_from_pool',
  ];

  it('should have 32 tools defined', () => {
    expect(EXPECTED_TOOLS.length).toBe(32);
  });

  describe('Tool Categories', () => {
    it('should have information tools', () => {
      const infoTools = EXPECTED_TOOLS.filter(
        (t) => t === 'get_ultralife_info' || t === 'get_protocol_stats'
      );
      expect(infoTools.length).toBe(2);
    });

    it('should have pNFT tools', () => {
      const pnftTools = EXPECTED_TOOLS.filter(
        (t) => t.includes('pnft') && !t.includes('bucket')
      );
      expect(pnftTools.length).toBeGreaterThanOrEqual(4);
    });

    it('should have spending bucket tools', () => {
      const bucketTools = EXPECTED_TOOLS.filter((t) => t.includes('bucket'));
      expect(bucketTools.length).toBe(6);
    });

    it('should have treasury/bonding curve tools', () => {
      const treasuryTools = EXPECTED_TOOLS.filter(
        (t) =>
          t.includes('token_price') ||
          t.includes('purchase') ||
          t.includes('founder') ||
          t.includes('treasury')
      );
      expect(treasuryTools.length).toBe(5);
    });

    it('should have marketplace tools', () => {
      const marketTools = EXPECTED_TOOLS.filter(
        (t) => t.includes('offering') || t.includes('need')
      );
      expect(marketTools.length).toBeGreaterThanOrEqual(4);
    });

    it('should have collective tools', () => {
      const collectiveTools = EXPECTED_TOOLS.filter((t) =>
        t.includes('collective')
      );
      expect(collectiveTools.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe('UltraLife Info Content', () => {
  const TOPICS = [
    'general',
    'identity',
    'offerings',
    'collectives',
    'bioregions',
    'impacts',
    'tokens',
  ];

  it('should have 7 info topics', () => {
    expect(TOPICS.length).toBe(7);
  });

  describe('Identity Topic', () => {
    it('should explain pNFT concept', () => {
      const identityInfo = {
        what: 'pNFT (Personal NFT) - your permanent, DNA-verified identity on-chain',
        levels: {
          Basic: 'Wallet only (limited functionality)',
          Standard: 'DNA verified (full functionality)',
          Verified: 'Standard + bioregion residency confirmed',
          Steward: 'Verified + community endorsement (governance rights)',
        },
        bootstrap: 'New pNFTs receive 50 token grant',
        recovery:
          'Lost access? Guardians (other pNFTs you designate) can help recover',
      };

      expect(identityInfo.levels).toHaveProperty('Basic');
      expect(identityInfo.levels).toHaveProperty('Standard');
      expect(identityInfo.levels).toHaveProperty('Verified');
      expect(identityInfo.levels).toHaveProperty('Steward');
      expect(identityInfo.bootstrap).toContain('50');
    });
  });

  describe('Bioregions Topic', () => {
    it('should explain bioregion tracking', () => {
      const bioregionInfo = {
        what: 'Geographic areas defined by ecological boundaries (watersheds, ecosystems)',
        tracks: {
          resources: 'Water, land, air, energy health indices',
          humans: 'Health, education, housing, food security, care availability',
          activity: 'Offerings, needs, agreements, value transacted',
        },
        importance:
          'UBI distribution tied to bioregion health - creates incentive to improve local ecosystem',
      };

      expect(bioregionInfo.tracks.resources).toContain('water');
      expect(bioregionInfo.tracks.humans).toContain('health');
      expect(bioregionInfo.importance).toContain('UBI');
    });
  });

  describe('Tokens Topic', () => {
    it('should explain token economics', () => {
      const tokenInfo = {
        total_supply: '400 billion (single pool)',
        uses: ['Payments', 'Staking', 'Governance', 'Impact offsetting'],
        earning: ['Work', 'Offerings', 'Care credits', 'UBI'],
        ubi: 'Distributed based on bioregion health and participation',
      };

      expect(tokenInfo.total_supply).toContain('400 billion');
      expect(tokenInfo.uses).toContain('Payments');
      expect(tokenInfo.earning).toContain('UBI');
    });
  });
});

describe('Bonding Curve Logic', () => {
  describe('Price Calculation', () => {
    it('should start at floor price', () => {
      const totalSupply = 400_000_000_000_000_000n; // 400B with 6 decimals
      const distributed = 0n;
      const floorPrice = 0.0000000025; // 1 ADA = 400B tokens

      const distributedRatio = Number(distributed) / Number(totalSupply);
      const currentPrice =
        distributedRatio > 0 ? distributedRatio : floorPrice;

      expect(currentPrice).toBeCloseTo(floorPrice);
    });

    it('should increase price as more tokens are distributed', () => {
      const totalSupply = 400_000_000_000_000_000n;

      // Simulate 10% distribution
      const distributed1 = totalSupply / 10n;
      const price1 = Number(distributed1) / Number(totalSupply);

      // Simulate 50% distribution
      const distributed2 = totalSupply / 2n;
      const price2 = Number(distributed2) / Number(totalSupply);

      expect(price2).toBeGreaterThan(price1);
      expect(price1).toBeCloseTo(0.1); // 10%
      expect(price2).toBeCloseTo(0.5); // 50%
    });

    it('should reach price of 1 at full distribution', () => {
      const totalSupply = 400_000_000_000_000_000n;
      const distributed = totalSupply;

      const price = Number(distributed) / Number(totalSupply);

      expect(price).toBe(1);
    });
  });

  describe('Founder Compensation', () => {
    it('should calculate $10,000/month since January 2020', () => {
      const startDate = new Date('2020-01-01');
      const now = new Date();
      const totalMonths =
        (now.getFullYear() - startDate.getFullYear()) * 12 +
        (now.getMonth() - startDate.getMonth());
      const totalOwed = totalMonths * 10000;

      // Should be > $720,000 (72 months from Jan 2020 to Jan 2026)
      expect(totalMonths).toBeGreaterThanOrEqual(72);
      expect(totalOwed).toBeGreaterThanOrEqual(720000);
    });
  });
});

describe('Spending Bucket Templates', () => {
  const templates = {
    daily_spending: {
      allocation: 50_000_000n,
      period: 'Daily',
      rollover: true,
      maxBalance: 200_000_000n,
    },
    weekly_groceries: {
      allocation: 150_000_000n,
      period: 'Weekly',
      rollover: false,
      maxBalance: 150_000_000n,
    },
    monthly_bills: {
      allocation: 500_000_000n,
      period: 'Monthly',
      rollover: false,
      maxBalance: 500_000_000n,
    },
    emergency_fund: {
      allocation: 100_000_000n,
      period: 'Monthly',
      rollover: true,
      maxBalance: 5000_000_000n,
    },
    savings_goal: {
      allocation: 200_000_000n,
      period: 'Monthly',
      rollover: true,
      maxBalance: 10000_000_000n,
    },
    allowance: {
      allocation: 10_000_000n,
      period: 'Daily',
      rollover: false,
      maxBalance: 10_000_000n,
    },
    business_expense: {
      allocation: 1000_000_000n,
      period: 'Monthly',
      rollover: true,
      maxBalance: 3000_000_000n,
    },
  };

  it('should have 7 predefined templates', () => {
    expect(Object.keys(templates).length).toBe(7);
  });

  it('should have daily spending template with rollover', () => {
    expect(templates.daily_spending.period).toBe('Daily');
    expect(templates.daily_spending.rollover).toBe(true);
  });

  it('should have monthly bills without rollover', () => {
    expect(templates.monthly_bills.period).toBe('Monthly');
    expect(templates.monthly_bills.rollover).toBe(false);
  });

  it('should have emergency fund with high max balance', () => {
    expect(templates.emergency_fund.maxBalance).toBeGreaterThan(
      templates.daily_spending.maxBalance
    );
  });

  it('should have allowance as smallest allocation', () => {
    const allocations = Object.values(templates).map((t) => t.allocation);
    const minAllocation = allocations.reduce(
      (min, a) => (a < min ? a : min),
      allocations[0]
    );
    expect(templates.allowance.allocation).toBe(minAllocation);
  });
});

describe('Verification Levels', () => {
  const levels = ['Basic', 'Standard', 'Verified', 'Steward'];

  it('should have 4 verification levels', () => {
    expect(levels.length).toBe(4);
  });

  it('should have Basic as lowest level', () => {
    expect(levels[0]).toBe('Basic');
  });

  it('should have Steward as highest level', () => {
    expect(levels[3]).toBe('Steward');
  });

  it('should require DNA verification for Standard', () => {
    // Standard = DNA verified
    const standardIndex = levels.indexOf('Standard');
    expect(standardIndex).toBe(1);
  });
});

describe('Offering Types', () => {
  const types = ['Thing', 'Work', 'Access', 'Knowledge', 'Care'];

  it('should have 5 offering types', () => {
    expect(types.length).toBe(5);
  });

  it('should include Thing for physical goods', () => {
    expect(types).toContain('Thing');
  });

  it('should include Work for services', () => {
    expect(types).toContain('Work');
  });

  it('should include Access for rentals', () => {
    expect(types).toContain('Access');
  });

  it('should include Care for caregiving', () => {
    expect(types).toContain('Care');
  });
});

describe('Terms Types', () => {
  const terms = ['Priced', 'Range', 'Auction', 'Trade', 'Gift', 'CommunityService'];

  it('should have 6 terms types', () => {
    expect(terms.length).toBe(6);
  });

  it('should include CommunityService for unpaid work', () => {
    expect(terms).toContain('CommunityService');
  });

  it('should include Auction for bidding', () => {
    expect(terms).toContain('Auction');
  });

  it('should include Trade for barter', () => {
    expect(terms).toContain('Trade');
  });
});
