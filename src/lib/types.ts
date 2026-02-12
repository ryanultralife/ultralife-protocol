/**
 * UltraLife Type Definitions
 */

// Core biometric types
export type FeatureVector = Float64Array;

export type AuthLevel = 'quick' | 'standard' | 'high' | 'forensic';

export interface AuthResult {
  success: boolean;
  confidence: number;
  level?: AuthLevel;
  reason?: string;
  timestamp?: number;
}

export interface EnrollmentData {
  vector: FeatureVector;
  hash: string;
  timestamp: number;
  quality: ModalityQuality;
  version: number;
}

export interface ModalityQuality {
  cardiac: number;
  movement: number;
  touch: number;
  voice?: number;
  impedance?: number;
  overall: number;
}

export interface IdentityStatus {
  enrolled: boolean;
  authenticated: boolean;
  confidence: number;
  continuousActive: boolean;
}

// Biometric signal types
export interface PPGFrame {
  timestamp: number;
  red: number;
  green: number;
  blue: number;
}

export interface AccelSample {
  timestamp: number;
  x: number;
  y: number;
  z: number;
}

export interface GyroSample {
  timestamp: number;
  x: number;
  y: number;
  z: number;
}

export interface TouchEvent {
  timestamp: number;
  x: number;
  y: number;
  pressure: number;
  area: number;
  type: 'down' | 'move' | 'up';
}

// Cardiac feature breakdown
export interface CardiacFeatures {
  // Morphological (15 features)
  systolicPeakAmplitude: number;
  diastolicNotchDepth: number;
  pulseWidth50: number;
  riseTime: number;
  fallTime: number;
  systolicArea: number;
  diastolicArea: number;
  peakSharpness: number;
  waveformSymmetry: number;
  augmentationIndex: number;
  reflectionIndex: number;
  stiffnessIndex: number;
  crestTime: number;
  deltaT: number;
  pulseAmplitudeRatio: number;

  // Interval (8 features)
  meanRR: number;
  heartRate: number;
  pulseTransitTime: number;
  preEjectionPeriod: number;
  leftVentricularEjectionTime: number;
  dicroticNotchTime: number;
  systolicDuration: number;
  diastolicDuration: number;

  // Variability (12 features)
  sdnn: number;
  rmssd: number;
  pnn50: number;
  hrvPowerVLF: number;
  hrvPowerLF: number;
  hrvPowerHF: number;
  lfHfRatio: number;
  sampleEntropy: number;
  poincareSd1: number;
  poincareSd2: number;
  sd1Sd2Ratio: number;
  triangularIndex: number;

  // Spectral (8 features)
  dominantFrequency: number;
  secondHarmonicRatio: number;
  thirdHarmonicRatio: number;
  fourthHarmonicRatio: number;
  fifthHarmonicRatio: number;
  spectralCentroid: number;
  spectralBandwidth: number;
  spectralRolloff: number;
}

// Cardano types
export interface WalletState {
  address: string;
  balance: bigint;
  enrollmentHash: string;
  isLocked: boolean;
}

export interface TransactionRequest {
  to: string;
  amount: bigint;
  message?: string;
  requiredAuthLevel: AuthLevel;
}

// Consent tiers
export enum ConsentTier {
  IdentityOnly = 1,       // Minimum: auth only, no recording
  HealthMonitoring = 2,   // Store waveform for health insights
  MeshPresence = 3,       // Participate in mesh coupling
  ForensicRecording = 4,  // Store timestamped recordings for evidence
  CouplingSharing = 5,    // Share coupling events with paired contacts
}

export interface PrivacySettings {
  enabledTiers: Set<ConsentTier>;
  recordingRetentionDays: number;
  meshDiscoverable: boolean;
  couplingContacts: string[]; // Cardano addresses of paired contacts
}
