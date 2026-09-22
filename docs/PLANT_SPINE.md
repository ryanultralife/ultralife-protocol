# Plant spine

Records, hashed locks, the plant loop, labor, control, the fee skim, and the seed pools. This file is the law for that loop, together with the validators it names. It does not add a second protocol.

Module: `lib/ultralife/control.ak` (`ultralife/control`). Aiken only compiles libraries from `lib/`.

## Record

`RecordsDatum` gains `Plant(RecordDatum)` and `Attest(ControlAttest)`. The old `Record` / `AvatarStats` / `BioregionStats` constructors stay.

```
RecordSchema = Hire | Credential | Task | Run | LotLink | ClaimLink
             | Witness | Reveal | MerkleRoot | ShiftClose | InvoiceHash
```

`Witness` is the ControlAttest row. The live witness itself is `Attest(ControlAttest)`, which Produce and Transfer reference.

```
RecordDatum {
  schema, collective, bioregion, asset?, subject, prev?,
  commit,          // blake2b(payload || nonce), 32 bytes
  seal?,           // ciphertext ref; default None
  auth,            // holders, key_hashes (28 bytes), threshold, recovery
  slot
}
```

Keys never sit in datums. `RevealRecord` writes `schema=Reveal`, `seal=None`, and has no plaintext argument. GDPR erase revokes keys. The lineage stays.

`PostRecord` refuses Reveal, MerkleRoot, and Witness. Those have their own redeemers: `RevealRecord`, `PostMerkleRoot`, `AttestControl`.

## ControlBlock

```
ControlClass = Unrestricted | DualUse | Medical | Nuclear | Other
CredType = PersonClass | EndUser | ExportLicense | ImportPermit
         | SanctionsScreen | FacilityClearance

ControlBlock { class, dest_policy, need[], qty_cap, issuer_set }
```

Unrestricted goods: empty `need`, empty `dest_policy`. Anything else needs a non-empty `need` and a `dest_policy`. Settle fails unless every cred in `need` has a live attest: same subject, same `dest_policy`, expiry after the slot, issuer in `issuer_set`.

Transfer and sale copy the block. They do not clear `dest_policy`.

`Task.control_class` must be covered by a live `PersonClass` attest (`class_rank`). PersonClass is issuer + class + expiry. It is not a passport.

Citizenship files, license PDFs, and diagnoses do not go in public datum fields.

## Where it is wired

| Surface | What was added |
|---|---|
| `validators/isotope.ak` | `control`, `run_prev`. Produce requires a Run id and live attests. Transfer requires live attests and keeps `dest_policy`. |
| `isotope_policy` | New lot mint halts when `fee_pool` ADA is under `fee_floor` and `min_ada_reserve`. The mint must skim ULTRA into `fee_pool`. |
| `validators/work_auction.ak` | `WorkRequest` and `WorkEscrow` carry `control` and `parent_ticket`. Verify of an approved run requires the `energy.ak` input and the `asset_impact` input. Release skims ULTRA to `fee_pool`. |
| `validators/marketplace.ak` | `ListingDatum.control`. Create checks `control_well_formed`. Sale keeps `dest_policy`. |
| `lib/ultralife/types_universal.ak` | `Offering.control`. `Need.control` and `Need.parent_ticket`. |
| `validators/grants.ak` | `Ticket(GrantNote)` and `Offtake(OfftakeClaim)` beside the signup `Pool`. |

## Plant loop

Fail closed, in order:

```
work_auction run
  → credential + asset_impact + energy
  → historian off chain
  → MerkleRoot + ShiftClose on L1
  → QC record
  → Produce lot (parent = run)
  → impact + remediation
  → claim / ticket decrement
  → ULTRA skim → fee_pool
```

No lot Produce without `run_prev`. No approved run-close without the energy hook and the impact hook. Payroll is ULTRA. ADA on a close is capped by `cap_ada_exit_bps` of the ticket price, and a zero cap means no ADA to a key address.

Hydra carries bids, sealed HR, and intra-plant handoff. Hydra is not confidentiality: every head member sees the payload. L1 carries roots, credentials, lots, claim settlement, control attests, and ticket fills.

## Actors

| Actor | On chain | Paid |
|---|---|---|
| Intec plant collective | Owns assets, opens runs | Ops tickets |
| Mechanical Battery collective | `prime_engineer`; design and machine tickets | ULTRA into their bucket on close |
| Seed pool, one per bioregion | UltraLife validator, protocol owned | `seed_lock_ultra` from the raise ticket |
| Affiliate Cardano SPO | Tenant only after flow exists | ULTRA fee share. No map ownership |
| LP / offtake buyer | WorkTicket / OfftakeClaim | The units on the ticket |
| EDF, later | FacilityClearance + optional senior offtake | Cannot void junior lots or PreSold units |
| Worker pNFT | Hire / Credential, sealed | ULTRA in the Hydra bucket |

A Mechanical Battery subcontract is a `work_auction` whose `parent_ticket` is their GrantNote.

## Fees

Protocol fee is ULTRA into `fee_pool`. The pool pays Cardano `minFee`. Under the floor, new L1 mints halt. Hydra may continue. Size the ADA buffer for a stressed `minFee`.

`governance.ak` is the only parameter path. It does not read DRep or Voltaire votes. Content hashes `dest_policy`, `drep`, `voltaire`, and `mint_lot` cannot execute. ADA governance cannot change `dest_policy` or mint lots.

## Exit drill (preprod, not a chain)

Cardano in this phase is the notary. It is not the constitution. Midnight is not a dependency.

When an exit is required:

1. Freeze new Cardano mints. Withdrawals of settled positions still spend.
2. Remint only under a genesis out-ref and operator set that we own, and that set must be diluted relative to a single operator.
3. Dry-run that remint on preprod before any mainnet talk.
4. `prove_seal` must fail a mirror policy. A different out-ref is a different script, not theft.

Parameter watch, same drill: alert on `minFeeA`, `minFeeB`, cost models, and collateral. The watch writes a note. It does not vote.

## First slice

One collective, one dummy asset, ten pNFTs, one sealed hire, one hashed run, one dummy lot, one claim, one prime ticket close. Medical isotope lots stay restricted: Transfer fails until FacilityClearance, SanctionsScreen, and ExportLicense are live. A dummy lot may be `Unrestricted` and still must name its run before convert.

## Agents

`post_record`, `reveal_record`, `post_merkle_root`, `attest_control`, `presale_grant`, `presale_offtake`, `close_ticket`, `inspect_tickets`.

The agent builds an unsigned transaction. The wallet signs. The validators enforce.
