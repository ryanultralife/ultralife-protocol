/**
 * Unit tests for MetadataBuilder
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MetadataBuilder, COMPOUNDS, UNITS, MEASUREMENT_METHODS } from '../sdk/metadata.js';

describe('MetadataBuilder', () => {
  let builder: MetadataBuilder;

  beforeEach(() => {
    builder = new MetadataBuilder();
  });

  describe('Compound Flows', () => {
    it('should create a basic compound flow', () => {
      const flow = builder.createCompoundFlow(COMPOUNDS.CO2, 1000, UNITS.GRAMS);

      expect(flow.compound).toBe(COMPOUNDS.CO2);
      expect(flow.quantity).toBe(1000n);
      expect(flow.unit).toBe(UNITS.GRAMS);
      expect(flow.measurement).toBe(MEASUREMENT_METHODS.ESTIMATED);
      expect(flow.confidence).toBe(80);
    });

    it('should create CO2 emission flow', () => {
      const flow = builder.createCO2Emission(500);

      expect(flow.compound).toBe(COMPOUNDS.CO2);
      expect(flow.quantity).toBe(500n);
      expect(flow.unit).toBe(UNITS.GRAMS);
    });

    it('should create CO2 sequestration flow with negative quantity', () => {
      const flow = builder.createCO2Sequestration(1000);

      expect(flow.compound).toBe(COMPOUNDS.CO2);
      expect(flow.quantity).toBe(-1000n);
    });

    it('should clamp confidence to 0-100 range', () => {
      const flowHigh = builder.createCompoundFlow(COMPOUNDS.CO2, 100, UNITS.GRAMS, MEASUREMENT_METHODS.DIRECT, 150);
      const flowLow = builder.createCompoundFlow(COMPOUNDS.CO2, 100, UNITS.GRAMS, MEASUREMENT_METHODS.DIRECT, -10);

      expect(flowHigh.confidence).toBe(100);
      expect(flowLow.confidence).toBe(0);
    });

    it('should create methane emission', () => {
      const flow = builder.createMethaneEmission(50);

      expect(flow.compound).toBe(COMPOUNDS.CH4);
      expect(flow.quantity).toBe(50n);
    });

    it('should create water usage flow', () => {
      const flow = builder.createWaterUsage(100);

      expect(flow.compound).toBe(COMPOUNDS.H2O);
      expect(flow.quantity).toBe(100n);
      expect(flow.unit).toBe(UNITS.LITERS);
    });
  });

  describe('Activity Impact', () => {
    it('should create activity impact from flows', () => {
      const flows = [
        builder.createCO2Emission(100),
        builder.createWaterUsage(50),
      ];

      const impact = builder.createActivityImpact(flows);

      expect(impact.compound_flows).toHaveLength(2);
      expect(impact.evidence_hash).toBeDefined();
      expect(impact.attestors).toEqual([]);
    });

    it('should throw error for empty flows', () => {
      expect(() => builder.createActivityImpact([])).toThrow('at least one compound flow');
    });

    it('should include evidence hash and attestors', () => {
      const flows = [builder.createCO2Emission(100)];
      const impact = builder.createActivityImpact(flows, 'evidence123', ['pnft1', 'pnft2']);

      expect(impact.evidence_hash).toBe('evidence123');
      expect(impact.attestors).toEqual(['pnft1', 'pnft2']);
    });
  });

  describe('Categories', () => {
    it('should create registry category', () => {
      const cat = builder.createRegistryCategory('0301');

      expect(cat.type).toBe('Registry');
      expect(cat.code).toBe('0301');
    });

    it('should create custom category with hash', () => {
      const cat = builder.createCustomCategory('Fresh organic vegetables');

      expect(cat.type).toBe('Custom');
      expect(cat.description_hash).toBeDefined();
      expect(cat.description_hash).toHaveLength(64);
    });
  });

  describe('Offerings', () => {
    it('should create Thing offering', () => {
      const offer = builder.createThingOffering('Handmade pottery', 5, 'pieces');

      expect(offer.type).toBe('Thing');
      expect(offer.description_hash).toBeDefined();
      expect(offer.quantity).toBe(5);
      expect(offer.unit).toBe('pieces');
    });

    it('should create Work offering', () => {
      const offer = builder.createWorkOffering('Garden maintenance', 4);

      expect(offer.type).toBe('Work');
      expect(offer.duration).toBe(4);
    });

    it('should create Access offering', () => {
      const offer = builder.createAccessOffering('asset123', 'rental', 7);

      expect(offer.type).toBe('Access');
      expect(offer.asset_id).toBe('asset123');
      expect(offer.access_type).toBe('rental');
      expect(offer.duration).toBe(7);
    });

    it('should create Knowledge offering', () => {
      const offer = builder.createKnowledgeOffering('Sustainable farming techniques');

      expect(offer.type).toBe('Knowledge');
    });

    it('should create Care offering', () => {
      const offer = builder.createCareOffering('Elder care support', 8);

      expect(offer.type).toBe('Care');
      expect(offer.duration).toBe(8);
    });
  });

  describe('Locations', () => {
    it('should create specific location', () => {
      const loc = builder.createSpecificLocation('bioregion1', 'locationHash');

      expect(loc.type).toBe('Specific');
      expect((loc as any).bioregion).toBe('bioregion1');
    });

    it('should create bioregional location', () => {
      const loc = builder.createBioregionalLocation('bioregion2');

      expect(loc.type).toBe('Bioregional');
    });

    it('should create mobile location', () => {
      const loc = builder.createMobileLocation(['region1', 'region2']);

      expect(loc.type).toBe('Mobile');
      expect((loc as any).range).toEqual(['region1', 'region2']);
    });

    it('should create remote location', () => {
      const loc = builder.createRemoteLocation();

      expect(loc.type).toBe('Remote');
    });

    it('should create anywhere location', () => {
      const loc = builder.createAnywhereLocation();

      expect(loc.type).toBe('Anywhere');
    });
  });

  describe('Time Scopes', () => {
    it('should create now availability', () => {
      const time = builder.createNowAvailability();

      expect(time.type).toBe('Now');
    });

    it('should create scheduled availability', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');
      const time = builder.createScheduledAvailability(start, end);

      expect(time.type).toBe('Scheduled');
      expect((time as any).start).toBe(start.getTime());
      expect((time as any).end).toBe(end.getTime());
    });

    it('should create on-demand availability', () => {
      const time = builder.createOnDemandAvailability();

      expect(time.type).toBe('OnDemand');
    });
  });

  describe('Terms', () => {
    it('should create priced terms', () => {
      const terms = builder.createPricedTerms(100_000_000, false);

      expect(terms.type).toBe('Priced');
      expect((terms as any).amount).toBe(100_000_000n);
      expect((terms as any).negotiable).toBe(false);
    });

    it('should create range terms', () => {
      const terms = builder.createRangeTerms(50, 100);

      expect(terms.type).toBe('Range');
      expect((terms as any).min).toBe(50n);
      expect((terms as any).max).toBe(100n);
    });

    it('should create auction terms', () => {
      const terms = builder.createAuctionTerms(10, 50);

      expect(terms.type).toBe('Auction');
      expect((terms as any).starting).toBe(10n);
      expect((terms as any).reserve).toBe(50n);
    });

    it('should create gift terms', () => {
      const terms = builder.createGiftTerms('Local residents only');

      expect(terms.type).toBe('Gift');
      expect((terms as any).conditions).toBeDefined();
    });

    it('should create community service terms', () => {
      const terms = builder.createCommunityServiceTerms();

      expect(terms.type).toBe('CommunityService');
    });
  });

  describe('Requirements', () => {
    it('should create verification requirement', () => {
      const req = builder.createVerificationRequirement(2);

      expect(req.type).toBe('MinVerification');
      expect((req as any).level).toBe(2);
    });

    it('should create residency requirement', () => {
      const req = builder.createResidencyRequirement('bioregion1');

      expect(req.type).toBe('Residency');
      expect((req as any).bioregion).toBe('bioregion1');
    });
  });

  describe('Transaction Types', () => {
    it('should create labor type', () => {
      const tx = builder.createLaborType('gardening', 4);

      expect(tx.type).toBe('Labor');
      expect((tx as any).work_code).toBe('gardening');
      expect((tx as any).hours).toBe(4);
    });

    it('should create goods type', () => {
      const tx = builder.createGoodsType('vegetables', 10, 'kg');

      expect(tx.type).toBe('Goods');
      expect((tx as any).quantity).toBe(10n);
    });

    it('should create care type', () => {
      const tx = builder.createCareType('eldercare', 6);

      expect(tx.type).toBe('Care');
      expect((tx as any).hours).toBe(6);
    });

    it('should create UBI type', () => {
      const tx = builder.createUbiType(42);

      expect(tx.type).toBe('UBI');
      expect((tx as any).cycle).toBe(42);
    });
  });

  describe('Impact Estimation', () => {
    it('should estimate driving CO2', () => {
      const flow = builder.estimateDrivingCO2(100, 'car');

      expect(flow.compound).toBe(COMPOUNDS.CO2);
      expect(flow.quantity).toBe(12000n); // 100km * 120g/km
    });

    it('should estimate electricity CO2', () => {
      const flow = builder.estimateElectricityCO2(10, 'coal');

      expect(flow.compound).toBe(COMPOUNDS.CO2);
      expect(flow.quantity).toBe(9000n); // 10kWh * 900g/kWh
    });

    it('should estimate tree sequestration', () => {
      const flow = builder.estimateTreeSequestration(10, 1);

      expect(flow.compound).toBe(COMPOUNDS.CO2);
      expect(flow.quantity).toBe(-220000n); // 10 trees * 22kg/year (negative = sequestered)
    });

    it('should estimate food water footprint', () => {
      const flow = builder.estimateFoodWaterFootprint('beef', 1);

      expect(flow.compound).toBe(COMPOUNDS.H2O);
      expect(flow.quantity).toBe(15000n); // 1kg beef = 15000L water
    });
  });

  describe('Utility Functions', () => {
    it('should calculate net impact', () => {
      const flows = [
        builder.createCO2Emission(1000),
        builder.createCO2Sequestration(300),
      ];

      const net = builder.calculateNetImpact(flows);

      expect(net).toBe(700n); // 1000 - 300
    });

    it('should summarize by compound', () => {
      const flows = [
        builder.createCO2Emission(500),
        builder.createCO2Emission(300),
        builder.createWaterUsage(100),
      ];

      const summary = builder.summarizeByCompound(flows);

      expect(summary.get(COMPOUNDS.CO2)).toBe(800n);
      expect(summary.get(COMPOUNDS.H2O)).toBe(100n);
    });

    it('should format compound name', () => {
      expect(builder.formatCompoundName('0101')).toBe('CO2 (Carbon Dioxide)');
      expect(builder.formatCompoundName('0401')).toBe('H2O (Water)');
      expect(builder.formatCompoundName('9999')).toBe('Unknown (9999)');
    });

    it('should format quantity', () => {
      expect(builder.formatQuantity(500n, '01')).toBe('500 g');
      expect(builder.formatQuantity(1500n, '01')).toBe('1.50K g');
      expect(builder.formatQuantity(1500000n, '01')).toBe('1.50M g');
    });

    it('should generate consistent hashes', () => {
      const hash1 = builder.generateHash('test');
      const hash2 = builder.generateHash('test');
      const hash3 = builder.generateHash('different');

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(hash1).toHaveLength(64);
    });
  });
});
