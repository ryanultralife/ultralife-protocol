# UltraLife Protocol: NASEC Testnet Guide

## Talk to the Protocol

**No CLI commands. No Web UI. Just conversation.**

You'll use your LLM (Claude, GPT, local) to create pNFTs, collectives, and offerings through natural language.

---

## Quick Setup (~10 minutes)

### 1. Get Credentials

**Blockfrost API Key** (free):
```
https://blockfrost.io
→ Sign up → Create Project → Select "Cardano preview" → Copy API key
```

**Testnet Wallet**:
- Use any Cardano wallet (Eternl, Nami, Lace)
- Switch to Preview testnet
- Copy your address

**Test ADA**:
```
https://docs.cardano.org/cardano-testnets/tools/faucet/
→ Select "Preview" → Paste address → Get tADA
```

### 2. Clone & Setup

```bash
git clone https://github.com/ryanultralife/ultralife-protocol
cd ultralife-protocol

# Build contracts
aiken build

# Setup service
cd service
npm install
cp .env.example .env
# Edit .env with your Blockfrost key
```

### 3. Connect Your LLM

**Claude Desktop** — Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "ultralife": {
      "command": "node",
      "args": ["/path/to/ultralife-protocol/service/dist/index.js"],
      "env": {
        "BLOCKFROST_API_KEY": "previewXXX...",
        "NETWORK": "preview"
      }
    }
  }
}
```

**Other LLMs** — Run MCP server standalone:
```bash
npm start
# Server provides tool interface at stdio
```

---

## Test Scenarios

### Scenario 1: Create Your pNFT

**Talk to your LLM:**
```
"I want to create a pNFT. My wallet address is addr_test1qz..."
```

**What happens:**
1. LLM calls `build_mint_pnft` tool
2. MCP server builds unsigned transaction
3. LLM shows you the transaction details
4. You sign in your wallet
5. Your pNFT exists on-chain

### Scenario 2: Create Your SPO Collective

```
"Create a collective called 'NASEC Pool Operators' in the
Sierra Nevada bioregion. I'll be the founder."
```

### Scenario 3: List Your Staking Services

```
"Create an offering for stake pool operation services.
I charge 2% margin, pool ticker is NASEC."
```

### Scenario 4: Explore the Protocol

```
"What is UltraLife?"
"How do bioregions work?"
"Show me active offerings"
"What's my token balance?"
```

---

## What You're Actually Testing

### Security Model
- LLM builds transactions but **cannot sign**
- Every action requires your wallet approval
- Chain validators enforce all rules

### User Experience
- Is natural language sufficient?
- What questions can't the LLM answer?
- Where does the flow break?

### Technical Correctness
- Do transactions build correctly?
- Are datum structures right?
- Do validators accept/reject appropriately?

---

## Architecture Reference

```
┌──────────────────────────────────────────────────────────┐
│  You: "Create a pNFT for me"                              │
└───────────────────────────┬──────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────┐
│  LLM (Claude/GPT)                                        │
│  - Understands your intent                               │
│  - Calls MCP tools                                       │
│  - Explains results                                      │
└───────────────────────────┬──────────────────────────────┘
                            │ build_mint_pnft
                            ▼
┌──────────────────────────────────────────────────────────┐
│  UltraLife MCP Server                                    │
│  - Reads chain state (Blockfrost)                       │
│  - Builds UNSIGNED transactions                         │
│  - NO private keys                                       │
└───────────────────────────┬──────────────────────────────┘
                            │ Unsigned CBOR TX
                            ▼
┌──────────────────────────────────────────────────────────┐
│  Your Wallet (Eternl/Nami/Lace)                          │
│  - Shows transaction details                             │
│  - YOU review and sign                                   │
│  - YOUR keys, YOUR control                               │
└───────────────────────────┬──────────────────────────────┘
                            │ Signed TX
                            ▼
┌──────────────────────────────────────────────────────────┐
│  Cardano Preview Testnet                                 │
│  - 33 UltraLife validators (reference scripts)          │
│  - Enforces all protocol rules                          │
│  - Immutable on-chain logic                             │
└──────────────────────────────────────────────────────────┘
```

---

## Available MCP Tools

| Tool | What It Does |
|------|--------------|
| `get_ultralife_info` | Explain any UltraLife concept |
| `get_pnft` | Get pNFT details |
| `list_pnfts` | List pNFTs with filters |
| `build_mint_pnft` | Build pNFT creation transaction |
| `list_bioregions` | List all bioregions |
| `get_bioregion` | Get bioregion health indices |
| `list_offerings` | List marketplace offerings |
| `build_create_offering` | Build offering creation transaction |
| `build_accept_offering` | Build offering acceptance |
| `list_collectives` | List organizations |
| `build_create_collective` | Build collective creation |
| `build_transfer_tokens` | Build token transfer |
| `get_token_balance` | Check token balance |

---

## Feedback We Need

### Works / Doesn't Work
- What commands succeeded?
- What commands failed?
- What error messages did you get?

### UX Observations
- Was the LLM's explanation clear?
- Did you understand what you were signing?
- Where did you need more information?

### Security Concerns
- Any way to bypass wallet signing?
- Any misleading transaction descriptions?
- Any unexpected behaviors?

### Ideas
- What features are missing?
- How should SPO integration work?
- What would make this useful for your community?

---

## Reporting Issues

GitHub Issues: https://github.com/ryanultralife/ultralife-protocol/issues

Include:
1. What you tried to do
2. What actually happened
3. LLM response (if relevant)
4. Transaction hash (if submitted)

---

## Technical Details for Curious SPOs

### Validators (33 total)
```
contracts/validators/
├── pnft.ak           # Identity (one per human)
├── token.ak          # ULTRA token
├── treasury.ak       # Bonding curve, founder comp
├── marketplace.ak    # Offerings & needs
├── collective.ak     # Organizations
├── bioregion.ak      # Geographic regions
├── ubi.ak            # UBI distribution
├── stake_pool.ak     # SPO integration
└── ... (25 more)
```

### Key Types
```aiken
pub type PnftDatum {
  pnft_id: ByteArray,
  owner: VerificationKeyHash,
  level: VerificationLevel,  // Basic, Ward, Standard, Verified, Steward
  bioregion: Option<ByteArray>,
  dna_hash: Option<ByteArray>,
  guardian: Option<AssetName>,  // For minors
  // ... impact tracking fields
}
```

### Test Commands (Scripts)
```bash
cd scripts

# Run all local tests
npm run test:all

# Deploy reference scripts (needs funded wallet)
npm run deploy:references

# Mint a pNFT (after deploy)
npm run mint

# Run e2e automated tests
npm run test:e2e
```

---

## The Vision

> "The bar for participation is: can you talk?"

No technical knowledge required. No apps to download. Just conversation with any LLM that has the MCP tools.

Your grandmother could use this. Your kids could use this. Anyone who can talk can participate in the economy.

---

**Questions? Join the discussion. Break things. That's what testnet is for.**
