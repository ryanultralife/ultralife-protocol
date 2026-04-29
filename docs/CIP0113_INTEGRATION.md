# CIP-0113 Programmable Token Integration Strategy

## What CIP-0113 Is

CIP-0113 is the Cardano Foundation's open-source standard for programmable tokens. It represents the merged result of CIP-113 and CIP-143 into a unified, interoperable programmable token standard.

### Key Capabilities

- **Modular Compliance Logic**: Token issuers can attach modular compliance logic directly to native Cardano assets
- **Automatic Rule Enforcement**: Rules are automatically enforced every time a token is transferred, minted, or burned
- **On-Chain Registry**: An on-chain registry allows wallets and dApps to query which rules apply to a token and which scripts must execute per transaction
- **Interoperability**: Third-party tools can interact with CIP-0113 tokens without understanding custom contract logic

### Current Status

- **Live on Preview testnet**: https://preview.programmabletokens.xyz/
- **Version**: V1, with V2 planned once new ledger features enable multi-UTXO seizing
- **Upgrade Path**: V1 tokens can be upgraded to V2 if burning policy is kept always-allowed

---

## Why It Matters for UltraLife

UltraLife already enforces transfer logic through 27 Aiken validators. CIP-0113 doesn't replace this architecture — it standardizes how wallets and dApps discover and execute those rules.

### Benefits

| Benefit | Description |
|---------|-------------|
| **Ecosystem Discoverability** | Wallets can query the on-chain registry to understand token rules |
| **Reduced Integration Cost** | Third-party dApps don't need custom UltraLife integration |
| **Wallet Compatibility** | Any CIP-0113-aware wallet automatically understands token rules |
| **Innovation-First Approach** | Adopt the standard where it helps, maintain custom architecture where it doesn't |

---

## Validator Mapping to CIP-0113

### Direct Candidates

Tokens that move through supply chains with enforced transfer conditions:

| Validator | Token Type | CIP-0113 Use Case |
|-----------|------------|-------------------|
| `impact` | Impact tokens | Track environmental effects, enforce supply chain rules |
| `impact_market` | Impact market tokens | Compliance verification for trading |
| `asset_impact` | Asset-level impact | Transfer restrictions based on impact status |
| `remediation` | Remediation obligations | Obligations that travel with products |
| `preservation` | Preservation credits | Verified holder requirements for conservation credits |

### Strong Candidates

Assets with transfer restrictions based on identity or membership:

| Validator | Token Type | CIP-0113 Use Case |
|-----------|------------|-------------------|
| `token` | ULTRA token | Bioregion-aware transfer logic |
| `bioregion` | Bioregion tokens | Restricted to verified bioregion participants |
| `commons` | Commons resources | Community governance rules for shared assets |
| `land_rights` | Land stewardship tokens | pNFT-verified holder requirements |

### Not Applicable

Identity and infrastructure validators (not token transfer logic):

| Validator | Reason |
|-----------|--------|
| `pnft` | Identity infrastructure, not a tradeable asset |
| `recovery` | Identity recovery mechanism |
| `governance` | Governance process validator |
| `ubi` | UBI distribution logic |
| `genesis` | Protocol initialization |
| `stake_pool` | Staking infrastructure |
| `marketplace` | Marketplace logic (references tokens but isn't one) |
| `work_auction` | Work contract system |
| `records` | Record keeping |
| `registry` | Registry infrastructure |
| `memory` | On-chain memory |
| `collective` | Collective organization |
| `care` | Care system |
| `energy` | Energy tracking |
| `grants` | Grant distribution |

### Out of Scope

L2 validators (operate in Hydra heads, not subject to L1 token standards):

| Validator | Reason |
|-----------|--------|
| `spending_bucket` | Hydra L2 |
| `ultralife_validator` | Hydra L2 |
| `fee_pool` | Hydra L2 |

---

## Integration Approach

### Phase 1: Impact Tokens

1. Wrap Impact Tokens with CIP-0113 V1 compliance layer
2. Register in on-chain registry
3. Verify wallet discovery works
4. Test transfer enforcement through standard CIP-0113 flow

### Phase 2: Bioregion Tokens

1. Apply CIP-0113 to Bioregion Tokens
2. These are most likely to interact with external wallets and dApps
3. Leverage existing `bioregion.ak` validator as enforcement layer

### Architecture Principle

- **CIP-0113 = discovery layer** (how wallets/dApps find rules)
- **Aiken validators = enforcement layer** (how rules are enforced)
- CIP-0113 wraps existing validators in a discoverable standard, it doesn't replace them

### V2 Upgrade Path

- Plan for V2 when multi-UTXO seizing arrives in ledger
- Keep burning policies always-allowed for smooth upgrade
- V2 enables more complex compliance scenarios (batch seizures, multi-party escrow)

---

## What This Doesn't Change

### LLM Interface

- The invisible interface architecture stays unchanged
- CIP-0113 operates at the smart contract layer
- Users still interact via conversation with any LLM

### Wallet Security Model

- LLM builds transactions, wallet signs, chain enforces
- CIP-0113 standardizes the "chain enforces" step
- No changes to key management or signing flow

### MCP Service

- 31 MCP tools continue to work as-is
- MCP service constructs CIP-0113-compliant transactions automatically
- No new MCP tools required for CIP-0113 support

---

## Compliance Readiness

### Current Landscape

- A BaFin-compliant substandard for securities is being developed for CIP-0113, sponsored by Finest
- A frontend for easy minting of compliant CIP-0113 tokens is in development
- This matters if/when Impact Tokens or Bioregion Tokens touch regulated markets

### UltraLife Approach

- **Architectural readiness** without premature compliance burden
- CIP-0113's modular design means compliance logic can be plugged in later
- No need to redesign core contracts when regulations apply
- Consistent with UltraLife's innovation-first, compliance-ready philosophy

---

## Testing Path

### Preview Testnet Proof of Concept

1. Deploy a CIP-0113-wrapped Impact Token on Preview testnet
2. Register in on-chain programmable token registry
3. Test with CIP-0113-aware wallet (discover rules via registry)
4. Verify transfer enforcement through standard flow

### MCP Integration Test

1. Construct CIP-0113-compliant transaction via MCP tools
2. Verify transaction includes required script references
3. Test full flow: LLM conversation -> MCP build -> wallet sign -> CIP-0113 enforcement

### Success Criteria

- [ ] Third-party wallet discovers UltraLife token rules without custom integration
- [ ] Transfer restrictions enforced via standard CIP-0113 flow
- [ ] Existing MCP tools work without modification
- [ ] No regression in current validator behavior

---

## References

- **CIP Pull Request**: https://github.com/cardano-foundation/CIPs/pull/444
- **Reference Implementation**: https://github.com/input-output-hk/wsc-poc
- **CertiK Analysis**: https://www.certik.com/resources/blog/a-long-overdue-innovation-in-cardano-interoperable-programmable-token-design
- **Cardano Foundation Blog**: https://cardanofoundation.org/blog/programmable-tokens-cardano
- **Preview Testnet**: https://preview.programmabletokens.xyz/
