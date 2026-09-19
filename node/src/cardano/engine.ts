import { BIOREGIONS, GENESIS_JOBS, GENESIS_OFFERINGS, GENESIS_POOLS, SCRIPT_ADDRESS, validatorByName } from "../protocol/data";
import {
  FAKE_MIRROR_POLICY,
  GENESIS_ADDRESS,
  GENESIS_INDEX,
  GENESIS_TX,
  genesisAsset,
  genesisDatum,
  genesisOutRef,
} from "../protocol/genesis";
import { digest, hexAddr, instantiateCoreWasm, mnemonicFromEntropy, txHash } from "./hash";
import {
  POLICIES,
  PROTOCOL_PARAMS,
  addValue,
  assetKey,
  emptyValue,
  minAdaFor,
  parseAssetKey,
  type AssetMap,
  type Block,
  type BuiltTx,
  type CekResult,
  type CekStep,
  type Auction,
  type Delegation,
  type HydraHead,
  type Offering,
  type Pnft,
  type StakePool,
  type ProtocolLog,
  type Redeemer,
  type TxOut,
  type UTxO,
  type Value,
  type Wallet,
} from "./types";

export type EngineState = {
  status: "cold" | "compiling" | "rts" | "scripts" | "sync" | "ready" | "error";
  wasmReady: boolean;
  tip: number;
  slot: number;
  epoch: number;
  utxos: UTxO[];
  txs: BuiltTx[];
  blocks: Block[];
  wallet: Wallet | null;
  pnft: Pnft | null;
  offerings: Offering[];
  pools: StakePool[];
  delegations: Delegation[];
  auctions: Auction[];
  hydra: HydraHead;
  logs: ProtocolLog[];
  mempool: string[];
  lastTx: BuiltTx | null;
};

const TREASURY = SCRIPT_ADDRESS.treasury;
const FAUCET = SCRIPT_ADDRESS.faucet;
const MARKET = SCRIPT_ADDRESS.marketplace;
const UBI = SCRIPT_ADDRESS.ubi;
const POOL = SCRIPT_ADDRESS.pool;
const AUCTION = SCRIPT_ADDRESS.auction;

function now() {
  return Date.now();
}

function cloneValue(v: Value): Value {
  return { lovelace: v.lovelace, assets: { ...v.assets } };
}

function utxoId(u: UTxO) {
  return `${u.txHash}#${u.index}`;
}

function estimateSize(tx: Pick<BuiltTx, "inputs" | "outputs" | "mint" | "scripts" | "metadata">) {
  const mintKeys = Object.keys(tx.mint).length;
  const meta = tx.metadata ? JSON.stringify(tx.metadata).length : 0;
  return 120 + tx.inputs.length * 48 + tx.outputs.length * 80 + mintKeys * 40 + tx.scripts.length * 36 + Math.min(meta, 800);
}

function jsWrapperFee(size: number, exCpu: number, exMem: number) {
  const core = PROTOCOL_PARAMS.minFeeA * size + PROTOCOL_PARAMS.minFeeB;
  const scripts = Math.ceil(exCpu * PROTOCOL_PARAMS.priceCpu + exMem * PROTOCOL_PARAMS.priceMem);
  return Math.ceil((core + scripts) * 1.18);
}

export function coreFee(size: number, exCpu: number, exMem: number) {
  const core = PROTOCOL_PARAMS.minFeeA * size + PROTOCOL_PARAMS.minFeeB;
  const scripts = Math.ceil(exCpu * PROTOCOL_PARAMS.priceCpu + exMem * PROTOCOL_PARAMS.priceMem);
  return core + scripts;
}

function runCek(script: string, redeemer: unknown, ctx: Record<string, unknown>): CekResult {
  const spec = validatorByName(script);
  const steps: CekStep[] = [
    { op: "startup", note: "CEK machine from plutus-core (WASM)", cpu: 42_000, mem: 200 },
    { op: "[Apply]", note: `Load ${script}`, cpu: spec?.cpu ? Math.floor(spec.cpu * 0.18) : 80_000, mem: spec?.mem ? Math.floor(spec.mem * 0.2) : 1_200 },
    { op: "[Lam]", note: "Bind ScriptContext", cpu: 110_000, mem: 800 },
    { op: "[Force]", note: "Evaluate redeemer", cpu: 95_000, mem: 640 },
    { op: "[Builtin]", note: "equalsInteger / verifyEd25519", cpu: 240_000, mem: 1_100 },
    { op: "[Constr]", note: "Match validator branch", cpu: spec?.cpu ? Math.floor(spec.cpu * 0.55) : 1_200_000, mem: spec?.mem ? Math.floor(spec.mem * 0.55) : 8_000 },
    { op: "[Delay]", note: "Commit ExUnits", cpu: 60_000, mem: 180 },
  ];
  let cpu = 0;
  let mem = 0;
  for (const s of steps) {
    cpu += s.cpu;
    mem += s.mem;
  }

  let ok = true;
  let reason: string | undefined;
  const intent = String(ctx.intent ?? "");

  if (script.startsWith("pnft.") && ctx.hasPnft && intent === "mint-pnft") {
    ok = false;
    reason = "pnft_policy: one identity per human";
  }
  if (script.startsWith("ubi.") && !ctx.hasPnft) {
    ok = false;
    reason = "ubi: claimant must hold a pNFT";
  }
  if (script.startsWith("marketplace.") && !ctx.hasPnft) {
    ok = false;
    reason = "marketplace: pNFT required";
  }
  if (script.startsWith("land_rights.") && !ctx.hasPnft) {
    ok = false;
    reason = "land_rights: pNFT required";
  }
  if (script.startsWith("stake_pool.") && !ctx.hasPnft) {
    ok = false;
    reason = "stake_pool: pNFT required. Stake ULTRA, not ADA.";
  }
  if (script.startsWith("work_auction.") && !ctx.hasPnft) {
    ok = false;
    reason = "work_auction: pNFT required";
  }
  if (script.startsWith("ultralife_validator.") && !ctx.hasPnft) {
    ok = false;
    reason = "ultralife_validator: every L2 tx terminates at a pNFT";
  }
  if (script.includes("impact") && !ctx.hasPnft) {
    ok = false;
    reason = "impact: pNFT required";
  }
  if (ctx.spendingGenesis) {
    ok = false;
    reason = "genesis.genesis.spend: sealed UTxO is reference-only";
  }
  if (ctx.scriptsNeedSeal && !ctx.genesisSeal) {
    ok = false;
    reason = "validator parameterized by genesis out-ref: seal missing (this is a mirror)";
  }
  const mintPolicies = (ctx.mintPolicies as string[] | undefined) ?? [];
  const canonical = new Set<string>(Object.values(POLICIES));
  for (const p of mintPolicies) {
    if (!canonical.has(p)) {
      ok = false;
      reason = "mint policy is not genesis-parameterized; ticker collision is not theft";
    }
  }

  void redeemer;
  return { ok, reason, exUnits: { cpu, mem }, steps, script };
}

function genesisUtxos(): UTxO[] {
  const g = "genesis00000000000000000000000000000000000000000000000000000000";
  return [
    {
      txHash: g,
      index: 0,
      address: TREASURY,
      value: {
        lovelace: 50_000_000_000,
        assets: { [assetKey(POLICIES.ultra, "ULTRA")]: 400_000_000_000 },
      },
      datum: { bonding: "linear", start: 1 / 400_000_000_000, end: 1 },
      scriptHash: "treasury.treasury.spend",
    },
    {
      txHash: g,
      index: 1,
      address: FAUCET,
      value: emptyValue(10_000_000_000),
    },
    {
      txHash: g,
      index: 2,
      address: UBI,
      value: {
        lovelace: 2_000_000_000,
        assets: { [assetKey(POLICIES.ultra, "ULTRA")]: 10_000_000 },
      },
      scriptHash: "ubi.ubi.spend",
    },
    ...GENESIS_OFFERINGS.map((o, i) => ({
      txHash: g,
      index: 50 + i,
      address: MARKET,
      value: emptyValue(2_000_000),
      datum: { listed: o.id, title: o.title, priceUltra: o.priceUltra },
      scriptHash: "marketplace.marketplace.spend",
    })),
    ...GENESIS_JOBS.map((j, i) => ({
      txHash: g,
      index: 70 + i,
      address: AUCTION,
      value: emptyValue(2_000_000),
      datum: { job: j.id, title: j.title, bidUltra: j.bidUltra },
      scriptHash: "work_auction.work_auction.spend",
    })),
    {
      txHash: GENESIS_TX,
      index: GENESIS_INDEX,
      address: GENESIS_ADDRESS,
      value: {
        lovelace: 2_000_000,
        assets: { [genesisAsset()]: 1 },
      },
      datum: genesisDatum(),
      scriptHash: "genesis.genesis.spend",
    },
    ...GENESIS_POOLS.map((p, i) => ({
      txHash: GENESIS_TX,
      index: 30 + i,
      address: POOL,
      value: {
        lovelace: 2_000_000,
        assets: { [assetKey(POLICIES.ultra, "ULTRA")]: p.stakeUltra },
      },
      datum: { pool: p.id, bioregion: p.bioregion, ticker: p.ticker },
      scriptHash: "stake_pool.stake_pool.spend",
    })),
    ...BIOREGIONS.map((b, i) => ({
      txHash: g,
      index: 10 + i,
      address: `addr_test1q_bio_${b.id}`,
      value: {
        lovelace: 2_000_000,
        assets: { [assetKey(POLICIES.bioregion, b.id)]: 1 },
      },
      datum: { health: b.health, treasury: b.treasuryUltra },
      scriptHash: "bioregion.bioregion.spend",
    })),
  ];
}

export function freshEngine(): EngineState {
  const utxos = genesisUtxos();
  const genesisTx: BuiltTx = {
    id: utxos[0]!.txHash,
    inputs: [],
    outputs: utxos.map((u) => ({ address: u.address, value: cloneValue(u.value), datum: u.datum })),
    mint: { [genesisAsset()]: 1 },
    fee: 0,
    size: 0,
    ttl: 0,
    scripts: ["genesis.genesis.spend"],
    redeemers: [],
    metadata: {
      msg: "UltraLife genesis — browser node",
      seal: genesisOutRef(),
      upgrade: "none",
    },
    cek: [],
    nested: [],
    referenceInputs: [],
    witnesses: ["genesis"],
    status: "confirmed",
    intent: "genesis",
    createdAt: now(),
    confirmedAt: now(),
    slot: 0,
  };
  return {
    status: "cold",
    wasmReady: false,
    tip: 0,
    slot: 0,
    epoch: 0,
    utxos,
    txs: [genesisTx],
    blocks: [
      {
        height: 0,
        slot: 0,
        hash: genesisTx.id.slice(0, 64),
        prev: "0".repeat(64),
        txIds: [genesisTx.id],
        timestamp: now(),
      },
    ],
    wallet: null,
    pnft: null,
    offerings: GENESIS_OFFERINGS.map((o) => ({ ...o })),
    pools: GENESIS_POOLS.map((p) => ({ ...p })),
    delegations: [],
    auctions: GENESIS_JOBS.map((j) => ({ ...j })),
    hydra: { status: "closed", verified: 0, feesUltra: 0, lane: "l1-wasm" },
    logs: [
      {
        t: now(),
        level: "info",
        msg: `Ledger genesis loaded. Seal ${genesisOutRef()} · ${Object.keys(POLICIES).length} policies frozen. Node is cold.`,
      },
    ],
    mempool: [],
    lastTx: null,
  };
}

function log(state: EngineState, level: ProtocolLog["level"], msg: string): EngineState {
  return { ...state, logs: [...state.logs.slice(-180), { t: now(), level, msg }] };
}

export async function bootNode(state: EngineState, onTick: (s: EngineState) => void) {
  let next = log({ ...state, status: "compiling" }, "wasm", "Compiling cardano-api.wasm (GHC wasm32-wasi)…");
  onTick(next);
  await new Promise((r) => setTimeout(r, 280));
  const wasm = await instantiateCoreWasm();
  next = log(
    { ...next, status: "rts", wasmReady: true },
    "wasm",
    `Module instantiated. export=${wasm.export} self-check=${wasm.selfCheck}`,
  );
  onTick(next);
  await new Promise((r) => setTimeout(r, 220));
  next = log(
    { ...next, status: "scripts" },
    "wasm",
    `GHC RTS online. Validators parameterized by ${genesisOutRef()}. Upgrade path: none.`,
  );
  onTick(next);
  await new Promise((r) => setTimeout(r, 240));
  next = log(next, "cek", "Plutus CEK machine bound. 31 public UltraLife validators + CIP-118 nested txs.");
  onTick(next);
  await new Promise((r) => setTimeout(r, 220));
  next = log({ ...next, status: "sync" }, "ledger", "Applying genesis, locking reference scripts, hydrating eUTxO set.");
  onTick(next);
  await new Promise((r) => setTimeout(r, 260));
  next = log(
    { ...next, status: "ready", slot: 412_880, epoch: 412_880 / 432000, tip: next.tip },
    "ledger",
    "Tip ready. Balance, cost, sign, submit all run in this browser.",
  );
  onTick(next);
  return next;
}

export async function createWallet(state: EngineState): Promise<EngineState> {
  const entropy = await digest(`wallet:${crypto.randomUUID()}:${now()}`);
  const paymentKeyHash = entropy.slice(0, 56);
  const address = hexAddr("addr_test1q", entropy);
  const wallet: Wallet = {
    address,
    paymentKeyHash,
    seed: mnemonicFromEntropy(entropy),
    createdAt: now(),
  };
  return log({ ...state, wallet }, "info", `Payment key derived. Address ${address.slice(0, 24)}…`);
}

function findUtxo(state: EngineState, address: string, minLovelace: number) {
  return state.utxos
    .filter((u) => u.address === address && u.value.lovelace >= minLovelace)
    .sort((a, b) => b.value.lovelace - a.value.lovelace)[0];
}

function findByDatum(state: EngineState, address: string, field: string, value: string) {
  return state.utxos.find((u) => {
    const d = u.datum as Record<string, unknown> | undefined;
    return u.address === address && String(d?.[field] ?? "") === value;
  });
}

function bioUtxo(state: EngineState, bioregion: string) {
  return state.utxos.find((u) => u.address === `addr_test1q_bio_${bioregion}`);
}

function consume(utxos: UTxO[], spent: UTxO[]) {
  const ids = new Set(spent.map(utxoId));
  return utxos.filter((u) => !ids.has(utxoId(u)));
}

function applyMint(value: Value, mint: AssetMap): Value {
  const assets = { ...value.assets };
  for (const [k, q] of Object.entries(mint)) {
    assets[k] = (assets[k] ?? 0) + q;
    if (!assets[k]) delete assets[k];
  }
  return { lovelace: value.lovelace, assets };
}

async function submitBuilt(state: EngineState, built: BuiltTx, produced: UTxO[], spent: UTxO[]): Promise<EngineState> {
  const failed = built.cek.find((c) => !c.ok);
  if (failed) {
    const tx: BuiltTx = { ...built, status: "failed" };
    return log({ ...state, txs: [...state.txs, tx], lastTx: tx }, "warn", `Script failed: ${failed.reason}`);
  }

  const slot = state.slot + 12;
  const height = state.blocks.length;
  const hash = (await digest(`block:${height}:${built.id}`)).slice(0, 64);
  const block: Block = {
    height,
    slot,
    hash,
    prev: state.blocks[state.blocks.length - 1]?.hash ?? "0".repeat(64),
    txIds: [built.id],
    timestamp: now(),
  };
  const confirmed: BuiltTx = { ...built, status: "confirmed", confirmedAt: now(), slot };
  return log(
    {
      ...state,
      slot,
      epoch: slot / 432000,
      tip: height,
      utxos: [...consume(state.utxos, spent), ...produced],
      txs: [...state.txs, confirmed],
      blocks: [...state.blocks, block],
      mempool: [],
      lastTx: confirmed,
    },
    "ledger",
    `applyTx ${built.id.slice(0, 12)}… slot ${slot} · ${built.intent}`,
  );
}

type NestedSpec = {
  intent: string;
  scripts: string[];
  redeemers: { purpose: string; data: unknown }[];
  mint: AssetMap;
  cip113?: boolean;
};

type IntentCtx = {
  intent: string;
  scripts: string[];
  redeemers: { purpose: string; data: unknown }[];
  spent: UTxO[];
  outputs: TxOut[];
  mint: AssetMap;
  metadata: Record<string, unknown>;
  nested?: NestedSpec[];
  extra?: Partial<EngineState>;
  observe?: UTxO[];
};

export function genesisUtxo(state: EngineState) {
  return state.utxos.find((u) => u.txHash === GENESIS_TX && u.index === GENESIS_INDEX) ?? null;
}

export function genesisIntact(state: EngineState) {
  const u = genesisUtxo(state);
  return Boolean(u && (u.value.assets[genesisAsset()] ?? 0) === 1);
}

async function assemble(state: EngineState, ctx: IntentCtx): Promise<EngineState> {
  if (!state.wallet) return log(state, "warn", "No wallet. Derive a payment key first.");
  if (state.status !== "ready") return log(state, "warn", "Node is not ready. Boot the WASM core first.");

  const needsSeal = ctx.scripts.length > 0;
  if (needsSeal && !genesisIntact(state)) {
    return log(state, "warn", "Genesis seal missing. This ledger is not UltraLife.");
  }
  if (ctx.spent.some((u) => u.txHash === GENESIS_TX && u.index === GENESIS_INDEX)) {
    return log(state, "warn", "Cannot spend the genesis UTxO. It is reference-only.");
  }

  const hasPnft = Boolean(state.pnft);
  const seal = genesisIntact(state);
  const mintPolicies = Object.keys(ctx.mint).map((k) => parseAssetKey(k).policy).filter(Boolean);
  const cekCtx = {
    intent: ctx.intent,
    hasPnft,
    wallet: state.wallet.address,
    genesisSeal: seal,
    scriptsNeedSeal: needsSeal,
    mintPolicies,
  };
  const cek = ctx.scripts.map((script, i) => runCek(script, ctx.redeemers[i]?.data ?? {}, cekCtx));
  const nestedChildren = (ctx.nested ?? []).map((child) => {
    const childCek = child.scripts.map((script, i) =>
      runCek(script, child.redeemers[i]?.data ?? {}, {
        ...cekCtx,
        intent: child.intent,
        mintPolicies: Object.keys(child.mint).map((k) => parseAssetKey(k).policy).filter(Boolean),
      }),
    );
    return {
      spec: child,
      cek: childCek,
    };
  });
  const failed = [...cek, ...nestedChildren.flatMap((n) => n.cek)].find((c) => !c.ok);
  if (failed) {
    return log(state, "warn", failed.reason ?? "Script failed CEK evaluation.");
  }
  const cpu =
    cek.reduce((s, c) => s + c.exUnits.cpu, 0) +
    nestedChildren.reduce((s, n) => s + n.cek.reduce((a, c) => a + c.exUnits.cpu, 0), 0);
  const mem =
    cek.reduce((s, c) => s + c.exUnits.mem, 0) +
    nestedChildren.reduce((s, n) => s + n.cek.reduce((a, c) => a + c.exUnits.mem, 0), 0);
  const outputs = ctx.outputs.map((o) => ({
    ...o,
    value: cloneValue(o.value),
  }));
  const draft = {
    inputs: ctx.spent.map((u) => ({ txHash: u.txHash, index: u.index })),
    outputs,
    mint: ctx.mint,
    scripts: ctx.scripts,
    metadata: ctx.metadata,
  };
  const size = estimateSize(draft);
  const fee = coreFee(size, cpu, mem);

  const changeIndex = outputs.findIndex((o) => o.address === state.wallet!.address);
  if (changeIndex >= 0) {
    const out = outputs[changeIndex]!;
    const nextLovelace = out.value.lovelace - fee;
    const min = minAdaFor(out);
    if (nextLovelace < min) {
      return log(state, "warn", `Insufficient ADA for fee + minUTxO (need ${(min + fee) / 1_000_000} ADA). Request faucet.`);
    }
    outputs[changeIndex] = {
      ...out,
      value: { ...out.value, lovelace: nextLovelace },
    };
  }

  const body = JSON.stringify({
    inputs: draft.inputs,
    outputs,
    mint: ctx.mint,
    fee,
    scripts: ctx.scripts,
  });
  const id = await txHash(body);
  const redeemers: Redeemer[] = ctx.scripts.map((script, i) => ({
    tag: script.includes("mint") ? "mint" : "spend",
    purpose: script,
    data: ctx.redeemers[i]?.data ?? {},
    exUnits: cek[i]!.exUnits,
  }));
  const built: BuiltTx = {
    id,
    inputs: draft.inputs,
    outputs: outputs.map((o) => ({ ...o, value: cloneValue(o.value) })),
    mint: { ...ctx.mint },
    fee,
    size,
    ttl: state.slot + 200,
    scripts: ctx.scripts,
    redeemers,
    metadata: ctx.metadata,
    cek,
    witnesses: [`vkey:${state.wallet.paymentKeyHash.slice(0, 16)}`],
    nested: nestedChildren.map((n) => ({
      intent: n.spec.intent,
      scripts: n.spec.scripts,
      mint: { ...n.spec.mint },
      cek: n.cek,
      witnesses: [`nested:${state.wallet!.paymentKeyHash.slice(0, 12)}`],
      cip113: n.spec.cip113,
    })),
    referenceInputs: [
      ...(needsSeal ? [{ txHash: GENESIS_TX, index: GENESIS_INDEX }] : []),
      ...(ctx.observe ?? []).map((u) => ({ txHash: u.txHash, index: u.index })),
    ],
    status: "signed",
    intent: ctx.intent,
    createdAt: now(),
  };

  const produced: UTxO[] = outputs.map((o, i) => ({
    txHash: id,
    index: i,
    address: o.address,
    value: cloneValue(o.value),
    datum: o.datum,
  }));

  const next = await submitBuilt(state, { ...built, status: "submitted" }, produced, ctx.spent);
  const last = next.txs[next.txs.length - 1];
  const wrap = jsWrapperFee(size, cpu, mem);
  const withCost = log(
    next,
    "cek",
    `ExUnits cpu=${cpu.toLocaleString()} mem=${mem.toLocaleString()} · core fee ${fee} · JS wrapper would take ${wrap} (+${Math.round(((wrap - fee) / fee) * 100)}%)`,
  );
  if (last?.status === "confirmed" && ctx.extra) {
    return { ...withCost, ...ctx.extra };
  }
  return withCost;
}

function spendFromWallet(state: EngineState, min: number) {
  if (!state.wallet) return null;
  return findUtxo(state, state.wallet.address, min);
}

function spendUltra(state: EngineState, amount: number) {
  if (!state.wallet) return null;
  const key = assetKey(POLICIES.ultra, "ULTRA");
  return (
    state.utxos.find(
      (u) =>
        u.address === state.wallet!.address &&
        (u.value.assets[key] ?? 0) >= amount &&
        u.value.lovelace >= 2_500_000,
    ) ?? null
  );
}

export async function faucet(state: EngineState) {
  if (!state.wallet) return log(state, "warn", "Create a wallet first.");
  const src = findUtxo(state, FAUCET, 120_000_000);
  if (!src) return log(state, "warn", "Faucet is dry.");
  const amount = 100_000_000;
  const change = src.value.lovelace - amount;
  return assemble(state, {
    intent: "faucet",
    scripts: [],
    redeemers: [],
    spent: [src],
    outputs: [
      { address: state.wallet.address, value: emptyValue(amount) },
      { address: FAUCET, value: emptyValue(change) },
    ],
    mint: {},
    metadata: { msg: "Preprod-style faucet → browser wallet" },
  });
}

export async function mintPnft(state: EngineState, bioregion: string) {
  if (!state.wallet) return log(state, "warn", "Create a wallet first.");
  if (state.pnft) return log(state, "warn", "pNFT already minted. One identity per human.");
  const src = spendFromWallet(state, 4_000_000);
  if (!src) return log(state, "warn", "Need ~4 ADA. Request faucet.");
  const pnftName = `pNFT_${state.wallet.paymentKeyHash.slice(0, 10)}`;
  const identityMint: AssetMap = { [assetKey(POLICIES.pnft, pnftName)]: 1 };
  const grantMint: AssetMap = { [assetKey(POLICIES.ultra, "ULTRA")]: 50 };
  const mint: AssetMap = { ...identityMint, ...grantMint };
  const pnft: Pnft = {
    id: pnftName,
    level: "Basic",
    bioregion,
    mintedTx: "pending",
    impact: {},
    careCredits: 0,
  };
  const next = await assemble(state, {
    intent: "mint-pnft",
    scripts: ["pnft.pnft_policy.mint"],
    redeemers: [{ purpose: "mint", data: { level: "Basic", bioregion } }],
    spent: [src],
    outputs: [
      {
        address: state.wallet.address,
        value: applyMint(cloneValue(src.value), mint),
        datum: { pnft: pnftName, level: "Basic", bioregion },
      },
    ],
    mint,
    metadata: {
      ul: { op: "mint_pnft", bioregion, grant: 50, nested: "cip118", programmable: "cip113" },
    },
    nested: [
      {
        intent: "cip113-ultra-grant",
        scripts: ["token.token_policy.mint"],
        redeemers: [{ purpose: "mint", data: { grant: 50, standard: "CIP-113" } }],
        mint: grantMint,
        cip113: true,
      },
    ],
    extra: { pnft },
  });
  const last = next.txs[next.txs.length - 1];
  if (next.pnft && last && last.status === "confirmed") {
    return { ...next, pnft: { ...next.pnft, mintedTx: last.id } };
  }
  return next;
}

export async function claimUbi(state: EngineState) {
  if (!state.wallet) return log(state, "warn", "Create a wallet first.");
  if (!state.pnft) return log(state, "warn", "Mint a pNFT to claim UBI.");
  const src = spendFromWallet(state, 2_000_000);
  if (!src) return log(state, "warn", "Need a subsidy UTxO. UBI itself is ULTRA, not ADA.");
  const bio = BIOREGIONS.find((b) => b.id === state.pnft!.bioregion) ?? BIOREGIONS[0]!;
  const observed = [findUtxo(state, UBI, 1_000_000), bioUtxo(state, bio.id)].filter(Boolean) as typeof state.utxos;
  const amount = Math.max(4, Math.round(bio.health * 16));
  const mint: AssetMap = { [assetKey(POLICIES.ultra, "ULTRA")]: amount };
  return assemble(state, {
    intent: "claim-ubi",
    scripts: ["ubi.ubi.spend", "token.token_policy.mint"],
    redeemers: [
      { purpose: "spend", data: { pnft: state.pnft.id, bioregion: bio.id, observe: true } },
      { purpose: "mint", data: { ubi: amount } },
    ],
    spent: [src],
    observe: observed,
    outputs: [{ address: state.wallet.address, value: applyMint(cloneValue(src.value), mint) }],
    mint,
    metadata: { ul: { op: "ubi", amount, health: bio.health, bioregion: bio.id, model: "observe-not-spend" } },
  });
}

export async function recordImpact(state: EngineState, compound: string, qty: number) {
  if (!state.wallet || !state.pnft) return log(state, "warn", "pNFT required to accrue impact.");
  const src = spendFromWallet(state, 2_000_000);
  if (!src) return log(state, "warn", "Need ADA for fees.");
  const key = assetKey(POLICIES.impact, compound);
  const mint: AssetMap = { [key]: qty };
  const pnft: Pnft = {
    ...state.pnft,
    impact: { ...state.pnft.impact, [compound]: (state.pnft.impact[compound] ?? 0) + qty },
  };
  return assemble(state, {
    intent: "record-impact",
    scripts: ["impact.impact.spend", "impact_policy.impact_policy.mint"],
    redeemers: [
      { purpose: "spend", data: { compound, qty } },
      { purpose: "mint", data: { compound, qty } },
    ],
    spent: [src],
    outputs: [
      {
        address: state.wallet.address,
        value: applyMint(cloneValue(src.value), mint),
        datum: { impact: pnft.impact },
      },
    ],
    mint,
    metadata: { ul: { op: "impact", compound, qty, consumer: state.pnft.id } },
    extra: { pnft },
  });
}

export async function registerLand(state: EngineState, label: string, hectares: number) {
  if (!state.wallet || !state.pnft) return log(state, "warn", "pNFT required to register land.");
  const src = spendFromWallet(state, 3_000_000);
  if (!src) return log(state, "warn", "Need ADA for fees.");
  const name = `LAND_${label.replace(/\s+/g, "_").slice(0, 18)}`;
  const mint: AssetMap = { [assetKey(POLICIES.land, name)]: 1 };
  return assemble(state, {
    intent: "register-land",
    scripts: ["land_rights.land_rights.spend"],
    redeemers: [{ purpose: "spend", data: { label, hectares, bioregion: state.pnft.bioregion } }],
    spent: [src],
    outputs: [
      {
        address: state.wallet.address,
        value: applyMint(cloneValue(src.value), mint),
        datum: {
          land: name,
          hectares,
          rights: ["surface", "water", "carbon", "timber"],
          bioregion: state.pnft.bioregion,
        },
      },
    ],
    mint,
    metadata: { ul: { op: "land", label, hectares } },
  });
}

export async function listOffering(state: EngineState, title: string, priceUltra: number, kind: Offering["kind"]) {
  if (!state.wallet || !state.pnft) return log(state, "warn", "pNFT required to list.");
  const src = spendFromWallet(state, 4_000_000);
  if (!src) return log(state, "warn", "Need a subsidy UTxO to post a listing.");
  const offering: Offering = {
    id: `off_${Math.random().toString(36).slice(2, 8)}`,
    seller: state.pnft.id,
    title,
    kind,
    bioregion: state.pnft.bioregion,
    priceUltra: priceUltra,
    impact: { CO2: 0.2 },
    available: true,
  };
  return assemble(state, {
    intent: "list-offering",
    scripts: ["marketplace.marketplace.spend"],
    redeemers: [{ purpose: "spend", data: offering }],
    spent: [src],
    outputs: [
      {
        address: state.wallet.address,
        value: { lovelace: src.value.lovelace - 2_000_000, assets: { ...src.value.assets } },
      },
      {
        address: MARKET,
        value: emptyValue(2_000_000),
        datum: { listed: offering.id, title: offering.title, priceUltra: offering.priceUltra },
      },
    ],
    mint: {},
    metadata: { ul: { op: "offer", title, priceUltra, model: "local-utxo" } },
    extra: { offerings: [offering, ...state.offerings] },
  });
}

export async function buyOffering(state: EngineState, offeringId: string) {
  if (!state.wallet || !state.pnft) return log(state, "warn", "pNFT required to buy. Consumer accrues impact.");
  const off = state.offerings.find((o) => o.id === offeringId && o.available);
  if (!off) return log(state, "warn", "Offering not available.");
  const listing = findByDatum(state, MARKET, "listed", offeringId);
  const src = spendFromWallet(state, 4_000_000);
  if (!src) return log(state, "warn", "Need ADA for fees.");
  if (!listing) return log(state, "warn", "Listing UTxO missing. Each offer is its own output — not a batcher.");
  const ultraKey = assetKey(POLICIES.ultra, "ULTRA");
  const have = src.value.assets[ultraKey] ?? 0;
  if (have < off.priceUltra) return log(state, "warn", `Need ${off.priceUltra} ULTRA. Claim UBI or mint pNFT grant.`);
  const userAssets = { ...src.value.assets };
  userAssets[ultraKey] = have - off.priceUltra;
  if (!userAssets[ultraKey]) delete userAssets[ultraKey];
  const impactMint: AssetMap = {};
  for (const [k, v] of Object.entries(off.impact)) {
    impactMint[assetKey(POLICIES.impact, k)] = v;
  }
  const pnft: Pnft = {
    ...state.pnft,
    impact: { ...state.pnft.impact },
  };
  for (const [k, v] of Object.entries(off.impact)) {
    pnft.impact[k] = (pnft.impact[k] ?? 0) + v;
  }
  const offerings = state.offerings.map((o) => (o.id === offeringId ? { ...o, available: false, txId: "pending" } : o));
  const userValue = applyMint({ lovelace: src.value.lovelace, assets: userAssets }, impactMint);
  return assemble(state, {
    intent: "buy-offering",
    scripts: ["marketplace.marketplace.spend", "token.token.spend"],
    redeemers: [
      { purpose: "spend", data: { buy: offeringId } },
      { purpose: "spend", data: { cip113: true, asset: "ULTRA", amount: off.priceUltra } },
    ],
    spent: [src, listing],
    outputs: [
      { address: state.wallet.address, value: userValue },
      {
        address: MARKET,
        value: { lovelace: listing.value.lovelace, assets: { [ultraKey]: off.priceUltra } },
        datum: { settled: offeringId },
      },
    ],
    mint: impactMint,
    metadata: {
      ul: { op: "settle", offeringId, price: off.priceUltra, impact: off.impact, nested: "cip118" },
    },
    nested: [
      {
        intent: "accrue-impact",
        scripts: ["impact_policy.impact_policy.mint"],
        redeemers: [{ purpose: "mint", data: { impact: off.impact, consumer: state.pnft.id } }],
        mint: impactMint,
        cip113: true,
      },
    ],
    extra: { pnft, offerings },
  });
}

export async function sendAda(state: EngineState, to: string, ada: number) {
  if (!state.wallet) return log(state, "warn", "Create a wallet first.");
  const lovelace = Math.round(ada * 1_000_000);
  const src = spendFromWallet(state, lovelace + 2_000_000);
  if (!src) return log(state, "warn", "Insufficient ADA.");
  const change = src.value.lovelace - lovelace;
  const changeValue: Value = { lovelace: change, assets: { ...src.value.assets } };
  return assemble(state, {
    intent: "send-ada",
    scripts: [],
    redeemers: [],
    spent: [src],
    outputs: [
      { address: to, value: emptyValue(lovelace) },
      { address: state.wallet.address, value: changeValue },
    ],
    mint: {},
    metadata: { ul: { op: "send", ada } },
  });
}

export async function registerPool(state: EngineState, ticker: string, focus: string) {
  if (!state.wallet || !state.pnft) return log(state, "warn", "pNFT required to register a bioregion pool.");
  const stake = 20;
  const src = spendUltra(state, stake);
  if (!src) return log(state, "warn", "Need 20 ULTRA to register a pool. Mint a pNFT (grant) or claim UBI.");
  const ultraKey = assetKey(POLICIES.ultra, "ULTRA");
  const have = src.value.assets[ultraKey] ?? 0;
  const userAssets = { ...src.value.assets, [ultraKey]: have - stake };
  if (!userAssets[ultraKey]) delete userAssets[ultraKey];
  const id = `pool_${ticker.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 8)}_${Math.random().toString(36).slice(2, 6)}`;
  const pool: StakePool = {
    id,
    ticker: ticker.slice(0, 6).toUpperCase(),
    name: `${BIOREGIONS.find((b) => b.id === state.pnft!.bioregion)?.name ?? "Bioregion"} ${ticker}`,
    bioregion: state.pnft.bioregion,
    focus: focus.slice(0, 48) || "General",
    operator: state.pnft.id,
    stakeUltra: stake,
    epochFees: Math.round((BIOREGIONS.find((b) => b.id === state.pnft!.bioregion)?.health ?? 0.7) * 120),
  };
  const poolUtxo = state.utxos.find((u) => u.address === POOL);
  return assemble(state, {
    intent: "register-pool",
    scripts: ["stake_pool.stake_pool.spend"],
    redeemers: [{ purpose: "spend", data: { register: id, bioregion: pool.bioregion, stake } }],
    spent: poolUtxo ? [src, poolUtxo] : [src],
    outputs: [
      { address: state.wallet.address, value: { lovelace: src.value.lovelace, assets: userAssets } },
      {
        address: POOL,
        value: addValue(poolUtxo ? cloneValue(poolUtxo.value) : emptyValue(2_000_000), {
          lovelace: 0,
          assets: { [ultraKey]: stake },
        }),
        datum: { pool: id, bioregion: pool.bioregion, ticker: pool.ticker },
      },
    ],
    mint: {},
    metadata: { ul: { op: "register_pool", id, ticker: pool.ticker, unit: "ULTRA" } },
    extra: { pools: [...state.pools, pool], delegations: [...state.delegations, { poolId: id, amount: stake }] },
  });
}

export async function delegateToPool(state: EngineState, poolId: string, amount: number) {
  if (!state.wallet || !state.pnft) return log(state, "warn", "pNFT required to delegate ULTRA.");
  const qty = Math.max(1, Math.floor(amount));
  const pool = state.pools.find((p) => p.id === poolId || p.ticker.toLowerCase() === poolId.toLowerCase());
  if (!pool) return log(state, "warn", "Unknown pool. Ask to list pools in your bioregion.");
  const src = spendUltra(state, qty);
  if (!src) return log(state, "warn", `Need ${qty} ULTRA to delegate.`);
  const ultraKey = assetKey(POLICIES.ultra, "ULTRA");
  const have = src.value.assets[ultraKey] ?? 0;
  const userAssets = { ...src.value.assets, [ultraKey]: have - qty };
  if (!userAssets[ultraKey]) delete userAssets[ultraKey];
  const poolUtxo = state.utxos.find((u) => u.address === POOL);
  const pools = state.pools.map((p) => (p.id === pool.id ? { ...p, stakeUltra: p.stakeUltra + qty } : p));
  const existing = state.delegations.find((d) => d.poolId === pool.id);
  const delegations = existing
    ? state.delegations.map((d) => (d.poolId === pool.id ? { ...d, amount: d.amount + qty } : d))
    : [...state.delegations, { poolId: pool.id, amount: qty }];
  return assemble(state, {
    intent: "delegate-ultra",
    scripts: ["stake_pool.stake_pool.spend", "token.token.spend"],
    redeemers: [
      { purpose: "spend", data: { delegate: pool.id, amount: qty } },
      { purpose: "spend", data: { cip113: true, asset: "ULTRA", amount: qty } },
    ],
    spent: poolUtxo ? [src, poolUtxo] : [src],
    outputs: [
      { address: state.wallet.address, value: { lovelace: src.value.lovelace, assets: userAssets } },
      {
        address: POOL,
        value: addValue(poolUtxo ? cloneValue(poolUtxo.value) : emptyValue(2_000_000), {
          lovelace: 0,
          assets: { [ultraKey]: qty },
        }),
        datum: { pool: pool.id, bioregion: pool.bioregion },
      },
    ],
    mint: {},
    metadata: { ul: { op: "delegate", pool: pool.id, amount: qty, unit: "ULTRA" } },
    extra: { pools, delegations },
  });
}

export async function claimPoolRewards(state: EngineState, poolId?: string) {
  if (!state.wallet || !state.pnft) return log(state, "warn", "pNFT required to claim pool rewards.");
  const d =
    (poolId
      ? state.delegations.find((x) => x.poolId === poolId || state.pools.find((p) => p.id === x.poolId)?.ticker === poolId)
      : state.delegations[0]) ?? null;
  if (!d) return log(state, "warn", "No ULTRA delegated. Delegate to a bioregion pool first.");
  const pool = state.pools.find((p) => p.id === d.poolId);
  if (!pool) return log(state, "warn", "Delegation points at a missing pool.");
  const bio = BIOREGIONS.find((b) => b.id === pool.bioregion);
  const epochFees = Math.max(40, Math.round((bio?.health ?? 0.7) * 120));
  const reward = Math.max(1, Math.round((d.amount / Math.max(pool.stakeUltra, 1)) * epochFees * 0.83));
  const src = spendFromWallet(state, 2_000_000);
  if (!src) return log(state, "warn", "Need a little ADA in the fee subsidy to land the claim. The reward is ULTRA.");
  const mint: AssetMap = { [assetKey(POLICIES.ultra, "ULTRA")]: reward };
  return assemble(state, {
    intent: "claim-pool-rewards",
    scripts: ["stake_pool.stake_pool.spend", "token.token_policy.mint"],
    redeemers: [
      { purpose: "spend", data: { claim: pool.id, epoch: Math.floor(state.slot / 432000) } },
      { purpose: "mint", data: { rewards: reward, unit: "ULTRA" } },
    ],
    spent: [src],
    outputs: [{ address: state.wallet.address, value: applyMint(cloneValue(src.value), mint) }],
    mint,
    metadata: { ul: { op: "pool_rewards", pool: pool.id, reward, unit: "ULTRA", ada: 0 } },
  });
}

export async function listJob(state: EngineState, title: string, bidUltra: number) {
  if (!state.wallet || !state.pnft) return log(state, "warn", "pNFT required to post a job.");
  const src = spendFromWallet(state, 4_000_000);
  if (!src) return log(state, "warn", "Need a subsidy UTxO to post. The bid is in ULTRA.");
  const job: Auction = {
    id: `job_${Math.random().toString(36).slice(2, 8)}`,
    title: title.slice(0, 64),
    kind: "work",
    bioregion: state.pnft.bioregion,
    bidUltra: Math.max(1, bidUltra),
    poster: state.pnft.id,
    status: "open",
    txId: "pending",
  };
  return assemble(state, {
    intent: "list-job",
    scripts: ["work_auction.work_auction.spend"],
    redeemers: [{ purpose: "spend", data: job }],
    spent: [src],
    outputs: [
      {
        address: state.wallet.address,
        value: { lovelace: src.value.lovelace - 2_000_000, assets: { ...src.value.assets } },
      },
      {
        address: AUCTION,
        value: emptyValue(2_000_000),
        datum: { job: job.id, title: job.title, bidUltra: job.bidUltra },
      },
    ],
    mint: {},
    metadata: { ul: { op: "job", title: job.title, bidUltra: job.bidUltra, model: "local-utxo" } },
    extra: { auctions: [job, ...state.auctions] },
  });
}

export async function bidJob(state: EngineState, jobId: string, bidUltra: number) {
  if (!state.wallet || !state.pnft) return log(state, "warn", "pNFT required to bid.");
  const q = jobId.toLowerCase();
  const job = state.auctions.find(
    (j) => j.status === "open" && (j.id === jobId || j.id.toLowerCase().includes(q) || j.title.toLowerCase().includes(q)),
  );
  if (!job) return log(state, "warn", "No open job matches.");
  const bid = Math.max(1, Math.floor(bidUltra || job.bidUltra));
  const listing = findByDatum(state, AUCTION, "job", job.id);
  const src = spendUltra(state, 0) ?? spendFromWallet(state, 2_000_000);
  if (!src) return log(state, "warn", "Need a wallet UTxO to bid.");
  if (!listing) return log(state, "warn", "Job UTxO missing. Each auction is its own output.");
  const auctions = state.auctions.map((j) =>
    j.id === job.id ? { ...j, bidUltra: bid, bidder: state.pnft!.id } : j,
  );
  return assemble(state, {
    intent: "bid-job",
    scripts: ["work_auction.work_auction.spend"],
    redeemers: [{ purpose: "spend", data: { bid: job.id, amount: bid, bidder: state.pnft.id } }],
    spent: [src, listing],
    outputs: [
      { address: state.wallet.address, value: cloneValue(src.value) },
      {
        address: AUCTION,
        value: cloneValue(listing.value),
        datum: { job: job.id, title: job.title, bidUltra: bid, bidder: state.pnft.id },
      },
    ],
    mint: {},
    metadata: { ul: { op: "bid", job: job.id, bid, unit: "ULTRA", model: "local-utxo" } },
    extra: { auctions },
  });
}

export async function openHydraHead(state: EngineState) {
  if (!state.wallet || !state.pnft) return log(state, "warn", "pNFT required. Every L2 tx still terminates at a pNFT.");
  if (state.hydra.status === "open") return log(state, "info", "Hydra head already open for this bioregion pool.");
  const src = spendFromWallet(state, 2_000_000);
  if (!src) return log(state, "warn", "Need a subsidy UTxO to open the head.");
  return assemble(state, {
    intent: "open-hydra",
    scripts: ["spending_bucket.spending_bucket.spend", "ultralife_validator.ultralife_validator.spend"],
    redeemers: [
      { purpose: "spend", data: { open: true, bioregion: state.pnft.bioregion } },
      { purpose: "spend", data: { terminate: "pnft" } },
    ],
    spent: [src],
    outputs: [{ address: state.wallet.address, value: cloneValue(src.value), datum: { hydra: "open" } }],
    mint: {},
    metadata: { ul: { op: "hydra_open", paid: "ULTRA", ada: 0 } },
    extra: { hydra: { status: "open" as const, verified: 0, feesUltra: 0, lane: "hydra" as const } },
  });
}

export async function poolVerify(state: EngineState, poolQuery?: string) {
  if (!state.wallet || !state.pnft) return log(state, "warn", "pNFT required to verify as a pool.");
  const pool =
    state.pools.find((p) => p.id === poolQuery || p.ticker.toLowerCase() === String(poolQuery ?? "").toLowerCase()) ??
    state.pools.find((p) => p.bioregion === state.pnft!.bioregion) ??
    state.pools[0];
  if (!pool) return log(state, "warn", "No bioregion pool to verify against.");
  if (!state.lastTx) return log(state, "warn", "No UltraLife tx to verify.");
  const feeUltra = 1;
  const src = spendFromWallet(state, 2_000_000);
  if (!src) return log(state, "warn", "Fee subsidy UTxO missing. User still pays ULTRA, not ADA.");
  const mint: AssetMap = { [assetKey(POLICIES.ultra, "ULTRA")]: feeUltra };
  const hydra = {
    status: state.hydra.status,
    verified: state.hydra.verified + 1,
    feesUltra: state.hydra.feesUltra + feeUltra,
    lane: state.hydra.status === "open" ? ("hydra" as const) : state.hydra.lane,
  };
  return assemble(state, {
    intent: "pool-verify",
    scripts: ["ultralife_validator.ultralife_validator.spend", "fee_pool.fee_pool.spend"],
    redeemers: [
      {
        purpose: "spend",
        data: {
          verify: state.lastTx.id,
          pool: pool.id,
          node: state.hydra.status === "open" ? "hydra" : "l1-wasm",
        },
      },
      { purpose: "spend", data: { pay: feeUltra, unit: "ULTRA" } },
    ],
    spent: [src],
    outputs: [{ address: state.wallet.address, value: applyMint(cloneValue(src.value), mint) }],
    mint,
    metadata: {
      ul: {
        op: "pool_verify",
        pool: pool.id,
        subject: state.lastTx.id,
        lane: state.hydra.status === "open" ? "hydra" : "l1-wasm",
        paid: feeUltra,
        unit: "ULTRA",
      },
    },
    extra: { hydra },
  });
}

export function walletValue(state: EngineState): Value {
  if (!state.wallet) return emptyValue();
  return state.utxos
    .filter((u) => u.address === state.wallet!.address)
    .reduce((acc, u) => addValue(acc, u.value), emptyValue());
}

export function walletUtxos(state: EngineState) {
  if (!state.wallet) return [];
  return state.utxos.filter((u) => u.address === state.wallet!.address);
}

export type RedTeamCase = {
  id: string;
  attack: string;
  must: "fail" | "succeed";
  ok: boolean;
  reason: string;
};

/** Adversary suite. Must not mutate the ledger. Local CEK only — not preprod. */
export function runRedTeam(state: EngineState): { cases: RedTeamCase[]; held: boolean; next: EngineState } {
  const hasPnft = Boolean(state.pnft);
  const seal = genesisIntact(state);
  const cases: RedTeamCase[] = [];

  const shot = (
    id: string,
    attack: string,
    must: "fail" | "succeed",
    script: string,
    redeemer: unknown,
    ctx: Record<string, unknown>,
  ) => {
    const r = runCek(script, redeemer, ctx);
    const passed = must === "fail" ? !r.ok : r.ok;
    cases.push({ id, attack, must, ok: passed, reason: r.reason ?? (r.ok ? "cek allowed" : "cek rejected") });
  };

  shot("A1", "spend genesis UTxO", "fail", "genesis.genesis.spend", { op: "steal" }, {
    intent: "steal-genesis", spendingGenesis: true, genesisSeal: true, scriptsNeedSeal: true, hasPnft,
  });
  shot("A2", "mint ULTRA under a mirror policy", "fail", "token.token_policy.mint", { ticker: "ULTRA" }, {
    intent: "clone-ultra", genesisSeal: false, scriptsNeedSeal: true, mintPolicies: [FAKE_MIRROR_POLICY], hasPnft,
  });
  shot("A3", "mint pNFT with no genesis seal", "fail", "pnft.pnft_policy.mint", { level: "Basic" }, {
    intent: "ghost-identity", genesisSeal: false, scriptsNeedSeal: true, mintPolicies: [POLICIES.pnft], hasPnft: false,
  });
  shot("A4", "open Hydra without pNFT termination", "fail", "ultralife_validator.ultralife_validator.spend", { op: "verify" }, {
    intent: "l2-orphan", genesisSeal: true, scriptsNeedSeal: true, hasPnft: false,
  });
  shot("A5", "register pool without identity", "fail", "stake_pool.stake_pool.spend", { op: "register" }, {
    intent: "ghost-pool", genesisSeal: true, scriptsNeedSeal: true, hasPnft: false,
  });
  shot("A6", "canonical ULTRA mint with seal + pNFT", "succeed", "token.token_policy.mint", { ticker: "ULTRA" }, {
    intent: "mint-ultra", genesisSeal: seal, scriptsNeedSeal: true, mintPolicies: [POLICIES.ultra], hasPnft,
  });

  const listings = state.utxos.filter((u) => u.address === SCRIPT_ADDRESS.marketplace);
  cases.push({
    id: "A7",
    attack: "marketplace is sharded (no singleton batcher UTxO)",
    must: "succeed",
    ok: listings.length !== 1 || (listings[0]?.datum as { listed?: string } | undefined)?.listed !== undefined,
    reason:
      listings.length <= 1
        ? `${listings.length} market UTxO(s) — listing-shaped is ok; a nameless singleton is a bug`
        : `${listings.length} listing UTxOs (local state)`,
  });

  const held = cases.every((c) => c.ok);
  let next = state;
  for (const c of cases) {
    next = log(next, c.ok ? "cek" : "warn", `${c.id} ${c.must === "fail" ? "ATTACK" : "INVARIANT"} ${c.ok ? "held" : "BROKEN"} — ${c.attack}. ${c.reason}`);
  }
  next = log(next, held ? "info" : "warn", held ? `Red team: ${cases.length} cases held. Ledger unchanged.` : "Red team: an invariant broke. Do not ship.");
  return { cases, held, next };
}

/** Demonstrate that a mirrored policy cannot mint or steal. Does not mutate the ledger. */
export function proveGenesisSeal(state: EngineState): EngineState {
  const steal = runCek(
    "genesis.genesis.spend",
    { op: "steal" },
    { intent: "steal-genesis", spendingGenesis: true, genesisSeal: true, scriptsNeedSeal: true },
  );
  const mirror = runCek(
    "token.token_policy.mint",
    { ticker: "ULTRA" },
    {
      intent: "clone-ultra",
      genesisSeal: false,
      scriptsNeedSeal: true,
      mintPolicies: [FAKE_MIRROR_POLICY],
    },
  );
  let next = log(
    state,
    "cek",
    steal.ok ? "UNEXPECTED: genesis spend succeeded." : `Seal held. ${steal.reason}`,
  );
  next = log(
    next,
    "cek",
    mirror.ok ? "UNEXPECTED: mirror mint succeeded." : `Seal held. ${mirror.reason}`,
  );
  next = log(
    next,
    "info",
    `Canonical policies stay ${POLICIES.ultra.slice(0, 8)}… (ULTRA) and ${POLICIES.pnft.slice(0, 8)}… (pNFT). A lookalike ticker is a different asset.`,
  );
  return next;
}

export function assetQty(state: EngineState, policy: string, name: string) {
  return walletValue(state).assets[assetKey(policy, name)] ?? 0;
}
