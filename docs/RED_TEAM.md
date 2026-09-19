# Red team — keys, bots, and what “break it” means

## Do not give Grok (or any bot) operational keys

| Key | Who holds it | Bots |
|-----|----------------|------|
| Founder / treasury / genesis | Hardware wallet. Ryan. | **Never.** |
| Daily protocol bot | None | Read-only Koios + git |
| Company fleet (CTO/CFO/…) | None for chain | Company, not protocol |
| **Burner attack wallet** | Dedicated preprod mnemonic, no ULTRA of value, no genesis | Optional, one process, preprod only |

If a Grok session, an automation, or `ultralife-managed-agents` can sign with treasury, the protocol is already lost — not because UltraLife is weak, but because you handed the attacker the owner key.

The security split does not change for red team:

```
LLM / Grok  →  build unsigned intent
Wallet      →  sign (burner only, on preprod)
Chain       →  law (Aiken). If the tx lands, the contract allowed it.
```

## What to attack first (no keys)

On the WASM node:

```
{"op":"tools/call","name":"red_team","arguments":{}}
```

Cases (all must hold, ledger unchanged):

| Id | Attack | Must |
|----|--------|------|
| A1 | Spend genesis UTxO | fail |
| A2 | Mint ULTRA under a mirror policy | fail |
| A3 | Ghost pNFT (no seal) | fail |
| A4 | Hydra verify without pNFT termination | fail |
| A5 | Register a pool without identity | fail |
| A6 | Canonical ULTRA mint with seal + pNFT | succeed |
| A7 | Marketplace is not a singleton batcher | succeed |

This is rehearsal. Passing it does **not** mean preprod is safe.

## What to attack on preprod (burner only)

Need: throwaway mnemonic, faucet ADA, Blockfrost preprod key. **Not** in git, **not** in chat, **not** in the protocol bot.

1. Submit a spend of the genesis out-ref → node/script must reject.
2. Mint `ULTRA` / `pNFT` with a freshly compiled lookalike policy → different policy id, not theft. Confirm Koios does not list it under `7c9f5578…`.
3. Double-spend a listing UTxO (two txs, same input) → one in, one out.
4. Build a singleton “market” tx that every list spends → if it works, we shipped a batcher. File as P0.
5. Hydra / L2 tx that does not terminate at a pNFT → must fail.

Until MeshSDK `service/` builds those unsigned txs, the WASM suite is the break-it gym. Do not claim Aiken is proven by a TypeScript CEK.

## Giving “the army” keys

No. Give **one** burner to **one** red-team runner when you are ready to pay faucet ADA. Revoke by emptying it. The standing Grok protocol bot stays keyless on purpose.
