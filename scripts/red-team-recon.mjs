#!/usr/bin/env node
/**
 * UltraLife red-team recon. No keys. Koios preprod only.
 *
 *   node red-team-recon.mjs
 *
 * Does not submit. Does not read .env.
 */
const KOIOS = "https://preprod.koios.rest/api/v1";
const POLICY = "7c9f5578c7d5815c89af5d4f4635b2aa390e3ed06facdb3ecf9971fc";
const NAME = "706e66745f6d6c333631726a335f64636236656233373738373233346338";
const MINT_TX = "959f5ba634a5fc5f0d9072c4b26c78536f7ec130689489233a3aa9aff8bfe51d";
const GENESIS_END_SLOT = 131_000_000; // scripts/testnet-config.mjs

async function get(path) {
  const r = await fetch(KOIOS + path, { headers: { accept: "application/json" } });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}
async function post(path, body) {
  const r = await fetch(KOIOS + path, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`);
  return r.json();
}

const tip = (await get("/tip"))[0];
const addrs = await get(`/asset_addresses?_asset_policy=${POLICY}&_asset_name=${NAME}`);
const utxos = await post("/asset_utxos", { _asset_list: [[POLICY, NAME]] });
const genesisEndedByTime = Number(tip.abs_slot) >= GENESIS_END_SLOT;

const holder = addrs[0]?.payment_address ?? null;
const utxo = utxos[0] ?? null;

const report = {
  when: new Date().toISOString(),
  network: "preprod",
  tip: {
    epoch: tip.epoch_no,
    block: tip.block_no ?? tip.block_height,
    era: tip.era,
    absSlot: tip.abs_slot,
  },
  genesis: {
    configuredEndSlot: GENESIS_END_SLOT,
    endedByTime: genesisEndedByTime,
    note:
      "Aiken genesis.spend EndGenesis does not require a founder key — only slot >= genesis_end_slot (or steward/oracle/bioregion thresholds) plus an output with genesis_active=False. If a genesis UTxO is still active, a burner can try to close it. WASM node 'never spend genesis' is stricter than this validator.",
  },
  pnft: {
    id: "pnft_ml361rj3_dcb6eb37787234c8",
    policy: POLICY,
    fingerprint: "asset1zqpf9a550pddcwa3t0tzjwgmdjgc2jgx5ylaxm",
    mintTx: MINT_TX,
    holder,
    utxo: utxo
      ? {
          tx: utxo.tx_hash,
          index: utxo.tx_index,
          stillMintOutput: utxo.tx_hash === MINT_TX && utxo.tx_index === 0,
          hasInlineDatum: Boolean(utxo.inline_datum || utxo.datum_hash),
          scriptLocked: Boolean(utxo.reference_script) || String(utxo.address ?? "").includes("addr_test1w"),
        }
      : null,
    warning:
      "This pNFT sits at a payment key, not a script address. A burner cannot spend it (missing vkey). The *holder* wallet can send it like any native asset unless the mint policy forbids transfer. Do not load that mnemonic into the red-team .env.",
  },
  morning: {
    generateBurner: "cd scripts && npm run setup:generate   # NEW mnemonic. Abort if address equals holder.",
    faucet: "https://docs.cardano.org/cardano-testnets/tools/faucet/",
    recon: "npm run red-team:recon",
    attack: "npm run red-team:preprod -- --attack steal-pnft",
  },
};

console.log(JSON.stringify(report, null, 2));
if (!utxo) {
  console.error("FAIL CLOSED: pNFT UTxO not found.");
  process.exit(2);
}
