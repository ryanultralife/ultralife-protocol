/**
 * UltraLife Touch Engine
 * 
 * Extracts behavioral biometric features from touchscreen interactions.
 * Captures subconscious patterns that are extremely hard to replicate.
 */

import { FeatureVector, TouchEvent } from '../lib/types';

const TOUCH_FEATURE_COUNT = 25;

export class TouchEngine {
  private recentEvents: TouchEvent[] = [];
  private readonly BUFFER_MAX = 500;

  extractFeatures(events: TouchEvent[]): FeatureVector {
    const features = new Float64Array(TOUCH_FEATURE_COUNT);
    if (events.length < 5) return features;

    let idx = 0;

    // Separate by type
    const downs = events.filter(e => e.type === 'down');
    const moves = events.filter(e => e.type === 'move');
    const ups = events.filter(e => e.type === 'up');

    // === Pressure features (8) ===
    const pressures = events.map(e => e.pressure).filter(p => p > 0);
    if (pressures.length > 0) {
      features[idx++] = this.mean(pressures);
      features[idx++] = this.std(pressures);
      features[idx++] = Math.max(...pressures);
      features[idx++] = Math.min(...pressures);
      // Pressure curve: mean rise rate
      const downPressures = downs.map(e => e.pressure);
      features[idx++] = downPressures.length > 1 
        ? this.mean(this.diff(downPressures)) : 0;
      // Pressure skewness
      features[idx++] = this.skewness(pressures);
      // Pressure kurtosis
      features[idx++] = this.kurtosis(pressures);
      // Mean touch area
      features[idx++] = this.mean(events.map(e => e.area));
    } else {
      idx += 8;
    }

    // === Timing features (10) ===
    // Inter-tap intervals
    if (downs.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < downs.length; i++) {
        intervals.push(downs[i].timestamp - downs[i - 1].timestamp);
      }
      features[idx++] = this.mean(intervals);
      features[idx++] = this.std(intervals);
      features[idx++] = this.median(intervals);

      // Hold durations (down to up)
      const holds: number[] = [];
      for (let i = 0; i < Math.min(downs.length, ups.length); i++) {
        holds.push(ups[i].timestamp - downs[i].timestamp);
      }
      features[idx++] = this.mean(holds);
      features[idx++] = this.std(holds);

      // Swipe velocity (for move events)
      if (moves.length > 1) {
        const velocities: number[] = [];
        for (let i = 1; i < moves.length; i++) {
          const dt = moves[i].timestamp - moves[i - 1].timestamp;
          if (dt > 0) {
            const dx = moves[i].x - moves[i - 1].x;
            const dy = moves[i].y - moves[i - 1].y;
            velocities.push(Math.sqrt(dx * dx + dy * dy) / dt);
          }
        }
        features[idx++] = velocities.length > 0 ? this.mean(velocities) : 0;
        features[idx++] = velocities.length > 0 ? this.std(velocities) : 0;

        // Swipe acceleration
        if (velocities.length > 1) {
          const accels = this.diff(velocities);
          features[idx++] = this.mean(accels.map(Math.abs));
        } else { idx++; }
      } else { idx += 3; }

      // Rhythm regularity (CV of inter-tap intervals)
      const meanInterval = this.mean(intervals);
      features[idx++] = meanInterval > 0 ? this.std(intervals) / meanInterval : 0;

      // Temporal entropy
      features[idx++] = this.entropy(intervals);
    } else {
      idx += 10;
    }

    // === Spatial features (7) ===
    if (downs.length > 0) {
      const xs = downs.map(e => e.x);
      const ys = downs.map(e => e.y);

      // Touch centroid
      features[idx++] = this.mean(xs);
      features[idx++] = this.mean(ys);

      // Touch spread
      features[idx++] = this.std(xs);
      features[idx++] = this.std(ys);

      // Drift during hold (how much finger moves while "tapping")
      if (moves.length > 0) {
        const drifts: number[] = [];
        let lastDown = downs[0];
        for (const m of moves) {
          drifts.push(Math.sqrt((m.x - lastDown.x) ** 2 + (m.y - lastDown.y) ** 2));
        }
        features[idx++] = this.mean(drifts);
      } else { idx++; }

      // Swipe curvature (deviation from straight line)
      if (moves.length > 2) {
        const startX = moves[0].x, startY = moves[0].y;
        const endX = moves[moves.length - 1].x, endY = moves[moves.length - 1].y;
        const lineLen = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
        let pathLen = 0;
        for (let i = 1; i < moves.length; i++) {
          pathLen += Math.sqrt(
            (moves[i].x - moves[i - 1].x) ** 2 + (moves[i].y - moves[i - 1].y) ** 2
          );
        }
        features[idx++] = lineLen > 0 ? pathLen / lineLen : 1;
      } else { idx++; }

      // Target offset pattern (how far from "intended" target)
      features[idx++] = this.std(xs.map((x) => x - this.mean(xs)));
    }

    return features;
  }

  assessQuality(features: FeatureVector): number {
    const sum = features.reduce((s, v) => s + Math.abs(v), 0);
    if (sum < 0.001) return 0;
    for (let i = 0; i < features.length; i++) {
      if (!isFinite(features[i])) return 0.1;
    }
    return 0.8; // Touch is supplementary; lower baseline quality
  }

  feedEvent(event: TouchEvent): void {
    this.recentEvents.push(event);
    if (this.recentEvents.length > this.BUFFER_MAX) {
      this.recentEvents.shift();
    }
  }

  getRecentBuffer(): FeatureVector | null {
    if (this.recentEvents.length < 10) return null;
    return this.extractFeatures(this.recentEvents);
  }

  // === Helpers ===
  private mean(a: number[]): number { return a.reduce((s, v) => s + v, 0) / a.length; }
  private std(a: number[]): number {
    const m = this.mean(a);
    return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length);
  }
  private median(a: number[]): number {
    const s = [...a].sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  }
  private diff(a: number[]): number[] {
    return a.slice(1).map((v, i) => v - a[i]);
  }
  private skewness(a: number[]): number {
    const m = this.mean(a), s = this.std(a), n = a.length;
    if (s === 0) return 0;
    return a.reduce((sum, v) => sum + ((v - m) / s) ** 3, 0) / n;
  }
  private kurtosis(a: number[]): number {
    const m = this.mean(a), s = this.std(a), n = a.length;
    if (s === 0) return 0;
    return a.reduce((sum, v) => sum + ((v - m) / s) ** 4, 0) / n - 3;
  }
  private entropy(a: number[]): number {
    const total = a.reduce((s, v) => s + Math.abs(v), 0);
    if (total === 0) return 0;
    let h = 0;
    for (const v of a) {
      const p = Math.abs(v) / total;
      if (p > 0) h -= p * Math.log2(p);
    }
    return h;
  }
}
