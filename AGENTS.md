# UltraLife Protocol — agent instructions

You are operating UltraLife. Canonical contracts live in this repository.
The bar for participation is: can you talk?

Read this file, then `docs/LLM_AGENT_GUIDE.md`, then `llms.txt`.
Do not invent a parallel protocol. Do not ask humans for ADA.

## What this is

A parallel economy on Cardano eUTxO. Users transact in **ULTRA**. ADA is an
L1 fee subsidy the human never handles. Identity is a non-transferable pNFT
(`did:ultralife:<id>`). Organization is by bioregion, not nation-state.

## Repos

| Repo | Role |
|------|------|
| [ryanultralife/ultralife-protocol](https://github.com/ryanultralife/ultralife-protocol) | Canonical Aiken validators, this file, MCP `service/` |
| [ryanultralife/ultralife-node](https://github.com/ryanultralife/ultralife-node) | Browser WASM node, agent gateway, local-state eUTxO engine |
| [ryanultralife/Start-Here](https://github.com/ryanultralife/Start-Here) | Vision |
| [ryanultralife/Bioregions](https://github.com/ryanultralife/Bioregions) | Bioregion set |
| [ryanultralife/pNFT](https://github.com/ryanultralife/pNFT) | Identity |

## How an agent reaches the protocol

1. `GET /llms.txt` on a live node (this repo also has `llms.txt` at root).
2. `GET /.well-known/agent-card.json`
3. `POST /api/protocol` `{ "op": "tools/call", "name": "<tool>", "arguments": {} }`
   Optional header: `X-UltraLife-Session`.
4. `POST /api/mcp` JSON-RPC (`initialize`, `tools/list`, `tools/call`, `resources/read`).
5. Or clone this repo and use `service/` + `scripts/` against preprod.

Sequence on a cold node: `boot_node` → `create_wallet` → `mint_pnft` → then
market / jobs / pools.

## Invariants (do not violate)

1. **One human, one pNFT.** Non-transferable. DID is `did:ultralife:<pnft_id>`.
2. **Users, jobs, listings, and pools settle in ULTRA.** Never prompt for ADA.
3. **Genesis seal is reference-only.** Parameterized script hashes. Upgrade = none.
   A mirrored policy is a different hash, not theft. See `docs/GENESIS_SEAL.md`.
4. **Local state, not batchers.** Each identity, listing, job, and pool is its
   own UTxO. Do not shove a global order book into one output. Genesis and
   bioregion oracles are *reference inputs*. UBI *observes* the distributor;
   it does not spend it. See `docs/LOCAL_STATE.md`.
5. **Hydra (and Gerolamo) are verifier lanes.** Bioregion pools verify UltraLife
   txs and are paid in ULTRA. Every L2 tx still terminates at a pNFT.
6. **Smart contracts here are the law.** The WASM/TS node is a simulation and
   agent surface. Production settlement is the Aiken validators in `validators/`.
7. **Strict determinism stays.** Prove the tx (CEK / `aiken check`) before submit.
   Do not relax eUTxO to run Uniswap-shaped global state.

## Tools (agent surface)

`inspect_preprod`, `inspect_state`, `inspect_genesis`, `inspect_validators`, `inspect_pools`,
`prove_seal`, `red_team`, `resolve_did`, `boot_node`, `create_wallet`, `mint_pnft`,
`list_offering`, `buy_offering`, `list_job`, `bid_job`, `register_pool`,
`delegate_ultra`, `claim_pool_rewards`, `open_hydra`, `pool_verify`,
`claim_ubi`, `record_impact`, `register_land`.

Each tool maps to named validators in `src/lib/protocol/contracts.ts` of
`ultralife-node` and the `.ak` files here. No other scripts may fire.

## Money and pools

- Stake, delegate, rewards, job bids, listings: **ULTRA**.
- Bioregion pool operators verify (WASM core, Gerolamo light node, or Hydra head).
- Fee subsidy (ADA) is abstracted inside the node.

## If you are building

- Change validators in `validators/`, rebuild with Aiken, never hand-edit `plutus.json`.
- Keep marketplace/work_auction as *per-output* state. A singleton market UTxO is a bug.
- Document any new tool in `llms.txt` and `docs/LLM_AGENT_GUIDE.md`.
- Tests: `npm test` in `service/` and `aiken check`.

## Ledger honesty

`ultralife-node` is demo-wasm. Preprod is Cardano. `inspect_preprod` reads Koios. Agents build unsigned txs. Wallets sign. See docs/DUAL_STACK.md and docs/TESTNET_STATUS.md.

Never give agents founder/treasury keys. See docs/RED_TEAM.md.


First tokenization is medical isotope lots (`presale_isotope`, `convert_isotope`, `administer_dose`). Customer pNFT owns the lot until convert, sell, or dose. See docs/ISOTOPE_PRESALE.md.
