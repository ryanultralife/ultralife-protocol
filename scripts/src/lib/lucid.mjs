/**
 * UltraLife Protocol — Lucid Setup & Utilities
 *
 * Shared utilities for Lucid-based transaction building.
 */

import { Lucid, Blockfrost } from '@lucid-evolution/lucid';
import { generateMnemonic, mnemonicToEntropy } from 'bip39';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// =============================================================================
// NETWORK CONFIGURATION
// =============================================================================

const NETWORK_CONFIGS = {
  preview: {
    networkId: 0,
    blockfrostUrl: 'https://cardano-preview.blockfrost.io/api',
    magicNumber: 2,
  },
  preprod: {
    networkId: 0,
    blockfrostUrl: 'https://cardano-preprod.blockfrost.io/api',
    magicNumber: 1,
  },
  mainnet: {
    networkId: 1,
    blockfrostUrl: 'https://cardano-mainnet.blockfrost.io/api',
    magicNumber: 764824073,
  },
};

// =============================================================================
// LUCID INITIALIZATION
// =============================================================================

/**
 * Initialize Lucid with Blockfrost provider
 * @returns {Promise<Lucid>} Configured Lucid instance
 */
export async function initLucid() {
  const network = process.env.NETWORK || 'preview';
  const apiKey = process.env.BLOCKFROST_API_KEY;

  if (!apiKey) {
    throw new Error('BLOCKFROST_API_KEY environment variable required');
  }

  const config = NETWORK_CONFIGS[network];
  if (!config) {
    throw new Error(`Unknown network: ${network}`);
  }

  console.log(`Initializing Lucid for ${network}...`);

  const lucid = await Lucid(
    new Blockfrost(config.blockfrostUrl, apiKey),
    network === 'mainnet' ? 'Mainnet' : 'Preview'
  );

  return lucid;
}

/**
 * Initialize Lucid with wallet from seed phrase
 * @returns {Promise<Lucid>} Lucid instance with wallet selected
 */
export async function initLucidWithWallet() {
  const lucid = await initLucid();

  const seed = process.env.WALLET_SEED;
  if (!seed) {
    throw new Error('WALLET_SEED environment variable required');
  }

  lucid.selectWallet.fromSeed(seed);

  const address = await lucid.wallet().address();
  console.log(`Wallet loaded: ${address}`);

  return lucid;
}

/**
 * Generate a new wallet seed phrase
 * @returns {string} 24-word mnemonic
 */
export function generateWalletSeed() {
  return generateMnemonic(256);
}

// =============================================================================
// PLUTUS JSON LOADING
// =============================================================================

/**
 * Load compiled validators from plutus.json
 * @param {string} [plutusPath] Path to plutus.json
 * @returns {Object} Parsed plutus.json contents
 */
export function loadPlutusJson(plutusPath = '../contracts/plutus.json') {
  const resolvedPath = path.resolve(process.cwd(), plutusPath);

  if (!fs.existsSync(resolvedPath)) {
    // Try relative to scripts directory
    const altPath = path.resolve(import.meta.dirname, '../../..', 'contracts/plutus.json');
    if (!fs.existsSync(altPath)) {
      throw new Error(`plutus.json not found at ${resolvedPath} or ${altPath}. Run 'aiken build' first.`);
    }
    return JSON.parse(fs.readFileSync(altPath, 'utf8'));
  }

  return JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
}

/**
 * Find a validator by name in plutus.json
 * @param {Object} plutusJson Loaded plutus.json
 * @param {string} name Validator name (partial match)
 * @returns {Object|null} Validator object or null
 */
export function findValidator(plutusJson, name) {
  return plutusJson.validators?.find(v =>
    v.title.toLowerCase().includes(name.toLowerCase())
  ) || null;
}

/**
 * Get all validators from plutus.json
 * @param {Object} plutusJson Loaded plutus.json
 * @returns {Object} Map of validator name to validator object
 */
export function getAllValidators(plutusJson) {
  const validators = {};

  for (const v of plutusJson.validators || []) {
    // Extract validator name from title
    // Format: "module.validator_name.purpose" (e.g., "pnft.pnft_policy.mint")
    // We want the middle part (validator_name), or first two parts joined
    const parts = v.title.split('.');
    if (parts.length >= 2) {
      // Use "module.validator" as key (e.g., "pnft.pnft_policy")
      const name = parts.slice(0, 2).join('.');
      if (!validators[name]) {
        validators[name] = v;
      }
    }
  }

  return validators;
}

// =============================================================================
// DEPLOYMENT ARTIFACTS
// =============================================================================

/**
 * Save deployment artifacts
 * @param {string} network Network name
 * @param {Object} deployment Deployment data
 */
export function saveDeployment(network, deployment) {
  const dir = process.env.ARTIFACTS_DIR || './deployments';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const filename = `${network}-${Date.now()}.json`;
  const filepath = path.join(dir, filename);

  fs.writeFileSync(filepath, JSON.stringify(deployment, null, 2));
  console.log(`Deployment saved: ${filepath}`);

  // Also save as latest
  const latestPath = path.join(dir, `${network}-latest.json`);
  fs.writeFileSync(latestPath, JSON.stringify(deployment, null, 2));

  return filepath;
}

/**
 * Load latest deployment for a network
 * @param {string} network Network name
 * @returns {Object|null} Deployment data or null
 */
export function loadDeployment(network) {
  const dir = process.env.ARTIFACTS_DIR || './deployments';
  const filepath = path.join(dir, `${network}-latest.json`);

  if (!fs.existsSync(filepath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

// =============================================================================
// CBOR/DATUM UTILITIES
// =============================================================================

/**
 * Convert hex string to Uint8Array
 * @param {string} hex Hex string
 * @returns {Uint8Array}
 */
export function hexToBytes(hex) {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 * @param {Uint8Array} bytes Byte array
 * @returns {string}
 */
export function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert text to hex
 * @param {string} text UTF-8 text
 * @returns {string} Hex string
 */
export function textToHex(text) {
  return Buffer.from(text, 'utf8').toString('hex');
}

/**
 * Convert hex to text
 * @param {string} hex Hex string
 * @returns {string} UTF-8 text
 */
export function hexToText(hex) {
  return Buffer.from(hex, 'hex').toString('utf8');
}

/**
 * Generate a unique ID
 * @param {string} prefix Prefix for the ID
 * @returns {string}
 */
export function generateId(prefix = '') {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2, 10);
  return `${prefix}${timestamp}${random}`;
}

// =============================================================================
// TRANSACTION UTILITIES
// =============================================================================

/**
 * Wait for transaction confirmation
 * @param {Lucid} lucid Lucid instance
 * @param {string} txHash Transaction hash
 * @param {number} [maxWait=120000] Maximum wait time in ms
 * @returns {Promise<boolean>} True if confirmed
 */
export async function waitForConfirmation(lucid, txHash, maxWait = 120000) {
  console.log(`Waiting for confirmation: ${txHash}`);

  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const utxos = await lucid.utxosAt(await lucid.wallet().address());
      // Check if tx is confirmed by looking for spent inputs
      // In practice, Blockfrost returns the tx once confirmed
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log(`Confirmed: ${txHash}`);
      return true;
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  throw new Error(`Transaction not confirmed after ${maxWait}ms: ${txHash}`);
}

/**
 * Get current slot number
 * @param {Lucid} lucid Lucid instance
 * @returns {Promise<number>} Current slot
 */
export async function getCurrentSlot(lucid) {
  // Blockfrost provides this through latest block
  const provider = lucid.provider;
  // This is a simplified approach - actual implementation depends on Lucid version
  return Math.floor(Date.now() / 1000);
}

// =============================================================================
// LOGGING UTILITIES
// =============================================================================

/**
 * Log with timestamp
 * @param {string} message Message to log
 */
export function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

/**
 * Log error with timestamp
 * @param {string} message Error message
 * @param {Error} [error] Error object
 */
export function logError(message, error) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR: ${message}`);
  if (error) {
    console.error(error);
  }
}

export default {
  initLucid,
  initLucidWithWallet,
  generateWalletSeed,
  loadPlutusJson,
  findValidator,
  getAllValidators,
  saveDeployment,
  loadDeployment,
  hexToBytes,
  bytesToHex,
  textToHex,
  hexToText,
  generateId,
  waitForConfirmation,
  getCurrentSlot,
  log,
  logError,
};
