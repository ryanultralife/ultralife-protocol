/**
 * Unit tests for WalletHelpers
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { WalletHelpers } from '../sdk/wallet.js';

describe('WalletHelpers', () => {
  let helpers: WalletHelpers;

  beforeEach(() => {
    helpers = new WalletHelpers('preprod');
  });

  describe('Address Utilities', () => {
    it('should validate mainnet addresses', () => {
      const mainnetHelpers = new WalletHelpers('mainnet');

      expect(mainnetHelpers.validateAddress('addr1qx...')).toBe(true);
      expect(mainnetHelpers.validateAddress('addr_test1...')).toBe(false);
      expect(mainnetHelpers.validateAddress('')).toBe(false);
    });

    it('should validate testnet addresses', () => {
      expect(helpers.validateAddress('addr_test1qpu...')).toBe(true);
      expect(helpers.validateAddress('addr1...')).toBe(false);
      expect(helpers.validateAddress('')).toBe(false);
    });

    it('should format address for display', () => {
      const address = 'addr_test1qpu5vlrf4xkxv2qpwngf6cjhtw542ayty80v8dyr49rf5e...'

      const formatted = helpers.formatAddress(address, 12, 8);

      expect(formatted).toContain('...');
      expect(formatted.length).toBeLessThan(address.length);
    });

    it('should not truncate short addresses', () => {
      const short = 'addr_test1';

      expect(helpers.formatAddress(short)).toBe(short);
    });
  });

  describe('Asset Utilities', () => {
    it('should parse lovelace unit', () => {
      const { policyId, assetName } = helpers.parseUnit('lovelace');

      expect(policyId).toBe('');
      expect(assetName).toBe('');
    });

    it('should parse token unit', () => {
      const policyId = 'a'.repeat(56);
      const assetName = '554c545241';
      const unit = policyId + assetName;

      const parsed = helpers.parseUnit(unit);

      expect(parsed.policyId).toBe(policyId);
      expect(parsed.assetName).toBe(assetName);
    });

    it('should create unit from policy and name', () => {
      const policyId = 'b'.repeat(56);
      const assetName = '746f6b656e';

      const unit = helpers.createUnit(policyId, assetName);

      expect(unit).toBe(policyId + assetName);
    });

    it('should return lovelace for empty policy', () => {
      expect(helpers.createUnit('', '')).toBe('lovelace');
    });

    it('should decode asset name from hex', () => {
      const hex = '554c545241'; // "ULTRA" in hex

      const decoded = helpers.decodeAssetName(hex);

      expect(decoded).toBe('ULTRA');
    });

    it('should encode asset name to hex', () => {
      const name = 'ULTRA';

      const encoded = helpers.encodeAssetName(name);

      expect(encoded).toBe('554c545241');
    });
  });

  describe('Amount Formatting', () => {
    it('should format token amount with decimals', () => {
      expect(helpers.formatTokenAmount(1_000_000n, 6)).toBe('1');
      expect(helpers.formatTokenAmount(1_500_000n, 6)).toBe('1.5');
      expect(helpers.formatTokenAmount(1_234_567n, 6)).toBe('1.234567');
      expect(helpers.formatTokenAmount(100n, 6)).toBe('0.0001');
    });

    it('should parse token amount from string', () => {
      expect(helpers.parseTokenAmount('1', 6)).toBe(1_000_000n);
      expect(helpers.parseTokenAmount('1.5', 6)).toBe(1_500_000n);
      expect(helpers.parseTokenAmount('0.123456', 6)).toBe(123_456n);
    });
  });

  describe('ADA Conversion', () => {
    it('should convert lovelace to ADA', () => {
      expect(helpers.lovelaceToAda(1_000_000n)).toBe(1);
      expect(helpers.lovelaceToAda(1_500_000n)).toBe(1.5);
      expect(helpers.lovelaceToAda(100_000n)).toBe(0.1);
    });

    it('should convert ADA to lovelace', () => {
      expect(helpers.adaToLovelace(1)).toBe(1_000_000n);
      expect(helpers.adaToLovelace(1.5)).toBe(1_500_000n);
      expect(helpers.adaToLovelace(0.1)).toBe(100_000n);
    });

    it('should format lovelace as ADA string', () => {
      expect(helpers.formatAda(1_000_000n)).toBe('1.000000 ADA');
      expect(helpers.formatAda(1_234_567n)).toBe('1.234567 ADA');
    });
  });

  describe('Utility Functions', () => {
    it('should generate random hex', () => {
      const hex1 = helpers.randomHex(32);
      const hex2 = helpers.randomHex(32);

      expect(hex1).toHaveLength(64);
      expect(hex2).toHaveLength(64);
      expect(hex1).not.toBe(hex2); // Should be different
    });

    it('should get current epoch (approximate)', () => {
      const epoch = helpers.getCurrentEpoch();

      expect(epoch).toBeGreaterThan(0);
      expect(typeof epoch).toBe('number');
    });

    it('should get current slot (approximate)', () => {
      const slot = helpers.getCurrentSlot();

      expect(slot).toBeGreaterThan(0);
      expect(typeof slot).toBe('number');
    });
  });

  describe('Connection State', () => {
    it('should report not connected initially', () => {
      expect(helpers.isConnected()).toBe(false);
    });
  });
});
