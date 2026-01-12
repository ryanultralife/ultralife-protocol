# UltraLife MCP Service

## The LLM IS the Documentation

When users connect to UltraLife through any LLM, **the LLM itself becomes the documentation**. The MCP server provides:

1. **Protocol Context** — Embedded knowledge about UltraLife concepts
2. **Query Tools** — Real-time chain state queries
3. **Transaction Builders** — Create unsigned transactions
4. **Self-Describing Tools** — Each tool has descriptions the LLM uses

This means users can ask:
- "What is UltraLife?" → LLM explains from embedded context
- "How do pNFTs work?" → LLM explains identity system
- "Show me my balance" → LLM calls `get_token_balance` tool
- "Create an offering" → LLM calls `build_create_offering` tool

**No separate documentation needed.** The LLM guides users through natural conversation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  ANY LLM (Claude, GPT, Llama, etc.)                            │
│                                                                 │
│  Has: Tool definitions + Protocol context                       │
│  Can: Explain concepts, answer questions, build transactions    │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ MCP Protocol (stdio)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  ULTRALIFE MCP SERVER (this package)                            │
│                                                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │  Indexer    │ │  Builder    │ │  MCP Tools  │              │
│  │             │ │             │ │             │              │
│  │ Blockfrost  │ │ Lucid       │ │ 20+ tools   │              │
│  │ queries     │ │ transactions│ │ for LLM     │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
                         │
                         │ Blockfrost API / Cardano Node
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│  CARDANO NETWORK                                                 │
│                                                                 │
│  Reference scripts deployed on-chain                            │
│  All UltraLife state stored in UTxOs                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

### 1. Install Dependencies

```bash
cd service
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your Blockfrost API key
```

### 3. Deploy Contracts (First Time Only)

```bash
# Need: Blockfrost key + funded wallet seed phrase
export BLOCKFROST_API_KEY=your_key
export DEPLOYER_SEED="your 24 word seed phrase"

npm run deploy-scripts
```

### 4. Seed Testnet Data

```bash
npm run seed-testnet
```

### 5. Start MCP Server

```bash
npm start
```

### 6. Connect Your LLM

For Claude Desktop, add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ultralife": {
      "command": "node",
      "args": ["/path/to/ultralife-protocol-v2/service/dist/index.js"]
    }
  }
}
```

---

## Available Tools

### Information
| Tool | Description |
|------|-------------|
| `get_ultralife_info` | Explain UltraLife concepts (identity, offerings, bioregions, etc.) |
| `get_protocol_stats` | Overall protocol statistics |

### Identity (pNFT)
| Tool | Description |
|------|-------------|
| `get_pnft` | Get pNFT details by ID |
| `get_pnft_by_address` | Find pNFT for a wallet address |
| `get_token_balance` | Get token balance for a pNFT |
| `list_pnfts` | List pNFTs with filters |
| `build_mint_pnft` | **Build tx** to create new pNFT |

### Bioregions
| Tool | Description |
|------|-------------|
| `list_bioregions` | List all bioregions with health indices |
| `get_bioregion` | Get detailed bioregion info |

### Marketplace
| Tool | Description |
|------|-------------|
| `list_offerings` | List offerings with filters |
| `get_offering` | Get offering details |
| `list_needs` | List work requests with filters |
| `get_need` | Get need details |
| `build_create_offering` | **Build tx** to create offering |
| `build_accept_offering` | **Build tx** to accept offering |

### Collectives
| Tool | Description |
|------|-------------|
| `list_collectives` | List collectives (businesses) |
| `get_collective` | Get collective details |
| `build_create_collective` | **Build tx** to create collective |
| `build_add_collective_member` | **Build tx** to add member |

### Tokens
| Tool | Description |
|------|-------------|
| `build_transfer_tokens` | **Build tx** to transfer tokens |
| `build_purchase_from_pool` | **Build tx** to buy from dev pool |

---

## Example Conversations

### Learning About UltraLife

```
User: What is UltraLife?

LLM: [Calls get_ultralife_info with topic='general']

UltraLife Protocol is a bioregion-based economic system on Cardano. 
Here's what makes it unique:

**Identity**: Every human has ONE pNFT (Personal NFT), verified by DNA. 
This creates permanent, unforgeable identity.

**Bioregions**: Instead of political boundaries, everything is organized 
by ecological boundaries. UBI distribution is tied to bioregion health.

**Transparency**: Every transaction records its environmental impact 
(compound flows like CO2, H2O). Consumers see their total impact.

**Collectives**: Groups can form organizations with shared treasury 
and governance - like transparent cooperatives.

Would you like to learn more about any of these concepts?
```

### Creating a pNFT

```
User: I want to create a pNFT. My wallet address is addr_test1qz...

LLM: [Calls build_mint_pnft]

I've built a transaction to create your pNFT:

**Action**: Mint pNFT
**Your pNFT ID**: pnft_1a2b3c...
**Bootstrap Grant**: 50 tokens
**Cost**: ~2 ADA (min UTxO + fees)

To complete:
1. Review the transaction details
2. Sign with your wallet
3. Your pNFT will be created!

Here's the unsigned transaction: [CBOR hex]

Would you like me to explain what happens next?
```

### Exploring the Marketplace

```
User: Show me offerings in Sierra Nevada

LLM: [Calls list_offerings with bioregion='sierra_nevada']

Found 3 active offerings in Sierra Nevada:

1. **Organic Vegetables** (Thing)
   - Offerer: pnft_abc...
   - Price: 10 tokens
   - Impact: +15 (local organic farming)

2. **Trail Maintenance** (Work)
   - Offerer: pnft_def...
   - Price: 25 tokens/hour
   - Impact: +40 (ecosystem restoration)

3. **Wilderness Guide** (Access)
   - Offerer: pnft_ghi...
   - Price: Negotiable
   - Impact: +5 (low-impact tourism)

Would you like to accept any of these offerings?
```

---

## Security Model

**The LLM cannot:**
- Sign transactions (no private keys)
- Submit without wallet approval
- Bypass on-chain validators

**The LLM can only:**
- Read public chain state
- Build unsigned transactions
- Explain the protocol

**Users must:**
- Review transactions in their wallet
- Sign with their own keys
- Submit through their wallet

---

## Development

### Build
```bash
npm run build
```

### Run in Dev Mode
```bash
npm run dev
```

### Test
```bash
npm test
```

---

## File Structure

```
service/
├── src/
│   ├── index.ts          # Entry point
│   ├── types/            # TypeScript types matching Aiken
│   ├── indexer/          # Chain state queries
│   ├── builder/          # Transaction construction
│   ├── mcp/              # MCP server and tools
│   └── scripts/          # Deployment scripts
├── package.json
├── tsconfig.json
└── README.md
```

---

## For SPO Testers

1. **Connect your LLM** to the MCP server
2. **Ask questions**: "What is UltraLife?", "How do bioregions work?"
3. **Create a pNFT**: Give your wallet address
4. **Create a collective**: For your stake pool operation
5. **Create an offering**: Offer your SPO services
6. **Explore**: List bioregions, offerings, other collectives

**The LLM guides you through everything.** No documentation reading required.

---

## Questions?

Ask the LLM! That's the point. 

If you find gaps in what the LLM can explain or do, that's feedback we need.
