# Local state, not batchers

eUTxO is a borrow checker. A UTxO is spent once. Any datum in it is recreated
in a new output — not mutated. That is the functional model.

It does **not** automatically give parallelism. Parallelism exists only when
two transactions do not need the same output.

## The Cardano failure mode

Most Cardano dApps shove a global order book, DEX liquidity, or auction into
**one** script UTxO and add batchers so many users can take turns. That is an
account machine wearing a UTxO costume. It is the worst of both worlds:
one-shot contention **and** global state.

FuelVM's answer (Devcon Bogotá, non-EVM L2s) was to relax strict determinism
so Uniswap-shaped apps can run. UltraLife does not need Uniswap.

## UltraLife's answer

Keep strict determinism (an agent can prove a tx in the CEK before submit).
Shard state so txs do not collide.

| Object | On-chain shape |
|--------|----------------|
| pNFT / DID | One UTxO per human |
| Marketplace listing | Own `marketplace` output. Two people can list at once. |
| Work auction / job | Own `work_auction` output. Bid recreates *that* job. |
| Bioregion pool | Own `stake_pool` output |
| Bioregion health | Reference input (many readers, nobody spends) |
| Genesis seal | Reference-only NFT + out-ref. Cannot be spent. |
| UBI distributor | Observed, not spent. Mint ULTRA against the pNFT + bioregion ref. |
| High-frequency chatter | Hydra head per bioregion. Still terminates at a pNFT. Paid in ULTRA. |

A singleton `MARKET` UTxO that every `list` spends is a **bug**. Do not reintroduce it.

## Two nodes

1. **Protocol node** — Haskell `cardano-api` in WASM (this tab / `ultralife-node`). Agents talk here.
2. **Verifier node** — Hydra head, Gerolamo as the installable light node, Amaru as SPO core. Bioregion pools run this and are paid in ULTRA.

## See also

- `docs/GENESIS_SEAL.md`
- `docs/AGENT_DISCOVERY.md`
- [ultralife-node](https://github.com/ryanultralife/ultralife-node)
