#!/usr/bin/env node
/**
 * Postinstall script to fix MeshSDK dependency issues
 *
 * The libsodium-wrappers-sumo package expects libsodium-sumo.mjs in its own
 * dist folder, but npm doesn't copy it there. This script fixes that.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const nodeModules = path.join(__dirname, 'node_modules');

const targetDir = path.join(nodeModules, 'libsodium-wrappers-sumo', 'dist', 'modules-sumo-esm');
const targetFile = path.join(targetDir, 'libsodium-sumo.mjs');
const sourceFile = path.join(nodeModules, 'libsodium-sumo', 'dist', 'modules-sumo-esm', 'libsodium-sumo.mjs');

if (!fs.existsSync(targetFile) && fs.existsSync(sourceFile)) {
  try {
    fs.copyFileSync(sourceFile, targetFile);
    console.log('✅ Fixed libsodium ESM module for MeshSDK');
  } catch (err) {
    console.warn('⚠️  Could not fix libsodium ESM:', err.message);
  }
} else if (fs.existsSync(targetFile)) {
  console.log('✅ libsodium ESM module already configured');
} else {
  console.log('ℹ️  libsodium modules not found (will be fixed on first run)');
}
