/**
 * UltraLife Math Utilities
 * 
 * Core vector operations for identity computation.
 * All operations work on Float64Array for precision.
 */

import { FeatureVector } from './types';

/**
 * Cosine similarity between two feature vectors.
 * This is the eigenvalue check — how well the live reading
 * aligns with the enrolled identity direction.
 * 
 * Returns: value in [-1, 1], where 1 = identical direction
 */
export function cosineSimilarity(a: FeatureVector, b: FeatureVector): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;

  return dot / denom;
}

/**
 * Euclidean distance between two vectors
 */
export function euclideanDistance(a: FeatureVector, b: FeatureVector): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Combine multiple modality feature vectors with weights.
 * Produces a single identity vector.
 */
export function weightedCombine(
  modalities: { features: FeatureVector; weight: number }[]
): FeatureVector {
  // Total dimension is sum of all modality dimensions
  const totalDim = modalities.reduce((sum, m) => sum + m.features.length, 0);
  const result = new Float64Array(totalDim);

  let offset = 0;
  for (const { features, weight } of modalities) {
    for (let i = 0; i < features.length; i++) {
      result[offset + i] = features[i] * weight;
    }
    offset += features.length;
  }

  return result;
}

/**
 * Z-score normalize a feature vector against enrollment statistics
 */
export function zScoreNormalize(
  vector: FeatureVector,
  mean: FeatureVector,
  std: FeatureVector,
): FeatureVector {
  const result = new Float64Array(vector.length);
  for (let i = 0; i < vector.length; i++) {
    const s = std[i] === 0 ? 1 : std[i];
    result[i] = (vector[i] - mean[i]) / s;
  }
  return result;
}

/**
 * Compute mean and std of a set of feature vectors
 */
export function computeStats(vectors: FeatureVector[]): {
  mean: FeatureVector;
  std: FeatureVector;
} {
  const dim = vectors[0].length;
  const n = vectors.length;
  const mean = new Float64Array(dim);
  const std = new Float64Array(dim);

  // Mean
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      mean[i] += v[i] / n;
    }
  }

  // Std
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      const diff = v[i] - mean[i];
      std[i] += (diff * diff) / n;
    }
  }
  for (let i = 0; i < dim; i++) {
    std[i] = Math.sqrt(std[i]);
  }

  return { mean, std };
}

/**
 * SECURITY: Zero out a feature vector in memory.
 * Called after authentication to prevent biometric data persistence.
 */
export function zeroVector(vector: FeatureVector): void {
  vector.fill(0);
}

/**
 * Sample entropy — measures signal complexity/unpredictability.
 * Used for liveness detection: real biological signals have
 * specific entropy ranges; synthetic signals typically don't.
 */
export function sampleEntropy(
  signal: Float64Array,
  m: number = 2,
  r: number = 0.2,
): number {
  const n = signal.length;
  const std = Math.sqrt(
    signal.reduce((s, v) => s + v * v, 0) / n -
    Math.pow(signal.reduce((s, v) => s + v, 0) / n, 2)
  );
  const tolerance = r * std;

  let A = 0; // matches of length m+1
  let B = 0; // matches of length m

  for (let i = 0; i < n - m; i++) {
    for (let j = i + 1; j < n - m; j++) {
      // Check m-length match
      let match = true;
      for (let k = 0; k < m; k++) {
        if (Math.abs(signal[i + k] - signal[j + k]) > tolerance) {
          match = false;
          break;
        }
      }
      if (match) {
        B++;
        // Check m+1 length match
        if (Math.abs(signal[i + m] - signal[j + m]) <= tolerance) {
          A++;
        }
      }
    }
  }

  if (B === 0) return Infinity;
  return -Math.log(A / B);
}

/**
 * FFT magnitude spectrum (simple DFT for feature extraction)
 * For production, use a proper FFT library.
 */
export function magnitudeSpectrum(signal: Float64Array): Float64Array {
  const n = signal.length;
  const half = Math.floor(n / 2);
  const result = new Float64Array(half);

  for (let k = 0; k < half; k++) {
    let real = 0;
    let imag = 0;
    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      real += signal[t] * Math.cos(angle);
      imag -= signal[t] * Math.sin(angle);
    }
    result[k] = Math.sqrt(real * real + imag * imag) / n;
  }

  return result;
}

/**
 * Find peaks in a signal (for beat detection)
 */
export function findPeaks(
  signal: Float64Array,
  minDistance: number = 10,
  threshold: number = 0.5,
): number[] {
  const peaks: number[] = [];
  const maxVal = Math.max(...signal);
  const absThreshold = threshold * maxVal;

  for (let i = 1; i < signal.length - 1; i++) {
    if (signal[i] > absThreshold &&
        signal[i] > signal[i - 1] &&
        signal[i] > signal[i + 1]) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
        peaks.push(i);
      }
    }
  }

  return peaks;
}
