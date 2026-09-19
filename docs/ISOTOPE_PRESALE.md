# First tokenization: medical isotope pre-sales

Not ULTRA. Not a fraction of a pNFT. **Title to atoms** a clinic or patient already intends to use.

```
Customer pNFT  ──owns──  lot UTxO (Mo-99 / I-131 / Lu-177 / …)
                 │
                 ├── hold until needed
                 ├── sell remaining activity to another pNFT
                 └── lab converts → daughter / dose → administer to a patient pNFT
```

One lot = one eUTxO. No singleton “isotope market” UTxO. Decay is on the datum.

## Why this is first

UltraLife is protocol for **life**. The first real asset should be something a body uses, with a clock physics already understands.

| If we tokenized first… | Failure mode |
|---|---|
| ULTRA as a ticker | Casino. No patient, no lab, no half-life |
| Land | Slow, legal, not a daily loop |
| **Isotope lots** | Buyer, custodian lab, expiry, conversion, treatment — the whole stack in one object |

ULTRA is the later settlement asset. Lots can price in ULTRA. They do not *wait* on a token launch.

## What the customer owns

A **lot**, not a share of a company and not a security by slogan:

- Nuclide + form (target, generator, eluate, radiopharmaceutical, dose)
- Activity in Bq **at a calibration slot**
- Half-life (slots ≈ seconds)
- Expiry slot
- **Owner pNFT** (economic title)
- **Custodian pNFT** (licensed lab / radiopharmacy — the hot cell)
- Optional patient pNFT (reserved dose)
- Parent lot id (Mo-99 → Tc-99m)
- Status: `PreSold | Produced | Held | Converted | Administered | Decayed | Recalled`
- `spec_hash` → IPFS: COA, USP monograph, license, chain of custody photos

Remaining activity is deterministic:

```
remaining_bq = activity0 / 2^floor((now - calibrated) / half_life)
```

After 32 half-lives, or below `min_useful_bq`, the lot can only `Expire`. It cannot become a dose.

## Pre-sale

1. Lab (or producer) lists a **future** lot: nuclide, promised Bq, calibration window, price.
2. Customer pNFT pays (ULTRA later; test ADA on preprod). Lot mints `PreSold`, **owner = customer**. Atoms may not exist yet.
3. Lab `Produce`s with a COA hash. Status → `Produced`. Title does **not** move to the lab. The lab is custodian.
4. Customer holds. Hospital inventory is just “lots this pNFT owns.”

They need it: lab `Convert`s (generator → Tc-99m → kit → dose). New lot UTxO, parent consumed.

They don’t: `Transfer` remaining activity to another pNFT (another hospital, another patient). Same atoms, new owner, decay continues.

They treat: `Administer { patient_commit, procedure_commit }`. Lot is done. Not resold. Patient and CPT stay off the public datum — see [TX_PRIVACY.md](TX_PRIVACY.md). Hospital inventory should own the lot; the patient should not.

## What is not anonymous

Rule 5 still holds. Every lot has an owner pNFT. Every convert/administer is a lab pNFT. A mixer of I-131 is a crime, not a privacy feature.

Private ≠ anonymous: a ZK lane may hide **which** hospital from the public board; the protocol still sees a valid pNFT + license. That lane is not this validator.

## What this is not

- Not a fraction of identity
- Not advice that a lot is a regulated security or a drug; NRC / FDA / EMA stay off-chain in `spec_hash` until a lab attests
- Not WASM-as-proof. `validators/isotope.ak` is the law. The node CEK is rehearsal
- Not “the lab owns your treatment.” **You own the lot until you sell or it is administered**

## Agent tools (WASM node)

```
presale_isotope   { nuclide, activityBq, priceUltra }
convert_isotope   { lotId, daughter }
administer_dose   { lotId, patient }
transfer_isotope  { lotId, newOwner }
inspect_isotopes
```

Aiken: `validators/isotope.ak`. Registry categories (Medical → Radionuclide → Mo-99) still live in `registry.ak`; the lot is the instance with a clock.
