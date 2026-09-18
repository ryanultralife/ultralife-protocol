# Genesis seal

Smart contracts are parameterized by a genesis out-ref at compile time. The
script hash includes that parameter. A copy of the Aiken source compiled
against a different out-ref is a **different policy**. Ticker collision
(`ULTRA`) is not theft.

## What is sealed

- One-shot genesis NFT sitting on a UTxO that validators may **reference**, never spend.
- Policy IDs for ULTRA, pNFT, impact, land, bioregion.
- Validator set. Upgrade = none.

## Why this works against mirrors

eUTxO does not have a global "this is the real ULTRA" registry. Authenticity
is the script hash. Anyone can compile a look-alike. They cannot:

- Spend the genesis UTxO (validators reject).
- Mint under the canonical policy (they don't have the parameterized hash).
- Fool an agent that checks `inspect_genesis` / `prove_seal`.

`prove_seal` runs two CEK failures on purpose: spend-genesis and fake-policy mint.

## Agent check

```
{"op":"tools/call","name":"inspect_genesis","arguments":{}}
{"op":"tools/call","name":"prove_seal","arguments":{}}
```

If `intact` is false, you are not on UltraLife. Stop.
