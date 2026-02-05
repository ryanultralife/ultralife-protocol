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
  // BigInt replacer for JSON.stringify
  const replacer = (key, value) =>
    typeof value === 'bigint' ? value.toString() : value;

  const content = typeof data === 'string'
    ? data
    : JSON.stringify(data, replacer, options.pretty !== false ? 2 : 0);

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

// =============================================================================
// INPUT VALIDATION
// =============================================================================

/**
 * Valid pNFT levels in order
 */
export const PNFT_LEVELS = ['Basic', 'Ward', 'Standard', 'Verified', 'Steward'];

/**
 * Valid bioregions
 */
export const VALID_BIOREGIONS = [
  'sierra_nevada',
  'pacific_northwest',
  'great_lakes',
  'gulf_coast',
  'sonoran_desert',
  'rocky_mountains',
  'appalachian',
  'great_plains',
  'northeast',
  'southeast',
];

/**
 * Valid compound types for impact tracking
 */
export const VALID_COMPOUNDS = [
  'CO2', 'CH4', 'H2O', 'N', 'NO3', 'P', 'BIO', 'SOIL', 'KWH',
  'PROT', 'FAT', 'CARB', 'FIBER', 'B12', 'IRON', 'ZINC', 'OMEGA3', 'KCAL',
];

/**
 * Valid listing types
 */
export const VALID_LISTING_TYPES = ['product', 'service', 'work', 'asset_sale', 'asset_rental'];

/**
 * Valid proposal types
 */
export const VALID_PROPOSAL_TYPES = ['budget', 'policy', 'emergency', 'constitutional'];

/**
 * Valid care types
 */
export const VALID_CARE_TYPES = ['childcare', 'eldercare', 'disability', 'health', 'household', 'community'];

/**
 * Validate required fields in an object
 *
 * @param {object} obj - Object to validate
 * @param {string[]} requiredFields - Array of required field names
 * @returns {object} { valid, missingFields }
 */
export function validateRequiredFields(obj, requiredFields) {
  const missingFields = requiredFields.filter(field => {
    const value = obj[field];
    return value === undefined || value === null || value === '';
  });

  return {
    valid: missingFields.length === 0,
    missingFields,
  };
}

/**
 * Validate pNFT level
 *
 * @param {string} level - Level to validate
 * @returns {object} { valid, error }
 */
export function validatePnftLevel(level) {
  if (!level) {
    return { valid: false, error: 'Level is required' };
  }
  if (!PNFT_LEVELS.includes(level)) {
    return { valid: false, error: `Invalid level: ${level}. Valid levels: ${PNFT_LEVELS.join(', ')}` };
  }
  return { valid: true };
}

/**
 * Validate pNFT level transition
 *
 * @param {string} currentLevel - Current pNFT level
 * @param {string} targetLevel - Target pNFT level
 * @returns {object} { valid, error }
 */
export function validateLevelTransition(currentLevel, targetLevel) {
  const currentIdx = PNFT_LEVELS.indexOf(currentLevel);
  const targetIdx = PNFT_LEVELS.indexOf(targetLevel);

  if (currentIdx === -1) {
    return { valid: false, error: `Invalid current level: ${currentLevel}` };
  }
  if (targetIdx === -1) {
    return { valid: false, error: `Invalid target level: ${targetLevel}` };
  }
  if (targetIdx < currentIdx) {
    return { valid: false, error: 'Cannot downgrade pNFT level' };
  }
  if (targetIdx > currentIdx + 1) {
    return { valid: false, error: 'Cannot skip levels during upgrade' };
  }

  return { valid: true };
}

/**
 * Validate bioregion code
 *
 * @param {string} bioregion - Bioregion code to validate
 * @returns {object} { valid, error }
 */
export function validateBioregion(bioregion) {
  if (!bioregion) {
    return { valid: false, error: 'Bioregion is required' };
  }
  if (bioregion.trim() === '') {
    return { valid: false, error: 'Bioregion cannot be empty' };
  }
  if (!VALID_BIOREGIONS.includes(bioregion)) {
    return { valid: false, error: `Unknown bioregion: ${bioregion}. Valid bioregions: ${VALID_BIOREGIONS.join(', ')}` };
  }
  return { valid: true };
}

/**
 * Validate compound type
 *
 * @param {string} compound - Compound code to validate
 * @returns {object} { valid, error }
 */
export function validateCompound(compound) {
  if (!compound) {
    return { valid: false, error: 'Compound type is required' };
  }
  const upperCompound = compound.toUpperCase();
  if (!VALID_COMPOUNDS.includes(upperCompound)) {
    return { valid: false, error: `Invalid compound: ${compound}. Valid compounds: ${VALID_COMPOUNDS.join(', ')}` };
  }
  return { valid: true };
}

/**
 * Validate balance is sufficient for an operation
 *
 * @param {number} balance - Available balance
 * @param {number} required - Required amount
 * @param {string} operation - Description of operation (for error message)
 * @returns {object} { valid, error, shortfall }
 */
export function validateBalance(balance, required, operation = 'operation') {
  if (balance < 0) {
    return { valid: false, error: 'Balance cannot be negative', shortfall: required };
  }
  if (required <= 0) {
    return { valid: false, error: 'Required amount must be positive', shortfall: 0 };
  }
  if (balance < required) {
    return {
      valid: false,
      error: `Insufficient balance for ${operation}. Have: ${balance}, Need: ${required}`,
      shortfall: required - balance,
    };
  }
  return { valid: true, shortfall: 0 };
}

/**
 * Validate authorization (check if requester is authorized)
 *
 * @param {string} requester - Address of requester
 * @param {string} owner - Address of owner/authorized party
 * @param {string} action - Description of action (for error message)
 * @returns {object} { valid, error }
 */
export function validateAuthorization(requester, owner, action = 'this action') {
  if (!requester) {
    return { valid: false, error: 'Requester address is required' };
  }
  if (!owner) {
    return { valid: false, error: 'Owner address is required' };
  }
  if (requester !== owner) {
    return { valid: false, error: `Not authorized for ${action}. Only the owner can perform this action.` };
  }
  return { valid: true };
}

/**
 * Validate listing type
 *
 * @param {string} type - Listing type to validate
 * @returns {object} { valid, error }
 */
export function validateListingType(type) {
  if (!type) {
    return { valid: false, error: 'Listing type is required' };
  }
  const lowerType = type.toLowerCase();
  if (!VALID_LISTING_TYPES.includes(lowerType)) {
    return { valid: false, error: `Invalid listing type: ${type}. Valid types: ${VALID_LISTING_TYPES.join(', ')}` };
  }
  return { valid: true };
}

/**
 * Validate proposal type
 *
 * @param {string} type - Proposal type to validate
 * @returns {object} { valid, error }
 */
export function validateProposalType(type) {
  if (!type) {
    return { valid: false, error: 'Proposal type is required' };
  }
  const lowerType = type.toLowerCase();
  if (!VALID_PROPOSAL_TYPES.includes(lowerType)) {
    return { valid: false, error: `Invalid proposal type: ${type}. Valid types: ${VALID_PROPOSAL_TYPES.join(', ')}` };
  }
  return { valid: true };
}

/**
 * Validate care type
 *
 * @param {string} type - Care type to validate
 * @returns {object} { valid, error }
 */
export function validateCareType(type) {
  if (!type) {
    return { valid: false, error: 'Care type is required' };
  }
  const lowerType = type.toLowerCase();
  if (!VALID_CARE_TYPES.includes(lowerType)) {
    return { valid: false, error: `Invalid care type: ${type}. Valid types: ${VALID_CARE_TYPES.join(', ')}` };
  }
  return { valid: true };
}

/**
 * Validate quantity is positive
 *
 * @param {number} quantity - Quantity to validate
 * @param {string} fieldName - Name of field for error message
 * @returns {object} { valid, error }
 */
export function validatePositiveQuantity(quantity, fieldName = 'Quantity') {
  if (quantity === undefined || quantity === null) {
    return { valid: false, error: `${fieldName} is required` };
  }
  if (typeof quantity !== 'number' || isNaN(quantity)) {
    return { valid: false, error: `${fieldName} must be a number` };
  }
  if (quantity <= 0) {
    return { valid: false, error: `${fieldName} must be positive` };
  }
  return { valid: true };
}

/**
 * Validate price is non-negative
 *
 * @param {number} price - Price to validate
 * @returns {object} { valid, error }
 */
export function validatePrice(price) {
  if (price === undefined || price === null) {
    return { valid: false, error: 'Price is required' };
  }
  if (typeof price !== 'number' || isNaN(price)) {
    return { valid: false, error: 'Price must be a number' };
  }
  if (price < 0) {
    return { valid: false, error: 'Price cannot be negative' };
  }
  return { valid: true };
}

/**
 * Validate Cardano address format (basic check)
 *
 * @param {string} address - Address to validate
 * @returns {object} { valid, error }
 */
export function validateAddress(address) {
  if (!address) {
    return { valid: false, error: 'Address is required' };
  }
  if (typeof address !== 'string') {
    return { valid: false, error: 'Address must be a string' };
  }
  // Basic format check for testnet (addr_test) or mainnet (addr)
  if (!address.startsWith('addr_test') && !address.startsWith('addr1')) {
    return { valid: false, error: 'Invalid Cardano address format' };
  }
  return { valid: true };
}

/**
 * Validate timestamp is not in the future
 *
 * @param {number} timestamp - Timestamp to validate (milliseconds)
 * @param {number} tolerance - Allowed tolerance in milliseconds (default 60 seconds)
 * @returns {object} { valid, error }
 */
export function validateTimestamp(timestamp, tolerance = 60000) {
  const now = Date.now();
  if (timestamp > now + tolerance) {
    return { valid: false, error: 'Timestamp cannot be in the future' };
  }
  return { valid: true };
}

/**
 * Create a validation result with multiple checks
 *
 * @param {object[]} validations - Array of validation results
 * @returns {object} { valid, errors }
 */
export function combineValidations(...validations) {
  const errors = validations
    .filter(v => !v.valid)
    .map(v => v.error);

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate and sanitize user input
 *
 * @param {object} input - Input object to validate
 * @param {object} schema - Validation schema { fieldName: { required, type, validate } }
 * @returns {object} { valid, errors, sanitized }
 */
export function validateInput(input, schema) {
  const errors = [];
  const sanitized = {};

  for (const [field, rules] of Object.entries(schema)) {
    const value = input[field];

    // Check required
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      continue;
    }

    // Skip validation if not provided and not required
    if (value === undefined || value === null) {
      if (rules.default !== undefined) {
        sanitized[field] = rules.default;
      }
      continue;
    }

    // Type check
    if (rules.type) {
      const valueType = typeof value;
      if (rules.type === 'number' && valueType !== 'number') {
        const parsed = parseFloat(value);
        if (isNaN(parsed)) {
          errors.push(`${field} must be a number`);
          continue;
        }
        sanitized[field] = parsed;
      } else if (rules.type === 'string' && valueType !== 'string') {
        sanitized[field] = String(value);
      } else if (rules.type === 'boolean') {
        sanitized[field] = Boolean(value);
      } else {
        sanitized[field] = value;
      }
    } else {
      sanitized[field] = value;
    }

    // Custom validation
    if (rules.validate && sanitized[field] !== undefined) {
      const result = rules.validate(sanitized[field]);
      if (!result.valid) {
        errors.push(result.error);
      }
    }

    // Enum check
    if (rules.enum && sanitized[field] !== undefined) {
      if (!rules.enum.includes(sanitized[field])) {
        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
      }
    }

    // Range check for numbers
    if (rules.min !== undefined && sanitized[field] < rules.min) {
      errors.push(`${field} must be at least ${rules.min}`);
    }
    if (rules.max !== undefined && sanitized[field] > rules.max) {
      errors.push(`${field} must be at most ${rules.max}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    sanitized,
  };
}
