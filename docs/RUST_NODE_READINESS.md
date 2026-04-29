# Amaru Rust Node Readiness Assessment

## What Amaru Is

Amaru is an open-source Rust node client for Cardano developed by PRAGMA — a consortium that includes the Cardano Foundation, Blink Labs, DC Spark, Sundae Labs, and TxPipe.

### Project Goals

- **Full Block-Producing Node**: Aims to run alongside Haskell nodes with full block production capability
- **Resource Efficiency**: On-disk ledger storage solves the memory-heavy Haskell node problem
- **Modern Architecture**: Different design trade-offs for full-node capabilities with constrained resources

### Current Status

- **Relay Node**: Functioning as a relay node
- **Block Forging**: In development, not yet available
- **Mempool**: Under development

---

## Why It Matters for UltraLife

### SNEV Stakepool

| Consideration | Impact |
|--------------|--------|
| **Lower Resource Requirements** | Could run on lower-resource hardware once block-producing capability is stable |
| **On-Disk Ledger** | Reduces memory requirements significantly compared to Haskell node |
| **Bioregion Deployment** | Important for stakepools that may run in resource-constrained environments |

### Masumi/MCP Integration

| Feature | Benefit |
|---------|---------|
| **gRPC Interfaces** | Alongside legacy Ouroboros node-to-client mini-protocols |
| **utxoRPC Specification** | Cleaner API surface for LLM-to-chain communication |
| **Simplified Integration** | Could simplify the MCP service's chain interaction layer |

### Consensus Evolution

| Upgrade | Expected | Relevance |
|---------|----------|-----------|
| **Ouroboros Peras** | 2026 | Reduces finality to 45-60 seconds |
| **Ouroboros Leios** | 2026 | 100x+ throughput improvement |

Both matter for real-time Impact Token settlement in supply chain scenarios. Amaru team has indicated readiness for Leios integration.

---

## Network Diversity

### Why Multiple Implementations Matter

- **Reduced Single-Point-of-Failure Risk**: Multiple node implementations increase network resilience
- **Decentralization Principles**: Aligns with UltraLife's core architecture philosophy
- **Platform Flexibility**: Rust's ecosystem enables targeting multiple platforms (WASM, RISC-V)
- **Contributor Diversity**: Different tech stack attracts different contributors to core Cardano maintenance

---

## Timeline and Status

### Current Milestone

- Relay node: **Functional**
- Mempool: **In development**
- Block forging: **In development**

### UltraLife Evaluation Timeline

| Phase | Trigger | Action |
|-------|---------|--------|
| **Monitor** | Now | Track PRAGMA GitHub for progress |
| **Evaluate** | Block forging stable | Test on private testnet |
| **Consider** | Production-ready | Evaluate for SNEV stakepool |

### Not Actionable Today

Amaru needs to complete block forging and Leios support before SPO adoption. This document tracks readiness for future integration.

---

## Integration Considerations

### When Amaru Becomes Viable

```
CURRENT SNEV STACK
├── Haskell cardano-node
├── Blockfrost API
└── MCP service (Node.js)

POTENTIAL FUTURE STACK
├── Amaru (Rust)
├── Native gRPC / utxoRPC
└── MCP service (Node.js or Rust)
```

### gRPC/utxoRPC Benefits

- Direct node communication without Blockfrost intermediary
- Reduced latency for transaction submission
- Streaming subscriptions for real-time updates
- Cleaner API for MCP tool implementation

### Migration Path

1. No action required until Amaru reaches block-producing stability
2. First integration point: utxoRPC for chain queries (parallel to Blockfrost)
3. Full migration only after extensive testnet validation

---

## Ouroboros Peras: Faster Finality

### What It Is

Ouroboros Peras is a consensus upgrade that reduces settlement finality to 45-60 seconds (down from ~20 minutes current probabilistic finality).

### Why It Matters

| Use Case | Current | With Peras |
|----------|---------|------------|
| Impact Token Settlement | Wait for block confirmations | Near-instant finality |
| Supply Chain Tracking | Delayed confirmation | Real-time updates |
| Cross-Bioregion Transfers | Multi-block wait | Sub-minute settlement |

### UltraLife Integration

- No contract changes required
- Improves UX for all L1 transactions
- Particularly valuable for supply chain Impact Token scenarios where real-time tracking matters

---

## References

- **Amaru GitHub**: https://github.com/pragma-org/amaru
- **Amaru Documentation**: https://amaru.global/about/
- **PRAGMA Organization**: https://pragma.builders/projects/amaru/
- **Budget Proposal**: https://hackmd.io/@PRAGMA-org/amaru-proposal
