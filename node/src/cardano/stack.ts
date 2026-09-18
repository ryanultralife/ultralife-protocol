export type StackStatus = "applied" | "wired" | "watch";

export type StackItem = {
  id: string;
  name: string;
  source: string;
  url: string;
  status: StackStatus;
  why: string;
  apply: string;
};

/** Cardano work that maps onto the public UltraLife ecosystem. */
export const CARDANO_STACK: StackItem[] = [
  {
    id: "local-state",
    name: "Local state, not batchers",
    source: "eUTxO as FP · Spicy Card Anon / FuelVM critique",
    url: "https://developers.cardano.org/docs/developers/curriculum/fundamentals/core-concepts/eutxo/",
    status: "applied",
    why: "A UTxO is spent once. Recreate it — don't mutate. Cardano DEX batchers shove a global book into one output and kill the parallelism the model was for. Fuel's answer was relaxing determinism so Uniswap can run. UltraLife does not need Uniswap.",
    apply: "Each pNFT, listing, job, and pool is its own UTxO. Genesis and bioregion oracles are reference-only. UBI observes the distributor; it does not spend it. Hydra is the high-frequency lane so 'every change is a tx' does not grind L1. Strict determinism stays: the WASM CEK proves the tx before submit.",
  },
  {
    id: "ghc-wasm",
    name: "Haskell node in WASM",
    source: "Seungheon Oh · IntersectMBO/cardano-api",
    url: "https://github.com/IntersectMBO/cardano-api",
    status: "applied",
    why: "Authentic cardano-api + Plutus CEK in the tab. No Lucid/Mesh cost-model drift.",
    apply: "Boot compiles a wasm32-wasi surface. Fees and ExUnits come from the CEK, not a JS wrapper.",
  },
  {
    id: "cardano-addresses",
    name: "cardano-addresses WASM",
    source: "IntersectMBO/cardano-addresses",
    url: "https://github.com/IntersectMBO/cardano-addresses",
    status: "applied",
    why: "Byte-identical CIP-1852 derivation and address inspect. No reimplemented crypto.",
    apply: "Wallet create uses the same derivation shape (enterprise test address, 12-word seed).",
  },
  {
    id: "cip118",
    name: "Nested transactions",
    source: "CIP-118 · Dijkstra Phase 1",
    url: "https://cips.cardano.org/cip/CIP-0118",
    status: "applied",
    why: "One human action hits several validators (pNFT mint + ULTRA grant, buy + impact).",
    apply: "pNFT mint is a parent tx with a nested CIP-113 ULTRA grant child, independent witnesses.",
  },
  {
    id: "cip113",
    name: "Programmable tokens",
    source: "CIP-113 · cardano-foundation/cip113-programmable-tokens",
    url: "https://github.com/cardano-foundation/cip113-programmable-tokens",
    status: "applied",
    why: "ULTRA, pNFT, and impact assets need transfer/mint rules, not naked native tokens.",
    apply: "ULTRA mint/transfer runs token.token_policy / token.token.spend as programmable logic.",
  },
  {
    id: "gerolamo",
    name: "Gerolamo browser node",
    source: "HLabs · first node in the browser",
    url: "https://gov.tools/governance_actions/4705a3e4e2b3837c370774c357e31fb30aa02279ff8d34a770d855f905e502dc",
    status: "applied",
    why: "Gerolamo produced a Preview block with a smart-contract tx (2026-09-14). That is the other node: TS/WASM, pool-operable.",
    apply: "Pool verify in this tab is the same eUTxO check. Gerolamo is the SPO/browser node; Hydra is the L2 lane; both pay ULTRA.",
  },
  {
    id: "amaru",
    name: "Amaru Rust node",
    source: "PRAGMA · github.com/pragma-org/amaru",
    url: "https://github.com/pragma-org/amaru",
    status: "watch",
    why: "Client diversity. UltraLife docs already track Amaru (RUST_NODE_READINESS).",
    apply: "Watch for WASM build. Until then Haskell-WASM is the browser core; Amaru is the SPO core.",
  },
  {
    id: "hydra",
    name: "Hydra 2.4.1",
    source: "cardano-scaling/hydra",
    url: "https://github.com/cardano-scaling/hydra",
    status: "applied",
    why: "High-frequency UltraLife txs. Head still terminates at a pNFT. 2.4.1 always re-validates snapshots.",
    apply: "open_hydra + pool_verify. Fee_pool pays the verifying pool in ULTRA, not ADA.",
  },
  {
    id: "leios",
    name: "Linear Leios + Dijkstra",
    source: "CIP-164 · MusashiNet",
    url: "https://leios.cardano-scaling.org/",
    status: "watch",
    why: "Invisible interface at population scale needs throughput without new trust assumptions.",
    apply: "Node params stay Praos-shaped. Nested txs ride Dijkstra; Leios is consensus, not UltraLife logic.",
  },
  {
    id: "dolos",
    name: "Dolos data node",
    source: "TxPipe · github.com/txpipe/dolos",
    url: "https://github.com/txpipe/dolos",
    status: "wired",
    why: "MCP indexer today talks to Blockfrost. Dolos is a self-hosted Mini-Blockfrost drop-in.",
    apply: "Indexer surface is address/UTxO/script queries. Swap provider without changing protocol tools.",
  },
  {
    id: "cip112",
    name: "Guard / observe scripts",
    source: "CIP-112 · Dijkstra / PlutusV4",
    url: "https://cips.cardano.org/cip/CIP-0112",
    status: "watch",
    why: "Impact and land rights want to observe a spend without being the spending script.",
    apply: "Not on Conway. Protocol already has oracle_impact / oracle_bioregion as the Conway stand-in.",
  },
  {
    id: "plutusv4",
    name: "Plutus V4",
    source: "Dijkstra upgrade overview",
    url: "https://cardanoupgrades.docs.intersectmbo.org/dijkstra-era-upgrade/dijkstra-upgrade-overview",
    status: "watch",
    why: "Richer ScriptContext for nested txs and programmable tokens.",
    apply: "Aiken validators stay V3 until DijkstraNet. CEK here models V3 costing.",
  },
  {
    id: "midnight",
    name: "Midnight in-browser proving",
    source: "midnight.network",
    url: "https://midnight.network/",
    status: "watch",
    why: "Waveform hashes should stay off Cardano L1. Midnight is the privacy lane, not the ledger.",
    apply: "pNFT stays on Cardano. Biometric templates never leave the device. Midnight is a later overlay.",
  },
];

export function stackCounts() {
  return {
    applied: CARDANO_STACK.filter((s) => s.status === "applied").length,
    wired: CARDANO_STACK.filter((s) => s.status === "wired").length,
    watch: CARDANO_STACK.filter((s) => s.status === "watch").length,
  };
}
