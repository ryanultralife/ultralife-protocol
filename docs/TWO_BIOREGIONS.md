# Two bioregions

First plants: Intec and Mechanical Battery (prime: machines and design engineering).

First geography, two ids:

| Id | Collective | Seed pool ticker |
|---|---|---|
| `intec-site` | Intec site collective + facility credential | `ULSEED-INTEC` |
| `reno-tric` | Reno / Tahoe-Reno Industrial Center (TRIC) collective + facility credential | `ULSEED-TRIC` |

A bioregion id is not a Cardano pool ticker. The seed pools are protocol-owned. Affiliate SPOs can verify later and are paid ULTRA. They do not own the map. `validators/stake_pool.ak` and `validators/bioregion.ak` say this in the header.

## Shared

Schemas, ULTRA, the issuer-registry shape, and Mechanical Battery design tickets. The machine asset id differs per install. A design ticket can name either plant. The parent asset does not.

## Not shared

`dest_policy`, facility clearance, and the PersonClass mix on the floor. Moving people or a restricted lot across the two sites is a deemed export.

An A→B lot move is `Transfer` plus a new control check against B’s `dest_policy` and B’s facility credential. The old `dest_policy` is not stripped on the way out. The destination lot carries B’s block.

## Lots

Isotope lots in `docs/ISOTOPE_PRESALE.md` are Medical unless an explicit dummy is `Unrestricted`. Restricted Produce and Transfer reference live `Attest` UTxOs on the records script. Hospital inventory owns the lot. The patient is a commitment. See `docs/TX_PRIVACY.md`.

## Parameters and exit

`governance.ak` is local. It does not read a DRep vote and it cannot set `dest_policy` or mint a lot. Cardano L1 is the notary this phase. The exit drill is in `docs/PLANT_SPINE.md`: freeze mints, remint only under our diluted genesis, dry-run on preprod. No Midnight.

## Regulatory posture (22 Sep 2026)

This is not legal advice. Counsel maps ECCN, USML, NRC, and FDA before a mainnet restricted lot.

- Clarity Act failed the Senate 50–49 on 15 Sep 2026. There is no market-structure statute from that vote.
- The SEC Innovation Exemption is for permissioned tokenized NMS stocks. It is not this product.
- Reg CA (S7-2026-27) is proposed. Comments are due 20 Oct 2026. File WorkTickets as prepaid specified work or goods if counsel agrees.
- The ask, the parties, and what a letter must not claim are in [WASHINGTON_DIRECTION.md](WASHINGTON_DIRECTION.md). Meetings, with counsel in the room, are public: `crypto@sec.gov` Task Force (Peirce), Corp Fin Chief Counsel, BIS SNAP-R / counseling (Kessler / Peters / Export Administration).

Issuers (KYC, broker, empowered official) rotate destination codes in the registry. An OFAC or sanctions screen expires on its slot. Citizenship on chain is a PersonClass attest, not a file.
