/**
 * UltraLife Cardiac Engine
 * 
 * Processes photoplethysmography (PPG) signals from phone camera.
 * Extracts cardiac features that form the highest-weight component
 * of the identity eigenvector.
 * 
 * PPG method: finger on rear camera + flash. Red channel captures
 * blood volume pulse. Each cardiac cycle produces a characteristic
 * waveform whose morphology is genetically determined (ion channel kinetics).
 */

import { FeatureVector } from '../lib/types';
import { findPeaks, magnitudeSpectrum, sampleEntropy } from '../lib/math';

// PPG processing constants
const PPG_SAMPLE_RATE = 30; // Camera fps
const MIN_HR = 40;  // BPM
const MAX_HR = 200; // BPM
const MIN_PEAK_DISTANCE = Math.floor(PPG_SAMPLE_RATE * 60 / MAX_HR); // samples
const CARDIAC_FEATURE_COUNT = 43;

export class CardiacEngine {
  /**
   * Extract cardiac feature vector from PPG frames.
   * 
   * Input: Array of PPG signal values (red channel intensity over time)
   * Output: 43-dimensional feature vector
   */
  extractFeatures(ppgFrames: Float64Array[]): FeatureVector {
    // If ppgFrames is array of frame objects, extract red channel
    // For now, assume ppgFrames[0] is the continuous red channel signal
    const signal = ppgFrames[0];
    
    if (signal.length < PPG_SAMPLE_RATE * 5) {
      throw new Error('PPG signal too short. Need at least 5 seconds.');
    }

    // Bandpass filter: 0.5-4 Hz (30-240 BPM range)
    const filtered = this.bandpassFilter(signal, 0.5, 4.0, PPG_SAMPLE_RATE);

    // Detect peaks (systolic peaks)
    const peaks = findPeaks(filtered, MIN_PEAK_DISTANCE, 0.4);

    if (peaks.length < 5) {
      throw new Error('Too few cardiac cycles detected. Check finger placement.');
    }

    // Extract RR intervals
    const rrIntervals = new Float64Array(peaks.length - 1);
    for (let i = 0; i < peaks.length - 1; i++) {
      rrIntervals[i] = (peaks[i + 1] - peaks[i]) / PPG_SAMPLE_RATE; // seconds
    }

    // Extract per-beat waveforms
    const beats = this.segmentBeats(filtered, peaks);

    // Build feature vector
    const features = new Float64Array(CARDIAC_FEATURE_COUNT);
    let idx = 0;

    // === Morphological features (15) ===
    const morpho = this.extractMorphological(beats, filtered, peaks);
    features.set(morpho, idx); idx += morpho.length;

    // === Interval features (8) ===
    const intervals = this.extractIntervals(rrIntervals);
    features.set(intervals, idx); idx += intervals.length;

    // === Variability features (12) ===
    const hrv = this.extractHRV(rrIntervals);
    features.set(hrv, idx); idx += hrv.length;

    // === Spectral features (8) ===
    const spectral = this.extractSpectral(filtered, peaks);
    features.set(spectral, idx);

    return features;
  }

  /**
   * Assess quality of cardiac features
   * Returns 0-1 score. Below 0.6 = reject enrollment.
   */
  assessQuality(features: FeatureVector): number {
    let score = 1.0;

    // Check heart rate is physiological
    const hr = features[16]; // heartRate index
    if (hr < MIN_HR || hr > MAX_HR) score *= 0.3;
    else if (hr < 50 || hr > 150) score *= 0.7;

    // Check HRV is present (not flat signal)
    const sdnn = features[23]; // sdnn index
    if (sdnn < 5) score *= 0.4; // Very low variability = possible artifact

    // Check feature vector has no NaN/Inf
    for (let i = 0; i < features.length; i++) {
      if (!isFinite(features[i])) {
        score *= 0.1;
        break;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Liveness check — real hearts have specific variability patterns
   * that recordings/synthesis typically don't reproduce.
   * 
   * Returns 0-1 liveness confidence.
   */
  checkLiveness(ppgFrames: Float64Array[]): number {
    const signal = ppgFrames[0];
    const filtered = this.bandpassFilter(signal, 0.5, 4.0, PPG_SAMPLE_RATE);
    const peaks = findPeaks(filtered, MIN_PEAK_DISTANCE, 0.4);

    if (peaks.length < 10) return 0;

    const rrIntervals = new Float64Array(peaks.length - 1);
    for (let i = 0; i < peaks.length - 1; i++) {
      rrIntervals[i] = (peaks[i + 1] - peaks[i]) / PPG_SAMPLE_RATE;
    }

    let score = 1.0;

    // Check 1: RR intervals should have respiratory sinus arrhythmia
    // (0.15-0.4 Hz modulation of heart rate)
    const rrSpectrum = magnitudeSpectrum(rrIntervals);
    const respiratoryBand = this.bandPower(rrSpectrum, 0.15, 0.4, 1.0 / this.mean(rrIntervals));
    const totalPower = rrSpectrum.reduce((s, v) => s + v * v, 0);
    const rsaRatio = respiratoryBand / (totalPower + 1e-12);

    if (rsaRatio < 0.05) score *= 0.5; // No respiratory modulation = suspicious

    // Check 2: Sample entropy should be in biological range (0.5-2.5)
    const entropy = sampleEntropy(rrIntervals, 2, 0.2);
    if (entropy < 0.3 || entropy > 3.0) score *= 0.5;
    if (entropy < 0.1) score *= 0.3; // Very regular = likely synthetic

    // Check 3: Beat-to-beat morphology should vary slightly
    const beats = this.segmentBeats(filtered, peaks);
    if (beats.length >= 5) {
      const morphoVariance = this.beatMorphologyVariance(beats);
      if (morphoVariance < 0.001) score *= 0.4; // Too identical = recording
      if (morphoVariance > 0.5) score *= 0.6;   // Too variable = noisy/fake
    }

    // Check 4: Successive RR differences should be non-zero
    let zeroSuccDiff = 0;
    for (let i = 0; i < rrIntervals.length - 1; i++) {
      if (Math.abs(rrIntervals[i + 1] - rrIntervals[i]) < 0.001) zeroSuccDiff++;
    }
    if (zeroSuccDiff / (rrIntervals.length - 1) > 0.5) score *= 0.3;

    return Math.max(0, Math.min(1, score));
  }

  // === Private feature extraction methods ===

  private extractMorphological(
    beats: Float64Array[],
    signal: Float64Array,
    peaks: number[],
  ): Float64Array {
    const features = new Float64Array(15);
    if (beats.length === 0) return features;

    // Average beat morphology
    const avgBeat = this.averageBeat(beats);
    const beatLen = avgBeat.length;
    const peakIdx = this.argmax(avgBeat);

    features[0] = avgBeat[peakIdx]; // systolic peak amplitude
    
    // Find diastolic notch (local minimum after peak)
    let notchIdx = peakIdx;
    for (let i = peakIdx + 1; i < beatLen - 1; i++) {
      if (avgBeat[i] < avgBeat[i - 1] && avgBeat[i] < avgBeat[i + 1]) {
        notchIdx = i; break;
      }
    }
    features[1] = avgBeat[notchIdx]; // diastolic notch depth

    // Pulse width at 50% amplitude
    const half = avgBeat[peakIdx] * 0.5;
    let w50start = 0, w50end = beatLen - 1;
    for (let i = 0; i < peakIdx; i++) { if (avgBeat[i] >= half) { w50start = i; break; } }
    for (let i = peakIdx; i < beatLen; i++) { if (avgBeat[i] < half) { w50end = i; break; } }
    features[2] = (w50end - w50start) / PPG_SAMPLE_RATE; // pulse width at 50%

    features[3] = peakIdx / PPG_SAMPLE_RATE; // rise time
    features[4] = (beatLen - peakIdx) / PPG_SAMPLE_RATE; // fall time
    
    // Systolic and diastolic areas
    let sysArea = 0, diaArea = 0;
    for (let i = 0; i < notchIdx; i++) sysArea += avgBeat[i];
    for (let i = notchIdx; i < beatLen; i++) diaArea += avgBeat[i];
    features[5] = sysArea / PPG_SAMPLE_RATE;
    features[6] = diaArea / PPG_SAMPLE_RATE;

    // Peak sharpness (second derivative at peak)
    if (peakIdx > 0 && peakIdx < beatLen - 1) {
      features[7] = avgBeat[peakIdx - 1] - 2 * avgBeat[peakIdx] + avgBeat[peakIdx + 1];
    }

    // Waveform symmetry
    features[8] = features[3] / (features[3] + features[4] + 1e-12);

    // Augmentation index
    features[9] = features[1] / (features[0] + 1e-12);

    // Remaining morphological features
    features[10] = features[6] / (features[5] + 1e-12); // reflection index
    features[11] = features[0] / (features[3] + 1e-12); // stiffness proxy
    features[12] = peakIdx / (beatLen + 1e-12); // crest time ratio
    features[13] = (notchIdx - peakIdx) / PPG_SAMPLE_RATE; // delta T
    features[14] = features[0] / (this.mean(avgBeat) + 1e-12); // pulse amplitude ratio

    return features;
  }

  private extractIntervals(rrIntervals: Float64Array): Float64Array {
    const features = new Float64Array(8);
    
    features[0] = this.mean(rrIntervals); // mean RR
    features[1] = 60.0 / features[0]; // heart rate (BPM)
    features[2] = 0; // pulse transit time (needs two sensors — placeholder)
    features[3] = 0; // pre-ejection period (placeholder)
    features[4] = features[0] * 0.35; // LVET estimate (~35% of RR)
    features[5] = features[0] * 0.4; // dicrotic notch time estimate
    features[6] = features[0] * 0.35; // systolic duration estimate
    features[7] = features[0] * 0.65; // diastolic duration estimate

    return features;
  }

  private extractHRV(rrIntervals: Float64Array): Float64Array {
    const features = new Float64Array(12);
    const n = rrIntervals.length;
    const mean = this.mean(rrIntervals);

    // SDNN
    let sdnn = 0;
    for (let i = 0; i < n; i++) {
      sdnn += (rrIntervals[i] - mean) ** 2;
    }
    sdnn = Math.sqrt(sdnn / n);
    features[0] = sdnn * 1000; // ms

    // RMSSD
    let rmssd = 0;
    for (let i = 0; i < n - 1; i++) {
      rmssd += (rrIntervals[i + 1] - rrIntervals[i]) ** 2;
    }
    rmssd = Math.sqrt(rmssd / (n - 1));
    features[1] = rmssd * 1000; // ms

    // pNN50
    let nn50 = 0;
    for (let i = 0; i < n - 1; i++) {
      if (Math.abs(rrIntervals[i + 1] - rrIntervals[i]) > 0.05) nn50++;
    }
    features[2] = nn50 / (n - 1);

    // Spectral HRV (from RR interval spectrum)
    const spectrum = magnitudeSpectrum(rrIntervals);
    const rrSampleRate = 1.0 / mean;

    features[3] = this.bandPower(spectrum, 0.003, 0.04, rrSampleRate); // VLF
    features[4] = this.bandPower(spectrum, 0.04, 0.15, rrSampleRate);  // LF
    features[5] = this.bandPower(spectrum, 0.15, 0.4, rrSampleRate);   // HF
    features[6] = features[4] / (features[5] + 1e-12); // LF/HF ratio

    // Sample entropy
    features[7] = sampleEntropy(rrIntervals, 2, 0.2);

    // Poincaré plot features
    let sd1 = 0, sd2 = 0;
    for (let i = 0; i < n - 1; i++) {
      const x1 = (rrIntervals[i + 1] - rrIntervals[i]) / Math.SQRT2;
      const x2 = (rrIntervals[i + 1] + rrIntervals[i]) / Math.SQRT2;
      sd1 += x1 * x1;
      sd2 += (x2 - mean * Math.SQRT2) ** 2;
    }
    features[8] = Math.sqrt(sd1 / (n - 1)) * 1000; // SD1 ms
    features[9] = Math.sqrt(sd2 / (n - 1)) * 1000; // SD2 ms
    features[10] = features[8] / (features[9] + 1e-12); // SD1/SD2

    // Triangular index (approximate)
    features[11] = n / (sdnn * 128 + 1e-12);

    return features;
  }

  private extractSpectral(signal: Float64Array, peaks: number[]): Float64Array {
    const features = new Float64Array(8);
    const spectrum = magnitudeSpectrum(signal);
    const n = spectrum.length;
    const freqRes = PPG_SAMPLE_RATE / (signal.length * 2);

    // Dominant frequency
    let maxMag = 0, maxIdx = 0;
    for (let i = 1; i < n; i++) {
      if (spectrum[i] > maxMag) { maxMag = spectrum[i]; maxIdx = i; }
    }
    features[0] = maxIdx * freqRes;

    // Harmonic ratios (2nd through 5th relative to fundamental)
    const fundIdx = maxIdx;
    for (let h = 2; h <= 5; h++) {
      const hIdx = Math.min(fundIdx * h, n - 1);
      features[h - 1] = spectrum[hIdx] / (maxMag + 1e-12);
    }

    // Spectral centroid
    let weightedSum = 0, totalMag = 0;
    for (let i = 0; i < n; i++) {
      weightedSum += i * freqRes * spectrum[i];
      totalMag += spectrum[i];
    }
    features[5] = weightedSum / (totalMag + 1e-12);

    // Spectral bandwidth
    let bwSum = 0;
    for (let i = 0; i < n; i++) {
      bwSum += spectrum[i] * (i * freqRes - features[5]) ** 2;
    }
    features[6] = Math.sqrt(bwSum / (totalMag + 1e-12));

    // Spectral rolloff (frequency below which 85% of energy)
    let cumEnergy = 0;
    const totalEnergy = spectrum.reduce((s, v) => s + v * v, 0);
    for (let i = 0; i < n; i++) {
      cumEnergy += spectrum[i] * spectrum[i];
      if (cumEnergy >= 0.85 * totalEnergy) {
        features[7] = i * freqRes;
        break;
      }
    }

    return features;
  }

  // === Signal processing helpers ===

  private bandpassFilter(
    signal: Float64Array,
    lowHz: number,
    highHz: number,
    sampleRate: number,
  ): Float64Array {
    // Simple 2nd order Butterworth bandpass (for MVP)
    // TODO: Replace with proper IIR filter library
    const result = new Float64Array(signal.length);
    const dt = 1.0 / sampleRate;
    const rc_low = 1.0 / (2 * Math.PI * highHz);
    const rc_high = 1.0 / (2 * Math.PI * lowHz);
    const alpha_low = dt / (rc_low + dt);
    const alpha_high = rc_high / (rc_high + dt);

    // High-pass then low-pass
    const hp = new Float64Array(signal.length);
    hp[0] = signal[0];
    for (let i = 1; i < signal.length; i++) {
      hp[i] = alpha_high * (hp[i - 1] + signal[i] - signal[i - 1]);
    }

    result[0] = hp[0];
    for (let i = 1; i < signal.length; i++) {
      result[i] = result[i - 1] + alpha_low * (hp[i] - result[i - 1]);
    }

    return result;
  }

  private segmentBeats(signal: Float64Array, peaks: number[]): Float64Array[] {
    const beats: Float64Array[] = [];
    for (let i = 0; i < peaks.length - 1; i++) {
      const start = peaks[i];
      const end = peaks[i + 1];
      if (end <= start || end > signal.length) continue;
      beats.push(signal.slice(start, end));
    }
    return beats;
  }

  private averageBeat(beats: Float64Array[]): Float64Array {
    if (beats.length === 0) return new Float64Array(0);

    // Resample all beats to same length (median length)
    const lengths = beats.map(b => b.length).sort((a, b) => a - b);
    const targetLen = lengths[Math.floor(lengths.length / 2)];

    const avg = new Float64Array(targetLen);
    let count = 0;

    for (const beat of beats) {
      const resampled = this.resample(beat, targetLen);
      for (let i = 0; i < targetLen; i++) {
        avg[i] += resampled[i];
      }
      count++;
    }

    for (let i = 0; i < targetLen; i++) {
      avg[i] /= count;
    }

    return avg;
  }

  private beatMorphologyVariance(beats: Float64Array[]): number {
    const avg = this.averageBeat(beats);
    const targetLen = avg.length;
    let totalVar = 0;

    for (const beat of beats) {
      const resampled = this.resample(beat, targetLen);
      for (let i = 0; i < targetLen; i++) {
        totalVar += (resampled[i] - avg[i]) ** 2;
      }
    }

    return totalVar / (beats.length * targetLen);
  }

  private resample(signal: Float64Array, targetLen: number): Float64Array {
    const result = new Float64Array(targetLen);
    const ratio = (signal.length - 1) / (targetLen - 1);

    for (let i = 0; i < targetLen; i++) {
      const srcIdx = i * ratio;
      const low = Math.floor(srcIdx);
      const high = Math.min(low + 1, signal.length - 1);
      const frac = srcIdx - low;
      result[i] = signal[low] * (1 - frac) + signal[high] * frac;
    }

    return result;
  }

  private bandPower(
    spectrum: Float64Array,
    lowHz: number,
    highHz: number,
    sampleRate: number,
  ): number {
    const n = spectrum.length;
    const freqRes = sampleRate / (n * 2);
    let power = 0;

    for (let i = 0; i < n; i++) {
      const freq = i * freqRes;
      if (freq >= lowHz && freq <= highHz) {
        power += spectrum[i] * spectrum[i];
      }
    }

    return power;
  }

  private mean(arr: Float64Array): number {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }

  private argmax(arr: Float64Array): number {
    let maxIdx = 0;
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] > arr[maxIdx]) maxIdx = i;
    }
    return maxIdx;
  }
}
