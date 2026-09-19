#!/usr/bin/env node
/**
 * Preprod red-team. BURNER KEYS ONLY.
 *
 * Env (scripts/.env — gitignored):
 *   NETWORK=preprod
 *   BLOCKFROST_API_KEY=preprod...
 *   WALLET_SEED_PHRASE=twenty four words of a THROWAY faucet wallet
 *
 * Abort if the derived address is the live pNFT holder.
 *
 *   node red-team-preprod.mjs --recon
 *   node red-team-preprod.mjs --attack steal-pnft
 *   node red-team-preprod.mjs --attack steal-pnft --submit   # actually hit the node
 */
import "dotenv/config";
import { BlockfrostProvider, MeshWallet, MeshTxBuilder } from "@meshsdk/core";

const HOLDER =
  "addr_test1qq7h5wjmrzndkgh72yccequa8hmmyl4zvun69s9f0tkkjj5e26dxj5xkkwfd3we2lak2wnn7f7rskcz97phn7wt3ly0qtvtzzc";
const POLICY = "7c9f5578c7d5815c89af5d4f4635b2aa390e3ed06facdb3ecf9971fc";
const NAME = "706e66745f6d6c333631726a335f64636236656233373738373233346338";
const MINT_TX = "959f5ba634a5fc5f0d9072c4b26c78536f7ec130689489233a3aa9aff8bfe51d";

const args = process.argv.slice(2);
const attack = args.includes("--attack") ? args[args.indexOf("--attack") + 1] : "recon";
const submit = args.includes("--submit");

function fail(msg) {
  console.error(`FAIL CLOSED: ${msg}`);
  process.exit(2);
}

if (attack === "recon" || !process.env.WALLET_SEED_PHRASE) {
  const { spawnSync } = await import("node:child_process");
  const r = spawnSync(process.execPath, [new URL("./red-team-recon.mjs", import.meta.url).pathname], {
    stdio: "inherit",
  });
  process.exit(r.status ?? 1);
}

const key = process.env.BLOCKFROST_API_KEY;
const seed = process.env.WALLET_SEED_PHRASE?.trim().split(/\s+/);
if (!key || key.startsWith("your_")) fail("BLOCKFROST_API_KEY missing. Burner only.");
if (!seed || seed.length < 15) fail("WALLET_SEED_PHRASE missing. Generate a NEW one with npm run setup:generate.");
if (/your twenty four/i.test(process.env.WALLET_SEED_PHRASE)) fail("placeholder seed");

const provider = new BlockfrostProvider(key);
const wallet = new MeshWallet({
  networkId: 0,
  fetcher: provider,
  submitter: provider,
  key: { type: "mnemonic", words: seed },
});
const change = wallet.getChangeAddress();
console.log("burner", change);
if (change === HOLDER) {
  fail("This seed IS the pNFT holder. You loaded operational keys. Stop. Generate a new mnemonic.");
}

if (attack !== "steal-pnft") fail(`unknown attack ${attack}. Known: steal-pnft`);

const unit = POLICY + NAME;
const victim = `${MINT_TX}#0`;
console.log("attack steal-pnft: spend", victim, "asset", unit, "as a stranger");
console.log("expect: build or submit rejected (missing vkey witness / not wallet utxo)");

try {
  const tx = new MeshTxBuilder({ fetcher: provider });
  tx.txIn(MINT_TX, 0)
    .txOut(change, [{ unit, quantity: "1" }, { unit: "lovelace", quantity: "2000000" }])
    .changeAddress(change)
    .selectUtxosFrom(await wallet.getUtxos());
  const unsigned = await tx.complete();
  console.log("UNEXPECTED: builder produced a tx that spends the victim UTxO");
  if (submit) {
    const signed = await wallet.signTx(unsigned);
    const hash = await wallet.submitTx(signed);
    console.log("LANDED", hash, "— CONTRACT/LEDGER ALLOWED THEFT. P0.");
    process.exit(3);
  } else {
    console.log("dry-run: not submitting. Re-run with --submit to hit preprod.");
    process.exit(3);
  }
} catch (e) {
  console.log("HELD: steal-pnft rejected");
  console.log(String(e?.message || e).slice(0, 500));
  process.exit(0);
}
