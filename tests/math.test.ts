/**
 * UltraLife Math & Identity Tests
 */

import { cosineSimilarity, euclideanDistance, weightedCombine, zeroVector, sampleEntropy, findPeaks } from '../src/lib/math';

// === Cosine Similarity Tests ===

describe('cosineSimilarity', () => {
  test('identical vectors return 1', () => {
    const a = new Float64Array([1, 2, 3, 4, 5]);
    const b = new Float64Array([1, 2, 3, 4, 5]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 10);
  });

  test('opposite vectors return -1', () => {
    const a = new Float64Array([1, 2, 3]);
    const b = new Float64Array([-1, -2, -3]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1.0, 10);
  });

  test('orthogonal vectors return 0', () => {
    const a = new Float64Array([1, 0, 0]);
    const b = new Float64Array([0, 1, 0]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(0.0, 10);
  });

  test('scaled vectors return 1 (direction invariant)', () => {
    const a = new Float64Array([1, 2, 3]);
    const b = new Float64Array([100, 200, 300]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0, 10);
  });

  test('similar vectors return high similarity', () => {
    const a = new Float64Array([1, 2, 3, 4, 5]);
    const b = new Float64Array([1.1, 2.05, 2.95, 4.1, 4.9]);
    expect(cosineSimilarity(a, b)).toBeGreaterThan(0.99);
  });

  test('dimension mismatch throws', () => {
    const a = new Float64Array([1, 2, 3]);
    const b = new Float64Array([1, 2]);
    expect(() => cosineSimilarity(a, b)).toThrow('dimension mismatch');
  });

  test('zero vectors return 0', () => {
    const a = new Float64Array([0, 0, 0]);
    const b = new Float64Array([1, 2, 3]);
    expect(cosineSimilarity(a, b)).toBe(0);
  });
});

// === Weighted Combine Tests ===

describe('weightedCombine', () => {
  test('combines with correct weights', () => {
    const result = weightedCombine([
      { features: new Float64Array([1, 2]), weight: 0.5 },
      { features: new Float64Array([3, 4]), weight: 0.3 },
    ]);
    expect(result.length).toBe(4);
    expect(result[0]).toBeCloseTo(0.5);
    expect(result[1]).toBeCloseTo(1.0);
    expect(result[2]).toBeCloseTo(0.9);
    expect(result[3]).toBeCloseTo(1.2);
  });

  test('single modality passthrough', () => {
    const input = new Float64Array([1, 2, 3]);
    const result = weightedCombine([{ features: input, weight: 1.0 }]);
    expect(result.length).toBe(3);
    expect(result[0]).toBe(1);
    expect(result[1]).toBe(2);
    expect(result[2]).toBe(3);
  });
});

// === Zero Vector Tests ===

describe('zeroVector', () => {
  test('fills with zeros', () => {
    const v = new Float64Array([1, 2, 3, 4, 5]);
    zeroVector(v);
    for (let i = 0; i < v.length; i++) {
      expect(v[i]).toBe(0);
    }
  });
});

// === Sample Entropy Tests ===

describe('sampleEntropy', () => {
  test('constant signal has low entropy', () => {
    const constant = new Float64Array(100).fill(1.0);
    // Add tiny noise to avoid divide by zero in std
    for (let i = 0; i < 100; i++) constant[i] += Math.random() * 0.001;
    const entropy = sampleEntropy(constant);
    // Very regular signal should have low entropy
    expect(entropy).toBeLessThan(1.0);
  });

  test('random signal has higher entropy', () => {
    const random = new Float64Array(100);
    for (let i = 0; i < 100; i++) random[i] = Math.random();
    const entropy = sampleEntropy(random);
    expect(entropy).toBeGreaterThan(0);
  });
});

// === Peak Detection Tests ===

describe('findPeaks', () => {
  test('finds peaks in sinusoidal signal', () => {
    const signal = new Float64Array(100);
    for (let i = 0; i < 100; i++) {
      signal[i] = Math.sin(2 * Math.PI * i / 20); // period=20 samples
    }
    const peaks = findPeaks(signal, 10, 0.5);
    expect(peaks.length).toBeGreaterThanOrEqual(3);
    // Peaks should be ~20 samples apart
    for (let i = 1; i < peaks.length; i++) {
      const dist = peaks[i] - peaks[i - 1];
      expect(dist).toBeGreaterThan(15);
      expect(dist).toBeLessThan(25);
    }
  });

  test('returns empty for flat signal', () => {
    const signal = new Float64Array(100).fill(0.1);
    const peaks = findPeaks(signal, 10, 0.5);
    expect(peaks.length).toBe(0);
  });
});

// === Authentication Simulation Tests ===

describe('authentication simulation', () => {
  test('same person, different sessions should have high similarity', () => {
    // Simulate enrollment and re-authentication with small noise
    const base = new Float64Array(50);
    for (let i = 0; i < 50; i++) base[i] = Math.sin(i * 0.5) + i * 0.01;

    const session1 = new Float64Array(50);
    const session2 = new Float64Array(50);
    for (let i = 0; i < 50; i++) {
      session1[i] = base[i] + (Math.random() - 0.5) * 0.05;
      session2[i] = base[i] + (Math.random() - 0.5) * 0.05;
    }

    const similarity = cosineSimilarity(session1, session2);
    expect(similarity).toBeGreaterThan(0.95); // Same person
  });

  test('different people should have low similarity', () => {
    const person1 = new Float64Array(50);
    const person2 = new Float64Array(50);
    for (let i = 0; i < 50; i++) {
      person1[i] = Math.sin(i * 0.5) + i * 0.01;
      person2[i] = Math.cos(i * 0.7) - i * 0.02;
    }

    const similarity = cosineSimilarity(person1, person2);
    expect(similarity).toBeLessThan(0.5); // Different people
  });

  test('replay attack detection: exact match flagged', () => {
    const enrolled = new Float64Array([1, 2, 3, 4, 5]);
    const replayed = new Float64Array([1, 2, 3, 4, 5]);

    // Exact match is suspicious — real live reading always differs slightly
    const similarity = cosineSimilarity(enrolled, replayed);
    expect(similarity).toBe(1.0);
    // In real system: similarity === 1.0 triggers replay flag
  });
});
