# UltraLife Protocol — Onboarding & Bootstrap

## The Bootstrap Problem

UltraLife requires DNA-verified identities, but how do you verify DNA when no verification infrastructure exists?

**Solution:** Genesis period with founder keys, progressive decentralization.

## Verification Levels

```
Basic     → Wallet signature only, cannot transact
Ward      → Guardian-linked (children, elderly, infirm)
Standard  → DNA-verified, full economy access
Verified  → Standard + bioregion residency
Steward   → Verified + community endorsement
```

## Ward pNFTs (Those Under Guardianship)

Some people can't manage their own affairs: children, elderly with dementia, adults with severe disabilities, those in comas. They still need identity and economic participation.

### Who Can Be a Ward?

```
WARD SCENARIOS

CHILDREN:
├── Newborns (birth attestation)
├── Minors until coming of age
└── Emancipation upgrades to Standard

ELDERLY:
├── Dementia/Alzheimer's patients
├── Those requiring full-time care
└── Power of Attorney situations

INCAPACITATED:
├── Coma patients
├── Severe cognitive disability
├── Court-appointed guardianship
```

### How It Works

```
WARD PNFT CREATION

1. Guardian has Standard+ pNFT
2. Witness attests the ward relationship:

   FOR CHILDREN:
   ├── Biological parent (Verified+)
   ├── Other parent (Verified+)
   ├── Grandparent (Verified+)
   ├── Licensed midwife (Steward)
   ├── Medical professional (Steward)
   └── Hospital/birth center (Collective)

   FOR ELDERLY/INFIRM:
   ├── Adult child (Verified+)
   ├── Sibling (Verified+)
   ├── Care facility (Collective)
   ├── Court-appointed guardian (legal attestation)
   ├── Power of Attorney holder (legal attestation)
   └── Physician certification (Steward)

3. Ward pNFT minted with:
   ├── Level: Ward
   ├── Guardian link: Guardian's pNFT
   ├── ward_since: When guardianship began
   └── DNA hash: May or may not have (elderly may have prior)
```

### Ward Capabilities

```
WARD PERMISSIONS

✓ Receive tokens (gifts, inheritance, benefits)
✓ Spend tokens (with guardian co-signature)
✓ Own assets in their pNFT
✓ Participate in bioregion (counted)
✓ Receive UBI (to guardian custody)

✗ Cannot independently transact
✗ Cannot vote
✗ Cannot become Verified/Steward
```

### Exiting Ward Status

```
UPGRADE WARD → STANDARD

FOR CHILDREN (Coming of Age):
├── Complete DNA verification
├── Sign upgrade tx (proves key control)
└── Guardian link removed

FOR RECOVERED ADULTS:
├── Physician certifies recovery (Steward)
├── Ward signs upgrade tx
├── Guardian link removed
├── May already have DNA on file

FOR DECEASED WARDS:
├── Death certificate attestation
├── pNFT burned
├── Assets distributed per will/law
```

### Transfer Guardianship

```
CHANGE GUARDIAN

Requires:
├── Current guardian signature
├── New guardian signature (acceptance)
├── New guardian is Standard+
├── For court-appointed: legal attestation

Use cases:
├── Parent dies, grandparent takes over
├── Care facility changes
├── Power of Attorney transfers
```
✓ Participate in bioregion (counted)
✓ Receive UBI (partial, to guardian custody)

✗ Cannot independently transact
✗ Cannot vote
✗ Cannot become Verified/Steward
```

### Coming of Age

When ready (typically 16-18, jurisdiction varies):

```
UPGRADE WARD → STANDARD (Coming of Age)

1. Minor completes DNA verification
2. Minor signs the upgrade tx (proves key control)
3. pNFT upgrades: Ward → Standard
4. Guardian link removed
5. Full independence achieved
```

### Transfer Guardianship

If guardian changes (death, adoption, custody):

```
TRANSFER GUARDIANSHIP

Requires:
├── Current guardian signature
├── New guardian signature (acceptance)
├── New guardian is Standard+

Results:
└── Ward pNFT guardian field updated
```

---

## Genesis Configuration

```javascript
{
  genesis_end_slot: 15_000_000,  // ~6 months
  founding_oracles: [alice, bob, carol, dave, eve],
  founding_stewards: [alice, bob, carol],
  genesis_oracle_threshold: 2,
  steward_threshold: 37
}
```

Founders are identified by **wallet key hashes**, not pNFTs.

## Bootstrap Sequence

### 1. Deploy
Genesis contract configured with founder keys.

### 2. Founders Create pNFTs
Like anyone else — no special treatment.

### 3. Founders Self-Verify
```
FounderSelfVerify { pnft, dna_hash }
```
Founder signs with their oracle key. pNFT upgrades Basic → Standard.

### 4. Founders Become Stewards
```
FounderBecomeSteward { pnft }
```
Founder signs with their steward key. pNFT upgrades to Steward (skips Verified).

### 5. Create First Bioregion
Steward founders establish first bioregion.

### 6. Register DNA Oracles
```
RegisterOracle { partner_id, signing_key, metadata_hash }
```
Requires 2+ founder signatures. Partners could be clinics, testing services, etc.

### 7. Community Onboarding
- Users create Basic pNFTs (permissionless)
- Users visit registered DNA partner
- Partner attests DNA → user upgrades to Standard
- User claims 50-token grant (immediate, no waiting)

### 8. Community Stewards Emerge
- Active Standard users prove bioregion residency → Verified
- Founders endorse as Stewards (requires 2+ endorsements)

### 9. Genesis Ends
When **either**:
- 37+ non-founder Stewards AND 3+ oracles AND 1+ bioregion
- OR genesis_end_slot reached

Founders lose special powers. System is fully decentralized.

## User Journey

### Step 1: Create Basic pNFT
```
Cost: ~2 ADA (tx fee)
Gets: pNFT in wallet, view access
Cannot: Transact tokens, vote, claim UBI
```

### Step 2: DNA Verification → Standard
```
1. Visit registered verification partner
2. Partner collects sample, signs attestation
3. Submit upgrade transaction
4. Gets: Token transactions, voting, 50-token grant (immediate), UBI
```

### Step 3: Bioregion Residency → Verified
```
1. Prove residency to bioregion stewards
2. Submit upgrade transaction
3. Gets: Higher voting weight (2x), can create proposals
```

### Step 4: Community Endorsement → Steward
```
1. Get endorsed by 3+ existing Stewards
2. Submit upgrade transaction
3. Gets: Highest voting weight (3x), can endorse others, multi-sig
```

## DNA Verification Methods

| Tier | Method | Accessibility |
|------|--------|---------------|
| 1 | Full genetic testing | Low |
| 2 | Biometric capture | Medium |
| 3 | In-person + Gov ID | High |
| 4 | Social verification | Very high |

The protocol supports multiple tiers. Start with what's available.

## Decentralization Triggers

Genesis ends automatically when:

**Threshold-based:**
- 37+ non-founder Stewards
- 3+ DNA oracles registered
- 1+ bioregion established

**Time-based:**
- Genesis end slot reached

After genesis, founder keys have no special meaning.
