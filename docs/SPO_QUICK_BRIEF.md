# UltraLife Protocol: Quick Brief for SPOs

## What Is It?

UltraLife is a bioregion-based economic layer on Cardano where:
- Every human has ONE identity (DNA-verified pNFT)
- Everything is transparent (all transactions, all impacts)
- UBI flows based on bioregion health
- The UI is natural language (any LLM)

## What You'll Test

You'll use YOUR own LLM (Claude, GPT, local model) to:
1. Create a pNFT (simulated DNA on testnet)
2. Create a collective ("business")
3. Create offerings (stake pool services)
4. Purchase tokens from development pool
5. Execute transactions between pNFTs

## The Big Question

**"How can an LLM interface be secure?"**

## The Answer

```
LLM = Transaction BUILDER (no keys)
Wallet = Transaction SIGNER (your keys)
Chain = Transaction VALIDATOR (enforces rules)

LLM can build bad tx → You see it in wallet → You don't sign → No harm
LLM can lie about state → Chain rejects invalid tx → No harm
LLM compromised → Still can't sign without your wallet → No harm
```

**The LLM is a convenience layer, not a trust layer.**

## How It Actually Works

```
┌────────────────────────────────────────────────────────────────┐
│  YOUR LLM (Claude, GPT, Llama, etc.)                          │
│  "I want to create a pNFT"                                     │
└────────────────────────────────────────────────────────────────┘
                         │
                         │ MCP Tool Call
                         ▼
┌────────────────────────────────────────────────────────────────┐
│  ULTRALIFE MCP SERVER                                          │
│                                                                 │
│  • Reads chain state (Blockfrost/Ogmios/Koios)                │
│  • Builds UNSIGNED transaction                                 │
│  • Returns tx + summary to LLM                                 │
│                                                                 │
│  ⚠️  NO PRIVATE KEYS - CANNOT SIGN                            │
└────────────────────────────────────────────────────────────────┘
                         │
                         │ Unsigned TX (CBOR)
                         ▼
┌────────────────────────────────────────────────────────────────┐
│  YOUR WALLET (Nami, Eternl, Lace)                              │
│                                                                 │
│  • Shows transaction details                                   │
│  • YOU review before signing                                   │
│  • YOU sign with YOUR private key                              │
└────────────────────────────────────────────────────────────────┘
                         │
                         │ Signed TX
                         ▼
┌────────────────────────────────────────────────────────────────┐
│  CARDANO NETWORK                                                │
│                                                                 │
│  • Reference scripts (our validators) on-chain                │
│  • Validates signatures, executes Plutus                       │
│  • Enforces ALL protocol rules                                 │
└────────────────────────────────────────────────────────────────┘
```

### Key Implementation Details

**How LLM reads chain state:**
- MCP server queries Blockfrost/Ogmios/Koios (standard Cardano APIs)
- Custom indexer caches UltraLife-specific datum types
- LLM calls MCP tools like `get_pnft`, `list_offerings`, `get_bioregion`

**How LLM builds transactions:**
- MCP server uses Lucid/Blaze/Mesh (standard Cardano TX builders)
- Validators deployed as **reference scripts** (on-chain, immutable)
- TX references the script, doesn't include it (efficient)

**Additional security:**
- Rate limiting at service layer
- Audit logging (off-chain)
- Optional session tokens for abuse prevention
- But fundamentally: **wallet signing is the security**

## What Makes This Different

| Traditional | UltraLife |
|-------------|-----------|
| Wallet addresses = identity | pNFT = identity (one per human) |
| Sybil attacks possible | DNA verification prevents |
| Manual transaction building | Natural language interface |
| Technical barrier | "Can you talk?" barrier |
| Impact invisible | Every tx declares compound flows |

## For SPOs Specifically

Stake pools are organized by **bioregion** (ecological boundary):

```aiken
pub type StakePoolDatum {
  pool_id: ByteArray,
  bioregion: ByteArray,          // Sierra Nevada, Amazon, etc.
  operator: AssetName,           // Your pNFT
  impact_commitment: ByteArray,  // What ecosystem work you support
}
```

Your pool doesn't just stake — it's tied to a living ecosystem.

## The Security Model (TL;DR)

1. **LLM has no keys** → Can't steal anything
2. **Wallet still required** → You sign everything
3. **Validators enforce rules** → Can't bypass on-chain logic
4. **pNFT is permanent** → One identity per human, unforgeable

## What We Want Reviewed

1. **Smart contracts** — Are the validators sound? (Aiken code in `contracts/validators/`)
2. **Security model** — Any holes in the LLM→MCP→Wallet→Chain flow?
3. **Reference script approach** — Is this the right deployment pattern?
4. **Economic model** — Does the tokenomics make sense?
5. **SPO integration** — How should bioregion pools work?
6. **MCP design** — Are the tool schemas sensible?

## Current State

**What exists:**
- 27 Aiken validators (~25,000 lines)
- Type definitions
- Documentation

**What we're building:**
- MCP server
- Chain indexer
- TX builder service
- Wallet integration

**What we need from you:**
- Poke holes in the security model
- Suggest improvements
- Tell us what's missing

## Quick Stats

- 27 validators
- ~25,000 lines of Aiken
- Universal framework (any economic activity)
- Compound-based impact tracking (actual chemistry)
- Consumer accountability (your demand, your impact)

## Links

- Full repo: [ultralife-protocol-github.zip]
- Security doc: `docs/LLM_SECURITY_MODEL.md`
- Framework: `docs/UNIVERSAL_FRAMEWORK.md`
- Contracts: `contracts/validators/`

## The Vision

> "The bar for participation is: can you talk?"

Technology should be invisible. The blockchain should be invisible. What remains: humans making choices, impacts tracked, markets optimizing for life.

---

**Questions? Poke holes. That's why we're here.**
