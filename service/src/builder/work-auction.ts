/**
 * Work-auction unsigned tx builder for MCP labor-loop tools.
 *
 * Reuses Constr JSON encoding from scripts/work-auction-datums.mjs.
 * Each action returns UNSIGNED (real CBOR) or BLOCKED (named missing piece).
 *
 * Refuse Basic. No fake tx hashes. No mainnet. No fake DNA.
 * LLM/MCP cannot sign — Ryan signs on preprod.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Constr, Data } from 'lucid-cardano';
import type { Lucid, UTxO } from 'lucid-cardano';
import type { UltraLifeConfig } from '../types/index.js';
import type { UltraLifeIndexer } from '../indexer/index.js';

export type WorkAuctionAction =
  | 'post_job'
  | 'bid'
  | 'complete'
  | 'accept_bid'
  | 'submit_work'
  | 'release_payment';

export interface WorkAuctionCtx {
  lucid: Lucid | null;
  config: UltraLifeConfig;
  indexer: UltraLifeIndexer;
  getRefScriptUtxo: (name: string) => Promise<UTxO>;
  findPnftUtxo: (pnftId: string) => Promise<UTxO | null>;
}

export type WorkAuctionBlocked = {
  status: 'BLOCKED';
  network: string;
  action: string;
  missing: string[];
  can_transact: 'level != Basic';
  min_level_to_post_or_bid: 'Standard (DNA-verified)';
  no_fake_dna: true;
  no_mainnet: true;
  llm_cannot_sign: true;
  labor_loop_live: false;
  would_build?: { datum: unknown; redeemer: unknown };
  next: string;
};

export type WorkAuctionUnsigned = {
  status: 'UNSIGNED';
  network: 'preprod';
  action: string;
  unsigned_cbor: string;
  datum: unknown;
  redeemer: unknown;
  llm_cannot_sign: true;
  no_fake_dna: true;
  no_mainnet: true;
  submitted_tx_hash: null;
  next_step: string;
};

export type WorkAuctionBuildResult = WorkAuctionBlocked | WorkAuctionUnsigned;

type WaDatums = {
  laborGateError: (level?: string | null) => string | null;
  meetsLaborMinimum: (level?: string | null) => boolean;
  canTransact: (level?: string | null) => boolean;
  requestDatum: (p: Record<string, unknown>) => unknown;
  bidDatum: (p: Record<string, unknown>) => unknown;
  escrowDatum: (p: Record<string, unknown>) => unknown;
  createRequestRedeemer: (p: Record<string, unknown>) => unknown;
  submitBidRedeemer: (p: Record<string, unknown>) => unknown;
  acceptBidRedeemer: (bidId: string, hours?: number | null) => unknown;
  startWorkRedeemer: (escrowId: string) => unknown;
  submitWorkRedeemer: (p: Record<string, unknown>) => unknown;
  releasePaymentRedeemer: (escrowId: string) => unknown;
  parseImpactList: (raw: unknown) => unknown[];
  requestStatusInProgress: (acceptedBid: string, worker: string) => unknown;
  escrowStatusFunded: () => unknown;
  escrowStatusWorkStarted: (slot: number) => unknown;
  escrowStatusWorkSubmitted: (slot: number, evidence: string, impacts: unknown[]) => unknown;
};

let waCache: WaDatums | null = null;

function datumsCandidates(): string[] {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return [
    path.resolve(here, '../../../scripts/work-auction-datums.mjs'),
    path.resolve(here, '../../../../scripts/work-auction-datums.mjs'),
    path.resolve(process.cwd(), 'scripts/work-auction-datums.mjs'),
    '/workspace/ultralife-protocol-patch/scripts/work-auction-datums.mjs',
  ];
}

export async function loadWorkAuctionDatums(): Promise<WaDatums> {
  if (waCache) return waCache;
  for (const p of datumsCandidates()) {
    if (fs.existsSync(p)) {
      waCache = (await import(pathToFileURL(p).href)) as WaDatums;
      return waCache;
    }
  }
  throw new Error(
    'BLOCKED: scripts/work-auction-datums.mjs not found — cannot encode work_auction datum/redeemer'
  );
}

/** Mesh Constr JSON → Lucid Constr / Data */
export function meshJsonToLucid(node: unknown): unknown {
  if (node == null) return node;
  if (Array.isArray(node)) return node.map(meshJsonToLucid);
  if (typeof node !== 'object') return node;
  const o = node as Record<string, unknown>;
  if ('int' in o) return BigInt(o.int as number | string);
  if ('bytes' in o) return String(o.bytes);
  if ('list' in o) return (o.list as unknown[]).map(meshJsonToLucid);
  if (typeof o.constructor === 'number' && Array.isArray(o.fields)) {
    return new Constr(
      o.constructor,
      (o.fields as unknown[]).map(meshJsonToLucid) as ConstructorParameters<typeof Constr>[1]
    );
  }
  return node;
}

export function toInlineDatum(meshJson: unknown): string {
  return Data.to(meshJsonToLucid(meshJson) as Data);
}

function blocked(
  action: string,
  missing: string[],
  extra: Partial<WorkAuctionBlocked> = {}
): WorkAuctionBlocked {
  const network = process.env.NETWORK || extra.network || 'preprod';
  return {
    status: 'BLOCKED',
    network,
    action,
    missing,
    can_transact: 'level != Basic',
    min_level_to_post_or_bid: 'Standard (DNA-verified)',
    no_fake_dna: true,
    no_mainnet: true,
    llm_cannot_sign: true,
    labor_loop_live: false,
    next:
      'Labor loop is NOT live until preprod bid-escrow-pay tx hashes exist. Ryan signs. LLM/MCP cannot sign. Will not invent DNA, Standard upgrades, or tx hashes.',
    ...extra,
  };
}

function unsignedResult(
  action: string,
  unsignedCbor: string,
  datum: unknown,
  redeemer: unknown
): WorkAuctionUnsigned {
  return {
    status: 'UNSIGNED',
    network: 'preprod',
    action,
    unsigned_cbor: unsignedCbor,
    datum,
    redeemer,
    llm_cannot_sign: true,
    no_fake_dna: true,
    no_mainnet: true,
    submitted_tx_hash: null,
    next_step:
      'Ryan signs this unsigned preprod tx with his wallet and submits. LLM/MCP cannot sign. No submitted tx hash until Cardano accepts it.',
  };
}

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString('hex')}`;
}

function asString(v: unknown): string {
  return v == null ? '' : String(v);
}

function asNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function slotNow(): number {
  return Math.floor(Date.now() / 1000);
}

function hashUtf8(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function parseImpacts(wa: WaDatums, raw: unknown): unknown[] {
  if (!raw) return [];
  if (Array.isArray(raw) && raw.length && typeof raw[0] === 'object') {
    return raw as unknown[];
  }
  return wa.parseImpactList(raw);
}

function networkOf(ctx: WorkAuctionCtx): string {
  return String(
    (ctx.config as { network?: string }).network || process.env.NETWORK || 'preprod'
  ).toLowerCase();
}

function contractsOf(ctx: WorkAuctionCtx): Record<string, string> {
  return ((ctx.config as { contracts?: Record<string, string> }).contracts || {}) as Record<
    string,
    string
  >;
}

function blockfrostKey(ctx: WorkAuctionCtx): string {
  return String(
    (ctx.config as { blockfrostApiKey?: string }).blockfrostApiKey ||
      process.env.BLOCKFROST_API_KEY ||
      ''
  );
}

async function lookupPnftLevel(
  ctx: WorkAuctionCtx,
  pnftId: string,
  claimed?: string
): Promise<{ level: string | null; missing?: string }> {
  if (claimed === 'Basic' || claimed === 'Ward') {
    return { level: claimed };
  }
  try {
    const pnft = await ctx.indexer.getPnft(pnftId);
    if (pnft && (pnft as { level?: string }).level) {
      return { level: String((pnft as { level: string }).level) };
    }
  } catch {
    // indexer not wired or chain lookup failed — do not assume Standard
  }
  if (claimed) {
    // Caller-supplied level is not on-chain proof. Require indexer.
    return {
      level: null,
      missing:
        'on-chain pNFT level via indexer/Blockfrost (will not trust caller-supplied level or invent Standard/DNA)',
    };
  }
  return {
    level: null,
    missing: 'on-chain pNFT level (indexer/Blockfrost). Will not assume Standard or invent DNA.',
  };
}

function collectBaseMissing(ctx: WorkAuctionCtx, action: string): string[] {
  const missing: string[] = [];
  const net = networkOf(ctx);
  if (net === 'mainnet') {
    missing.push('Refusing mainnet. Work auction MCP is preprod only.');
  }
  const key = blockfrostKey(ctx);
  if (!key || key.includes('your_blockfrost')) {
    missing.push('BLOCKFROST_API_KEY (preprod project)');
  }
  if (!ctx.lucid) {
    missing.push('Transaction builder not initialized (Lucid + preprod Blockfrost)');
  }
  const contracts = contractsOf(ctx);
  const scriptAddr = contracts.work_auction || contracts.workAuction || '';
  if (!scriptAddr || scriptAddr.includes('TODO')) {
    missing.push('work_auction script address (config.contracts.work_auction)');
  }
  const refs = (ctx.config as { referenceScripts?: Record<string, { txHash?: string }> })
    .referenceScripts;
  const ref = refs?.work_auction || refs?.workAuction;
  if (!ref?.txHash) {
    missing.push('work_auction reference script (config.referenceScripts.work_auction)');
  }
  return missing;
}

async function tryRefScript(ctx: WorkAuctionCtx, missing: string[]): Promise<UTxO | null> {
  try {
    return await ctx.getRefScriptUtxo('work_auction');
  } catch (err) {
    missing.push(
      `work_auction reference script UTxO: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

async function tryFactoryUtxo(
  ctx: WorkAuctionCtx,
  missing: string[]
): Promise<UTxO | null> {
  if (!ctx.lucid) return null;
  const addr = contractsOf(ctx).work_auction || contractsOf(ctx).workAuction;
  if (!addr) return null;
  try {
    const utxos = await ctx.lucid.utxosAt(addr);
    if (!utxos.length) {
      missing.push(
        'work_auction factory UTxO missing — Ryan must bootstrap a 2 ADA UTxO at the work_auction script address'
      );
      return null;
    }
    return utxos[0];
  } catch (err) {
    missing.push(
      `work_auction script UTxOs: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

async function tryPnftUtxo(
  ctx: WorkAuctionCtx,
  pnftId: string,
  missing: string[]
): Promise<UTxO | null> {
  try {
    const u = await ctx.findPnftUtxo(pnftId);
    if (!u) {
      missing.push(
        `pNFT UTxO for ${pnftId} (mint Basic then upgrade via genesis FounderSelfVerify with real DNA — Ryan-signed. Will not invent DNA.)`
      );
      return null;
    }
    return u;
  } catch (err) {
    missing.push(
      `pNFT UTxO lookup: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

async function findScriptUtxoByOutRef(
  ctx: WorkAuctionCtx,
  ref: { txHash?: string; outputIndex?: number } | undefined,
  label: string,
  missing: string[]
): Promise<UTxO | null> {
  if (!ref?.txHash) {
    missing.push(`${label} out_ref (tx_hash + output_index of the on-chain UTxO)`);
    return null;
  }
  if (!ctx.lucid) return null;
  try {
    const utxos = await ctx.lucid.utxosByOutRef([
      { txHash: ref.txHash, outputIndex: ref.outputIndex ?? 0 },
    ]);
    if (!utxos.length) {
      missing.push(`${label} UTxO not found on preprod: ${ref.txHash}#${ref.outputIndex ?? 0}`);
      return null;
    }
    return utxos[0];
  } catch (err) {
    missing.push(
      `${label} UTxO fetch: ${err instanceof Error ? err.message : String(err)}`
    );
    return null;
  }
}

function outRefFromArgs(
  args: Record<string, unknown>,
  prefix: string
): { txHash: string; outputIndex: number } | undefined {
  const nested = args[`${prefix}_ref`] as
    | { tx_hash?: string; txHash?: string; output_index?: number; outputIndex?: number }
    | undefined;
  const txHash =
    asString(args[`${prefix}_tx_hash`] || args[`${prefix}TxHash`] || nested?.tx_hash || nested?.txHash);
  if (!txHash) return undefined;
  const outputIndex = asNum(
    args[`${prefix}_output_index`] ?? args[`${prefix}OutputIndex`] ?? nested?.output_index ?? nested?.outputIndex,
    0
  );
  return { txHash, outputIndex };
}

async function completeUnsigned(
  ctx: WorkAuctionCtx,
  build: (lucid: Lucid) => Promise<{ toString: () => string }>
): Promise<{ cbor?: string; error?: string }> {
  if (!ctx.lucid) return { error: 'Lucid not initialized' };
  try {
    const tx = await build(ctx.lucid);
    const cbor = tx.toString();
    if (!cbor || cbor.length < 16) {
      return { error: 'Lucid produced empty CBOR — not treating as a real unsigned tx' };
    }
    return { cbor };
  } catch (err) {
    return {
      error: `unsigned complete() failed: ${err instanceof Error ? err.message : String(err)} (need change address, collateral UTxO, Ryan wallet selected — LLM cannot sign)`,
    };
  }
}

export async function buildWorkAuction(
  ctx: WorkAuctionCtx,
  action: WorkAuctionAction,
  args: Record<string, unknown>
): Promise<WorkAuctionBuildResult> {
  const missing = collectBaseMissing(ctx, action);
  if (networkOf(ctx) === 'mainnet') {
    return blocked(action, missing);
  }

  let wa: WaDatums;
  try {
    wa = await loadWorkAuctionDatums();
  } catch (err) {
    missing.push(err instanceof Error ? err.message : String(err));
    return blocked(action, missing);
  }

  switch (action) {
    case 'post_job':
      return buildPostJob(ctx, wa, args, missing);
    case 'bid':
      return buildBid(ctx, wa, args, missing);
    case 'complete':
      return buildComplete(ctx, wa, args, missing);
    case 'accept_bid':
      return buildAcceptBid(ctx, wa, args, missing);
    case 'submit_work':
      return buildSubmitWork(ctx, wa, args, missing);
    case 'release_payment':
      return buildReleasePayment(ctx, wa, args, missing);
    default:
      return blocked(String(action), [`Unknown work-auction action: ${action}`]);
  }
}

async function buildPostJob(
  ctx: WorkAuctionCtx,
  wa: WaDatums,
  args: Record<string, unknown>,
  missing: string[]
): Promise<WorkAuctionBuildResult> {
  const pnftId = asString(args.requester_pnft || args.pnft_id || args.offerer_pnft);
  if (!pnftId) missing.push('requester_pnft');

  const { level, missing: levelMissing } = await lookupPnftLevel(
    ctx,
    pnftId,
    asString(args.pnft_level || args.level) || undefined
  );
  if (levelMissing) missing.push(levelMissing);
  const gate = wa.laborGateError(level);
  if (gate) missing.push(gate);

  const description = asString(args.description || args.desc || args.specifications);
  if (!description) missing.push('description / specifications_hash');

  const impacts = parseImpacts(wa, args.expected_impacts || args.impacts);
  if (!impacts.length) {
    missing.push(
      'expected_impacts (validator requires >=1 compound flow; will not invent CO2)'
    );
  }

  const budgetMin = asNum(args.budget_min ?? args.budgetMin, 0);
  const budgetMax = asNum(args.budget_max ?? args.budgetMax, 0);
  if (!(budgetMin > 0) || budgetMax < budgetMin) {
    missing.push('budget_min > 0 and budget_max >= budget_min');
  }

  const workType = asString(args.work_type || args.workType || 'services');
  const workSubtype = asString(args.work_subtype || args.phase || args.workSubtype || workType);
  const minWorkerLevel = asString(args.min_worker_level || args.minWorkerLevel || 'Standard');
  if (minWorkerLevel === 'Basic') {
    missing.push('min_worker_level cannot be Basic (labor loop minimum is Standard)');
  }

  const slot = slotNow();
  const bidDeadline = asNum(args.bid_deadline, slot + asNum(args.bid_deadline_days, 7) * 86400);
  const workDeadline = asNum(args.work_deadline, slot + asNum(args.work_deadline_days, 30) * 86400);
  if (!(bidDeadline > slot) || !(workDeadline > bidDeadline)) {
    missing.push('bid_deadline in the future and work_deadline > bid_deadline');
  }

  const requestId = asString(args.request_id) || newId('job');
  const specsHash = asString(args.specifications_hash) || hashUtf8(description);
  const certs = Array.isArray(args.required_certifications)
    ? (args.required_certifications as string[])
    : asString(args.skills)
      ? asString(args.skills)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

  const datumParams = {
    requestId,
    requester: pnftId,
    asset: asString(args.asset),
    bioregion: asString(args.bioregion),
    workType,
    workSubtype,
    specificationsHash: specsHash,
    expectedImpacts: impacts,
    budgetMin,
    budgetMax,
    requiredCertifications: certs,
    minWorkerLevel,
    bidDeadline,
    workDeadline,
    createdAt: slot,
  };
  const datum = wa.requestDatum(datumParams);
  const redeemer = wa.createRequestRedeemer({
    workType,
    workSubtype,
    specificationsHash: specsHash,
    expectedImpacts: impacts,
    budgetMin,
    budgetMax,
    requiredCertifications: certs,
    bidDeadline,
    workDeadline,
    contentToShare: args.content_to_share || [],
    expectedDeliverables: args.expected_deliverables || [],
  });

  const ref = await tryRefScript(ctx, missing);
  const factory = await tryFactoryUtxo(ctx, missing);
  if (pnftId) await tryPnftUtxo(ctx, pnftId, missing);

  if (missing.length) {
    return blocked('post_job / CreateRequest', missing, { would_build: { datum, redeemer } });
  }

  const built = await completeUnsigned(ctx, async (lucid) => {
    const inline = toInlineDatum(datum);
    const rdmr = toInlineDatum(redeemer);
    const scriptAddr = contractsOf(ctx).work_auction;
    let tx = lucid.newTx().readFrom([ref!]);
    if (factory) {
      tx = tx.collectFrom([factory], rdmr);
    }
    return tx
      .payToContract(scriptAddr, { inline }, { lovelace: 2_000_000n })
      .complete();
  });

  if (built.error || !built.cbor) {
    return blocked('post_job / CreateRequest', [...missing, built.error || 'no CBOR'], {
      would_build: { datum, redeemer },
    });
  }
  return unsignedResult('CreateRequest', built.cbor, datum, redeemer);
}

async function buildBid(
  ctx: WorkAuctionCtx,
  wa: WaDatums,
  args: Record<string, unknown>,
  missing: string[]
): Promise<WorkAuctionBuildResult> {
  const pnftId = asString(args.bidder_pnft || args.pnft_id);
  if (!pnftId) missing.push('bidder_pnft');

  const { level, missing: levelMissing } = await lookupPnftLevel(
    ctx,
    pnftId,
    asString(args.pnft_level || args.level) || undefined
  );
  if (levelMissing) missing.push(levelMissing);
  const gate = wa.laborGateError(level);
  if (gate) missing.push(gate);

  const requestId = asString(args.request_id || args.job_id);
  if (!requestId) missing.push('request_id');

  const bidAmount = asNum(args.bid_amount ?? args.amount, 0);
  if (!(bidAmount > 0)) missing.push('bid_amount > 0');

  const impacts = parseImpacts(wa, args.estimated_impacts || args.impacts);
  if (!impacts.length) {
    missing.push(
      'estimated_impacts (validator requires >=1 compound flow; will not invent CO2)'
    );
  }

  const requestRef = outRefFromArgs(args, 'request');
  await findScriptUtxoByOutRef(ctx, requestRef, 'request (Open work request)', missing);

  const slot = slotNow();
  const proposedCompletion = asNum(
    args.proposed_completion,
    slot + asNum(args.timeline_days || args.timeline, 14) * 86400
  );
  const bidId = asString(args.bid_id) || newId('bid');

  const datum = wa.bidDatum({
    bidId,
    requestId,
    bidder: pnftId,
    bidAmount,
    estimatedImpacts: impacts,
    certifications: Array.isArray(args.certifications) ? args.certifications : [],
    proposedCompletion,
    methodsHash: asString(args.methods_hash || args.methods),
    submittedAt: slot,
  });
  const redeemer = wa.submitBidRedeemer({
    requestId,
    bidAmount,
    estimatedImpacts: impacts,
    proposedCompletion,
    methodsHash: asString(args.methods_hash || args.methods),
  });

  const ref = await tryRefScript(ctx, missing);
  const factory = await tryFactoryUtxo(ctx, missing);
  if (pnftId) await tryPnftUtxo(ctx, pnftId, missing);

  if (missing.length) {
    return blocked('bid / SubmitBid', missing, { would_build: { datum, redeemer } });
  }

  const built = await completeUnsigned(ctx, async (lucid) => {
    const inline = toInlineDatum(datum);
    const rdmr = toInlineDatum(redeemer);
    const scriptAddr = contractsOf(ctx).work_auction;
    let tx = lucid.newTx().readFrom([ref!]);
    if (requestRef?.txHash) {
      const reqUtxos = await lucid.utxosByOutRef([
        { txHash: requestRef.txHash, outputIndex: requestRef.outputIndex },
      ]);
      if (reqUtxos[0]) tx = tx.readFrom(reqUtxos);
    }
    if (factory) tx = tx.collectFrom([factory], rdmr);
    return tx
      .payToContract(scriptAddr, { inline }, { lovelace: 2_000_000n })
      .complete();
  });

  if (built.error || !built.cbor) {
    return blocked('bid / SubmitBid', [...missing, built.error || 'no CBOR'], {
      would_build: { datum, redeemer },
    });
  }
  return unsignedResult('SubmitBid', built.cbor, datum, redeemer);
}

async function buildAcceptBid(
  ctx: WorkAuctionCtx,
  wa: WaDatums,
  args: Record<string, unknown>,
  missing: string[]
): Promise<WorkAuctionBuildResult> {
  const pnftId = asString(args.requester_pnft || args.pnft_id);
  if (!pnftId) missing.push('requester_pnft');

  const { level, missing: levelMissing } = await lookupPnftLevel(
    ctx,
    pnftId,
    asString(args.pnft_level || args.level) || undefined
  );
  if (levelMissing) missing.push(levelMissing);
  const gate = wa.laborGateError(level);
  if (gate) missing.push(gate);

  const bidId = asString(args.bid_id);
  const requestId = asString(args.request_id || args.job_id);
  const worker = asString(args.worker_pnft || args.worker);
  const amount = asNum(args.amount ?? args.bid_amount, 0);
  if (!bidId) missing.push('bid_id');
  if (!requestId) missing.push('request_id');
  if (!worker) missing.push('worker_pnft');
  if (!(amount > 0)) missing.push('amount (escrow tokens from accepted bid)');

  const tokenPolicy = contractsOf(ctx).token_policy || '';
  const tokenName = (ctx.config as { tokenName?: string }).tokenName || '';
  if (!tokenPolicy || tokenPolicy.includes('TODO')) {
    missing.push('token_policy (escrow funds — will not fake a payment asset)');
  }

  const requestRef = outRefFromArgs(args, 'request');
  const bidRef = outRefFromArgs(args, 'bid');
  await findScriptUtxoByOutRef(ctx, requestRef, 'request (Open, requester-owned)', missing);
  await findScriptUtxoByOutRef(ctx, bidRef, 'bid (Pending)', missing);

  const impacts = parseImpacts(wa, args.expected_impacts || args.estimated_impacts || args.impacts);
  if (!impacts.length) {
    missing.push(
      'expected_impacts for escrow (from accepted bid; will not invent compound flows)'
    );
  }

  const escrowId = asString(args.escrow_id) || newId('escrow');
  const workType = asString(args.work_type || 'services');
  const workSubtype = asString(args.work_subtype || args.phase || workType);
  const deadline = asNum(args.deadline || args.work_deadline, slotNow() + 30 * 86400);

  const datum = wa.escrowDatum({
    escrowId,
    requestId,
    bidId,
    requester: pnftId,
    worker,
    asset: asString(args.asset),
    workType,
    workSubtype,
    amount,
    expectedImpacts: impacts,
    deadline,
    statusConstr: wa.escrowStatusFunded(),
  });
  const redeemer = wa.acceptBidRedeemer(
    bidId,
    args.access_duration_hours == null ? null : asNum(args.access_duration_hours)
  );

  const ref = await tryRefScript(ctx, missing);
  if (pnftId) await tryPnftUtxo(ctx, pnftId, missing);

  if (missing.length) {
    return blocked('accept_bid / AcceptBid', missing, { would_build: { datum, redeemer } });
  }

  const built = await completeUnsigned(ctx, async (lucid) => {
    const inline = toInlineDatum(datum);
    const rdmr = toInlineDatum(redeemer);
    const scriptAddr = contractsOf(ctx).work_auction;
    const unit = tokenPolicy + tokenName;
    const requestUtxo = (
      await lucid.utxosByOutRef([
        { txHash: requestRef!.txHash, outputIndex: requestRef!.outputIndex },
      ])
    )[0];
    let tx = lucid
      .newTx()
      .readFrom([ref!])
      .collectFrom([requestUtxo], rdmr)
      .payToContract(
        scriptAddr,
        { inline },
        { [unit]: BigInt(amount), lovelace: 2_000_000n }
      );
    if (bidRef?.txHash) {
      const bidUtxos = await lucid.utxosByOutRef([
        { txHash: bidRef.txHash, outputIndex: bidRef.outputIndex },
      ]);
      if (bidUtxos[0]) tx = tx.readFrom(bidUtxos);
    }
    return tx.complete();
  });

  if (built.error || !built.cbor) {
    return blocked('accept_bid / AcceptBid', [...missing, built.error || 'no CBOR'], {
      would_build: { datum, redeemer },
    });
  }
  return unsignedResult('AcceptBid', built.cbor, datum, redeemer);
}

/** complete = StartWork (Funded → WorkStarted). Distinct from submit_work. */
async function buildComplete(
  ctx: WorkAuctionCtx,
  wa: WaDatums,
  args: Record<string, unknown>,
  missing: string[]
): Promise<WorkAuctionBuildResult> {
  const pnftId = asString(args.worker_pnft || args.pnft_id);
  if (!pnftId) missing.push('worker_pnft');

  const { level, missing: levelMissing } = await lookupPnftLevel(
    ctx,
    pnftId,
    asString(args.pnft_level || args.level) || undefined
  );
  if (levelMissing) missing.push(levelMissing);
  const gate = wa.laborGateError(level);
  if (gate) missing.push(gate);

  const escrowId = asString(args.escrow_id);
  if (!escrowId) missing.push('escrow_id');

  const escrowRef = outRefFromArgs(args, 'escrow');
  await findScriptUtxoByOutRef(ctx, escrowRef, 'escrow (Funded)', missing);

  const requestId = asString(args.request_id || args.job_id);
  const bidId = asString(args.bid_id);
  const requester = asString(args.requester_pnft || args.requester);
  const amount = asNum(args.amount, 0);
  const workType = asString(args.work_type || 'services');
  const workSubtype = asString(args.work_subtype || args.phase || workType);
  const slot = slotNow();

  const datum = wa.escrowDatum({
    escrowId,
    requestId,
    bidId,
    requester,
    worker: pnftId,
    asset: asString(args.asset),
    workType,
    workSubtype,
    amount,
    expectedImpacts: parseImpacts(wa, args.expected_impacts || args.impacts),
    deadline: asNum(args.deadline, slot + 30 * 86400),
    statusConstr: wa.escrowStatusWorkStarted(slot),
  });
  const redeemer = wa.startWorkRedeemer(escrowId);

  const ref = await tryRefScript(ctx, missing);
  if (pnftId) await tryPnftUtxo(ctx, pnftId, missing);

  if (missing.length) {
    return blocked('complete / StartWork', missing, { would_build: { datum, redeemer } });
  }

  const built = await completeUnsigned(ctx, async (lucid) => {
    const inline = toInlineDatum(datum);
    const rdmr = toInlineDatum(redeemer);
    const scriptAddr = contractsOf(ctx).work_auction;
    const escrowUtxo = (
      await lucid.utxosByOutRef([
        { txHash: escrowRef!.txHash, outputIndex: escrowRef!.outputIndex },
      ])
    )[0];
    return lucid
      .newTx()
      .readFrom([ref!])
      .collectFrom([escrowUtxo], rdmr)
      .payToContract(scriptAddr, { inline }, escrowUtxo.assets)
      .complete();
  });

  if (built.error || !built.cbor) {
    return blocked('complete / StartWork', [...missing, built.error || 'no CBOR'], {
      would_build: { datum, redeemer },
    });
  }
  return unsignedResult('StartWork', built.cbor, datum, redeemer);
}

async function buildSubmitWork(
  ctx: WorkAuctionCtx,
  wa: WaDatums,
  args: Record<string, unknown>,
  missing: string[]
): Promise<WorkAuctionBuildResult> {
  const pnftId = asString(args.worker_pnft || args.pnft_id);
  if (!pnftId) missing.push('worker_pnft');

  const { level, missing: levelMissing } = await lookupPnftLevel(
    ctx,
    pnftId,
    asString(args.pnft_level || args.level) || undefined
  );
  if (levelMissing) missing.push(levelMissing);
  const gate = wa.laborGateError(level);
  if (gate) missing.push(gate);

  const escrowId = asString(args.escrow_id);
  if (!escrowId) missing.push('escrow_id');

  const evidenceHash = asString(args.evidence_hash || args.evidence);
  if (!evidenceHash) {
    missing.push('evidence_hash (will not invent evidence)');
  }

  const impacts = parseImpacts(wa, args.actual_impacts || args.impacts);
  if (!impacts.length) {
    missing.push('actual_impacts (validator requires >=1; will not invent CO2)');
  }

  const escrowRef = outRefFromArgs(args, 'escrow');
  await findScriptUtxoByOutRef(ctx, escrowRef, 'escrow (WorkStarted)', missing);

  const slot = slotNow();
  const datum = wa.escrowDatum({
    escrowId,
    requestId: asString(args.request_id || args.job_id),
    bidId: asString(args.bid_id),
    requester: asString(args.requester_pnft || args.requester),
    worker: pnftId,
    asset: asString(args.asset),
    workType: asString(args.work_type || 'services'),
    workSubtype: asString(args.work_subtype || args.phase || 'services'),
    amount: asNum(args.amount, 0),
    expectedImpacts: impacts,
    deadline: asNum(args.deadline, slot + 30 * 86400),
    statusConstr: wa.escrowStatusWorkSubmitted(slot, evidenceHash, impacts as never[]),
  });
  const redeemer = wa.submitWorkRedeemer({
    escrowId,
    evidenceHash,
    actualImpacts: impacts,
  });

  const ref = await tryRefScript(ctx, missing);
  if (pnftId) await tryPnftUtxo(ctx, pnftId, missing);

  if (missing.length) {
    return blocked('submit_work / SubmitWork', missing, { would_build: { datum, redeemer } });
  }

  const built = await completeUnsigned(ctx, async (lucid) => {
    const inline = toInlineDatum(datum);
    const rdmr = toInlineDatum(redeemer);
    const scriptAddr = contractsOf(ctx).work_auction;
    const escrowUtxo = (
      await lucid.utxosByOutRef([
        { txHash: escrowRef!.txHash, outputIndex: escrowRef!.outputIndex },
      ])
    )[0];
    return lucid
      .newTx()
      .readFrom([ref!])
      .collectFrom([escrowUtxo], rdmr)
      .payToContract(scriptAddr, { inline }, escrowUtxo.assets)
      .complete();
  });

  if (built.error || !built.cbor) {
    return blocked('submit_work / SubmitWork', [...missing, built.error || 'no CBOR'], {
      would_build: { datum, redeemer },
    });
  }
  return unsignedResult('SubmitWork', built.cbor, datum, redeemer);
}

async function buildReleasePayment(
  ctx: WorkAuctionCtx,
  wa: WaDatums,
  args: Record<string, unknown>,
  missing: string[]
): Promise<WorkAuctionBuildResult> {
  const pnftId = asString(args.requester_pnft || args.pnft_id);
  if (!pnftId) missing.push('requester_pnft');

  const { level, missing: levelMissing } = await lookupPnftLevel(
    ctx,
    pnftId,
    asString(args.pnft_level || args.level) || undefined
  );
  if (levelMissing) missing.push(levelMissing);
  const gate = wa.laborGateError(level);
  if (gate) missing.push(gate);

  const escrowId = asString(args.escrow_id);
  if (!escrowId) missing.push('escrow_id');

  const workerAddress = asString(args.worker_address);
  if (!workerAddress) {
    missing.push('worker_address (payment output; will not invent a wallet)');
  }

  const amount = asNum(args.amount, 0);
  if (!(amount > 0)) missing.push('amount (verified escrow tokens)');

  const tokenPolicy = contractsOf(ctx).token_policy || '';
  const tokenName = (ctx.config as { tokenName?: string }).tokenName || '';
  if (!tokenPolicy || tokenPolicy.includes('TODO')) {
    missing.push('token_policy (will not fake a payment asset)');
  }

  // Validator requires Verified status. Do not skip VerifyWork.
  if (asString(args.escrow_status) !== 'Verified' && args.verified !== true) {
    missing.push(
      'escrow Verified status (VerifyWork must already be on-chain; will not skip verification or fake it)'
    );
  }

  const escrowRef = outRefFromArgs(args, 'escrow');
  await findScriptUtxoByOutRef(ctx, escrowRef, 'escrow (Verified)', missing);

  const redeemer = wa.releasePaymentRedeemer(escrowId);
  const datum = wa.escrowDatum({
    escrowId,
    requestId: asString(args.request_id || args.job_id),
    bidId: asString(args.bid_id),
    requester: pnftId,
    worker: asString(args.worker_pnft || args.worker),
    asset: asString(args.asset),
    workType: asString(args.work_type || 'services'),
    workSubtype: asString(args.work_subtype || 'services'),
    amount,
    expectedImpacts: parseImpacts(wa, args.expected_impacts || args.impacts),
    deadline: asNum(args.deadline, slotNow()),
  });

  const ref = await tryRefScript(ctx, missing);
  if (pnftId) await tryPnftUtxo(ctx, pnftId, missing);

  if (missing.length) {
    return blocked('release_payment / ReleasePayment', missing, {
      would_build: { datum, redeemer },
    });
  }

  const built = await completeUnsigned(ctx, async (lucid) => {
    const rdmr = toInlineDatum(redeemer);
    const escrowUtxo = (
      await lucid.utxosByOutRef([
        { txHash: escrowRef!.txHash, outputIndex: escrowRef!.outputIndex },
      ])
    )[0];
    const feeBps = 100n;
    const fee = (BigInt(amount) * feeBps) / 10000n;
    const workerPayment = BigInt(amount) - fee;
    const unit = tokenPolicy + tokenName;
    const treasury = contractsOf(ctx).treasury;
    let tx = lucid
      .newTx()
      .readFrom([ref!])
      .collectFrom([escrowUtxo], rdmr)
      .payToAddress(workerAddress, { [unit]: workerPayment });
    if (treasury && fee > 0n) {
      tx = tx.payToAddress(treasury, { [unit]: fee });
    }
    return tx.complete();
  });

  if (built.error || !built.cbor) {
    return blocked('release_payment / ReleasePayment', [...missing, built.error || 'no CBOR'], {
      would_build: { datum, redeemer },
    });
  }
  return unsignedResult('ReleasePayment', built.cbor, datum, redeemer);
}
