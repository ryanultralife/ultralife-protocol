export type AssetMap = Record<string, number>;

export type Value = {
  lovelace: number;
  assets: AssetMap;
};

export type UTxO = {
  txHash: string;
  index: number;
  address: string;
  value: Value;
  datum?: unknown;
  scriptHash?: string;
};

export type TxIn = { txHash: string; index: number };

export type TxOut = {
  address: string;
  value: Value;
  datum?: unknown;
};

export type ExUnits = { mem: number; cpu: number };

export type Redeemer = {
  tag: "spend" | "mint" | "withdraw";
  purpose: string;
  data: unknown;
  exUnits: ExUnits;
};

export type CekStep = {
  op: string;
  note: string;
  cpu: number;
  mem: number;
};

export type CekResult = {
  ok: boolean;
  reason?: string;
  exUnits: ExUnits;
  steps: CekStep[];
  script: string;
};

export type NestedChild = {
  intent: string;
  scripts: string[];
  mint: AssetMap;
  cek: CekResult[];
  witnesses: string[];
  cip113?: boolean;
};

export type BuiltTx = {
  id: string;
  inputs: TxIn[];
  outputs: TxOut[];
  mint: AssetMap;
  fee: number;
  size: number;
  ttl: number;
  scripts: string[];
  redeemers: Redeemer[];
  metadata?: Record<string, unknown>;
  cek: CekResult[];
  witnesses: string[];
  nested: NestedChild[];
  referenceInputs: TxIn[];
  status: "building" | "costed" | "signed" | "submitted" | "confirmed" | "failed";
  intent: string;
  createdAt: number;
  confirmedAt?: number;
  slot?: number;
};

export type Block = {
  height: number;
  slot: number;
  hash: string;
  prev: string;
  txIds: string[];
  timestamp: number;
};

export type Wallet = {
  address: string;
  paymentKeyHash: string;
  seed: string;
  createdAt: number;
};

export type Pnft = {
  id: string;
  level: "Basic" | "Standard" | "DNA";
  bioregion: string;
  mintedTx: string;
  impact: Record<string, number>;
  careCredits: number;
};

export type Offering = {
  id: string;
  seller: string;
  title: string;
  kind: "goods" | "service" | "care" | "knowledge" | "land";
  bioregion: string;
  priceUltra: number;
  impact: Record<string, number>;
  available: boolean;
  txId?: string;
};

export type LandParcel = {
  id: string;
  owner: string;
  bioregion: string;
  label: string;
  hectares: number;
  rights: string[];
  txId: string;
};

export type StakePool = {
  id: string;
  ticker: string;
  name: string;
  bioregion: string;
  focus: string;
  operator: string;
  stakeUltra: number;
  epochFees: number;
};

export type Delegation = {
  poolId: string;
  amount: number;
};

export type Auction = {
  id: string;
  title: string;
  kind: "work" | "goods";
  bioregion: string;
  bidUltra: number;
  bidder?: string;
  poster: string;
  status: "open" | "awarded";
  txId: string;
};

export type HydraHead = {
  status: "closed" | "open";
  verified: number;
  feesUltra: number;
  lane: "l1-wasm" | "hydra" | "gerolamo";
};

export type ProtocolLog = {
  t: number;
  level: "info" | "wasm" | "cek" | "ledger" | "warn";
  msg: string;
};

export type NodeStatus = "cold" | "compiling" | "rts" | "scripts" | "sync" | "ready" | "error";

export const PROTOCOL_PARAMS = {
  minFeeA: 44,
  minFeeB: 155381,
  coinsPerUTxOByte: 4310,
  priceMem: 0.0577,
  priceCpu: 0.0000721,
  maxTxSize: 16384,
  maxTxExMem: 14_000_000,
  maxTxExCpu: 10_000_000_000,
} as const;

export const POLICIES = {
  pnft: "7c9f5578c7d5815c89af5d4f4635b2aa390e3ed06facdb3ecf9971fc",
  ultra: "b3e91c04a8d1f6c27e5a90d4b8c1f0e6a7d93214c8b0e1a5f7c3d9e2",
  impact: "c41a88e0b27d93f15e6c04a9d8b2f1e7c5a03d16b9e8f2a4c7d0e3b1",
  land: "d52b99f1c38e04a26f7d15b0e9c3a2f8d6b14e27c0f9a3b5d8e1f4c2",
  bioregion: "e63ca0d2e49f15b37a8e26c1f0d4b3a9e7c25f38d1a0b4c6e9f2a5d3",
  genesis: "0a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0fedcba9",
  isotope: "f74db1e3f50a26c48b9f37d2e1c5a4b0f8d26e39c2b1a5d7f0e3b6c4",
} as const;

export function assetKey(policy: string, name: string) {
  return `${policy}.${name}`;
}

export function parseAssetKey(key: string) {
  const i = key.indexOf(".");
  if (i < 0) return { policy: "", name: key };
  return { policy: key.slice(0, i), name: key.slice(i + 1) };
}

export function emptyValue(lovelace = 0): Value {
  return { lovelace, assets: {} };
}

export function addValue(a: Value, b: Value): Value {
  const assets: AssetMap = { ...a.assets };
  for (const [k, v] of Object.entries(b.assets)) {
    assets[k] = (assets[k] ?? 0) + v;
    if (assets[k] === 0) delete assets[k];
  }
  return { lovelace: a.lovelace + b.lovelace, assets };
}

export function subValue(a: Value, b: Value): Value {
  const assets: AssetMap = { ...a.assets };
  for (const [k, v] of Object.entries(b.assets)) {
    assets[k] = (assets[k] ?? 0) - v;
    if (assets[k] === 0) delete assets[k];
  }
  return { lovelace: a.lovelace - b.lovelace, assets };
}

export function valueHas(v: Value, policy: string, name: string, qty = 1) {
  return (v.assets[assetKey(policy, name)] ?? 0) >= qty;
}

export function minAdaFor(output: TxOut) {
  const assetCount = Object.keys(output.value.assets).length;
  const bytes = 160 + assetCount * 32 + (output.datum ? 64 : 0);
  return PROTOCOL_PARAMS.coinsPerUTxOByte * bytes;
}
