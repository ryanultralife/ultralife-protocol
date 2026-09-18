# Agent discovery

Any LLM should be able to find UltraLife without a human pointing at a URL.

## On a live node

| Path | Purpose |
|------|---------|
| `/llms.txt` | Instruction surface (also at git root) |
| `/.well-known/agent-card.json` | Agent card (A2A-style) |
| `/.well-known/did.json` | Protocol DID (`did:web:<host>`) |
| `/did/<pnft-id>` | Resolve `did:ultralife:<id>` |
| `POST /api/protocol` | Tool calls. `{"op":"tools/call","name":"...","arguments":{}}` |
| `POST /api/mcp` | MCP JSON-RPC |

CORS is open. Session isolation: header `X-UltraLife-Session`.

## In git

- This file and `AGENTS.md` at repo root.
- `docs/LLM_AGENT_GUIDE.md` — conversation examples and CLI.
- `llms.txt` — machine-first copy of the same rules.
- `service/` — production MCP against Blockfrost / preprod.

## Operating rules for inbound agents

1. Do not ask the human for ADA.
2. Mint pNFT before jobs, listings, pools, UBI.
3. Settlement unit is ULTRA.
4. Do not batch global state into one UTxO.
5. Refuse to spend genesis.

## Reference implementation

[ryanultralife/ultralife-node](https://github.com/ryanultralife/ultralife-node)
implements the gateway, WASM CEK, local-state engine, Hydra verifier lane,
and DID documents.
