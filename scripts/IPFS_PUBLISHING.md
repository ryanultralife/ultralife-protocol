# IPFS Publishing for UltraLife Protocol

This document describes how to publish the UltraLife Protocol specification and deployment state to IPFS for decentralized access.

## Overview

The `publish-ipfs.mjs` script publishes `protocol-spec.json` (or optionally the full `deployment.json`) to IPFS using multiple providers with automatic fallback. This ensures the protocol specification is permanently accessible via IPFS, independent of any single server.

## Quick Start

```bash
# Show help
npm run ipfs:help

# Publish protocol-spec.json (dry run)
npm run ipfs:dry

# Publish to best available provider
npm run ipfs

# Publish and update deployment.json
npm run ipfs:publish
```

## Supported IPFS Providers

The script supports multiple IPFS providers with automatic fallback:

1. **Web3.Storage (w3up)** - Recommended for long-term pinning
2. **Pinata** - Popular pinning service with free tier
3. **Infura IPFS** - Reliable infrastructure provider
4. **Local IPFS Daemon** - Fallback for development

If you don't configure any provider, the script will attempt to use a local IPFS daemon at `http://127.0.0.1:5001`.

## Configuration

### Environment Variables

Add these to your `.env` file (see `.env.example` for template):

```bash
# Web3.Storage (get token at https://web3.storage)
WEB3_STORAGE_TOKEN=your_token_here

# Pinata (get keys at https://pinata.cloud)
PINATA_API_KEY=your_api_key_here
PINATA_SECRET_KEY=your_secret_key_here

# Infura IPFS (get credentials at https://infura.io)
INFURA_PROJECT_ID=your_project_id_here
INFURA_PROJECT_SECRET=your_project_secret_here
```

## Usage

### Basic Commands

```bash
# Publish protocol-spec.json with auto-selected provider
node publish-ipfs.mjs

# Publish to specific provider
node publish-ipfs.mjs --provider pinata
node publish-ipfs.mjs --provider web3storage
node publish-ipfs.mjs --provider infura
node publish-ipfs.mjs --provider local

# Verify upload by fetching from gateway
node publish-ipfs.mjs --verify

# Update deployment.json with the CID
node publish-ipfs.mjs --update-deployment

# Publish full deployment state instead of just spec
node publish-ipfs.mjs --full-state

# Show what would be uploaded without uploading
node publish-ipfs.mjs --dry-run

# Generate IPNS name for stable URLs
node publish-ipfs.mjs --generate-ipns
```

### NPM Shortcuts

```bash
npm run ipfs              # Basic publish
npm run ipfs:publish      # Publish and update deployment
npm run ipfs:pinata       # Use Pinata specifically
npm run ipfs:web3         # Use Web3.Storage specifically
npm run ipfs:verify       # Publish with verification
npm run ipfs:full         # Publish full deployment state
npm run ipfs:dry          # Dry run
npm run ipfs:help         # Show help
```

### Combined Flags

You can combine flags for more control:

```bash
# Publish to Pinata, verify, update deployment, and generate IPNS
node publish-ipfs.mjs --provider pinata --verify --update-deployment --generate-ipns

# Publish full state to Web3.Storage and verify
node publish-ipfs.mjs --full-state --provider web3storage --verify --update-deployment
```

## Output

After successful upload, the script provides:

1. **IPFS CID** - Content Identifier for the uploaded file
2. **Provider** - Which provider was used
3. **Gateway URLs** - Multiple ways to access the content:
   - Provider-specific gateway
   - Public IPFS gateways (ipfs.io, cloudflare-ipfs.com, dweb.link)

### Example Output

```
============================================================
IPFS Content Identifier (CID)
============================================================
  CID:      QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx
  Provider: Pinata

============================================================
Gateway URLs
============================================================
  Pinata:
    https://gateway.pinata.cloud/ipfs/QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx

  Public Gateways:
    https://ipfs.io/ipfs/QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx
    https://cloudflare-ipfs.com/ipfs/QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx
    https://dweb.link/ipfs/QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx
```

## IPNS - Stable URLs

IPFS content is immutable (the CID changes when content changes). For stable URLs, you can use IPNS (InterPlanetary Name System).

### Generate IPNS Name

```bash
node publish-ipfs.mjs --generate-ipns
```

This will provide instructions for:
1. Creating an IPNS key
2. Publishing the CID to IPNS
3. Setting up DNSLink for human-readable URLs

### Manual IPNS Setup

If you have a local IPFS daemon running:

```bash
# Generate a key for UltraLife
ipfs key gen --type=ed25519 ultralife

# Publish the CID to IPNS
ipfs name publish --key=ultralife <CID>

# Get the IPNS name
ipfs key list -l
```

### DNSLink Configuration

For a stable URL like `https://ultralife.earth`:

1. Get your IPNS name from `ipfs key list -l`
2. Create a DNS TXT record:
   ```
   _dnslink.ultralife.earth = dnslink=/ipns/<your-ipns-name>
   ```
3. Access via: `https://dweb.link/ipns/ultralife.earth`

## Integration with Protocol

### Updating protocol-spec.json

After publishing to IPFS, update the `ipfs_backup` field in `protocol-spec.json`:

```json
{
  "endpoints": {
    "spec": "https://ultralife.earth/protocol.json",
    "ipfs_backup": "ipfs://QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx",
    "github": "https://github.com/ultralife-protocol/spec"
  }
}
```

### Updating deployment.json

When using `--update-deployment`, the script automatically adds:

```json
{
  "ipfs": {
    "protocolSpecCid": "QmXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXx",
    "provider": "pinata",
    "publishedAt": "2026-02-03T...",
    "filename": "protocol-spec.json",
    "size": 29521,
    "hash": "a9cfb82fe7685edf9b77cc179e394a3dafdcc7a1578619845f4c2b166679d3d6",
    "gateways": [
      "https://gateway.pinata.cloud/ipfs/Qm...",
      "https://ipfs.io/ipfs/Qm...",
      "https://cloudflare-ipfs.com/ipfs/Qm...",
      "https://dweb.link/ipfs/Qm..."
    ]
  }
}
```

## Metadata Tracking

The script maintains `.ipfs-metadata.json` to track:
- All uploads (CID, provider, timestamp, size, hash)
- IPNS names generated
- Upload history

This file is automatically created and updated on each operation.

## Verification

The `--verify` flag fetches the uploaded content from the gateway and compares the SHA-256 hash with the original. This ensures:
- Content was uploaded successfully
- Content is retrievable from the gateway
- No corruption occurred during upload

Note: IPFS propagation can take a few minutes. If verification fails immediately after upload, wait a moment and try again.

## Troubleshooting

### No providers configured

If you see "All providers failed", ensure at least one provider is configured in `.env`, or run a local IPFS daemon:

```bash
# Install IPFS
# See: https://docs.ipfs.tech/install/

# Start daemon
ipfs daemon
```

### Verification fails

IPFS content propagation can take time. Wait a few minutes and try:

```bash
# Fetch directly from IPFS gateway
curl https://ipfs.io/ipfs/<CID>
```

### Upload fails

Check:
1. API keys are correct in `.env`
2. Network connectivity
3. File size (some providers have limits)
4. API rate limits (try a different provider)

## Best Practices

1. **Use pinning services** - Don't rely solely on local daemon for production
2. **Verify uploads** - Always use `--verify` for critical content
3. **Update deployment.json** - Use `--update-deployment` to track CIDs
4. **Generate IPNS** - For stable URLs across updates
5. **Multiple providers** - Configure several providers for redundancy
6. **Regular backups** - Publish updates periodically to IPFS

## Example Workflow

Complete workflow for publishing a protocol update:

```bash
# 1. Make changes to protocol-spec.json
vim ../protocol-spec.json

# 2. Dry run to preview
npm run ipfs:dry

# 3. Publish to IPFS with verification
node publish-ipfs.mjs --provider pinata --verify --update-deployment

# 4. Generate/update IPNS name
node publish-ipfs.mjs --generate-ipns

# 5. Update protocol-spec.json with new CID
# (Edit the ipfs_backup field)

# 6. Commit changes
git add protocol-spec.json deployment.json
git commit -m "Update protocol spec and publish to IPFS"
```

## Additional Resources

- [IPFS Documentation](https://docs.ipfs.tech/)
- [Web3.Storage Documentation](https://web3.storage/docs/)
- [Pinata Documentation](https://docs.pinata.cloud/)
- [Infura IPFS Documentation](https://docs.infura.io/infura/networks/ipfs)
- [IPNS Documentation](https://docs.ipfs.tech/concepts/ipns/)
- [DNSLink Documentation](https://docs.ipfs.tech/concepts/dnslink/)

## License

Part of the UltraLife Protocol - MIT License
