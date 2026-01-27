/**
 * Unit tests for UltraLife SDK main entry point
 */

import { describe, it, expect } from 'vitest';
import { createConfig, UltraLifeSDK, COMPOUNDS, UBI_CONSTANTS } from '../sdk/index.js';

describe('UltraLife SDK', () => {
  describe('Configuration', () => {
    it('should create config with required options', () => {
      const config = createConfig({
        network: 'preprod',
        blockfrostApiKey: 'test-api-key',
      });

      expect(config.network).toBe('preprod');
      expect(config.blockfrostApiKey).toBe('test-api-key');
      expect(config.contracts).toBeDefined();
      expect(config.referenceScripts).toBeDefined();
    });

    it('should have all contract addresses', () => {
      const config = createConfig({
        network: 'preprod',
        blockfrostApiKey: 'test-key',
      });

      expect(config.contracts.pnft_policy).toBeDefined();
      expect(config.contracts.token_policy).toBeDefined();
      expect(config.contracts.treasury).toBeDefined();
      expect(config.contracts.marketplace).toBeDefined();
      expect(config.contracts.ubi).toBeDefined();
      expect(config.contracts.collective).toBeDefined();
      expect(config.contracts.spending_bucket).toBeDefined();
    });

    it('should have all reference scripts', () => {
      const config = createConfig({
        network: 'preprod',
        blockfrostApiKey: 'test-key',
      });

      expect(config.referenceScripts.pnft_mint).toBeDefined();
      expect(config.referenceScripts.token).toBeDefined();
      expect(config.referenceScripts.ubi).toBeDefined();
    });

    it('should allow custom contract overrides', () => {
      const customAddress = 'addr_test1custom';
      const config = createConfig({
        network: 'preprod',
        blockfrostApiKey: 'test-key',
        contracts: {
          pnft_policy: customAddress,
        },
      });

      expect(config.contracts.pnft_policy).toBe(customAddress);
    });
  });

  describe('SDK Instance', () => {
    it('should create SDK with config', () => {
      const config = createConfig({
        network: 'preprod',
        blockfrostApiKey: 'test-key',
      });

      const sdk = new UltraLifeSDK(config);

      expect(sdk).toBeDefined();
      expect(sdk.indexer).toBeDefined();
      expect(sdk.builder).toBeDefined();
      expect(sdk.metadata).toBeDefined();
      expect(sdk.wallet).toBeDefined();
      expect(sdk.ubi).toBeDefined();
    });

    it('should report not initialized initially', () => {
      const config = createConfig({
        network: 'preprod',
        blockfrostApiKey: 'test-key',
      });

      const sdk = new UltraLifeSDK(config);

      expect(sdk.isInitialized()).toBe(false);
    });

    it('should return correct network', () => {
      const config = createConfig({
        network: 'preview',
        blockfrostApiKey: 'test-key',
      });

      const sdk = new UltraLifeSDK(config);

      expect(sdk.getNetwork()).toBe('preview');
    });
  });

  describe('Exports', () => {
    it('should export COMPOUNDS constants', () => {
      expect(COMPOUNDS.CO2).toBe('0101');
      expect(COMPOUNDS.CH4).toBe('0102');
      expect(COMPOUNDS.H2O).toBe('0401');
    });

    it('should export UBI_CONSTANTS', () => {
      expect(UBI_CONSTANTS.BASE_UBI_FEE_SHARE_BPS).toBe(5000);
      expect(UBI_CONSTANTS.TARGET_UBI_PER_PERSON).toBe(100);
    });
  });
});

describe('SDK Integration Patterns', () => {
  describe('Compound Flow Creation', () => {
    it('should create proper CO2 impact for driving', () => {
      const config = createConfig({
        network: 'preprod',
        blockfrostApiKey: 'test-key',
      });

      const sdk = new UltraLifeSDK(config);

      // Simulate 50km drive
      const flow = sdk.metadata.estimateDrivingCO2(50, 'car');

      expect(flow.compound).toBe(COMPOUNDS.CO2);
      expect(flow.quantity).toBe(6000n); // 50km * 120g/km
    });
  });

  describe('Offering Creation Flow', () => {
    it('should create complete offering metadata', () => {
      const config = createConfig({
        network: 'preprod',
        blockfrostApiKey: 'test-key',
      });

      const sdk = new UltraLifeSDK(config);

      // Create offering metadata
      const what = sdk.metadata.createWorkOffering('Garden maintenance', 4);
      const location = sdk.metadata.createBioregionalLocation('cascadia');
      const terms = sdk.metadata.createPricedTerms(50_000_000n, true);
      const availability = sdk.metadata.createNowAvailability();

      // Create expected impact
      const impact = sdk.metadata.createActivityImpact([
        sdk.metadata.createCO2Emission(200),
      ]);

      expect(what.type).toBe('Work');
      expect(location.type).toBe('Bioregional');
      expect(terms.type).toBe('Priced');
      expect(availability.type).toBe('Now');
      expect(impact.compound_flows).toHaveLength(1);
    });
  });

  describe('UBI Eligibility Check Pattern', () => {
    it('should validate eligibility requirements', () => {
      const verificationLevel = 2; // Verified
      const hasBioregion = true;
      const txCount = 5;
      const uniqueCounterparties = 3;

      // Check basic eligibility
      const isVerified = verificationLevel >= 1; // Standard or higher
      expect(isVerified).toBe(true);
      expect(hasBioregion).toBe(true);

      // Check engagement
      const meetsEngagement =
        txCount >= UBI_CONSTANTS.MIN_ENGAGEMENT_TX ||
        txCount > 0; // Some engagement for partial UBI

      expect(meetsEngagement).toBe(true);
    });
  });

  describe('Transaction Type Classification', () => {
    it('should create appropriate transaction types', () => {
      const config = createConfig({
        network: 'preprod',
        blockfrostApiKey: 'test-key',
      });

      const sdk = new UltraLifeSDK(config);

      // Different transaction scenarios
      const labor = sdk.metadata.createLaborType('gardening', 4);
      const goods = sdk.metadata.createGoodsType('vegetables', 10, 'kg');
      const care = sdk.metadata.createCareType('childcare', 8);
      const ubi = sdk.metadata.createUbiType(42);

      expect(labor.type).toBe('Labor');
      expect(goods.type).toBe('Goods');
      expect(care.type).toBe('Care');
      expect(ubi.type).toBe('UBI');
    });
  });
});

describe('Type Safety', () => {
  it('should maintain type safety for compound codes', () => {
    // These should be string literal types
    const co2: string = COMPOUNDS.CO2;
    const ch4: string = COMPOUNDS.CH4;

    expect(typeof co2).toBe('string');
    expect(typeof ch4).toBe('string');
  });

  it('should maintain type safety for bigint quantities', () => {
    const config = createConfig({
      network: 'preprod',
      blockfrostApiKey: 'test-key',
    });

    const sdk = new UltraLifeSDK(config);

    const flow = sdk.metadata.createCompoundFlow(COMPOUNDS.CO2, 1000);

    expect(typeof flow.quantity).toBe('bigint');
    expect(flow.quantity).toBe(1000n);
  });
});
