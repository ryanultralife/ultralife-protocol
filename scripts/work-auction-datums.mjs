/**
 * UltraLife work_auction datum/redeemer Constr JSON.
 * Aligned with validators/work_auction.ak + lib/ultralife/types.ak.
 * Mesh: txOutInlineDatumValue(obj, 'JSON') / txInRedeemerValue(obj, 'JSON').
 *
 * Do not invent DNA hashes, Standard upgrades, wallets, or ratings.
 */

export const VERIFICATION_LEVEL = {
  Basic: 0,
  Ward: 1,
  Standard: 2,
  Verified: 3,
  Steward: 4,
};

export const LEVEL_NAMES = ['Basic', 'Ward', 'Standard', 'Verified', 'Steward'];

/** types.ak can_transact: level != Basic */
export function canTransact(level) {
  return Boolean(level) && level !== 'Basic';
}

/**
 * Labor-loop policy: Standard is the documented minimum (DNA-verified).
 * Ward is can_transact=true on-chain but requires guardian co-sig — not used here.
 */
export function meetsLaborMinimum(level) {
  return level === 'Standard' || level === 'Verified' || level === 'Steward';
}

export function votingWeight(level) {
  switch (level) {
    case 'Verified': return 2;
    case 'Steward': return 3;
    case 'Standard': return 1;
    default: return 0;
  }
}

export function meetsLevelRequirement(actual, required) {
  return votingWeight(actual) >= votingWeight(required);
}

export function laborGateError(level) {
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

export const WORK_TYPE_INDEX = {
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

export const CONSTRUCTION_PHASE = {
  site_prep: 0, foundation: 1, framing: 2, roofing: 3,
  electrical: 4, plumbing: 5, finishing: 6, landscaping: 7,
};

export const AGRICULTURE_ACTIVITY = {
  planting: 0, cultivation: 1, harvesting: 2, irrigation: 3, soil_management: 4,
};

export const FORESTRY_ACTIVITY = {
  tree_planting: 0, selective_harvest: 1, forest_management: 2,
  fire_prevention: 3, restoration: 4,
};

export const MASS_UNIT = { grams: 0, kilograms: 1, liters: 2, moles: 3 };

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

export function textBytes(str) {
  return { bytes: Buffer.from(String(str ?? ''), 'utf8').toString('hex') };
}

export function hexBytes(hex) {
  const h = String(hex || '').replace(/^0x/, '');
  if (h && !/^[0-9a-fA-F]*$/.test(h)) {
    return textBytes(hex);
  }
  return { bytes: h };
}

export function unitConstr(index) {
  return { constructor: index, fields: [] };
}

export function someOf(value) {
  return { constructor: 0, fields: [value] };
}

export function noneOf() {
  return { constructor: 1, fields: [] };
}

export function levelConstr(levelName) {
  const idx = VERIFICATION_LEVEL[levelName];
  if (idx === undefined) {
    throw new Error(`Unknown verification level: ${levelName}`);
  }
  return unitConstr(idx);
}

export function massUnitConstr(unitName = 'kilograms') {
  const idx = MASS_UNIT[String(unitName).toLowerCase()] ?? MASS_UNIT.kilograms;
  return unitConstr(idx);
}

export function workTypeConstr(typeName, subtype) {
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

/**
 * ExpectedCompound { compound, expected_quantity, acceptable_min, acceptable_max, unit }
 */
export function expectedCompoundConstr(impact) {
  return {
    constructor: 0,
    fields: [
      textBytes(impact.compound),
      { int: Number(impact.expected_quantity) },
      { int: Number(impact.acceptable_min ?? impact.expected_quantity) },
      { int: Number(impact.acceptable_max ?? impact.expected_quantity) },
      massUnitConstr(impact.unit),
    ],
  };
}

/**
 * MeasurementMethod.Estimated { reference, similarity } — honest default when not surveyed.
 */
export function measurementEstimated(reference = 'job_estimate', similarity = 50) {
  return {
    constructor: 2,
    fields: [textBytes(reference), { int: similarity }],
  };
}

/**
 * CompoundFlow { compound, quantity, unit, measurement, confidence }
 */
export function compoundFlowConstr(flow) {
  return {
    constructor: 0,
    fields: [
      textBytes(flow.compound),
      { int: Number(flow.quantity) },
      massUnitConstr(flow.unit),
      flow.measurement || measurementEstimated(flow.reference || 'bid_estimate', flow.similarity ?? 50),
      { int: Number(flow.confidence ?? 50) },
    ],
  };
}

export function requestStatusOpen() {
  return unitConstr(REQUEST_STATUS.Open);
}

export function requestStatusInProgress(acceptedBid, worker) {
  return {
    constructor: REQUEST_STATUS.InProgress,
    fields: [textBytes(acceptedBid), textBytes(worker)],
  };
}

export function requestStatusPendingVerification(worker, evidenceHash) {
  return {
    constructor: REQUEST_STATUS.PendingVerification,
    fields: [textBytes(worker), hexBytes(evidenceHash)],
  };
}

export function bidStatusPending() {
  return unitConstr(BID_STATUS.Pending);
}

export function escrowStatusFunded() {
  return unitConstr(ESCROW_STATUS.Funded);
}

export function escrowStatusWorkStarted(startSlot) {
  return {
    constructor: ESCROW_STATUS.WorkStarted,
    fields: [{ int: Number(startSlot) }],
  };
}

export function escrowStatusWorkSubmitted(submissionSlot, evidenceHash, actualImpacts) {
  return {
    constructor: ESCROW_STATUS.WorkSubmitted,
    fields: [
      { int: Number(submissionSlot) },
      hexBytes(evidenceHash),
      { list: (actualImpacts || []).map(compoundFlowConstr) },
    ],
  };
}

export function escrowStatusVerified(verifier, verificationSlot) {
  return {
    constructor: ESCROW_STATUS.Verified,
    fields: [textBytes(verifier), { int: Number(verificationSlot) }],
  };
}

export function escrowStatusReleased(releaseSlot) {
  return {
    constructor: ESCROW_STATUS.Released,
    fields: [{ int: Number(releaseSlot) }],
  };
}

/**
 * WorkRequest fields in declaration order.
 */
export function workRequestFields(p) {
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

export function requestDatum(p) {
  return {
    constructor: DATUM_TAG.RequestDatum,
    fields: [{
      constructor: 0,
      fields: workRequestFields(p),
    }],
  };
}

export function workBidFields(p) {
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

export function bidDatum(p) {
  return {
    constructor: DATUM_TAG.BidDatum,
    fields: [{
      constructor: 0,
      fields: workBidFields(p),
    }],
  };
}

export function workEscrowFields(p) {
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

export function escrowDatum(p) {
  return {
    constructor: DATUM_TAG.EscrowDatum,
    fields: [{
      constructor: 0,
      fields: workEscrowFields(p),
    }],
  };
}

export function createRequestRedeemer(p) {
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

export function submitBidRedeemer(p) {
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

export function acceptBidRedeemer(bidId, accessDurationHours = null) {
  return {
    constructor: REDEEMER.AcceptBid,
    fields: [
      textBytes(bidId),
      accessDurationHours == null ? noneOf() : someOf({ int: Number(accessDurationHours) }),
    ],
  };
}

export function startWorkRedeemer(escrowId) {
  return { constructor: REDEEMER.StartWork, fields: [textBytes(escrowId)] };
}

export function submitWorkRedeemer(p) {
  return {
    constructor: REDEEMER.SubmitWork,
    fields: [
      textBytes(p.escrowId),
      hexBytes(p.evidenceHash),
      { list: (p.actualImpacts || []).map(compoundFlowConstr) },
    ],
  };
}

export function releasePaymentRedeemer(escrowId) {
  return { constructor: REDEEMER.ReleasePayment, fields: [textBytes(escrowId)] };
}

export function cancelRequestRedeemer(reason) {
  return { constructor: REDEEMER.CancelRequest, fields: [textBytes(reason)] };
}

export function withdrawBidRedeemer(bidId) {
  return { constructor: REDEEMER.WithdrawBid, fields: [textBytes(bidId)] };
}

export function parseImpactList(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  return String(raw).split(',').map((part) => {
    const [compound, qty, unit] = part.split(':').map((s) => s && s.trim());
    if (!compound || !qty) {
      throw new Error(`Invalid --impact item "${part}". Use COMPOUND:qty[:unit] e.g. CO2:1000:kilograms`);
    }
    const n = Number(qty);
    if (!Number.isFinite(n)) {
      throw new Error(`Invalid impact quantity in "${part}"`);
    }
    return {
      compound,
      expected_quantity: n,
      acceptable_min: n,
      acceptable_max: n,
      quantity: n,
      unit: unit || 'kilograms',
      confidence: 50,
    };
  });
}

export function constrIndex(obj) {
  if (!obj || typeof obj !== 'object') return undefined;
  if (typeof obj.constructor === 'number') return obj.constructor;
  if (typeof obj.alternative === 'number') return obj.alternative;
  return undefined;
}

export function fieldsOf(obj) {
  return (obj && obj.fields) || [];
}

export function decodeBytesField(field) {
  if (!field) return '';
  if (typeof field === 'string') {
    try { return Buffer.from(field, 'hex').toString('utf8'); } catch { return field; }
  }
  const hex = field.bytes || field.byteString;
  if (typeof hex === 'string') {
    try { return Buffer.from(hex, 'hex').toString('utf8'); } catch { return hex; }
  }
  return '';
}

export function decodeIntField(field) {
  if (field == null) return 0;
  if (typeof field === 'number' || typeof field === 'bigint') return Number(field);
  if (typeof field.int === 'number' || typeof field.int === 'bigint') return Number(field.int);
  return Number(field) || 0;
}

export function decodeLevel(field) {
  const idx = constrIndex(field);
  return LEVEL_NAMES[idx] || 'Basic';
}

export function decodeWorkType(field) {
  const idx = constrIndex(field);
  return Object.keys(WORK_TYPE_INDEX).find((k) => WORK_TYPE_INDEX[k] === idx) || 'custom';
}

export function decodeRequestDatum(datum) {
  if (constrIndex(datum) !== DATUM_TAG.RequestDatum) return null;
  const inner = fieldsOf(datum)[0];
  const f = fieldsOf(inner);
  if (f.length < 15) return null;
  return {
    kind: 'request',
    requestId: decodeBytesField(f[0]),
    requester: decodeBytesField(f[1]),
    asset: decodeBytesField(f[2]),
    bioregion: decodeBytesField(f[3]),
    workType: decodeWorkType(f[4]),
    specificationsHash: decodeBytesField(f[5]),
    budgetMin: decodeIntField(f[7]),
    budgetMax: decodeIntField(f[8]),
    minWorkerLevel: decodeLevel(f[10]),
    bidDeadline: decodeIntField(f[11]),
    workDeadline: decodeIntField(f[12]),
    createdAt: decodeIntField(f[13]),
    statusIndex: constrIndex(f[14]),
    status: Object.keys(REQUEST_STATUS).find((k) => REQUEST_STATUS[k] === constrIndex(f[14])) || 'unknown',
  };
}

export function decodeBidDatum(datum) {
  if (constrIndex(datum) !== DATUM_TAG.BidDatum) return null;
  const inner = fieldsOf(datum)[0];
  const f = fieldsOf(inner);
  if (f.length < 11) return null;
  return {
    kind: 'bid',
    bidId: decodeBytesField(f[0]),
    requestId: decodeBytesField(f[1]),
    bidder: decodeBytesField(f[2]),
    bidAmount: decodeIntField(f[3]),
    proposedCompletion: decodeIntField(f[8]),
    submittedAt: decodeIntField(f[9]),
    statusIndex: constrIndex(f[10]),
    status: Object.keys(BID_STATUS).find((k) => BID_STATUS[k] === constrIndex(f[10])) || 'unknown',
  };
}

export function decodeEscrowDatum(datum) {
  if (constrIndex(datum) !== DATUM_TAG.EscrowDatum) return null;
  const inner = fieldsOf(datum)[0];
  const f = fieldsOf(inner);
  if (f.length < 11) return null;
  return {
    kind: 'escrow',
    escrowId: decodeBytesField(f[0]),
    requestId: decodeBytesField(f[1]),
    bidId: decodeBytesField(f[2]),
    requester: decodeBytesField(f[3]),
    worker: decodeBytesField(f[4]),
    amount: decodeIntField(f[7]),
    deadline: decodeIntField(f[9]),
    statusIndex: constrIndex(f[10]),
    status: Object.keys(ESCROW_STATUS).find((k) => ESCROW_STATUS[k] === constrIndex(f[10])) || 'unknown',
  };
}

export function decodeWorkAuctionDatum(datum) {
  return decodeRequestDatum(datum) || decodeBidDatum(datum) || decodeEscrowDatum(datum);
}

export function decodePnftLevel(datum) {
  const inner = constrIndex(datum) === 0 ? datum : datum;
  const f = fieldsOf(inner);
  const levelField = f[2];
  return decodeLevel(levelField);
}

export function decodePnftId(datum) {
  const f = fieldsOf(datum);
  return decodeBytesField(f[0]);
}
