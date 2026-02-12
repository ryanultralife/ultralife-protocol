/**
 * UltraLife Entry Screen
 * 
 * Checks enrollment status. Routes to enrollment or authentication.
 * This screen should be visible for < 1 second in normal use.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { IdentityManager } from '../lib/identity';

const identity = new IdentityManager();

export default function Index() {
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkEnrollment();
  }, []);

  async function checkEnrollment() {
    const enrolled = await identity.isEnrolled();
    setChecking(false);

    if (enrolled) {
      router.replace('/home');
    } else {
      router.replace('/enroll');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>UltraLife</Text>
      {checking && <ActivityIndicator color="#6B3FA0" size="large" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#6B3FA0',
    fontSize: 32,
    fontWeight: '300',
    letterSpacing: 8,
    marginBottom: 40,
  },
});
