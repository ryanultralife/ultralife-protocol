# Morning: preprod red team

You do this. Grok does not hold the seed.

## 0. Hard stops

- **New mnemonic.** Not the wallet that minted `pnft_ml361rj3_…`. That pNFT still sits at:

  `addr_test1qq7h5wjmrzndkgh72yccequa8hmmyl4zvun69s9f0tkkjj5e26dxj5xkkwfd3we2lak2wnn7f7rskcz97phn7wt3ly0qtvtzzc`

  If `npm run show:address` prints that address, you loaded operational keys. Stop.

- Do not paste the seed into Grok, Discord, or git. `scripts/.env` is gitignored.
- Daily protocol bot stays keyless.

## 1. Burner

```bash
cd ultralife-protocol/scripts
cp .env.example .env
# Blockfrost preprod project key
npm install
npm run setup:generate
npm run show:address
```

Faucet that address: https://docs.cardano.org/cardano-testnets/tools/faucet/

Need ~20 test ADA.

## 2. Recon (no keys)

```bash
npm run red-team:recon
```

Tonight’s snapshot (2026-09-19):

- Tip Conway epoch 314, slot **134,108,827**
- Configured `GENESIS_END_SLOT` **131,000,000** → **genesis is over by time**
- pNFT still the mint output (`959f5ba6…#0`), payment key, quantity 1

## 3. Attack

```bash
npm run red-team:preprod -- --attack steal-pnft
# if builder rejects, good. only then:
npm run red-team:preprod -- --attack steal-pnft --submit
```

**Pass** = reject. **Fail** = a tx hash. That is P0.

## 4. What Grok cannot do until you have a local `deployment.json`

`scripts/deployment.json` is gitignored (real script addresses). Copy it onto the machine you run from if you still have the Feb deploy record. Then we can aim `EndGenesis` at the actual genesis UTxO.

Aiken `genesis.spend` / `EndGenesis` does **not** require a founder key — only `slot >= genesis_end_slot` (already true) and an output with `genesis_active = False`. WASM “never spend genesis” is stricter than the validator. If that UTxO exists, a burner *should be able to close genesis*. Decide if that is intended.

## 5. After

Empty the burner. Do not reuse it. Tell Grok the results (reject vs hash), not the seed.
