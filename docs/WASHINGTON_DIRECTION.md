# Washington direction

Intent for correspondence. This is not a letter, a filing, or legal advice. Counsel drafts and sits in the room. Nothing here is sent until Ryan signs it.

## What we are asking

Direction on this implementation before any filing.

Mechanical Battery LLC is building UltraLife as the record of work, custody, and credentials for real plants. The code is this repository. The first plants are Intec and Mechanical Battery (prime: machines and design engineering). The first sites are `intec-site` and Reno / Tahoe-Reno Industrial Center (`reno-tric`). The first assets are specified lots, including the medical-isotope lots in `docs/ISOTOPE_PRESALE.md`, plus machine-hours and design gates.

We want the agencies below to tell us whether this shape is the one they expect to see, and what the next step is. We are not asking them to approve a token sale.

## What the implementation is

Read these before writing:

| Doc | Use it for |
|---|---|
| `docs/PLANT_SPINE.md` | Records, control, the run-to-lot loop, the fee skim |
| `docs/PRE_EDF_RAISE.md` | The $20M as WorkTickets, waterfall, refund, seniority |
| `docs/TWO_BIOREGIONS.md` | The two sites and what does not cross |
| `docs/ISOTOPE_PRESALE.md` | Title to atoms, decay, who owns the lot |
| `docs/TX_PRIVACY.md` | Commitments. The procedure can hide. The person does not |
| `AGENTS.md` | The rules that bound the build |

Facts a letter may state:

- Users pay and earn ULTRA. Cardano ADA is only the L1 fee, paid from `fee_pool`.
- The $20M private raise is SPV cash plus WorkTickets (grant, offtake, and hours). Face value is funded units times price, in fiat, on the tickets. ULTRA settles closed work into a bucket. Unallocated ULTRA is not that raise.
- A restricted lot cannot be produced or transferred without a live control attestation. `dest_policy` is not stripped for EDF or anyone else. A later senior offtake cannot eat junior prepaid units.
- Citizenship on chain is a class attestation with an issuer and an expiry. Passport files, license PDFs, and diagnoses are not public fields.
- The agent builds an unsigned transaction. A wallet signs. Validators enforce.
- Cardano is the notary this phase. Protocol parameters are not set by a DRep vote. Midnight is not part of this system.

## What a letter must not say

- That the Clarity Act is law. It failed the Senate 50–49 on 15 September 2026.
- That the SEC Innovation Exemption covers this. That exemption is for permissioned tokenized NMS stocks.
- That a WorkTicket is a registered security, or that it is outside the securities laws. That is the question.
- That an export control map is a license. BIS counseling comes before any mainnet restricted lot.
- Patient names, diagnoses, citizenship files, or license PDFs.

## Who, and the question for each

Counsel in the room. The meetings are public.

| Party | Question |
|---|---|
| SEC Crypto Task Force, Commissioner Peirce, `crypto@sec.gov` | WorkTickets are prepaid specified work and goods. ULTRA settles closed work and is not the raise. Is a meeting the right next step, a Reg CA comment if counsel agrees, or a different frame? |
| SEC Division of Corporation Finance, Chief Counsel | Same product. A later EDF offtake is a new senior claim and cannot consume junior prepaid units. Is “prepaid specified work and goods” the description they want? |
| BIS SNAP-R counseling: Kessler, Peters, Export Administration | `ControlBlock`, `dest_policy`, PersonClass, sanctions-screen expiry, and facility clearance are enforced in the validators. We want counseling on that map before a restricted lot is minted on mainnet. This is not a license application. |

Reg CA (S7-2026-27) is proposed. Comments are due 20 October 2026. A comment that WorkTickets are prepaid specified work or goods is a possible later step, only if counsel agrees. It is not this letter.

## Drafter

Claude may draft from this file and the docs it names. Drafts stay drafts. Ryan chooses the From account and sends. Do not file with the SEC or BIS from this repository.
