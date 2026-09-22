# Pre-EDF raise

$20M is SPV cash plus WorkTickets (grant + offtake + hours). It is not a pile of unallocated ULTRA.

ULTRA settles closed work into a bucket. It is not the NAV of the raise. EDF counts the SPV cash and the contracted units. Do not mark $20M of thin ULTRA as qualifying capital.

## Ticket

`GrantNote` on `validators/grants.ak` (`GrantsState.Ticket`):

```
plant, bioregion, tranche: T0|T1|T2|T3,
account,                 // design | machine | hours | civil | remediation | rent
units, units_remaining, price,
cap_ada_exit_bps, seed_lock_ultra, fee_skim_bps,
milestone_commit, refund_slot, senior
```

Face = sum of funded `units × price` in fiat, accounted on the tickets. `price` is that fiat unit. On chain, ADA leaving a close to a key address is capped:

```
paid_lovelace * 10000 <= price * cap_ada_exit_bps
```

A cap of 0 means no ADA to a key. The rest of the settlement is ULTRA.

`OfftakeClaim` carries `sku`, `qty`, window, plant, bioregion, `control`, optional `parent_grant`, and `senior`.

## Sleeves

Publish `prime_share_bps` with the ticket set. Indicative work accounts, not a second token:

| Account | Who |
|---|---|
| design + machine | Mechanical Battery, prime. ULTRA on close. Capped ADA exit only for their OEMs |
| civil | Site, civil, install |
| hours | Qualified hours |
| offtake sku | Certified output, including isotope lots |
| remediation | Tails |
| rent | Protocol rent: `fee_pool` skim and seed locks. Not “work delivered” |

## Waterfall

On inbound representation (`IssueGrant`):

1. `fee_skim_bps` → `fee_pool` as ULTRA
2. `seed_lock_ultra` → that bioregion’s protocol seed pool
3. ADA or fiat vendor pay ≤ `cap_ada_exit_bps`
4. Remaining ULTRA stays in the plant bucket for auctions

## Gates

| Tranche | Gate |
|---|---|
| T0 | Collective and issuers exist |
| T1 | Machine is on the floor |
| T2 | First `MerkleRoot` and Produce |
| T3 | Offtake is settling and `fee_pool` is above the floor |

Miss `refund_slot` and `RefundGrant` voids the remaining units. It does not claw back a PreSold junior lot.

Junior tickets are `senior=false`. EDF later is a new claim with `senior=true`. There is no redeemer that decreases someone else’s units. EDF cannot eat junior PreSold units and cannot void `dest_policy`.

## What this is not

Clarity is not a license. The SEC Innovation Exemption is a permissioned stock venue, not this product. Reg CF, NRC, FDA, and export control stay with counsel. See the posture note in `docs/TWO_BIOREGIONS.md` and `AGENTS.md`.

`presale_grant` and `presale_offtake` build unsigned transactions. `close_ticket { ticketId, recordId }` settles one unit against a spine record, or refunds if the slot has passed.
