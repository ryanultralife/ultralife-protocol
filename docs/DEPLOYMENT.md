# Deployment Guide

## Status: Testnet Deployment Phase

> **Development Complete** — All validators, documentation, and MCP service fully implemented.
> Currently deploying to Cardano Preview Testnet.

| Phase | Status |
|-------|--------|
| Contract Development | ✅ Complete (27 validators) |
| Type System & Libraries | ✅ Complete |
| MCP Service | ✅ Complete (31 tools) |
| Documentation | ✅ Complete (34 files) |
| Automated Testing | ✅ Complete (130+ tests) |
| CI/CD Pipeline | ✅ Active |
| **Testnet Deployment** | 🔄 **Current Phase** |
| Testnet Verification | ⏳ Pending |
| Security Audit | ⏳ Pending |
| Mainnet Launch | ⏳ Pending |

---

## Overview

This guide covers deploying UltraLife Protocol to Cardano networks. The protocol supports both testnet (Preview/Preprod) and mainnet deployments.

**Current Target:** Preview Testnet

---

## Testnet Deployment (Current)

### Quick Start for Testnet

```bash
# 1. Build contracts
cd contracts && aiken build

# 2. Generate testnet addresses
./scripts/generate-addresses.sh --network preview

# 3. Deploy reference scripts (requires testnet ADA)
./scripts/deploy-all.sh --network preview

# 4. Configure MCP service
cp service/.env.example service/.env
# Edit .env with deployed addresses

# 5. Start service
cd service && npm start
```

### Testnet Configuration

Create `testnet-config.json`:

```json
{
  "network": "preview",
  "blockfrost_project_id": "your_preview_project_id",
  "protocol_version": "1.0.0-testnet",
  "total_token_supply": 400000000000,
  "bootstrap_grant": 50,
  "cycle_length_slots": 3196800,
  "initial_stewards": [
    {
      "name": "Testnet Steward 1",
      "pubkey_hash": "...",
      "bioregion": "test_bioregion_1"
    }
  ],
  "multi_sig_threshold": 1,
  "initial_bioregions": [
    {
      "id": "test_bioregion_1",
      "bounds_hash": "...",
      "carrying_capacity": 1000,
      "health_index": 100
    }
  ]
}
```

### Pre-Deployment Testing

Before deploying to testnet, verify all automated tests pass:

```bash
# Run all smart contract tests (130+ tests)
cd contracts && aiken check

# Expected output:
#   Summary: 130 tests, 0 failures

# Build and compile validators
cd contracts && aiken build

# Run service tests
cd service && npm test
```

**Test Categories:**
- UBI calculation tests (30+ tests)
- Type system tests (18 tests)
- Token rules tests (20+ tests)
- Protocol timing tests (30+ tests)
- Integration scenarios (25+ tests)

See [Testing Guide](TESTING.md) for complete documentation.

### Testnet Deployment Checklist

- [ ] All automated tests passing (130+)
- [ ] CI/CD pipeline green
- [ ] Obtain Preview testnet ADA from faucet
- [ ] Build and verify all 27 validators compile
- [ ] Deploy reference scripts to Preview
- [ ] Record all policy IDs and script addresses
- [ ] Update `service/src/index.ts` with addresses
- [ ] Deploy MCP service
- [ ] Test pNFT minting flow
- [ ] Test token transfer flow
- [ ] Test marketplace listing
- [ ] Test governance proposal
- [ ] Document any issues found

### Getting Testnet ADA

```bash
# Preview Testnet Faucet
# https://docs.cardano.org/cardano-testnet/tools/faucet

# Request ADA to your testnet address
curl -X POST "https://faucet.preview.world.dev.cardano.org/send-money" \
  -H "Content-Type: application/json" \
  -d '{"address": "addr_test1..."}'
```

---

## Mainnet Deployment (Future)

> **Note:** Mainnet deployment will follow successful testnet verification and security audit.

Mainnet deployment requires multi-sig approval from initial stewards.

## Prerequisites

### Technical Requirements

```bash
# Required software
aiken --version     # v1.0.0+
cardano-cli --version  # 8.0.0+
node --version      # v18+

# Required infrastructure
- Cardano node (synced to tip)
- Wallet with sufficient ADA for deployment
- HSM or secure key management for steward keys
```

### Steward Requirements

- Minimum 3 initial stewards for multi-sig
- Each steward must have:
  - Verified identity (DNA verification complete)
  - Secure key management
  - Commitment to protocol governance
  - Geographic diversity (different bioregions preferred)

## Deployment Steps

### Phase 1: Build Contracts

```bash
cd contracts

# Build all validators
aiken build

# Run tests
aiken check

# Generate plutus.json
aiken blueprint
```

**Expected output:**
```
Compiling ultralife/protocol
    Wrote: plutus.json

Validators:
  ✓ pnft.pnft
  ✓ token.token
  ✓ bioregion.bioregion
  ✓ land_rights.land_rights
  ✓ stake_pool.stake_pool
  ✓ preservation.preservation
  ✓ impact_market.impact_market
  ✓ ubi.ubi
  ✓ treasury.treasury
  ✓ governance.governance
  ✓ impact.impact
  ✓ remediation.remediation
  ✓ records.records
  ✓ genesis.genesis
  ✓ grants.grants
  ✓ registry.registry
  ✓ memory.memory
```

### Phase 2: Generate Policy IDs

```bash
# Generate reference script addresses
./scripts/generate-addresses.sh

# Output:
# Genesis Policy ID: abc123...
# pNFT Policy ID: def456...
# Token Policy ID: ghi789...
# etc.
```

### Phase 3: Configure Genesis Parameters

Create `genesis-params.json`:

```json
{
  "protocol_version": "1.0.0",
  "total_token_supply": 400000000000,
  "bootstrap_grant": 50,
  "cycle_length_slots": 3196800,
  "min_verification_level": 1,
  "initial_stewards": [
    {
      "name": "Steward 1",
      "pubkey_hash": "abc123...",
      "bioregion": "sierra_nevada"
    },
    {
      "name": "Steward 2", 
      "pubkey_hash": "def456...",
      "bioregion": "pacific_northwest"
    },
    {
      "name": "Steward 3",
      "pubkey_hash": "ghi789...",
      "bioregion": "amazon_basin"
    }
  ],
  "multi_sig_threshold": 2,
  "initial_bioregions": [
    {
      "id": "sierra_nevada",
      "bounds_hash": "...",
      "carrying_capacity": 50000,
      "health_index": 75
    }
  ],
  "treasury_allocation": {
    "ubi_fund_percent": 40,
    "preservation_fund_percent": 30,
    "development_fund_percent": 20,
    "survey_fund_percent": 10
  },
  "founder_allocation": {
    "method": "bonding_curve",
    "monthly_usd": 10000,
    "notes": "Uses standard curve, not special allocation"
  }
}
```

### Phase 4: Deploy Reference Scripts

```bash
# Deploy in order (dependencies matter)

# 1. Genesis contract (foundation)
./scripts/deploy-validator.sh genesis

# 2. Core identity
./scripts/deploy-validator.sh pnft
./scripts/deploy-validator.sh token

# 3. Bioregion infrastructure
./scripts/deploy-validator.sh bioregion
./scripts/deploy-validator.sh registry

# 4. Land and resources
./scripts/deploy-validator.sh land_rights

# 5. Economic infrastructure
./scripts/deploy-validator.sh treasury
./scripts/deploy-validator.sh stake_pool
./scripts/deploy-validator.sh ubi

# 6. Impact system
./scripts/deploy-validator.sh impact
./scripts/deploy-validator.sh impact_market
./scripts/deploy-validator.sh remediation

# 7. Verification
./scripts/deploy-validator.sh preservation
./scripts/deploy-validator.sh grants

# 8. Records and governance
./scripts/deploy-validator.sh records
./scripts/deploy-validator.sh governance
./scripts/deploy-validator.sh memory
```

### Phase 5: Initialize Genesis

```bash
# Build genesis initialization transaction
./scripts/build-genesis-init.sh genesis-params.json

# This creates a multi-sig transaction requiring steward signatures
# Output: genesis-init-unsigned.tx

# Each steward signs
cardano-cli transaction sign \
  --tx-file genesis-init-unsigned.tx \
  --signing-key-file steward1.skey \
  --out-file genesis-init-steward1.tx

# Combine signatures
cardano-cli transaction assemble \
  --tx-file genesis-init-unsigned.tx \
  --signing-key-file genesis-init-steward1.tx \
  --signing-key-file genesis-init-steward2.tx \
  --out-file genesis-init-signed.tx

# Submit
cardano-cli transaction submit --tx-file genesis-init-signed.tx
```

### Phase 6: Mint Initial Tokens

```bash
# Build token minting transaction (also multi-sig)
./scripts/build-token-mint.sh genesis-params.json

# Stewards sign and submit
# This mints 400B tokens to treasury
```

### Phase 7: Create First Bioregion

```bash
# Build bioregion creation
./scripts/build-bioregion.sh sierra_nevada

# Stewards sign and submit
# This creates the first bioregion NFT and stake pool
```

### Phase 8: Verify Deployment

```bash
# Run verification script
./scripts/verify-deployment.sh

# Expected output:
✓ Genesis contract deployed
✓ All validators deployed
✓ Token policy active
✓ 400B tokens minted to treasury
✓ First bioregion created
✓ Stake pool operational
✓ Ready for DNA verifications
```

## Post-Deployment

### Set Up DNA Verification Facilities

1. Partner with existing facilities or establish new ones
2. Register facility addresses on-chain
3. Train facility operators
4. Connect facility systems to oracle network

### Deploy Oracles

```bash
# Deploy price oracle
./scripts/deploy-oracle.sh price sierra_nevada

# Deploy environmental oracle
./scripts/deploy-oracle.sh environmental sierra_nevada

# Deploy population oracle
./scripts/deploy-oracle.sh population sierra_nevada
```

### Launch Consumer App

1. Point app to mainnet endpoints
2. Enable DNA verification scheduling
3. Open registration
4. Begin onboarding first users

## Founder Token Distribution

Per TOKEN_DISTRIBUTION.md, founder tokens are calculated via bonding curve at $10,000/month:

```json
{
  "founder_allocation": {
    "recipient": "founder_pnft",
    "method": "bonding_curve",
    "monthly_usd": 10000,
    "start_epoch": 0,
    "estimated_60_months": "~17,000,000,000 ULTRA",
    "notes": [
      "Tokens purchased at curve price each epoch",
      "Same price as all other buyers",
      "No special allocation - uses standard curve",
      "See TOKEN_DISTRIBUTION.md for full calculation"
    ]
  }
}
```

**Implementation:**

```aiken
type FounderVesting {
  recipient: AssetName,
  total_amount: Int,
  released_amount: Int,
  start_cycle: Int,
  cliff_cycles: Int,
  vesting_cycles: Int,
}

fn calculate_vested_amount(vesting: FounderVesting, current_cycle: Int) -> Int {
  let cycles_since_start = current_cycle - vesting.start_cycle
  
  // Before cliff
  if cycles_since_start < vesting.cliff_cycles {
    0
  } else {
    // Linear vesting after cliff
    let vesting_cycles_elapsed = cycles_since_start - vesting.cliff_cycles
    let per_cycle = vesting.total_amount / vesting.vesting_cycles
    
    min(
      vesting_cycles_elapsed * per_cycle,
      vesting.total_amount - vesting.released_amount
    )
  }
}
```

## Upgrade Procedures

### Minor Upgrades (Bug Fixes)

1. Propose upgrade through governance
2. Achieve quorum approval
3. Deploy new reference scripts
4. Update contract references

### Major Upgrades (Breaking Changes)

1. Extended discussion period
2. Higher quorum requirement
3. Migration plan for existing state
4. Gradual rollout with fallback

## Monitoring

### Key Metrics

```bash
# Monitor these metrics continuously
- Total verified pNFTs
- Active transactions per cycle
- Treasury balances (all funds)
- Stake pool health
- Oracle data freshness
- Impact token supply
- UBI distribution completeness
```

### Alerting

Set up alerts for:
- Contract errors
- Treasury anomalies
- Oracle data staleness
- Stake pool issues
- Governance proposal deadlines

## Security Checklist

- [ ] All steward keys in HSM
- [ ] Multi-sig threshold appropriate
- [ ] Audit completed
- [ ] Bug bounty program active
- [ ] Incident response plan ready
- [ ] Backup and recovery tested
- [ ] Rate limiting configured
- [ ] Monitoring dashboards live

## Emergency Procedures

### Contract Pause

If critical vulnerability discovered:

1. Stewards initiate emergency pause proposal
2. Reduced quorum (50% + 1) required
3. Pause takes effect immediately
4. Users notified through all channels
5. Investigation and fix
6. Resume with steward approval

### State Recovery

If state corruption detected:

1. Identify affected UTxOs
2. Build recovery transaction
3. Steward multi-sig approval
4. Execute recovery
5. Verify integrity

## Contact

For deployment support:
- Technical: [deployment@ultralife.earth]
- Steward coordination: [stewards@ultralife.earth]
- Emergency: [emergency@ultralife.earth]
