/**
 * UltraLife Identity Manager
 * 
 * Core module that orchestrates enrollment, authentication, and continuous
 * identity verification using multi-modal biometric feature vectors.
 * 
 * The identity vector is an eigenvector: it persists under daily transformations.
 * The eigenvalue (confidence score) indicates authentication strength.
 */

import { FeatureVector, AuthLevel, EnrollmentData, AuthResult, IdentityStatus, TouchEvent as UltraTouchEvent } from './types';
import { cosineSimilarity, weightedCombine, zeroVector } from './math';
import { CardiacEngine } from '../biometrics/cardiac';
import { MovementEngine } from '../biometrics/movement';
import { TouchEngine } from '../biometrics/touch';
import { SecureStorage } from './storage';

// Authentication thresholds per level
const AUTH_THRESHOLDS: Record<AuthLevel, number> = {
  quick: 0.80,
  standard: 0.90,
  high: 0.95,
  forensic: 0.98,
};

// Continuous auth threshold (lower — catches different person, not momentary variation)
const CONTINUOUS_AUTH_THRESHOLD = 0.75;

// Enrollment evolution rate (slow drift to track aging)
const ENROLLMENT_DRIFT_RATE = 0.01;

// Modality weights (cardiac highest — most genetically determined + liveness)
const MODALITY_WEIGHTS = {
  cardiac: 0.35,
  movement: 0.25,
  touch: 0.25,
  voice: 0.15,
};

export class IdentityManager {
  private cardiac: CardiacEngine;
  private movement: MovementEngine;
  private touch: TouchEngine;
  private storage: SecureStorage;
  private enrolledVector: FeatureVector | null = null;
  private isAuthenticated = false;
  private currentConfidence = 0;
  private continuousInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.cardiac = new CardiacEngine();
    this.movement = new MovementEngine();
    this.touch = new TouchEngine();
    this.storage = new SecureStorage();
  }

  /**
   * Check if a user is enrolled on this device
   */
  async isEnrolled(): Promise<boolean> {
    const data = await this.storage.getEnrollment();
    return data !== null;
  }

  /**
   * Enrollment ceremony — 60 seconds
   * 
   * Captures multi-modal biometric features and creates the identity eigenvector.
   * Returns enrollment data including the hash for on-chain registration.
   * 
   * Flow:
   *   0-40s:  Finger on camera → PPG cardiac capture (40-60 beats)
   *   40-50s: Speak enrollment phrase → vocal spectral capture
   *   50-60s: Pick up phone normally → movement signature capture
   * 
   * Touch dynamics captured passively throughout.
   */
  async enroll(
    ppgFrames: Float64Array[],
    accelData: Float64Array[],
    touchEvents: UltraTouchEvent[],
    // voiceData: Float64Array[], // Phase 2
  ): Promise<EnrollmentData> {
    // Extract features from each modality
    const cardiacFeatures = this.cardiac.extractFeatures(ppgFrames);
    const movementFeatures = this.movement.extractFeatures(accelData);
    const touchFeatures = this.touch.extractFeatures(touchEvents);

    // Validate quality per modality
    const cardiacQuality = this.cardiac.assessQuality(cardiacFeatures);
    const movementQuality = this.movement.assessQuality(movementFeatures);
    const touchQuality = this.touch.assessQuality(touchFeatures);

    if (cardiacQuality < 0.6) {
      throw new EnrollmentError('cardiac_quality', 
        'Cardiac signal quality too low. Ensure finger covers camera fully.');
    }

    // Combine into identity vector (weighted by modality)
    const identityVector = weightedCombine([
      { features: cardiacFeatures, weight: MODALITY_WEIGHTS.cardiac },
      { features: movementFeatures, weight: MODALITY_WEIGHTS.movement },
      { features: touchFeatures, weight: MODALITY_WEIGHTS.touch },
    ]);

    // Generate enrollment hash (for on-chain registration)
    const enrollmentHash = await this.hashVector(identityVector);

    // Store encrypted on device
    const enrollment: EnrollmentData = {
      vector: identityVector,
      hash: enrollmentHash,
      timestamp: Date.now(),
      quality: {
        cardiac: cardiacQuality,
        movement: movementQuality,
        touch: touchQuality,
        overall: (cardiacQuality + movementQuality + touchQuality) / 3,
      },
      version: 1,
    };

    await this.storage.saveEnrollment(enrollment);
    this.enrolledVector = identityVector;

    return enrollment;
  }

  /**
   * Authenticate at specified level
   * 
   * Captures live biometric, compares to enrollment, returns result.
   * The eigenvalue (confidence) must exceed the threshold for the requested level.
   */
  async authenticate(
    level: AuthLevel,
    liveData: {
      ppgFrames?: Float64Array[];
      accelData?: Float64Array[];
      touchEvents?: UltraTouchEvent[];
    },
  ): Promise<AuthResult> {
    if (!this.enrolledVector) {
      const enrollment = await this.storage.getEnrollment();
      if (!enrollment) {
        return { success: false, confidence: 0, reason: 'not_enrolled' };
      }
      this.enrolledVector = enrollment.vector;
    }

    const threshold = AUTH_THRESHOLDS[level];
    const features: { features: FeatureVector; weight: number }[] = [];

    // Quick: touch + accel only
    if (liveData.touchEvents) {
      features.push({
        features: this.touch.extractFeatures(liveData.touchEvents),
        weight: MODALITY_WEIGHTS.touch,
      });
    }
    if (liveData.accelData) {
      features.push({
        features: this.movement.extractFeatures(liveData.accelData),
        weight: MODALITY_WEIGHTS.movement,
      });
    }

    // Standard+: add cardiac
    if (liveData.ppgFrames && (level === 'standard' || level === 'high' || level === 'forensic')) {
      features.push({
        features: this.cardiac.extractFeatures(liveData.ppgFrames),
        weight: MODALITY_WEIGHTS.cardiac,
      });
    }

    if (features.length === 0) {
      return { success: false, confidence: 0, reason: 'no_biometric_data' };
    }

    // Build live feature vector
    const liveVector = weightedCombine(features);

    // Compute cosine similarity (the eigenvalue check)
    const confidence = cosineSimilarity(this.enrolledVector, liveVector);

    // Liveness check for standard+ (cardiac must show biological variability)
    if (level !== 'quick' && liveData.ppgFrames) {
      const livenessScore = this.cardiac.checkLiveness(liveData.ppgFrames);
      if (livenessScore < 0.7) {
        // Zero the live vector from memory
        zeroVector(liveVector);
        return { success: false, confidence, reason: 'liveness_failed' };
      }
    }

    const success = confidence >= threshold;

    // If high-confidence auth, slowly evolve enrollment (track aging)
    if (success && confidence > 0.92) {
      await this.evolveEnrollment(liveVector);
    }

    this.isAuthenticated = success;
    this.currentConfidence = confidence;

    // Zero the live vector from memory (privacy: don't keep biometric data around)
    zeroVector(liveVector);

    return {
      success,
      confidence,
      level,
      timestamp: Date.now(),
    };
  }

  /**
   * Start continuous authentication
   * 
   * Runs in background using accelerometer + touch dynamics.
   * If identity shifts (different person), session locks automatically.
   */
  startContinuousAuth(
    onLock: () => void,
    onConfidenceUpdate: (confidence: number) => void,
  ): void {
    if (this.continuousInterval) {
      clearInterval(this.continuousInterval);
    }

    this.continuousInterval = setInterval(async () => {
      if (!this.isAuthenticated || !this.enrolledVector) return;

      // Get latest accel + touch buffer from engines
      const recentMovement = this.movement.getRecentBuffer();
      const recentTouch = this.touch.getRecentBuffer();

      if (!recentMovement && !recentTouch) return;

      const features: { features: FeatureVector; weight: number }[] = [];
      if (recentMovement) {
        features.push({ features: recentMovement, weight: 0.5 });
      }
      if (recentTouch) {
        features.push({ features: recentTouch, weight: 0.5 });
      }

      const liveVector = weightedCombine(features);
      const confidence = cosineSimilarity(this.enrolledVector, liveVector);
      zeroVector(liveVector);

      onConfidenceUpdate(confidence);

      if (confidence < CONTINUOUS_AUTH_THRESHOLD) {
        this.isAuthenticated = false;
        this.currentConfidence = 0;
        onLock();
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Stop continuous authentication
   */
  stopContinuousAuth(): void {
    if (this.continuousInterval) {
      clearInterval(this.continuousInterval);
      this.continuousInterval = null;
    }
  }

  /**
   * Lock session explicitly
   */
  lock(): void {
    this.isAuthenticated = false;
    this.currentConfidence = 0;
  }

  /**
   * Delete enrollment permanently
   */
  async deleteIdentity(): Promise<void> {
    if (this.enrolledVector) {
      zeroVector(this.enrolledVector);
      this.enrolledVector = null;
    }
    await this.storage.deleteEnrollment();
    this.lock();
  }

  /**
   * Get current authentication status
   */
  getStatus(): IdentityStatus {
    return {
      enrolled: this.enrolledVector !== null,
      authenticated: this.isAuthenticated,
      confidence: this.currentConfidence,
      continuousActive: this.continuousInterval !== null,
    };
  }

  // --- Private methods ---

  /**
   * Slowly evolve enrollment to track biological aging
   * I_new = (1 - drift) * I_old + drift * I_live
   */
  private async evolveEnrollment(liveVector: FeatureVector): Promise<void> {
    if (!this.enrolledVector) return;

    const newVector = new Float64Array(this.enrolledVector.length);
    for (let i = 0; i < newVector.length; i++) {
      newVector[i] = (1 - ENROLLMENT_DRIFT_RATE) * this.enrolledVector[i] 
                     + ENROLLMENT_DRIFT_RATE * liveVector[i];
    }

    this.enrolledVector = newVector;
    
    const enrollment = await this.storage.getEnrollment();
    if (enrollment) {
      enrollment.vector = newVector;
      enrollment.hash = await this.hashVector(newVector);
      await this.storage.saveEnrollment(enrollment);
    }
  }

  /**
   * Hash feature vector for on-chain registration
   * Uses Blake2b-256 (Cardano native hash)
   */
  private async hashVector(vector: FeatureVector): Promise<string> {
    // Convert float array to bytes
    const bytes = new Uint8Array(vector.buffer);
    // Blake2b-256 hash (via cardano-serialization-lib)
    // TODO: Import actual Blake2b from cardano-serialization-lib
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

export class EnrollmentError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'EnrollmentError';
  }
}
