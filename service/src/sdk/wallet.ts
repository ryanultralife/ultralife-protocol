/**
 * Wallet Integration Helpers
 *
 * Utilities for wallet connection, address handling, and transaction signing
 * for UltraLife Protocol.
 */

import { Lucid, Blockfrost, WalletApi, C, toHex, fromHex } from 'lucid-cardano';

// =============================================================================
// TYPES
// =============================================================================

export interface WalletInfo {
  address: string;
  stakeAddress: string | null;
  balance: {
    lovelace: bigint;
    assets: Map<string, bigint>;
  };
  networkId: number;
}

export interface SignedTx {
  signedTx: string;
  txHash: string;
}

export interface WalletProvider {
  name: string;
  icon: string;
  apiVersion: string;
  enable: () => Promise<WalletApi>;
  isEnabled: () => Promise<boolean>;
}

// =============================================================================
// WALLET HELPERS CLASS
// =============================================================================

export class WalletHelpers {
  private network: 'mainnet' | 'preprod' | 'preview';
  private lucid: Lucid | null = null;

  constructor(network: 'mainnet' | 'preprod' | 'preview' = 'preprod') {
    this.network = network;
  }

  // ===========================================================================
  // WALLET DETECTION
  // ===========================================================================

  /**
   * Get all available CIP-30 wallets in the browser
   */
  getAvailableWallets(): WalletProvider[] {
    if (typeof window === 'undefined') {
      return [];
    }

    const wallets: WalletProvider[] = [];
    const cardano = (window as any).cardano;

    if (!cardano) {
      return [];
    }

    // Common wallet providers
    const providerNames = ['nami', 'eternl', 'flint', 'lace', 'gerowallet', 'typhon', 'nufi'];

    for (const name of providerNames) {
      if (cardano[name]) {
        wallets.push({
          name: cardano[name].name || name,
          icon: cardano[name].icon || '',
          apiVersion: cardano[name].apiVersion || '0.1.0',
          enable: () => cardano[name].enable(),
          isEnabled: () => cardano[name].isEnabled?.() || Promise.resolve(false),
        });
      }
    }

    return wallets;
  }

  /**
   * Check if a specific wallet is installed
   */
  isWalletInstalled(name: string): boolean {
    if (typeof window === 'undefined') return false;
    const cardano = (window as any).cardano;
    return cardano && cardano[name.toLowerCase()] !== undefined;
  }

  // ===========================================================================
  // WALLET CONNECTION
  // ===========================================================================

  /**
   * Connect to a browser wallet (CIP-30)
   */
  async connectBrowserWallet(
    walletName: string,
    blockfrostApiKey?: string
  ): Promise<WalletInfo> {
    if (typeof window === 'undefined') {
      throw new Error('Browser wallet connection only available in browser environment');
    }

    const cardano = (window as any).cardano;
    if (!cardano || !cardano[walletName.toLowerCase()]) {
      throw new Error(`Wallet ${walletName} not found. Is it installed?`);
    }

    // Enable wallet
    const api = await cardano[walletName.toLowerCase()].enable();

    // Initialize Lucid with wallet
    this.lucid = await Lucid.new(
      blockfrostApiKey
        ? new Blockfrost(
          `https://cardano-${this.network}.blockfrost.io/api`,
          blockfrostApiKey
        )
        : undefined,
      this.network === 'mainnet' ? 'Mainnet' : 'Preprod'
    );

    this.lucid.selectWallet(api);

    // Get wallet info
    return this.getWalletInfo();
  }

  /**
   * Connect using a seed phrase (for server-side use)
   * WARNING: Handle seed phrases with extreme care!
   */
  async connectWithSeed(
    seedPhrase: string,
    blockfrostApiKey: string
  ): Promise<WalletInfo> {
    this.lucid = await Lucid.new(
      new Blockfrost(
        `https://cardano-${this.network}.blockfrost.io/api`,
        blockfrostApiKey
      ),
      this.network === 'mainnet' ? 'Mainnet' : 'Preprod'
    );

    this.lucid.selectWalletFromSeed(seedPhrase);

    return this.getWalletInfo();
  }

  /**
   * Connect using a private key (for server-side use)
   * WARNING: Handle private keys with extreme care!
   */
  async connectWithPrivateKey(
    privateKey: string,
    blockfrostApiKey: string
  ): Promise<WalletInfo> {
    this.lucid = await Lucid.new(
      new Blockfrost(
        `https://cardano-${this.network}.blockfrost.io/api`,
        blockfrostApiKey
      ),
      this.network === 'mainnet' ? 'Mainnet' : 'Preprod'
    );

    this.lucid.selectWalletFromPrivateKey(privateKey);

    return this.getWalletInfo();
  }

  /**
   * Get current wallet info
   */
  async getWalletInfo(): Promise<WalletInfo> {
    if (!this.lucid) {
      throw new Error('No wallet connected');
    }

    const address = await this.lucid.wallet.address();
    const utxos = await this.lucid.wallet.getUtxos();

    let lovelace = 0n;
    const assets = new Map<string, bigint>();

    for (const utxo of utxos) {
      for (const [unit, quantity] of Object.entries(utxo.assets)) {
        if (unit === 'lovelace') {
          lovelace += BigInt(quantity);
        } else {
          const current = assets.get(unit) || 0n;
          assets.set(unit, current + BigInt(quantity));
        }
      }
    }

    // Get stake address
    let stakeAddress: string | null = null;
    try {
      const rewardAddresses = await this.lucid.wallet.rewardAddress();
      stakeAddress = rewardAddresses || null;
    } catch {
      // Wallet may not have stake address
    }

    const networkId = this.network === 'mainnet' ? 1 : 0;

    return {
      address,
      stakeAddress,
      balance: { lovelace, assets },
      networkId,
    };
  }

  /**
   * Check if wallet is connected
   */
  isConnected(): boolean {
    return this.lucid !== null;
  }

  /**
   * Disconnect wallet
   */
  disconnect(): void {
    this.lucid = null;
  }

  // ===========================================================================
  // TRANSACTION OPERATIONS
  // ===========================================================================

  /**
   * Sign a transaction
   */
  async signTransaction(unsignedTxCbor: string): Promise<SignedTx> {
    if (!this.lucid) {
      throw new Error('No wallet connected');
    }

    const tx = this.lucid.fromTx(unsignedTxCbor);
    const signedTx = await tx.sign().complete();

    return {
      signedTx: signedTx.toString(),
      txHash: signedTx.toHash(),
    };
  }

  /**
   * Sign and submit a transaction
   */
  async signAndSubmit(unsignedTxCbor: string): Promise<string> {
    if (!this.lucid) {
      throw new Error('No wallet connected');
    }

    const tx = this.lucid.fromTx(unsignedTxCbor);
    const signedTx = await tx.sign().complete();
    const txHash = await signedTx.submit();

    return txHash;
  }

  /**
   * Wait for transaction confirmation
   */
  async awaitConfirmation(txHash: string, timeoutMs: number = 120000): Promise<boolean> {
    if (!this.lucid) {
      throw new Error('No wallet connected');
    }

    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const confirmed = await this.lucid.awaitTx(txHash);
        if (confirmed) return true;
      } catch {
        // Transaction not yet confirmed
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    return false;
  }

  // ===========================================================================
  // ADDRESS UTILITIES
  // ===========================================================================

  /**
   * Validate a Cardano address
   */
  validateAddress(address: string): boolean {
    try {
      // Check basic format
      if (!address) return false;

      // Mainnet addresses start with 'addr1'
      // Testnet addresses start with 'addr_test1'
      if (this.network === 'mainnet') {
        return address.startsWith('addr1');
      } else {
        return address.startsWith('addr_test1');
      }
    } catch {
      return false;
    }
  }

  /**
   * Get the payment key hash from an address
   */
  getPaymentKeyHash(address: string): string | null {
    try {
      // This is a simplified extraction - production would use proper library
      // Addresses are bech32 encoded, the payload contains the key hash
      if (address.startsWith('addr_test1') || address.startsWith('addr1')) {
        // Extract the key hash portion (simplified)
        // In practice, use proper address parsing from cardano-serialization-lib
        return address.slice(address.indexOf('1') + 1, address.indexOf('1') + 57);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get the stake key hash from an address
   */
  getStakeKeyHash(address: string): string | null {
    try {
      // Simplified extraction - production would use proper library
      if (address.length > 100) {
        return address.slice(-56);
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Check if address is a script address
   */
  isScriptAddress(address: string): boolean {
    // Script addresses have different header byte patterns
    // This is a simplified check
    try {
      const decoded = this.bech32Decode(address);
      if (!decoded) return false;

      // Check header byte for script type
      const headerByte = parseInt(decoded.slice(0, 2), 16);
      return (headerByte & 0x10) !== 0;
    } catch {
      return false;
    }
  }

  /**
   * Format address for display (truncated)
   */
  formatAddress(address: string, startChars: number = 12, endChars: number = 8): string {
    if (address.length <= startChars + endChars) {
      return address;
    }
    return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
  }

  // ===========================================================================
  // ASSET UTILITIES
  // ===========================================================================

  /**
   * Parse a unit string into policy ID and asset name
   */
  parseUnit(unit: string): { policyId: string; assetName: string } {
    if (unit === 'lovelace') {
      return { policyId: '', assetName: '' };
    }

    // Unit format: policyId + assetNameHex
    const policyId = unit.slice(0, 56);
    const assetName = unit.slice(56);

    return { policyId, assetName };
  }

  /**
   * Create a unit string from policy ID and asset name
   */
  createUnit(policyId: string, assetName: string): string {
    if (!policyId) return 'lovelace';
    return policyId + assetName;
  }

  /**
   * Decode asset name from hex to text
   */
  decodeAssetName(hexName: string): string {
    try {
      return Buffer.from(hexName, 'hex').toString('utf8');
    } catch {
      return hexName;
    }
  }

  /**
   * Encode text to asset name hex
   */
  encodeAssetName(name: string): string {
    return Buffer.from(name, 'utf8').toString('hex');
  }

  /**
   * Format token amount with decimals
   */
  formatTokenAmount(amount: bigint, decimals: number = 6): string {
    const divisor = BigInt(10 ** decimals);
    const wholePart = amount / divisor;
    const fractionalPart = amount % divisor;

    if (fractionalPart === 0n) {
      return wholePart.toString();
    }

    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.replace(/0+$/, '');

    return `${wholePart}.${trimmedFractional}`;
  }

  /**
   * Parse token amount from string
   */
  parseTokenAmount(amountStr: string, decimals: number = 6): bigint {
    const [whole, fractional = ''] = amountStr.split('.');
    const paddedFractional = fractional.slice(0, decimals).padEnd(decimals, '0');
    return BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFractional);
  }

  // ===========================================================================
  // UTILITY HELPERS
  // ===========================================================================

  /**
   * Convert lovelace to ADA
   */
  lovelaceToAda(lovelace: bigint): number {
    return Number(lovelace) / 1_000_000;
  }

  /**
   * Convert ADA to lovelace
   */
  adaToLovelace(ada: number): bigint {
    return BigInt(Math.round(ada * 1_000_000));
  }

  /**
   * Format lovelace as ADA string
   */
  formatAda(lovelace: bigint): string {
    const ada = this.lovelaceToAda(lovelace);
    return `${ada.toFixed(6)} ADA`;
  }

  /**
   * Generate a random hex string (for testing)
   */
  randomHex(bytes: number = 32): string {
    const array = new Uint8Array(bytes);
    if (typeof crypto !== 'undefined') {
      crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < bytes; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Simple bech32 decode (returns hex payload)
   */
  private bech32Decode(bech32: string): string | null {
    try {
      const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

      const pos = bech32.lastIndexOf('1');
      if (pos < 1 || pos + 7 > bech32.length) return null;

      const data: number[] = [];
      for (let i = pos + 1; i < bech32.length; i++) {
        const c = CHARSET.indexOf(bech32.charAt(i));
        if (c === -1) return null;
        data.push(c);
      }

      // Convert 5-bit groups to 8-bit
      let acc = 0;
      let bits = 0;
      const result: number[] = [];

      for (let i = 0; i < data.length - 6; i++) {
        acc = (acc << 5) | data[i];
        bits += 5;
        while (bits >= 8) {
          bits -= 8;
          result.push((acc >> bits) & 0xff);
        }
      }

      return result.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return null;
    }
  }

  /**
   * Get current epoch (approximate)
   */
  getCurrentEpoch(): number {
    // Cardano epoch is ~5 days
    // Mainnet epoch 0 started at 2020-07-29T21:44:51Z
    // Preprod has different epoch timing
    const now = Date.now();
    const epochDurationMs = 5 * 24 * 60 * 60 * 1000;

    if (this.network === 'mainnet') {
      const epoch0Start = new Date('2020-07-29T21:44:51Z').getTime();
      return Math.floor((now - epoch0Start) / epochDurationMs);
    } else {
      // Testnet epochs - approximate
      const testnetStart = new Date('2022-04-01T00:00:00Z').getTime();
      return Math.floor((now - testnetStart) / epochDurationMs);
    }
  }

  /**
   * Get current slot (approximate)
   */
  getCurrentSlot(): number {
    // ~1 slot per second
    const now = Date.now();

    if (this.network === 'mainnet') {
      const shelleyStart = new Date('2020-07-29T21:44:51Z').getTime();
      return Math.floor((now - shelleyStart) / 1000);
    } else {
      const testnetStart = new Date('2022-04-01T00:00:00Z').getTime();
      return Math.floor((now - testnetStart) / 1000);
    }
  }
}

export default WalletHelpers;
