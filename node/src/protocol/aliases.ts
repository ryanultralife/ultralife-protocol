/**
 * Dual-stack unification.
 * `service/` MCP (Lucid / Blockfrost, unsigned CBOR) and this node (WASM CEK demo)
 * expose one name surface. Incoming MCP names resolve here.
 */
export const TOOL_ALIASES: Record<string, string> = {
  build_mint_pnft: "mint_pnft",
  build_create_offering: "list_offering",
  build_accept_offering: "buy_offering",
  list_offerings: "inspect_state",
  get_offering: "inspect_state",
  list_needs: "inspect_state",
  get_need: "inspect_state",
  post_job: "list_job",
  bid: "bid_job",
  list_bioregions: "inspect_state",
  get_bioregion: "inspect_state",
  get_ultralife_info: "inspect_validators",
  get_protocol_stats: "inspect_state",
  get_pnft: "resolve_did",
  list_pnfts: "inspect_state",
  get_token_balance: "inspect_state",
  build_transfer_tokens: "send_ada",
};

export function canonicalTool(name: string) {
  return TOOL_ALIASES[name] ?? name;
}

export function rewriteArgs(name: string, args: Record<string, unknown>) {
  const next = { ...args };
  if (name === "post_job" || name === "list_job") {
    if (next.description && !next.title) next.title = next.description;
    if (next.budget_max && !next.bidUltra) next.bidUltra = next.budget_max;
  }
  if (name === "bid") {
    if (next.job_id && !next.query) next.query = next.job_id;
    if (next.amount && !next.bidUltra) next.bidUltra = next.amount;
  }
  if (name === "build_create_offering") {
    if (next.description && !next.title) next.title = next.description;
    if (next.price && !next.priceUltra) next.priceUltra = next.price;
  }
  if (name === "build_mint_pnft" && next.bioregion_id && !next.bioregion) {
    next.bioregion = next.bioregion_id;
  }
  return next;
}
