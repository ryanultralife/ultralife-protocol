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

Plant tools (`post_record`, `attest_control`, `presale_grant`, `close_ticket`, and the rest in `src/protocol/tools.ts`) follow `docs/PLANT_SPINE.md`. They build unsigned transactions. They do not mint the $20M raise as ULTRA and they do not depend on Midnight.
