import { BIOREGIONS } from "./data";
import { resolveBioregion, type AgentSnapshot, type ToolCall } from "./tools";

function has(text: string, ...keys: string[]) {
  const t = text.toLowerCase();
  return keys.every((k) => t.includes(k));
}

function any(text: string, keys: string[]) {
  const t = text.toLowerCase();
  return keys.some((k) => t.includes(k));
}

/** Deterministic multi-step plan when the LLM is unavailable. Same tools the agent uses. */
export function planTools(text: string, snap: AgentSnapshot): ToolCall[] {
  const calls: ToolCall[] = [];
  const t = text.toLowerCase();

  const wantsSetup = any(t, ["set me up", "live here", "live in", "onboard", "join", "who i am", "identity"]);
  const wantsMint = wantsSetup || any(t, ["pnft", "mint me", "mint a"]);
  const wantsUbi = any(t, ["ubi", "universal basic", "claim"]);
  const wantsFaucet = any(t, ["faucet", "fund me", "test ada", "give me ada"]);
  const wantsImpact =
    any(t, ["impact", "co2", "carbon", "ch4"]) ||
    ((t.includes("h2o") || t.includes("water")) && !any(t, ["watershed", "job", "bid", "pool"]));
  const wantsLand = any(t, ["land", "parcel", "hectares", "hectare"]);
  const wantsList = any(t, ["sell", "list", "offer"]) && !t.includes("buy");
  const wantsBuy = any(t, ["buy", "eggs", "purchase", "settle"]);
  const wantsSend = has(t, "send") || t.includes("ada to");
  const wantsInspect =
    any(t, ["status", "balance", "what can", "where am i", "inspect", "state"]) &&
    !wantsMint &&
    !wantsUbi &&
    !wantsBuy;
  const wantsSeal = any(t, ["genesis", "seal", "mirror", "clone", "co-opt", "steal", "fake ultra"]);
  const wantsPools = any(t, ["pool", "delegate", "stake", "snev", "spo"]);
  const wantsJob = any(t, ["job", "bid", "auction", "hire", "carpenter", "watershed", "need a"]);
  const wantsHydra = any(t, ["hydra", "l2", "layer 2"]);
  const wantsVerify = any(t, ["verify", "gerolamo"]);

  if (wantsInspect) calls.push({ name: "inspect_state", args: {} });
  if (any(t, ["did", "who am i", "my identity"])) calls.push({ name: "resolve_did", args: {} });
  if (any(t, ["preprod", "on chain", "cardanoscan", "is it live"])) calls.push({ name: "inspect_preprod", args: {} });
  if (wantsSeal) {
    calls.push({ name: "inspect_genesis", args: {} });
    calls.push({ name: "prove_seal", args: {} });
  }
  if (wantsPools && any(t, ["list", "show", "what", "credit"])) {
    calls.push({ name: "inspect_pools", args: {} });
  }
  if (any(t, ["register"]) && wantsPools) {
    calls.push({ name: "register_pool", args: { ticker: "SNEV-X", focus: "General" } });
  }
  if (any(t, ["delegate"])) {
    const amt = Number(t.match(/(\d+)/)?.[1] ?? 10);
    const ticker = /snev-w/.test(t) ? "SNEV-W" : /casc/.test(t) ? "CASC" : "SNEV";
    calls.push({ name: "delegate_ultra", args: { pool: ticker, amount: amt } });
  }
  if (any(t, ["claim"]) && wantsPools) {
    calls.push({ name: "claim_pool_rewards", args: {} });
  }
  if (wantsJob && any(t, ["list", "post", "need", "hire"])) {
    calls.push({ name: "list_job", args: { title: "Local work", bidUltra: 40 } });
  }
  if (any(t, ["bid"])) {
    const q = t.includes("watershed") ? "watershed" : t.includes("timber") || t.includes("carpenter") ? "timber" : "";
    calls.push({ name: "bid_job", args: { query: q, bidUltra: Number(t.match(/(\d+)/)?.[1] ?? 80) } });
  }
  if (wantsHydra) calls.push({ name: "open_hydra", args: {} });
  if (wantsVerify) calls.push({ name: "pool_verify", args: {} });

  if (wantsMint) {
    const named = BIOREGIONS.find((b) => t.includes(b.name.toLowerCase().split(" ")[0]!));
    const bio = named ?? resolveBioregion(snap.bioregion ?? "sierra-nevada");
    calls.push({ name: "mint_pnft", args: { bioregion: bio.id } });
  }

  if (wantsFaucet) calls.push({ name: "request_faucet", args: {} });

  if (wantsUbi) calls.push({ name: "claim_ubi", args: {} });

  if (wantsImpact) {
    const compound = t.includes("h2o") || t.includes("water") ? "H2O" : t.includes("ch4") ? "CH4" : "CO2";
    const qty = Number(t.match(/(-?\d+(\.\d+)?)/)?.[1] ?? 1);
    calls.push({ name: "record_impact", args: { compound, qty } });
  }

  if (wantsLand) {
    const ha = Number(t.match(/(\d+(\.\d+)?)\s*ha/)?.[1] ?? t.match(/(\d+(\.\d+)?)/)?.[1] ?? 4);
    const label =
      text.replace(/register|land|parcel|hectares?|ha|of/gi, "").trim().slice(0, 32) || "Home parcel";
    calls.push({ name: "register_land", args: { label, hectares: ha } });
  }

  if (wantsList) {
    const price = Number(t.match(/(\d+)/)?.[1] ?? 12);
    const title = text.replace(/sell|list|offer|for|\d+|ultra|tokens?/gi, "").trim() || "Local offering";
    calls.push({ name: "list_offering", args: { title: title.slice(0, 48), priceUltra: price, kind: "goods" } });
  }

  if (wantsBuy) {
    const query = t.includes("egg") ? "egg" : t.includes("firewood") ? "firewood" : t.includes("meal") ? "meal" : "";
    calls.push({ name: "buy_offering", args: { query } });
  }

  if (wantsSend) {
    const ada = Number(t.match(/(\d+(\.\d+)?)/)?.[1] ?? 1);
    calls.push({ name: "send_ada", args: { ada } });
  }

  return withPrereqs(calls, snap);
}

function withPrereqs(goal: ToolCall[], snap: AgentSnapshot): ToolCall[] {
  const out: ToolCall[] = [];
  const needLedger = goal.some(
    (c) =>
      ![
        "inspect_state",
        "inspect_genesis",
        "prove_seal",
        "inspect_validators",
        "inspect_pools",
        "resolve_did",
        "inspect_preprod",
      ].includes(c.name),
  );
  if (needLedger && snap.status !== "ready") out.push({ name: "boot_node", args: {} });
  const needWallet = goal.some((c) =>
    [
      "mint_pnft",
      "claim_ubi",
      "record_impact",
      "register_land",
      "list_offering",
      "buy_offering",
      "send_ada",
      "request_faucet",
      "list_job",
      "bid_job",
      "register_pool",
      "delegate_ultra",
      "claim_pool_rewards",
      "open_hydra",
      "pool_verify",
    ].includes(c.name),
  );
  if (needWallet && !snap.address) out.push({ name: "create_wallet", args: {} });
  const needPnft = goal.some((c) =>
    ["claim_ubi", "record_impact", "register_land", "list_job", "bid_job", "register_pool", "delegate_ultra", "open_hydra", "pool_verify"].includes(
      c.name,
    ),
  );
  if (needPnft && !snap.identity && !goal.some((c) => c.name === "mint_pnft")) {
    out.push({ name: "mint_pnft", args: { bioregion: snap.bioregion ?? "sierra-nevada" } });
  }
  for (const c of goal) {
    if (c.name === "mint_pnft" && snap.identity) continue;
    if (c.name === "boot_node" && snap.status === "ready") continue;
    if (c.name === "create_wallet" && snap.address) continue;
    out.push(c);
  }
  return out;
}

export function wrapUp(results: { name: string; ok: boolean; summary: string }[], snap: AgentSnapshot) {
  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  if (results.length === 0) {
    return "I can mint a pNFT (your DID), list or buy goods, post or bid jobs, delegate ULTRA to a bioregion pool, open a Hydra head. Try: live in Sierra Nevada and claim this epoch.";
  }
  if (fail.length && !ok.length) return fail[0]!.summary;
  const ident = snap.identity ? `${snap.identity}${snap.bioregion ? ` in ${snap.bioregion}` : ""}` : "no identity yet";
  const head = ok.length === 1 ? ok[0]!.summary.split(" tx")[0] : `${ok.length} actions confirmed on the in-browser ledger.`;
  const tail = fail.length ? ` ${fail.length} did not land: ${fail[0]!.summary}` : "";
  return `${head} Identity ${ident}. ${snap.ultra} ULTRA.${tail}`;
}
