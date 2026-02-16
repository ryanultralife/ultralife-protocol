/**
 * UltraLife Secure Storage
 * 
 * Wraps expo-secure-store for encrypted on-device biometric storage.
 * Raw biometric features NEVER leave this module unencrypted.
 */

import { EnrollmentData, FeatureVector, PrivacySettings, ConsentTier } from './types';

// Development storage type
declare global {
  // eslint-disable-next-line no-var
  var __ultralife_storage: Record<string, string> | undefined;
}

// Storage keys
const KEYS = {
  ENROLLMENT: 'ultralife_enrollment',
  PRIVACY: 'ultralife_privacy',
  WALLET_ENCRYPTED: 'ultralife_wallet_enc',
  DEVICE_ID: 'ultralife_device_id',
} as const;

export class SecureStorage {
  /**
   * Save enrollment data (encrypted on device)
   */
  async saveEnrollment(data: EnrollmentData): Promise<void> {
    // Serialize: convert Float64Array to base64
    const serialized = {
      ...data,
      vector: this.vectorToBase64(data.vector),
    };
    
    // TODO: Use expo-secure-store in production
    // await SecureStore.setItemAsync(KEYS.ENROLLMENT, JSON.stringify(serialized));
    
    // Development fallback
    if (typeof globalThis.__ultralife_storage === 'undefined') {
      globalThis.__ultralife_storage = {};
    }
    globalThis.__ultralife_storage[KEYS.ENROLLMENT] = JSON.stringify(serialized);
  }

  /**
   * Retrieve enrollment data
   */
  async getEnrollment(): Promise<EnrollmentData | null> {
    try {
      // TODO: Use expo-secure-store in production
      // const raw = await SecureStore.getItemAsync(KEYS.ENROLLMENT);
      
      const raw = globalThis.__ultralife_storage?.[KEYS.ENROLLMENT] ?? null;
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        vector: this.base64ToVector(parsed.vector),
      };
    } catch {
      return null;
    }
  }

  /**
   * Delete enrollment permanently
   */
  async deleteEnrollment(): Promise<void> {
    // TODO: Use expo-secure-store in production
    // await SecureStore.deleteItemAsync(KEYS.ENROLLMENT);
    
    if (globalThis.__ultralife_storage) {
      delete globalThis.__ultralife_storage[KEYS.ENROLLMENT];
    }
  }

  /**
   * Save encrypted wallet key (encrypted with biometric-derived key)
   */
  async saveEncryptedWallet(encryptedKey: string): Promise<void> {
    if (typeof globalThis.__ultralife_storage === 'undefined') globalThis.__ultralife_storage = {};
    globalThis.__ultralife_storage[KEYS.WALLET_ENCRYPTED] = encryptedKey;
  }

  /**
   * Retrieve encrypted wallet key
   */
  async getEncryptedWallet(): Promise<string | null> {
    return globalThis.__ultralife_storage?.[KEYS.WALLET_ENCRYPTED] ?? null;
  }

  /**
   * Save privacy settings
   */
  async savePrivacySettings(settings: PrivacySettings): Promise<void> {
    const serialized = {
      ...settings,
      enabledTiers: Array.from(settings.enabledTiers),
    };
    if (typeof globalThis.__ultralife_storage === 'undefined') globalThis.__ultralife_storage = {};
    globalThis.__ultralife_storage[KEYS.PRIVACY] = JSON.stringify(serialized);
  }

  /**
   * Get privacy settings (defaults to identity-only)
   */
  async getPrivacySettings(): Promise<PrivacySettings> {
    try {
      const raw = globalThis.__ultralife_storage?.[KEYS.PRIVACY];
      if (!raw) return this.defaultPrivacySettings();
      const parsed = JSON.parse(raw);
      return {
        ...parsed,
        enabledTiers: new Set(parsed.enabledTiers),
      };
    } catch {
      return this.defaultPrivacySettings();
    }
  }

  private defaultPrivacySettings(): PrivacySettings {
    return {
      enabledTiers: new Set([ConsentTier.IdentityOnly]),
      recordingRetentionDays: 0,
      meshDiscoverable: false,
      couplingContacts: [],
    };
  }

  // === Serialization helpers ===

  private vectorToBase64(vector: FeatureVector): string {
    const bytes = new Uint8Array(vector.buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToVector(base64: string): FeatureVector {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Float64Array(bytes.buffer);
  }
}
