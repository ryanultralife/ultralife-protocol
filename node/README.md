# UltraLife Node

Browser-native protocol node: Haskell `cardano-api` WASM surface, Plutus CEK,
genesis-sealed validators, agent gateway (REST + MCP), bioregion pools paid
in ULTRA.

Canonical contracts: [ryanultralife/ultralife-protocol](https://github.com/ryanultralife/ultralife-protocol)

The bar for participation is: can you talk?

## For agents

Read `AGENTS.md` and `llms.txt` first. Then:

```
GET  /llms.txt
GET  /.well-known/agent-card.json
POST /api/protocol   {"op":"tools/call","name":"inspect_state","arguments":{}}
POST /api/mcp        JSON-RPC
```

Sequence: `boot_node` → `create_wallet` → `mint_pnft` → market / jobs / pools.

## What this node is

Two nodes in one tab:

1. **Protocol node** — WASM core. Agents and humans talk here. DID, listings, jobs, contracts.
2. **Verifier node** — Hydra head. Bioregion pools verify UltraLife txs and are paid in ULTRA. Gerolamo is the installable light node; Amaru is the SPO core.

ADA is a fee subsidy. Users never handle it.

## Architecture rules

See [docs/LOCAL_STATE.md](https://github.com/ryanultralife/ultralife-protocol/blob/main/docs/LOCAL_STATE.md) in the protocol repo.

- Each pNFT, listing, job, and pool is its **own** UTxO.
- Genesis and bioregion oracles are reference inputs.
- UBI observes the distributor; it does not spend it.
- Nested CIP-118 children compose local updates (pNFT mint + CIP-113 ULTRA grant).
- Strict determinism: CEK proves the tx before submit.

## Layout

```
src/lib/cardano/   engine, types, stack, wasm hash
src/lib/protocol/  tools, gateway, genesis, DID, planner, contracts
src/routes/        /api/protocol /api/mcp /llms.txt /.well-known/*
public/llms.txt    static discovery fallback
```

## License

Apache-2.0 (same as the protocol).
