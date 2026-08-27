/**
 * UltraLife work_auction datum/redeemer Constr JSON (TypeScript).
 * Aligned with validators/work_auction.ak + scripts/work-auction-datums.mjs.
 * Mesh: txOutInlineDatumValue(obj, 'JSON') / txInRedeemerValue(obj, 'JSON').
 *
 * Do not invent DNA hashes, Standard upgrades, wallets, or ratings.
 */

export type PlutusJson =
  | { constructor: number; fields: PlutusJson[] }
  | { int: number }
  | { bytes: string }
  | { list: PlutusJson[] };

export const VERIFICATION_LEVEL: Record<string, number> = {
  Basic: 0,
  Ward: 1,
  Standard: 2,
  Verified: 3,
  Steward: 4,
};

export const LEVEL_NAMES = ['Basic', 'Ward', 'Standard', 'Verified', 'Steward'] as const;
export type LevelName = (typeof LEVEL_NAMES)[number];

/** types.ak can_transact: level != Basic */
export function canTransact(level: string | null | undefined): boolean {
  return Boolean(level) && level !== 'Basic';
}

/**
 * Labor-loop policy: Standard is the documented minimum (DNA-verified).
 * Ward is can_transact=true on-chain but requires guardian co-sig — not used here.
 */
export function meetsLaborMinimum(level: string | null | undefined): boolean {
  return level === 'Standard' || level === 'Verified' || level === 'Steward';
}

export function votingWeight(level: string | null | undefined): number {
  switch (level) {
    case 'Verified': return 2;
    case 'Steward': return 3;
    case 'Standard': return 1;
    default: return 0;
  }
}

export function meetsLevelRequirement(actual: string | null | undefined, required: string | null | undefined): boolean {
  return votingWeight(actual) >= votingWeight(required);
}

export function laborGateError(level: string | null | undefined): string | null {
  if (!level) {
    return 'No on-chain pNFT level. Cannot post or bid.';
  }
  if (!canTransact(level)) {
    return `can_transact: Basic cannot post or bid. Minimum level: Standard (DNA-verified). On-chain level: ${level}.`;
  }
  if (!meetsLaborMinimum(level)) {
    return `Labor loop minimum is Standard (DNA-verified). Ward requires guardian co-signature and is not a poster/bidder here. On-chain level: ${level}.`;
  }
  return null;
}

export const WORK_TYPE_INDEX: Record<string, number> = {
  construction: 0,
  agriculture: 1,
  forestry: 2,
  manufacturing: 3,
  transport: 4,
  services: 5,
  maintenance: 6,
  survey: 7,
  custom: 8,
};

export const CONSTRUCTION_PHASE: Record<string, number> = {
  site_prep: 0, foundation: 1, framing: 2, roofing: 3,
  electrical: 4, plumbing: 5, finishing: 6, landscaping: 7,
};

export const AGRICULTURE_ACTIVITY: Record<string, number> = {
  planting: 0, cultivation: 1, harvesting: 2, irrigation: 3, soil_management: 4,
};

export const FORESTRY_ACTIVITY: Record<string, number> = {
  tree_planting: 0, selective_harvest: 1, forest_management: 2,
  fire_prevention: 3, restoration: 4,
};

export const MASS_UNIT: Record<string, number> = { grams: 0, kilograms: 1, liters: 2, moles: 3 };

export const REQUEST_STATUS = {
  Open: 0, InProgress: 1, PendingVerification: 2,
  Completed: 3, Cancelled: 4, Disputed: 5,
};

export const BID_STATUS = { Pending: 0, Accepted: 1, BidRejected: 2, Withdrawn: 3 };

export const ESCROW_STATUS = {
  Funded: 0, WorkStarted: 1, WorkSubmitted: 2, Verified: 3,
  Released: 4, Refunded: 5, InDispute: 6,
};

/** WorkAuctionDatum constructors */
export const DATUM_TAG = { RequestDatum: 0, BidDatum: 1, EscrowDatum: 2 };

/** WorkAuctionRedeemer constructors — declaration order in work_auction.ak */
export const REDEEMER = {
  CreateRequest: 0,
  CancelRequest: 1,
  UpdateRequest: 2,
  SubmitBid: 3,
  WithdrawBid: 4,
  AcceptBid: 5,
  RejectBid: 6,
  StartWork: 7,
  SubmitWork: 8,
  VerifyWork: 9,
  ReleasePayment: 10,
  RequestRefund: 11,
  InitiateDispute: 12,
  ResolveDispute: 13,
};

export function textBytes(str: string | null | undefined): PlutusJson {
  return { bytes: Buffer.from(String(str ?? ''), 'utf8').toString('hex') };
}

export function hexBytes(hex: string | null | undefined): PlutusJson {
  const h = String(hex || '').replace(/^0x/, '');
  if (h && !/^[0-9a-fA-F]*$/.test(h)) {
    return textBytes(hex);
  }
  return { bytes: h };
}

export function unitConstr(index: number): PlutusJson {
  return { constructor: index, fields: [] };
}

export function someOf(value: PlutusJson): PlutusJson {
  return { constructor: 0, fields: [value] };
}

export function noneOf(): PlutusJson {
  return { constructor: 1, fields: [] };
}

export function levelConstr(levelName: string): PlutusJson {
  const idx = VERIFICATION_LEVEL[levelName];
  if (idx === undefined) {
    throw new Error(`Unknown verification level: ${levelName}`);
  }
  return unitConstr(idx);
}

export function massUnitConstr(unitName = 'kilograms'): PlutusJson {
  const idx = MASS_UNIT[String(unitName).toLowerCase()] ?? MASS_UNIT.kilograms;
  return unitConstr(idx);
}

export function workTypeConstr(typeName: string | null | undefined, subtype?: string | null): PlutusJson {
  const t = String(typeName || 'services').toLowerCase();
  const idx = WORK_TYPE_INDEX[t];
  if (idx === undefined) {
    throw new Error(`Unknown work type: ${typeName}`);
  }
  if (t === 'construction') {
    const p = CONSTRUCTION_PHASE[String(subtype || 'site_prep').toLowerCase()] ?? 0;
    return { constructor: idx, fields: [unitConstr(p)] };
  }
  if (t === 'agriculture') {
    const p = AGRICULTURE_ACTIVITY[String(subtype || 'planting').toLowerCase()] ?? 0;
    return { constructor: idx, fields: [unitConstr(p)] };
  }
  if (t === 'forestry') {
    const p = FORESTRY_ACTIVITY[String(subtype || 'tree_planting').toLowerCase()] ?? 0;
    return { constructor: idx, fields: [unitConstr(p)] };
  }
  return { constructor: idx, fields: [textBytes(subtype || t)] };
}

export interface ExpectedCompoundInput {
  compound: string;
  expected_quantity?: number;
  quantity?: number;
  acceptable_min?: number;
  acceptable_max?: number;
  unit?: string;
}

/** ExpectedCompound { compound, expected_quantity, acceptable_min, acceptable_max, unit } */
export function expectedCompoundConstr(impact: ExpectedCompoundInput): PlutusJson {
  const n = Number(impact.expected_quantity ?? impact.quantity);
  return {
    constructor: 0,
    fields: [
      textBytes(impact.compound),
      { int: n },
      { int: Number(impact.acceptable_min ?? n) },
      { int: Number(impact.acceptable_max ?? n) },
      massUnitConstr(impact.unit),
    ],
  };
}

/** MeasurementMethod.Estimated { reference, similarity } — honest default when not surveyed. */
export function measurementEstimated(reference = 'job_estimate', similarity = 50): PlutusJson {
  return {
    constructor: 2,
    fields: [textBytes(reference), { int: similarity }],
  };
}

export interface CompoundFlowInput {
  compound: string;
  quantity?: number;
  expected_quantity?: number;
  unit?: string;
  measurement?: PlutusJson;
  reference?: string;
  similarity?: number;
  confidence?: number;
}

/** CompoundFlow { compound, quantity, unit, measurement, confidence } */
export function compoundFlowConstr(flow: CompoundFlowInput): PlutusJson {
  return {
    constructor: 0,
    fields: [
      textBytes(flow.compound),
      { int: Number(flow.quantity ?? flow.expected_quantity) },
      massUnitConstr(flow.unit),
      flow.measurement || measurementEstimated(flow.reference || 'bid_estimate', flow.similarity ?? 50),
      { int: Number(flow.confidence ?? 50) },
    ],
  };
}

export function requestStatusOpen(): PlutusJson {
  return unitConstr(REQUEST_STATUS.Open);
}

export function requestStatusInProgress(acceptedBid: string, worker: string): PlutusJson {
  return {
    constructor: REQUEST_STATUS.InProgress,
    fields: [textBytes(acceptedBid), textBytes(worker)],
  };
}

export function bidStatusPending(): PlutusJson {
  return unitConstr(BID_STATUS.Pending);
}

export function bidStatusAccepted(): PlutusJson {
  return unitConstr(BID_STATUS.Accepted);
}

export function escrowStatusFunded(): PlutusJson {
  return unitConstr(ESCROW_STATUS.Funded);
}

export function escrowStatusWorkStarted(startSlot: number): PlutusJson {
  return {
    constructor: ESCROW_STATUS.WorkStarted,
    fields: [{ int: Number(startSlot) }],
  };
}

export function escrowStatusWorkSubmitted(
  submissionSlot: number,
  evidenceHash: string,
  actualImpacts: CompoundFlowInput[],
): PlutusJson {
  return {
    constructor: ESCROW_STATUS.WorkSubmitted,
    fields: [
      { int: Number(submissionSlot) },
      hexBytes(evidenceHash),
      { list: (actualImpacts || []).map(compoundFlowConstr) },
    ],
  };
}

export function escrowStatusVerified(verifier: string, verificationSlot: number): PlutusJson {
  return {
    constructor: ESCROW_STATUS.Verified,
    fields: [textBytes(verifier), { int: Number(verificationSlot) }],
  };
}

export function escrowStatusReleased(releaseSlot: number): PlutusJson {
  return {
    constructor: ESCROW_STATUS.Released,
    fields: [{ int: Number(releaseSlot) }],
  };
}

export interface WorkRequestParams {
  requestId: string;
  requester: string;
  asset?: string;
  bioregion?: string;
  workType?: string;
  workSubtype?: string;
  specificationsHash?: string;
  expectedImpacts?: ExpectedCompoundInput[];
  budgetMin: number;
  budgetMax: number;
  requiredCertifications?: string[];
  minWorkerLevel?: string;
  bidDeadline: number;
  workDeadline: number;
  createdAt: number;
  statusConstr?: PlutusJson;
}

/** WorkRequest fields in declaration order. */
export function workRequestFields(p: WorkRequestParams): PlutusJson[] {
  return [
    textBytes(p.requestId),
    textBytes(p.requester),
    textBytes(p.asset || ''),
    textBytes(p.bioregion || ''),
    workTypeConstr(p.workType, p.workSubtype),
    hexBytes(p.specificationsHash || ''),
    { list: (p.expectedImpacts || []).map(expectedCompoundConstr) },
    { int: Number(p.budgetMin) },
    { int: Number(p.budgetMax) },
    { list: (p.requiredCertifications || []).map(textBytes) },
    levelConstr(p.minWorkerLevel || 'Standard'),
    { int: Number(p.bidDeadline) },
    { int: Number(p.workDeadline) },
    { int: Number(p.createdAt) },
    p.statusConstr || requestStatusOpen(),
  ];
}

export function requestDatum(p: WorkRequestParams): PlutusJson {
  return {
    constructor: DATUM_TAG.RequestDatum,
    fields: [{
      constructor: 0,
      fields: workRequestFields(p),
    }],
  };
}

export interface WorkBidParams {
  bidId: string;
  requestId: string;
  bidder: string;
  bidAmount: number;
  estimatedImpacts?: CompoundFlowInput[];
  certifications?: string[];
  proposedCompletion: number;
  methodsHash?: string;
  submittedAt: number;
  statusConstr?: PlutusJson;
}

export function workBidFields(p: WorkBidParams): PlutusJson[] {
  return [
    textBytes(p.bidId),
    textBytes(p.requestId),
    textBytes(p.bidder),
    { int: Number(p.bidAmount) },
    { list: (p.estimatedImpacts || []).map(compoundFlowConstr) },
    { list: (p.certifications || []).map(textBytes) },
    { list: [] }, // efficiency_ratings: never invented
    { int: Number(p.proposedCompletion) },
    hexBytes(p.methodsHash || ''),
    { int: Number(p.submittedAt) },
    p.statusConstr || bidStatusPending(),
  ];
}

export function bidDatum(p: WorkBidParams): PlutusJson {
  return {
    constructor: DATUM_TAG.BidDatum,
    fields: [{
      constructor: 0,
      fields: workBidFields(p),
    }],
  };
}

export interface WorkEscrowParams {
  escrowId: string;
  requestId: string;
  bidId: string;
  requester: string;
  worker: string;
  asset?: string;
  workType?: string;
  workSubtype?: string;
  amount: number;
  expectedImpacts?: CompoundFlowInput[];
  deadline: number;
  statusConstr?: PlutusJson;
  requesterContentGrants?: string[];
  workerContentGrants?: string[];
  verificationUnlocks?: string[];
}

export function workEscrowFields(p: WorkEscrowParams): PlutusJson[] {
  return [
    textBytes(p.escrowId),
    textBytes(p.requestId),
    textBytes(p.bidId),
    textBytes(p.requester),
    textBytes(p.worker),
    textBytes(p.asset || ''),
    workTypeConstr(p.workType, p.workSubtype),
    { int: Number(p.amount) },
    { list: (p.expectedImpacts || []).map(compoundFlowConstr) },
    { int: Number(p.deadline) },
    p.statusConstr || escrowStatusFunded(),
    { list: (p.requesterContentGrants || []).map(hexBytes) },
    { list: (p.workerContentGrants || []).map(hexBytes) },
    { list: (p.verificationUnlocks || []).map(hexBytes) },
  ];
}

export function escrowDatum(p: WorkEscrowParams): PlutusJson {
  return {
    constructor: DATUM_TAG.EscrowDatum,
    fields: [{
      constructor: 0,
      fields: workEscrowFields(p),
    }],
  };
}

export interface CreateRequestRedeemerParams {
  workType?: string;
  workSubtype?: string;
  specificationsHash?: string;
  expectedImpacts?: ExpectedCompoundInput[];
  budgetMin: number;
  budgetMax: number;
  requiredCertifications?: string[];
  bidDeadline: number;
  workDeadline: number;
  contentToShare?: string[];
  expectedDeliverables?: string[];
}

export function createRequestRedeemer(p: CreateRequestRedeemerParams): PlutusJson {
  return {
    constructor: REDEEMER.CreateRequest,
    fields: [
      workTypeConstr(p.workType, p.workSubtype),
      hexBytes(p.specificationsHash || ''),
      { list: (p.expectedImpacts || []).map(expectedCompoundConstr) },
      { int: Number(p.budgetMin) },
      { int: Number(p.budgetMax) },
      { list: (p.requiredCertifications || []).map(textBytes) },
      { int: Number(p.bidDeadline) },
      { int: Number(p.workDeadline) },
      { list: (p.contentToShare || []).map(hexBytes) },
      { list: (p.expectedDeliverables || []).map(hexBytes) },
    ],
  };
}

export interface SubmitBidRedeemerParams {
  requestId: string;
  bidAmount: number;
  estimatedImpacts?: CompoundFlowInput[];
  proposedCompletion: number;
  methodsHash?: string;
}

export function submitBidRedeemer(p: SubmitBidRedeemerParams): PlutusJson {
  return {
    constructor: REDEEMER.SubmitBid,
    fields: [
      textBytes(p.requestId),
      { int: Number(p.bidAmount) },
      { list: (p.estimatedImpacts || []).map(compoundFlowConstr) },
      { int: Number(p.proposedCompletion) },
      hexBytes(p.methodsHash || ''),
    ],
  };
}

export function acceptBidRedeemer(bidId: string, accessDurationHours: number | null = null): PlutusJson {
  return {
    constructor: REDEEMER.AcceptBid,
    fields: [
      textBytes(bidId),
      accessDurationHours == null ? noneOf() : someOf({ int: Number(accessDurationHours) }),
    ],
  };
}

export function startWorkRedeemer(escrowId: string): PlutusJson {
  return { constructor: REDEEMER.StartWork, fields: [textBytes(escrowId)] };
}

export interface SubmitWorkRedeemerParams {
  escrowId: string;
  evidenceHash: string;
  actualImpacts?: CompoundFlowInput[];
}

export function submitWorkRedeemer(p: SubmitWorkRedeemerParams): PlutusJson {
  return {
    constructor: REDEEMER.SubmitWork,
    fields: [
      textBytes(p.escrowId),
      hexBytes(p.evidenceHash),
      { list: (p.actualImpacts || []).map(compoundFlowConstr) },
    ],
  };
}

export function releasePaymentRedeemer(escrowId: string): PlutusJson {
  return { constructor: REDEEMER.ReleasePayment, fields: [textBytes(escrowId)] };
}

export function constrIndex(obj: unknown): number | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const rec = obj as { constructor?: unknown; alternative?: unknown };
  if (typeof rec.constructor === 'number') return rec.constructor;
  if (typeof rec.alternative === 'number') return rec.alternative;
  return undefined;
}

export function fieldsOf(obj: unknown): unknown[] {
  return ((obj as { fields?: unknown[] }) && (obj as { fields?: unknown[] }).fields) || [];
}

export function decodeBytesField(field: unknown): string {
  if (!field) return '';
  if (typeof field === 'string') {
    try { return Buffer.from(field, 'hex').toString('utf8'); } catch { return field; }
  }
  const rec = field as { bytes?: string; byteString?: string };
  const hex = rec.bytes || rec.byteString;
  if (typeof hex === 'string') {
    try { return Buffer.from(hex, 'hex').toString('utf8'); } catch { return hex; }
  }
  return '';
}

export function decodeIntField(field: unknown): number {
  if (field == null) return 0;
  if (typeof field === 'number' || typeof field === 'bigint') return Number(field);
  const rec = field as { int?: number | bigint };
  if (typeof rec.int === 'number' || typeof rec.int === 'bigint') return Number(rec.int);
  return Number(field) || 0;
}

export function decodeLevel(field: unknown): LevelName | 'Basic' {
  const idx = constrIndex(field);
  return (idx !== undefined ? LEVEL_NAMES[idx] : undefined) || 'Basic';
}

export function decodePnftLevel(datum: unknown): string | null {
  if (!datum) return null;
  const f = fieldsOf(datum);
  const levelField = f[2];
  if (levelField == null) return null;
  const idx = constrIndex(levelField);
  if (idx === undefined || idx < 0 || idx >= LEVEL_NAMES.length) return null;
  return LEVEL_NAMES[idx];
}

export function decodePnftId(datum: unknown): string | null {
  const f = fieldsOf(datum);
  const id = decodeBytesField(f[0]);
  return id || null;
}

export function decodeEscrowStatusIndex(datum: unknown): number | undefined {
  if (constrIndex(datum) !== DATUM_TAG.EscrowDatum) return undefined;
  const inner = fieldsOf(datum)[0];
  const f = fieldsOf(inner);
  return constrIndex(f[10]);
}
