import type { Tool } from "@modelcontextprotocol/sdk/types.js";

function tool(name: string, description: string, required: string[]): Tool {
  const properties: Record<string, { type: string }> = {};
  for (const key of required) properties[key] = { type: "string" };
  return {
    name,
    description,
    inputSchema: { type: "object", properties, required },
  };
}

export const PLANT_TOOLS: Tool[] = [
  tool(
    "log_interaction",
    "Lapel tag plus machine tag. Biometric KYC stays on the crystal. UltraLife stores the hash.",
    ["personTag", "machineTag", "kind", "waveform", "enrollment"],
  ),
  tool("post_record", "Hash a plant record. No PII in public fields.", ["schema", "collective", "bioregion", "subject", "payload"]),
  tool("reveal_record", "schema=Reveal. No plaintext argument.", ["recordId"]),
  tool("post_merkle_root", "L1 merkle root. Payload stays off chain.", ["root"]),
  tool("attest_control", "Live ControlAttest for a restricted lot or task.", ["cred", "subject", "destPolicy"]),
  tool("presale_grant", "WorkTicket. Does not mint the $20M as ULTRA.", ["account", "units", "price"]),
  tool("presale_offtake", "Offtake claim. Junior unless senior=true.", ["sku", "qty"]),
  tool("close_ticket", "Close one unit. Design/machine pays the prime bucket in ULTRA.", ["ticketId", "recordId"]),
  tool("inspect_tickets", "Read funded units, remaining units, fee_pool, prime bucket.", []),
];

const SCRIPTS: Record<string, string[]> = {
  log_interaction: ["records.records.spend", "biometric.identity.spend"],
  post_record: ["records.records.spend"],
  reveal_record: ["records.records.spend"],
  post_merkle_root: ["records.records.spend"],
  attest_control: ["records.records.spend"],
  presale_grant: ["grants.grants.spend"],
  presale_offtake: ["grants.grants.spend"],
  close_ticket: ["grants.grants.spend"],
  inspect_tickets: [],
};

export function plantUnsigned(name: string, args: Record<string, unknown>) {
  if (name === "presale_grant" && Number(args.units) <= 0) {
    throw new Error("units must be positive. Do not mark thin ULTRA as the raise.");
  }
  if (name === "log_interaction") {
    const person = String(args.personTag ?? "").trim();
    const machine = String(args.machineTag ?? "").trim();
    if (!person || !machine || person === machine) {
      throw new Error("Every interaction names a lapel tag and a different machine tag.");
    }
    if (!String(args.waveform ?? "").trim() || !String(args.enrollment ?? "").trim()) {
      throw new Error("The lapel log needs the operator's live waveform and the enrolled waveform.");
    }
  }
  if (name === "attest_control" && !args.destPolicy) {
    throw new Error("dest_policy is required and is not stripped.");
  }
  const redeemerArgs = { ...args };
  delete redeemerArgs.waveform;
  return {
    unsigned: true,
    signing: "wallet",
    scripts: SCRIPTS[name] ?? [],
    redeemer: { op: name, ...redeemerArgs },
    law: "validators/records.ak, validators/grants.ak, validators/isotope.ak, lib/ultralife/control.ak",
  };
}
