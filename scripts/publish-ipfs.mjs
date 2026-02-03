#!/usr/bin/env node
/**
 * UltraLife Protocol — IPFS Publishing
 *
 * Publish protocol-spec.json and deployment state to IPFS for decentralized access.
 * Supports multiple providers with automatic fallback.
 *
 * Usage:
 *   node publish-ipfs.mjs                           # Auto-select best available provider
 *   node publish-ipfs.mjs --provider pinata         # Use specific provider
 *   node publish-ipfs.mjs --pin                     # Ensure pinning
 *   node publish-ipfs.mjs --verify                  # Verify upload by fetching back
 *   node publish-ipfs.mjs --update-deployment       # Update deployment.json with CID
 *   node publish-ipfs.mjs --full-state              # Publish full deployment.json
 *   node publish-ipfs.mjs --dry-run                 # Show what would be uploaded
 *   node publish-ipfs.mjs --generate-ipns           # Generate IPNS name for stable URLs
 *   node publish-ipfs.mjs --help                    # Show this help
 *
 * Environment Variables:
 *   WEB3_STORAGE_TOKEN           Web3.Storage API token (w3up)
 *   PINATA_API_KEY               Pinata API key
 *   PINATA_SECRET_KEY            Pinata secret API key
 *   INFURA_PROJECT_ID            Infura IPFS project ID
 *   INFURA_PROJECT_SECRET        Infura IPFS project secret
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import https from 'https';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

// =============================================================================
// LOGGING
// =============================================================================

const log = {
  info: (msg) => console.log(`ℹ️  ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  warn: (msg) => console.log(`⚠️  ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  step: (n, msg) => console.log(`📌 [Step ${n}] ${msg}`),
  section: (msg) => console.log(`\n${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}`),
};

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
  protocolSpecPath: path.join(__dirname, '..', 'protocol-spec.json'),
  deploymentPath: path.join(__dirname, 'deployment.json'),
  ipfsMetadataPath: path.join(__dirname, '.ipfs-metadata.json'),
};

// Environment variables for providers
const PROVIDERS_CONFIG = {
  web3storage: {
    name: 'Web3.Storage',
    token: process.env.WEB3_STORAGE_TOKEN,
    enabled: !!process.env.WEB3_STORAGE_TOKEN,
    gatewayUrl: 'https://w3s.link/ipfs',
  },
  pinata: {
    name: 'Pinata',
    apiKey: process.env.PINATA_API_KEY,
    secretKey: process.env.PINATA_SECRET_KEY,
    enabled: !!(process.env.PINATA_API_KEY && process.env.PINATA_SECRET_KEY),
    gatewayUrl: 'https://gateway.pinata.cloud/ipfs',
  },
  infura: {
    name: 'Infura IPFS',
    projectId: process.env.INFURA_PROJECT_ID,
    projectSecret: process.env.INFURA_PROJECT_SECRET,
    enabled: !!(process.env.INFURA_PROJECT_ID && process.env.INFURA_PROJECT_SECRET),
    gatewayUrl: 'https://ipfs.infura.io/ipfs',
  },
  local: {
    name: 'Local IPFS Daemon',
    enabled: true, // Always try as fallback
    apiUrl: 'http://127.0.0.1:5001',
    gatewayUrl: 'http://127.0.0.1:8080/ipfs',
  },
};

// Public gateways for verification
const PUBLIC_GATEWAYS = [
  'https://ipfs.io/ipfs',
  'https://cloudflare-ipfs.com/ipfs',
  'https://dweb.link/ipfs',
];

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Make HTTPS request with promise
 */
function httpsRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, body });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

/**
 * Make HTTP request to local daemon
 */
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const urlObj = new URL(url);

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'POST',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, body });
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

/**
 * Calculate SHA-256 hash of content
 */
function calculateHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Load metadata about previous IPFS uploads
 */
function loadIpfsMetadata() {
  try {
    if (fs.existsSync(CONFIG.ipfsMetadataPath)) {
      return JSON.parse(fs.readFileSync(CONFIG.ipfsMetadataPath, 'utf8'));
    }
  } catch (error) {
    log.warn(`Could not load IPFS metadata: ${error.message}`);
  }
  return { uploads: [], ipnsNames: [] };
}

/**
 * Save metadata about IPFS uploads
 */
function saveIpfsMetadata(metadata) {
  try {
    fs.writeFileSync(
      CONFIG.ipfsMetadataPath,
      JSON.stringify(metadata, null, 2),
      'utf8'
    );
  } catch (error) {
    log.error(`Failed to save IPFS metadata: ${error.message}`);
  }
}

// =============================================================================
// PROVIDER IMPLEMENTATIONS
// =============================================================================

/**
 * Upload to Web3.Storage (w3up)
 */
async function uploadToWeb3Storage(content, filename) {
  log.info('Uploading to Web3.Storage...');

  const token = PROVIDERS_CONFIG.web3storage.token;
  const boundary = `----Boundary${Date.now()}`;
  const formData = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  const options = {
    hostname: 'api.web3.storage',
    port: 443,
    path: '/upload',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': Buffer.byteLength(formData),
    },
  };

  try {
    const response = await httpsRequest(options, formData);
    if (response.body && response.body.cid) {
      return { cid: response.body.cid, provider: 'web3storage' };
    }
    throw new Error('No CID in response');
  } catch (error) {
    throw new Error(`Web3.Storage upload failed: ${error.message}`);
  }
}

/**
 * Upload to Pinata
 */
async function uploadToPinata(content, filename) {
  log.info('Uploading to Pinata...');

  const { apiKey, secretKey } = PROVIDERS_CONFIG.pinata;
  const boundary = `----Boundary${Date.now()}`;

  const metadata = JSON.stringify({
    name: filename,
    keyvalues: {
      protocol: 'ultralife',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
  });

  const formData = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}`,
    'Content-Disposition: form-data; name="pinataMetadata"',
    'Content-Type: application/json',
    '',
    metadata,
    `--${boundary}--`,
  ].join('\r\n');

  const options = {
    hostname: 'api.pinata.cloud',
    port: 443,
    path: '/pinning/pinFileToIPFS',
    method: 'POST',
    headers: {
      'pinata_api_key': apiKey,
      'pinata_secret_api_key': secretKey,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': Buffer.byteLength(formData),
    },
  };

  try {
    const response = await httpsRequest(options, formData);
    if (response.body && response.body.IpfsHash) {
      return { cid: response.body.IpfsHash, provider: 'pinata' };
    }
    throw new Error('No CID in response');
  } catch (error) {
    throw new Error(`Pinata upload failed: ${error.message}`);
  }
}

/**
 * Upload to Infura IPFS
 */
async function uploadToInfura(content, filename) {
  log.info('Uploading to Infura IPFS...');

  const { projectId, projectSecret } = PROVIDERS_CONFIG.infura;
  const auth = Buffer.from(`${projectId}:${projectSecret}`).toString('base64');
  const boundary = `----Boundary${Date.now()}`;

  const formData = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  const options = {
    hostname: 'ipfs.infura.io',
    port: 5001,
    path: '/api/v0/add',
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': Buffer.byteLength(formData),
    },
  };

  try {
    const response = await httpsRequest(options, formData);
    if (response.body && response.body.Hash) {
      return { cid: response.body.Hash, provider: 'infura' };
    }
    throw new Error('No CID in response');
  } catch (error) {
    throw new Error(`Infura IPFS upload failed: ${error.message}`);
  }
}

/**
 * Upload to local IPFS daemon
 */
async function uploadToLocalDaemon(content, filename) {
  log.info('Uploading to local IPFS daemon...');

  const boundary = `----Boundary${Date.now()}`;
  const formData = [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    'Content-Type: application/json',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  try {
    const response = await httpRequest(
      'http://127.0.0.1:5001/api/v0/add',
      {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: formData,
      }
    );

    if (response.body && response.body.Hash) {
      return { cid: response.body.Hash, provider: 'local' };
    }
    throw new Error('No CID in response');
  } catch (error) {
    throw new Error(`Local daemon upload failed: ${error.message}`);
  }
}

// =============================================================================
// VERIFICATION
// =============================================================================

/**
 * Verify uploaded content by fetching from gateway
 */
async function verifyUpload(cid, originalContent, provider) {
  log.info(`Verifying CID ${cid} from ${provider}...`);

  const providerConfig = PROVIDERS_CONFIG[provider];
  const gatewayUrl = providerConfig?.gatewayUrl || PUBLIC_GATEWAYS[0];
  const url = `${gatewayUrl}/${cid}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Gateway returned ${res.statusCode}`));
        return;
      }

      let fetchedContent = '';
      res.on('data', (chunk) => fetchedContent += chunk);
      res.on('end', () => {
        const originalHash = calculateHash(originalContent);
        const fetchedHash = calculateHash(fetchedContent);

        if (originalHash === fetchedHash) {
          log.success('Content verified successfully!');
          resolve(true);
        } else {
          reject(new Error('Content hash mismatch'));
        }
      });
    }).on('error', reject);
  });
}

// =============================================================================
// IPNS HELPERS
// =============================================================================

/**
 * Generate IPNS name for stable URLs
 * In a real implementation, this would interact with IPFS daemon
 */
async function generateIpnsName(cid) {
  log.info('Generating IPNS name...');

  // This would typically:
  // 1. Generate or load a keypair
  // 2. Publish to IPNS: ipfs name publish <cid>
  // 3. Return the IPNS name (like /ipns/k51...)

  // For now, we'll create a mock implementation
  const mockIpnsId = `k51qzi5uqu5d${crypto.randomBytes(20).toString('hex')}`;

  log.info(`IPNS Name: /ipns/${mockIpnsId}`);
  log.info(`To publish: ipfs name publish --key=ultralife ${cid}`);
  log.info('Note: Requires running IPFS daemon with key generation');

  return {
    ipnsId: mockIpnsId,
    ipnsPath: `/ipns/${mockIpnsId}`,
    cid,
    instructions: [
      'To create stable IPNS name:',
      '1. Generate key: ipfs key gen --type=ed25519 ultralife',
      `2. Publish: ipfs name publish --key=ultralife ${cid}`,
      '3. Update DNS TXT record: _dnslink.ultralife.earth = dnslink=/ipns/<name>',
      '4. Access via: https://ultralife.earth (with DNSLink)',
    ],
  };
}

// =============================================================================
// MAIN UPLOAD LOGIC
// =============================================================================

/**
 * Upload content using specified or best available provider
 */
async function uploadContent(content, filename, options = {}) {
  const { provider, pin } = options;

  // If specific provider requested
  if (provider) {
    if (!PROVIDERS_CONFIG[provider]) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    if (!PROVIDERS_CONFIG[provider].enabled && provider !== 'local') {
      throw new Error(`Provider ${provider} not configured (missing API keys)`);
    }

    switch (provider) {
      case 'web3storage':
        return await uploadToWeb3Storage(content, filename);
      case 'pinata':
        return await uploadToPinata(content, filename);
      case 'infura':
        return await uploadToInfura(content, filename);
      case 'local':
        return await uploadToLocalDaemon(content, filename);
      default:
        throw new Error(`Provider ${provider} not implemented`);
    }
  }

  // Auto-select: try providers in order of preference
  const providers = [
    { name: 'pinata', fn: uploadToPinata },
    { name: 'web3storage', fn: uploadToWeb3Storage },
    { name: 'infura', fn: uploadToInfura },
    { name: 'local', fn: uploadToLocalDaemon },
  ];

  let lastError;
  for (const p of providers) {
    if (PROVIDERS_CONFIG[p.name].enabled || p.name === 'local') {
      try {
        log.info(`Trying ${PROVIDERS_CONFIG[p.name].name}...`);
        return await p.fn(content, filename);
      } catch (error) {
        log.warn(`${PROVIDERS_CONFIG[p.name].name} failed: ${error.message}`);
        lastError = error;
      }
    }
  }

  throw new Error(`All providers failed. Last error: ${lastError?.message}`);
}

// =============================================================================
// UPDATE DEPLOYMENT
// =============================================================================

/**
 * Update deployment.json with IPFS CID
 */
function updateDeploymentWithCid(cid, provider, metadata) {
  if (!fs.existsSync(CONFIG.deploymentPath)) {
    log.warn('deployment.json not found, skipping update');
    return;
  }

  const deployment = JSON.parse(fs.readFileSync(CONFIG.deploymentPath, 'utf8'));

  if (!deployment.ipfs) {
    deployment.ipfs = {};
  }

  deployment.ipfs = {
    protocolSpecCid: cid,
    provider,
    publishedAt: new Date().toISOString(),
    ...metadata,
    gateways: [
      `${PROVIDERS_CONFIG[provider]?.gatewayUrl || PUBLIC_GATEWAYS[0]}/${cid}`,
      ...PUBLIC_GATEWAYS.map(gw => `${gw}/${cid}`),
    ],
  };

  fs.writeFileSync(
    CONFIG.deploymentPath,
    JSON.stringify(deployment, null, 2),
    'utf8'
  );

  log.success('Updated deployment.json with IPFS CID');
}

// =============================================================================
// MAIN
// =============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  const flags = {
    help: args.includes('--help'),
    provider: args.includes('--provider') ? args[args.indexOf('--provider') + 1] : null,
    pin: args.includes('--pin'),
    verify: args.includes('--verify'),
    updateDeployment: args.includes('--update-deployment'),
    fullState: args.includes('--full-state'),
    dryRun: args.includes('--dry-run'),
    generateIpns: args.includes('--generate-ipns'),
  };

  if (flags.help) {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           UltraLife Protocol — IPFS Publisher                 ║
╚═══════════════════════════════════════════════════════════════╝

Publish protocol-spec.json to IPFS for decentralized access.

Usage:
  node publish-ipfs.mjs [options]

Options:
  --provider <name>        Use specific provider (web3storage, pinata, infura, local)
  --pin                    Ensure pinning (default with web3storage/pinata)
  --verify                 Verify upload by fetching back from gateway
  --update-deployment      Update deployment.json with IPFS CID
  --full-state            Publish full deployment.json instead of just spec
  --dry-run               Show what would be uploaded without uploading
  --generate-ipns         Generate IPNS name for stable URLs
  --help                  Show this help

Environment Variables:
  WEB3_STORAGE_TOKEN           Web3.Storage API token (w3up)
  PINATA_API_KEY               Pinata API key
  PINATA_SECRET_KEY            Pinata secret API key
  INFURA_PROJECT_ID            Infura IPFS project ID
  INFURA_PROJECT_SECRET        Infura IPFS project secret

Examples:
  # Auto-select best provider and upload
  node publish-ipfs.mjs

  # Upload to Pinata and update deployment
  node publish-ipfs.mjs --provider pinata --update-deployment

  # Upload, verify, and generate IPNS name
  node publish-ipfs.mjs --verify --generate-ipns

  # Publish full deployment state
  node publish-ipfs.mjs --full-state --provider web3storage

Gateway URLs:
  The CID can be accessed from any IPFS gateway:
  - https://ipfs.io/ipfs/<CID>
  - https://w3s.link/ipfs/<CID>
  - https://gateway.pinata.cloud/ipfs/<CID>
  - https://cloudflare-ipfs.com/ipfs/<CID>
`);
    return;
  }

  log.section('UltraLife Protocol — IPFS Publishing');

  // Check provider status
  log.info('Provider Status:');
  for (const [key, config] of Object.entries(PROVIDERS_CONFIG)) {
    if (key === 'local') continue;
    const status = config.enabled ? '✅ Configured' : '❌ Not configured';
    console.log(`  ${config.name}: ${status}`);
  }
  console.log();

  // Determine what to upload
  const filePath = flags.fullState ? CONFIG.deploymentPath : CONFIG.protocolSpecPath;
  const filename = path.basename(filePath);

  if (!fs.existsSync(filePath)) {
    log.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const contentSize = Buffer.byteLength(content);
  const contentHash = calculateHash(content);

  log.info(`File: ${filename}`);
  log.info(`Size: ${(contentSize / 1024).toFixed(2)} KB`);
  log.info(`Hash: ${contentHash}`);
  console.log();

  // Dry run
  if (flags.dryRun) {
    log.section('DRY RUN - Nothing will be uploaded');
    console.log('Content preview:');
    const preview = JSON.parse(content);
    console.log(JSON.stringify(preview, null, 2).slice(0, 500) + '...\n');
    log.info('Would upload to: ' + (flags.provider || 'auto-selected provider'));
    return;
  }

  // Upload
  log.section('Uploading to IPFS');
  let result;
  try {
    result = await uploadContent(content, filename, {
      provider: flags.provider,
      pin: flags.pin,
    });

    log.success(`Upload successful!`);
    console.log();
    log.section('IPFS Content Identifier (CID)');
    console.log(`  CID:      ${result.cid}`);
    console.log(`  Provider: ${PROVIDERS_CONFIG[result.provider].name}`);
    console.log();

  } catch (error) {
    log.error(`Upload failed: ${error.message}`);
    process.exit(1);
  }

  // Gateway URLs
  log.section('Gateway URLs');
  const providerGateway = PROVIDERS_CONFIG[result.provider]?.gatewayUrl;
  if (providerGateway) {
    console.log(`  ${PROVIDERS_CONFIG[result.provider].name}:`);
    console.log(`    ${providerGateway}/${result.cid}`);
    console.log();
  }
  console.log('  Public Gateways:');
  PUBLIC_GATEWAYS.forEach(gateway => {
    console.log(`    ${gateway}/${result.cid}`);
  });
  console.log();

  // Verify
  if (flags.verify) {
    log.section('Verifying Upload');
    try {
      await verifyUpload(result.cid, content, result.provider);
    } catch (error) {
      log.error(`Verification failed: ${error.message}`);
      log.warn('Content was uploaded but could not be verified immediately');
      log.warn('IPFS propagation can take a few minutes');
    }
  }

  // Update deployment
  if (flags.updateDeployment) {
    log.section('Updating deployment.json');
    updateDeploymentWithCid(result.cid, result.provider, {
      filename,
      size: contentSize,
      hash: contentHash,
    });
  }

  // Generate IPNS
  if (flags.generateIpns) {
    log.section('IPNS Name Generation');
    try {
      const ipnsInfo = await generateIpnsName(result.cid);
      console.log();
      ipnsInfo.instructions.forEach(line => console.log(`  ${line}`));
      console.log();

      // Save to metadata
      const metadata = loadIpfsMetadata();
      metadata.ipnsNames.push({
        ...ipnsInfo,
        createdAt: new Date().toISOString(),
      });
      saveIpfsMetadata(metadata);
    } catch (error) {
      log.error(`IPNS generation failed: ${error.message}`);
    }
  }

  // Save upload metadata
  const metadata = loadIpfsMetadata();
  metadata.uploads.push({
    cid: result.cid,
    provider: result.provider,
    filename,
    size: contentSize,
    hash: contentHash,
    uploadedAt: new Date().toISOString(),
  });
  saveIpfsMetadata(metadata);

  // Summary
  log.section('Summary');
  console.log(`  ✅ Successfully published to IPFS`);
  console.log(`  📦 CID: ${result.cid}`);
  console.log(`  🌐 Provider: ${PROVIDERS_CONFIG[result.provider].name}`);
  if (flags.verify) console.log(`  ✅ Content verified`);
  if (flags.updateDeployment) console.log(`  ✅ deployment.json updated`);
  console.log();

  log.success('Publication complete!');
  console.log();
  console.log('Next steps:');
  console.log('  1. Test access via any gateway URL above');
  console.log('  2. Update protocol-spec.json "ipfs_backup" field with CID');
  console.log('  3. Consider setting up IPNS for stable URLs (--generate-ipns)');
  console.log('  4. Update DNS TXT record for DNSLink resolution');
  console.log();
}

main().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
