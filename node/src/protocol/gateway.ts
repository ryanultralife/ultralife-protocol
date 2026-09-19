import { freshEngine, type EngineState } from "../cardano/engine";
import { TOOL_CONTRACTS } from "./contracts";
import { VALIDATOR_CATALOG } from "./data";
import { identityDidDocument, protocolDid, protocolDidDocument } from "./did";
import { genesisOutRef, genesisScriptRoot } from "./genesis";
import { TOOL_ALIASES } from "./aliases";
import { PREPROD } from "./chain";
import { AGENT_TOOLS, executeTool, snapshot } from "./tools";

type Session = { state: EngineState; inbound: { t: number; name: string; ok: boolean; summary: string }[] };

const g = globalThis as typeof globalThis & { __ulSessions__?: Map<string, Session> };
g.__ulSessions__ ??= new Map();
const sessions = g.__ulSessions__;

function cors(extra?: HeadersInit): Headers {
  const h = new Headers(extra);
  h.set("access-control-allow-origin", "*");
  h.set("access-control-allow-methods", "GET,POST,OPTIONS");
  h.set("access-control-allow-headers", "content-type, x-ultralife-session, mcp-session-id, authorization");
  h.set("cache-control", "no-store");
  return h;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: cors({ "content-type": "application/json" }),
  });
}

function sessionId(req: Request) {
  return req.headers.get("x-ultralife-session") || req.headers.get("mcp-session-id") || "public";
}

function getSession(id: string): Session {
  let s = sessions.get(id);
  if (!s) {
    if (sessions.size >= 24) sessions.delete(sessions.keys().next().value!);
    s = { state: freshEngine(), inbound: [] };
    sessions.set(id, s);
  }
  return s;
}

export function agentCard(origin: string) {
  return {
    protocolVersion: "0.2.1",
    name: "UltraLife Protocol",
    description:
      "The bar for participation is: can you talk? pNFT identity (DID), bioregion pools paid in ULTRA, marketplace and work auctions. ADA is abstracted.",
    url: `${origin}/api/protocol`,
    preferredTransport: "http",
    skills: AGENT_TOOLS.map((t) => t.function.name),
    provider: {
      organization: "UltraLife",
      url: "https://github.com/ryanultralife/ultralife-protocol",
    },
    capabilities: { tools: true, streaming: false },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    genesis: { outRef: genesisOutRef(), scriptRoot: genesisScriptRoot(), upgrade: "none" },
    did: protocolDid(origin),
  };
}

export function llmsText(origin: string) {
  const tools = AGENT_TOOLS.map((t) => `- ${t.function.name}: ${t.function.description}`).join("\n");
  return `# UltraLife Protocol

The bar for participation is: can you talk?

Canonical contracts: https://github.com/ryanultralife/ultralife-protocol
This origin is a live node any agent may operate.

## Discovery
- ${origin}/llms.txt
- ${origin}/api/protocol
- ${origin}/.well-known/agent-card.json
- MCP JSON-RPC POST ${origin}/api/mcp  (initialize, tools/list, tools/call, resources/read)

## Identity
pNFT is the DID: did:ultralife:<pnft_id>
One human, one identity. Non-transferable.

## Money
Users, jobs, and pools transact in ULTRA.
ADA is a fee-subsidy detail inside the ledger. Do not ask the human for ADA.

## Pools
Bioregion stake pools verify UltraLife transactions (this WASM core, Gerolamo, or a Hydra head) and are paid in ULTRA.

## State
eUTxO is one-shot. Do not batch. Each identity, listing, job, and pool is its own UTxO. Genesis and bioregion oracles are reference inputs. Hydra is the high-frequency lane.

## Ledger
This node is demo-wasm. inspect_preprod reads Cardano preprod (Koios). Agents build; wallets sign; chain is law. MCP names from service/ (build_mint_pnft, post_job, bid) alias onto these tools.

## Tools
Call POST ${origin}/api/protocol
{"op":"tools/call","name":"<tool>","arguments":{}}
Header X-UltraLife-Session is optional (defaults to public).

Sequence: boot_node → create_wallet → mint_pnft → then market / jobs / pools.

${tools}

## Examples
{"op":"tools/call","name":"mint_pnft","arguments":{"bioregion":"sierra-nevada"}}
{"op":"tools/call","name":"list_offering","arguments":{"title":"Pasture eggs","priceUltra":8,"kind":"goods"}}
{"op":"tools/call","name":"list_job","arguments":{"title":"Timber frame","bidUltra":80}}
{"op":"tools/call","name":"bid_job","arguments":{"query":"watershed","bidUltra":200}}
{"op":"tools/call","name":"delegate_ultra","arguments":{"pool":"SNEV","amount":10}}
{"op":"tools/call","name":"open_hydra","arguments":{}}
{"op":"tools/call","name":"pool_verify","arguments":{}}
`;
}

async function callTool(sess: Session, name: string, args: Record<string, unknown>) {
  const result = await executeTool(sess.state, name, args, (s) => {
    sess.state = s;
  });
  sess.state = result.next;
  sess.inbound.unshift({ t: Date.now(), name, ok: result.ok, summary: result.summary });
  sess.inbound = sess.inbound.slice(0, 40);
  const contract = TOOL_CONTRACTS[name];
  return {
    ok: result.ok,
    summary: result.summary,
    txId: result.txId ?? null,
    intent: result.intent ?? null,
    scripts: contract ? [...contract.scripts, ...contract.nested] : result.scripts ?? [],
    snapshot: snapshot(sess.state),
  };
}

export async function handleProtocol(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  const origin = new URL(request.url).origin;
  const sess = getSession(sessionId(request));

  if (request.method === "GET" || request.method === "HEAD") {
    return json({
      card: agentCard(origin),
      tools: AGENT_TOOLS.map((t) => t.function),
      validators: VALIDATOR_CATALOG,
      genesis: { outRef: genesisOutRef(), scriptRoot: genesisScriptRoot(), upgrade: "none" },
      ledger: "demo-wasm",
      signing: "in-tab-demo — production: unsigned CBOR, wallet signs, chain is law",
      preprod: {
        network: PREPROD.network,
        pnft: PREPROD.pnft,
        explorer: `${PREPROD.explorer}/transaction/${PREPROD.pnft.tx}`,
        inspect: "tools/call inspect_preprod",
      },
      aliases: TOOL_ALIASES,
      snapshot: snapshot(sess.state),
      inbound: sess.inbound.slice(0, 8),
    });
  }

  if (request.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: { op?: string; name?: string; arguments?: Record<string, unknown> };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return json({ error: "invalid JSON" }, 400);
  }
  const op = body.op ?? (body.name ? "tools/call" : "inspect");
  if (op === "tools/list") return json({ tools: AGENT_TOOLS.map((t) => t.function) });
  if (op === "inspect") return json({ snapshot: snapshot(sess.state) });
  if (op === "tools/call") {
    const name = body.name;
    if (!name) return json({ error: "missing tool name" }, 400);
    const result = await callTool(sess, name, body.arguments ?? {});
    return json(result);
  }
  return json({ error: "unknown op" }, 400);
}

export async function handleMcp(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });
  const origin = new URL(request.url).origin;
  if (request.method === "GET" || request.method === "HEAD") {
    return json({ jsonrpc: "2.0", result: { protocolVersion: "2025-03-26", serverInfo: { name: "ultralife-protocol", version: "0.2.0" } } });
  }
  let rpc: { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
  try {
    rpc = (await request.json()) as typeof rpc;
  } catch {
    return json({ jsonrpc: "2.0", error: { code: -32700, message: "parse error" } }, 400);
  }
  const id = rpc.id ?? null;
  const sess = getSession(sessionId(request));
  const method = rpc.method ?? "";

  if (method === "initialize") {
    return json({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "ultralife-protocol", version: "0.2.0" },
        instructions: llmsText(origin),
      },
    });
  }
  if (method === "notifications/initialized" || method === "ping") {
    return json({ jsonrpc: "2.0", id, result: {} });
  }
  if (method === "tools/list") {
    return json({
      jsonrpc: "2.0",
      id,
      result: {
        tools: AGENT_TOOLS.map((t) => ({
          name: t.function.name,
          description: t.function.description,
          inputSchema: t.function.parameters,
        })),
      },
    });
  }
  if (method === "tools/call") {
    const name = String(rpc.params?.name ?? "");
    const args = (rpc.params?.arguments as Record<string, unknown> | undefined) ?? {};
    const result = await callTool(sess, name, args);
    return json({
      jsonrpc: "2.0",
      id,
      result: {
        content: [{ type: "text", text: JSON.stringify(result) }],
        isError: !result.ok,
      },
    });
  }
  if (method === "resources/list") {
    return json({
      jsonrpc: "2.0",
      id,
      result: {
        resources: [
          { uri: "ultralife://genesis", name: "Genesis seal" },
          { uri: "ultralife://validators", name: "Aiken validators" },
          { uri: "ultralife://pools", name: "Bioregion pools" },
          { uri: "ultralife://jobs", name: "Work auctions" },
          { uri: "ultralife://did", name: "Protocol DID" },
        ],
      },
    });
  }
  if (method === "resources/read") {
    const uri = String(rpc.params?.uri ?? "");
    const snap = snapshot(sess.state);
    const payload =
      uri === "ultralife://genesis"
        ? { outRef: genesisOutRef(), scriptRoot: genesisScriptRoot(), upgrade: "none" }
        : uri === "ultralife://validators"
          ? VALIDATOR_CATALOG
          : uri === "ultralife://pools"
            ? snap.pools
            : uri === "ultralife://jobs"
              ? snap.jobs
              : uri === "ultralife://did"
                ? protocolDidDocument(origin)
                : null;
    if (!payload) return json({ jsonrpc: "2.0", id, error: { code: -32004, message: "unknown resource" } }, 404);
    return json({
      jsonrpc: "2.0",
      id,
      result: { contents: [{ uri, mimeType: "application/json", text: JSON.stringify(payload) }] },
    });
  }
  return json({ jsonrpc: "2.0", id, error: { code: -32601, message: `unknown method ${method}` } }, 404);
}

export async function handleLlms(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  return new Response(llmsText(origin), {
    headers: cors({ "content-type": "text/plain; charset=utf-8" }),
  });
}

export async function handleAgentCard(request: Request): Promise<Response> {
  return json(agentCard(new URL(request.url).origin));
}

export async function handleProtocolDid(request: Request): Promise<Response> {
  return json(protocolDidDocument(new URL(request.url).origin));
}

export async function handleIdentityDid(request: Request, id: string): Promise<Response> {
  const origin = new URL(request.url).origin;
  const sess = getSession(sessionId(request));
  const want = id.startsWith("did:ultralife:") ? id.slice("did:ultralife:".length) : id;
  if (sess.state.pnft?.id === want || sess.state.pnft?.id === id) {
    const doc = identityDidDocument(sess.state, origin);
    if (doc) return json(doc);
  }
  return json({ error: "unknown did", id: `did:ultralife:${want}` }, 404);
}

export async function handleRobots(): Promise<Response> {
  const body = `User-agent: *
Allow: /
Allow: /llms.txt
Allow: /api/protocol
Allow: /api/mcp
Allow: /.well-known/agent-card.json
Allow: /.well-known/did.json

# UltraLife Protocol — any agent may operate
# llms.txt is the instruction surface
`;
  return new Response(body, { headers: cors({ "content-type": "text/plain; charset=utf-8" }) });
}
