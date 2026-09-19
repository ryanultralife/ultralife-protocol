# Transaction privacy — not identity privacy

Identity stays. The **payload** of a spend can hide.

```
ALWAYS PUBLIC (identity / law)
  pNFT exists, one human
  lab is licensed
  lot UTxO is one-shot (no double dose)
  status moved to Administered

SELECTABLE PRIVATE (the transaction)
  which patient
  which nuclide / Bq / CPT
  why (diagnosis)
  remaining activity
```

Rule 5 still holds: **no ghost wallets.** A mixer of I-131 is a crime. Privacy here is *confidential transactions*, not *anonymous persons*.

## Medical procedures

Do **not** make the patient the on-chain owner of the lot if the procedure is the secret.

| Role | On-chain | Off-chain / viewing key |
|------|----------|-------------------------|
| Hospital / pharmacy pNFT | Owns the lot (inventory) | — |
| Licensed lab pNFT | Signs `Produce` / `Convert` / `Administer` | COA, kit lot |
| Patient pNFT | **Commitment only** | Opens the record |
| Clinician | — | Same viewing key |
| Public / other agents | See: a lab administered a lot | Do not see who or what |

`Administer` redeemer is:

```
Administer { patient_commit, procedure_commit }
```

Both are `blake2b(plaintext || nonce)`. The validator checks: lot is a dose, lab signed, remaining Bq useful, not expired. It does **not** need the patient id.

Patient later proves “that commitment is me” by revealing the nonce to whoever they grant a viewing key (self, clinician, insurer, court).

This is already the shape of `ContentReference` in `types.ak`: `content_type: Medical`, `encrypted: true`, only the hash on-chain.

## Three lanes (use the cheapest that fits)

### 1. Commitments on L1 — works today

Encrypted blob (IPFS / `PrivateStorage`) + 32-byte hashes on the lot datum. No new chain. Good for: isotope doses, clinic notes, most care.

### 2. Hydra head — private among participants

Hospital + lab + maybe insurer in one head. Procedure txs never hit L1 in the clear. Settlement is a merkle root of administered lots. Observers see “this lab settled N lots this epoch.”

Still: every L2 tx terminates at a pNFT **inside the head**. Settlement does not have to name them.

### 3. ZK / Midnight / Starstream — prove without showing

Prove: “a Standard+ pNFT is the patient, the lot had remaining Bq, the lab is licensed.” Reveal nothing else. Identity is in the **witness**, not the transaction.

We marked Midnight as a later overlay (waveform hashes, not the pNFT). Same overlay for procedure payloads. Not built. Do not wait on it for lane 1.

## What we will not do

- Hide that a pNFT exists
- Let a lot move with no pNFT in the proof
- Put diagnosis in tx metadata and call it private
- Fractionate identity so “part of you” is the patient
- Use ADA mixers as a medical privacy strategy

If an agent can read who got the dose from the ledger, the transaction was not private. If an agent can mint a dose with no licensed lab and no pNFT proof, the protocol is broken.
