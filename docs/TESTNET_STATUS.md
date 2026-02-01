# UltraLife Protocol: Testnet Status

**Network:** Cardano Preprod
**Last Updated:** 2026-02-01
**Status:** Live - 34 validators deployed, pNFT minting operational

---

## Deployment Summary

| Metric | Value |
|--------|-------|
| Validators Deployed | 34 / 34 |
| Reference Scripts Locked | ~700 ADA |
| pNFTs Minted | 1+ |
| Network | Preprod |

---

## First pNFT Minted

```
ID:        pnft_ml361rj3_dcb6eb37787234c8
Policy ID: 7c9f5578c7d5815c89af5d4f4635b2aa390e3ed06facdb3ecf9971fc
Level:     Basic
Tx:        959f5ba634a5fc5f0d9072c4b26c78536f7ec130689489233a3aa9aff8bfe51d
```

View: [Cardanoscan](https://preprod.cardanoscan.io/transaction/959f5ba634a5fc5f0d9072c4b26c78536f7ec130689489233a3aa9aff8bfe51d)

---

## Deployed Validators (34)

All validators deployed as PlutusV3 reference scripts on preprod.

### Identity & Token
| Validator | Status | Config Type |
|-----------|--------|-------------|
| pnft.pnft.spend | Deployed | PnftConfig |
| pnft.pnft_policy.mint | Deployed | PnftConfig |
| token.token.spend | Deployed | TokenConfig |
| token.token_policy.mint | Deployed | TokenConfig |

### Economic Infrastructure
| Validator | Status | Config Type |
|-----------|--------|-------------|
| treasury.treasury.spend | Deployed | TreasuryConfig |
| ubi.ubi.spend | Deployed | UbiConfig |
| stake_pool.stake_pool.spend | Deployed | StakePoolConfig |
| governance.governance.spend | Deployed | GovernanceConfig |

### Bioregion & Land
| Validator | Status | Config Type |
|-----------|--------|-------------|
| bioregion.bioregion.spend | Deployed | BioregionConfig |
| bioregion.bioregion_policy.mint | Deployed | BioregionConfig |
| land_rights.land_rights.spend | Deployed | LandConfig |
| commons.commons.spend | Deployed | CommonsConfig |

### Impact System
| Validator | Status | Config Type |
|-----------|--------|-------------|
| impact.impact.spend | Deployed | ImpactConfig |
| impact_market.impact_market.spend | Deployed | ImpactConfig |
| impact_policy.impact_policy.mint | Deployed | ImpactConfig |
| remediation.remediation.spend | Deployed | RemediationConfig |
| preservation.preservation.spend | Deployed | PreservationConfig |
| asset_impact.asset_impact.spend | Deployed | AssetConfig |

### Marketplace & Work
| Validator | Status | Config Type |
|-----------|--------|-------------|
| marketplace.marketplace.spend | Deployed | MarketConfig |
| work_auction.work_auction.spend | Deployed | WorkConfig |

### Collectives & Care
| Validator | Status | Config Type |
|-----------|--------|-------------|
| collective.collective.spend | Deployed | CollectiveConfig |
| collective.collective_policy.mint | Deployed | CollectiveConfig |
| care.care.spend | Deployed | CareConfig |

### Records & Infrastructure
| Validator | Status | Config Type |
|-----------|--------|-------------|
| records.records.spend | Deployed | RegistryConfig |
| registry.registry.spend | Deployed | RegistryConfig |
| memory.memory.spend | Deployed | MemoryConfig |
| grants.grants.spend | Deployed | GrantsConfig |
| genesis.genesis.spend | Deployed | GenesisConfig |
| energy.energy.spend | Deployed | EnergyConfig |

### Hydra L2
| Validator | Status | Config Type |
|-----------|--------|-------------|
| spending_bucket.spending_bucket.spend | Deployed | BucketConfig |
| ultralife_validator.ultralife_validator.spend | Deployed | ValidatorConfig |
| fee_pool.fee_pool.spend | Deployed | FeeConfig |
| recovery.recovery.spend | Deployed | RecoveryConfig |

### Test Validators
| Validator | Status | Config Type |
|-----------|--------|-------------|
| test_simple.test_simple.spend | Deployed | None (no params) |

---

## Quick Test: Mint a pNFT

```bash
# Clone and setup
git clone https://github.com/ryanultralife/ultralife-protocol
cd ultralife-protocol/scripts
npm install

# Configure (create .env file)
echo "BLOCKFROST_API_KEY=preprodYOUR_KEY_HERE" > .env
echo "WALLET_SEED_PHRASE=your 24 word seed phrase here" >> .env
echo "NETWORK=preprod" >> .env

# Get test ADA from faucet
# https://docs.cardano.org/cardano-testnets/tools/faucet/

# Mint your pNFT
npm run mint:pnft:basic
```

---

## Architecture

```
scripts/
├── testnet-config.mjs    # Centralized parameter config
├── deploy-references.mjs # Deploy validators as reference scripts
├── mint-pnft.mjs         # Mint pNFT identity tokens
├── utils.mjs             # Shared utilities
└── deployment.json       # Deployment state (local)
```

### Key Technical Details

1. **Parameterized Validators**: All 34 validators take config parameters (oracles, thresholds)
2. **CBOR Encoding**: Scripts require `applyCborEncoding()` before deployment
3. **Reference Scripts**: Stored on-chain, referenced by transactions to save fees
4. **Centralized Config**: `testnet-config.mjs` ensures param consistency

---

## Known Issues

| Issue | Status | Workaround |
|-------|--------|------------|
| `fetchBlockchainTip` warning | Minor | Fallback to estimated slot |
| Only 1 clean UTxO after deploy | Minor | Script handles automatically |

---

## LLM Integration Status

| Component | Status | Notes |
|-----------|--------|-------|
| MCP Server | Defined | 30+ tools, needs MeshSDK migration |
| Claude Direct | Working | Build/run commands through conversation |
| Transaction Building | Working | `scripts/mint-pnft.mjs` operational |
| Chain Indexer | Partial | Blockfrost integration ready |

### Using Any LLM Coding Agent

See **[LLM_AGENT_GUIDE.md](./LLM_AGENT_GUIDE.md)** for full instructions.

Works with Claude Code, Cursor, Windsurf, Copilot, or any agent with terminal access:

```
You: "Mint me a pNFT"
Agent: Runs npm run mint:pnft:basic
Result: On-chain pNFT
```

### Full MCP Integration (TODO)

To enable `claude_desktop_config.json` integration:

1. Migrate builder from Lucid to MeshSDK
2. Point to deployed reference scripts
3. Add deployment.json loading for script references
4. Test all 30+ tools against preprod

---

## Links

- **Explorer**: [Preprod Cardanoscan](https://preprod.cardanoscan.io)
- **Faucet**: [Cardano Testnet Faucet](https://docs.cardano.org/cardano-testnets/tools/faucet/)
- **Repo**: [github.com/ryanultralife/ultralife-protocol](https://github.com/ryanultralife/ultralife-protocol)
