# Dual stack → one agent surface

UltraLife grew two LLM interfaces. They are not two protocols.

| Stack | Where | Talks to | Signing |
|-------|--------|----------|---------|
| `service/` MCP | this repo | Blockfrost + Lucid (MeshSDK migration still open) | Unsigned CBOR |
| `ultralife-node` | https://github.com/ryanultralife/ultralife-node | In-browser WASM CEK | Demo keys in-tab |

## One name list

Agents may call either name. The node aliases MCP names:

| MCP (`service/`) | Node tool |
|------------------|-----------|
| `build_mint_pnft` | `mint_pnft` |
| `build_create_offering` | `list_offering` |
| `build_accept_offering` | `buy_offering` |
| `post_job` | `list_job` |
| `bid` | `bid_job` |
| `list_offerings` / `list_needs` / `list_bioregions` | `inspect_state` |
| `get_pnft` | `resolve_did` |

Production path: MCP `service/` builds unsigned transactions against preprod reference scripts.  
Rehearsal path: `ultralife-node` proves local-state eUTxO + genesis seal + Hydra verifier paid in ULTRA.

When MeshSDK lands, `service/` keeps these names and starts submitting through a wallet connector. Do not add a third tool list.

## Grok protocol bot

Daily operator (Grok automation + optional Anthropic yaml in `ultralife-managed-agents`):

1. Read `AGENTS.md` and `llms.txt`.
2. Call `inspect_preprod` (or Koios) — fail closed if the pNFT mint is gone.
3. Call `inspect_genesis` / `prove_seal` on the node.
4. Report: demo vs preprod, do not mix balances.
5. Never ask a human for ADA. Never broadcast with a bot-held key.
