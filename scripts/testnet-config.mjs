#!/usr/bin/env node
/**
 * UltraLife Protocol — Testnet Configuration
 *
 * Single source of truth for all validator parameters on testnet.
 * This ensures consistency across deployment, minting, and all protocol operations.
 *
 * For mainnet, create mainnet-config.mjs with production values.
 */

import {
  applyParamsToScript,
  applyCborEncoding,
  resolveScriptHash,
  resolvePaymentKeyHash,
} from '@meshsdk/core';

// =============================================================================
// TESTNET PLACEHOLDER VALUES
// =============================================================================

// 28-byte zero hash - placeholder for registry/contract addresses
const PLACEHOLDER_HASH = '00'.repeat(28);

// Default threshold for multi-sig operations
const DEFAULT_THRESHOLD = 1;

// Far-future slot for genesis end (testnet only)
const GENESIS_END_SLOT = 999999999;

// =============================================================================
// CONFIG BUILDERS
// =============================================================================

/**
 * Build the configuration for a validator based on its type.
 *
 * @param {string} configTypeName - The config type (e.g., "PnftConfig", "GenesisConfig")
 * @param {string} adminPkh - Payment key hash to use as admin/oracle
 * @returns {object} - The config object ready for applyParamsToScript
 */
export function buildValidatorConfig(configTypeName, adminPkh) {
  const adminList = [{ bytes: adminPkh }];

  let fields;

  switch (configTypeName) {
    case 'PnftConfig':
      // bioregion_registry (ByteArray), dna_oracle (List<PKH>), oracle_threshold (Int)
      fields = [
        { bytes: PLACEHOLDER_HASH },
        { list: adminList },
        { int: DEFAULT_THRESHOLD },
      ];
      break;

    case 'GenesisConfig':
      // genesis_end_slot, founding_oracles, founding_stewards, genesis_oracle_threshold, steward_threshold
      fields = [
        { int: GENESIS_END_SLOT },
        { list: adminList },
        { list: adminList },
        { int: DEFAULT_THRESHOLD },
        { int: DEFAULT_THRESHOLD },
      ];
      break;

    case 'BioregionConfig':
    case 'RegistryConfig':
      // Most have: some_hash, admin_list, threshold pattern
      fields = [
        { bytes: PLACEHOLDER_HASH },
        { list: adminList },
        { int: DEFAULT_THRESHOLD },
      ];
      break;

    case 'GovernanceConfig':
    case 'TreasuryConfig':
    case 'UbiConfig':
      // proposal_threshold, quorum, etc.
      fields = [
        { bytes: PLACEHOLDER_HASH },
        { list: adminList },
        { int: DEFAULT_THRESHOLD },
        { int: DEFAULT_THRESHOLD },
      ];
      break;

    default:
      // Generic fallback: try common 3-field pattern
      fields = [
        { bytes: PLACEHOLDER_HASH },
        { list: adminList },
        { int: DEFAULT_THRESHOLD },
      ];
  }

  return {
    constructor: 0,
    fields,
  };
}

/**
 * Extract config type name from validator schema reference.
 *
 * @param {object} validator - Validator object from plutus.json
 * @returns {string|null} - Config type name or null if not parameterized
 */
export function getConfigTypeName(validator) {
  if (!validator.parameters || validator.parameters.length === 0) {
    return null;
  }

  const configRef = validator.parameters[0]?.schema?.['$ref'];
  if (!configRef) {
    return null;
  }

  // Extract config type name (e.g., "pnft/PnftConfig" -> "PnftConfig")
  return configRef.replace('#/definitions/', '').split('/').pop();
}

/**
 * Apply parameters to a validator and return the final script with metadata.
 *
 * @param {object} validator - Validator object from plutus.json
 * @param {string} adminPkh - Payment key hash to use as admin/oracle
 * @returns {object|null} - { script, encodedScript, scriptHash, config } or null if failed
 */
export function applyValidatorParams(validator, adminPkh) {
  const configTypeName = getConfigTypeName(validator);

  // Non-parameterized validator
  if (!configTypeName) {
    const encodedScript = applyCborEncoding(validator.compiledCode);
    return {
      script: validator.compiledCode,
      encodedScript,
      scriptHash: resolveScriptHash(encodedScript, 'V3'),
      config: null,
      configTypeName: null,
    };
  }

  // Build config for this validator type
  const config = buildValidatorConfig(configTypeName, adminPkh);

  // Try to apply parameters with decreasing field counts if needed
  let appliedScript = null;
  let usedConfig = config;

  try {
    appliedScript = applyParamsToScript(validator.compiledCode, [config], 'JSON');
  } catch (e) {
    // Try with fewer fields
    for (let numFields = config.fields.length - 1; numFields >= 1; numFields--) {
      try {
        usedConfig = {
          constructor: 0,
          fields: config.fields.slice(0, numFields),
        };
        appliedScript = applyParamsToScript(validator.compiledCode, [usedConfig], 'JSON');
        break;
      } catch {
        continue;
      }
    }

    if (!appliedScript) {
      console.warn(`Could not apply params to ${validator.title}: ${e.message}`);
      return null;
    }
  }

  const encodedScript = applyCborEncoding(appliedScript);

  return {
    script: appliedScript,
    encodedScript,
    scriptHash: resolveScriptHash(encodedScript, 'V3'),
    config: usedConfig,
    configTypeName,
  };
}

/**
 * Get the admin PKH from a wallet address.
 * Convenience function for consistent PKH extraction.
 *
 * @param {string} address - Bech32 wallet address
 * @returns {string} - Payment key hash
 */
export function getAdminPkh(address) {
  return resolvePaymentKeyHash(address);
}

// =============================================================================
// VALIDATOR HELPERS
// =============================================================================

/**
 * Find a validator by title pattern in plutus.json validators array.
 *
 * @param {Array} validators - Array of validators from plutus.json
 * @param {string} pattern - Pattern to match (e.g., "pnft" matches "pnft.mint")
 * @returns {object|undefined} - Matching validator or undefined
 */
export function findValidator(validators, pattern) {
  const lowerPattern = pattern.toLowerCase();
  return validators.find(v =>
    v.title.toLowerCase().includes(lowerPattern) &&
    !v.title.endsWith('.else')  // Skip .else duplicates
  );
}

/**
 * Find all validators matching a pattern.
 *
 * @param {Array} validators - Array of validators from plutus.json
 * @param {string} pattern - Pattern to match
 * @returns {Array} - Matching validators
 */
export function findValidators(validators, pattern) {
  const lowerPattern = pattern.toLowerCase();
  return validators.filter(v =>
    v.title.toLowerCase().includes(lowerPattern) &&
    !v.title.endsWith('.else')
  );
}

/**
 * Get unique validators (skip .else duplicates).
 *
 * @param {Array} validators - Array of validators from plutus.json
 * @returns {Array} - Filtered validators
 */
export function getUniqueValidators(validators) {
  return validators.filter(v => !v.title.endsWith('.else'));
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
  // Constants
  PLACEHOLDER_HASH,
  DEFAULT_THRESHOLD,
  GENESIS_END_SLOT,

  // Core functions
  buildValidatorConfig,
  getConfigTypeName,
  applyValidatorParams,
  getAdminPkh,

  // Helpers
  findValidator,
  findValidators,
  getUniqueValidators,
};
