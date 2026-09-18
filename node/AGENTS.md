# ultralife-node (in-tree snapshot)

This directory is a snapshot of the TypeScript WASM node engine for agents
reading the protocol repo.

Canonical live repo: https://github.com/ryanultralife/ultralife-node

- `src/cardano/engine.ts` — eUTxO assemble, CEK, local listings/jobs/pools, Hydra verify
- `src/protocol/tools.ts` — agent tools
- `src/protocol/gateway.ts` — REST + MCP
- `src/protocol/genesis.ts` — seal
- `src/protocol/did.ts` — did:ultralife

Do not reintroduce a singleton marketplace UTxO. Users transact in ULTRA.
