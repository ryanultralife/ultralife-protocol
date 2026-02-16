/**
 * UltraLife Cardano Wallet
 * 
 * Biometric-gated Cardano wallet. Private key is encrypted with
 * a key derived from enrollment hash. Decryption requires live
 * biometric authentication.
 * 
 * No seed phrases. No PINs. Your heartbeat signs transactions.
 */

import { AuthLevel, WalletState, TransactionRequest, TouchEvent as UltraTouchEvent } from '../lib/types';
import { IdentityManager } from '../lib/identity';
import { SecureStorage } from '../lib/storage';

// Minimum auth levels for different operations — used by getRequiredAuthLevel()
export const OPERATION_AUTH_LEVELS: Record<string, AuthLevel> = {
  balance_check: 'quick',
  receive: 'quick',
  send_small: 'standard',   // < 100 ADA
  send_large: 'high',       // >= 100 ADA
  delegate: 'high',
  identity_verify: 'forensic',
  export_key: 'forensic',   // Should almost never happen
};

export class Wallet {
  private identity: IdentityManager;
  private storage: SecureStorage;
  private address: string | null = null;
  private isUnlocked = false;

  constructor(identity: IdentityManager) {
    this.identity = identity;
    this.storage = new SecureStorage();
  }

  /**
   * Create new wallet during enrollment
   * 
   * Generates keypair, encrypts private key with enrollment-derived key,
   * stores encrypted key on device. Returns address for on-chain registration.
   */
  async create(enrollmentHash: string): Promise<string> {
    // TODO: Use @emurgo/cardano-serialization-lib for real key generation
    // For now, placeholder that shows the flow

    // 1. Generate random private key
    const privateKeyBytes = crypto.getRandomValues(new Uint8Array(32));

    // 2. Derive encryption key from enrollment hash
    const encKey = await this.deriveEncryptionKey(enrollmentHash);

    // 3. Encrypt private key
    const encrypted = await this.encrypt(privateKeyBytes, encKey);

    // 4. Store encrypted key
    await this.storage.saveEncryptedWallet(encrypted);

    // 5. Derive public key and address
    // TODO: Actual Cardano address derivation
    this.address = `addr_test1_${enrollmentHash.substring(0, 40)}`;

    // 6. Zero private key from memory
    privateKeyBytes.fill(0);

    return this.address;
  }

  /**
   * Sign a transaction with biometric authentication
   */
  async signTransaction(
    request: TransactionRequest,
    liveData: {
      ppgFrames?: Float64Array[];
      accelData?: Float64Array[];
      touchEvents?: UltraTouchEvent[];
    },
  ): Promise<{ txHash: string; confidence: number } | { error: string }> {
    // Determine required auth level
    const requiredLevel = request.amount >= BigInt(100_000_000)
      ? 'high' as AuthLevel
      : 'standard' as AuthLevel;

    // Authenticate
    const authResult = await this.identity.authenticate(requiredLevel, liveData);

    if (!authResult.success) {
      return { error: `Authentication failed: ${authResult.reason || 'insufficient confidence'} (${authResult.confidence.toFixed(3)})` };
    }

    // Decrypt private key
    const enrollment = await this.storage.getEnrollment();
    if (!enrollment) {
      return { error: 'No enrollment found' };
    }

    const encryptedKey = await this.storage.getEncryptedWallet();
    if (!encryptedKey) {
      return { error: 'No wallet key found' };
    }

    const encKey = await this.deriveEncryptionKey(enrollment.hash);
    const privateKey = await this.decrypt(encryptedKey, encKey);

    // TODO: Build and sign actual Cardano transaction
    // using cardano-serialization-lib
    const txHash = `tx_${Date.now().toString(16)}`;

    // Zero private key from memory immediately after signing
    if (privateKey instanceof Uint8Array) {
      privateKey.fill(0);
    }

    return {
      txHash,
      confidence: authResult.confidence,
    };
  }

  /**
   * Get wallet state
   */
  async getState(): Promise<WalletState | null> {
    if (!this.address) return null;

    const enrollment = await this.storage.getEnrollment();

    return {
      address: this.address,
      balance: BigInt(0), // TODO: Query from Cardano node
      enrollmentHash: enrollment?.hash || '',
      isLocked: !this.isUnlocked,
    };
  }

  // === Crypto helpers ===

  private async deriveEncryptionKey(enrollmentHash: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(enrollmentHash),
      'PBKDF2',
      false,
      ['deriveKey'],
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('ultralife-wallet-v1'),
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  private async encrypt(data: Uint8Array, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      data,
    );

    // Combine IV + ciphertext
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  private async decrypt(encryptedBase64: string, key: CryptoKey): Promise<Uint8Array> {
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext,
    );

    return new Uint8Array(decrypted);
  }
}
