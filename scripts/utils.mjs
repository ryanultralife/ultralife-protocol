/**
 * UltraLife Protocol — Shared Utilities
 *
 * Common utilities for deployment and test scripts.
 * Addresses medium-priority audit findings:
 * - Atomic file writes
 * - Fee estimation
 * - UTxO selection validation
 * - Slot time handling
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

// =============================================================================
// ATOMIC FILE OPERATIONS
// =============================================================================

/**
 * Atomically write data to a file.
 * Writes to a temp file first, then renames to target path.
 * This prevents corruption if the process crashes mid-write.
 *
 * @param {string} filePath - Target file path
 * @param {string|object} data - Data to write (object will be JSON.stringify'd)
 * @param {object} options - Options (pretty: bool for JSON formatting)
 */
export function atomicWriteSync(filePath, data, options = {}) {
  const content = typeof data === 'string'
    ? data
    : JSON.stringify(data, null, options.pretty !== false ? 2 : 0);

  // Create temp file in same directory (ensures same filesystem for rename)
  const dir = path.dirname(filePath);
  const tempFile = path.join(dir, `.${path.basename(filePath)}.${crypto.randomBytes(6).toString('hex')}.tmp`);

  try {
    // Ensure directory exists
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write to temp file
    fs.writeFileSync(tempFile, content, 'utf8');

    // Atomic rename (on POSIX systems, this is atomic)
    fs.renameSync(tempFile, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (e) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Safely read and parse a JSON file with error handling.
 *
 * @param {string} filePath - Path to JSON file
 * @param {object} defaultValue - Default value if file doesn't exist or is invalid
 * @returns {object} Parsed JSON or default value
 */
export function safeReadJson(filePath, defaultValue = null) {
  try {
    if (!fs.existsSync(filePath)) {
      return defaultValue;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Warning: Failed to read ${filePath}: ${error.message}`);
    return defaultValue;
  }
}

// =============================================================================
// CARDANO SLOT TIME
// =============================================================================

// Network genesis times (Unix seconds)
const NETWORK_GENESIS = {
  preview: 1666656000,    // Preview testnet genesis
  preprod: 1654041600,    // Preprod testnet genesis
  mainnet: 1596059091,    // Mainnet Shelley genesis
};

// Slot duration in seconds (1 second per slot on all networks)
const SLOT_DURATION = 1;

/**
 * Get current Cardano slot from Blockfrost provider.
 * Falls back to estimation if API fails.
 *
 * @param {object} provider - Blockfrost provider instance
 * @param {string} network - Network name (preview, preprod, mainnet)
 * @returns {Promise<number>} Current slot number
 */
export async function getCurrentSlot(provider, network = 'preview') {
  try {
    const tip = await provider.fetchBlockchainTip();
    return tip.slot;
  } catch (error) {
    console.warn(`Could not fetch current slot: ${error.message}`);
    return estimateCurrentSlot(network);
  }
}

/**
 * Estimate current slot from system time.
 * Use only as fallback when API is unavailable.
 *
 * @param {string} network - Network name
 * @returns {number} Estimated slot number
 */
export function estimateCurrentSlot(network = 'preview') {
  const genesisTime = NETWORK_GENESIS[network] || NETWORK_GENESIS.preview;
  const currentTime = Math.floor(Date.now() / 1000);
  return Math.floor((currentTime - genesisTime) / SLOT_DURATION);
}

/**
 * Convert slot to approximate Unix timestamp.
 *
 * @param {number} slot - Slot number
 * @param {string} network - Network name
 * @returns {number} Unix timestamp in seconds
 */
export function slotToTime(slot, network = 'preview') {
  const genesisTime = NETWORK_GENESIS[network] || NETWORK_GENESIS.preview;
  return genesisTime + (slot * SLOT_DURATION);
}

// =============================================================================
// FEE ESTIMATION
// =============================================================================

// Base transaction fees (conservative estimates in lovelace)
const FEE_ESTIMATES = {
  // Simple transfer
  simpleTransfer: 200_000,

  // Reference script deployment (varies by script size)
  referenceScriptBase: 500_000,
  referenceScriptPerByte: 50,  // Additional fee per byte of script

  // Minting transaction
  mintTransaction: 400_000,

  // Smart contract interaction
  contractInteraction: 800_000,

  // Genesis initialization (multiple outputs)
  genesisInit: 1_500_000,
};

// Minimum UTxO value (protocol parameter, ~1 ADA)
const MIN_UTXO_LOVELACE = 1_000_000n;

/**
 * Estimate transaction fee based on type and parameters.
 *
 * @param {string} txType - Transaction type (simpleTransfer, referenceScript, etc.)
 * @param {object} params - Additional parameters (e.g., scriptSize for reference scripts)
 * @returns {bigint} Estimated fee in lovelace
 */
export function estimateFee(txType, params = {}) {
  let baseFee = FEE_ESTIMATES[txType] || FEE_ESTIMATES.contractInteraction;

  if (txType === 'referenceScript' && params.scriptSize) {
    baseFee += FEE_ESTIMATES.referenceScriptPerByte * params.scriptSize;
  }

  // Add 20% buffer for safety
  return BigInt(Math.ceil(baseFee * 1.2));
}

/**
 * Calculate total required balance for a deployment operation.
 *
 * @param {object} params - Deployment parameters
 * @param {number} params.numValidators - Number of validators to deploy
 * @param {bigint} params.treasuryAmount - Treasury seed amount
 * @param {bigint} params.ubiPoolAmount - UBI pool seed amount
 * @param {number} params.avgScriptSize - Average script size in bytes
 * @returns {object} { total, breakdown } with amounts and breakdown
 */
export function calculateRequiredBalance(params = {}) {
  const {
    numValidators = 0,
    treasuryAmount = 0n,
    ubiPoolAmount = 0n,
    avgScriptSize = 5000,
  } = params;

  const breakdown = {
    treasury: BigInt(treasuryAmount),
    ubiPool: BigInt(ubiPoolAmount),
    referenceScripts: 0n,
    transactionFees: 0n,
    minUtxos: 0n,
  };

  // Reference script costs
  if (numValidators > 0) {
    const perScriptCost = MIN_UTXO_LOVELACE + estimateFee('referenceScript', { scriptSize: avgScriptSize });
    breakdown.referenceScripts = perScriptCost * BigInt(numValidators);
    breakdown.transactionFees = estimateFee('referenceScript') * BigInt(numValidators);
  }

  // Minimum UTxOs for change outputs (assume worst case: 1 per tx)
  breakdown.minUtxos = MIN_UTXO_LOVELACE * BigInt(Math.max(numValidators, 1) + 3);

  // Genesis init fees if doing treasury/UBI
  if (treasuryAmount > 0n || ubiPoolAmount > 0n) {
    breakdown.transactionFees += estimateFee('genesisInit');
  }

  const total = Object.values(breakdown).reduce((sum, v) => sum + v, 0n);

  return { total, breakdown };
}

// =============================================================================
// UTXO SELECTION
// =============================================================================

/**
 * Select UTxOs to cover a target amount.
 * Uses a simple largest-first strategy with validation.
 *
 * @param {Array} utxos - Available UTxOs
 * @param {bigint} targetAmount - Target amount in lovelace
 * @param {object} options - Selection options
 * @returns {object} { selected, total, sufficient }
 */
export function selectUtxos(utxos, targetAmount, options = {}) {
  const {
    minUtxoValue = MIN_UTXO_LOVELACE,
    maxInputs = 20,  // Limit to prevent oversized transactions
  } = options;

  // Sort by lovelace amount (largest first)
  const sorted = [...utxos]
    .map(utxo => {
      const lovelace = utxo.output.amount.find(a => a.unit === 'lovelace');
      return {
        utxo,
        lovelace: BigInt(lovelace?.quantity || 0),
      };
    })
    .filter(u => u.lovelace >= minUtxoValue)  // Filter dust
    .sort((a, b) => Number(b.lovelace - a.lovelace));  // Largest first

  const selected = [];
  let total = 0n;

  for (const item of sorted) {
    if (total >= targetAmount && selected.length > 0) break;
    if (selected.length >= maxInputs) break;

    selected.push(item.utxo);
    total += item.lovelace;
  }

  return {
    selected,
    total,
    sufficient: total >= targetAmount,
    shortfall: total < targetAmount ? targetAmount - total : 0n,
  };
}

/**
 * Validate UTxO selection before transaction building.
 *
 * @param {Array} utxos - Selected UTxOs
 * @param {bigint} targetAmount - Required amount
 * @param {bigint} estimatedFee - Estimated transaction fee
 * @returns {object} { valid, errors, warnings }
 */
export function validateUtxoSelection(utxos, targetAmount, estimatedFee = 200_000n) {
  const errors = [];
  const warnings = [];

  if (!utxos || utxos.length === 0) {
    errors.push('No UTxOs selected');
    return { valid: false, errors, warnings };
  }

  // Calculate total input
  const totalInput = utxos.reduce((sum, utxo) => {
    const lovelace = utxo.output.amount.find(a => a.unit === 'lovelace');
    return sum + BigInt(lovelace?.quantity || 0);
  }, 0n);

  const required = targetAmount + estimatedFee + MIN_UTXO_LOVELACE;

  if (totalInput < required) {
    errors.push(`Insufficient input: ${formatAda(totalInput)} < ${formatAda(required)} required`);
  }

  // Check for potential change output issue
  const change = totalInput - targetAmount - estimatedFee;
  if (change > 0n && change < MIN_UTXO_LOVELACE) {
    warnings.push(`Change output (${formatAda(change)}) below minimum UTxO. May need to adjust.`);
  }

  // Warn about large number of inputs
  if (utxos.length > 10) {
    warnings.push(`Using ${utxos.length} inputs. Consider consolidating UTxOs.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    totalInput,
    change: change > 0n ? change : 0n,
  };
}

// =============================================================================
// FORMATTING
// =============================================================================

/**
 * Format lovelace as ADA with proper decimals.
 *
 * @param {bigint|number} lovelace - Amount in lovelace
 * @returns {string} Formatted string (e.g., "123.456789 ADA")
 */
export function formatAda(lovelace) {
  const ada = Number(lovelace) / 1_000_000;
  return `${ada.toFixed(6)} ADA`;
}

/**
 * Format slot as human-readable time.
 *
 * @param {number} slot - Slot number
 * @param {string} network - Network name
 * @returns {string} Formatted date string
 */
export function formatSlotTime(slot, network = 'preview') {
  const timestamp = slotToTime(slot, network) * 1000;
  return new Date(timestamp).toISOString();
}

// =============================================================================
// ADDRESS UTILITIES
// =============================================================================

/**
 * Extract verification key hash from a Cardano address.
 * Works with both base and enterprise addresses.
 *
 * @param {string} address - Bech32 Cardano address
 * @param {function} deserializeAddress - MeshSDK deserializeAddress function
 * @returns {string} Verification key hash (hex)
 */
export function extractKeyHash(address, deserializeAddress) {
  try {
    const deserialized = deserializeAddress(address);
    return deserialized.pubKeyHash;
  } catch (error) {
    throw new Error(`Failed to extract key hash from address: ${error.message}`);
  }
}

// =============================================================================
// LOGGING
// =============================================================================

/**
 * Create a standardized logger with emoji prefixes.
 *
 * @param {object} options - Logger options
 * @returns {object} Logger with info, success, warn, error methods
 */
export function createLogger(options = {}) {
  const { prefix = '', quiet = false } = options;

  const log = (emoji, msg) => {
    if (!quiet) {
      console.log(`${emoji} ${prefix}${msg}`);
    }
  };

  return {
    info: (msg) => log('ℹ️ ', msg),
    success: (msg) => log('✅', msg),
    warn: (msg) => log('⚠️ ', msg),
    error: (msg) => log('❌', msg),
    step: (n, msg) => log('📌', `[Step ${n}] ${msg}`),
    tx: (hash) => log('🔗', `https://preview.cardanoscan.io/transaction/${hash}`),
  };
}
