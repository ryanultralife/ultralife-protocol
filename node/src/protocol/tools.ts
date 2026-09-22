import {
  bidJob,
  bootNode,
  buyOffering,
  claimPoolRewards,
  claimUbi,
  createWallet,
  delegateToPool,
  faucet,
  genesisIntact,
  genesisUtxo,
  listJob,
  listOffering,
  mintPnft,
  openHydraHead,
  poolVerify,
  proveGenesisSeal,
  runRedTeam,
  recordImpact,
  registerLand,
  presaleIsotope,
  convertIsotope,
  transferIsotope,
  administerDose,
  commitPlant,
  registerPool,
  sendAda,
  assetQty,
  walletValue,
  type EngineState,
} from "../cardano/engine";
import { genesisOutRef, genesisScriptRoot } from "./genesis";
import { POLICIES } from "../cardano/types";
import { BIOREGIONS, VALIDATOR_CATALOG } from "./data";
import { identityDidDocument } from "./did";
import { remainingBq } from "./isotope";
import {
  addAttest,
  blockFrom,
  closeGrant,
  issueGrant,
  issueOfftake,
  logInteraction,
  merkleSpine,
  postSpine,
  revealSpine,
  type CredType,
  type WorkAccount,
} from "./plant";
import { canonicalTool, rewriteArgs } from "./aliases";
import { inspectPreprod } from "./chain";
import { assertContract, contractFor, TOOL_CONTRACTS } from "./contracts";

export type TalkRole = "you" | "agent" | "tool";

export type TalkMsg = {
  id: string;
  role: TalkRole;
  text: string;
  tool?: {
    name: string;
    args?: Record<string, unknown>;
    ok?: boolean;
    txId?: string;
    intent?: string;
    fee?: number;
  };
};

export type AgentSnapshot = {
  ledger: "demo-wasm";
  signing: "in-tab-demo — production: unsigned CBOR, wallet signs, chain is law";
  status: EngineState["status"];
  wasmReady: boolean;
  slot: number;
  ada: number;
  ultra: number;
  address: string | null;
  identity: string | null;
  did: string | null;
  bioregion: string | null;
  impact: Record<string, number>;
  offerings: { id: string; title: string; priceUltra: number; available: boolean }[];
  jobs: { id: string; title: string; bidUltra: number; status: string }[];
  pools: { id: string; ticker: string; bioregion: string; stakeUltra: number }[];
  hydra: EngineState["hydra"];
  lastIntent: string | null;
  bioregions: { id: string; name: string; health: number }[];
  lots: { id: string; nuclide: string; status: string; remainingBq: number; owner: string }[];
};

export type ToolCall = { id?: string; name: string; args: Record<string, unknown> };

export type ToolResult = {
  ok: boolean;
  summary: string;
  next: EngineState;
  txId?: string;
  intent?: string;
  fee?: number;
  scripts?: string[];
  nested?: string[];
};

export const AGENT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "inspect_state",
      description: "Read node, wallet, identity, balances, and open marketplace listings. Call when you need current truth.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "inspect_genesis",
      description: "Read the genesis seal: out-ref, frozen script root, canonical policy IDs. Mirrors are different hashes.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "prove_seal",
      description: "Attempt a mirror mint and a genesis spend. Both must fail. Does not change the ledger.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "red_team",
      description:
        "Adversary suite against this WASM ledger: steal genesis, mirror ULTRA, ghost pNFT, Hydra without identity, singleton market. Attacks must fail. Does not mutate the ledger. Does not use keys. Not preprod.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "inspect_validators",
      description: "List the sealed Aiken validators this node will execute. Genesis-parameterized; not upgradable.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "inspect_preprod",
      description:
        "Read Cardano preprod (Koios). Confirms the documented pNFT mint. Does not submit. Production signing is the wallet, not this agent.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "resolve_did",
      description: "Resolve a did:ultralife identity on this node. pNFT is the DID.",
      parameters: {
        type: "object",
        properties: { id: { type: "string", description: "did:ultralife:... or pNFT id. Omit for the current wallet." } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "boot_node",
      description: "Compile cardano-api.wasm, bind the Plutus CEK, load UltraLife validators. Required before any tx.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_wallet",
      description: "Derive a CIP-1852 payment key in this browser and faucet 100 test ADA. Keys never leave the tab.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "request_faucet",
      description: "Request another 100 ADA faucet UTxO.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "mint_pnft",
      description: "Mint a non-transferable Basic pNFT. Nested CIP-118 child grants 50 CIP-113 ULTRA. One human, one identity.",
      parameters: {
        type: "object",
        properties: {
          bioregion: { type: "string", description: "Bioregion id or name, e.g. sierra-nevada" },
        },
        required: ["bioregion"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "claim_ubi",
      description: "Claim this epoch's UBI. Amount follows home bioregion health. Requires a pNFT.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "record_impact",
      description: "Accrue chemical impact on the pNFT (CO2, H2O, CH4).",
      parameters: {
        type: "object",
        properties: {
          compound: { type: "string", enum: ["CO2", "H2O", "CH4"] },
          qty: { type: "number" },
        },
        required: ["compound", "qty"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "register_land",
      description: "Mint a land-rights NFT (surface, water, carbon, timber).",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string" },
          hectares: { type: "number" },
        },
        required: ["label", "hectares"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "presale_isotope",
      description:
        "First tokenization: pre-buy a medical isotope lot (Mo-99, I-131, Lu-177, Ac-225, F-18). Your pNFT owns the atoms until you convert them at a lab, sell remaining activity, or administer a dose. Not ULTRA. Not a fraction of identity.",
      parameters: {
        type: "object",
        properties: {
          nuclide: { type: "string", description: "Mo-99, Tc-99m, I-131, Lu-177, Ac-225, F-18" },
          activityBq: { type: "number" },
          priceUltra: { type: "number" },
        },
        required: ["nuclide"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "convert_isotope",
      description: "Licensed lab converts a lot you own (e.g. Mo-99 generator → Tc-99m eluate). Parent consumed, daughter lot minted.",
      parameters: {
        type: "object",
        properties: {
          lotId: { type: "string" },
          daughter: { type: "string" },
        },
        required: ["lotId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "transfer_isotope",
      description: "Sell remaining activity to another pNFT. Administered/converted lots cannot move.",
      parameters: {
        type: "object",
        properties: {
          lotId: { type: "string" },
          newOwner: { type: "string" },
        },
        required: ["lotId", "newOwner"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "administer_dose",
      description:
        "Administer a dose. Patient id and procedure stay off the ledger as 32-byte commitments (tx privacy). Lot ends. Hospital should own the lot — do not put the patient as owner.",
      parameters: {
        type: "object",
        properties: {
          lotId: { type: "string" },
          patient: { type: "string" },
        },
        required: ["lotId", "patient"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "log_interaction",
      description:
        "Log a man-and-machine interaction. personTag is the operator lapel (biometric KYC). machineTag is the crystal compute tag on the separator, door, or other asset. The payload is hashed. The waveform stays on the crystal.",
      parameters: {
        type: "object",
        properties: {
          personTag: { type: "string" },
          machineTag: { type: "string" },
          kind: { type: "string", enum: ["Enroll", "Access", "Operate", "Check"] },
          collective: { type: "string" },
          bioregion: { type: "string" },
          payload: { type: "string" },
        },
        required: ["personTag", "machineTag", "kind"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "post_record",
      description:
        "Post a plant spine record. commit is a hash. Default is hash-only. Do not put PII, citizenship files, or diagnosis in the payload that lands on a public field.",
      parameters: {
        type: "object",
        properties: {
          schema: { type: "string" },
          collective: { type: "string" },
          bioregion: { type: "string" },
          subject: { type: "string" },
          payload: { type: "string" },
          seal: { type: "string" },
        },
        required: ["schema", "collective", "bioregion", "subject", "payload"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "reveal_record",
      description: "Write schema=Reveal. No plaintext argument. GDPR erase revokes keys; lineage stays.",
      parameters: {
        type: "object",
        properties: { recordId: { type: "string" } },
        required: ["recordId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "post_merkle_root",
      description: "L1 root of a Hydra shift. Chromatograms stay off L1.",
      parameters: {
        type: "object",
        properties: {
          collective: { type: "string" },
          bioregion: { type: "string" },
          root: { type: "string" },
        },
        required: ["root"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "attest_control",
      description: "Live ControlAttest. Restricted Produce and Transfer fail without one. Does not strip dest_policy.",
      parameters: {
        type: "object",
        properties: {
          cred: { type: "string" },
          subject: { type: "string" },
          destPolicy: { type: "string" },
          class: { type: "string" },
          issuer: { type: "string" },
          expirySlot: { type: "number" },
        },
        required: ["cred", "subject", "destPolicy"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "presale_grant",
      description:
        "WorkTicket for the pre-EDF raise. Face is units times price. This does not mint ULTRA as the $20M.",
      parameters: {
        type: "object",
        properties: {
          plant: { type: "string" },
          bioregion: { type: "string" },
          account: { type: "string" },
          units: { type: "number" },
          price: { type: "number" },
          tranche: { type: "string" },
          senior: { type: "boolean" },
        },
        required: ["account", "units", "price"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "presale_offtake",
      description: "Offtake claim. Junior senior=false. EDF later is a new senior claim and cannot eat junior units.",
      parameters: {
        type: "object",
        properties: {
          sku: { type: "string" },
          qty: { type: "number" },
          plant: { type: "string" },
          bioregion: { type: "string" },
          controlClass: { type: "string" },
          destPolicy: { type: "string" },
          senior: { type: "boolean" },
          parentGrant: { type: "string" },
        },
        required: ["sku", "qty"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "close_ticket",
      description: "Close one unit against a record. Design and machine accounts pay Mechanical Battery's bucket in ULTRA.",
      parameters: {
        type: "object",
        properties: {
          ticketId: { type: "string" },
          recordId: { type: "string" },
        },
        required: ["ticketId", "recordId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "inspect_tickets",
      description: "Funded units, remaining units, prime bucket ULTRA, and fee_pool skim.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "inspect_isotopes",
      description: "List isotope lots this node knows, with remaining Bq after decay.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_offering",
      description: "List goods, service, care, knowledge, or land on the marketplace.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          priceUltra: { type: "number" },
          kind: { type: "string", enum: ["goods", "service", "care", "knowledge", "land"] },
        },
        required: ["title", "priceUltra"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "buy_offering",
      description: "Settle a listing in ULTRA under CIP-113. Nested child accrues impact.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Offering id or words from the title" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_job",
      description: "Post a work auction: a job or service needed, bid in ULTRA.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          bidUltra: { type: "number" },
          controlClass: { type: "string" },
          parentTicket: { type: "string" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "bid_job",
      description: "Bid ULTRA on an open work auction (id or words from the title).",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          bidUltra: { type: "number" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "inspect_pools",
      description: "List bioregion stake pools. Stake and rewards are ULTRA, never ADA.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "register_pool",
      description: "Register a bioregion pool. Locks 20 ULTRA. You verify UltraLife txs and earn ULTRA.",
      parameters: {
        type: "object",
        properties: {
          ticker: { type: "string" },
          focus: { type: "string" },
        },
        required: ["ticker"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delegate_ultra",
      description: "Delegate ULTRA to a bioregion pool. Raises that bioregion's credit capacity.",
      parameters: {
        type: "object",
        properties: {
          pool: { type: "string", description: "Pool id or ticker, e.g. SNEV" },
          amount: { type: "number" },
        },
        required: ["pool", "amount"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "claim_pool_rewards",
      description: "Claim this epoch's ULTRA rewards from your delegation.",
      parameters: {
        type: "object",
        properties: { pool: { type: "string" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "open_hydra",
      description: "Open a Hydra head for the bioregion. L2 still terminates at a pNFT. Fees in ULTRA.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "pool_verify",
      description: "Verify the last UltraLife tx as a bioregion pool (Gerolamo/WASM/Hydra lane). Paid 1 ULTRA.",
      parameters: {
        type: "object",
        properties: { pool: { type: "string" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "send_ada",
      description: "Internal L1 subsidy transfer. Users and pools operate in ULTRA; ADA is abstracted.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string" },
          ada: { type: "number" },
        },
        required: ["ada"],
      },
    },
  },
];

export function newMsg(partial: Omit<TalkMsg, "id">): TalkMsg {
  return { id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...partial };
}

export function snapshot(state: EngineState): AgentSnapshot {
  return {
    ledger: "demo-wasm",
    signing: "in-tab-demo — production: unsigned CBOR, wallet signs, chain is law",
    status: state.status,
    wasmReady: state.wasmReady,
    slot: Math.floor(state.slot),
    ada: walletValue(state).lovelace,
    ultra: assetQty(state, POLICIES.ultra, "ULTRA"),
    address: state.wallet?.address ?? null,
    identity: state.pnft?.level ?? null,
    did: state.pnft ? `did:ultralife:${state.pnft.id}` : null,
    bioregion: state.pnft?.bioregion ?? null,
    impact: state.pnft?.impact ?? {},
    offerings: state.offerings.map((o) => ({
      id: o.id,
      title: o.title,
      priceUltra: o.priceUltra,
      available: o.available,
    })),
    jobs: state.auctions.map((j) => ({ id: j.id, title: j.title, bidUltra: j.bidUltra, status: j.status })),
    pools: state.pools.map((p) => ({ id: p.id, ticker: p.ticker, bioregion: p.bioregion, stakeUltra: p.stakeUltra })),
    hydra: state.hydra,
    lastIntent: state.lastTx?.intent ?? null,
    bioregions: BIOREGIONS.map((b) => ({ id: b.id, name: b.name, health: b.health })),
    lots: (state.lots ?? []).map((l) => ({
      id: l.id,
      nuclide: l.nuclide,
      status: l.status,
      remainingBq: remainingBq(l, state.slot),
      owner: l.owner,
    })),
  };
}

export function resolveBioregion(raw: string) {
  const t = raw.toLowerCase().trim();
  return (
    BIOREGIONS.find((b) => b.id === t) ??
    BIOREGIONS.find((b) => b.name.toLowerCase() === t) ??
    BIOREGIONS.find((b) => t.includes(b.name.toLowerCase().split(" ")[0]!)) ??
    BIOREGIONS.find((b) => b.id === "sierra-nevada")!
  );
}

function describeTx(state: EngineState, before: EngineState) {
  const tx = state.lastTx;
  if (!tx || tx.id === before.lastTx?.id) return {};
  const nested = tx.nested?.length ? `, ${tx.nested.length} nested` : "";
  return {
    txId: tx.id,
    intent: tx.intent,
    fee: tx.fee,
    extra: ` tx ${tx.id.slice(0, 12)}… ${tx.intent}${nested}`,
  };
}

function fromEngine(before: EngineState, next: EngineState, okMsg: string): ToolResult {
  const last = next.logs[next.logs.length - 1];
  const desc = describeTx(next, before);
  if (last?.level === "warn" && !desc.txId) {
    return { ok: false, summary: last.msg, next };
  }
  return {
    ok: true,
    summary: `${okMsg}${desc.extra ?? ""}`,
    next,
    txId: desc.txId,
    intent: desc.intent,
    fee: desc.fee,
  };
}

export async function executeTool(
  state: EngineState,
  name: string,
  args: Record<string, unknown>,
  onTick: (s: EngineState) => void,
): Promise<ToolResult> {
  const before = state;
  const incoming = name;
  args = rewriteArgs(incoming, args);
  name = canonicalTool(incoming);
  switch (name) {
    case "inspect_preprod": {
      const report = await inspectPreprod();
      return {
        ok: report.ok,
        summary: JSON.stringify(report),
        next: state,
      };
    }
    case "red_team": {
      const { cases, held, next } = runRedTeam(state);
      return {
        ok: held,
        summary: JSON.stringify({ held, ledger: "demo-wasm", signing: "no keys used", cases }),
        next,
      };
    }
    case "inspect_state": {
      const snap = snapshot(state);
      return {
        ok: true,
        summary: JSON.stringify({
          status: snap.status,
          ultra: snap.ultra,
          identity: snap.identity,
          did: snap.did,
          bioregion: snap.bioregion,
          offerings: snap.offerings.filter((o) => o.available).map((o) => `${o.title} @ ${o.priceUltra}`),
          jobs: snap.jobs.filter((j) => j.status === "open").map((j) => `${j.title} @ ${j.bidUltra}`),
          pools: snap.pools.map((p) => `${p.ticker} ${p.stakeUltra}`),
        }),
        next: state,
      };
    }
    case "inspect_genesis": {
      const u = genesisUtxo(state);
      return {
        ok: true,
        summary: JSON.stringify({
          intact: genesisIntact(state),
          outRef: genesisOutRef(),
          scriptRoot: genesisScriptRoot(),
          nft: u ? Object.keys(u.value.assets)[0] : null,
          upgrade: "none",
          datum: u?.datum ?? null,
        }),
        next: state,
      };
    }
    case "prove_seal":
      return fromEngine(before, proveGenesisSeal(state), "Mirror mint and genesis spend were evaluated against the CEK.");
    case "inspect_validators":
      return {
        ok: true,
        summary: JSON.stringify(VALIDATOR_CATALOG.map((v) => v.name)),
        next: state,
      };
    case "resolve_did": {
      const doc = identityDidDocument(state, "https://ultralife.protocol");
      if (!doc) return { ok: false, summary: "No pNFT on this node. Mint identity first.", next: state };
      const want = String(args.id ?? doc.id);
      if (want && !doc.id.includes(want.replace("did:ultralife:", "")) && want !== doc.id) {
        return { ok: false, summary: `DID ${want} is not on this session.`, next: state };
      }
      return { ok: true, summary: JSON.stringify(doc), next: state };
    }
    case "boot_node": {
      if (state.status === "ready" && state.wasmReady) {
        return { ok: true, summary: "Node already ready. WASM bound.", next: state };
      }
      const next = await bootNode(state, onTick);
      return fromEngine(before, next, "cardano-api.wasm compiled. CEK bound. Validators loaded.");
    }
    case "create_wallet": {
      if (state.wallet) {
        return { ok: true, summary: `Wallet already live at ${state.wallet.address.slice(0, 18)}…`, next: state };
      }
      let next = await createWallet(state);
      if (next.status === "ready") next = await faucet(next);
      return fromEngine(before, next, "Payment key derived in-tab. Faucet submitted.");
    }
    case "request_faucet":
      return fromEngine(before, await faucet(state), "Faucet built, costed, signed, submitted.");
    case "mint_pnft": {
      const bio = resolveBioregion(String(args.bioregion ?? "sierra-nevada"));
      return fromEngine(
        before,
        await mintPnft(state, bio.id),
        `Basic pNFT minted in ${bio.name}. Nested CIP-113 grant of 50 ULTRA.`,
      );
    }
    case "claim_ubi":
      return fromEngine(before, await claimUbi(state), "UBI claimed against the distributor script.");
    case "record_impact": {
      const compound = String(args.compound ?? "CO2").toUpperCase();
      const qty = Number(args.qty ?? 1);
      return fromEngine(before, await recordImpact(state, compound, qty), `Recorded ${qty} ${compound}.`);
    }
    case "register_land": {
      const label = String(args.label ?? "Parcel").slice(0, 48);
      const ha = Number(args.hectares ?? 1);
      return fromEngine(before, await registerLand(state, label, ha), `Land rights registered: ${label}, ${ha} ha.`);
    }
    case "presale_isotope": {
      const nuclide = String(args.nuclide ?? "Mo-99");
      const bq = Number(args.activityBq ?? 1_000_000_000);
      const price = Number(args.priceUltra ?? 40);
      return fromEngine(
        before,
        await presaleIsotope(state, nuclide, bq, price, {
          controlClass: args.controlClass ? String(args.controlClass) : undefined,
          destPolicy: args.destPolicy ? String(args.destPolicy) : undefined,
          runId: args.runId ? String(args.runId) : undefined,
        }),
        `Pre-sold ${nuclide} lot. Your pNFT owns it until convert, sell, or dose.`,
      );
    }
    case "convert_isotope": {
      const lotId = String(args.lotId ?? "");
      const daughter = args.daughter ? String(args.daughter) : undefined;
      return fromEngine(before, await convertIsotope(state, lotId, daughter), `Lab conversion of ${lotId}.`);
    }
    case "transfer_isotope": {
      return fromEngine(
        before,
        await transferIsotope(state, String(args.lotId ?? ""), String(args.newOwner ?? "")),
        "Title moved. Atoms still decaying.",
      );
    }
    case "administer_dose": {
      return fromEngine(
        before,
        await administerDose(state, String(args.lotId ?? ""), String(args.patient ?? "")),
        "Dose administered. Lot no longer transferable.",
      );
    }
    case "log_interaction": {
      const kind = String(args.kind ?? "Check");
      if (kind !== "Enroll" && kind !== "Access" && kind !== "Operate" && kind !== "Check") {
        return { ok: false, summary: "kind is Enroll, Access, Operate, or Check.", next: state };
      }
      const logged = logInteraction(state.plant, state.slot, {
        personTag: String(args.personTag ?? ""),
        machineTag: String(args.machineTag ?? ""),
        kind,
        collective: String(args.collective ?? "collective_intec"),
        bioregion: String(args.bioregion ?? "intec-site"),
        payload: String(args.payload ?? ""),
      });
      if (!logged.ok) return { ok: false, summary: logged.error, next: state };
      return fromEngine(
        before,
        await commitPlant(state, "log-interaction", ["records.records.spend", "biometric.identity.spend"], logged.plant),
        `${kind} ${logged.id}. Lapel and machine tag committed. Waveform stayed on the crystal.`,
      );
    }
    case "post_record": {
      const posted = postSpine(state.plant, state.slot, {
        schema: String(args.schema ?? "Run"),
        collective: String(args.collective ?? "collective_intec"),
        bioregion: String(args.bioregion ?? "intec-site"),
        subject: String(args.subject ?? "run"),
        payload: String(args.payload ?? ""),
        seal: args.seal ? String(args.seal) : undefined,
      });
      if (!posted.ok) return { ok: false, summary: posted.error, next: state };
      return fromEngine(
        before,
        await commitPlant(state, "post-record", ["records.records.spend"], posted.plant),
        `Record ${posted.id} committed. Hash-only unless seal was set.`,
      );
    }
    case "reveal_record": {
      const opened = revealSpine(state.plant, state.slot, String(args.recordId ?? ""));
      if (!opened.ok) return { ok: false, summary: opened.error, next: state };
      return fromEngine(
        before,
        await commitPlant(state, "reveal-record", ["records.records.spend"], opened.plant),
        "Reveal written. No plaintext on the ledger.",
      );
    }
    case "post_merkle_root": {
      const root = merkleSpine(state.plant, state.slot, {
        collective: String(args.collective ?? "collective_intec"),
        bioregion: String(args.bioregion ?? "intec-site"),
        root: String(args.root ?? ""),
      });
      if (!root.ok) return { ok: false, summary: root.error, next: state };
      return fromEngine(
        before,
        await commitPlant(state, "post-merkle-root", ["records.records.spend"], root.plant),
        `Merkle root ${root.id} on L1.`,
      );
    }
    case "attest_control": {
      const attested = addAttest(state.plant, state.slot, {
        cred: String(args.cred ?? "FacilityClearance") as CredType,
        subject: String(args.subject ?? ""),
        destPolicy: String(args.destPolicy ?? "intec-us"),
        class: (args.class ? String(args.class) : "Medical") as "Medical",
        issuer: String(args.issuer ?? "issuer-radiopharmacy"),
        expirySlot: Number(args.expirySlot ?? state.slot + 1_000_000),
      });
      if (!attested.ok) return { ok: false, summary: attested.error, next: state };
      return fromEngine(
        before,
        await commitPlant(state, "attest-control", ["records.records.spend"], attested.plant),
        "ControlAttest posted. dest_policy unchanged.",
      );
    }
    case "presale_grant": {
      const account = String(args.account ?? "design") as WorkAccount;
      const issued = issueGrant(state.plant, state.slot, {
        plant: String(args.plant ?? "collective_intec"),
        bioregion: String(args.bioregion ?? "intec-site"),
        tranche: (args.tranche ? String(args.tranche) : "T0") as "T0",
        account: account.toLowerCase() as WorkAccount,
        units: Number(args.units ?? 1),
        price: Number(args.price ?? 1),
        capAdaExitBps: Number(args.capAdaExitBps ?? 0),
        seedLockUltra: Number(args.seedLockUltra ?? 0),
        feeSkimBps: Number(args.feeSkimBps ?? 100),
        milestoneCommit: String(args.milestone ?? "milestone"),
        refundSlot: Number(args.refundSlot ?? state.slot + 5_000_000),
        senior: Boolean(args.senior),
      });
      if (!issued.ok) return { ok: false, summary: issued.error, next: state };
      return fromEngine(
        before,
        await commitPlant(state, "presale-grant", ["grants.grants.spend"], issued.plant),
        `WorkTicket ${issued.id}. Face is units × price. ULTRA was not minted as the raise.`,
      );
    }
    case "presale_offtake": {
      const claim = issueOfftake(state.plant, {
        sku: String(args.sku ?? "isotope-lot"),
        qty: Number(args.qty ?? 1),
        windowStart: state.slot,
        windowEnd: state.slot + 5_000_000,
        plant: String(args.plant ?? "collective_intec"),
        bioregion: String(args.bioregion ?? "intec-site"),
        control: blockFrom({
          class: args.controlClass ?? "Medical",
          destPolicy: args.destPolicy,
        }),
        parentGrant: args.parentGrant ? String(args.parentGrant) : undefined,
        senior: Boolean(args.senior),
      });
      if (!claim.ok) return { ok: false, summary: claim.error, next: state };
      return fromEngine(
        before,
        await commitPlant(state, "presale-offtake", ["grants.grants.spend"], claim.plant),
        `Offtake ${claim.id}. senior=${Boolean(args.senior)}.`,
      );
    }
    case "close_ticket": {
      const closed = closeGrant(state.plant, state.slot, String(args.ticketId ?? ""), String(args.recordId ?? ""));
      if (!closed.ok) return { ok: false, summary: closed.error, next: state };
      return fromEngine(
        before,
        await commitPlant(state, "close-ticket", ["grants.grants.spend"], closed.plant),
        closed.refunded
          ? "refund_slot passed. Remaining units voided. Junior lots were not eaten."
          : "Ticket unit closed. Design or machine work pays the Mechanical Battery bucket in ULTRA.",
      );
    }
    case "inspect_tickets": {
      const face = state.plant.tickets.reduce((s, t) => s + t.units * t.price, 0);
      const open = state.plant.tickets.reduce((s, t) => s + t.unitsRemaining * t.price, 0);
      return {
        ok: true,
        summary: JSON.stringify({
          face,
          remainingFace: open,
          primeBucketUltra: state.plant.primeBucketUltra,
          feePool: state.plant.feePool,
          tickets: state.plant.tickets,
          claims: state.plant.claims,
          records: state.plant.records.map((r) => ({ id: r.id, schema: r.schema, commit: r.commit, seal: r.seal ?? null })),
        }),
        next: state,
      };
    }
    case "inspect_isotopes": {
      const lots = (state.lots ?? []).map((l) => ({
        id: l.id,
        nuclide: l.nuclide,
        form: l.form,
        status: l.status,
        remainingBq: remainingBq(l, state.slot),
        owner: l.owner,
        custodian: l.custodian,
        patientCommit: l.patientCommit ?? null,
        procedureCommit: l.procedureCommit ?? null,
        expirySlot: l.expirySlot,
      }));
      return { ok: true, summary: JSON.stringify({ firstToken: "medical-isotope-lots", lots }), next: state };
    }
    case "list_offering": {
      const title = String(args.title ?? "Offering").slice(0, 48);
      const price = Number(args.priceUltra ?? 12);
      const kind = (String(args.kind ?? "goods") as "goods" | "service" | "care" | "knowledge" | "land");
      return fromEngine(before, await listOffering(state, title, price, kind), `Listed “${title}” at ${price} ULTRA.`);
    }
    case "buy_offering": {
      const q = String(args.query ?? args.offeringId ?? "").toLowerCase();
      const off =
        state.offerings.find((o) => o.available && (o.id === q || o.title.toLowerCase().includes(q))) ??
        state.offerings.find((o) => o.available);
      if (!off) return { ok: false, summary: "No available offerings.", next: state };
      return fromEngine(
        before,
        await buyOffering(state, off.id),
        `Settled “${off.title}” for ${off.priceUltra} ULTRA. CIP-113 transfer + nested impact.`,
      );
    }
    case "list_job": {
      const title = String(args.title ?? "Work").slice(0, 64);
      const bid = Number(args.bidUltra ?? 40);
      return fromEngine(
        before,
        await listJob(state, title, bid, {
          controlClass: args.controlClass ? String(args.controlClass) : undefined,
          parentTicket: args.parentTicket ? String(args.parentTicket) : undefined,
        }),
        `Posted job “${title}” at ${bid} ULTRA.`,
      );
    }
    case "bid_job": {
      const q = String(args.query ?? "");
      const job =
        state.auctions.find(
          (j) =>
            j.status === "open" &&
            (j.id === q || j.id.includes(q) || j.title.toLowerCase().includes(q.toLowerCase())),
        ) ?? state.auctions.find((j) => j.status === "open");
      if (!job) return { ok: false, summary: "No open jobs.", next: state };
      const bid = Number(args.bidUltra ?? job.bidUltra);
      return fromEngine(before, await bidJob(state, job.id, bid), `Bid ${bid} ULTRA on “${job.title}”.`);
    }
    case "inspect_pools":
      return {
        ok: true,
        summary: JSON.stringify(
          state.pools.map((p) => ({
            ticker: p.ticker,
            name: p.name,
            bioregion: p.bioregion,
            stakeUltra: p.stakeUltra,
            credit: Math.floor(p.stakeUltra * 0.5),
            paidIn: "ULTRA",
          })),
        ),
        next: state,
      };
    case "register_pool":
      return fromEngine(
        before,
        await registerPool(state, String(args.ticker ?? "ULP"), String(args.focus ?? "General")),
        "Bioregion pool registered. Stake is ULTRA.",
      );
    case "delegate_ultra": {
      const pool = String(args.pool ?? "SNEV");
      const amount = Number(args.amount ?? 10);
      return fromEngine(before, await delegateToPool(state, pool, amount), `Delegated ${amount} ULTRA to ${pool}.`);
    }
    case "claim_pool_rewards":
      return fromEngine(before, await claimPoolRewards(state, args.pool ? String(args.pool) : undefined), "Pool rewards claimed in ULTRA.");
    case "open_hydra":
      return fromEngine(before, await openHydraHead(state), "Hydra head open. L2 still terminates at your pNFT. Fees in ULTRA.");
    case "pool_verify":
      return fromEngine(
        before,
        await poolVerify(state, args.pool ? String(args.pool) : undefined),
        "Pool verified the last UltraLife tx. Paid 1 ULTRA.",
      );
    case "send_ada": {
      const ada = Number(args.ada ?? 1);
      const to = String(args.to ?? "addr_test1q_demo_counterparty");
      return fromEngine(before, await sendAda(state, to, ada), `Subsidy moved ${ada} ADA. Users still transact in ULTRA.`);
    }
    default:
      return { ok: false, summary: `Unknown tool ${name}.`, next: state };
  }
}
