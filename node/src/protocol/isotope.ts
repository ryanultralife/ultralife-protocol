/** Medical isotope lots. Title to atoms. First tokenization — not ULTRA. */

export type Nuclide = "Mo-99" | "Tc-99m" | "I-131" | "Lu-177" | "Ac-225" | "F-18";
export type IsotopeForm = "target" | "generator" | "eluate" | "radiopharmaceutical" | "dose";
export type LotStatus =
  | "PreSold"
  | "Produced"
  | "Held"
  | "Converted"
  | "Administered"
  | "Decayed"
  | "Recalled";

export type IsotopeLot = {
  id: string;
  nuclide: Nuclide;
  form: IsotopeForm;
  activityBq: number;
  calibratedSlot: number;
  halfLifeSlots: number;
  expirySlot: number;
  owner: string;
  custodian: string;
  patient?: string;
  parent?: string;
  status: LotStatus;
  priceUltra: number;
  specHash: string;
};

/** Half-lives in slots (≈ seconds). */
export const HALF_LIFE: Record<Nuclide, number> = {
  "Mo-99": 237_600,
  "Tc-99m": 21_636,
  "I-131": 692_928,
  "Lu-177": 574_560,
  "Ac-225": 864_000,
  "F-18": 6_588,
};

export const DAUGHTER: Partial<Record<Nuclide, Nuclide>> = {
  "Mo-99": "Tc-99m",
};

export function remainingBq(lot: IsotopeLot, nowSlot: number) {
  if (nowSlot <= lot.calibratedSlot) return lot.activityBq;
  if (lot.halfLifeSlots <= 0) return 0;
  const n = Math.floor((nowSlot - lot.calibratedSlot) / lot.halfLifeSlots);
  if (n >= 32) return 0;
  return Math.floor(lot.activityBq / 2 ** n);
}

export function parseNuclide(raw: string): Nuclide {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "");
  if (t.includes("tc") || t.includes("technetium")) return "Tc-99m";
  if (t.includes("i-131") || t.includes("iodine")) return "I-131";
  if (t.includes("lu") || t.includes("lutetium")) return "Lu-177";
  if (t.includes("ac") || t.includes("actinium")) return "Ac-225";
  if (t.includes("f-18") || t.includes("fluor")) return "F-18";
  return "Mo-99";
}
