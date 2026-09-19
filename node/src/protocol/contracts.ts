/** Each agent tool is a facade over named Aiken validators. No other scripts may fire. */
export type ToolContract = {
  name: string;
  intent: string;
  scripts: readonly string[];
  nested: readonly string[];
  requires: readonly ("ready" | "wallet" | "pnft")[];
  cip113?: boolean;
  cip118?: boolean;
};

export const TOOL_CONTRACTS: Record<string, ToolContract> = {
  inspect_state: {
    name: "inspect_state",
    intent: "read",
    scripts: [],
    nested: [],
    requires: [],
  },
  inspect_validators: {
    name: "inspect_validators",
    intent: "read",
    scripts: [],
    nested: [],
    requires: [],
  },
  inspect_genesis: {
    name: "inspect_genesis",
    intent: "read",
    scripts: [],
    nested: [],
    requires: [],
  },
  resolve_did: {
    name: "resolve_did",
    intent: "read",
    scripts: [],
    nested: [],
    requires: [],
  },
  inspect_preprod: {
    name: "inspect_preprod",
    intent: "read",
    scripts: [],
    nested: [],
    requires: [],
  },
  red_team: {
    name: "red_team",
    intent: "read",
    scripts: [],
    nested: [],
    requires: [],
  },
  prove_seal: {
    name: "prove_seal",
    intent: "read",
    scripts: [],
    nested: [],
    requires: [],
  },
  boot_node: {
    name: "boot_node",
    intent: "boot",
    scripts: [],
    nested: [],
    requires: [],
  },
  create_wallet: {
    name: "create_wallet",
    intent: "wallet",
    scripts: [],
    nested: [],
    requires: ["ready"],
  },
  request_faucet: {
    name: "request_faucet",
    intent: "faucet",
    scripts: [],
    nested: [],
    requires: ["ready", "wallet"],
  },
  mint_pnft: {
    name: "mint_pnft",
    intent: "mint-pnft",
    scripts: ["pnft.pnft_policy.mint"],
    nested: ["token.token_policy.mint"],
    requires: ["ready", "wallet"],
    cip113: true,
    cip118: true,
  },
  claim_ubi: {
    name: "claim_ubi",
    intent: "claim-ubi",
    scripts: ["ubi.ubi.spend", "token.token_policy.mint"],
    nested: [],
    requires: ["ready", "wallet", "pnft"],
    cip113: true,
  },
  record_impact: {
    name: "record_impact",
    intent: "record-impact",
    scripts: ["impact.impact.spend", "impact_policy.impact_policy.mint"],
    nested: [],
    requires: ["ready", "wallet", "pnft"],
  },
  presale_isotope: {
    name: "presale_isotope",
    intent: "presale-isotope",
    scripts: ["isotope.isotope.spend", "isotope.isotope_policy.mint"],
    nested: [],
    requires: ["ready", "wallet", "pnft"],
  },
  convert_isotope: {
    name: "convert_isotope",
    intent: "convert-isotope",
    scripts: ["isotope.isotope.spend", "isotope.isotope_policy.mint"],
    nested: [],
    requires: ["ready", "wallet", "pnft"],
  },
  transfer_isotope: {
    name: "transfer_isotope",
    intent: "transfer-isotope",
    scripts: ["isotope.isotope.spend"],
    nested: [],
    requires: ["ready", "wallet", "pnft"],
  },
  administer_dose: {
    name: "administer_dose",
    intent: "administer-dose",
    scripts: ["isotope.isotope.spend"],
    nested: [],
    requires: ["ready", "wallet", "pnft"],
  },
  inspect_isotopes: {
    name: "inspect_isotopes",
    intent: "read",
    scripts: [],
    nested: [],
    requires: [],
  },
  register_land: {
    name: "register_land",
    intent: "register-land",
    scripts: ["land_rights.land_rights.spend"],
    nested: [],
    requires: ["ready", "wallet", "pnft"],
  },
  list_offering: {
    name: "list_offering",
    intent: "list-offering",
    scripts: ["marketplace.marketplace.spend"],
    nested: [],
    requires: ["ready", "wallet", "pnft"],
  },
  buy_offering: {
    name: "buy_offering",
    intent: "buy-offering",
    scripts: ["marketplace.marketplace.spend", "token.token.spend"],
    nested: ["impact_policy.impact_policy.mint"],
    requires: ["ready", "wallet", "pnft"],
    cip113: true,
    cip118: true,
  },
  send_ada: {
    name: "send_ada",
    intent: "send-ada",
    scripts: [],
    nested: [],
    requires: ["ready", "wallet"],
  },
  list_job: {
    name: "list_job",
    intent: "list-job",
    scripts: ["work_auction.work_auction.spend"],
    nested: [],
    requires: ["ready", "wallet", "pnft"],
  },
  bid_job: {
    name: "bid_job",
    intent: "bid-job",
    scripts: ["work_auction.work_auction.spend"],
    nested: [],
    requires: ["ready", "wallet", "pnft"],
  },
  inspect_pools: {
    name: "inspect_pools",
    intent: "read",
    scripts: [],
    nested: [],
    requires: [],
  },
  register_pool: {
    name: "register_pool",
    intent: "register-pool",
    scripts: ["stake_pool.stake_pool.spend"],
    nested: [],
    requires: ["ready", "wallet", "pnft"],
  },
  delegate_ultra: {
    name: "delegate_ultra",
    intent: "delegate-ultra",
    scripts: ["stake_pool.stake_pool.spend", "token.token.spend"],
    nested: [],
    requires: ["ready", "wallet", "pnft"],
    cip113: true,
  },
  claim_pool_rewards: {
    name: "claim_pool_rewards",
    intent: "claim-pool-rewards",
    scripts: ["stake_pool.stake_pool.spend", "token.token_policy.mint"],
    nested: [],
    requires: ["ready", "wallet", "pnft"],
    cip113: true,
  },
  open_hydra: {
    name: "open_hydra",
    intent: "open-hydra",
    scripts: ["spending_bucket.spending_bucket.spend", "ultralife_validator.ultralife_validator.spend"],
    nested: [],
    requires: ["ready", "wallet", "pnft"],
  },
  pool_verify: {
    name: "pool_verify",
    intent: "pool-verify",
    scripts: ["ultralife_validator.ultralife_validator.spend", "fee_pool.fee_pool.spend"],
    nested: [],
    requires: ["ready", "wallet", "pnft"],
  },
};

export function allowedScripts(name: string): string[] {
  const c = TOOL_CONTRACTS[name];
  if (!c) return [];
  return [...c.scripts, ...c.nested];
}

export function contractFor(name: string) {
  return TOOL_CONTRACTS[name];
}

/** Reject a tx that invoked a script the tool did not declare. */
export function assertContract(name: string, fired: string[]): { ok: true } | { ok: false; reason: string } {
  const allowed = new Set(allowedScripts(name));
  if (allowed.size === 0 && fired.length === 0) return { ok: true };
  const extra = fired.filter((s) => !allowed.has(s));
  if (extra.length) {
    return { ok: false, reason: `Script ${extra[0]} is not in the ${name} contract.` };
  }
  const missing = [...allowed].filter((s) => !fired.includes(s));
  if (missing.length && fired.length > 0) {
    return { ok: false, reason: `Contract ${name} required ${missing[0]} and it did not fire.` };
  }
  return { ok: true };
}
