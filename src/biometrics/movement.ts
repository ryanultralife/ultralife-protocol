/**
 * UltraLife Movement Engine
 * 
 * Processes accelerometer + gyroscope data for gait signature,
 * device interaction patterns, and postural dynamics.
 */

import { FeatureVector } from '../lib/types';
import { magnitudeSpectrum } from '../lib/math';

const MOVEMENT_FEATURE_COUNT = 30;
const ACCEL_SAMPLE_RATE = 100; // Hz (typical phone accelerometer)
const BUFFER_DURATION_S = 30;
const BUFFER_SIZE = ACCEL_SAMPLE_RATE * BUFFER_DURATION_S;

export class MovementEngine {
  private recentSamples: Float64Array[] = [];

  extractFeatures(accelData: Float64Array[]): FeatureVector {
    const features = new Float64Array(MOVEMENT_FEATURE_COUNT);
    
    // accelData: [x_samples, y_samples, z_samples] or interleaved
    // Assume 3 arrays: x, y, z
    const x = accelData[0] || new Float64Array(0);
    const y = accelData[1] || new Float64Array(0);
    const z = accelData[2] || new Float64Array(0);
    const n = Math.min(x.length, y.length, z.length);

    if (n < ACCEL_SAMPLE_RATE * 2) {
      return features; // Not enough data
    }

    // Magnitude signal
    const mag = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      mag[i] = Math.sqrt(x[i] ** 2 + y[i] ** 2 + z[i] ** 2);
    }

    let idx = 0;

    // === Gait features (12) ===
    const spectrum = magnitudeSpectrum(mag);
    
    // Step frequency (dominant frequency in 0.5-3 Hz gait band)
    const gaitLow = Math.floor(0.5 * mag.length / ACCEL_SAMPLE_RATE);
    const gaitHigh = Math.floor(3.0 * mag.length / ACCEL_SAMPLE_RATE);
    let maxGait = 0, maxGaitIdx = gaitLow;
    for (let i = gaitLow; i <= Math.min(gaitHigh, spectrum.length - 1); i++) {
      if (spectrum[i] > maxGait) { maxGait = spectrum[i]; maxGaitIdx = i; }
    }
    features[idx++] = maxGaitIdx * ACCEL_SAMPLE_RATE / (mag.length * 2); // step freq

    // Step regularity (autocorrelation at step period)
    const stepPeriod = Math.round(ACCEL_SAMPLE_RATE / features[0] || ACCEL_SAMPLE_RATE);
    features[idx++] = this.autocorrelation(mag, stepPeriod);

    // Stride symmetry (autocorrelation at 2x step period)
    features[idx++] = this.autocorrelation(mag, stepPeriod * 2);

    // Acceleration stats per axis
    features[idx++] = this.mean(x);
    features[idx++] = this.std(x);
    features[idx++] = this.mean(y);
    features[idx++] = this.std(y);
    features[idx++] = this.mean(z);
    features[idx++] = this.std(z);

    // Magnitude stats
    features[idx++] = this.mean(mag);
    features[idx++] = this.std(mag);
    features[idx++] = this.rms(mag);

    // === Postural features (8) ===
    // Static sway (low-frequency component)
    features[idx++] = this.bandEnergy(spectrum, 0.1, 0.5, ACCEL_SAMPLE_RATE, mag.length);
    features[idx++] = this.bandEnergy(spectrum, 0.5, 2.0, ACCEL_SAMPLE_RATE, mag.length);
    
    // Tilt angles from mean acceleration
    const meanX = this.mean(x), meanY = this.mean(y), meanZ = this.mean(z);
    const meanMag = Math.sqrt(meanX ** 2 + meanY ** 2 + meanZ ** 2);
    features[idx++] = Math.acos(meanX / (meanMag + 1e-12)); // pitch
    features[idx++] = Math.acos(meanY / (meanMag + 1e-12)); // roll
    features[idx++] = Math.acos(meanZ / (meanMag + 1e-12)); // yaw
    
    // Jerk (derivative of acceleration)
    let jerkMag = 0;
    for (let i = 1; i < n; i++) {
      jerkMag += (mag[i] - mag[i - 1]) ** 2;
    }
    features[idx++] = Math.sqrt(jerkMag / (n - 1)) * ACCEL_SAMPLE_RATE;

    // === Device interaction features (10) ===
    // Pickup detection (sharp acceleration change)
    const accelChanges = new Float64Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
      accelChanges[i] = Math.abs(mag[i + 1] - mag[i]);
    }
    features[idx++] = this.max(accelChanges);
    features[idx++] = this.percentile(accelChanges, 95);

    // Micro-tremor (high-frequency component 5-25 Hz)
    features[idx++] = this.bandEnergy(spectrum, 5, 25, ACCEL_SAMPLE_RATE, mag.length);

    // Spectral centroid of movement
    let weightedSum = 0, totalMag = 0;
    const freqRes = ACCEL_SAMPLE_RATE / (mag.length * 2);
    for (let i = 0; i < spectrum.length; i++) {
      weightedSum += i * freqRes * spectrum[i];
      totalMag += spectrum[i];
    }
    features[idx++] = weightedSum / (totalMag + 1e-12);

    // Spectral entropy
    const totalPower = spectrum.reduce((s, v) => s + v * v, 0);
    let entropy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      const p = (spectrum[i] * spectrum[i]) / (totalPower + 1e-12);
      if (p > 0) entropy -= p * Math.log2(p);
    }
    features[idx++] = entropy;

    // Cross-axis correlation
    features[idx++] = this.correlation(x, y);
    features[idx++] = this.correlation(y, z);
    features[idx++] = this.correlation(x, z);

    // Movement complexity (sample entropy of magnitude)
    features[idx++] = this.approxEntropy(mag);

    return features;
  }

  assessQuality(features: FeatureVector): number {
    let score = 1.0;
    // Check for all-zero (no movement data)
    const sum = features.reduce((s, v) => s + Math.abs(v), 0);
    if (sum < 0.001) score = 0;
    // Check for NaN
    for (let i = 0; i < features.length; i++) {
      if (!isFinite(features[i])) { score *= 0.1; break; }
    }
    return score;
  }

  /**
   * Feed continuous samples for rolling buffer (continuous auth)
   */
  feedSample(x: number, y: number, z: number): void {
    // Store as interleaved for buffer
    if (this.recentSamples.length >= BUFFER_SIZE) {
      this.recentSamples.shift();
    }
    this.recentSamples.push(new Float64Array([x, y, z]));
  }

  /**
   * Get features from recent buffer (for continuous auth)
   */
  getRecentBuffer(): FeatureVector | null {
    if (this.recentSamples.length < ACCEL_SAMPLE_RATE * 5) return null;

    const n = this.recentSamples.length;
    const xArr = new Float64Array(n);
    const yArr = new Float64Array(n);
    const zArr = new Float64Array(n);

    for (let i = 0; i < n; i++) {
      xArr[i] = this.recentSamples[i][0];
      yArr[i] = this.recentSamples[i][1];
      zArr[i] = this.recentSamples[i][2];
    }

    return this.extractFeatures([xArr, yArr, zArr]);
  }

  // === Helpers ===

  private autocorrelation(signal: Float64Array, lag: number): number {
    const n = signal.length;
    if (lag >= n) return 0;
    const mean = this.mean(signal);
    let num = 0, den = 0;
    for (let i = 0; i < n - lag; i++) {
      num += (signal[i] - mean) * (signal[i + lag] - mean);
    }
    for (let i = 0; i < n; i++) {
      den += (signal[i] - mean) ** 2;
    }
    return num / (den + 1e-12);
  }

  private correlation(a: Float64Array, b: Float64Array): number {
    const n = Math.min(a.length, b.length);
    const ma = this.mean(a), mb = this.mean(b);
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) {
      num += (a[i] - ma) * (b[i] - mb);
      da += (a[i] - ma) ** 2;
      db += (b[i] - mb) ** 2;
    }
    return num / (Math.sqrt(da * db) + 1e-12);
  }

  private bandEnergy(spectrum: Float64Array, lo: number, hi: number, sr: number, sigLen: number): number {
    const freqRes = sr / (sigLen * 2);
    let energy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      const f = i * freqRes;
      if (f >= lo && f <= hi) energy += spectrum[i] ** 2;
    }
    return energy;
  }

  private mean(a: Float64Array): number { return a.reduce((s, v) => s + v, 0) / a.length; }
  private std(a: Float64Array): number {
    const m = this.mean(a);
    return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
  }
  private rms(a: Float64Array): number { return Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length); }
  private max(a: Float64Array): number { return Math.max(...a); }
  private percentile(a: Float64Array, p: number): number {
    const sorted = Array.from(a).sort((x, y) => x - y);
    return sorted[Math.floor(sorted.length * p / 100)];
  }
  private approxEntropy(signal: Float64Array): number {
    // Simplified approximate entropy
    const n = signal.length;
    const std = this.std(signal);
    const r = 0.2 * std;
    let count = 0;
    for (let i = 0; i < Math.min(n - 2, 200); i++) {
      for (let j = i + 1; j < Math.min(n - 2, 200); j++) {
        if (Math.abs(signal[i] - signal[j]) < r && Math.abs(signal[i + 1] - signal[j + 1]) < r) count++;
      }
    }
    return -Math.log((count + 1) / (n * n + 1));
  }
}
