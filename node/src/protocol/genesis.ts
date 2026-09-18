import { VALIDATOR_CATALOG } from "./data";
import { POLICIES, assetKey } from "../cardano/types";

/** Unique out-ref created once. A copy of the bytecode cannot recreate this pointer. */
export const GENESIS_TX = "genesis00000000000000000000000000000000000000000000000000000000";
export const GENESIS_INDEX = 9;
export const GENESIS_ADDRESS = "addr_test1q_ul_genesis_seal";
export const GENESIS_NFT = "ULTRALIFE.GENESIS";

export function genesisOutRef() {
  return `${GENESIS_TX}#${GENESIS_INDEX}`;
}

export function genesisAsset() {
  return assetKey(POLICIES.genesis, GENESIS_NFT);
}

/** FNV-1a of the validator set — frozen into the genesis datum. */
export function genesisScriptRoot() {
  const payload = VALIDATOR_CATALOG.map((v) => v.name).join("|");
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) h = Math.imul(h ^ payload.charCodeAt(i), 16777619) >>> 0;
  let g = 0x811c9dc5;
  for (let i = payload.length - 1; i >= 0; i--) g = Math.imul(g ^ payload.charCodeAt(i), 16777619) >>> 0;
  return `${h.toString(16).padStart(8, "0")}${g.toString(16).padStart(8, "0")}${payload.length.toString(16).padStart(4, "0")}${"ultralife".length.toString(16).padStart(4, "0")}${VALIDATOR_CATALOG.length.toString(16).padStart(4, "0")}${"0".repeat(36)}`.slice(0, 64);
}

export function genesisDatum() {
  return {
    sealed: true,
    upgrade: "none",
    outRef: genesisOutRef(),
    scriptRoot: genesisScriptRoot(),
    validators: VALIDATOR_CATALOG.length,
    policies: { ...POLICIES },
    note: "Reference-only. Parameter of every UltraLife validator. Mirrors are different hashes.",
  };
}

export const FAKE_MIRROR_POLICY = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffff";
