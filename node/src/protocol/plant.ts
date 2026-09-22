/** Plant spine shared by the node rehearsal. Aiken ultralife/control is the law. */

export const FEE_FLOOR = 5_000_000;
export const PLANTS = {
  intec: { id: "intec-site", name: "Intec site", collective: "collective_intec" },
  tric: { id: "reno-tric", name: "Reno / Tahoe-Reno Industrial Center", collective: "collective_reno_tric" },
  prime: { id: "mechanical-battery", name: "Mechanical Battery", bucket: "bucket_mb_prime" },
} as const;

export const SEED_POOLS = [
  { id: "seed_intec", bioregion: PLANTS.intec.id, ticker: "ULSEED-INTEC" },
  { id: "seed_tric", bioregion: PLANTS.tric.id, ticker: "ULSEED-TRIC" },
] as const;

export type ControlClass = "Unrestricted" | "DualUse" | "Medical" | "Nuclear" | "Other";
export type CredType =
  | "PersonClass"
  | "EndUser"
  | "ExportLicense"
  | "ImportPermit"
  | "SanctionsScreen"
  | "FacilityClearance";

export type ControlBlock = {
  class: ControlClass;
  destPolicy: string;
  need: CredType[];
  qtyCap: number;
  issuerSet: string[];
};

export type LiveAttest = {
  cred: CredType;
  subject: string;
  class: ControlClass;
  destPolicy: string;
  expirySlot: number;
  issuer: string;
};

export type SpineSchema =
  | "Hire"
  | "Credential"
  | "Task"
  | "Run"
  | "LotLink"
  | "ClaimLink"
  | "Witness"
  | "Reveal"
  | "MerkleRoot"
  | "ShiftClose"
  | "InvoiceHash"
  | "TagEvent";

export type SpineRecord = {
  id: string;
  schema: SpineSchema;
  collective: string;
  bioregion: string;
  asset?: string;
  subject: string;
  prev?: string;
  commit: string;
  seal?: string;
  creatorPnft?: string;
  slot: number;
};

export type WorkAccount = "design" | "machine" | "hours" | "civil" | "remediation" | "rent";

export type GrantTicket = {
  id: string;
  plant: string;
  bioregion: string;
  tranche: "T0" | "T1" | "T2" | "T3";
  account: WorkAccount;
  units: number;
  unitsRemaining: number;
  price: number;
  capAdaExitBps: number;
  seedLockUltra: number;
  feeSkimBps: number;
  milestoneCommit: string;
  refundSlot: number;
  senior: boolean;
};

export type Offtake = {
  id: string;
  sku: string;
  qty: number;
  qtyRemaining: number;
  windowStart: number;
  windowEnd: number;
  plant: string;
  bioregion: string;
  control: ControlBlock;
  parentGrant?: string;
  senior: boolean;
};

export type PlantState = {
  records: SpineRecord[];
  attests: LiveAttest[];
  tickets: GrantTicket[];
  claims: Offtake[];
  feePool: { ada: number; ultra: number; floor: number };
  primeBucketUltra: number;
};

const RANK: Record<ControlClass, number> = {
  Unrestricted: 0,
  Other: 1,
  DualUse: 2,
  Medical: 3,
  Nuclear: 4,
};

export function emptyPlant(): PlantState {
  return {
    records: [],
    attests: [],
    tickets: [],
    claims: [],
    feePool: { ada: 20_000_000, ultra: 0, floor: FEE_FLOOR },
    primeBucketUltra: 0,
  };
}

export function unrestrictedBlock(): ControlBlock {
  return { class: "Unrestricted", destPolicy: "", need: [], qtyCap: 0, issuerSet: [] };
}

export function medicalBlock(subjectDest = "intec-us"): ControlBlock {
  return {
    class: "Medical",
    destPolicy: subjectDest,
    need: ["FacilityClearance", "SanctionsScreen", "ExportLicense"],
    qtyCap: 1,
    issuerSet: ["issuer-radiopharmacy"],
  };
}

export function parseClass(raw: unknown): ControlClass {
  const t = String(raw ?? "Unrestricted");
  if (t === "DualUse" || t === "Medical" || t === "Nuclear" || t === "Other" || t === "Unrestricted") return t;
  return "Unrestricted";
}

export function blockFrom(raw: {
  class?: unknown;
  destPolicy?: unknown;
  need?: unknown;
  issuers?: unknown;
}): ControlBlock {
  const cls = parseClass(raw.class);
  if (cls === "Unrestricted") return unrestrictedBlock();
  const need = Array.isArray(raw.need) && raw.need.length ? (raw.need as CredType[]) : medicalBlock().need;
  const issuers = Array.isArray(raw.issuers) && raw.issuers.length ? (raw.issuers as string[]) : ["issuer-radiopharmacy"];
  return {
    class: cls,
    destPolicy: String(raw.destPolicy || "intec-us"),
    need,
    qtyCap: 1,
    issuerSet: issuers,
  };
}

export function l1MintOpen(plant: PlantState) {
  return plant.feePool.ada >= plant.feePool.floor;
}

export function controlAllows(block: ControlBlock, attests: LiveAttest[], slot: number, subject: string) {
  if (block.class === "Unrestricted") return block.need.length === 0;
  if (!block.destPolicy || block.need.length === 0) return false;
  return block.need.every((cred) =>
    attests.some(
      (a) =>
        a.cred === cred &&
        a.subject === subject &&
        a.destPolicy === block.destPolicy &&
        a.expirySlot > slot &&
        block.issuerSet.includes(a.issuer),
    ),
  );
}

export function classCovered(task: ControlClass, worker: ControlClass) {
  return RANK[task] <= RANK[worker];
}

export function postSpine(
  plant: PlantState,
  slot: number,
  input: {
    schema: string;
    collective: string;
    bioregion: string;
    subject: string;
    payload: string;
    asset?: string;
    seal?: string;
  },
): { ok: true; plant: PlantState; id: string } | { ok: false; error: string } {
  const allowed: SpineSchema[] = ["Hire", "Credential", "Task", "Run", "LotLink", "ClaimLink", "ShiftClose", "InvoiceHash"];
  if (input.schema === "TagEvent") {
    return { ok: false, error: "Tag events use log_interaction so both the lapel and the machine tag are named." };
  }
  if (!allowed.includes(input.schema as SpineSchema)) {
    return { ok: false, error: "Use reveal_record, post_merkle_root, or attest_control for that schema." };
  }
  if (!input.collective || !input.bioregion || !input.subject) {
    return { ok: false, error: "collective, bioregion, and subject are required." };
  }
  const id = `rec_${input.schema.toLowerCase()}_${slot}`;
  const record: SpineRecord = {
    id,
    schema: input.schema as SpineSchema,
    collective: input.collective,
    bioregion: input.bioregion,
    asset: input.asset,
    subject: input.subject,
    commit: commitOf(input.payload),
    seal: input.seal,
    slot,
  };
  return { ok: true, id, plant: { ...plant, records: [...plant.records, record] } };
}

export function revealSpine(
  plant: PlantState,
  slot: number,
  recordId: string,
): { ok: true; plant: PlantState } | { ok: false; error: string } {
  const prev = plant.records.find((r) => r.id === recordId || r.commit === recordId);
  if (!prev) return { ok: false, error: "No record to reveal." };
  const opened: SpineRecord = {
    ...prev,
    id: `rec_reveal_${slot}`,
    schema: "Reveal",
    prev: prev.commit,
    commit: commitOf(`reveal:${prev.commit}`),
    seal: undefined,
    slot,
  };
  return { ok: true, plant: { ...plant, records: [...plant.records, opened] } };
}

export function merkleSpine(
  plant: PlantState,
  slot: number,
  input: { collective: string; bioregion: string; root: string },
): { ok: true; plant: PlantState; id: string } | { ok: false; error: string } {
  if (!input.root) return { ok: false, error: "Merkle root required." };
  const id = `rec_root_${slot}`;
  const record: SpineRecord = {
    id,
    schema: "MerkleRoot",
    collective: input.collective,
    bioregion: input.bioregion,
    subject: input.root,
    commit: commitOf(input.root),
    slot,
  };
  return { ok: true, id, plant: { ...plant, records: [...plant.records, record] } };
}

export function addAttest(
  plant: PlantState,
  slot: number,
  attest: LiveAttest,
): { ok: true; plant: PlantState } | { ok: false; error: string } {
  if (attest.expirySlot <= slot) return { ok: false, error: "Attest already expired." };
  if (!attest.issuer || !attest.subject || !attest.destPolicy) {
    return { ok: false, error: "issuer, subject, and dest_policy are required." };
  }
  return { ok: true, plant: { ...plant, attests: [...plant.attests, attest] } };
}

export function issueGrant(
  plant: PlantState,
  slot: number,
  ticket: Omit<GrantTicket, "id" | "unitsRemaining"> & { id?: string },
): { ok: true; plant: PlantState; id: string } | { ok: false; error: string } {
  if (ticket.units <= 0 || ticket.price <= 0) return { ok: false, error: "units and price must be positive." };
  if (ticket.feeSkimBps < 0 || ticket.feeSkimBps > 10000) return { ok: false, error: "fee_skim_bps out of range." };
  if (ticket.capAdaExitBps < 0 || ticket.capAdaExitBps > 10000) return { ok: false, error: "cap_ada_exit_bps out of range." };
  const id = ticket.id || `tix_${slot}`;
  const next: GrantTicket = { ...ticket, id, unitsRemaining: ticket.units };
  const ultra = plant.feePool.ultra + (ticket.feeSkimBps > 0 ? 1 : 0);
  return {
    ok: true,
    id,
    plant: { ...plant, tickets: [...plant.tickets, next], feePool: { ...plant.feePool, ultra } },
  };
}

export function issueOfftake(
  plant: PlantState,
  claim: Omit<Offtake, "id" | "qtyRemaining"> & { id?: string },
): { ok: true; plant: PlantState; id: string } | { ok: false; error: string } {
  if (claim.control.class !== "Unrestricted" && !claim.control.destPolicy) {
    return { ok: false, error: "Restricted offtake needs dest_policy." };
  }
  const id = claim.id || `claim_${claim.sku}`;
  const next: Offtake = { ...claim, id, qtyRemaining: claim.qty, senior: claim.senior };
  return { ok: true, id, plant: { ...plant, claims: [...plant.claims, next] } };
}

export function closeGrant(
  plant: PlantState,
  slot: number,
  ticketId: string,
  recordId: string,
): { ok: true; plant: PlantState; refunded: boolean } | { ok: false; error: string } {
  const ticket = plant.tickets.find((t) => t.id === ticketId);
  if (!ticket) return { ok: false, error: "No such ticket." };
  if (ticket.unitsRemaining <= 0) return { ok: false, error: "Ticket is already closed." };
  if (slot >= ticket.refundSlot) {
    const tickets = plant.tickets.map((t) => (t.id === ticket.id ? { ...t, unitsRemaining: 0 } : t));
    return { ok: true, refunded: true, plant: { ...plant, tickets } };
  }
  if (!plant.records.some((r) => r.id === recordId || r.commit === recordId)) {
    return { ok: false, error: "close_ticket needs a plant record id." };
  }
  const tickets = plant.tickets.map((t) =>
    t.id === ticket.id ? { ...t, unitsRemaining: t.unitsRemaining - 1 } : t,
  );
  const prime = ticket.account === "design" || ticket.account === "machine" ? plant.primeBucketUltra + 1 : plant.primeBucketUltra;
  return {
    ok: true,
    refunded: false,
    plant: {
      ...plant,
      tickets,
      primeBucketUltra: prime,
      feePool: { ...plant.feePool, ultra: plant.feePool.ultra + (ticket.feeSkimBps > 0 ? 1 : 0) },
    },
  };
}

export type TagKind = "Enroll" | "Access" | "Operate" | "Check";

export function logInteraction(
  plant: PlantState,
  slot: number,
  input: {
    personTag: string;
    machineTag: string;
    kind: TagKind;
    collective: string;
    bioregion: string;
    payload: string;
    waveform: string;
    enrollment: string;
    pnft: string;
  },
): { ok: true; plant: PlantState; id: string } | { ok: false; error: string } {
  const person = input.personTag.trim();
  const machine = input.machineTag.trim();
  const waveform = input.waveform.trim();
  const enrollment = input.enrollment.trim();
  const pnft = input.pnft.trim();
  if (!person || !machine || person === machine) {
    return { ok: false, error: "Every interaction names a lapel tag and a different machine tag." };
  }
  if (!pnft) {
    return { ok: false, error: "The person creating or carrying a tag is logged by pNFT." };
  }
  if (!waveform || !enrollment) {
    return { ok: false, error: "The lapel log needs the operator's live waveform and the enrolled waveform." };
  }
  if (!input.collective || !input.bioregion) {
    return { ok: false, error: "collective and bioregion are required." };
  }
  const live = commitOf(waveform);
  const enrolled = enrollment.length === 64 ? enrollment : commitOf(enrollment);
  if (live === enrolled) {
    return { ok: false, error: "Live waveform matches enrollment. That is a replay, not a new reading." };
  }
  const id = `tag_${input.kind.toLowerCase()}_${slot}`;
  const record: SpineRecord = {
    id,
    schema: "TagEvent",
    collective: input.collective,
    bioregion: input.bioregion,
    asset: machine,
    subject: person,
    prev: enrolled,
    seal: live,
    creatorPnft: pnft,
    commit: commitOf(`${input.kind}|${person}|${machine}|${pnft}|${live}|${input.payload}`),
    slot,
  };
  return { ok: true, id, plant: { ...plant, records: [...plant.records, record] } };
}

export function commitOf(payload: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0").repeat(8).slice(0, 64);
}
