#!/usr/bin/env node
/**
 * Debug script format to understand MeshSDK encoding
 * Run this on the user's machine where deps are installed
 */

import { resolveScriptHash, MeshTxBuilder, BlockfrostProvider, applyCborEncoding } from '@meshsdk/core';
import 'dotenv/config';

// test_simple compiled code from plutus.json
const testScript = "585c01010029800aba2aba1aab9eaab9dab9a4888896600264653001300600198031803800cc0180092225980099b8748008c01cdd500144c8cc892898050009805180580098041baa0028b200c180300098019baa0068a4d13656400401";

console.log("=== Script Format Debug ===\n");
console.log("Original script from plutus.json:");
console.log("  Length:", testScript.length, "chars =", testScript.length/2, "bytes");
console.log("  First 20 chars:", testScript.slice(0, 20));
console.log("  Expected hash: d27ccc13fab5b782984a3d1f99353197ca1a81be069941ffc003ee75");

// Test different formats
console.log("\n--- Testing different formats ---\n");

// Format 1: As-is
try {
  const hash1 = resolveScriptHash(testScript, 'V3');
  console.log("1. As-is with V3:", hash1);
} catch (e) {
  console.log("1. Error:", e.message);
}

// Format 2: Without CBOR wrapper (remove 585c prefix)
try {
  const unwrapped = testScript.slice(4);
  const hash2 = resolveScriptHash(unwrapped, 'V3');
  console.log("2. Without 585c prefix:", hash2);
} catch (e) {
  console.log("2. Error:", e.message);
}

// Format 3: Try applyCborEncoding if available
try {
  if (typeof applyCborEncoding === 'function') {
    const encoded = applyCborEncoding(testScript);
    console.log("3. applyCborEncoding result:", encoded?.slice(0, 40) + "...");
    const hash3 = resolveScriptHash(encoded, 'V3');
    console.log("   Hash:", hash3);
  } else {
    console.log("3. applyCborEncoding not available");
  }
} catch (e) {
  console.log("3. Error:", e.message);
}

// Format 4: V2 instead of V3
try {
  const hash4 = resolveScriptHash(testScript, 'V2');
  console.log("4. As V2:", hash4);
} catch (e) {
  console.log("4. Error:", e.message);
}

console.log("\nError showed hash: 629b415ec93feef820ac7acff484d194cad199ac2930aec9f4b4150e");
console.log("\nIf none match the expected hash, we need a different approach.");
console.log("Consider using raw CBOR manipulation or Aiken's native tools.");

