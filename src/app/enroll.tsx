/**
 * UltraLife Enrollment Screen
 * 
 * The 60-second enrollment ceremony.
 * 
 * 0-40s:  Finger on camera → PPG cardiac capture
 * 40-50s: (Phase 2: Speak enrollment phrase)
 * 50-60s: Pick up phone → movement signature
 * 
 * Touch dynamics captured passively throughout.
 */

import { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
import { router } from 'expo-router';

type EnrollPhase = 'ready' | 'cardiac' | 'movement' | 'processing' | 'complete' | 'error';

const PHASE_INSTRUCTIONS: Record<EnrollPhase, string> = {
  ready: 'Place your finger over the camera\nand press begin',
  cardiac: 'Hold still.\nReading your heartbeat.',
  movement: 'Pick up your phone naturally.',
  processing: 'Creating your identity...',
  complete: 'Your waveform is enrolled.',
  error: 'Enrollment failed. Try again.',
};

export default function Enroll() {
  const [phase, setPhase] = useState<EnrollPhase>('ready');
  const [progress, setProgress] = useState(0);
  const [timer, setTimer] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startEnrollment = useCallback(async () => {
    setPhase('cardiac');

    // Start pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();

    // Simulate 40-second cardiac capture
    // In production: actual camera PPG capture via expo-camera
    const cardiacDuration = 40;
    for (let i = 0; i <= cardiacDuration; i++) {
      await new Promise(r => setTimeout(r, 1000));
      setTimer(i);
      setProgress(i / 60);
    }

    // Movement phase
    setPhase('movement');
    for (let i = cardiacDuration; i <= 60; i++) {
      await new Promise(r => setTimeout(r, 1000));
      setTimer(i);
      setProgress(i / 60);
    }

    // Processing
    setPhase('processing');
    await new Promise(r => setTimeout(r, 2000));

    // TODO: Call identity.enroll() with captured data
    // const enrollment = await identity.enroll(ppgFrames, accelData, touchEvents);
    // await wallet.create(enrollment.hash);

    setPhase('complete');
    pulseAnim.stopAnimation();

    // Navigate to home after brief pause
    setTimeout(() => router.replace('/home'), 2000);
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.circle, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={styles.circleText}>
          {phase === 'cardiac' || phase === 'movement' ? `${60 - timer}s` : ''}
        </Text>
      </Animated.View>

      <Text style={styles.instruction}>{PHASE_INSTRUCTIONS[phase]}</Text>

      {/* Progress bar */}
      {progress > 0 && progress < 1 && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
        </View>
      )}

      {phase === 'ready' && (
        <Pressable style={styles.button} onPress={startEnrollment}>
          <Text style={styles.buttonText}>Begin</Text>
        </Pressable>
      )}

      {phase === 'complete' && (
        <Text style={styles.subtitle}>Your heartbeat is now your signature.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F14',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  circle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: '#6B3FA0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 60,
  },
  circleText: {
    color: '#6B3FA0',
    fontSize: 48,
    fontWeight: '200',
  },
  instruction: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 40,
    fontWeight: '300',
  },
  subtitle: {
    color: '#6B3FA0',
    fontSize: 16,
    fontStyle: 'italic',
    marginTop: 20,
  },
  progressContainer: {
    width: '80%',
    height: 2,
    backgroundColor: '#1A1030',
    marginBottom: 40,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#6B3FA0',
  },
  button: {
    paddingHorizontal: 60,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#6B3FA0',
    borderRadius: 30,
  },
  buttonText: {
    color: '#6B3FA0',
    fontSize: 18,
    fontWeight: '300',
    letterSpacing: 4,
  },
});
